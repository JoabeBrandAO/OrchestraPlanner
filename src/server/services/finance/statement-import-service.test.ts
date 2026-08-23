import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { migrateForTests } from "@/server/db/migrate-for-tests";
import { withUserContext } from "@/server/db/rls";
import { accounts, budgets, transactionCategories, transactions, users } from "@/server/db/schema";

import {
  createAccount,
  createTransaction,
  importStatement,
  listAccounts,
  listCategories,
  listTransactions,
} from "./finance-service";

/**
 * Importação de extrato (#55). Integração com Postgres real sob RLS (role `app_rls`).
 * Roda só com `DATABASE_URL` (local), pulado no CI sem banco.
 *
 * O parser é testado sem banco em `statement-import.test.ts`. O que se prova aqui é a
 * **conciliação**: importar o mesmo arquivo duas vezes não pode duplicar nada — e quem
 * garante isso é o índice único do banco, não um `if` no código.
 */
const hasDb = Boolean(process.env.DATABASE_URL);

const stamp = Date.now();
const uid = `imp_user_${stamp}`;
const other = `imp_other_${stamp}`;

const mes = { from: "2026-08-01", to: "2026-08-31" };

const OFX = `OFXHEADER:100
<OFX><BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260805120000[-3:BRT]
<TRNAMT>-120.50
<FITID>202608050001
<MEMO>SUPERMERCADO SAO JOAO
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260810
<TRNAMT>3500.00
<FITID>202608100002
<MEMO>PAGAMENTO SALARIO
</STMTTRN>
</BANKTRANLIST></OFX>`;

const CSV = `Data;Histórico;Valor
05/08/2026;PADARIA CENTRAL;-15,00
06/08/2026;PADARIA CENTRAL;-15,00`;

const limpar = async (id: string) => {
  await withUserContext(id, (tx) => tx.delete(budgets));
  await withUserContext(id, (tx) => tx.delete(transactions));
  await withUserContext(id, (tx) => tx.delete(accounts));
  await withUserContext(id, (tx) => tx.delete(transactionCategories));
};

async function categoria(id: string, name: string) {
  const encontrada = (await listCategories(id)).find((c) => c.name === name);
  if (!encontrada) throw new Error(`Categoria ${name} não semeada`);
  return encontrada;
}

describe.skipIf(!hasDb)("importação de extrato", () => {
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

  it("importa o OFX com o sinal virando sentido, e o saldo bate", async () => {
    const conta = await createAccount(uid, { name: "Conta", initialBalanceCents: 0 });

    const resultado = await importStatement(uid, { accountId: conta.id, content: OFX });

    expect(resultado).toMatchObject({ format: "ofx", imported: 2, duplicated: 0, problems: [] });

    const extrato = await listTransactions(uid, mes);
    expect(extrato).toHaveLength(2);
    expect(extrato.find((t) => t.description === "SUPERMERCADO SAO JOAO")).toMatchObject({
      direction: "saida",
      amountCents: 12050,
    });
    // O saldo derivado não sabe que veio de arquivo — e é esse o ponto.
    expect((await listAccounts(uid))[0]!.balanceCents).toBe(350000 - 12050);

    await limpar(uid);
  });

  it("importar o mesmo arquivo duas vezes não duplica lançamento", async () => {
    const conta = await createAccount(uid, { name: "Conta" });

    const primeira = await importStatement(uid, { accountId: conta.id, content: OFX });
    const segunda = await importStatement(uid, { accountId: conta.id, content: OFX });

    expect(primeira.imported).toBe(2);
    // A segunda passada reconhece tudo como já importado — quem barra é o índice único.
    expect(segunda).toMatchObject({ imported: 0, duplicated: 2 });
    expect(await listTransactions(uid, mes)).toHaveLength(2);

    await limpar(uid);
  });

  it("o extrato que cresceu importa só o que é novo", async () => {
    const conta = await createAccount(uid, { name: "Conta" });
    await importStatement(uid, { accountId: conta.id, content: OFX });

    const maior = OFX.replace(
      "</BANKTRANLIST>",
      `<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260815
<TRNAMT>-42.00
<FITID>202608150003
<MEMO>FARMACIA
</STMTTRN>
</BANKTRANLIST>`,
    );
    const resultado = await importStatement(uid, { accountId: conta.id, content: maior });

    expect(resultado).toMatchObject({ imported: 1, duplicated: 2 });
    expect(await listTransactions(uid, mes)).toHaveLength(3);

    await limpar(uid);
  });

  it("a mesma origem em outra conta não é a mesma coisa", async () => {
    // A identidade é por conta: dois extratos diferentes podem repetir FITID, e um cancelar
    // o lançamento do outro seria um sumiço silencioso.
    const conta = await createAccount(uid, { name: "Conta A" });
    const outra = await createAccount(uid, { name: "Conta B" });

    await importStatement(uid, { accountId: conta.id, content: OFX });
    const naOutra = await importStatement(uid, { accountId: outra.id, content: OFX });

    expect(naOutra.imported).toBe(2);
    expect(await listTransactions(uid, mes)).toHaveLength(4);

    await limpar(uid);
  });

  it("no CSV, duas linhas iguais viram dois lançamentos e a reimportação não duplica", async () => {
    const conta = await createAccount(uid, { name: "Conta" });
    const repetido = `Data;Histórico;Valor
05/08/2026;CAFE;-5,00
05/08/2026;CAFE;-5,00`;

    const primeira = await importStatement(uid, { accountId: conta.id, content: repetido });
    const segunda = await importStatement(uid, { accountId: conta.id, content: repetido });

    expect(primeira).toMatchObject({ format: "csv", imported: 2 });
    expect(segunda).toMatchObject({ imported: 0, duplicated: 2 });
    expect(await listTransactions(uid, mes)).toHaveLength(2);

    await limpar(uid);
  });

  it("sugere categoria pelo histórico e conta quantas acertou", async () => {
    const conta = await createAccount(uid, { name: "Conta" });
    const alimentacao = await categoria(uid, "Alimentação");

    // O hábito: essa padaria sempre foi Alimentação.
    await createTransaction(uid, {
      accountId: conta.id,
      categoryId: alimentacao.id,
      happenedAt: "2026-07-10",
      direction: "saida",
      amountCents: 15_00,
      description: "Padaria Central",
    });

    const resultado = await importStatement(uid, { accountId: conta.id, content: CSV });

    expect(resultado.imported).toBe(2);
    expect(resultado.categorized).toBe(2);
    const importados = (await listTransactions(uid, mes)).filter(
      (t) => t.description === "PADARIA CENTRAL",
    );
    expect(importados.every((t) => t.categoryId === alimentacao.id)).toBe(true);

    await limpar(uid);
  });

  it("sem histórico, o lançamento entra sem categoria em vez de receber palpite", async () => {
    const conta = await createAccount(uid, { name: "Conta" });

    const resultado = await importStatement(uid, { accountId: conta.id, content: CSV });

    expect(resultado.categorized).toBe(0);
    expect((await listTransactions(uid, mes)).every((t) => t.categoryId === null)).toBe(true);

    await limpar(uid);
  });

  it("importa as linhas boas e devolve as ruins, com número de linha", async () => {
    const conta = await createAccount(uid, { name: "Conta" });
    const comLixo = `Data;Histórico;Valor
05/08/2026;SUPERMERCADO;-120,50
linha estragada
07/08/2026;SALARIO;3.500,00`;

    const resultado = await importStatement(uid, { accountId: conta.id, content: comLixo });

    expect(resultado.imported).toBe(2);
    expect(resultado.problems).toHaveLength(1);
    expect(resultado.problems[0]!.line).toBe(3);

    await limpar(uid);
  });

  it("recusa arquivo que não é extrato, e conta inexistente", async () => {
    const conta = await createAccount(uid, { name: "Conta" });

    await expect(
      importStatement(uid, { accountId: conta.id, content: "isto nao e um extrato" }),
    ).rejects.toThrow(/OFX nem como CSV/);
    await expect(
      importStatement(uid, {
        accountId: "00000000-0000-0000-0000-000000000000",
        content: OFX,
      }),
    ).rejects.toThrow(/não encontrada/i);

    await limpar(uid);
  });

  it("isola por usuário (RLS): não dá para importar na conta de outro", async () => {
    const conta = await createAccount(uid, { name: "Conta do dono" });

    await expect(importStatement(other, { accountId: conta.id, content: OFX })).rejects.toThrow(
      /não encontrada/i,
    );
    expect(await listTransactions(other, mes)).toEqual([]);

    await limpar(uid);
  });
});
