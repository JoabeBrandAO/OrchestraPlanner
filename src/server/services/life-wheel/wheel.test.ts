import { describe, expect, it } from "vitest";

import { radarPoints, suggestFocusAreas, validateScore, wheelAverage } from "./wheel";

/** Regras puras da Roda da Vida (#17) — sem banco, rodam no CI. */

describe("validateScore", () => {
  it("aceita inteiros de 0 a 10", () => {
    expect(validateScore(0)).toEqual({ ok: true, value: 0 });
    expect(validateScore(10)).toEqual({ ok: true, value: 10 });
  });

  it("rejeita fora da faixa e não inteiros", () => {
    expect(validateScore(-1).ok).toBe(false);
    expect(validateScore(11).ok).toBe(false);
    expect(validateScore(7.5).ok).toBe(false);
    expect(validateScore(Number.NaN).ok).toBe(false);
  });
});

describe("wheelAverage", () => {
  it("média com uma casa decimal; roda vazia é 0", () => {
    expect(wheelAverage([{ score: 8 }, { score: 6 }])).toBe(7);
    expect(wheelAverage([{ score: 8 }, { score: 7 }, { score: 5 }])).toBe(6.7);
    expect(wheelAverage([])).toBe(0);
  });
});

describe("suggestFocusAreas", () => {
  const scores = [
    { lifeAreaId: "a", score: 9 },
    { lifeAreaId: "b", score: 3 },
    { lifeAreaId: "c", score: 3 },
    { lifeAreaId: "d", score: 5 },
    { lifeAreaId: "e", score: 10 },
  ];

  it("sugere as menores notas, respeitando o limite", () => {
    expect(suggestFocusAreas(scores, 2).map((entry) => entry.lifeAreaId)).toEqual(["b", "c"]);
    expect(suggestFocusAreas(scores).map((entry) => entry.lifeAreaId)).toEqual(["b", "c", "d"]);
  });

  it("empate mantém a ordem recebida (sugestão estável)", () => {
    const first = suggestFocusAreas(scores, 3).map((entry) => entry.lifeAreaId);
    expect(suggestFocusAreas(scores, 3).map((entry) => entry.lifeAreaId)).toEqual(first);
  });

  it("nota máxima não é sugerida", () => {
    expect(suggestFocusAreas([{ lifeAreaId: "e", score: 10 }])).toEqual([]);
  });
});

describe("radarPoints", () => {
  const options = { radius: 100, center: 100 };

  it("nota máxima no topo vai para a borda de cima", () => {
    const [top] = radarPoints([10], options);
    expect(top!.x).toBeCloseTo(100);
    expect(top!.y).toBeCloseTo(0);
  });

  it("nota zero fica no centro", () => {
    const [origin] = radarPoints([0], options);
    expect(origin).toEqual({ x: 100, y: 100 });
  });

  it("distribui as áreas pelo círculo e escala pela nota", () => {
    const points = radarPoints([10, 10, 10, 10], options);
    expect(points.map((point) => [Math.round(point.x), Math.round(point.y)])).toEqual([
      [100, 0],
      [200, 100],
      [100, 200],
      [0, 100],
    ]);

    const [half] = radarPoints([5], options);
    expect(half!.y).toBeCloseTo(50);
  });
});
