/**
 * Regras puras da Roda da Vida (#17): faixa da nota, média, sugestão de foco e a
 * geometria do radar. Sem banco e sem import de `db/schema` — o mesmo módulo serve o
 * serviço e o componente do gráfico (ver `docs/FORMATACAO.md`).
 */

export const SCORE_MIN = 0;
export const SCORE_MAX = 10;

export type WheelScore = {
  lifeAreaId: string;
  score: number;
};

export type ScoreValidation = { ok: true; value: number } | { ok: false; error: string };

/** Nota válida = inteiro de 0 a 10. Meias-notas complicariam o radar sem ganho real. */
export function validateScore(input: number): ScoreValidation {
  if (!Number.isInteger(input)) {
    return { ok: false, error: "A nota deve ser um número inteiro." };
  }
  if (input < SCORE_MIN || input > SCORE_MAX) {
    return { ok: false, error: `A nota deve estar entre ${SCORE_MIN} e ${SCORE_MAX}.` };
  }
  return { ok: true, value: input };
}

/** Média da roda, com uma casa decimal — o "termômetro" da rodada. */
export function wheelAverage(scores: readonly { score: number }[]): number {
  if (scores.length === 0) return 0;
  const total = scores.reduce((sum, entry) => sum + entry.score, 0);
  return Math.round((total / scores.length) * 10) / 10;
}

/**
 * Áreas sugeridas para virar meta: as de **menor nota**. Empate desempata pela ordem
 * recebida (que é a ordem das áreas do usuário), para a sugestão não dançar a cada
 * chamada. Nota máxima nunca é sugerida — não há o que melhorar ali.
 */
export function suggestFocusAreas<T extends { score: number }>(
  scores: readonly T[],
  limit = 3,
): T[] {
  return scores
    .filter((entry) => entry.score < SCORE_MAX)
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => a.entry.score - b.entry.score || a.index - b.index)
    .slice(0, limit)
    .map((item) => item.entry);
}

export type RadarPoint = { x: number; y: number };

/**
 * Vértices do polígono do radar: um por área, distribuídos no círculo, com o raio
 * proporcional à nota. Começa no topo (−90°) e segue no sentido horário, que é como
 * a roda é desenhada no planner de papel.
 */
export function radarPoints(
  values: readonly number[],
  options: { radius: number; center: number; max?: number },
): RadarPoint[] {
  const max = options.max ?? SCORE_MAX;
  const step = (Math.PI * 2) / Math.max(1, values.length);

  return values.map((value, index) => {
    const ratio = max === 0 ? 0 : Math.min(1, Math.max(0, value / max));
    const angle = -Math.PI / 2 + index * step;
    return {
      x: options.center + Math.cos(angle) * options.radius * ratio,
      y: options.center + Math.sin(angle) * options.radius * ratio,
    };
  });
}

/** Os vértices como o atributo `points` de um `<polygon>` do SVG. */
export function toPolygonPoints(points: readonly RadarPoint[]): string {
  return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
}
