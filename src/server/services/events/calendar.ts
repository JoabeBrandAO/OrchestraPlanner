/**
 * Matemática do calendário da Agenda (#18 — fatias #33/#34). Pura: só datas, sem banco e
 * sem import de `db/`, então roda no CI e pode ser importada pelo client sem arrastar o
 * driver `postgres` para o bundle (ver `docs/ERROS.md` 2026-08-11).
 *
 * **Fuso:** ao contrário de `recurrence.ts`, que expande a regra em UTC, aqui a conta é no
 * **calendário local** — a grade é a que a pessoa vê na tela dela. Por isso todo passo usa
 * `setDate`/`setMonth` em vez de somar milissegundos: onde há horário de verão, um dia nem
 * sempre tem 24 horas, e a aritmética de milissegundos escorregaria a grade em uma hora.
 */

export const DAYS_IN_WEEK = 7;

/** Meia-noite local do dia de `date`, sem tocar no original. */
export function startOfDay(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Segunda-feira 00:00 da semana que contém `date` — domingo fecha a semana, não abre. */
export function startOfWeek(date: Date): Date {
  const start = startOfDay(date);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

/** Dia 1 do mês de `date`, à meia-noite. */
export function startOfMonth(date: Date): Date {
  const start = startOfDay(date);
  start.setDate(1);
  return start;
}

/**
 * Anda `months` meses a partir do **primeiro dia** do mês de `date`. Ancorar no dia 1 é o
 * que evita o clássico "31 de janeiro + 1 mês = 3 de março": a navegação da tela quer o mês
 * vizinho, não a mesma data no mês vizinho.
 */
export function addMonths(date: Date, months: number): Date {
  const next = startOfMonth(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Um dia da grade: `inMonth` distingue o dia do mês exibido do emprestado do vizinho. */
export type CalendarDay = { date: Date; inMonth: boolean };

/** Quantos dias tem o mês de `date` (dia 0 do mês seguinte é o último deste). */
function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/**
 * Grade do mês de `reference`: semanas inteiras de segunda a domingo, cobrindo o mês e
 * completando as pontas com os dias vizinhos. O número de linhas é calculado (4 a 6), não
 * fixado em 6 — um fevereiro que começa na segunda não ganha uma semana vazia no rodapé.
 */
export function monthGrid(reference: Date): CalendarDay[] {
  const month = startOfMonth(reference);
  const first = startOfWeek(month);
  const leading = (month.getDay() + 6) % 7;
  const weeks = Math.ceil((leading + daysInMonth(month)) / DAYS_IN_WEEK);

  return Array.from({ length: weeks * DAYS_IN_WEEK }, (_, index) => {
    const date = addDays(first, index);
    return {
      date,
      inMonth: date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear(),
    };
  });
}

/**
 * Janelas de consulta das duas visões, com **fim exclusivo** — a mesma convenção de
 * `expandOccurrences`, para o `events.list` receber exatamente o que a tela desenha.
 */
export type CalendarRange = { from: Date; to: Date };

export function weekRange(reference: Date): CalendarRange {
  const from = startOfWeek(reference);
  return { from, to: addDays(from, DAYS_IN_WEEK) };
}

export function monthRange(reference: Date): CalendarRange {
  const grid = monthGrid(reference);
  const first = grid[0]!;
  const last = grid[grid.length - 1]!;
  return { from: first.date, to: addDays(last.date, 1) };
}
