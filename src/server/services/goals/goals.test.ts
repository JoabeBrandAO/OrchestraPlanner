import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { withUserContext } from "@/server/db/rls";
import { goals, users } from "@/server/db/schema";

import { changeGoalStatus, createGoal, listGoals, updateGoal } from "./goals-service";

/**
 * Metas (#9–#12 / US-1.1…1.4). Integração com Postgres real sob RLS (role `app_rls`).
 * Roda só com `DATABASE_URL` (local), pulado no CI sem banco.
 */
const hasDb = Boolean(process.env.DATABASE_URL);

const stamp = Date.now();
const uid = `goal_user_${stamp}`;
const other = `goal_other_${stamp}`;

describe.skipIf(!hasDb)("goals — CRUD + status + isolamento", () => {
  beforeAll(async () => {
    const migrationUrl = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL!;
    const migClient = postgres(migrationUrl, { prepare: false, max: 1 });
    await migrate(drizzle(migClient), { migrationsFolder: "drizzle" });
    await migClient.end();

    for (const id of [uid, other]) {
      await withUserContext(id, (tx) =>
        tx.insert(users).values({ id, email: `${id}@test.local`, name: "T" }),
      );
    }
  });

  afterAll(async () => {
    for (const id of [uid, other]) {
      await withUserContext(id, (tx) => tx.delete(goals));
      await withUserContext(id, (tx) => tx.delete(users));
    }
  });

  it("US-1.1 cria meta Ativa com título normalizado; título vazio falha", async () => {
    const goal = await createGoal(uid, { title: "  Correr 5km  ", description: "treino" });
    expect(goal.title).toBe("Correr 5km");
    expect(goal.status).toBe("ativa");
    expect(goal.completedAt).toBeNull();

    await expect(createGoal(uid, { title: "   " })).rejects.toThrow();
  });

  it("US-1.2 lista por updated_at DESC", async () => {
    await createGoal(uid, { title: "Mais nova" });
    const list = await listGoals(uid);
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list[0]?.title).toBe("Mais nova");
  });

  it("US-1.3 edita e bumpa updated_at", async () => {
    const goal = await createGoal(uid, { title: "Ler livro" });
    const updated = await updateGoal(uid, goal.id, { title: "Ler 12 livros", progress: 25 });
    expect(updated?.title).toBe("Ler 12 livros");
    expect(updated?.progress).toBe(25);
    expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(goal.updatedAt.getTime());
  });

  it("US-1.4 completa (set completed_at) e rejeita transição inválida", async () => {
    const goal = await createGoal(uid, { title: "Meditar" });
    const done = await changeGoalStatus(uid, goal.id, "completada");
    expect(done.status).toBe("completada");
    expect(done.completedAt).not.toBeNull();

    // completada → pausada é inválida
    await expect(changeGoalStatus(uid, goal.id, "pausada")).rejects.toThrow(/inválida/i);

    // reabrir limpa completed_at
    const reopened = await changeGoalStatus(uid, goal.id, "ativa");
    expect(reopened.completedAt).toBeNull();
  });

  it("isola por usuário (RLS) — outro não vê as metas", async () => {
    expect(await listGoals(other)).toHaveLength(0);
  });
});
