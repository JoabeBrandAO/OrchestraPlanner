import { asc, eq, sql } from "drizzle-orm";

import { withUserContext, type Tx } from "@/server/db/rls";
import { goalMilestones, goals, type GoalMilestone } from "@/server/db/schema";
import { validateTitle } from "@/server/services/shared/validate-title";

import { computeProgress } from "./progress";

/**
 * Marcos das metas (#15). Como as demais camadas de serviço, recebe `userId` e roda sob
 * `withUserContext` — a RLS isola, sem `where(user_id)` manual.
 *
 * Invariante do módulo: **toda** mutação recalcula `goals.progress` na mesma transação,
 * então a barra da meta nunca fica dessincronizada dos marcos. A matemática do percentual
 * mora em `progress.ts` (pura, testável sem banco).
 */

/** Resultado das mutações: a lista já reordenada + o progresso novo da meta. */
export type MilestonesSnapshot = {
  goalId: string;
  progress: number;
  milestones: GoalMilestone[];
};

/** Lê os marcos da meta na ordem do quadro (`position` crescente). */
async function readMilestones(tx: Tx, goalId: string): Promise<GoalMilestone[]> {
  return tx
    .select()
    .from(goalMilestones)
    .where(eq(goalMilestones.goalId, goalId))
    .orderBy(asc(goalMilestones.position), asc(goalMilestones.createdAt));
}

/**
 * Recalcula `goals.progress` a partir dos marcos e devolve o retrato da meta.
 * Chamada no fim de cada mutação, dentro da mesma transação.
 */
async function recompute(tx: Tx, goalId: string): Promise<MilestonesSnapshot> {
  const milestones = await readMilestones(tx, goalId);
  const progress = computeProgress(milestones);

  await tx
    .update(goals)
    .set({ progress, updatedAt: sql`now()` })
    .where(eq(goals.id, goalId));

  return { goalId, progress, milestones };
}

/** Marcos de uma meta + o progresso derivado (sem escrever nada). */
export async function listMilestones(userId: string, goalId: string): Promise<MilestonesSnapshot> {
  return withUserContext(userId, async (tx) => {
    const milestones = await readMilestones(tx, goalId);
    return { goalId, progress: computeProgress(milestones), milestones };
  });
}

/** Adiciona um marco no fim da lista (`position = max + 1`) e recalcula o progresso. */
export async function addMilestone(
  userId: string,
  goalId: string,
  input: { title: string },
): Promise<MilestonesSnapshot> {
  const title = validateTitle(input.title);
  if (!title.ok) throw new Error(title.error);

  return withUserContext(userId, async (tx) => {
    // A meta precisa existir *para este usuário*: sob RLS o select já filtra por dono,
    // então um id de outra pessoa simplesmente não aparece aqui.
    const [goal] = await tx.select({ id: goals.id }).from(goals).where(eq(goals.id, goalId));
    if (!goal) throw new Error("Meta não encontrada.");

    const [last] = await tx
      .select({ max: sql<number | null>`max(${goalMilestones.position})` })
      .from(goalMilestones)
      .where(eq(goalMilestones.goalId, goalId));

    await tx.insert(goalMilestones).values({
      userId,
      goalId,
      title: title.value,
      position: (last?.max ?? -1) + 1,
    });

    return recompute(tx, goalId);
  });
}

/** Renomeia um marco. Não mexe na conclusão nem na ordem. */
export async function renameMilestone(
  userId: string,
  id: string,
  input: { title: string },
): Promise<MilestonesSnapshot> {
  const title = validateTitle(input.title);
  if (!title.ok) throw new Error(title.error);

  return withUserContext(userId, async (tx) => {
    const [row] = await tx
      .update(goalMilestones)
      .set({ title: title.value, updatedAt: sql`now()` })
      .where(eq(goalMilestones.id, id))
      .returning({ goalId: goalMilestones.goalId });
    if (!row) throw new Error("Marco não encontrado.");

    return recompute(tx, row.goalId);
  });
}

/**
 * Conclui ou reabre um marco. `done` é explícito (e não um toggle cego) para o clique
 * duplo — ou dois dispositivos — não desfazer o que o usuário acabou de marcar.
 */
export async function setMilestoneDone(
  userId: string,
  id: string,
  done: boolean,
): Promise<MilestonesSnapshot> {
  return withUserContext(userId, async (tx) => {
    const [row] = await tx
      .update(goalMilestones)
      .set({ completedAt: done ? sql`now()` : null, updatedAt: sql`now()` })
      .where(eq(goalMilestones.id, id))
      .returning({ goalId: goalMilestones.goalId });
    if (!row) throw new Error("Marco não encontrado.");

    return recompute(tx, row.goalId);
  });
}

/** Remove o marco e fecha o buraco na ordem, mantendo `position` contígua. */
export async function deleteMilestone(userId: string, id: string): Promise<MilestonesSnapshot> {
  return withUserContext(userId, async (tx) => {
    const [row] = await tx
      .delete(goalMilestones)
      .where(eq(goalMilestones.id, id))
      .returning({ goalId: goalMilestones.goalId });
    if (!row) throw new Error("Marco não encontrado.");

    const remaining = await readMilestones(tx, row.goalId);
    for (const [index, milestone] of remaining.entries()) {
      if (milestone.position !== index) {
        await tx
          .update(goalMilestones)
          .set({ position: index })
          .where(eq(goalMilestones.id, milestone.id));
      }
    }

    return recompute(tx, row.goalId);
  });
}
