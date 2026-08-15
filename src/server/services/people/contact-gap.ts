/**
 * "Há quanto tempo não falo com X" (#43) — regra **pura**, sem banco. É o número que dá
 * sentido ao módulo: cadastro sem acompanhamento é agenda de telefone.
 *
 * As datas trafegam como ISO "YYYY-MM-DD" (a mesma convenção de `date` do resto do
 * projeto) e o "hoje" é injetável, para o teste não mudar de resultado na virada do dia.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Meia-noite local de uma data ISO; `null` quando a string não é uma data. */
function parseISODate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Dias completos desde o último contato. `null` quando **nunca houve** — que é diferente
 * de zero: quem nunca foi procurado não é a mesma coisa que quem foi procurado hoje.
 */
export function daysSinceContact(lastAt: string | null, today: Date): number | null {
  if (lastAt === null) return null;

  const last = parseISODate(lastAt);
  if (last === null) return null;

  const reference = new Date(today);
  reference.setHours(0, 0, 0, 0);

  return Math.max(0, Math.round((reference.getTime() - last.getTime()) / DAY_MS));
}

/** A frase que a lista mostra. Fala como gente fala: "ontem", não "há 1 dia". */
export function describeGap(lastAt: string | null, today: Date): string {
  const days = daysSinceContact(lastAt, today);

  if (days === null) return "sem contato registrado";
  if (days === 0) return "falaram hoje";
  if (days === 1) return "falaram ontem";
  if (days < 30) return `há ${days} dias`;

  const months = Math.floor(days / 30);
  if (months === 1) return "há mais de um mês";
  if (months < 12) return `há ${months} meses`;

  const years = Math.floor(days / 365);
  return years === 1 ? "há mais de um ano" : `há ${years} anos`;
}

/**
 * Ordena do mais esquecido para o mais recente. **Quem nunca foi procurado vem primeiro**:
 * é exatamente quem a tela precisa mostrar, e mandá-lo para o fim esconderia o problema
 * que o módulo existe para resolver.
 */
export function byMostForgotten<T extends { lastInteractionAt: string | null }>(
  a: T,
  b: T,
): number {
  if (a.lastInteractionAt === null && b.lastInteractionAt === null) return 0;
  if (a.lastInteractionAt === null) return -1;
  if (b.lastInteractionAt === null) return 1;
  return a.lastInteractionAt.localeCompare(b.lastInteractionAt);
}
