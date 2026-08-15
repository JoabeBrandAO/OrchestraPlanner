"use client";

import type { inferRouterOutputs } from "@trpc/server";

import { addDays, DAYS_IN_WEEK, isSameDay } from "@/server/services/events/calendar";
import { RECURRENCE_LABELS } from "@/server/services/events/recurrence";
import type { AppRouter } from "@/server/trpc/root";
import { Button } from "@/components/ui/button";

type Occurrence = inferRouterOutputs<AppRouter>["events"]["list"][number];

const dayLabel = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "short",
});
const timeLabel = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

const MS_IN_DAY = 24 * 60 * 60 * 1000;

type Props = {
  weekStart: Date;
  occurrences: Occurrence[];
  loading: boolean;
  today: Date;
  deletingId: string | null;
  onEdit: (occurrence: Occurrence) => void;
  onDelete: (id: string) => void;
};

/**
 * Semana da Agenda (#18) — só desenha. O servidor devolve as ocorrências já expandidas da
 * recorrência, então a tela nunca precisa saber a regra.
 */
export function AgendaWeek({
  weekStart,
  occurrences,
  loading,
  today,
  deletingId,
  onEdit,
  onDelete,
}: Props) {
  // Agrupa por dia da semana. Ocorrências que começaram antes da janela (mas a atravessam)
  // são ancoradas no primeiro dia visível, senão sumiriam da tela.
  const byDay: Record<number, Occurrence[]> = {};
  for (const occurrence of occurrences) {
    const index = Math.max(
      0,
      Math.min(
        DAYS_IN_WEEK - 1,
        Math.floor((occurrence.startsAt.getTime() - weekStart.getTime()) / MS_IN_DAY),
      ),
    );
    (byDay[index] ??= []).push(occurrence);
  }

  if (loading) return <p className="text-muted-foreground text-sm">Carregando a semana…</p>;

  return (
    <ul className="flex flex-col gap-3">
      {Array.from({ length: DAYS_IN_WEEK }, (_, index) => {
        const day = addDays(weekStart, index);
        const items = byDay[index] ?? [];
        const isToday = isSameDay(day, today);

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
                    key={`${occurrence.event.id}-${occurrence.startsAt.toISOString()}`}
                    className="flex items-start justify-between gap-3"
                  >
                    <button
                      type="button"
                      className="hover:bg-accent -mx-1 flex-1 rounded px-1 text-left"
                      onClick={() => onEdit(occurrence)}
                      aria-label={`Editar ${occurrence.event.title}`}
                    >
                      <p className="text-sm">
                        <span className="tabular-nums">
                          {occurrence.event.allDay
                            ? "Dia inteiro"
                            : `${timeLabel.format(occurrence.startsAt)}–${timeLabel.format(occurrence.endsAt)}`}
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
                    </button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={deletingId === occurrence.event.id}
                      aria-label={`Remover ${occurrence.event.title}`}
                      onClick={() => onDelete(occurrence.event.id)}
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
  );
}
