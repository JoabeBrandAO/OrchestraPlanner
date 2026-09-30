import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { migrateForTests } from "@/server/db/migrate-for-tests";
import { createAccount, createTransaction } from "@/server/services/finance/finance-service";
import { createGoal } from "@/server/services/goals/goals-service";
import { createPerson } from "@/server/services/people/people-service";

import { deleteAccount, exportUserData } from "./account";
import { deleteUserData, provisionUser, userExists } from "./provisioning";

/**
 * Exportar e apagar a conta (#74). Integração com Postgres real sob RLS (role `app_rls`).
 * Roda só com `DATABASE_URL`.
 */
const hasDb = Boolean(process.env.DATABASE_URL);

const stamp = Date.now();
const uid = `acc_user_${stamp}`;
const other = `acc_other_${stamp}`;

async function fill(userId: string, marker: string): Promise<void> {
  await createGoal(userId, { title: `Meta ${marker}` });
  await createPerson(userId, {
    name: `Pessoa ${marker}`,
    birthday: { day: 3, month: 4, year: null },
  });
  const conta = await createAccount(userId, { name: `Conta ${marker}` });
  await createTransaction(userId, {
    accountId: conta.id,
    direction: "saida",
    amountCents: 1005,
    happenedAt: "2026-09-10",
    description: `Gasto ${marker}`,
  });
}

describe.skipIf(!hasDb)("conta — exportar e apagar (LGPD)", () => {
  beforeAll(async () => {
    await migrateForTests();
    await provisionUser({ id: uid, email: `${uid}@test.local`, name: "Ana" });
    await provisionUser({ id: other, email: `${other}@test.local`, name: "Outro" });
    await fill(uid, "da Ana");
    await fill(other, "do Outro");
  });

  afterAll(async () => {
    for (const id of [uid, other]) await deleteUserData(id);
  });

  it("exporta tudo do usuário, em JSON que sobrevive a ida e volta", async () => {
    const exported = JSON.parse(
      JSON.stringify(await exportUserData(uid, new Date("2026-09-30T12:00:00Z"))),
    );

    expect(exported).toMatchObject({ format: "orchestraplanner-export", version: 1 });
    expect(exported.exportedAt).toBe("2026-09-30T12:00:00.000Z");
    expect(exported.user.email).toBe(`${uid}@test.local`);
    expect(exported.tables.goals).toHaveLength(1);
    expect(exported.tables.people[0].name).toBe("Pessoa da Ana");
    expect(exported.tables.life_areas).toHaveLength(12);
    // Dinheiro sai em centavos inteiros, como está guardado — sem float no caminho.
    expect(exported.tables.transactions[0].amount_cents).toBe(1005);
  });

  it("a exportação nunca alcança dado de outro usuário", async () => {
    const texto = JSON.stringify(await exportUserData(uid));
    expect(texto).not.toContain("do Outro");
    expect(texto).not.toContain(other);
  });

  it("sem a frase de confirmação, nada é apagado — nem no banco, nem no Clerk", async () => {
    const deleteIdentity = vi.fn(async () => {});
    await expect(deleteAccount(uid, "sim", deleteIdentity)).rejects.toThrow("digite APAGAR");
    expect(deleteIdentity).not.toHaveBeenCalled();
    expect(await userExists(uid)).toBe(true);
  });

  it("apagar remove o dado e depois a identidade, e o vizinho fica intacto", async () => {
    const calls: string[] = [];
    const deleteIdentity = vi.fn(async (id: string) => {
      // Quando o Clerk é chamado, o dado já tem de ter sumido.
      calls.push(`identidade:${id}:existe=${await userExists(id)}`);
    });

    await deleteAccount(uid, " APAGAR ", deleteIdentity);

    expect(calls).toEqual([`identidade:${uid}:existe=false`]);
    const restante = await exportUserData(uid);
    expect(restante.user).toBeNull();
    for (const [table, rows] of Object.entries(restante.tables)) {
      expect({ table, rows: rows.length }).toEqual({ table, rows: 0 });
    }
    expect((await exportUserData(other)).tables.transactions).toHaveLength(1);
  });
});
