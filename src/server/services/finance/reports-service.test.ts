import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { countQueries } from "@/server/db";
import { migrateForTests } from "@/server/db/migrate-for-tests";
import { withUserContext } from "@/server/db/rls";
import {
  accounts,
  budgets,
  lifeAreas,
  transactionCategories,
  transactions,
  users,
} from "@/server/db/schema";
import { createLifeArea } from "@/server/services/life-areas/life-areas-service";

import {
  createAccount,
  createTransaction,
  getFinanceReport,
  listAccounts,
  listCategories,
  listTransactions,
} from "./finance-service";

/**
 * Relatórios (#54). Integração com Postgres real sob RLS (role `app_rls`).
 * Roda só com `DATABASE_URL` (local), pulado no CI sem banco.
 *
 * A agregação é testada sem banco em `reports.test.ts`; aqui se prova o que só o Postgres
 * responde: que o panorama **bate com o extrato** e com o saldo das contas, e que o
 * relatório de um usuário não enxerga o do outro.
 */
const hasDb = Boolean(process.env.DATABASE_URL);

const stamp = Date.now();
const uid = `rel_user_${stamp}`;
const other = `rel_other_${stamp}`;

const MES = "2026-08";
const janela = { from: "2026-08-01", to: "2026-08-31" };

const limpar = async (id: string) => {
  await withUserContext(id, (tx) => tx.delete(budgets));
  await withUserContext(id, (tx) => tx.delete(transactions));
  await withUserContext(id, (tx) => tx.delete(accounts));
  await withUserContext(id, (tx) => tx.delete(transactionCategories));
  await withUserContext(id, (tx) => tx.delete(lifeAreas));
};

async function categoria(id: string, name: string) {
  const encontrada = (await listCategories(id)).find((c) => c.name === name);
  if (!encontrada) throw new Error(`Categoria ${name} não semeada`);
  return encontrada;
}

describe.skipIf(!hasDb)("relatórios do financeiro", () => {
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

  it("o panorama bate com a soma dos lançamentos da tela de lançamentos", async () => {
    const conta = await createAccount(uid, { name: "Conta", initialBalanceCents: 100_00 });
    for (const [data, tipo, valor] of [
      ["2026-08-05", "entrada", 500_000],
      ["2026-08-10", "saida", 120_000],
      ["2026-08-20", "saida", 80_000],
      // Vizinhos fora do mês: não podem entrar no panorama.
      ["2026-07-31", "saida", 999_000],
      ["2026-09-01", "entrada", 999_000],
    ] as const) {
      await createTransaction(uid, {
        accountId: conta.id,
        happenedAt: data,
        direction: tipo,
        amountCents: valor,
      });
    }

    const relatorio = await getFinanceReport(uid, { month: MES });
    const extrato = await listTransactions(uid, janela);

    // A mesma conta, pelos dois caminhos: se discordarem, um dos dois está mentindo na tela.
    const somar = (tipo: "entrada" | "saida") =>
      extrato.filter((t) => t.direction === tipo).reduce((total, t) => total + t.amountCents, 0);

    expect(relatorio.totals.incomeCents).toBe(somar("entrada"));
    expect(relatorio.totals.expenseCents).toBe(somar("saida"));
    expect(relatorio.totals.resultCents).toBe(somar("entrada") - somar("saida"));

    await limpar(uid);
  });

  it("o consolidado é o mesmo saldo que a tela de contas mostra", async () => {
    const conta = await createAccount(uid, { name: "Conta", initialBalanceCents: 100_00 });
    await createAccount(uid, { name: "Poupança", initialBalanceCents: 500_00 });
    await createTransaction(uid, {
      accountId: conta.id,
      happenedAt: "2026-08-05",
      direction: "saida",
      amountCents: 30_00,
    });

    const relatorio = await getFinanceReport(uid, { month: MES });
    const daTela = (await listAccounts(uid)).reduce(
      (total, conta) => total + conta.balanceCents,
      0,
    );

    expect(relatorio.consolidatedCents).toBe(daTela);
    // E o consolidado não é o resultado do mês: são perguntas diferentes.
    expect(relatorio.totals.resultCents).toBe(-30_00);

    await limpar(uid);
  });

  it("mostra para onde foi o dinheiro, por categoria e por área de vida", async () => {
    const conta = await createAccount(uid, { name: "Conta" });
    const moradia = await categoria(uid, "Moradia");
    const lazer = await categoria(uid, "Lazer");
    const corpo = await createLifeArea(uid, { dimension: "corpo", name: "Corpo" });
    const alma = await createLifeArea(uid, { dimension: "alma", name: "Alma" });

    await createTransaction(uid, {
      accountId: conta.id,
      categoryId: moradia.id,
      lifeAreaId: corpo.id,
      happenedAt: "2026-08-05",
      direction: "saida",
      amountCents: 90_000,
    });
    await createTransaction(uid, {
      accountId: conta.id,
      categoryId: lazer.id,
      lifeAreaId: alma.id,
      happenedAt: "2026-08-06",
      direction: "saida",
      amountCents: 10_000,
    });

    const relatorio = await getFinanceReport(uid, { month: MES });

    expect(relatorio.byCategory).toEqual([
      { label: "Moradia", cents: 90_000, share: 90 },
      { label: "Lazer", cents: 10_000, share: 10 },
    ]);
    expect(relatorio.byLifeArea).toEqual([
      { label: "Corpo", cents: 90_000, share: 90 },
      { label: "Alma", cents: 10_000, share: 10 },
    ]);

    await limpar(uid);
  });

  it("a evolução cobre os meses anteriores e zera os vazios", async () => {
    const conta = await createAccount(uid, { name: "Conta" });
    await createTransaction(uid, {
      accountId: conta.id,
      happenedAt: "2026-06-10",
      direction: "entrada",
      amountCents: 100_00,
    });
    await createTransaction(uid, {
      accountId: conta.id,
      happenedAt: "2026-08-10",
      direction: "saida",
      amountCents: 50_00,
    });

    const relatorio = await getFinanceReport(uid, { month: MES, months: 3 });

    expect(relatorio.evolution.map((m) => m.month)).toEqual(["2026-06", "2026-07", "2026-08"]);
    expect(relatorio.evolution[0]!.incomeCents).toBe(100_00);
    // Julho não teve nada e mesmo assim tem linha: buraco na linha do tempo mente.
    expect(relatorio.evolution[1]!.resultCents).toBe(0);
    expect(relatorio.evolution[2]!.expenseCents).toBe(50_00);

    await limpar(uid);
  });

  it("mês sem lançamento nenhum devolve zero, não quebra", async () => {
    await createAccount(uid, { name: "Conta", initialBalanceCents: 700_00 });

    const relatorio = await getFinanceReport(uid, { month: "2026-05" });

    expect(relatorio.totals.resultCents).toBe(0);
    expect(relatorio.byCategory).toEqual([]);
    // O saldo das contas continua existindo mesmo num mês sem movimento.
    expect(relatorio.consolidatedCents).toBe(700_00);

    await limpar(uid);
  });

  it("o relatório do mês cabe em duas consultas", async () => {
    const conta = await createAccount(uid, { name: "Conta" });
    const moradia = await categoria(uid, "Moradia");
    for (const dia of ["2026-08-01", "2026-08-02", "2026-07-15"]) {
      await createTransaction(uid, {
        accountId: conta.id,
        categoryId: moradia.id,
        happenedAt: dia,
        direction: "saida",
        amountCents: 10_00,
      });
    }

    const [relatorio, consultas] = await countQueries(() => getFinanceReport(uid, { month: MES }));
    expect(relatorio.evolution).toHaveLength(6);
    // 3 de moldura (BEGIN, set_config, COMMIT) + 2 SELECTs: contas e a janela de lançamentos.
    // O número não cresce com a quantidade de meses da evolução.
    expect(consultas).toBe(5);

    await limpar(uid);
  });

  it("isola por usuário (RLS): o relatório de um não enxerga o dinheiro do outro", async () => {
    const conta = await createAccount(uid, { name: "Conta", initialBalanceCents: 100_00 });
    await createTransaction(uid, {
      accountId: conta.id,
      happenedAt: "2026-08-05",
      direction: "entrada",
      amountCents: 500_000,
    });

    const doOutro = await getFinanceReport(other, { month: MES });
    expect(doOutro.totals.incomeCents).toBe(0);
    expect(doOutro.consolidatedCents).toBe(0);
    expect(doOutro.byCategory).toEqual([]);

    await limpar(uid);
  });
});
