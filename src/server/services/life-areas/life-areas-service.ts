import { asc, eq, sql } from "drizzle-orm";

import { withUserContext } from "@/server/db/rls";
import { lifeAreas, type LifeArea } from "@/server/db/schema";

import { DEFAULT_LIFE_AREAS, type LifeDimension } from "./default-areas";

/**
 * Camada de serviço das Áreas de Vida (#8). Domínio puro de aplicação: cada função
 * recebe `userId` e roda sob `withUserContext`, então a RLS isola por usuário — nenhum
 * `where(user_id)` manual é necessário (a policy cuida). Reutilizável por tRPC/mobile.
 */

/**
 * Seed idempotente das áreas padrão (Visão §4). Retorna quantas inseriu (0 se já existiam).
 *
 * A idempotência é do **banco**, não de um `if`: `ensureUserRecord()` roda em toda página
 * autenticada, e duas requisições simultâneas de um usuário novo passavam as duas pelo
 * "já existe?" antes de qualquer uma gravar — cada uma inseria as 12 áreas e o usuário
 * via 24 (docs/ERROS.md 2026-08-13). Com o índice único + `on conflict do nothing`, a
 * segunda simplesmente não insere nada, sem corrida possível.
 */
export async function seedDefaultLifeAreas(userId: string): Promise<number> {
  return withUserContext(userId, async (tx) => {
    const rows = DEFAULT_LIFE_AREAS.map((area, position) => ({ ...area, userId, position }));
    const inserted = await tx
      .insert(lifeAreas)
      .values(rows)
      .onConflictDoNothing()
      .returning({ id: lifeAreas.id });
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

/**
 * Violação de unicidade do Postgres (23505) — aqui só pode ser o nome de área repetido.
 * Percorre a cadeia de `cause` porque o Drizzle embrulha o erro do driver num
 * `DrizzleQueryError`: o `code` do Postgres não está no topo.
 */
function isDuplicateName(error: unknown): boolean {
  for (let current = error; current != null; current = (current as { cause?: unknown }).cause) {
    if (typeof current !== "object") return false;
    if ("code" in current && (current as { code?: string }).code === "23505") return true;
  }
  return false;
}

const DUPLICATE_MESSAGE = "Você já tem uma área de vida com esse nome.";

export async function createLifeArea(
  userId: string,
  input: CreateLifeAreaInput,
): Promise<LifeArea> {
  try {
    return await withUserContext(userId, async (tx) => {
      const [row] = await tx
        .insert(lifeAreas)
        .values({ ...input, userId })
        .returning();
      return row!;
    });
  } catch (error) {
    // Sem isto o índice único vazaria "duplicate key value violates..." para a tela.
    if (isDuplicateName(error)) throw new Error(DUPLICATE_MESSAGE);
    throw error;
  }
}

export type UpdateLifeAreaInput = Partial<CreateLifeAreaInput>;

/** Edita uma área. RLS garante que só a própria área é alterável; devolve `null` se não existir. */
export async function updateLifeArea(
  userId: string,
  id: string,
  patch: UpdateLifeAreaInput,
): Promise<LifeArea | null> {
  try {
    return await withUserContext(userId, async (tx) => {
      const [row] = await tx
        .update(lifeAreas)
        .set({ ...patch, updatedAt: sql`now()` })
        .where(eq(lifeAreas.id, id))
        .returning();
      return row ?? null;
    });
  } catch (error) {
    if (isDuplicateName(error)) throw new Error(DUPLICATE_MESSAGE);
    throw error;
  }
}

export async function deleteLifeArea(userId: string, id: string): Promise<void> {
  await withUserContext(userId, (tx) => tx.delete(lifeAreas).where(eq(lifeAreas.id, id)));
}
