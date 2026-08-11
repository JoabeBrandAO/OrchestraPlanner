import { asc, eq, inArray, sql } from "drizzle-orm";

import { withUserContext } from "@/server/db/rls";
import { priorityTags, tags, type Tag } from "@/server/db/schema";

import { normalizeTagName } from "./tag-name";

/**
 * Camada de serviço das Tags (#14). Tags são do usuário e reutilizáveis entre prioridades.
 * Como no resto do domínio, tudo roda sob `withUserContext` e a RLS isola por `user_id`.
 * A regra pura do nome vive em `tag-name.ts` (compartilhada com a UI).
 */

export async function listTags(userId: string): Promise<Tag[]> {
  return withUserContext(userId, (tx) => tx.select().from(tags).orderBy(asc(tags.name)));
}

/**
 * Cria a tag — ou devolve a existente. O autocomplete do board chama isto ao digitar um
 * nome novo, então "já existe" não é erro: reaproveita (case-insensitive, igual ao índice
 * único `(user_id, lower(name))`) e evita "Casa"/"casa" duplicadas.
 */
export async function createTag(
  userId: string,
  input: { name: string; color?: string | null },
): Promise<Tag> {
  const name = normalizeTagName(input.name);

  return withUserContext(userId, async (tx) => {
    const [existing] = await tx
      .select()
      .from(tags)
      .where(sql`lower(${tags.name}) = lower(${name})`);
    if (existing) return existing;

    const [row] = await tx
      .insert(tags)
      .values({ userId, name, color: input.color ?? null })
      .returning();
    return row!;
  });
}

/** Remove a tag; as associações caem junto pelo `ON DELETE CASCADE` de `priority_tags`. */
export async function deleteTag(userId: string, id: string): Promise<void> {
  await withUserContext(userId, (tx) => tx.delete(tags).where(eq(tags.id, id)));
}

/**
 * Define **o conjunto** de tags de uma prioridade (substitui o que havia), numa transação.
 * Ignora ids que não sejam do usuário — a RLS já os esconderia, mas filtrar explicitamente
 * evita inserir uma associação órfã e devolve ao chamador só o que de fato valeu.
 */
export async function setPriorityTags(
  userId: string,
  priorityId: string,
  tagIds: readonly string[],
): Promise<Tag[]> {
  return withUserContext(userId, async (tx) => {
    const valid =
      tagIds.length > 0
        ? await tx
            .select()
            .from(tags)
            .where(inArray(tags.id, [...tagIds]))
            .orderBy(asc(tags.name))
        : [];

    await tx.delete(priorityTags).where(eq(priorityTags.priorityId, priorityId));

    if (valid.length > 0) {
      await tx
        .insert(priorityTags)
        .values(valid.map((tag) => ({ priorityId, tagId: tag.id, userId })));
    }

    return valid;
  });
}

/** Tags de uma prioridade específica (usado em telas de detalhe/edição). */
export async function listPriorityTags(userId: string, priorityId: string): Promise<Tag[]> {
  return withUserContext(userId, (tx) =>
    tx
      .select({
        id: tags.id,
        userId: tags.userId,
        name: tags.name,
        color: tags.color,
        createdAt: tags.createdAt,
        updatedAt: tags.updatedAt,
      })
      .from(priorityTags)
      .innerJoin(tags, eq(tags.id, priorityTags.tagId))
      .where(eq(priorityTags.priorityId, priorityId))
      .orderBy(asc(tags.name)),
  );
}
