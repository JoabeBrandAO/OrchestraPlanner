import { lifeDimension } from "@/server/db/schema";

export type LifeDimension = (typeof lifeDimension.enumValues)[number];

export type DefaultLifeArea = { dimension: LifeDimension; name: string };

/**
 * Áreas de Vida padrão (Roda da Vida do *Planner Líder de Impacto* — Visão §4).
 * Seedadas para todo usuário novo; depois são editáveis/removíveis. A ordem define
 * a `position` inicial.
 */
export const DEFAULT_LIFE_AREAS: readonly DefaultLifeArea[] = [
  { dimension: "espirito", name: "Vida Espiritual" },
  { dimension: "espirito", name: "Contribuição / Impacto Social" },
  { dimension: "corpo", name: "Saúde & Disposição Física" },
  { dimension: "corpo", name: "Lazer & Descanso" },
  { dimension: "alma", name: "Crescimento Pessoal & Intelectual" },
  { dimension: "alma", name: "Vida Emocional" },
  { dimension: "alma", name: "Felicidade" },
  { dimension: "alma", name: "Carreira & Propósito" },
  { dimension: "alma", name: "Finanças" },
  { dimension: "alma", name: "Família" },
  { dimension: "alma", name: "Relacionamento Conjugal" },
  { dimension: "alma", name: "Vida Social" },
];
