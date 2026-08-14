/**
 * Progresso de uma meta derivado dos seus marcos (#15). Regra pura, sem DB — roda no CI
 * e é a **mesma** que a UI usa para desenhar a barra, evitando dois cálculos divergentes
 * (ver `docs/FORMATACAO.md`: regra compartilhada mora em módulo próprio).
 */

/** O mínimo que o cálculo precisa de um marco: se está concluído. */
export type ProgressMilestone = { completedAt: Date | null };

/**
 * Percentual concluído (0–100, inteiro) de uma lista de marcos.
 *
 * Arredonda, mas nunca **mente nos extremos**: 0% e 100% são reservados a "nada feito"
 * e "tudo feito". Com 1 de 200 marcos o arredondamento daria 0 (parece parado) e com
 * 199 de 200 daria 100 (parece terminado) — por isso o clamp para 1 e 99.
 * Sem marcos o progresso é 0: não há do que derivar.
 */
export function computeProgress(milestones: readonly ProgressMilestone[]): number {
  const total = milestones.length;
  if (total === 0) return 0;

  const done = milestones.filter((milestone) => milestone.completedAt !== null).length;
  if (done === 0) return 0;
  if (done === total) return 100;

  return Math.min(99, Math.max(1, Math.round((done / total) * 100)));
}
