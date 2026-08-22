import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { countQueries } from "@/server/db";
import { migrateForTests } from "@/server/db/migrate-for-tests";
import { withUserContext } from "@/server/db/rls";
import { accounts, budgets, transactionCategories, transactions, users } from "@/server/db/schema";

import {
  createAccount,
  createTransaction,
  getBudgetOverview,
  listCategories,
  removeBudget,
  setBudget,
} from "./finance-service";

/**
 * Orçamento (#53). Integração com Postgres real sob RLS (role `app_rls`).
 * Roda só com `DATABASE_URL` (local), pulado no CI sem banco.
 *
 * A conta em si é testada sem banco em `budget.test.ts`; aqui se prova o que só o Postgres
 * responde: idempotência pelo índice único, o realizado saindo mesmo dos lançamentos, e o
 * isolamento entre usuários.
 */
const hasDb = Boolean(process.env.DATABASE_URL);

const stamp = Date.now();
const uid = `orc_user_${stamp}`;
const other = `orc_other_${stamp}`;

const MES = "2026-08";

const limpar = async (id: string) => {
  await withUserContext(id, (tx) => tx.delete(budgets));
  await withUserContext(id, (tx) => tx.delete(transactions));
  await withUserContext(id, (tx) => tx.delete(accounts));
  await withUserContext(id, (tx) => tx.delete(transactionCategories));
};

/** Categoria pelo nome — as padrão nascem com a primeira conta. */
async function categoria(id: string, name: string) {
  const encontrada = (await listCategories(id)).find((c) => c.name === name);
  if (!encontrada) throw new Error(`Categoria ${name} não semeada`);
  return encontrada;
}

describe.skipIf(!hasDb)("orçamento por categoria", () => {
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

  it("orçar a mesma categoria duas vezes no mês corrige em vez de duplicar", async () => {
    await createAccount(uid, { name: "Conta" });
    const alimentacao = await categoria(uid, "Alimentação");

    await setBudget(uid, { categoryId: alimentacao.id, month: MES, plannedCents: 800_00 });
    await setBudget(uid, { categoryId: alimentacao.id, month: MES, plannedCents: 900_00 });

    const painel = await getBudgetOverview(uid, MES);
    const linhas = painel.lines.filter((l) => l.categoryId === alimentacao.id);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]!.plannedCents).toBe(900_00);

    await limpar(uid);
  });

  it("o mesmo orçamento em outro mês é outro orçamento", async () => {
    await createAccount(uid, { name: "Conta" });
    const alimentacao = await categoria(uid, "Alimentação");

    await setBudget(uid, { categoryId: alimentacao.id, month: "2026-08", plannedCents: 800_00 });
    await setBudget(uid, { categoryId: alimentacao.id, month: "2026-09", plannedCents: 500_00 });

    expect((await getBudgetOverview(uid, "2026-08")).lines[0]!.plannedCents).toBe(800_00);
    expect((await getBudgetOverview(uid, "2026-09")).lines[0]!.plannedCents).toBe(500_00);

    await limpar(uid);
  });

  it("o realizado sai dos lançamentos do mês — e só deles", async () => {
    const conta = await createAccount(uid, { name: "Conta" });
    const alimentacao = await categoria(uid, "Alimentação");
    await setBudget(uid, { categoryId: alimentacao.id, month: MES, plannedCents: 800_00 });

    for (const [data, valor] of [
      ["2026-08-01", 300_00],
      ["2026-08-31", 250_00],
      // Fora do mês: não pode entrar, nem no primeiro nem no último dia vizinho.
      ["2026-07-31", 999_00],
      ["2026-09-01", 999_00],
    ] as const) {
      await createTransaction(uid, {
        accountId: conta.id,
        categoryId: alimentacao.id,
        happenedAt: data,
        direction: "saida",
        amountCents: valor,
      });
    }

    const linha = (await getBudgetOverview(uid, MES)).lines[0]!;
    expect(linha.realizedCents).toBe(550_00);
    expect(linha.remainingCents).toBe(250_00);
    expect(linha.status).toBe("dentro");

    await limpar(uid);
  });

  it("estourar o orçamento aparece como sobra negativa", async () => {
    const conta = await createAccount(uid, { name: "Conta" });
    const lazer = await categoria(uid, "Lazer");
    await setBudget(uid, { categoryId: lazer.id, month: MES, plannedCents: 100_00 });
    await createTransaction(uid, {
      accountId: conta.id,
      categoryId: lazer.id,
      happenedAt: "2026-08-10",
      direction: "saida",
      amountCents: 130_00,
    });

    const linha = (await getBudgetOverview(uid, MES)).lines[0]!;
    expect(linha.remainingCents).toBe(-30_00);
    expect(linha.status).toBe("estourado");

    await limpar(uid);
  });

  it("categoria com gasto e sem orçamento aparece como 'sem orçamento'", async () => {
    const conta = await createAccount(uid, { name: "Conta" });
    const transporte = await categoria(uid, "Transporte");
    await createTransaction(uid, {
      accountId: conta.id,
      categoryId: transporte.id,
      happenedAt: "2026-08-10",
      direction: "saida",
      amountCents: 40_00,
    });

    const painel = await getBudgetOverview(uid, MES);
    const linha = painel.lines.find((l) => l.categoryId === transporte.id)!;
    expect(linha.plannedCents).toBeNull();
    expect(linha.status).toBe("sem-orcamento");
    expect(painel.unbudgetedRealizedCents).toBe(40_00);

    await limpar(uid);
  });

  it("o lançamento sem categoria não some do painel", async () => {
    // É o caso que o `full join` existe para cobrir: numa lista de categorias, o lançamento
    // solto não teria linha onde aparecer.
    const conta = await createAccount(uid, { name: "Conta" });
    await createTransaction(uid, {
      accountId: conta.id,
      happenedAt: "2026-08-10",
      direction: "saida",
      amountCents: 77_00,
    });

    const painel = await getBudgetOverview(uid, MES);
    const solto = painel.lines.find((l) => l.categoryId === null)!;
    expect(solto.name).toBe("Sem categoria");
    expect(solto.realizedCents).toBe(77_00);

    await limpar(uid);
  });

  it("tirar o orçamento devolve a categoria para 'sem orçamento'", async () => {
    await createAccount(uid, { name: "Conta" });
    const lazer = await categoria(uid, "Lazer");
    await setBudget(uid, { categoryId: lazer.id, month: MES, plannedCents: 100_00 });

    await removeBudget(uid, { categoryId: lazer.id, month: MES });

    // Sem orçamento e sem gasto, a categoria nem linha vira — o painel fica vazio.
    expect((await getBudgetOverview(uid, MES)).lines).toEqual([]);

    await limpar(uid);
  });

  it("mês sem lançamento nenhum mostra o planejado inteiro, não uma tela quebrada", async () => {
    await createAccount(uid, { name: "Conta" });
    const moradia = await categoria(uid, "Moradia");
    await setBudget(uid, { categoryId: moradia.id, month: MES, plannedCents: 1_500_00 });

    const painel = await getBudgetOverview(uid, MES);
    expect(painel.totalRealizedCents).toBe(0);
    expect(painel.lines[0]!.remainingCents).toBe(1_500_00);

    await limpar(uid);
  });

  it("recusa orçamento zero e mês fora do formato", async () => {
    await createAccount(uid, { name: "Conta" });
    const lazer = await categoria(uid, "Lazer");

    await expect(
      setBudget(uid, { categoryId: lazer.id, month: MES, plannedCents: 0 }),
    ).rejects.toThrow(/maior que zero/i);
    await expect(
      setBudget(uid, { categoryId: lazer.id, month: "2026-8", plannedCents: 100 }),
    ).rejects.toThrow(/Mês inválido/i);

    await limpar(uid);
  });

  it("o painel do mês cabe em uma consulta", async () => {
    const conta = await createAccount(uid, { name: "Conta" });
    const alimentacao = await categoria(uid, "Alimentação");
    const lazer = await categoria(uid, "Lazer");
    await setBudget(uid, { categoryId: alimentacao.id, month: MES, plannedCents: 800_00 });
    await setBudget(uid, { categoryId: lazer.id, month: MES, plannedCents: 200_00 });
    await createTransaction(uid, {
      accountId: conta.id,
      categoryId: alimentacao.id,
      happenedAt: "2026-08-10",
      direction: "saida",
      amountCents: 50_00,
    });

    const [painel, consultas] = await countQueries(() => getBudgetOverview(uid, MES));
    expect(painel.lines.length).toBeGreaterThan(0);
    // 3 de moldura (BEGIN, set_config, COMMIT) + 1 SELECT.
    expect(consultas).toBe(4);

    await limpar(uid);
  });

  it("isola por usuário (RLS): orçamento de um não vaza, nem se orça na categoria do outro", async () => {
    await createAccount(uid, { name: "Conta" });
    const alimentacao = await categoria(uid, "Alimentação");
    await setBudget(uid, { categoryId: alimentacao.id, month: MES, plannedCents: 800_00 });

    expect((await getBudgetOverview(other, MES)).lines).toEqual([]);
    await expect(
      setBudget(other, { categoryId: alimentacao.id, month: MES, plannedCents: 10_00 }),
    ).rejects.toThrow(/não encontrada/i);

    await limpar(uid);
  });
});
