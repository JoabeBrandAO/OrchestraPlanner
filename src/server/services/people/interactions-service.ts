import { and, desc, eq, max } from "drizzle-orm";

import { withUserContext, type Tx } from "@/server/db/rls";
import { interactions, people, type InteractionRow } from "@/server/db/schema";

/**
 * Interações — o acompanhamento do convívio (#43). Recebe `userId` e roda sob
 * `withUserContext`: a RLS isola. O "há quanto tempo" é calculado em `contact-gap.ts`,
 * puro; aqui só se lê e se escreve.
 */

export type InteractionKind = InteractionRow["kind"];

export type InteractionInput = {
  happenedAt: string;
  kind?: InteractionKind;
  notes?: string | null;
};

/**
 * O retrato completo do convívio com uma pessoa: as interações **e** a data do último
 * contato. A mutação devolve os dois porque a tela precisa dos dois — a lista mostra "há
 * quanto tempo" e o painel mostra o histórico. Devolvendo juntos, o client escreve direto
 * no cache e não refaz a lista inteira (convenção do projeto).
 */
export type InteractionsSnapshot = {
  personId: string;
  interactions: InteractionRow[];
  lastInteractionAt: string | null;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

async function snapshotOf(tx: Tx, personId: string): Promise<InteractionsSnapshot> {
  const rows = await tx
    .select()
    .from(interactions)
    .where(eq(interactions.personId, personId))
    .orderBy(desc(interactions.happenedAt), desc(interactions.createdAt));

  // O último contato sai da própria lista: uma verdade só, sem coluna espelho na pessoa
  // para manter em sincronia (mesma regra do progresso das metas).
  return { personId, interactions: rows, lastInteractionAt: rows[0]?.happenedAt ?? null };
}

export async function addInteraction(
  userId: string,
  personId: string,
  input: InteractionInput,
): Promise<InteractionsSnapshot> {
  if (!ISO_DATE.test(input.happenedAt)) throw new Error("Data da interação inválida.");

  return withUserContext(userId, async (tx) => {
    const [person] = await tx.select({ id: people.id }).from(people).where(eq(people.id, personId));
    if (!person) throw new Error("Pessoa não encontrada.");

    await tx.insert(interactions).values({
      userId,
      personId,
      happenedAt: input.happenedAt,
      kind: input.kind ?? "outro",
      notes: input.notes?.trim() || null,
    });

    return snapshotOf(tx, personId);
  });
}

export async function listInteractionsOf(
  userId: string,
  personId: string,
): Promise<InteractionsSnapshot> {
  return withUserContext(userId, (tx) => snapshotOf(tx, personId));
}

export async function deleteInteraction(
  userId: string,
  id: string,
): Promise<InteractionsSnapshot | null> {
  return withUserContext(userId, async (tx) => {
    const [row] = await tx
      .delete(interactions)
      .where(and(eq(interactions.id, id), eq(interactions.userId, userId)))
      .returning({ personId: interactions.personId });

    return row ? snapshotOf(tx, row.personId) : null;
  });
}

/**
 * Data do último contato de **cada** pessoa, para a lista mostrar "há quanto tempo" sem
 * uma consulta por linha.
 */
export async function lastContactByPerson(tx: Tx): Promise<Map<string, string>> {
  const rows = await tx
    .select({ personId: interactions.personId, lastAt: max(interactions.happenedAt) })
    .from(interactions)
    .groupBy(interactions.personId);

  return new Map(
    rows.filter((row) => row.lastAt !== null).map((row) => [row.personId, row.lastAt!]),
  );
}
