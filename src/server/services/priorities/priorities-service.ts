import { and, asc, eq, inArray, sql, type SQL } from "drizzle-orm";

import { withUserContext, type Tx } from "@/server/db/rls";
import { priorities, priorityTags, tags, type Priority, type Tag } from "@/server/db/schema";
import { validateTitle } from "@/server/services/shared/validate-title";

import { entersDone, leavesDone, type PriorityStatusValue } from "./priority-status";
import { computeReorder } from "./reorder";

/**
 * Camada de serviço das Prioridades (#13). Cada função recebe `userId` e roda sob
 * `withUserContext`, então a RLS isola por usuário — nenhum `where(user_id)` manual.
 * Domínio reutilizável (tRPC/mobile); a matemática da ordenação vive em `reorder.ts`.
 */

/** Prioridade com as tags já resolvidas — o board precisa delas para desenhar o card. */
export type PriorityWithTags = Priority & { tags: Tag[] };

export type CreatePriorityInput = {
  title: string;
  description?: string | null;
  goalId?: string | null;
  priorityLevel?: number;
  dueDate?: string | null;
};

/** Anexa as tags de cada prioridade em 1 query extra (evita N+1 no board). */
async function attachTags(tx: Tx, rows: Priority[]): Promise<PriorityWithTags[]> {
  if (rows.length === 0) return [];

  const links = await tx
    .select({ priorityId: priorityTags.priorityId, tag: tags })
    .from(priorityTags)
    .innerJoin(tags, eq(tags.id, priorityTags.tagId))
    .where(
      inArray(
        priorityTags.priorityId,
        rows.map((row) => row.id),
      ),
    )
    .orderBy(asc(tags.name));

  const byPriority = new Map<string, Tag[]>();
  for (const link of links) {
    const list = byPriority.get(link.priorityId) ?? [];
    list.push(link.tag);
    byPriority.set(link.priorityId, list);
  }

  return rows.map((row) => ({ ...row, tags: byPriority.get(row.id) ?? [] }));
}

/** Cria a prioridade no fim da coluna "A fazer" (`position = max + 1`). */
export async function createPriority(
  userId: string,
  input: CreatePriorityInput,
): Promise<PriorityWithTags> {
  const title = validateTitle(input.title);
  if (!title.ok) throw new Error(title.error);

  return withUserContext(userId, async (tx) => {
    const [last] = await tx
      .select({ max: sql<number | null>`max(${priorities.position})` })
      .from(priorities)
      .where(eq(priorities.status, "todo"));

    const [row] = await tx
      .insert(priorities)
      .values({
        userId,
        title: title.value,
        description: input.description ?? null,
        goalId: input.goalId ?? null,
        priorityLevel: input.priorityLevel ?? 0,
        dueDate: input.dueDate ?? null,
        status: "todo",
        position: (last?.max ?? -1) + 1,
      })
      .returning();

    return { ...row!, tags: [] };
  });
}

export type ListPrioritiesFilter = {
  goalId?: string;
  status?: PriorityStatusValue;
  tagId?: string;
};

/** Lista as prioridades ordenadas por coluna e `position` — a ordem que o board desenha. */
export async function listPriorities(
  userId: string,
  filter?: ListPrioritiesFilter,
): Promise<PriorityWithTags[]> {
  return withUserContext(userId, async (tx) => {
    const conditions: SQL[] = [];
    if (filter?.goalId) conditions.push(eq(priorities.goalId, filter.goalId));
    if (filter?.status) conditions.push(eq(priorities.status, filter.status));
    if (filter?.tagId) {
      conditions.push(
        sql`exists (select 1 from ${priorityTags} pt
          where pt.priority_id = ${priorities.id} and pt.tag_id = ${filter.tagId})`,
      );
    }

    const rows = await tx
      .select()
      .from(priorities)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(priorities.status), asc(priorities.position));

    return attachTags(tx, rows);
  });
}

export type UpdatePriorityInput = {
  title?: string;
  description?: string | null;
  goalId?: string | null;
  priorityLevel?: number;
  dueDate?: string | null;
};

type PriorityUpdateSet = Partial<{
  title: string;
  description: string | null;
  goalId: string | null;
  priorityLevel: number;
  dueDate: string | null;
  updatedAt: SQL;
}>;

/** Edita campos da prioridade e bumpa `updated_at`. Devolve `null` se não existir. */
export async function updatePriority(
  userId: string,
  id: string,
  patch: UpdatePriorityInput,
): Promise<Priority | null> {
  const set: PriorityUpdateSet = { updatedAt: sql`now()` };
  if (patch.title !== undefined) {
    const title = validateTitle(patch.title);
    if (!title.ok) throw new Error(title.error);
    set.title = title.value;
  }
  if (patch.description !== undefined) set.description = patch.description;
  if (patch.goalId !== undefined) set.goalId = patch.goalId;
  if (patch.priorityLevel !== undefined) set.priorityLevel = patch.priorityLevel;
  if (patch.dueDate !== undefined) set.dueDate = patch.dueDate;

  return withUserContext(userId, async (tx) => {
    const [row] = await tx.update(priorities).set(set).where(eq(priorities.id, id)).returning();
    return row ?? null;
  });
}

export async function deletePriority(userId: string, id: string): Promise<void> {
  await withUserContext(userId, (tx) => tx.delete(priorities).where(eq(priorities.id, id)));
}

/**
 * Move um card no Kanban: coluna `toStatus`, índice `toIndex`. Tudo em **uma transação** —
 * lê o retrato atual, delega a matemática a `computeReorder` e grava só o que mudou, para
 * que a ordem nunca fique com buracos ou empates. Também aplica a regra de `completed_at`.
 */
export async function movePriority(
  userId: string,
  id: string,
  target: { toStatus: PriorityStatusValue; toIndex: number },
): Promise<Priority> {
  return withUserContext(userId, async (tx) => {
    const snapshot = await tx
      .select({ id: priorities.id, status: priorities.status, position: priorities.position })
      .from(priorities);

    const moved = snapshot.find((item) => item.id === id);
    if (!moved) throw new Error("Prioridade não encontrada.");

    for (const update of computeReorder(snapshot, id, target.toStatus, target.toIndex)) {
      await tx
        .update(priorities)
        .set({ status: update.status, position: update.position })
        .where(eq(priorities.id, update.id));
    }

    const set: Record<string, unknown> = { status: target.toStatus, updatedAt: sql`now()` };
    if (entersDone(moved.status, target.toStatus)) set.completedAt = sql`now()`;
    if (leavesDone(moved.status, target.toStatus)) set.completedAt = null;

    const [row] = await tx.update(priorities).set(set).where(eq(priorities.id, id)).returning();
    return row!;
  });
}
