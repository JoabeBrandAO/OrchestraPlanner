import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { migrateForTests } from "@/server/db/migrate-for-tests";
import { withUserContext } from "@/server/db/rls";
import { accounts, budgets, transactionCategories, transactions, users } from "@/server/db/schema";

import {
  createAccount,
  createTransaction,
  deleteCategory,
  getBudgetOverview,
  importStatement,
  listAccounts,
  listCategories,
  listTransactions,
  renameCategory,
  setBudget,
  updateTransaction,
} from "./finance-service";

/**
 * Editar lançamento (#62) e gerenciar categorias (#63). Integração com Postgres real sob
 * RLS (role `app_rls`); roda só com `DATABASE_URL`, pulado no CI sem banco.
 *
 * O que se prova aqui é o que a falta de edição custava: sem `updateTransaction`, corrigir a
 * categoria de um lançamento importado era apagar e relançar — e o relançado perdia a
 * origem, de modo que a importação seguinte o recriava. A edição existe para **não** abrir
 * essa porta.
 */
const hasDb = Boolean(process.env.DATABASE_URL);

const stamp = Date.now();
const uid = `edit_user_${stamp}`;
const other = `edit_other_${stamp}`;

const mes = { from: "2026-08-01", to: "2026-08-31" };

const CSV = `Data;Histórico;Valor
05/08/2026;PADARIA CENTRAL;-15,00
10/08/2026;SALARIO;3500,00`;

const limpar = async (id: string) => {
  await withUserContext(id, (tx) => tx.delete(budgets));
  await withUserContext(id, (tx) => tx.delete(transactions));
  await withUserContext(id, (tx) => tx.delete(accounts));
  await withUserContext(id, (tx) => tx.delete(transactionCategories));
};

async function categoria(id: string, name: string) {
  const encontrada = (await listCategories(id)).find((c) => c.name === name);
  if (!encontrada) throw new Error(`Categoria ${name} não encontrada`);
  return encontrada;
}

describe.skipIf(!hasDb)("editar lançamento e gerenciar categorias", () => {
  beforeAll(async () => {
    await migrateForTests();
    for (const id of [uid, other]) {
      await withUserContext(id, (tx) =>
        tx.insert(users).values({ id, email: `${id}@test.local`, name: "T" }),
      );
    }
  });

  afterAll(async () => {
    for (const id of [uid, other]) {
      await limpar(id);
      await withUserContext(id, (tx) => tx.delete(users));
    }
  });

  it("editar um lançamento importado preserva a origem — reimportar continua conciliando", async () => {
    const conta = await createAccount(uid, { name: "Conta" });
    const primeira = await importStatement(uid, { accountId: conta.id, content: CSV });
    expect(primeira.imported).toBe(2);

    const importado = (await listTransactions(uid, mes)).find((t) => t.description === "SALARIO")!;
    const salario = await categoria(uid, "Salário");

    await updateTransaction(uid, importado.id, {
      accountId: conta.id,
      happenedAt: importado.happenedAt,
      direction: importado.direction,
      amountCents: importado.amountCents,
      categoryId: salario.id,
      description: "Salário de agosto",
    });

    const segunda = await importStatement(uid, { accountId: conta.id, content: CSV });
    expect(segunda.imported).toBe(0);
    expect(segunda.duplicated).toBe(2);

    await limpar(uid);
  });

  it("trocar o tipo mantém o valor positivo e o saldo acompanha", async () => {
    const conta = await createAccount(uid, { name: "Conta", initialBalanceCents: 0 });
    const lancamento = await createTransaction(uid, {
      accountId: conta.id,
      happenedAt: "2026-08-05",
      direction: "saida",
      amountCents: 100_00,
    });
    expect((await listAccounts(uid))[0]!.balanceCents).toBe(-100_00);

    const editado = await updateTransaction(uid, lancamento.id, {
      accountId: conta.id,
      happenedAt: "2026-08-05",
      direction: "entrada",
      amountCents: 100_00,
    });

    // O sinal continua vindo do tipo: o número nunca fica negativo no banco.
    expect(editado!.amountCents).toBe(100_00);
    expect(editado!.direction).toBe("entrada");
    expect((await listAccounts(uid))[0]!.balanceCents).toBe(100_00);

    await limpar(uid);
  });

  it("mudar a categoria move o realizado do orçamento junto", async () => {
    const conta = await createAccount(uid, { name: "Conta" });
    const moradia = await categoria(uid, "Moradia");
    const lazer = await categoria(uid, "Lazer");
    await setBudget(uid, { categoryId: moradia.id, month: "2026-08", plannedCents: 500_00 });
    await setBudget(uid, { categoryId: lazer.id, month: "2026-08", plannedCents: 500_00 });

    const lancamento = await createTransaction(uid, {
      accountId: conta.id,
      happenedAt: "2026-08-05",
      direction: "saida",
      amountCents: 80_00,
      categoryId: moradia.id,
    });

    const realizado = async (categoryId: string) =>
      (await getBudgetOverview(uid, "2026-08")).lines.find((l) => l.categoryId === categoryId)!
        .realizedCents;

    expect(await realizado(moradia.id)).toBe(80_00);

    await updateTransaction(uid, lancamento.id, {
      accountId: conta.id,
      happenedAt: "2026-08-05",
      direction: "saida",
      amountCents: 80_00,
      categoryId: lazer.id,
    });

    // Derivado dos lançamentos: não há coluna espelho para desandar.
    expect(await realizado(moradia.id)).toBe(0);
    expect(await realizado(lazer.id)).toBe(80_00);

    await limpar(uid);
  });

  it("editar recusa o que a criação recusa — valor e data", async () => {
    const conta = await createAccount(uid, { name: "Conta" });
    const lancamento = await createTransaction(uid, {
      accountId: conta.id,
      happenedAt: "2026-08-05",
      direction: "saida",
      amountCents: 100,
    });
    const base = { accountId: conta.id, happenedAt: "2026-08-05", direction: "saida" as const };

    await expect(
      updateTransaction(uid, lancamento.id, { ...base, amountCents: 0 }),
    ).rejects.toThrow(/maior que zero/i);
    await expect(
      updateTransaction(uid, lancamento.id, {
        ...base,
        happenedAt: "05/08/2026",
        amountCents: 100,
      }),
    ).rejects.toThrow(/inválida/i);

    await limpar(uid);
  });

  it("não dá para editar lançamento de outro usuário (RLS)", async () => {
    const conta = await createAccount(uid, { name: "Conta do dono" });
    const lancamento = await createTransaction(uid, {
      accountId: conta.id,
      happenedAt: "2026-08-05",
      direction: "saida",
      amountCents: 100,
    });

    // A conta do dono também não é alcançável: o `update` nem chega a ser tentado.
    await expect(
      updateTransaction(other, lancamento.id, {
        accountId: conta.id,
        happenedAt: "2026-08-05",
        direction: "entrada",
        amountCents: 999_00,
      }),
    ).rejects.toThrow(/não encontrada/i);

    const intacto = (await listTransactions(uid, mes))[0]!;
    expect(intacto.amountCents).toBe(100);
    expect(intacto.direction).toBe("saida");

    await limpar(uid);
  });

  it("renomear a categoria muda o rótulo no extrato — o nome não está copiado", async () => {
    const conta = await createAccount(uid, { name: "Conta" });
    const lazer = await categoria(uid, "Lazer");
    await createTransaction(uid, {
      accountId: conta.id,
      happenedAt: "2026-08-05",
      direction: "saida",
      amountCents: 50_00,
      categoryId: lazer.id,
    });

    await renameCategory(uid, lazer.id, { name: "Diversão" });

    expect((await listTransactions(uid, mes))[0]!.categoryName).toBe("Diversão");

    await limpar(uid);
  });

  it("renomear para um nome que já existe no mesmo sentido devolve frase do domínio", async () => {
    await createAccount(uid, { name: "Conta" });
    const lazer = await categoria(uid, "Lazer");

    await expect(renameCategory(uid, lazer.id, { name: "moradia" })).rejects.toThrow(
      /já tem uma categoria com esse nome/i,
    );

    // O mesmo nome no outro sentido não colide.
    const salario = await categoria(uid, "Salário");
    expect((await renameCategory(uid, salario.id, { name: "Moradia" }))!.name).toBe("Moradia");

    await limpar(uid);
  });

  it("remover a categoria não apaga o lançamento — ele passa a contar sem categoria", async () => {
    const conta = await createAccount(uid, { name: "Conta" });
    const lazer = await categoria(uid, "Lazer");
    await createTransaction(uid, {
      accountId: conta.id,
      happenedAt: "2026-08-05",
      direction: "saida",
      amountCents: 50_00,
      categoryId: lazer.id,
    });
    await setBudget(uid, { categoryId: lazer.id, month: "2026-08", plannedCents: 100_00 });

    await deleteCategory(uid, lazer.id);

    const extrato = await listTransactions(uid, mes);
    expect(extrato).toHaveLength(1);
    expect(extrato[0]!.categoryId).toBeNull();
    expect(extrato[0]!.categoryName).toBeNull();
    // O planejado, esse vai junto: orçamento de categoria que não existe não compara nada.
    expect(await withUserContext(uid, (tx) => tx.select().from(budgets))).toEqual([]);

    await limpar(uid);
  });

  it("categoria de outro usuário não é vista nem editada (RLS)", async () => {
    await createAccount(uid, { name: "Conta" });
    const lazer = await categoria(uid, "Lazer");

    expect(await renameCategory(other, lazer.id, { name: "Invadida" })).toBeNull();
    await deleteCategory(other, lazer.id);

    expect((await listCategories(uid)).some((c) => c.id === lazer.id && c.name === "Lazer")).toBe(
      true,
    );

    await limpar(uid);
  });
});
