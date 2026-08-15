import { describe, expect, it } from "vitest";

import {
  expandOccurrences,
  reminderAt,
  type OccurrenceException,
  type RecurrenceRule,
} from "./recurrence";

/** Expansão de recorrência (#18) — regra pura, sem banco, roda no CI. */

const utc = (iso: string) => new Date(`${iso}Z`);

const rule = (patch: Partial<RecurrenceRule> = {}): RecurrenceRule => ({
  frequency: "none",
  interval: 1,
  until: null,
  ...patch,
});

/** Semana de 2026-08-10 (segunda) a 2026-08-17 (segunda seguinte). */
const week = { from: utc("2026-08-10T00:00:00"), to: utc("2026-08-17T00:00:00") };

const starts = (occurrences: { startsAt: Date }[]) =>
  occurrences.map((o) => o.startsAt.toISOString());

describe("expandOccurrences — evento único", () => {
  it("aparece quando cai na janela", () => {
    const result = expandOccurrences(
      { startsAt: utc("2026-08-12T14:00:00"), endsAt: utc("2026-08-12T15:00:00"), rule: rule() },
      week,
    );
    expect(starts(result)).toEqual(["2026-08-12T14:00:00.000Z"]);
  });

  it("não aparece fora da janela", () => {
    const result = expandOccurrences(
      { startsAt: utc("2026-09-01T14:00:00"), endsAt: utc("2026-09-01T15:00:00"), rule: rule() },
      week,
    );
    expect(result).toEqual([]);
  });

  it("entra quando apenas atravessa a janela", () => {
    // Começa no domingo anterior e termina na segunda: quem abre a semana precisa ver.
    const result = expandOccurrences(
      { startsAt: utc("2026-08-09T22:00:00"), endsAt: utc("2026-08-10T02:00:00"), rule: rule() },
      week,
    );
    expect(result).toHaveLength(1);
  });

  it("fim exclusivo — evento que termina no início da janela fica de fora", () => {
    const result = expandOccurrences(
      { startsAt: utc("2026-08-09T22:00:00"), endsAt: utc("2026-08-10T00:00:00"), rule: rule() },
      week,
    );
    expect(result).toEqual([]);
  });
});

describe("expandOccurrences — recorrência", () => {
  const base = { startsAt: utc("2026-08-03T09:00:00"), endsAt: utc("2026-08-03T10:00:00") };

  it("diária preenche a janela e preserva a duração", () => {
    const result = expandOccurrences({ ...base, rule: rule({ frequency: "daily" }) }, week);

    expect(result).toHaveLength(7);
    expect(starts(result)[0]).toBe("2026-08-10T09:00:00.000Z");
    expect(result[0]!.endsAt.toISOString()).toBe("2026-08-10T10:00:00.000Z");
  });

  it("respeita o intervalo (de dois em dois dias)", () => {
    const result = expandOccurrences(
      { ...base, rule: rule({ frequency: "daily", interval: 2 }) },
      week,
    );
    expect(starts(result)).toEqual([
      "2026-08-11T09:00:00.000Z",
      "2026-08-13T09:00:00.000Z",
      "2026-08-15T09:00:00.000Z",
    ]);
  });

  it("semanal cai no mesmo dia da semana", () => {
    const result = expandOccurrences({ ...base, rule: rule({ frequency: "weekly" }) }, week);
    expect(starts(result)).toEqual(["2026-08-10T09:00:00.000Z"]);
  });

  it("`until` encerra a série", () => {
    const result = expandOccurrences(
      { ...base, rule: rule({ frequency: "daily", until: utc("2026-08-12T23:59:59") }) },
      week,
    );
    expect(starts(result)).toEqual([
      "2026-08-10T09:00:00.000Z",
      "2026-08-11T09:00:00.000Z",
      "2026-08-12T09:00:00.000Z",
    ]);
  });

  it("mensal pula o mês que não tem o dia, em vez de grudar no dia 28", () => {
    // "Todo dia 31": janeiro sim, fevereiro/abril não. Grudar no fim do mês seria mentir.
    const result = expandOccurrences(
      {
        startsAt: utc("2026-01-31T09:00:00"),
        endsAt: utc("2026-01-31T10:00:00"),
        rule: rule({ frequency: "monthly" }),
      },
      { from: utc("2026-01-01T00:00:00"), to: utc("2026-06-01T00:00:00") },
    );

    expect(starts(result)).toEqual([
      "2026-01-31T09:00:00.000Z",
      "2026-03-31T09:00:00.000Z",
      "2026-05-31T09:00:00.000Z",
    ]);
  });

  it("anual em 29 de fevereiro só ocorre em ano bissexto", () => {
    const result = expandOccurrences(
      {
        startsAt: utc("2024-02-29T09:00:00"),
        endsAt: utc("2024-02-29T10:00:00"),
        rule: rule({ frequency: "yearly" }),
      },
      { from: utc("2024-01-01T00:00:00"), to: utc("2029-01-01T00:00:00") },
    );

    expect(starts(result)).toEqual(["2024-02-29T09:00:00.000Z", "2028-02-29T09:00:00.000Z"]);
  });

  it("intervalo inválido não gera laço infinito — vira evento único", () => {
    const result = expandOccurrences(
      { ...base, rule: rule({ frequency: "daily", interval: 0 }) },
      week,
    );
    expect(result).toEqual([]);
  });
});

describe("reminderAt", () => {
  const occurrence = {
    startsAt: utc("2026-08-12T14:00:00"),
    endsAt: utc("2026-08-12T15:00:00"),
  };

  it("subtrai os minutos de antecedência", () => {
    expect(reminderAt(occurrence, 30)?.toISOString()).toBe("2026-08-12T13:30:00.000Z");
  });

  it("sem lembrete, não há instante", () => {
    expect(reminderAt(occurrence, null)).toBeNull();
  });
});

/**
 * Exceções numa ocorrência da série (#35). Guardar a recorrência como regra custa isto:
 * "esta terça não tem" é uma exceção à parte, aplicada na leitura.
 */
describe("expandOccurrences — exceções", () => {
  const serie = {
    startsAt: utc("2026-08-03T09:00:00"), // segunda
    endsAt: utc("2026-08-03T10:00:00"),
    rule: rule({ frequency: "weekly" }),
  };
  /** Agosto inteiro: segundas 03, 10, 17, 24 e 31. */
  const agosto = { from: utc("2026-08-01T00:00:00"), to: utc("2026-09-01T00:00:00") };

  const excecao = (
    occurrenceStartsAt: string,
    patch: Partial<OccurrenceException> = {},
  ): OccurrenceException => ({
    occurrenceStartsAt: utc(occurrenceStartsAt),
    cancelled: false,
    startsAt: null,
    endsAt: null,
    title: null,
    description: null,
    ...patch,
  });

  it("sem exceções, a série é a de sempre", () => {
    expect(expandOccurrences(serie, agosto, [])).toHaveLength(5);
  });

  it("cancelar uma ocorrência não afeta as demais", () => {
    const result = expandOccurrences(serie, agosto, [
      excecao("2026-08-17T09:00:00", { cancelled: true }),
    ]);

    expect(starts(result)).toEqual([
      "2026-08-03T09:00:00.000Z",
      "2026-08-10T09:00:00.000Z",
      "2026-08-24T09:00:00.000Z",
      "2026-08-31T09:00:00.000Z",
    ]);
  });

  it("remarcar move só aquela ocorrência, e a regra continua intacta", () => {
    const result = expandOccurrences(serie, agosto, [
      excecao("2026-08-17T09:00:00", {
        startsAt: utc("2026-08-18T14:00:00"),
        endsAt: utc("2026-08-18T15:30:00"),
      }),
    ]);

    expect(starts(result)).toEqual([
      "2026-08-03T09:00:00.000Z",
      "2026-08-10T09:00:00.000Z",
      "2026-08-18T14:00:00.000Z",
      "2026-08-24T09:00:00.000Z",
      "2026-08-31T09:00:00.000Z",
    ]);
    // A remarcada mantém a identidade original — é por ela que a exceção é encontrada.
    const remarcada = result.find(
      (o) => o.startsAt.getTime() === utc("2026-08-18T14:00:00").getTime(),
    );
    expect(remarcada!.occurrenceStartsAt.toISOString()).toBe("2026-08-17T09:00:00.000Z");
    expect(remarcada!.endsAt.toISOString()).toBe("2026-08-18T15:30:00.000Z");
  });

  it("ocorrência remarcada para fora da janela some dela", () => {
    const semana = { from: utc("2026-08-17T00:00:00"), to: utc("2026-08-24T00:00:00") };
    const result = expandOccurrences(serie, semana, [
      excecao("2026-08-17T09:00:00", {
        startsAt: utc("2026-09-01T09:00:00"),
        endsAt: utc("2026-09-01T10:00:00"),
      }),
    ]);

    expect(result).toEqual([]);
  });

  it("ocorrência remarcada para dentro da janela aparece, mesmo vindo de fora", () => {
    const semana = { from: utc("2026-08-17T00:00:00"), to: utc("2026-08-24T00:00:00") };
    const result = expandOccurrences(serie, semana, [
      // A de 31/08 (fora da janela) foi puxada para 19/08.
      excecao("2026-08-31T09:00:00", {
        startsAt: utc("2026-08-19T11:00:00"),
        endsAt: utc("2026-08-19T12:00:00"),
      }),
    ]);

    expect(starts(result)).toEqual(["2026-08-17T09:00:00.000Z", "2026-08-19T11:00:00.000Z"]);
  });

  it("sobrescreve título e descrição só daquela ocorrência", () => {
    const result = expandOccurrences(serie, agosto, [
      excecao("2026-08-10T09:00:00", { title: "Reunião estendida", description: "com o time" }),
    ]);

    const especial = result[1]!;
    expect(especial.title).toBe("Reunião estendida");
    expect(especial.description).toBe("com o time");
    expect(result[0]!.title).toBeNull();
  });

  it("exceção que não casa com nenhuma ocorrência é inerte", () => {
    // Uma terça no meio de uma série de segundas: não cancela nem cria nada.
    const result = expandOccurrences(serie, agosto, [
      excecao("2026-08-11T09:00:00", { cancelled: true }),
    ]);
    expect(result).toHaveLength(5);
  });

  it("exceção anterior ao início da série não ressuscita nada", () => {
    const result = expandOccurrences(serie, agosto, [
      excecao("2026-07-27T09:00:00", {
        startsAt: utc("2026-08-12T09:00:00"),
        endsAt: utc("2026-08-12T10:00:00"),
      }),
    ]);
    expect(result).toHaveLength(5);
  });

  it("exceção depois do fim da série não ressuscita nada", () => {
    const comFim = {
      ...serie,
      rule: rule({ frequency: "weekly", until: utc("2026-08-20T00:00:00") }),
    };
    const result = expandOccurrences(comFim, agosto, [
      excecao("2026-08-24T09:00:00", {
        startsAt: utc("2026-08-25T09:00:00"),
        endsAt: utc("2026-08-25T10:00:00"),
      }),
    ]);

    expect(starts(result)).toEqual([
      "2026-08-03T09:00:00.000Z",
      "2026-08-10T09:00:00.000Z",
      "2026-08-17T09:00:00.000Z",
    ]);
  });

  it("num evento único, exceção nenhuma tem efeito de ressuscitar", () => {
    const unico = {
      startsAt: utc("2026-08-12T09:00:00"),
      endsAt: utc("2026-08-12T10:00:00"),
      rule: rule(),
    };
    const result = expandOccurrences(unico, agosto, [
      excecao("2026-08-20T09:00:00", {
        startsAt: utc("2026-08-21T09:00:00"),
        endsAt: utc("2026-08-21T10:00:00"),
      }),
    ]);
    expect(result).toHaveLength(1);
  });

  it("cancelar o único dia de um evento sem repetição o esconde", () => {
    const unico = {
      startsAt: utc("2026-08-12T09:00:00"),
      endsAt: utc("2026-08-12T10:00:00"),
      rule: rule(),
    };
    const result = expandOccurrences(unico, agosto, [
      excecao("2026-08-12T09:00:00", { cancelled: true }),
    ]);
    expect(result).toEqual([]);
  });
});

describe("expandOccurrences — exceção órfã (sobra de uma regra antiga)", () => {
  const serie = {
    startsAt: utc("2026-08-03T09:00:00"), // segunda
    endsAt: utc("2026-08-03T10:00:00"),
    rule: rule({ frequency: "weekly" }),
  };
  const semana = { from: utc("2026-08-17T00:00:00"), to: utc("2026-08-24T00:00:00") };

  it("não ressuscita a partir de um instante que a regra não produz", () => {
    // Uma terça (2026-09-01) não é passo de uma série de segundas: mesmo remarcada para
    // dentro da janela, não vira compromisso.
    const result = expandOccurrences(serie, semana, [
      {
        occurrenceStartsAt: utc("2026-09-01T09:00:00"),
        cancelled: false,
        startsAt: utc("2026-08-19T11:00:00"),
        endsAt: utc("2026-08-19T12:00:00"),
        title: null,
        description: null,
      },
    ]);

    expect(starts(result)).toEqual(["2026-08-17T09:00:00.000Z"]);
  });

  it("respeita o intervalo ao decidir se o instante é da série", () => {
    // De duas em duas semanas a partir de 03/08: 17/08 é passo, 24/08 não é.
    const quinzenal = { ...serie, rule: rule({ frequency: "weekly", interval: 2 }) };
    const setembro = { from: utc("2026-09-01T00:00:00"), to: utc("2026-09-08T00:00:00") };

    const daSerie = expandOccurrences(quinzenal, setembro, [
      {
        occurrenceStartsAt: utc("2026-09-14T09:00:00"),
        cancelled: false,
        startsAt: utc("2026-09-02T09:00:00"),
        endsAt: utc("2026-09-02T10:00:00"),
        title: null,
        description: null,
      },
    ]);
    expect(starts(daSerie)).toContain("2026-09-02T09:00:00.000Z");

    const foraDaSerie = expandOccurrences(quinzenal, setembro, [
      {
        occurrenceStartsAt: utc("2026-09-21T09:00:00"), // semana ímpar: não é passo
        cancelled: false,
        startsAt: utc("2026-09-02T09:00:00"),
        endsAt: utc("2026-09-02T10:00:00"),
        title: null,
        description: null,
      },
    ]);
    expect(starts(foraDaSerie)).not.toContain("2026-09-02T09:00:00.000Z");
  });
});
