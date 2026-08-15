import { describe, expect, it } from "vitest";

import { dueReminders, lookbackStart, MAX_CATCHUP_MS, type RemindableOccurrence } from "./due";

/**
 * Quais lembretes venceram (#36) — regra pura, sem banco e sem rede. É a parte que decide
 * o que sai; o envio em si é encanamento.
 */

const utc = (iso: string) => new Date(`${iso}Z`);

const ocorrencia = (patch: Partial<RemindableOccurrence> = {}): RemindableOccurrence => ({
  event: { id: "evento-1", title: "Reunião" },
  occurrenceStartsAt: utc("2026-08-17T09:00:00"),
  startsAt: utc("2026-08-17T09:00:00"),
  endsAt: utc("2026-08-17T10:00:00"),
  reminderAt: utc("2026-08-17T08:45:00"),
  title: "Reunião",
  ...patch,
});

/** A passada anterior foi às 08:40; agora são 08:50. */
const janela = { since: utc("2026-08-17T08:40:00"), now: utc("2026-08-17T08:50:00") };

describe("dueReminders", () => {
  it("manda o lembrete que venceu dentro da janela", () => {
    const result = dueReminders([ocorrencia()], janela);
    expect(result).toHaveLength(1);
    expect(result[0]!.reminderAt.toISOString()).toBe("2026-08-17T08:45:00.000Z");
  });

  it("ignora ocorrência sem lembrete", () => {
    expect(dueReminders([ocorrencia({ reminderAt: null })], janela)).toEqual([]);
  });

  it("não manda o que ainda não venceu", () => {
    expect(dueReminders([ocorrencia({ reminderAt: utc("2026-08-17T08:55:00") })], janela)).toEqual(
      [],
    );
  });

  it("não remanda o que já tinha vencido antes da janela", () => {
    // `since` é o instante da passada anterior: o que venceu antes já foi tratado lá.
    expect(dueReminders([ocorrencia({ reminderAt: utc("2026-08-17T08:30:00") })], janela)).toEqual(
      [],
    );
  });

  it("o limite de baixo é aberto e o de cima é fechado", () => {
    // Fechado no `now` garante que o instante exato não caia entre duas passadas.
    expect(dueReminders([ocorrencia({ reminderAt: janela.since })], janela)).toEqual([]);
    expect(dueReminders([ocorrencia({ reminderAt: janela.now })], janela)).toHaveLength(1);
  });

  it("não avisa sobre compromisso que já terminou", () => {
    // Depois do fato o aviso vira ruído: o atraso da fila não pode virar spam.
    const passado = ocorrencia({
      startsAt: utc("2026-08-17T07:00:00"),
      endsAt: utc("2026-08-17T08:00:00"),
      reminderAt: utc("2026-08-17T08:45:00"),
    });
    expect(dueReminders([passado], janela)).toEqual([]);
  });

  it("avisa sobre compromisso em andamento — ainda dá para entrar na reunião", () => {
    const agora = ocorrencia({
      startsAt: utc("2026-08-17T08:45:00"),
      endsAt: utc("2026-08-17T09:45:00"),
      reminderAt: utc("2026-08-17T08:45:00"),
    });
    expect(dueReminders([agora], janela)).toHaveLength(1);
  });

  it("ordena do mais antigo para o mais novo", () => {
    const result = dueReminders(
      [
        ocorrencia({ reminderAt: utc("2026-08-17T08:49:00") }),
        ocorrencia({ reminderAt: utc("2026-08-17T08:41:00") }),
      ],
      janela,
    );
    expect(result.map((r) => r.reminderAt.toISOString())).toEqual([
      "2026-08-17T08:41:00.000Z",
      "2026-08-17T08:49:00.000Z",
    ]);
  });

  it("leva o texto que a notificação vai mostrar", () => {
    const [primeiro] = dueReminders([ocorrencia({ title: "Reunião com o cliente" })], janela);
    expect(primeiro!.title).toBe("Reunião com o cliente");
    expect(primeiro!.eventId).toBe("evento-1");
    expect(primeiro!.occurrenceStartsAt.toISOString()).toBe("2026-08-17T09:00:00.000Z");
  });
});

describe("lookbackStart", () => {
  const agora = utc("2026-08-17T12:00:00");

  it("usa a última passada quando ela é recente", () => {
    const ultima = utc("2026-08-17T11:50:00");
    expect(lookbackStart(ultima, agora).toISOString()).toBe(ultima.toISOString());
  });

  it("limita o quanto olha para trás depois de uma parada longa", () => {
    // Sem teto, voltar do ar depois de um dia fora despejaria o dia inteiro de uma vez.
    const antiga = utc("2026-08-16T12:00:00");
    expect(lookbackStart(antiga, agora).getTime()).toBe(agora.getTime() - MAX_CATCHUP_MS);
  });

  it("sem passada anterior, olha só o teto para trás", () => {
    expect(lookbackStart(null, agora).getTime()).toBe(agora.getTime() - MAX_CATCHUP_MS);
  });
});
