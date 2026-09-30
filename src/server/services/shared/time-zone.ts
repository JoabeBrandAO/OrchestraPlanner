/**
 * Fuso do usuário (#72) — regra **pura**, sem banco.
 *
 * O servidor roda em UTC (Vercel, GitHub Actions). Sem isto, o "hoje" virava o dia seguinte
 * às 21h de Brasília: entre 21h e meia-noite, meta com prazo para hoje aparecia vencida.
 * Tudo aqui se apoia no `Intl`, que conhece a tabela de fusos (inclusive horário de verão),
 * em vez de deslocamento fixo.
 */

/** Fuso de quem ainda não definiu o seu — o produto nasceu para uso no Brasil. */
export const DEFAULT_TIME_ZONE = "America/Sao_Paulo";

export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Fuso nulo (nunca definido) ou inválido cai no padrão — a tela não pode cair por isso. */
export function resolveTimeZone(timeZone: string | null | undefined): string {
  return timeZone && isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;
}

type DateParts = { year: number; month: number; day: number };

function partsIn(instant: Date, timeZone: string): DateParts & { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

/** A data civil daquele instante no fuso, em "YYYY-MM-DD" — o formato do `date` do Postgres. */
export function dateIn(instant: Date, timeZone: string): string {
  const { year, month, day } = partsIn(instant, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * O instante em que o relógio do fuso marca `hour`:00 daquele dia. Chuta como se o fuso
 * fosse UTC, mede a diferença e corrige; uma segunda passada acerta o dia em que o horário
 * de verão muda entre o chute e a resposta.
 */
export function instantAt(date: DateParts, hour: number, timeZone: string): Date {
  const target = Date.UTC(date.year, date.month - 1, date.day, hour, 0, 0, 0);
  let guess = target;
  for (let pass = 0; pass < 2; pass += 1) {
    const seen = partsIn(new Date(guess), timeZone);
    const seenAsUtc = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute);
    guess += target - seenAsUtc;
  }
  return new Date(guess);
}
