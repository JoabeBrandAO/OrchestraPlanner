import { and, asc, eq, sql } from "drizzle-orm";

import { withUserContext } from "@/server/db/rls";
import { people, peopleContacts, type PersonContactRow, type PersonRow } from "@/server/db/schema";
import { validateTitle } from "@/server/services/shared/validate-title";

import { isValidBirthday, type Birthday } from "./birthday";
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

export type PersonWithContacts = PersonRow & { contacts: PersonContactRow[] };

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

/** Pessoas do usuário com os contatos já embutidos — a tela mostra as duas coisas juntas. */
export async function listPeople(userId: string): Promise<PersonWithContacts[]> {
  return withUserContext(userId, async (tx) => {
    const rows = await tx.select().from(people).orderBy(asc(people.name));
    if (rows.length === 0) return [];

    const contacts = await tx.select().from(peopleContacts).orderBy(asc(peopleContacts.createdAt));

    const byPerson = new Map<string, PersonContactRow[]>();
    for (const contact of contacts) {
      const list = byPerson.get(contact.personId) ?? [];
      list.push(contact);
      byPerson.set(contact.personId, list);
    }

    return rows.map((person) => ({ ...person, contacts: byPerson.get(person.id) ?? [] }));
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
