/**
 * Vocabulário de vínculos entre pessoas (#42) — **puro**, sem banco.
 *
 * O vínculo é gravado **uma vez só**, e não duas. Duas linhas (A→B e B→A) podem divergir:
 * basta alguém editar um lado e a mesma relação passa a dizer duas coisas. Então a leitura
 * do outro lado é **derivada**, e é por isso que cada relação precisa saber o seu inverso —
 * "B é filho de A" lido a partir de B tem que virar "A é pai/mãe de B".
 */

export const RELATIONS = [
  "conjuge",
  "pai_mae",
  "filho",
  "irmao",
  "avo",
  "neto",
  "tio",
  "sobrinho",
  "primo",
  "sogro",
  "genro_nora",
  "cunhado",
  "amigo",
  "mentor",
  "mentorado",
  "colega",
  "outro",
] as const;

export type RelationValue = (typeof RELATIONS)[number];

export const RELATION_LABELS: Record<RelationValue, string> = {
  conjuge: "cônjuge",
  pai_mae: "pai/mãe",
  filho: "filho(a)",
  irmao: "irmão(ã)",
  avo: "avô/avó",
  neto: "neto(a)",
  tio: "tio(a)",
  sobrinho: "sobrinho(a)",
  primo: "primo(a)",
  sogro: "sogro(a)",
  genro_nora: "genro/nora",
  cunhado: "cunhado(a)",
  amigo: "amigo(a)",
  mentor: "mentor(a)",
  mentorado: "mentorado(a)",
  colega: "colega",
  outro: "outro vínculo",
};

/**
 * O que a relação vira quando lida do outro lado. As simétricas (irmão, primo, cônjuge,
 * amigo, colega) são o próprio inverso — o que é uma propriedade do mundo, não um atalho.
 */
const INVERSES: Record<RelationValue, RelationValue> = {
  conjuge: "conjuge",
  pai_mae: "filho",
  filho: "pai_mae",
  irmao: "irmao",
  avo: "neto",
  neto: "avo",
  tio: "sobrinho",
  sobrinho: "tio",
  primo: "primo",
  sogro: "genro_nora",
  genro_nora: "sogro",
  cunhado: "cunhado",
  amigo: "amigo",
  mentor: "mentorado",
  mentorado: "mentor",
  colega: "colega",
  outro: "outro",
};

export function inverseOf(relation: RelationValue): RelationValue {
  return INVERSES[relation];
}

export type CanonicalLink = {
  personId: string;
  relatedPersonId: string;
  /** O que `relatedPerson` é para `person`. */
  relation: RelationValue;
};

/**
 * Ordena o par sempre do mesmo jeito para que o único `(person_id, related_person_id)`
 * impeça o espelho: sem isso, ligar A→B e depois B→A criaria as duas linhas que a
 * modelagem existe para evitar. Ao inverter o par, a relação também se inverte.
 */
export function canonicalLink(
  personId: string,
  relatedPersonId: string,
  relation: RelationValue,
): CanonicalLink {
  if (personId <= relatedPersonId) return { personId, relatedPersonId, relation };
  return {
    personId: relatedPersonId,
    relatedPersonId: personId,
    relation: inverseOf(relation),
  };
}

/** Como o vínculo aparece na ficha de `viewerId`: quem é o outro e o que ele é para mim. */
export function linkFrom(
  link: CanonicalLink,
  viewerId: string,
): { otherId: string; relation: RelationValue } {
  return link.personId === viewerId
    ? { otherId: link.relatedPersonId, relation: link.relation }
    : { otherId: link.personId, relation: inverseOf(link.relation) };
}
