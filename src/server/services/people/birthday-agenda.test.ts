import { describe, expect, it } from "vitest";

import { birthdayReminderAt, birthdaysInRange, type BirthdayPerson } from "./birthday-agenda";

/** Aniversários na Agenda (#44) — puro, derivado da data em `people`. */

const local = (year: number, month: number, day: number) => new Date(year, month - 1, day);
const iso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const pessoa = (
  id: string,
  name: string,
  day: number,
  month: number,
  year: number | null = null,
): BirthdayPerson => ({ id, name, birthday: { day, month, year } });

/** Semana de 10 a 17 de agosto de 2026 (fim exclusivo). */
const semana = { from: local(2026, 8, 10), to: local(2026, 8, 17) };

describe("birthdaysInRange", () => {
  it("acha quem faz aniversário na janela", () => {
    const result = birthdaysInRange([pessoa("p1", "Ana", 15, 8, 1990)], semana);

    expect(result).toHaveLength(1);
    expect(iso(result[0]!.date)).toBe("2026-08-15");
    expect(result[0]!.turningAge).toBe(36);
  });

  it("ignora quem faz fora dela", () => {
    expect(birthdaysInRange([pessoa("p1", "Ana", 20, 8)], semana)).toEqual([]);
  });

  it("o fim é exclusivo, como no resto da agenda", () => {
    expect(birthdaysInRange([pessoa("p1", "Ana", 10, 8)], semana)).toHaveLength(1);
    expect(birthdaysInRange([pessoa("p1", "Ana", 17, 8)], semana)).toEqual([]);
  });

  it("aparece todo ano — é derivado, não uma linha marcada uma vez", () => {
    const daquiADoisAnos = { from: local(2028, 8, 1), to: local(2028, 9, 1) };
    expect(birthdaysInRange([pessoa("p1", "Ana", 15, 8, 1990)], daquiADoisAnos)).toHaveLength(1);
  });

  it("sem ano de nascimento, aparece sem idade — nunca com idade errada", () => {
    const [aniversario] = birthdaysInRange([pessoa("p1", "Ana", 15, 8)], semana);
    expect(aniversario!.turningAge).toBeNull();
  });

  it("atravessa a virada do ano", () => {
    const virada = { from: local(2026, 12, 28), to: local(2027, 1, 4) };
    const result = birthdaysInRange(
      [pessoa("p1", "Ana", 31, 12), pessoa("p2", "Bruno", 2, 1)],
      virada,
    );

    expect(result.map((o) => iso(o.date))).toEqual(["2026-12-31", "2027-01-02"]);
  });

  it("quem nasceu em 29/02 aparece em 28/02 nos anos comuns", () => {
    const fevereiro = { from: local(2026, 2, 1), to: local(2026, 3, 1) };
    const [aniversario] = birthdaysInRange([pessoa("p1", "Ana", 29, 2, 2000)], fevereiro);
    expect(iso(aniversario!.date)).toBe("2026-02-28");
  });

  it("ordena por data e desempata pelo nome", () => {
    const result = birthdaysInRange(
      [pessoa("p2", "Bruno", 15, 8), pessoa("p1", "Ana", 15, 8), pessoa("p3", "Carla", 12, 8)],
      semana,
    );

    expect(result.map((o) => o.name)).toEqual(["Carla", "Ana", "Bruno"]);
  });
});

describe("birthdayReminderAt", () => {
  it("dispara às 8h da manhã no fuso do Brasil", () => {
    // Aniversário é um dia, não um horário: a escolha é uma só, e é esta.
    expect(birthdayReminderAt(local(2026, 8, 15)).toISOString()).toBe("2026-08-15T11:00:00.000Z");
  });
});
