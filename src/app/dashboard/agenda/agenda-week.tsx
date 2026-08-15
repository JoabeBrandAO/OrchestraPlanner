"use client";

import { useState } from "react";

import { RECURRENCE_FREQUENCIES, RECURRENCE_LABELS } from "@/server/services/events/recurrence";
import { Button } from "@/components/ui/button";
import { trpc } from "@/trpc/react";

const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const dayLabel = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "short",
});
const timeLabel = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const rangeLabel = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

const DAYS_IN_WEEK = 7;

/** Segunda-feira 00:00 (horário local) da semana que contém `date`. */
function startOfWeek(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Valor de um `<input type="datetime-local">` (local, sem fuso) para o instante `date`. */
function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Agenda semanal (#18). A semana é a janela consultada: o servidor devolve as ocorrências
 * já expandidas da recorrência, então a tela nunca precisa saber a regra — só desenhar.
 */
export function AgendaWeek() {
  const utils = trpc.useUtils();
  const [weekOffset, setWeekOffset] = useState(0);

  const weekStart = addDays(startOfWeek(new Date()), weekOffset * DAYS_IN_WEEK);
  const weekEnd = addDays(weekStart, DAYS_IN_WEEK);

  const occurrences = trpc.events.list.useQuery({ from: weekStart, to: weekEnd });
  const priorities = trpc.priorities.list.useQuery();
  const areas = trpc.lifeAreas.list.useQuery();

  const invalidate = () => utils.events.list.invalidate();
  const createEvent = trpc.events.create.useMutation({ onSuccess: invalidate });
  const deleteEvent = trpc.events.delete.useMutation({ onSuccess: invalidate });

  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [frequency, setFrequency] = useState<(typeof RECURRENCE_FREQUENCIES)[number]>("none");
  const [priorityId, setPriorityId] = useState("");
  const [lifeAreaId, setLifeAreaId] = useState("");
  const [reminder, setReminder] = useState("");

  const titleValid = title.trim().length > 0;
  const datesValid = startsAt !== "" && endsAt !== "" && new Date(endsAt) > new Date(startsAt);

  // Agrupa por dia da semana. Ocorrências que começaram antes da janela (mas a atravessam)
  // são ancoradas no primeiro dia visível, senão sumiriam da tela.
  const byDay: Record<number, NonNullable<typeof occurrences.data>> = {};
  for (const occurrence of occurrences.data ?? []) {
    const start = new Date(occurrence.startsAt);
    const index = Math.max(
      0,
      Math.min(
        DAYS_IN_WEEK - 1,
        Math.floor((start.getTime() - weekStart.getTime()) / (24 * 60 * 60 * 1000)),
      ),
    );
    (byDay[index] ??= []).push(occurrence);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setWeekOffset((week) => week - 1)}>
            ← Semana
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setWeekOffset(0)}>
            Hoje
          </Button>
          <Button size="sm" variant="outline" onClick={() => setWeekOffset((week) => week + 1)}>
            Semana →
          </Button>
        </div>
        <span className="text-muted-foreground text-sm">
          {rangeLabel.format(weekStart)} – {rangeLabel.format(addDays(weekStart, 6))}
        </span>
      </div>

      {occurrences.isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando a semana…</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {Array.from({ length: DAYS_IN_WEEK }, (_, index) => {
            const day = addDays(weekStart, index);
            const items = byDay[index] ?? [];
            const isToday = day.toDateString() === new Date().toDateString();

            return (
              <li
                key={day.toISOString()}
                className={isToday ? "rounded-lg border-2 p-3" : "rounded-lg border p-3"}
              >
                <p className="mb-2 text-sm font-medium capitalize">
                  {dayLabel.format(day)}
                  {isToday && <span className="text-muted-foreground ml-2 text-xs">hoje</span>}
                </p>

                {items.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nada marcado.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {items.map((occurrence) => (
                      <li
                        key={`${occurrence.event.id}-${new Date(occurrence.startsAt).toISOString()}`}
                        className="flex items-start justify-between gap-3"
                      >
                        <div>
                          <p className="text-sm">
                            <span className="tabular-nums">
                              {occurrence.event.allDay
                                ? "Dia inteiro"
                                : `${timeLabel.format(new Date(occurrence.startsAt))}–${timeLabel.format(new Date(occurrence.endsAt))}`}
                            </span>{" "}
                            <span className="font-medium">{occurrence.event.title}</span>
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {[
                              occurrence.event.frequency !== "none" &&
                                RECURRENCE_LABELS[occurrence.event.frequency],
                              occurrence.lifeAreaName,
                              occurrence.priorityTitle && `↳ ${occurrence.priorityTitle}`,
                              occurrence.reminderAt &&
                                `lembrete ${occurrence.event.reminderMinutesBefore} min antes`,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={deleteEvent.isPending}
                          aria-label={`Remover ${occurrence.event.title}`}
                          onClick={() => deleteEvent.mutate({ id: occurrence.event.id })}
                        >
                          Remover
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <form
        className="flex flex-col gap-3 rounded-lg border p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!titleValid || !datesValid) return;
          createEvent.mutate(
            {
              title,
              startsAt: new Date(startsAt),
              endsAt: new Date(endsAt),
              frequency,
              priorityId: priorityId || null,
              lifeAreaId: lifeAreaId || null,
              reminderMinutesBefore: reminder === "" ? null : Number(reminder),
            },
            {
              onSuccess: () => {
                setTitle("");
                setPriorityId("");
                setLifeAreaId("");
                setReminder("");
              },
            },
          );
        }}
      >
        <h2 className="text-lg font-medium">Novo compromisso</h2>
        <input
          className={inputClass}
          placeholder="Título"
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
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
              onChange={(e) =>
                setFrequency(e.target.value as (typeof RECURRENCE_FREQUENCIES)[number])
              }
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
              {areas.data?.map((area) => (
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
                {priorities.data && priorities.data.length > 0
                  ? "Nenhuma prioridade"
                  : "Nenhuma prioridade ainda"}
              </option>
              {priorities.data?.map((priority) => (
                <option key={priority.id} value={priority.id}>
                  {priority.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={!titleValid || !datesValid || createEvent.isPending}>
            {createEvent.isPending ? "Marcando…" : "Marcar"}
          </Button>
          {startsAt !== "" && endsAt !== "" && !datesValid && (
            <span className="text-muted-foreground text-sm">
              O fim precisa ser depois do início.
            </span>
          )}
          {createEvent.error && (
            <span className="text-sm text-red-500">{createEvent.error.message}</span>
          )}
        </div>
      </form>
    </div>
  );
}
