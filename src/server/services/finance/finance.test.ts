import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { countQueries } from "@/server/db";
import { migrateForTests } from "@/server/db/migrate-for-tests";
import { withUserContext } from "@/server/db/rls";
import { accounts, transactionCategories, transactions, users } from "@/server/db/schema";

import {
  createAccount,
  createCategory,
  createTransaction,
  deleteAccount,
  deleteTransaction,
  listAccounts,
  listCategories,
  listTransactions,
} from "./finance-service";

/**
 * Financeiro (#52). Integração com Postgres real sob RLS (role `app_rls`).
 * Roda só com `DATABASE_URL` (local), pulado no CI sem banco.
 */
const hasDb = Boolean(process.env.DATABASE_URL);

const stamp = Date.now();
const uid = `fin_user_${stamp}`;
const other = `fin_other_${stamp}`;

const mes = { from: "2026-08-01", to: "2026-08-31" };

const limpar = async (id: string) => {
  await withUserContext(id, (tx) => tx.delete(transactions));
  await withUserContext(id, (tx) => tx.delete(accounts));
  await withUserContext(id, (tx) => tx.delete(transactionCategories));
};

describe.skipIf(!hasDb)("financeiro — contas, categorias e lançamentos", () => {
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

  it("a primeira conta semeia as categorias padrão", async () => {
    await createAccount(uid, { name: "Conta corrente", kind: "corrente" });

    const categorias = await listCategories(uid);
    expect(categorias.length).toBeGreaterThan(5);
    expect(categorias.some((c) => c.name === "Salário" && c.direction === "entrada")).toBe(true);
    expect(categorias.some((c) => c.name === "Moradia" && c.direction === "saida")).toBe(true);

    await limpar(uid);
  });

  it("a segunda conta não duplica as categorias", async () => {
    // Idempotência é do banco (índice único + `on conflict`), não de um `if`.
    await createAccount(uid, { name: "Conta A" });
    const depoisDaPrimeira = (await listCategories(uid)).length;

    await createAccount(uid, { name: "Conta B" });
    expect(await listCategories(uid)).toHaveLength(depoisDaPrimeira);

    await limpar(uid);
  });

  it("o saldo é derivado dos lançamentos", async () => {
    const conta = await createAccount(uid, {
      name: "Conta corrente",
      initialBalanceCents: 100_00,
    });

    await createTransaction(uid, {
      accountId: conta.id,
      happenedAt: "2026-08-05",
      direction: "entrada",
      amountCents: 250_00,
    });
    await createTransaction(uid, {
      accountId: conta.id,
      happenedAt: "2026-08-06",
      direction: "saida",
      amountCents: 30_50,
    });

    const [comSaldo] = await listAccounts(uid);
    expect(comSaldo!.balanceCents).toBe(100_00 + 250_00 - 30_50);

    await limpar(uid);
  });

  it("apagar o lançamento devolve o saldo — não há coluna para desandar", async () => {
    const conta = await createAccount(uid, { name: "Conta", initialBalanceCents: 0 });
    const lancamento = await createTransaction(uid, {
      accountId: conta.id,
      happenedAt: "2026-08-05",
      direction: "saida",
      amountCents: 10_00,
    });

    expect((await listAccounts(uid))[0]!.balanceCents).toBe(-10_00);
    await deleteTransaction(uid, lancamento.id);
    expect((await listAccounts(uid))[0]!.balanceCents).toBe(0);

    await limpar(uid);
  });

  it("conta sem lançamento tem o saldo inicial, não zero", async () => {
    await createAccount(uid, { name: "Poupança", initialBalanceCents: 500_00 });

    expect((await listAccounts(uid))[0]!.balanceCents).toBe(500_00);

    await limpar(uid);
  });

  it("saldo inicial negativo é legítimo — cartão nasce devendo", async () => {
    await createAccount(uid, { name: "Cartão", kind: "cartao", initialBalanceCents: -320_00 });

    expect((await listAccounts(uid))[0]!.balanceCents).toBe(-320_00);

    await limpar(uid);
  });

  it("recusa valor zero ou negativo — o sinal é do tipo, não do número", async () => {
    const conta = await createAccount(uid, { name: "Conta" });

    for (const amountCents of [0, -100]) {
      await expect(
        createTransaction(uid, {
          accountId: conta.id,
          happenedAt: "2026-08-05",
          direction: "saida",
          amountCents,
        }),
      ).rejects.toThrow(/maior que zero/i);
    }

    await limpar(uid);
  });

  it("recusa data que não é data", async () => {
    const conta = await createAccount(uid, { name: "Conta" });

    await expect(
      createTransaction(uid, {
        accountId: conta.id,
        happenedAt: "05/08/2026",
        direction: "saida",
        amountCents: 100,
      }),
    ).rejects.toThrow(/inválida/i);

    await limpar(uid);
  });

  it("o extrato traz o período pedido, do mais recente para o mais antigo", async () => {
    const conta = await createAccount(uid, { name: "Conta" });
    for (const happenedAt of ["2026-07-31", "2026-08-01", "2026-08-20", "2026-09-01"]) {
      await createTransaction(uid, {
        accountId: conta.id,
        happenedAt,
        direction: "saida",
        amountCents: 100,
      });
    }

    const extrato = await listTransactions(uid, mes);
    expect(extrato.map((t) => t.happenedAt)).toEqual(["2026-08-20", "2026-08-01"]);
    expect(extrato[0]!.accountName).toBe("Conta");

    await limpar(uid);
  });

  it("cadastrar categoria repetida devolve a que existe, sem estourar", async () => {
    await createAccount(uid, { name: "Conta" });

    const primeira = await createCategory(uid, { name: "Pets", direction: "saida" });
    const segunda = await createCategory(uid, { name: "  pets  ", direction: "saida" });

    expect(segunda.id).toBe(primeira.id);

    await limpar(uid);
  });

  it("o mesmo nome pode existir nos dois sentidos", async () => {
    await createAccount(uid, { name: "Conta" });

    const entrada = await createCategory(uid, { name: "Empréstimo", direction: "entrada" });
    const saida = await createCategory(uid, { name: "Empréstimo", direction: "saida" });

    expect(saida.id).not.toBe(entrada.id);

    await limpar(uid);
  });

  it("apagar a conta leva os lançamentos dela junto", async () => {
    const conta = await createAccount(uid, { name: "Conta" });
    await createTransaction(uid, {
      accountId: conta.id,
      happenedAt: "2026-08-05",
      direction: "saida",
      amountCents: 100,
    });

    await deleteAccount(uid, conta.id);

    const restantes = await withUserContext(uid, (tx) => tx.select().from(transactions));
    expect(restantes).toEqual([]);

    await limpar(uid);
  });

  it("a lista de contas com saldo cabe em uma consulta", async () => {
    // O mesmo teto das outras telas: cada statement contra o Neon é uma viagem pela rede.
    await createAccount(uid, { name: "Conta A" });
    await createAccount(uid, { name: "Conta B" });

    const [lista, consultas] = await countQueries(() => listAccounts(uid));
    expect(lista).toHaveLength(2);
    // 3 de moldura (BEGIN, set_config, COMMIT) + 1 SELECT.
    expect(consultas).toBe(4);

    await limpar(uid);
  });

  it("isola por usuário (RLS) — conta, categoria e lançamento de um não vazam para o outro", async () => {
    const conta = await createAccount(uid, { name: "Conta do dono" });
    await createTransaction(uid, {
      accountId: conta.id,
      happenedAt: "2026-08-05",
      direction: "entrada",
      amountCents: 100,
    });

    expect(await listAccounts(other)).toEqual([]);
    expect(await listCategories(other)).toEqual([]);
    expect(await listTransactions(other, mes)).toEqual([]);
    await expect(
      createTransaction(other, {
        accountId: conta.id,
        happenedAt: "2026-08-05",
        direction: "saida",
        amountCents: 100,
      }),
    ).rejects.toThrow(/não encontrada/i);

    await limpar(uid);
  });
});
