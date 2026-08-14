/**
 * Expansão de recorrência da Agenda (#18). Regra **pura**: recebe a regra e uma janela de
 * tempo e devolve as ocorrências dentro dela. Sem banco e sem import de `db/schema` — roda
 * no CI e é a mesma função que a UI usaria para prever uma série.
 *
 * O banco guarda a **regra**, não as ocorrências (ver schema): "toda segunda" é uma linha,
 * não 520. Materializar exigiria escolher até quando gerar e transformaria editar a série
 * numa caçada a N linhas.
 *
 * **Fuso:** a aritmética é feita em UTC. O produto é de uso pessoal no Brasil, que não tem
 * horário de verão desde 2019 — o deslocamento é fixo, então "toda segunda às 19h" em UTC-3
 * cai sempre no mesmo horário local. Um dia com múltiplos fusos (SaaS, Visão §Fase 2), isto
 * precisa de um fuso por evento e de aritmética no calendário local; é o ponto a mudar.
 */

export const RECURRENCE_FREQUENCIES = ["none", "daily", "weekly", "monthly", "yearly"] as const;
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

/** Rótulos (PT-BR), fonte única para a UI. */
export const RECURRENCE_LABELS: Record<RecurrenceFrequency, string> = {
  none: "Não se repete",
  daily: "Diariamente",
  weekly: "Semanalmente",
  monthly: "Mensalmente",
  yearly: "Anualmente",
};

export type RecurrenceRule = {
  frequency: RecurrenceFrequency;
  /** A cada quantos períodos repete. 1 = todo período. */
  interval: number;
  /** Fim da série (inclusivo no dia); `null` = sem fim previsto. */
  until: Date | null;
};

export type Occurrence = { startsAt: Date; endsAt: Date };

export type ExpandInput = {
  startsAt: Date;
  endsAt: Date;
  rule: RecurrenceRule;
};

export type Range = { from: Date; to: Date };

/**
 * Teto de segurança da expansão. A janela da tela é uma semana ou um mês, então este limite
 * nunca é atingido na prática — ele existe para uma regra maluca (intervalo 0, `until`
 * distante) não virar um laço infinito servindo uma requisição.
 */
const MAX_OCCURRENCES = 750;

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/**
 * Soma meses preservando o dia do mês. Se o mês destino não tem aquele dia (31 de fevereiro),
 * devolve `null` e a ocorrência é **pulada** — é o que manda o RFC 5545 para BYMONTHDAY.
 * Grudar no dia 28/30 mais próximo seria mentir: "todo dia 31" viraria "todo fim de mês".
 */
function addMonthsKeepingDay(date: Date, months: number): Date | null {
  const day = date.getUTCDate();
  const next = new Date(date.getTime());
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + months);
  next.setUTCDate(day);
  return next.getUTCDate() === day ? next : null;
}

/** Início da n-ésima ocorrência, ou `null` quando aquele passo não existe no calendário. */
function occurrenceStart(base: Date, rule: RecurrenceRule, step: number): Date | null {
  const stride = rule.interval * step;

  switch (rule.frequency) {
    case "daily":
      return addDays(base, stride);
    case "weekly":
      return addDays(base, stride * 7);
    case "monthly":
      return addMonthsKeepingDay(base, stride);
    case "yearly":
      return addMonthsKeepingDay(base, stride * 12);
    case "none":
      return step === 0 ? base : null;
  }
}

/** Duas faixas de tempo se tocam? Fim exclusivo: um evento que acaba às 9h não está nas 9h. */
function overlaps(occurrence: Occurrence, range: Range): boolean {
  return occurrence.startsAt < range.to && occurrence.endsAt > range.from;
}

/**
 * Ocorrências de um compromisso dentro da janela, em ordem cronológica.
 *
 * A duração é preservada em cada ocorrência (a série repete o bloco, não só o instante), e
 * ocorrências que apenas **atravessam** a janela entram: quem abre a semana precisa ver o
 * compromisso que começou no domingo e termina na segunda.
 */
export function expandOccurrences(input: ExpandInput, range: Range): Occurrence[] {
  const { startsAt, endsAt, rule } = input;
  const duration = endsAt.getTime() - startsAt.getTime();
  const occurrences: Occurrence[] = [];

  // Intervalo inválido tornaria o passo constante — trata como evento único em vez de
  // girar para sempre no mesmo instante.
  const safeRule: RecurrenceRule =
    rule.interval >= 1 ? rule : { ...rule, frequency: "none", interval: 1 };

  for (let step = 0; step < MAX_OCCURRENCES; step += 1) {
    const start = occurrenceStart(startsAt, safeRule, step);
    if (start === null) {
      // Passo inexistente no calendário (31 de fevereiro): pula, mas só na recorrência —
      // num evento único `null` significa "acabou".
      if (safeRule.frequency === "none") break;
      continue;
    }

    // Passou do fim da série ou da janela: como os inícios só crescem, não há mais nada.
    if (safeRule.until !== null && start > safeRule.until) break;
    if (start >= range.to) break;

    const occurrence = { startsAt: start, endsAt: new Date(start.getTime() + duration) };
    if (overlaps(occurrence, range)) occurrences.push(occurrence);

    if (safeRule.frequency === "none") break;
  }

  return occurrences;
}

/**
 * Instante em que o lembrete de uma ocorrência deve disparar, ou `null` se o evento não
 * tem lembrete. Separado da expansão porque quem lista a agenda não precisa disso.
 */
export function reminderAt(occurrence: Occurrence, minutesBefore: number | null): Date | null {
  if (minutesBefore === null) return null;
  return new Date(occurrence.startsAt.getTime() - minutesBefore * 60_000);
}
