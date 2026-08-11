import { asc, eq, sql } from "drizzle-orm";

import { withUserContext } from "@/server/db/rls";
import { lifeAreas, type LifeArea } from "@/server/db/schema";

import { DEFAULT_LIFE_AREAS, type LifeDimension } from "./default-areas";

/**
 * Camada de serviço das Áreas de Vida (#8). Domínio puro de aplicação: cada função
 * recebe `userId` e roda sob `withUserContext`, então a RLS isola por usuário — nenhum
 * `where(user_id)` manual é necessário (a policy cuida). Reutilizável por tRPC/mobile.
 */

/** Seed idempotente das áreas padrão (Visão §4). Retorna quantas inseriu (0 se já existiam). */
export async function seedDefaultLifeAreas(userId: string): Promise<number> {
  return withUserContext(userId, async (tx) => {
    const existing = await tx.select({ id: lifeAreas.id }).from(lifeAreas).limit(1);
    if (existing.length > 0) return 0;

    const rows = DEFAULT_LIFE_AREAS.map((area, position) => ({ ...area, userId, position }));
    const inserted = await tx.insert(lifeAreas).values(rows).returning({ id: lifeAreas.id });
    return inserted.length;
  });
}

/** Lista as áreas do usuário, ordenadas por `position` (e `created_at` como desempate). */
export async function listLifeAreas(userId: string): Promise<LifeArea[]> {
  return withUserContext(userId, (tx) =>
    tx.select().from(lifeAreas).orderBy(asc(lifeAreas.position), asc(lifeAreas.createdAt)),
  );
}

export type CreateLifeAreaInput = {
  dimension: LifeDimension;
  name: string;
  color?: string | null;
  icon?: string | null;
  position?: number;
};

export async function createLifeArea(
  userId: string,
  input: CreateLifeAreaInput,
): Promise<LifeArea> {
  return withUserContext(userId, async (tx) => {
    const [row] = await tx
      .insert(lifeAreas)
      .values({ ...input, userId })
      .returning();
    return row!;
  });
}

export type UpdateLifeAreaInput = Partial<CreateLifeAreaInput>;

/** Edita uma área. RLS garante que só a própria área é alterável; devolve `null` se não existir. */
export async function updateLifeArea(
  userId: string,
  id: string,
  patch: UpdateLifeAreaInput,
): Promise<LifeArea | null> {
  return withUserContext(userId, async (tx) => {
    const [row] = await tx
      .update(lifeAreas)
      .set({ ...patch, updatedAt: sql`now()` })
      .where(eq(lifeAreas.id, id))
      .returning();
    return row ?? null;
  });
}

export async function deleteLifeArea(userId: string, id: string): Promise<void> {
  await withUserContext(userId, (tx) => tx.delete(lifeAreas).where(eq(lifeAreas.id, id)));
}
