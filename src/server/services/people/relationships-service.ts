import { and, asc, eq, or } from "drizzle-orm";

import { withUserContext } from "@/server/db/rls";
import {
  circleMembers,
  circles,
  people,
  personLinks,
  type CircleMemberRow,
  type CircleRow,
} from "@/server/db/schema";
import { validateTitle } from "@/server/services/shared/validate-title";

import { canonicalLink, linkFrom, type RelationValue } from "./relations";

/**
 * Vínculos e círculos (#42) — o "como as pessoas se relacionam" do CRM pessoal. Recebe
 * `userId` e roda sob `withUserContext`: a RLS isola. A matemática do vínculo (inverso e
 * ordem canônica do par) está em `relations.ts`, pura.
 */

export type PersonLinkView = {
  id: string;
  /** A outra ponta, vista de quem abriu a ficha. */
  personId: string;
  name: string;
  relation: RelationValue;
};

export type CircleWithMembers = CircleRow & {
  members: (CircleMemberRow & { name: string })[];
};

/* ----------------------------- vínculos ----------------------------------- */

/**
 * Liga duas pessoas. `relation` diz o que **`relatedPersonId` é para `personId`** ("filho"
 * = o outro é meu filho). Refazer o vínculo com outra relação **atualiza** a linha em vez
 * de criar uma segunda — inclusive quando vem pelo lado contrário, porque o par é
 * normalizado antes de tocar no banco.
 */
export async function linkPeople(
  userId: string,
  personId: string,
  relatedPersonId: string,
  relation: RelationValue,
): Promise<void> {
  if (personId === relatedPersonId) {
    throw new Error("Uma pessoa não se vincula a si mesma.");
  }

  const link = canonicalLink(personId, relatedPersonId, relation);

  await withUserContext(userId, async (tx) => {
    // As duas pontas precisam ser do usuário; a RLS já esconde as alheias, então não achar
    // aqui significa "não é sua".
    const found = await tx
      .select({ id: people.id })
      .from(people)
      .where(or(eq(people.id, personId), eq(people.id, relatedPersonId)));
    if (found.length !== 2) throw new Error("Pessoa não encontrada.");

    await tx
      .insert(personLinks)
      .values({
        userId,
        personId: link.personId,
        relatedPersonId: link.relatedPersonId,
        relation: link.relation,
      })
      .onConflictDoUpdate({
        target: [personLinks.personId, personLinks.relatedPersonId],
        set: { relation: link.relation },
      });
  });
}

export async function unlinkPeople(userId: string, id: string): Promise<void> {
  await withUserContext(userId, (tx) =>
    tx.delete(personLinks).where(and(eq(personLinks.id, id), eq(personLinks.userId, userId))),
  );
}

/**
 * Vínculos de uma pessoa, **já virados para o lado de quem olha**: quem é o outro e o que
 * ele é para mim. É aqui que a linha única vira as duas leituras.
 */
export async function listLinksOf(userId: string, personId: string): Promise<PersonLinkView[]> {
  return withUserContext(userId, async (tx) => {
    const rows = await tx
      .select()
      .from(personLinks)
      .where(or(eq(personLinks.personId, personId), eq(personLinks.relatedPersonId, personId)));
    if (rows.length === 0) return [];

    const names = new Map(
      (await tx.select({ id: people.id, name: people.name }).from(people)).map((person) => [
        person.id,
        person.name,
      ]),
    );

    return rows
      .map((row) => {
        const { otherId, relation } = linkFrom(row, personId);
        return { id: row.id, personId: otherId, name: names.get(otherId) ?? "", relation };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  });
}

/* ------------------------------ círculos ---------------------------------- */

export async function createCircle(
  userId: string,
  input: { name: string; kind?: CircleRow["kind"]; notes?: string | null },
): Promise<CircleRow> {
  const name = validateTitle(input.name);
  if (!name.ok) throw new Error(name.error);

  return withUserContext(userId, async (tx) => {
    const [row] = await tx
      .insert(circles)
      .values({
        userId,
        name: name.value,
        kind: input.kind ?? "outro",
        notes: input.notes?.trim() || null,
      })
      .returning();
    return row!;
  });
}

export async function deleteCircle(userId: string, id: string): Promise<void> {
  await withUserContext(userId, (tx) => tx.delete(circles).where(eq(circles.id, id)));
}

/**
 * Círculos do usuário com os membros e os nomes deles — **uma consulta só**, porque a tela
 * mostra os dois juntos e cada statement contra o Neon é uma viagem pela rede
 * (ver `query-budget.test.ts`). O join duplica o círculo por membro; agrupa-se aqui.
 */
export async function listCircles(userId: string): Promise<CircleWithMembers[]> {
  return withUserContext(userId, async (tx) => {
    const rows = await tx
      .select({ circle: circles, member: circleMembers, name: people.name })
      .from(circles)
      .leftJoin(circleMembers, eq(circleMembers.circleId, circles.id))
      .leftJoin(people, eq(people.id, circleMembers.personId))
      .orderBy(asc(circles.name), asc(people.name));

    const byId = new Map<string, CircleWithMembers>();
    for (const row of rows) {
      const current = byId.get(row.circle.id) ?? { ...row.circle, members: [] };
      if (row.member && row.name !== null) {
        current.members.push({ ...row.member, name: row.name });
      }
      byId.set(row.circle.id, current);
    }

    return [...byId.values()];
  });
}

/** Entrar num círculo é idempotente: repetir só atualiza o papel, não duplica o membro. */
export async function addCircleMember(
  userId: string,
  circleId: string,
  personId: string,
  role?: string | null,
): Promise<void> {
  await withUserContext(userId, async (tx) => {
    const [circle] = await tx
      .select({ id: circles.id })
      .from(circles)
      .where(eq(circles.id, circleId));
    if (!circle) throw new Error("Círculo não encontrado.");

    const [person] = await tx.select({ id: people.id }).from(people).where(eq(people.id, personId));
    if (!person) throw new Error("Pessoa não encontrada.");

    await tx
      .insert(circleMembers)
      .values({ userId, circleId, personId, role: role?.trim() || null })
      .onConflictDoUpdate({
        target: [circleMembers.circleId, circleMembers.personId],
        set: { role: role?.trim() || null },
      });
  });
}

export async function removeCircleMember(userId: string, id: string): Promise<void> {
  await withUserContext(userId, (tx) =>
    tx.delete(circleMembers).where(and(eq(circleMembers.id, id), eq(circleMembers.userId, userId))),
  );
}
