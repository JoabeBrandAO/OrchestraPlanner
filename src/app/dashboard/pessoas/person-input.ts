import { isValidBirthday, type Birthday } from "@/server/services/people/birthday";
import {
  acceptsMarriageDate,
  GENDERS,
  MARITAL_STATUSES,
  RELATION_TYPES,
  type GenderValue,
  type MaritalStatusValue,
  type RelationTypeValue,
} from "@/server/services/people/person-fields";

/**
 * Regras do formulário de pessoa (#41) — **puras**: recebem as strings dos campos e
 * devolvem veredito e valores de domínio. Mesmo padrão de `agenda/event-fields.ts`, que é
 * o que permite o formulário ser não controlado e digitar não custar render.
 */

export type RawPersonFields = {
  name: string;
  nickname: string;
  /** Data completa "YYYY-MM-DD", como sai de um `<input type="date">`. */
  birthDate: string;
  gender: string;
  maritalStatus: string;
  marriedAt: string;
  relationType: string;
  lifeAreaId: string;
  notes: string;
};

export type PersonFormValues = {
  name: string;
  nickname: string | null;
  birthday: Birthday | null;
  gender: GenderValue;
  maritalStatus: MaritalStatusValue;
  marriedAt: string | null;
  relationType: RelationTypeValue;
  lifeAreaId: string | null;
  notes: string | null;
};

export type PersonStatus = {
  canSubmit: boolean;
  /** Dia e mês preenchidos que não formam uma data real (31 de fevereiro). */
  invalidBirthday: boolean;
};

function oneOf<T extends string>(options: readonly T[], value: string, fallback: T): T {
  return (options as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** Hoje em "YYYY-MM-DD" — é o `max` do campo, que impede escolher data futura. */
export function todayISO(today: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
}

/** Um `Birthday` de volta para o formato do campo; sem ano não há data completa a mostrar. */
export function birthdayToISO(birthday: Birthday | null): string {
  if (birthday === null || birthday.year === null) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${birthday.year}-${pad(birthday.month)}-${pad(birthday.day)}`;
}

/**
 * A data de nascimento é **um campo só** (`<input type="date">`), então ou vem completa ou
 * não vem. O modelo continua aceitando aniversário sem ano — é o que permite mostrar "15 de
 * agosto" sem inventar idade —, mas quem preenche pela tela sempre informa o ano.
 */
export function readBirthday(raw: RawPersonFields): Birthday | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.birthDate.trim());
  if (!match) return null;

  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

export function checkPersonFields(raw: RawPersonFields, today: Date = new Date()): PersonStatus {
  const birthday = readBirthday(raw);
  // Campo pela metade (o navegador devolve vazio) não é erro; data impossível ou futura é.
  const invalidBirthday =
    birthday !== null ? !isValidBirthday(birthday, today) : raw.birthDate.trim() !== "";

  return {
    canSubmit: raw.name.trim() !== "" && !invalidBirthday,
    invalidBirthday,
  };
}

export function parsePersonFields(
  raw: RawPersonFields,
  today: Date = new Date(),
): PersonFormValues | null {
  if (!checkPersonFields(raw, today).canSubmit) return null;

  const maritalStatus = oneOf(MARITAL_STATUSES, raw.maritalStatus, "nao_informado");

  return {
    name: raw.name.trim(),
    nickname: raw.nickname.trim() === "" ? null : raw.nickname.trim(),
    birthday: readBirthday(raw),
    gender: oneOf(GENDERS, raw.gender, "nao_informado"),
    maritalStatus,
    // Espelha a regra do serviço: estado civil que não comporta a data não a envia.
    marriedAt: acceptsMarriageDate(maritalStatus) && raw.marriedAt !== "" ? raw.marriedAt : null,
    relationType: oneOf(RELATION_TYPES, raw.relationType, "outro"),
    lifeAreaId: raw.lifeAreaId || null,
    notes: raw.notes.trim() === "" ? null : raw.notes.trim(),
  };
}
