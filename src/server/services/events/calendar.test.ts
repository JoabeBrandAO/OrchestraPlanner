import { describe, expect, it } from "vitest";

import {
  addDays,
  addMonths,
  isSameDay,
  monthGrid,
  monthRange,
  startOfMonth,
  startOfWeek,
  weekRange,
} from "./calendar";

/** Grade do calendário (#33) — matemática pura no calendário local, sem banco. */

/** Data local (o construtor com números não interpreta fuso). */
const local = (year: number, month: number, day: number, hour = 0) =>
  new Date(year, month - 1, day, hour);

const iso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

describe("startOfWeek", () => {
  it("volta para a segunda-feira da semana", () => {
    // 2026-08-15 é um sábado; a segunda dessa semana é 10.
    expect(iso(startOfWeek(local(2026, 8, 15)))).toBe("2026-08-10");
  });

  it("trata domingo como fim da semana, não como começo", () => {
    // O erro clássico do `getDay()`: domingo (0) pertence à semana que começou na segunda.
    expect(iso(startOfWeek(local(2026, 8, 16)))).toBe("2026-08-10");
  });

  it("na própria segunda devolve o mesmo dia à meia-noite", () => {
    const result = startOfWeek(local(2026, 8, 10, 23));
    expect(iso(result)).toBe("2026-08-10");
    expect(result.getHours()).toBe(0);
  });

  it("não altera a data recebida", () => {
    const original = local(2026, 8, 15, 13);
    startOfWeek(original);
    expect(original.getDate()).toBe(15);
    expect(original.getHours()).toBe(13);
  });
});

describe("addDays", () => {
  it("atravessa a virada do mês", () => {
    expect(iso(addDays(local(2026, 8, 31), 1))).toBe("2026-09-01");
  });

  it("anda para trás", () => {
    expect(iso(addDays(local(2026, 1, 1), -1))).toBe("2025-12-31");
  });
});

describe("startOfMonth", () => {
  it("devolve o dia 1 à meia-noite", () => {
    const result = startOfMonth(local(2026, 8, 15, 18));
    expect(iso(result)).toBe("2026-08-01");
    expect(result.getHours()).toBe(0);
  });
});

describe("monthGrid", () => {
  it("cobre semanas inteiras, sempre começando na segunda", () => {
    const grid = monthGrid(local(2026, 8, 15));
    expect(grid.length % 7).toBe(0);
    expect(grid[0]!.date.getDay()).toBe(1);
    expect(grid.at(-1)!.date.getDay()).toBe(0);
  });

  it("contém todos os dias do mês exatamente uma vez", () => {
    const grid = monthGrid(local(2026, 8, 15));
    const doMes = grid.filter((day) => day.inMonth).map((day) => iso(day.date));
    expect(doMes).toHaveLength(31);
    expect(new Set(doMes).size).toBe(31);
    expect(doMes[0]).toBe("2026-08-01");
    expect(doMes.at(-1)).toBe("2026-08-31");
  });

  it("marca como de fora os dias emprestados dos meses vizinhos", () => {
    // Agosto de 2026 começa num sábado: a grade abre em 27/07 e fecha em 06/09.
    const grid = monthGrid(local(2026, 8, 15));
    expect(iso(grid[0]!.date)).toBe("2026-07-27");
    expect(grid[0]!.inMonth).toBe(false);
    expect(iso(grid.at(-1)!.date)).toBe("2026-09-06");
    expect(grid.at(-1)!.inMonth).toBe(false);
  });

  it("usa 6 semanas quando o mês não cabe em 5", () => {
    // Agosto de 2026 começa num sábado: 5 dias emprestados + 31 = 36, que não cabem em 35.
    expect(monthGrid(local(2026, 8, 15))).toHaveLength(42);
    // Maio de 2026 começa numa sexta: 4 + 31 = 35, exatamente 5 linhas.
    expect(monthGrid(local(2026, 5, 10))).toHaveLength(35);
  });

  it("usa 4 semanas quando fevereiro começa numa segunda", () => {
    // Fevereiro de 2027 começa numa segunda e tem 28 dias: a grade fecha exata.
    const grid = monthGrid(local(2027, 2, 10));
    expect(grid).toHaveLength(28);
    expect(grid.every((day) => day.inMonth)).toBe(true);
  });

  it("inclui o 29 de fevereiro num ano bissexto", () => {
    const doMes = monthGrid(local(2028, 2, 1)).filter((day) => day.inMonth);
    expect(doMes).toHaveLength(29);
    expect(iso(doMes.at(-1)!.date)).toBe("2028-02-29");
  });

  it("é contínua: cada dia é o seguinte do anterior", () => {
    const grid = monthGrid(local(2026, 5, 10));
    for (let index = 1; index < grid.length; index += 1) {
      expect(iso(grid[index]!.date)).toBe(iso(addDays(grid[index - 1]!.date, 1)));
    }
  });

  it("dá dias à meia-noite, prontos para virar janela de consulta", () => {
    expect(monthGrid(local(2026, 8, 15, 22)).every((day) => day.date.getHours() === 0)).toBe(true);
  });
});

describe("addMonths", () => {
  it("anda para o mês vizinho ancorado no dia 1", () => {
    // O clássico "31 de janeiro + 1 mês = 3 de março" não pode acontecer na navegação.
    expect(iso(addMonths(local(2026, 1, 31), 1))).toBe("2026-02-01");
  });

  it("atravessa a virada do ano nos dois sentidos", () => {
    expect(iso(addMonths(local(2026, 12, 15), 1))).toBe("2027-01-01");
    expect(iso(addMonths(local(2026, 1, 15), -1))).toBe("2025-12-01");
  });
});

describe("weekRange / monthRange", () => {
  it("a semana é de segunda a segunda, com fim exclusivo", () => {
    const range = weekRange(local(2026, 8, 15));
    expect(iso(range.from)).toBe("2026-08-10");
    expect(iso(range.to)).toBe("2026-08-17");
  });

  it("o mês cobre a grade inteira, incluindo os dias emprestados", () => {
    const range = monthRange(local(2026, 8, 15));
    expect(iso(range.from)).toBe("2026-07-27");
    // Fim exclusivo: o dia seguinte ao último da grade (06/09).
    expect(iso(range.to)).toBe("2026-09-07");
  });

  it("cabe no teto de um ano do router", () => {
    const range = monthRange(local(2026, 8, 15));
    const days = (range.to.getTime() - range.from.getTime()) / (24 * 60 * 60 * 1000);
    expect(days).toBeLessThanOrEqual(42);
  });
});

describe("isSameDay", () => {
  it("ignora a hora", () => {
    expect(isSameDay(local(2026, 8, 15, 1), local(2026, 8, 15, 23))).toBe(true);
  });

  it("distingue o mesmo dia de meses ou anos diferentes", () => {
    expect(isSameDay(local(2026, 8, 15), local(2026, 9, 15))).toBe(false);
    expect(isSameDay(local(2026, 8, 15), local(2025, 8, 15))).toBe(false);
  });
});
