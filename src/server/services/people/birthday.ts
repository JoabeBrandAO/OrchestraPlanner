/**
 * Aniversários (#41) — regra **pura**, sem banco e sem import de `db/`, então roda no CI e
 * pode ser importada pela tela.
 *
 * O aniversário é guardado como **dia, mês e ano opcional**, não como uma `date`: muita
 * gente sabe o dia e o mês de alguém e não sabe o ano. Um `date` obrigaria a inventar um
 * ano e depois fingir que ele não existe — e alguém acabaria mostrando a idade errada.
 */

export type Birthday = {
  day: number;
  month: number;
  /** `null` quando o ano é desconhecido — aí não há idade a mostrar. */
  year: number | null;
};

/** Faixa de anos aceita: o suficiente para gente viva, o bastante para barrar dedo errado. */
const MIN_YEAR = 1900;
const MAX_YEAR = new Date().getFullYear();

const FEBRUARY = 2;
const LEAP_DAY = 29;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(month: number, year: number | null): number {
  if (month === FEBRUARY) {
    // Sem ano, fevereiro tem 29: o dia existe, só não em todo ano.
    return year === null || isLeapYear(year) ? 29 : 28;
  }
  return [1, 3, 5, 7, 8, 10, 12].includes(month) ? 31 : 30;
}

export function isValidBirthday(birthday: Birthday): boolean {
  const { day, month, year } = birthday;

  if (!Number.isInteger(day) || !Number.isInteger(month)) return false;
  if (month < 1 || month > 12) return false;
  if (year !== null) {
    if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) return false;
  }

  return day >= 1 && day <= daysInMonth(month, year);
}

/**
 * O dia em que se comemora num ano qualquer. Quem nasceu em **29 de fevereiro** comemora
 * em **28/02** nos anos comuns: continua no mês em que a pessoa nasceu, e é melhor que a
 * alternativa honesta-mas-inútil de pular três anos em cada quatro.
 */
function celebrationIn(year: number, birthday: Birthday): Date {
  const leapDayInCommonYear =
    birthday.month === FEBRUARY && birthday.day === LEAP_DAY && !isLeapYear(year);

  return new Date(year, birthday.month - 1, leapDayInCommonYear ? 28 : birthday.day);
}

/**
 * Próximo aniversário a partir de `today` (inclusive: o de hoje é o próximo, não o do ano
 * que vem). Devolve o dia à meia-noite local, pronto para virar janela de agenda.
 */
export function nextBirthday(birthday: Birthday, today: Date): Date {
  const reference = new Date(today);
  reference.setHours(0, 0, 0, 0);

  const thisYear = celebrationIn(reference.getFullYear(), birthday);
  return thisYear >= reference ? thisYear : celebrationIn(reference.getFullYear() + 1, birthday);
}

/** Anos completos em `on`, ou `null` quando o ano de nascimento é desconhecido. */
export function ageOn(birthday: Birthday, on: Date): number | null {
  if (birthday.year === null) return null;

  const reference = new Date(on);
  reference.setHours(0, 0, 0, 0);

  const celebration = celebrationIn(reference.getFullYear(), birthday);
  const years = reference.getFullYear() - birthday.year;
  return celebration <= reference ? years : years - 1;
}
