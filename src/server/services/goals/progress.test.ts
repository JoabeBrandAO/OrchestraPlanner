import { describe, expect, it } from "vitest";

import { computeProgress } from "./progress";

/** Regra pura do progresso (#15) — sem banco, roda no CI. */

const done = () => ({ completedAt: new Date() });
const todo = () => ({ completedAt: null });

describe("computeProgress", () => {
  it("sem marcos, progresso é 0", () => {
    expect(computeProgress([])).toBe(0);
  });

  it("nada concluído é 0; tudo concluído é 100", () => {
    expect(computeProgress([todo(), todo(), todo()])).toBe(0);
    expect(computeProgress([done(), done()])).toBe(100);
  });

  it("arredonda a fração concluída", () => {
    expect(computeProgress([done(), todo()])).toBe(50);
    expect(computeProgress([done(), todo(), todo()])).toBe(33);
    expect(computeProgress([done(), done(), todo()])).toBe(67);
  });

  it("não mostra 0 com algo feito nem 100 com algo pendente", () => {
    const many = (count: number, factory: () => { completedAt: Date | null }) =>
      Array.from({ length: count }, factory);

    expect(computeProgress([...many(1, done), ...many(199, todo)])).toBe(1);
    expect(computeProgress([...many(199, done), ...many(1, todo)])).toBe(99);
  });
});
