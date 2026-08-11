import { desc, eq, type SQL, sql } from "drizzle-orm";

import { withUserContext } from "@/server/db/rls";
import { goals, type Goal } from "@/server/db/schema";

import { canTransition, type GoalStatusValue } from "./goal-status";
import { validateGoalTitle } from "./validate-goal-title";

/**
 * Camada de serviço das Metas (#9–#12). Cada função recebe `userId` e roda sob
 * `withUserContext`, então a RLS isola por usuário. Domínio reutilizável (tRPC/mobile).
 */

export type CreateGoalInput = {
  title: string;
  description?: string | null;
  lifeAreaId?: string | null;
  targetDate?: string | null;
};

/** US-1.1 — cria meta "Ativa". Valida o título (obrigatório, ≤120). */
export async function createGoal(userId: string, input: CreateGoalInput): Promise<Goal> {
  const title = validateGoalTitle(input.title);
  if (!title.ok) throw new Error(title.error);

  return withUserContext(userId, async (tx) => {
    const [row] = await tx
      .insert(goals)
      .values({
        userId,
        title: title.value,
        description: input.description ?? null,
        lifeAreaId: input.lifeAreaId ?? null,
        targetDate: input.targetDate ?? null,
      })
      .returning();
    return row!;
  });
}

/** US-1.2 — lista metas por `updated_at DESC`, com filtro opcional por área. */
export async function listGoals(
  userId: string,
  filter?: { lifeAreaId?: string },
): Promise<Goal[]> {
  return withUserContext(userId, (tx) =>
    tx
      .select()
      .from(goals)
      .where(filter?.lifeAreaId ? eq(goals.lifeAreaId, filter.lifeAreaId) : undefined)
      .orderBy(desc(goals.updatedAt)),
  );
}

export type UpdateGoalInput = {
  title?: string;
  description?: string | null;
  lifeAreaId?: string | null;
  targetDate?: string | null;
  progress?: number;
};

type GoalUpdateSet = Partial<{
  title: string;
  description: string | null;
  lifeAreaId: string | null;
  targetDate: string | null;
  progress: number;
  updatedAt: SQL;
}>;

/** US-1.3 — edita campos da meta e bumpa `updated_at`. Devolve `null` se não existir. */
export async function updateGoal(
  userId: string,
  id: string,
  patch: UpdateGoalInput,
): Promise<Goal | null> {
  const set: GoalUpdateSet = { updatedAt: sql`now()` };
  if (patch.title !== undefined) {
    const title = validateGoalTitle(patch.title);
    if (!title.ok) throw new Error(title.error);
    set.title = title.value;
  }
  if (patch.description !== undefined) set.description = patch.description;
  if (patch.lifeAreaId !== undefined) set.lifeAreaId = patch.lifeAreaId;
  if (patch.targetDate !== undefined) set.targetDate = patch.targetDate;
  if (patch.progress !== undefined) set.progress = patch.progress;

  return withUserContext(userId, async (tx) => {
    const [row] = await tx.update(goals).set(set).where(eq(goals.id, id)).returning();
    return row ?? null;
  });
}

/** US-1.4 — altera o status respeitando a máquina de estados; (de)set `completed_at`. */
export async function changeGoalStatus(
  userId: string,
  id: string,
  to: GoalStatusValue,
): Promise<Goal> {
  return withUserContext(userId, async (tx) => {
    const [current] = await tx
      .select({ status: goals.status })
      .from(goals)
      .where(eq(goals.id, id));
    if (!current) throw new Error("Meta não encontrada.");
    if (!canTransition(current.status, to)) {
      throw new Error(`Transição de status inválida: ${current.status} → ${to}.`);
    }

    const [row] = await tx
      .update(goals)
      .set({
        status: to,
        completedAt: to === "completada" ? sql`now()` : null,
        updatedAt: sql`now()`,
      })
      .where(eq(goals.id, id))
      .returning();
    return row!;
  });
}
