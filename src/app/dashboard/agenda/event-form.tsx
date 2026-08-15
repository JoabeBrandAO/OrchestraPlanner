"use client";

import { useState } from "react";

import {
  RECURRENCE_FREQUENCIES,
  RECURRENCE_LABELS,
  type RecurrenceFrequency,
} from "@/server/services/events/recurrence";
import { Button } from "@/components/ui/button";

const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/** Valor de um `<input type="datetime-local">` (local, sem fuso) para o instante `date`. */
export function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

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

export type SelectOption = { id: string; name: string };

type Props = {
  heading: string;
  submitLabel: string;
  pendingLabel: string;
  pending: boolean;
  error?: string | null;
  areas: SelectOption[];
  priorities: SelectOption[];
  /** Preenchimento inicial; ausente = formulário de criação, em branco. */
  initial?: EventFormValues;
  /** Aviso do domínio acima dos botões (ex.: "editar altera toda a série"). */
  notice?: string;
  onSubmit: (values: EventFormValues) => void;
  onCancel?: () => void;
};

/**
 * Formulário de compromisso (#18/#34) — o **mesmo** para criar e para editar. O que muda
 * entre os dois é só o preenchimento inicial e o que acontece no `onSubmit`.
 *
 * O estado começa em `initial` no inicializador do `useState` e o container troca a `key`
 * quando muda de alvo, remontando o formulário. É o oposto de copiar a prop para o estado
 * num efeito (barrado pelo lint, e dessincronizado depois de salvar).
 */
export function EventForm({
  heading,
  submitLabel,
  pendingLabel,
  pending,
  error,
  areas,
  priorities,
  initial,
  notice,
  onSubmit,
  onCancel,
}: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [startsAt, setStartsAt] = useState(initial ? toLocalInput(initial.startsAt) : "");
  const [endsAt, setEndsAt] = useState(initial ? toLocalInput(initial.endsAt) : "");
  const [frequency, setFrequency] = useState<RecurrenceFrequency>(initial?.frequency ?? "none");
  const [lifeAreaId, setLifeAreaId] = useState(initial?.lifeAreaId ?? "");
  const [priorityId, setPriorityId] = useState(initial?.priorityId ?? "");
  const [reminder, setReminder] = useState(
    initial?.reminderMinutesBefore === null || initial?.reminderMinutesBefore === undefined
      ? ""
      : String(initial.reminderMinutesBefore),
  );

  const titleValid = title.trim().length > 0;
  const datesValid = startsAt !== "" && endsAt !== "" && new Date(endsAt) > new Date(startsAt);

  return (
    <form
      className="flex flex-col gap-3 rounded-lg border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!titleValid || !datesValid) return;
        onSubmit({
          title,
          description: description.trim() === "" ? null : description,
          startsAt: new Date(startsAt),
          endsAt: new Date(endsAt),
          frequency,
          lifeAreaId: lifeAreaId || null,
          priorityId: priorityId || null,
          reminderMinutesBefore: reminder === "" ? null : Number(reminder),
        });
      }}
    >
      <h2 className="text-lg font-medium">{heading}</h2>

      <input
        className={inputClass}
        placeholder="Título"
        aria-label="Título"
        value={title}
        maxLength={120}
        onChange={(e) => setTitle(e.target.value)}
      />

      <textarea
        className={inputClass}
        placeholder="Descrição (opcional)"
        aria-label="Descrição"
        rows={2}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-muted-foreground flex flex-col gap-1 text-xs">
          Início
          <input
            type="datetime-local"
            className={inputClass}
            value={startsAt}
            onChange={(e) => {
              setStartsAt(e.target.value);
              // Sugere 1 hora de duração; ainda editável no campo ao lado.
              if (e.target.value && !endsAt) {
                const suggestion = new Date(e.target.value);
                suggestion.setHours(suggestion.getHours() + 1);
                setEndsAt(toLocalInput(suggestion));
              }
            }}
          />
        </label>
        <label className="text-muted-foreground flex flex-col gap-1 text-xs">
          Fim
          <input
            type="datetime-local"
            className={inputClass}
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-muted-foreground flex flex-col gap-1 text-xs">
          Repetição
          <select
            className={inputClass}
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as RecurrenceFrequency)}
          >
            {RECURRENCE_FREQUENCIES.map((option) => (
              <option key={option} value={option}>
                {RECURRENCE_LABELS[option]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-muted-foreground flex flex-col gap-1 text-xs">
          Lembrete (minutos antes)
          <input
            type="number"
            min={0}
            className={inputClass}
            placeholder="sem lembrete"
            value={reminder}
            onChange={(e) => setReminder(e.target.value)}
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-muted-foreground flex flex-col gap-1 text-xs">
          Área de vida
          <select
            className={inputClass}
            value={lifeAreaId}
            onChange={(e) => setLifeAreaId(e.target.value)}
          >
            <option value="">Sem área</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-muted-foreground flex flex-col gap-1 text-xs">
          Bloco para a prioridade
          <select
            className={inputClass}
            value={priorityId}
            onChange={(e) => setPriorityId(e.target.value)}
          >
            <option value="">
              {priorities.length > 0 ? "Nenhuma prioridade" : "Nenhuma prioridade ainda"}
            </option>
            {priorities.map((priority) => (
              <option key={priority.id} value={priority.id}>
                {priority.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {notice && <p className="text-muted-foreground text-xs">{notice}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={!titleValid || !datesValid || pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            Cancelar
          </Button>
        )}
        {startsAt !== "" && endsAt !== "" && !datesValid && (
          <span className="text-muted-foreground text-sm">O fim precisa ser depois do início.</span>
        )}
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
    </form>
  );
}
