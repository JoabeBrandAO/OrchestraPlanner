import { describe, expect, it } from "vitest";

import { GOAL_TITLE_MAX_LENGTH, validateGoalTitle } from "./validate-goal-title";

describe("validateGoalTitle", () => {
  it("aceita um título válido e faz trim", () => {
    expect(validateGoalTitle("  Correr 5km  ")).toEqual({ ok: true, value: "Correr 5km" });
  });

  it("rejeita título vazio", () => {
    expect(validateGoalTitle("")).toEqual({ ok: false, error: "O título é obrigatório." });
  });

  it("rejeita título só com espaços", () => {
    expect(validateGoalTitle("   ")).toEqual({ ok: false, error: "O título é obrigatório." });
  });

  it("rejeita título acima do limite", () => {
    const result = validateGoalTitle("a".repeat(GOAL_TITLE_MAX_LENGTH + 1));
    expect(result.ok).toBe(false);
  });

  it("aceita título exatamente no limite", () => {
    const result = validateGoalTitle("a".repeat(GOAL_TITLE_MAX_LENGTH));
    expect(result.ok).toBe(true);
  });
});
