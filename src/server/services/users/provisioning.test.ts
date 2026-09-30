import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { countQueries } from "@/server/db";
import { migrateForTests } from "@/server/db/migrate-for-tests";
import { withUserContext } from "@/server/db/rls";
import { users } from "@/server/db/schema";
import { createEvent } from "@/server/services/events/events-service";
import { createAccount, createTransaction } from "@/server/services/finance/finance-service";
import { createGoal } from "@/server/services/goals/goals-service";
import { listLifeAreas } from "@/server/services/life-areas/life-areas-service";
import { addInteraction } from "@/server/services/people/interactions-service";
import { addContact, createPerson } from "@/server/services/people/people-service";

import { deleteUserData, provisionUser, userExists } from "./provisioning";

/**
 * Ciclo de vida do usuário (#73). Integração com Postgres real sob RLS (role `app_rls`).
 * Roda só com `DATABASE_URL`.
 */
const hasDb = Boolean(process.env.DATABASE_URL);

const stamp = Date.now();
const uid = `prov_user_${stamp}`;
const other = `prov_other_${stamp}`;

/** `BEGIN` + `set_config` da RLS + `COMMIT`. */
const MOLDURA = 3;

/** Toda tabela com `user_id`, lida do catálogo — uma tabela nova entra sozinha no teste. */
async function tablesWithUserId(): Promise<string[]> {
  const rows = await withUserContext(uid, (tx) =>
    tx.execute<{ table_name: string }>(sql`
      select table_name from information_schema.columns
      where table_schema = 'public' and column_name = 'user_id'
      order by table_name
    `),
  );
  return [...rows].map((row) => row.table_name);
}

async function rowsOf(userId: string, table: string): Promise<number> {
  const [row] = await withUserContext(userId, (tx) =>
    tx.execute<{ n: number }>(
      sql`select count(*)::int as n from ${sql.identifier(table)} where user_id = ${userId}`,
    ),
  );
  return row!.n;
}

/** Um pouco de dado em cada módulo: é o que um usuário real deixaria para trás. */
async function fillAllModules(userId: string): Promise<void> {
  await createGoal(userId, { title: "Correr 5km" });
  const pessoa = await createPerson(userId, {
    name: "Ana",
    birthday: { day: 1, month: 2, year: null },
  });
  await addContact(userId, pessoa.id, { kind: "telefone", value: "61999999999" });
  await addInteraction(userId, pessoa.id, { happenedAt: "2026-09-01" });
  await createEvent(userId, {
    title: "Culto",
    startsAt: new Date("2026-09-06T21:00:00Z"),
    endsAt: new Date("2026-09-06T23:00:00Z"),
  });
  const conta = await createAccount(userId, { name: "Corrente" });
  await createTransaction(userId, {
    accountId: conta.id,
    direction: "saida",
    amountCents: 1990,
    happenedAt: "2026-09-02",
    description: "Pão",
  });
}

describe.skipIf(!hasDb)("provisionamento e exclusão do usuário", () => {
  beforeAll(async () => {
    await migrateForTests();
  });

  afterAll(async () => {
    for (const id of [uid, other]) await deleteUserData(id);
  });

  it("provisionar cria o usuário e as 12 áreas, e repetir não duplica nada", async () => {
    await provisionUser({ id: uid, email: `${uid}@test.local`, name: "Ana" });
    await provisionUser({ id: uid, email: `novo-${uid}@test.local`, name: "Ana Souza" });

    const [row] = await withUserContext(uid, (tx) => tx.select().from(users));
    expect(row).toMatchObject({ email: `novo-${uid}@test.local`, name: "Ana Souza" });
    expect(await listLifeAreas(uid)).toHaveLength(12);
  });

  it("para quem já existe, a renderização só lê: uma consulta, nenhuma escrita", async () => {
    const [existe, consultas] = await countQueries(() => userExists(uid));
    expect(existe).toBe(true);
    expect(consultas).toBe(MOLDURA + 1);
  });

  it("apagar o usuário não deixa nenhuma linha dele em nenhuma tabela, e não toca no outro", async () => {
    await provisionUser({ id: other, email: `${other}@test.local`, name: "Outro" });
    await fillAllModules(uid);
    await fillAllModules(other);

    const tables = await tablesWithUserId();
    expect(tables.length).toBeGreaterThan(10);
    // Antes: o usuário tem dado espalhado pelos módulos.
    expect(await rowsOf(uid, "transactions")).toBeGreaterThan(0);

    await deleteUserData(uid);

    expect(await userExists(uid)).toBe(false);
    for (const table of tables) {
      expect({ table, rows: await rowsOf(uid, table) }).toEqual({ table, rows: 0 });
    }
    // O vizinho continua inteiro.
    expect(await userExists(other)).toBe(true);
    expect(await rowsOf(other, "transactions")).toBeGreaterThan(0);
    expect(await rowsOf(other, "people")).toBeGreaterThan(0);
  });
});
