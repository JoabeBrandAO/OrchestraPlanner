import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";

import { withUserContext } from "@/server/db/rls";
import {
  accounts,
  budgets,
  transactionCategories,
  transactions,
  type AccountRow,
  type BudgetRow,
  type TransactionCategoryRow,
  type TransactionRow,
} from "@/server/db/schema";
import { validateTitle } from "@/server/services/shared/validate-title";

import {
  compareBudget,
  isMonth,
  monthRange,
  type BudgetActual,
  type BudgetCategory,
  type BudgetComparison,
  type BudgetPlan,
  type Month,
} from "./budget";
import { type Cents } from "./money";

/**
 * Financeiro (#52) — contas, categorias e lançamentos. Recebe `userId` e roda sob
 * `withUserContext`: a RLS isola. Dinheiro em **centavos inteiros** (ver `money.ts`); o
 * sinal vem do `direction`, nunca do número.
 */

export type AccountWithBalance = AccountRow & {
  /** Saldo **derivado**: inicial + entradas − saídas. Não há coluna de saldo para desandar. */
  balanceCents: Cents;
};

export type TransactionWithLabels = TransactionRow & {
  accountName: string;
  categoryName: string | null;
};

export type AccountInput = {
  name: string;
  kind?: AccountRow["kind"];
  initialBalanceCents?: Cents;
};

export type TransactionInput = {
  accountId: string;
  happenedAt: string;
  direction: TransactionRow["direction"];
  amountCents: Cents;
  categoryId?: string | null;
  lifeAreaId?: string | null;
  description?: string | null;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Categorias que todo mundo usa, semeadas na **primeira conta** — não no login. Semear a
 * cada visita custaria uma escrita em toda página, e o Financeiro só começa a existir
 * quando há uma conta.
 */
const DEFAULT_CATEGORIES: { name: string; direction: TransactionRow["direction"] }[] = [
  { name: "Salário", direction: "entrada" },
  { name: "Renda extra", direction: "entrada" },
  { name: "Moradia", direction: "saida" },
  { name: "Alimentação", direction: "saida" },
  { name: "Transporte", direction: "saida" },
  { name: "Saúde", direction: "saida" },
  { name: "Educação", direction: "saida" },
  { name: "Lazer", direction: "saida" },
  { name: "Doações", direction: "saida" },
  { name: "Outros", direction: "saida" },
];

function validateAmount(amountCents: Cents): void {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    // O sinal é do `direction`; número negativo aqui seria uma segunda forma de dizer
    // "saída", e as duas se desencontrariam na primeira edição.
    throw new Error("O valor precisa ser maior que zero.");
  }
}

export async function createAccount(userId: string, input: AccountInput): Promise<AccountRow> {
  const name = validateTitle(input.name);
  if (!name.ok) throw new Error(name.error);

  const initial = input.initialBalanceCents ?? 0;
  if (!Number.isSafeInteger(initial)) throw new Error("Saldo inicial inválido.");

  return withUserContext(userId, async (tx) => {
    const [row] = await tx
      .insert(accounts)
      .values({
        userId,
        name: name.value,
        kind: input.kind ?? "corrente",
        initialBalanceCents: initial,
      })
      .returning();

    // Idempotente pelo banco (índice único + `on conflict`), nunca por um `if` — a lição
    // das Áreas de Vida duplicadas (ver `docs/ERROS.md` 2026-08-13).
    await tx
      .insert(transactionCategories)
      .values(DEFAULT_CATEGORIES.map((category) => ({ userId, ...category })))
      .onConflictDoNothing();

    return row!;
  });
}

/**
 * Contas com o saldo já calculado — **uma consulta só**, porque é uma tela só (ver
 * `query-budget.test.ts`). O saldo é uma agregação sobre o `left join` com os lançamentos,
 * e não uma subconsulta correlacionada: a correlacionada, escrita à mão no template `sql`,
 * silenciosamente devolvia zero.
 */
export async function listAccounts(userId: string): Promise<AccountWithBalance[]> {
  return withUserContext(userId, async (tx) => {
    const rows = await tx
      .select({
        account: accounts,
        movimento: sql<string>`coalesce(sum(
          case when ${transactions.direction} = 'entrada'
            then ${transactions.amountCents}
            else -${transactions.amountCents}
          end
        ), 0)`,
      })
      .from(accounts)
      .leftJoin(transactions, eq(transactions.accountId, accounts.id))
      // Agrupar pela chave primária basta: o Postgres sabe que o resto da conta depende
      // dela. Conta sem lançamento sobrevive ao `left join` e soma zero.
      .groupBy(accounts.id)
      .orderBy(asc(accounts.name));

    return rows.map((row) => ({
      ...row.account,
      // `sum` volta como **string** (o Postgres promove a bigint); somar sem converter
      // concatenaria texto e o saldo viraria "10000-500".
      balanceCents: row.account.initialBalanceCents + Number(row.movimento),
    }));
  });
}

export async function deleteAccount(userId: string, id: string): Promise<void> {
  await withUserContext(userId, (tx) => tx.delete(accounts).where(eq(accounts.id, id)));
}

export async function listCategories(userId: string): Promise<TransactionCategoryRow[]> {
  return withUserContext(userId, (tx) =>
    tx
      .select()
      .from(transactionCategories)
      .orderBy(asc(transactionCategories.direction), asc(transactionCategories.name)),
  );
}

export async function createCategory(
  userId: string,
  input: { name: string; direction: TransactionRow["direction"] },
): Promise<TransactionCategoryRow> {
  const name = validateTitle(input.name);
  if (!name.ok) throw new Error(name.error);

  return withUserContext(userId, async (tx) => {
    const [row] = await tx
      .insert(transactionCategories)
      .values({ userId, name: name.value, direction: input.direction })
      .onConflictDoNothing()
      .returning();

    if (row) return row;

    // Já existia: devolve a que existe em vez de estourar. Cadastrar duas vezes a mesma
    // categoria é engano comum, e não é erro do ponto de vista de quem usa.
    const [existing] = await tx
      .select()
      .from(transactionCategories)
      .where(
        and(
          eq(transactionCategories.direction, input.direction),
          sql`lower(${transactionCategories.name}) = lower(${name.value})`,
        ),
      );
    return existing!;
  });
}

export async function createTransaction(
  userId: string,
  input: TransactionInput,
): Promise<TransactionRow> {
  if (!ISO_DATE.test(input.happenedAt)) throw new Error("Data do lançamento inválida.");
  validateAmount(input.amountCents);

  return withUserContext(userId, async (tx) => {
    const [account] = await tx
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.id, input.accountId));
    if (!account) throw new Error("Conta não encontrada.");

    const [row] = await tx
      .insert(transactions)
      .values({
        userId,
        accountId: input.accountId,
        categoryId: input.categoryId ?? null,
        lifeAreaId: input.lifeAreaId ?? null,
        happenedAt: input.happenedAt,
        direction: input.direction,
        amountCents: input.amountCents,
        description: input.description?.trim() || null,
      })
      .returning();
    return row!;
  });
}

export async function deleteTransaction(userId: string, id: string): Promise<void> {
  await withUserContext(userId, (tx) =>
    tx.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId))),
  );
}

/**
 * Extrato do período, do mais recente para o mais antigo, com os rótulos que a tela mostra
 * — **uma consulta só**.
 */
export async function listTransactions(
  userId: string,
  range: { from: string; to: string },
): Promise<TransactionWithLabels[]> {
  if (!ISO_DATE.test(range.from) || !ISO_DATE.test(range.to)) {
    throw new Error("Período inválido.");
  }

  return withUserContext(userId, async (tx) => {
    const rows = await tx
      .select({
        transaction: transactions,
        accountName: accounts.name,
        categoryName: transactionCategories.name,
      })
      .from(transactions)
      .innerJoin(accounts, eq(accounts.id, transactions.accountId))
      .leftJoin(transactionCategories, eq(transactionCategories.id, transactions.categoryId))
      .where(and(gte(transactions.happenedAt, range.from), lte(transactions.happenedAt, range.to)))
      .orderBy(desc(transactions.happenedAt), desc(transactions.createdAt));

    return rows.map((row) => ({
      ...row.transaction,
      accountName: row.accountName,
      categoryName: row.categoryName,
    }));
  });
}

/**
 * Orçamento do mês (#53) — grava o planejado de uma categoria.
 *
 * **Repetir corrige em vez de duplicar:** o `on conflict do update` sobre o índice único
 * (usuário + categoria + mês) faz o segundo "orçar Alimentação em agosto" virar edição.
 * Um `select` antes do `insert` teria a mesma cara e uma corrida no meio.
 */
export async function setBudget(
  userId: string,
  input: { categoryId: string; month: Month; plannedCents: Cents },
): Promise<BudgetRow> {
  if (!isMonth(input.month)) throw new Error("Mês inválido (use AAAA-MM).");
  // Reusa a regra dos lançamentos: zero ou negativo não é valor. Orçar zero seria uma
  // segunda forma de dizer "sem orçamento", e as duas se desencontram na comparação.
  validateAmount(input.plannedCents);

  return withUserContext(userId, async (tx) => {
    const [category] = await tx
      .select({ id: transactionCategories.id })
      .from(transactionCategories)
      .where(eq(transactionCategories.id, input.categoryId));
    if (!category) throw new Error("Categoria não encontrada.");

    const [row] = await tx
      .insert(budgets)
      .values({
        userId,
        categoryId: input.categoryId,
        month: input.month,
        plannedCents: input.plannedCents,
      })
      .onConflictDoUpdate({
        target: [budgets.userId, budgets.categoryId, budgets.month],
        set: { plannedCents: input.plannedCents, updatedAt: sql`now()` },
      })
      .returning();
    return row!;
  });
}

/** Tirar o orçamento devolve a categoria para "sem orçamento" — não para "orçamento zero". */
export async function removeBudget(
  userId: string,
  input: { categoryId: string; month: Month },
): Promise<void> {
  if (!isMonth(input.month)) throw new Error("Mês inválido (use AAAA-MM).");

  await withUserContext(userId, (tx) =>
    tx
      .delete(budgets)
      .where(and(eq(budgets.categoryId, input.categoryId), eq(budgets.month, input.month))),
  );
}

/**
 * Planejado × realizado do mês — **uma consulta só** (ver `query-budget.test.ts`).
 *
 * O `full join` com os lançamentos do mês é o que faz caber numa consulta: pela esquerda
 * vêm as categorias sem movimento (realizado zero), e pela direita vem o que foi lançado
 * **sem categoria**, que numa lista de categorias não teria onde aparecer — e o que some do
 * orçamento é justamente o que estoura a conta no fim do mês.
 *
 * O filtro do mês fica na subconsulta, e não no `where`: num `full join`, condição no
 * `where` descartaria as linhas não-pareadas e devolveria o mês inteiro errado.
 *
 * A comparação em si não é feita aqui — ela é pura (`budget.ts`), testada sem banco e
 * compartilhada com os relatórios.
 */
export async function getBudgetOverview(userId: string, month: Month): Promise<BudgetComparison> {
  if (!isMonth(month)) throw new Error("Mês inválido (use AAAA-MM).");
  const range = monthRange(month);

  return withUserContext(userId, async (tx) => {
    const doMes = tx
      .select({
        categoryId: transactions.categoryId,
        amountCents: transactions.amountCents,
      })
      .from(transactions)
      .where(and(gte(transactions.happenedAt, range.from), lte(transactions.happenedAt, range.to)))
      .as("do_mes");

    const rows = await tx
      .select({
        categoryId: transactionCategories.id,
        name: transactionCategories.name,
        direction: transactionCategories.direction,
        plannedCents: budgets.plannedCents,
        // `sum` volta como string (o Postgres promove a bigint); somar sem converter
        // concatenaria texto.
        realized: sql<string>`coalesce(sum(${doMes.amountCents}), 0)`,
      })
      .from(transactionCategories)
      .fullJoin(doMes, eq(doMes.categoryId, transactionCategories.id))
      .leftJoin(
        budgets,
        and(eq(budgets.categoryId, transactionCategories.id), eq(budgets.month, month)),
      )
      .groupBy(
        transactionCategories.id,
        transactionCategories.name,
        transactionCategories.direction,
        budgets.plannedCents,
      )
      .orderBy(asc(transactionCategories.direction), asc(transactionCategories.name));

    const categories: BudgetCategory[] = [];
    const plans: BudgetPlan[] = [];
    const actuals: BudgetActual[] = [];

    for (const row of rows) {
      const realized = Number(row.realized);

      // Sem `categoryId` é o grupo que não pareou com categoria nenhuma: o lançamento solto.
      if (row.categoryId === null) {
        if (realized > 0) actuals.push({ categoryId: null, amountCents: realized });
        continue;
      }

      categories.push({
        id: row.categoryId,
        name: row.name!,
        direction: row.direction!,
      });
      if (row.plannedCents !== null) {
        plans.push({ categoryId: row.categoryId, plannedCents: row.plannedCents });
      }
      if (realized > 0) actuals.push({ categoryId: row.categoryId, amountCents: realized });
    }

    return compareBudget({ month, categories, plans, actuals });
  });
}
