/**
 * Quais lembretes venceram (#36) — regra **pura**: recebe ocorrências e uma janela de
 * tempo e devolve o que deve ser notificado. Sem banco, sem rede, roda no CI.
 *
 * O disparo é periódico, então a janela é `(desde a última passada, agora]`: aberta
 * embaixo para não remandar o que a passada anterior já tratou, fechada em cima para o
 * instante exato não cair no vão entre duas passadas.
 */

/** O que a regra precisa saber de uma ocorrência — nem de longe a linha inteira. */
export type RemindableOccurrence = {
  event: { id: string; title: string };
  occurrenceStartsAt: Date;
  startsAt: Date;
  endsAt: Date;
  reminderAt: Date | null;
  title: string;
};

/** Um lembrete pronto para virar notificação. */
export type DueReminder = {
  eventId: string;
  /** Instante original da ocorrência — a identidade que marca "este já foi enviado". */
  occurrenceStartsAt: Date;
  startsAt: Date;
  reminderAt: Date;
  title: string;
};

/**
 * Teto de recuperação: por mais tempo que o disparo tenha ficado fora do ar, ele olha no
 * máximo isto para trás. Sem o teto, voltar depois de um dia parado despejaria o dia
 * inteiro de notificações de uma vez.
 */
export const MAX_CATCHUP_MS = 60 * 60 * 1000;

export function lookbackStart(lastRunAt: Date | null, now: Date): Date {
  const floor = new Date(now.getTime() - MAX_CATCHUP_MS);
  if (lastRunAt === null || lastRunAt < floor) return floor;
  return lastRunAt;
}

export function dueReminders(
  occurrences: readonly RemindableOccurrence[],
  window: { since: Date; now: Date },
): DueReminder[] {
  const due: DueReminder[] = [];

  for (const occurrence of occurrences) {
    const { reminderAt } = occurrence;
    if (reminderAt === null) continue;
    if (reminderAt <= window.since || reminderAt > window.now) continue;
    // Avisar depois que o compromisso acabou é ruído: um atraso na fila não pode virar
    // notificação sobre o que já passou. Em andamento ainda vale — dá para entrar.
    if (occurrence.endsAt <= window.now) continue;

    due.push({
      eventId: occurrence.event.id,
      occurrenceStartsAt: occurrence.occurrenceStartsAt,
      startsAt: occurrence.startsAt,
      reminderAt,
      title: occurrence.title,
    });
  }

  return due.sort((a, b) => a.reminderAt.getTime() - b.reminderAt.getTime());
}
