import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";

import { withUserContext } from "@/server/db/rls";
import {
  accounts,
  transactionCategories,
  transactions,
  type AccountRow,
  type TransactionCategoryRow,
  type TransactionRow,
} from "@/server/db/schema";
import { validateTitle } from "@/server/services/shared/validate-title";

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
