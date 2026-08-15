/**
 * Vocabulário do cadastro de pessoas (#41) — valores e rótulos, **sem import de `db/`**,
 * porque a tela também os usa e puxar o serviço arrastaria o driver `postgres` para o
 * bundle do client (ver `docs/ERROS.md` 2026-08-11).
 *
 * Os valores repetem os enums do Postgres de propósito: um `as const` aqui e um `pgEnum`
 * lá é a única duplicação, e ela é conferida pelo TypeScript no serviço.
 */

export const GENDERS = ["feminino", "masculino", "outro", "nao_informado"] as const;
export type GenderValue = (typeof GENDERS)[number];

export const GENDER_LABELS: Record<GenderValue, string> = {
  feminino: "Feminino",
  masculino: "Masculino",
  outro: "Outro",
  nao_informado: "Não informado",
};

export const MARITAL_STATUSES = [
  "solteiro",
  "casado",
  "uniao_estavel",
  "divorciado",
  "viuvo",
  "nao_informado",
] as const;
export type MaritalStatusValue = (typeof MARITAL_STATUSES)[number];

export const MARITAL_STATUS_LABELS: Record<MaritalStatusValue, string> = {
  solteiro: "Solteiro(a)",
  casado: "Casado(a)",
  uniao_estavel: "União estável",
  divorciado: "Divorciado(a)",
  viuvo: "Viúvo(a)",
  nao_informado: "Não informado",
};

/** Estados civis que comportam data de casamento (decisão #25). */
export const MARRIED_STATUSES: readonly MaritalStatusValue[] = ["casado", "uniao_estavel"];

export function acceptsMarriageDate(status: MaritalStatusValue): boolean {
  return MARRIED_STATUSES.includes(status);
}

export const RELATION_TYPES = [
  "familia",
  "conjuge",
  "amigo",
  "mentor",
  "colega",
  "irmao_fe",
  "outro",
] as const;
export type RelationTypeValue = (typeof RELATION_TYPES)[number];

export const RELATION_TYPE_LABELS: Record<RelationTypeValue, string> = {
  familia: "Família",
  conjuge: "Cônjuge",
  amigo: "Amigo(a)",
  mentor: "Mentor(a)",
  colega: "Colega",
  irmao_fe: "Irmão(ã) de fé",
  outro: "Outro",
};

export const CONTACT_KINDS = ["telefone", "email", "social", "endereco"] as const;
export type ContactKindValue = (typeof CONTACT_KINDS)[number];

export const CONTACT_KIND_LABELS: Record<ContactKindValue, string> = {
  telefone: "Telefone",
  email: "E-mail",
  social: "Rede social",
  endereco: "Endereço",
};

export const MONTH_LABELS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;
