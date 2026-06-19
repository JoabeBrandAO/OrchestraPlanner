import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getDb } from "./index";
import { withUserContext } from "./rls";
import { users } from "./schema";

/**
 * Teste de isolamento da RLS (issue #3). Requer um Postgres real:
 * roda quando `DATABASE_URL` está definida (local via docker-compose ou Neon),
 * e é pulado no CI sem banco — assim a suíte permanece verde sem segredos.
 *
 * Prova: dois usuários inseridos em contextos distintos; cada um, ao consultar,
 * enxerga somente a própria linha. A barreira é a policy `users_isolation` + FORCE.
 */
const hasDb = Boolean(process.env.DATABASE_URL);

// ids/emails únicos por execução para não colidir com dados remanescentes.
const stamp = Date.now();
const userA = { id: `user_a_${stamp}`, email: `a_${stamp}@test.local`, name: "A" };
const userB = { id: `user_b_${stamp}`, email: `b_${stamp}@test.local`, name: "B" };

describe.skipIf(!hasDb)("RLS isolation on users", () => {
  beforeAll(async () => {
    await migrate(getDb(), { migrationsFolder: "drizzle" });
    await withUserContext(userA.id, (tx) => tx.insert(users).values(userA));
    await withUserContext(userB.id, (tx) => tx.insert(users).values(userB));
  });

  afterAll(async () => {
    // FORCE RLS vale para o cleanup também: cada um remove a própria linha.
    await withUserContext(userA.id, (tx) => tx.delete(users));
    await withUserContext(userB.id, (tx) => tx.delete(users));
  });

  it("usuário A só enxerga a própria linha", async () => {
    const rows = await withUserContext(userA.id, (tx) => tx.select().from(users));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(userA.id);
  });

  it("usuário B só enxerga a própria linha", async () => {
    const rows = await withUserContext(userB.id, (tx) => tx.select().from(users));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(userB.id);
  });

  it("sem contexto de usuário, nada é visível (fail-safe)", async () => {
    const rows = await getDb().select().from(users);
    expect(rows).toHaveLength(0);
  });
});
