import { describe, expect, it } from "vitest";

import { canTransition } from "./goal-status";

// Unit puro (sem DB) — roda também no CI. Cobre a máquina de estados de US-1.4.
describe("canTransition (máquina de status de metas)", () => {
  it("permite as transições válidas", () => {
    expect(canTransition("ativa", "pausada")).toBe(true);
    expect(canTransition("ativa", "completada")).toBe(true);
    expect(canTransition("pausada", "ativa")).toBe(true);
    expect(canTransition("pausada", "completada")).toBe(true);
    expect(canTransition("completada", "ativa")).toBe(true);
  });

  it("rejeita transições inválidas", () => {
    expect(canTransition("completada", "pausada")).toBe(false);
  });

  it("rejeita transição para o mesmo status (no-op)", () => {
    expect(canTransition("ativa", "ativa")).toBe(false);
    expect(canTransition("completada", "completada")).toBe(false);
  });
});
