import { and, asc, eq, isNotNull, sql } from "drizzle-orm";

import { withUserContext } from "@/server/db/rls";
import {
  interactions,
  people,
  peopleContacts,
  type PersonContactRow,
  type PersonRow,
} from "@/server/db/schema";
import { validateTitle } from "@/server/services/shared/validate-title";

import { isValidBirthday, type Birthday } from "./birthday";
import { birthdaysInRange, type BirthdayOccurrence } from "./birthday-agenda";
import {
  MARRIED_STATUSES,
  type ContactKindValue,
  type GenderValue,
  type MaritalStatusValue,
  type RelationTypeValue,
} from "./person-fields";

/**
 * Pessoas & Relacionamentos (#41) — cadastro e contatos. Como no resto do domínio, recebe
 * `userId` e roda sob `withUserContext`: a RLS isola. A matemática do aniversário vive em
 * `birthday.ts`, pura; aqui ficam as regras de escrita.
 */

export type PersonWithContacts = PersonRow & {
  contacts: PersonContactRow[];
  /**
   * Data do último contato registrado (#43), ou `null` para quem nunca foi procurado —
   * que é diferente de "há 0 dias". Vem da própria tabela de interações, não de uma coluna
   * espelho em `people` que precisaria ser mantida em sincronia.
   */
  lastInteractionAt: string | null;
};

export type PersonInput = {
  name: string;
  nickname?: string | null;
  birthday?: Birthday | null;
  gender?: GenderValue;
  maritalStatus?: MaritalStatusValue;
  marriedAt?: string | null;
  relationType?: RelationTypeValue;
  lifeAreaId?: string | null;
  notes?: string | null;
};

export type ContactInput = {
  kind: ContactKindValue;
  label?: string | null;
  value: string;
};

/**
 * Data de casamento só existe para quem é casado (decisão #25). A tela já esconde o campo,
 * mas quem decide é aqui: campo escondido que continua sendo gravado vira dado fantasma,
 * que reaparece quando o estado civil muda de novo.
 */
function marriedAtFor(status: MaritalStatusValue, marriedAt: string | null | undefined) {
  return MARRIED_STATUSES.includes(status) ? (marriedAt ?? null) : null;
}

function validateBirthday(birthday: Birthday | null | undefined): Birthday | null {
  if (!birthday) return null;
  if (!isValidBirthday(birthday)) throw new Error("Data de nascimento inválida.");
  return birthday;
}

export async function createPerson(userId: string, input: PersonInput): Promise<PersonRow> {
  const name = validateTitle(input.name);
  if (!name.ok) throw new Error(name.error);

  const birthday = validateBirthday(input.birthday);
  const maritalStatus = input.maritalStatus ?? "nao_informado";

  return withUserContext(userId, async (tx) => {
    const [row] = await tx
      .insert(people)
      .values({
        userId,
        name: name.value,
        nickname: input.nickname?.trim() || null,
        birthDay: birthday?.day ?? null,
        birthMonth: birthday?.month ?? null,
        birthYear: birthday?.year ?? null,
        gender: input.gender ?? "nao_informado",
        maritalStatus,
        marriedAt: marriedAtFor(maritalStatus, input.marriedAt),
        relationType: input.relationType ?? "outro",
        lifeAreaId: input.lifeAreaId ?? null,
        notes: input.notes?.trim() || null,
      })
      .returning();
    return row!;
  });
}

/**
 * Pessoas do usuário com contatos e último contato — **uma consulta só**, porque é uma tela
 * só. Contra o Neon cada statement é uma viagem pela rede, e três viagens para montar uma
 * lista é a diferença entre a tela abrir e a tela demorar (ver `query-budget.test.ts`).
 *
 * O join duplica a pessoa por contato e o agrupamento é feito aqui; a data do último
 * contato vem de uma subconsulta correlacionada, servida pelo índice
 * `interactions_user_person_date_idx`.
 */
export async function listPeople(userId: string): Promise<PersonWithContacts[]> {
  return withUserContext(userId, async (tx) => {
    const rows = await tx
      .select({
        person: people,
        contact: peopleContacts,
        lastInteractionAt: sql<string | null>`(
          select max(${interactions.happenedAt})
          from ${interactions}
          where ${interactions.personId} = ${people.id}
        )`,
      })
      .from(people)
      .leftJoin(peopleContacts, eq(peopleContacts.personId, people.id))
      .orderBy(asc(people.name), asc(peopleContacts.createdAt));

    const byId = new Map<string, PersonWithContacts>();
    for (const row of rows) {
      const current = byId.get(row.person.id) ?? {
        ...row.person,
        contacts: [],
        lastInteractionAt: row.lastInteractionAt,
      };
      if (row.contact) current.contacts.push(row.contact);
      byId.set(row.person.id, current);
    }

    return [...byId.values()];
  });
}

export async function updatePerson(
  userId: string,
  id: string,
  patch: Partial<PersonInput>,
): Promise<PersonRow | null> {
  return withUserContext(userId, async (tx) => {
    const [current] = await tx.select().from(people).where(eq(people.id, id));
    if (!current) return null;

    const set: Record<string, unknown> = { updatedAt: sql`now()` };

    if (patch.name !== undefined) {
      const name = validateTitle(patch.name);
      if (!name.ok) throw new Error(name.error);
      set.name = name.value;
    }
    if (patch.nickname !== undefined) set.nickname = patch.nickname?.trim() || null;
    if (patch.birthday !== undefined) {
      const birthday = validateBirthday(patch.birthday);
      set.birthDay = birthday?.day ?? null;
      set.birthMonth = birthday?.month ?? null;
      set.birthYear = birthday?.year ?? null;
    }
    if (patch.gender !== undefined) set.gender = patch.gender;
    if (patch.relationType !== undefined) set.relationType = patch.relationType;
    if (patch.lifeAreaId !== undefined) set.lifeAreaId = patch.lifeAreaId;
    if (patch.notes !== undefined) set.notes = patch.notes?.trim() || null;

    // O estado civil e a data de casamento são decididos juntos, sobre os valores finais:
    // trocar só o estado civil precisa limpar a data que deixou de fazer sentido.
    if (patch.maritalStatus !== undefined || patch.marriedAt !== undefined) {
      const status = patch.maritalStatus ?? current.maritalStatus;
      set.maritalStatus = status;
      set.marriedAt = marriedAtFor(status, patch.marriedAt ?? current.marriedAt);
    }

    const [row] = await tx.update(people).set(set).where(eq(people.id, id)).returning();
    return row ?? null;
  });
}

export async function deletePerson(userId: string, id: string): Promise<void> {
  await withUserContext(userId, (tx) => tx.delete(people).where(eq(people.id, id)));
}

export async function addContact(
  userId: string,
  personId: string,
  input: ContactInput,
): Promise<PersonContactRow> {
  const value = input.value.trim();
  if (value === "") throw new Error("O contato não pode ser vazio.");

  return withUserContext(userId, async (tx) => {
    const [person] = await tx.select({ id: people.id }).from(people).where(eq(people.id, personId));
    if (!person) throw new Error("Pessoa não encontrada.");

    const [row] = await tx
      .insert(peopleContacts)
      .values({ userId, personId, kind: input.kind, label: input.label?.trim() || null, value })
      .returning();
    return row!;
  });
}

export async function deleteContact(userId: string, id: string): Promise<void> {
  await withUserContext(userId, (tx) =>
    tx
      .delete(peopleContacts)
      .where(and(eq(peopleContacts.id, id), eq(peopleContacts.userId, userId))),
  );
}

/**
 * Aniversários que caem na janela (#44). **Derivado** da data em `people` a cada leitura,
 * e não materializado como compromisso: corrigir a data de nascimento move o aniversário
 * sozinho, sem deixar para trás um evento anual mentindo no calendário.
 */
export async function listBirthdaysInRange(
  userId: string,
  range: { from: Date; to: Date },
): Promise<BirthdayOccurrence[]> {
  const rows = await withUserContext(userId, (tx) =>
    tx
      .select({
        id: people.id,
        name: people.name,
        day: people.birthDay,
        month: people.birthMonth,
        year: people.birthYear,
      })
      .from(people)
      .where(and(isNotNull(people.birthDay), isNotNull(people.birthMonth))),
  );

  return birthdaysInRange(
    rows.map((row) => ({
      id: row.id,
      name: row.name,
      birthday: { day: row.day!, month: row.month!, year: row.year },
    })),
    range,
  );
}
