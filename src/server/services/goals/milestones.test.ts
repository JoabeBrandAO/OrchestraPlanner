import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { migrateForTests } from "@/server/db/migrate-for-tests";
import { withUserContext } from "@/server/db/rls";
import { goalMilestones, goals, users } from "@/server/db/schema";

import { createGoal, listGoals } from "./goals-service";
import {
  addMilestone,
  deleteMilestone,
  listMilestones,
  renameMilestone,
  setMilestoneDone,
} from "./milestones-service";

/**
 * Marcos (#15). Integração com Postgres real sob RLS (role `app_rls`).
 * Roda só com `DATABASE_URL` (local), pulado no CI sem banco.
 */
const hasDb = Boolean(process.env.DATABASE_URL);

const stamp = Date.now();
const uid = `ms_user_${stamp}`;
const other = `ms_other_${stamp}`;

/** Progresso persistido na meta — é o que a barra da UI lê. */
async function goalProgress(userId: string, goalId: string): Promise<number> {
  const list = await listGoals(userId);
  return list.find((goal) => goal.id === goalId)!.progress;
}

describe.skipIf(!hasDb)("goal milestones — CRUD, progresso e isolamento", () => {
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
      await withUserContext(id, (tx) => tx.delete(goalMilestones));
      await withUserContext(id, (tx) => tx.delete(goals));
      await withUserContext(id, (tx) => tx.delete(users));
    }
  });

  it("adiciona marcos em ordem e mantém a meta em 0% enquanto nada é concluído", async () => {
    const goal = await createGoal(uid, { title: "Correr uma maratona" });

    await addMilestone(uid, goal.id, { title: "  Comprar tênis  " });
    const snapshot = await addMilestone(uid, goal.id, { title: "Correr 10km" });

    expect(snapshot.milestones.map((m) => m.title)).toEqual(["Comprar tênis", "Correr 10km"]);
    expect(snapshot.milestones.map((m) => m.position)).toEqual([0, 1]);
    expect(snapshot.progress).toBe(0);
    expect(await goalProgress(uid, goal.id)).toBe(0);

    await expect(addMilestone(uid, goal.id, { title: "   " })).rejects.toThrow();
  });

  it("concluir e reabrir marcos recalcula o progresso da meta", async () => {
    const goal = await createGoal(uid, { title: "Ler 12 livros" });
    const first = await addMilestone(uid, goal.id, { title: "Livro 1" });
    await addMilestone(uid, goal.id, { title: "Livro 2" });

    const half = await setMilestoneDone(uid, first.milestones[0]!.id, true);
    expect(half.progress).toBe(50);
    expect(half.milestones[0]!.completedAt).not.toBeNull();
    expect(await goalProgress(uid, goal.id)).toBe(50);

    const reopened = await setMilestoneDone(uid, first.milestones[0]!.id, false);
    expect(reopened.progress).toBe(0);
    expect(reopened.milestones[0]!.completedAt).toBeNull();
    expect(await goalProgress(uid, goal.id)).toBe(0);
  });

  it("renomeia sem mexer na conclusão", async () => {
    const goal = await createGoal(uid, { title: "Aprender violão" });
    const added = await addMilestone(uid, goal.id, { title: "Acordes maiores" });
    await setMilestoneDone(uid, added.milestones[0]!.id, true);

    const renamed = await renameMilestone(uid, added.milestones[0]!.id, { title: "Acordes" });
    expect(renamed.milestones[0]!.title).toBe("Acordes");
    expect(renamed.milestones[0]!.completedAt).not.toBeNull();
    expect(renamed.progress).toBe(100);
  });

  it("remover fecha o buraco na ordem e recalcula o progresso", async () => {
    const goal = await createGoal(uid, { title: "Reformar a casa" });
    await addMilestone(uid, goal.id, { title: "Pintura" });
    const second = await addMilestone(uid, goal.id, { title: "Piso" });
    const third = await addMilestone(uid, goal.id, { title: "Telhado" });
    await setMilestoneDone(uid, third.milestones[2]!.id, true);
    expect(await goalProgress(uid, goal.id)).toBe(33);

    const afterDelete = await deleteMilestone(uid, second.milestones[1]!.id);
    expect(afterDelete.milestones.map((m) => m.title)).toEqual(["Pintura", "Telhado"]);
    expect(afterDelete.milestones.map((m) => m.position)).toEqual([0, 1]);
    expect(afterDelete.progress).toBe(50);
    expect(await goalProgress(uid, goal.id)).toBe(50);
  });

  it("isola por usuário (RLS) — outro não vê nem altera os marcos", async () => {
    const goal = await createGoal(uid, { title: "Meta privada" });
    const added = await addMilestone(uid, goal.id, { title: "Passo secreto" });

    expect((await listMilestones(other, goal.id)).milestones).toHaveLength(0);
    await expect(addMilestone(other, goal.id, { title: "Invasão" })).rejects.toThrow(
      /não encontrada/i,
    );
    await expect(setMilestoneDone(other, added.milestones[0]!.id, true)).rejects.toThrow(
      /não encontrado/i,
    );
  });

  it("apagar a meta leva os marcos junto (cascade)", async () => {
    const goal = await createGoal(uid, { title: "Meta efêmera" });
    await addMilestone(uid, goal.id, { title: "Some comigo" });

    await withUserContext(uid, (tx) => tx.delete(goals).where(eq(goals.id, goal.id)));
    expect((await listMilestones(uid, goal.id)).milestones).toHaveLength(0);
  });
});
