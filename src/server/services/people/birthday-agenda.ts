import { ageOn, celebrationIn, type Birthday } from "./birthday";

/**
 * Aniversários na Agenda (#44) — regra **pura**, sem banco.
 *
 * O aniversário **não vira um `event`**. Ele é derivado da data em `people` na hora da
 * leitura, pelo mesmo critério que a recorrência: materializar criaria uma segunda verdade,
 * e corrigir a data de nascimento deixaria para trás um compromisso anual mentindo no
 * calendário. Derivado, corrigir a data já move o aniversário.
 */

/** Uma pessoa, do jeito que esta regra precisa vê-la. */
export type BirthdayPerson = {
  id: string;
  name: string;
  birthday: Birthday;
};

export type BirthdayOccurrence = {
  personId: string;
  name: string;
  /** Meia-noite local do dia da comemoração. */
  date: Date;
  /** Idade que completa; `null` quando o ano de nascimento é desconhecido. */
  turningAge: number | null;
};

/**
 * Hora em que o lembrete de aniversário dispara: **8h da manhã** do dia, no fuso do Brasil.
 * Não há "minutos antes" configurável como nos compromissos — aniversário é um dia, não um
 * horário —, então a escolha é uma só e fica aqui, explícita.
 *
 * O deslocamento é fixo (UTC-3): o Brasil não tem horário de verão desde 2019, a mesma
 * premissa já documentada em `events/recurrence.ts`.
 */
const REMINDER_HOUR_UTC = 11;

export function birthdayReminderAt(date: Date): Date {
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), REMINDER_HOUR_UTC, 0, 0, 0),
  );
}

/**
 * Aniversários que caem na janela, em ordem. A janela pode atravessar a virada do ano, por
 * isso os anos são percorridos em vez de assumir um só.
 */
export function birthdaysInRange(
  people: readonly BirthdayPerson[],
  range: { from: Date; to: Date },
): BirthdayOccurrence[] {
  const occurrences: BirthdayOccurrence[] = [];

  for (const person of people) {
    for (let year = range.from.getFullYear(); year <= range.to.getFullYear(); year += 1) {
      const date = celebrationIn(year, person.birthday);
      // Fim exclusivo, como no resto da agenda.
      if (date < range.from || date >= range.to) continue;

      occurrences.push({
        personId: person.id,
        name: person.name,
        date,
        turningAge: ageOn(person.birthday, date),
      });
    }
  }

  return occurrences.sort(
    (a, b) => a.date.getTime() - b.date.getTime() || a.name.localeCompare(b.name, "pt-BR"),
  );
}
