import { describe, expect, it } from "vitest";

import { byMostForgotten, daysSinceContact, describeGap } from "./contact-gap";

/** "Há quanto tempo não falo com X" (#43) — puro, com "hoje" injetável. */

const hoje = new Date(2026, 7, 15); // 15 de agosto de 2026

describe("daysSinceContact", () => {
  it("conta os dias completos desde o último contato", () => {
    expect(daysSinceContact("2026-08-10", hoje)).toBe(5);
    expect(daysSinceContact("2026-08-15", hoje)).toBe(0);
  });

  it("nunca ter falado é `null`, não zero", () => {
    // Quem nunca foi procurado não é a mesma coisa que quem foi procurado hoje.
    expect(daysSinceContact(null, hoje)).toBeNull();
  });

  it("atravessa meses e anos", () => {
    expect(daysSinceContact("2026-07-15", hoje)).toBe(31);
    expect(daysSinceContact("2025-08-15", hoje)).toBe(365);
  });

  it("data no futuro não vira número negativo", () => {
    expect(daysSinceContact("2026-09-01", hoje)).toBe(0);
  });

  it("string que não é data não quebra a lista", () => {
    expect(daysSinceContact("qualquer coisa", hoje)).toBeNull();
  });
});

describe("describeGap", () => {
  it("fala como gente fala", () => {
    expect(describeGap("2026-08-15", hoje)).toBe("falaram hoje");
    expect(describeGap("2026-08-14", hoje)).toBe("falaram ontem");
    expect(describeGap("2026-08-10", hoje)).toBe("há 5 dias");
  });

  it("passa a contar em meses e anos quando o silêncio cresce", () => {
    expect(describeGap("2026-07-01", hoje)).toBe("há mais de um mês");
    expect(describeGap("2026-02-01", hoje)).toBe("há 6 meses");
    expect(describeGap("2024-08-15", hoje)).toBe("há 2 anos");
  });

  it("quem nunca teve contato registrado aparece como tal", () => {
    expect(describeGap(null, hoje)).toBe("sem contato registrado");
  });
});

describe("byMostForgotten", () => {
  const pessoa = (name: string, lastInteractionAt: string | null) => ({ name, lastInteractionAt });

  it("põe primeiro quem nunca foi procurado", () => {
    // Mandá-lo para o fim esconderia justamente o problema que o módulo resolve.
    const lista = [
      pessoa("Recente", "2026-08-14"),
      pessoa("Nunca", null),
      pessoa("Antigo", "2025-01-01"),
    ].sort(byMostForgotten);

    expect(lista.map((p) => p.name)).toEqual(["Nunca", "Antigo", "Recente"]);
  });

  it("entre quem tem contato, o mais antigo vem antes", () => {
    const lista = [pessoa("B", "2026-08-01"), pessoa("A", "2026-01-01")].sort(byMostForgotten);
    expect(lista.map((p) => p.name)).toEqual(["A", "B"]);
  });
});
