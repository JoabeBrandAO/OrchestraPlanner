import {
  TITLE_MAX_LENGTH,
  validateTitle,
  type TitleValidation,
} from "@/server/services/shared/validate-title";

/**
 * Título de meta (US-1.1) — a regra é a genérica de `shared/validate-title`.
 * Estes aliases mantêm o vocabulário do domínio de Metas nos call sites existentes.
 */

/** Tamanho máximo do título de uma meta (regra de domínio compartilhada). */
export const GOAL_TITLE_MAX_LENGTH = TITLE_MAX_LENGTH;

export type GoalTitleValidation = TitleValidation;

export const validateGoalTitle = validateTitle;
