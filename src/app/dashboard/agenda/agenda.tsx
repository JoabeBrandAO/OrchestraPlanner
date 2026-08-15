"use client";

import { useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";

import {
  addDays,
  addMonths,
  DAYS_IN_WEEK,
  monthRange,
  startOfWeek,
  weekRange,
} from "@/server/services/events/calendar";
import type { AppRouter } from "@/server/trpc/root";
import { Button } from "@/components/ui/button";
import { trpc } from "@/trpc/react";

import { AgendaMonth } from "./agenda-month";
import { AgendaWeek } from "./agenda-week";
import { EventDialog } from "./event-dialog";
import { type EventFormValues } from "./event-form";

type Occurrence = inferRouterOutputs<AppRouter>["events"]["list"][number];
type EventRow = Occurrence["event"];
type ViewMode = "week" | "month";

const rangeLabel = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

/**
 * Agenda (#18) — container das duas visões (#33) e da edição pela tela (#34).
 *
 * A navegação é uma **data-âncora**, não um deslocamento em semanas: assim clicar num dia
 * do mês leva à semana daquele dia sem ter que converter distância em índice.
 */
export function Agenda() {
  const utils = trpc.useUtils();
  const [mode, setMode] = useState<ViewMode>("week");
  const [anchor, setAnchor] = useState(() => new Date());
  /**
   * O que a janela flutuante está mostrando: `"new"` em branco, o **retrato** de um evento
   * para edição, ou `null` (fechada). Guardar o retrato — e não só o id — mantém o
   * formulário de pé mesmo que o compromisso saia da janela de datas ao ser salvo.
   *
   * Fechar desmonta o formulário, e é isso que o limpa por inteiro entre uma marcação e a
   * seguinte: campo pré-preenchido é campo para apagar (ver `docs/ERROS.md` 2026-08-15).
   */
  const [target, setTarget] = useState<"new" | EventRow | null>(null);
  const editing = target === "new" ? null : target;

  const today = new Date();
  const range = mode === "week" ? weekRange(anchor) : monthRange(anchor);

  const occurrences = trpc.events.list.useQuery(range);
  const priorities = trpc.priorities.list.useQuery();
  const areas = trpc.lifeAreas.list.useQuery();

  const invalidate = () => utils.events.list.invalidate();
  /** Salvou: a janela fecha, e fechar já limpa o formulário. */
  const close = () => {
    invalidate();
    setTarget(null);
  };
  const createEvent = trpc.events.create.useMutation({ onSuccess: close });
  const updateEvent = trpc.events.update.useMutation({ onSuccess: close });
  const deleteEvent = trpc.events.delete.useMutation({ onSuccess: invalidate });

  const areaOptions = areas.data ?? [];
  const priorityOptions = (priorities.data ?? []).map((priority) => ({
    id: priority.id,
    name: priority.title,
  }));

  const openDay = (day: Date) => {
    setAnchor(day);
    setMode("week");
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            aria-label={mode === "week" ? "Semana anterior" : "Mês anterior"}
            onClick={() =>
              setAnchor((current) =>
                mode === "week" ? addDays(current, -DAYS_IN_WEEK) : addMonths(current, -1),
              )
            }
          >
            ← {mode === "week" ? "Semana" : "Mês"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setAnchor(new Date())}>
            Hoje
          </Button>
          <Button
            size="sm"
            variant="outline"
            aria-label={mode === "week" ? "Próxima semana" : "Próximo mês"}
            onClick={() =>
              setAnchor((current) =>
                mode === "week" ? addDays(current, DAYS_IN_WEEK) : addMonths(current, 1),
              )
            }
          >
            {mode === "week" ? "Semana" : "Mês"} →
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-muted-foreground text-sm capitalize">
            {mode === "week"
              ? `${rangeLabel.format(range.from)} – ${rangeLabel.format(addDays(range.from, 6))}`
              : monthLabel.format(anchor)}
          </span>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant={mode === "week" ? "default" : "ghost"}
              aria-pressed={mode === "week"}
              onClick={() => setMode("week")}
            >
              Semana
            </Button>
            <Button
              size="sm"
              variant={mode === "month" ? "default" : "ghost"}
              aria-pressed={mode === "month"}
              onClick={() => setMode("month")}
            >
              Mês
            </Button>
          </div>
          <Button size="sm" onClick={() => setTarget("new")}>
            + Novo compromisso
          </Button>
        </div>
      </div>

      {mode === "week" ? (
        <AgendaWeek
          weekStart={startOfWeek(anchor)}
          occurrences={occurrences.data ?? []}
          loading={occurrences.isLoading}
          today={today}
          deletingId={deleteEvent.isPending ? (deleteEvent.variables?.id ?? null) : null}
          onEdit={(occurrence) => setTarget(occurrence.event)}
          onDelete={(id) => deleteEvent.mutate({ id })}
        />
      ) : (
        <AgendaMonth
          monthAnchor={anchor}
          occurrences={occurrences.data ?? []}
          loading={occurrences.isLoading}
          today={today}
          onOpenDay={openDay}
        />
      )}

      <EventDialog
        target={target}
        heading={editing ? "Editar compromisso" : "Novo compromisso"}
        submitLabel={editing ? "Salvar" : "Marcar"}
        pendingLabel={editing ? "Salvando…" : "Marcando…"}
        pending={editing ? updateEvent.isPending : createEvent.isPending}
        error={editing ? updateEvent.error?.message : createEvent.error?.message}
        areas={areaOptions}
        priorities={priorityOptions}
        notice={
          editing && editing.frequency !== "none"
            ? "Este compromisso se repete: a edição vale para toda a série. Os horários abaixo são os da regra, não os da ocorrência clicada."
            : undefined
        }
        initial={
          editing
            ? {
                title: editing.title,
                description: editing.description,
                startsAt: editing.startsAt,
                endsAt: editing.endsAt,
                frequency: editing.frequency,
                lifeAreaId: editing.lifeAreaId,
                priorityId: editing.priorityId,
                reminderMinutesBefore: editing.reminderMinutesBefore,
              }
            : undefined
        }
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
        onSubmit={(values: EventFormValues) =>
          editing ? updateEvent.mutate({ id: editing.id, ...values }) : createEvent.mutate(values)
        }
      />
    </div>
  );
}
