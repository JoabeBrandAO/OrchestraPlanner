import { describe, expect, it } from "vitest";

import { wrapLabel } from "./wrap-label";

describe("wrapLabel", () => {
  it("nome curto fica numa linha só", () => {
    expect(wrapLabel("Felicidade", 15, 3)).toEqual(["Felicidade"]);
    expect(wrapLabel("Vida Espiritual", 15, 3)).toEqual(["Vida Espiritual"]);
  });

  it("quebra por palavra, sem passar do limite", () => {
    expect(wrapLabel("Crescimento Pessoal & Intelectual", 15, 3)).toEqual([
      "Crescimento",
      "Pessoal &",
      "Intelectual",
    ]);
    expect(wrapLabel("Saúde & Disposição Física", 15, 3)).toEqual([
      "Saúde &",
      "Disposição",
      "Física",
    ]);
  });

  it("o que não cabe nas linhas permitidas termina em reticências", () => {
    const lines = wrapLabel("Um nome de área muito comprido mesmo de verdade", 15, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1]!.endsWith("…")).toBe(true);
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(15);
  });

  it("palavra maior que a linha é cortada com reticências", () => {
    expect(wrapLabel("Desenvolvimentointerpessoal", 15, 3)).toEqual(["Desenvolviment…"]);
  });
});
