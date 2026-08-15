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
  birthDay: string;
  birthMonth: string;
  birthYear: string;
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

/**
 * O aniversário só existe com **dia e mês**; o ano é opcional. Dia sem mês (ou o contrário)
 * é um preenchimento pela metade — não vira data nem erro, só ainda não é aniversário.
 */
export function readBirthday(raw: RawPersonFields): Birthday | null {
  const day = Number(raw.birthDay);
  const month = Number(raw.birthMonth);
  if (!day || !month) return null;

  const year = raw.birthYear.trim() === "" ? null : Number(raw.birthYear);
  return { day, month, year };
}

export function checkPersonFields(raw: RawPersonFields): PersonStatus {
  const birthday = readBirthday(raw);
  const invalidBirthday = birthday !== null && !isValidBirthday(birthday);

  return {
    canSubmit: raw.name.trim() !== "" && !invalidBirthday,
    invalidBirthday,
  };
}

export function parsePersonFields(raw: RawPersonFields): PersonFormValues | null {
  if (!checkPersonFields(raw).canSubmit) return null;

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
