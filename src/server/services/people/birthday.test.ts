import { describe, expect, it } from "vitest";

import { ageOn, isValidBirthday, nextBirthday, type Birthday } from "./birthday";

/**
 * Aniversários (#41) — regra pura, sem banco. Aqui moram as duas decisões chatas: o ano
 * pode não existir, e o 29 de fevereiro não existe todo ano.
 */

const local = (year: number, month: number, day: number) => new Date(year, month - 1, day);
const iso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const aniversario = (day: number, month: number, year: number | null = null): Birthday => ({
  day,
  month,
  year,
});

describe("isValidBirthday", () => {
  it("aceita uma data comum", () => {
    expect(isValidBirthday(aniversario(15, 8, 1990))).toBe(true);
  });

  it("aceita dia e mês sem ano — nem todo mundo sabe o ano", () => {
    expect(isValidBirthday(aniversario(15, 8))).toBe(true);
  });

  it("recusa dia que não existe no mês", () => {
    expect(isValidBirthday(aniversario(31, 4))).toBe(false);
    expect(isValidBirthday(aniversario(30, 2))).toBe(false);
    expect(isValidBirthday(aniversario(0, 8))).toBe(false);
    expect(isValidBirthday(aniversario(15, 13))).toBe(false);
  });

  it("aceita 29 de fevereiro sem ano — é um dia real, só não todo ano", () => {
    expect(isValidBirthday(aniversario(29, 2))).toBe(true);
  });

  it("com ano, 29 de fevereiro só vale em ano bissexto", () => {
    expect(isValidBirthday(aniversario(29, 2, 2000))).toBe(true);
    expect(isValidBirthday(aniversario(29, 2, 1900))).toBe(false);
    expect(isValidBirthday(aniversario(29, 2, 1999))).toBe(false);
  });

  it("recusa ano abaixo do piso — dedo errado no teclado vira dado ruim", () => {
    expect(isValidBirthday(aniversario(15, 8, 1800))).toBe(false);
  });

  it("recusa nascer no futuro", () => {
    // O `max` do campo já barra na tela, mas quem decide é o domínio.
    const hoje = local(2026, 8, 15);
    expect(isValidBirthday(aniversario(16, 8, 2026), hoje)).toBe(false);
    expect(isValidBirthday(aniversario(15, 8, 2027), hoje)).toBe(false);
    expect(isValidBirthday(aniversario(15, 8, 3000), hoje)).toBe(false);
  });

  it("nascer hoje é válido — recém-nascido tem data de nascimento", () => {
    const hoje = local(2026, 8, 15);
    expect(isValidBirthday(aniversario(15, 8, 2026), hoje)).toBe(true);
  });

  it("sem ano não há futuro possível — dia e mês são cíclicos", () => {
    const hoje = local(2026, 8, 15);
    expect(isValidBirthday(aniversario(31, 12), hoje)).toBe(true);
  });
});

describe("nextBirthday", () => {
  const hoje = local(2026, 8, 15);

  it("ainda este ano quando a data não passou", () => {
    expect(iso(nextBirthday(aniversario(20, 8), hoje))).toBe("2026-08-20");
  });

  it("no ano que vem quando a data já passou", () => {
    expect(iso(nextBirthday(aniversario(10, 8), hoje))).toBe("2027-08-10");
  });

  it("hoje conta como o próximo — o dia é hoje, não daqui a um ano", () => {
    expect(iso(nextBirthday(aniversario(15, 8), hoje))).toBe("2026-08-15");
  });

  it("29 de fevereiro cai em 28/02 nos anos que não o têm", () => {
    // Continua em fevereiro, o mês em que a pessoa nasceu — pular três anos seria pior.
    expect(iso(nextBirthday(aniversario(29, 2), local(2026, 1, 1)))).toBe("2026-02-28");
    expect(iso(nextBirthday(aniversario(29, 2), local(2028, 1, 1)))).toBe("2028-02-29");
  });

  it("atravessa a virada do ano", () => {
    expect(iso(nextBirthday(aniversario(2, 1), local(2026, 12, 30)))).toBe("2027-01-02");
  });

  it("devolve o dia à meia-noite, pronto para virar janela de agenda", () => {
    expect(nextBirthday(aniversario(20, 8), hoje).getHours()).toBe(0);
  });
});

describe("ageOn", () => {
  it("conta os anos completos", () => {
    expect(ageOn(aniversario(15, 8, 1990), local(2026, 8, 15))).toBe(36);
    expect(ageOn(aniversario(16, 8, 1990), local(2026, 8, 15))).toBe(35);
  });

  it("sem ano, não inventa idade", () => {
    // Melhor não mostrar do que mostrar errado.
    expect(ageOn(aniversario(15, 8), local(2026, 8, 15))).toBeNull();
  });

  it("quem nasceu em 29/02 faz aniversário em 28/02 nos anos comuns", () => {
    expect(ageOn(aniversario(29, 2, 2000), local(2026, 2, 28))).toBe(26);
    expect(ageOn(aniversario(29, 2, 2000), local(2026, 2, 27))).toBe(25);
  });
});
