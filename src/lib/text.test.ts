import { describe, expect, it } from "vitest";

import { capitalizeFirst } from "./text";

describe("capitalizeFirst", () => {
  it("põe maiúscula só na primeira letra, como se escreve data em português", () => {
    expect(capitalizeFirst("outubro de 2026")).toBe("Outubro de 2026");
    expect(capitalizeFirst("segunda-feira, 05 de out.")).toBe("Segunda-feira, 05 de out.");
  });

  it("não mexe no que já começa com número, maiúscula ou nada", () => {
    expect(capitalizeFirst("05 de out.")).toBe("05 de out.");
    expect(capitalizeFirst("Hoje")).toBe("Hoje");
    expect(capitalizeFirst("")).toBe("");
  });

  it("acerta letra acentuada", () => {
    expect(capitalizeFirst("águas de março")).toBe("Águas de março");
  });
});
