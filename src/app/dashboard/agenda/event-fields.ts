import {
  RECURRENCE_FREQUENCIES,
  type RecurrenceFrequency,
} from "@/server/services/events/recurrence";

/**
 * Regras do formulário de compromisso (#34) — **puras**: recebem as strings dos campos e
 * devolvem veredito e valores de domínio. Sem React, sem DOM, sem banco.
 *
 * Existir aqui é o que permite o formulário ser **não controlado**: a cada tecla o
 * componente lê o DOM, chama estas funções e só toca no estado do React quando o veredito
 * muda de verdade. Antes, cada tecla virava um render (medido: 22 teclas = 22 commits).
 */

/** O formulário cru, como sai dos `<input>`/`<select>`. */
export type RawEventFields = {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  frequency: string;
  lifeAreaId: string;
  priorityId: string;
  reminder: string;
};

/** O que o formulário devolve — já em tipos de domínio, não em strings de `<input>`. */
export type EventFormValues = {
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date;
  frequency: RecurrenceFrequency;
  lifeAreaId: string | null;
  priorityId: string | null;
  reminderMinutesBefore: number | null;
};

/** Veredito da digitação: o único estado que o React precisa guardar enquanto se digita. */
export type FieldsStatus = {
  canSubmit: boolean;
  /** Os dois campos preenchidos e o fim não é depois do início. */
  invertedWindow: boolean;
};

const MINUTE = 60_000;

/** Valor de um `<input type="datetime-local">` (local, sem fuso) para o instante `date`. */
export function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseLocal(value: string): Date | null {
  if (value === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Uma hora depois do início, no formato do campo. Vazio quando não há início válido. */
export function suggestEnd(startsAt: string): string {
  const start = parseLocal(startsAt);
  if (start === null) return "";
  return toLocalInput(new Date(start.getTime() + 60 * MINUTE));
}

export function checkEventFields(raw: RawEventFields): FieldsStatus {
  const start = parseLocal(raw.startsAt);
  const end = parseLocal(raw.endsAt);
  // Fim vazio enquanto se digita o início não é erro — seria acusar cedo demais.
  const invertedWindow = start !== null && end !== null && end <= start;

  return {
    canSubmit: raw.title.trim() !== "" && start !== null && end !== null && !invertedWindow,
    invertedWindow,
  };
}

function asFrequency(value: string): RecurrenceFrequency {
  // Um `<select>` adulterado não vira erro do servidor: cai para o padrão.
  return (RECURRENCE_FREQUENCIES as readonly string[]).includes(value)
    ? (value as RecurrenceFrequency)
    : "none";
}

/** Valores de domínio, ou `null` quando os campos não passam na checagem. */
export function parseEventFields(raw: RawEventFields): EventFormValues | null {
  if (!checkEventFields(raw).canSubmit) return null;

  const startsAt = parseLocal(raw.startsAt);
  const endsAt = parseLocal(raw.endsAt);
  if (startsAt === null || endsAt === null) return null;

  return {
    title: raw.title.trim(),
    // A descrição vai como foi escrita; só o campo em branco vira ausência.
    description: raw.description.trim() === "" ? null : raw.description,
    startsAt,
    endsAt,
    frequency: asFrequency(raw.frequency),
    lifeAreaId: raw.lifeAreaId || null,
    priorityId: raw.priorityId || null,
    // "0" é lembrete na hora; só o campo vazio significa "sem lembrete".
    reminderMinutesBefore: raw.reminder === "" ? null : Number(raw.reminder),
  };
}

/** Preenchimento inicial (edição) de volta para strings de campo. */
export function toRawFields(values: EventFormValues | undefined): RawEventFields {
  return {
    title: values?.title ?? "",
    description: values?.description ?? "",
    startsAt: values ? toLocalInput(values.startsAt) : "",
    endsAt: values ? toLocalInput(values.endsAt) : "",
    frequency: values?.frequency ?? "none",
    lifeAreaId: values?.lifeAreaId ?? "",
    priorityId: values?.priorityId ?? "",
    reminder: values?.reminderMinutesBefore == null ? "" : String(values.reminderMinutesBefore),
  };
}
