"use client";

import type { inferRouterOutputs } from "@trpc/server";

import { isSameDay, monthGrid } from "@/server/services/events/calendar";
import type { AppRouter } from "@/server/trpc/root";

type Occurrence = inferRouterOutputs<AppRouter>["events"]["list"][number];

const timeLabel = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const fullDayLabel = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
});

/** Cabeçalho da grade: a semana começa na segunda, como em `startOfWeek`. */
const WEEKDAYS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

type Props = {
  monthAnchor: Date;
  occurrences: Occurrence[];
  loading: boolean;
  today: Date;
  onOpenDay: (day: Date) => void;
};

/**
 * Grade do mês (#33). Recebe as ocorrências já expandidas da janela inteira da grade — uma
 * série semanal aparece em todos os dias em que cai, sem a tela conhecer a regra.
 *
 * Clicar num dia leva à semana daquele dia: o mês é para planejar, a semana para trabalhar.
 */
export function AgendaMonth({ monthAnchor, occurrences, loading, today, onOpenDay }: Props) {
  const grid = monthGrid(monthAnchor);

  // Indexa por dia local ("YYYY-M-D"): a chave sai da data, não do índice da grade, para
  // não depender da ordem em que as ocorrências chegaram.
  const byDay = new Map<string, Occurrence[]>();
  const keyOf = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  for (const occurrence of occurrences) {
    const key = keyOf(occurrence.startsAt);
    byDay.set(key, [...(byDay.get(key) ?? []), occurrence]);
  }

  if (loading) return <p className="text-muted-foreground text-sm">Carregando o mês…</p>;

  return (
    <div className="flex flex-col gap-2">
      <div className="text-muted-foreground grid grid-cols-7 gap-1 text-center text-xs">
        {WEEKDAYS.map((weekday) => (
          <span key={weekday}>{weekday}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {grid.map(({ date, inMonth }) => {
          const items = byDay.get(keyOf(date)) ?? [];
          const isToday = isSameDay(date, today);

          return (
            <button
              key={date.toISOString()}
              type="button"
              onClick={() => onOpenDay(date)}
              aria-label={`Abrir a semana de ${fullDayLabel.format(date)}`}
              className={[
                "hover:bg-accent flex min-h-24 flex-col gap-1 rounded-lg border p-1.5 text-left",
                isToday ? "border-2" : "",
                inMonth ? "" : "opacity-40",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span
                className={isToday ? "text-xs font-semibold tabular-nums" : "text-xs tabular-nums"}
              >
                {date.getDate()}
              </span>

              {items.slice(0, 3).map((occurrence) => (
                <span
                  key={`${occurrence.event.id}-${occurrence.occurrenceStartsAt.toISOString()}`}
                  className="bg-muted truncate rounded px-1 py-0.5 text-[11px] leading-tight"
                  title={occurrence.title}
                >
                  {!occurrence.event.allDay && (
                    <span className="tabular-nums">{timeLabel.format(occurrence.startsAt)} </span>
                  )}
                  {occurrence.title}
                </span>
              ))}

              {items.length > 3 && (
                <span className="text-muted-foreground text-[11px]">
                  +{items.length - 3} {items.length - 3 === 1 ? "compromisso" : "compromissos"}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
