/** Tamanho máximo do título de uma meta (regra de domínio compartilhada). */
export const GOAL_TITLE_MAX_LENGTH = 120;

export type GoalTitleValidation = { ok: true; value: string } | { ok: false; error: string };

/**
 * Valida e normaliza o título de uma meta (US-1.1). Pura e sem dependências —
 * reutilizável no client (form) e no server (tRPC). Faz trim e checa vazio/limite.
 */
export function validateGoalTitle(input: string): GoalTitleValidation {
  const value = input.trim();

  if (value.length === 0) {
    return { ok: false, error: "O título é obrigatório." };
  }
  if (value.length > GOAL_TITLE_MAX_LENGTH) {
    return {
      ok: false,
      error: `O título deve ter no máximo ${GOAL_TITLE_MAX_LENGTH} caracteres.`,
    };
  }

  return { ok: true, value };
}
