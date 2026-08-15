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

/**
 * Uma ocorrência concreta. `occurrenceStartsAt` é o instante **original** produzido pela
 * regra — a identidade da ocorrência, que não muda quando ela é remarcada. É por ele que
 * uma exceção é encontrada (o `RECURRENCE-ID` do RFC 5545).
 */
export type Occurrence = {
  startsAt: Date;
  endsAt: Date;
  occurrenceStartsAt: Date;
  /** Sobrescritas desta ocorrência; `null` = segue a série. */
  title: string | null;
  description: string | null;
};

/** Exceção a uma ocorrência (#35): cancelada, ou com horário/texto próprios. */
export type OccurrenceException = {
  occurrenceStartsAt: Date;
  cancelled: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  title: string | null;
  description: string | null;
};

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

/**
 * O instante é de fato um passo desta regra? Serve para não ressuscitar uma exceção órfã —
 * a que sobrou de uma regra antiga e não corresponde a ocorrência nenhuma da atual.
 */
export function isOccurrenceStart(base: Date, rule: RecurrenceRule, instant: Date): boolean {
  if (instant < base) return false;
  if (rule.until !== null && instant > rule.until) return false;

  switch (rule.frequency) {
    case "none":
      return instant.getTime() === base.getTime();
    case "daily":
    case "weekly": {
      // Em UTC o dia tem sempre 24 h, então o passo em milissegundos é exato.
      const days = rule.frequency === "daily" ? 1 : 7;
      const stride = days * rule.interval * 24 * 60 * 60 * 1000;
      return (instant.getTime() - base.getTime()) % stride === 0;
    }
    case "monthly":
    case "yearly": {
      const sameClock =
        instant.getUTCDate() === base.getUTCDate() &&
        instant.getUTCHours() === base.getUTCHours() &&
        instant.getUTCMinutes() === base.getUTCMinutes() &&
        instant.getUTCSeconds() === base.getUTCSeconds() &&
        instant.getUTCMilliseconds() === base.getUTCMilliseconds();
      if (!sameClock) return false;

      const months =
        (instant.getUTCFullYear() - base.getUTCFullYear()) * 12 +
        (instant.getUTCMonth() - base.getUTCMonth());
      const stride = rule.interval * (rule.frequency === "yearly" ? 12 : 1);
      return months % stride === 0;
    }
  }
}

/** Duas faixas de tempo se tocam? Fim exclusivo: um evento que acaba às 9h não está nas 9h. */
function overlaps(occurrence: { startsAt: Date; endsAt: Date }, range: Range): boolean {
  return occurrence.startsAt < range.to && occurrence.endsAt > range.from;
}

/**
 * Ocorrências de um compromisso dentro da janela, em ordem cronológica.
 *
 * A duração é preservada em cada ocorrência (a série repete o bloco, não só o instante), e
 * ocorrências que apenas **atravessam** a janela entram: quem abre a semana precisa ver o
 * compromisso que começou no domingo e termina na segunda.
 */
export function expandOccurrences(
  input: ExpandInput,
  range: Range,
  exceptions: readonly OccurrenceException[] = [],
): Occurrence[] {
  const { startsAt, endsAt, rule } = input;
  const duration = endsAt.getTime() - startsAt.getTime();
  const occurrences: Occurrence[] = [];

  // Intervalo inválido tornaria o passo constante — trata como evento único em vez de
  // girar para sempre no mesmo instante.
  const safeRule: RecurrenceRule =
    rule.interval >= 1 ? rule : { ...rule, frequency: "none", interval: 1 };

  const byOriginal = new Map(exceptions.map((e) => [e.occurrenceStartsAt.getTime(), e]));
  /** Exceções já encontradas pela regra — o resto é candidato a ter sido puxado de fora. */
  const matched = new Set<number>();

  /** Aplica a exceção (se houver) ao instante que a regra produziu. */
  const materialize = (start: Date): Occurrence | null => {
    const exception = byOriginal.get(start.getTime());
    if (exception) matched.add(start.getTime());
    if (exception?.cancelled) return null;

    return {
      occurrenceStartsAt: start,
      startsAt: exception?.startsAt ?? start,
      endsAt: exception?.endsAt ?? new Date(start.getTime() + duration),
      title: exception?.title ?? null,
      description: exception?.description ?? null,
    };
  };

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

    const occurrence = materialize(start);
    if (occurrence !== null && overlaps(occurrence, range)) occurrences.push(occurrence);

    if (safeRule.frequency === "none") break;
  }

  // Ocorrência **puxada de fora para dentro** da janela: o laço acima parou antes de
  // chegar ao instante original dela, então ela precisa ser recolhida aqui. Só entra o que
  // a regra de fato produziria — antes do início ou depois do fim da série, nada
  // ressuscita, e um evento sem repetição não ganha ocorrências que nunca teve.
  if (safeRule.frequency !== "none") {
    for (const exception of exceptions) {
      const original = exception.occurrenceStartsAt;
      if (matched.has(original.getTime())) continue;
      if (exception.cancelled || exception.startsAt === null || exception.endsAt === null) continue;
      // Antes de `range.to` o laço já passou por ali: não ter casado significa órfã.
      if (original < range.to) continue;
      if (!isOccurrenceStart(startsAt, safeRule, original)) continue;
      if (!overlaps({ startsAt: exception.startsAt, endsAt: exception.endsAt }, range)) continue;

      occurrences.push({
        occurrenceStartsAt: original,
        startsAt: exception.startsAt,
        endsAt: exception.endsAt,
        title: exception.title,
        description: exception.description,
      });
    }
  }

  return occurrences.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/**
 * Instante em que o lembrete de uma ocorrência deve disparar, ou `null` se o evento não
 * tem lembrete. Separado da expansão porque quem lista a agenda não precisa disso.
 */
export function reminderAt(
  occurrence: { startsAt: Date },
  minutesBefore: number | null,
): Date | null {
  if (minutesBefore === null) return null;
  return new Date(occurrence.startsAt.getTime() - minutesBefore * 60_000);
}
