/** Tamanho máximo de um título no domínio (metas, prioridades, marcos…). */
export const TITLE_MAX_LENGTH = 120;

export type TitleValidation = { ok: true; value: string } | { ok: false; error: string };

/**
 * Valida e normaliza um título. Pura e sem dependências — reutilizável no client (form)
 * e no server (tRPC). Faz trim e checa vazio/limite.
 *
 * Nasceu como `validateGoalTitle` (US-1.1) e foi promovida aqui na Iteração 2, quando
 * Prioridades (#13) passou a precisar exatamente da mesma regra. `validate-goal-title.ts`
 * continua exportando os nomes antigos para não quebrar quem já os importa.
 */
export function validateTitle(input: string): TitleValidation {
  const value = input.trim();

  if (value.length === 0) {
    return { ok: false, error: "O título é obrigatório." };
  }
  if (value.length > TITLE_MAX_LENGTH) {
    return {
      ok: false,
      error: `O título deve ter no máximo ${TITLE_MAX_LENGTH} caracteres.`,
    };
  }

  return { ok: true, value };
}
