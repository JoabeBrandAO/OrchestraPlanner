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
import { EventDialog, type EditScope } from "./event-dialog";
import { type EventFormValues } from "./event-form";

type Occurrence = inferRouterOutputs<AppRouter>["events"]["list"][number];
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
  const [target, setTarget] = useState<"new" | Occurrence | null>(null);
  const editing = target === "new" ? null : target;
  /**
   * Escopo da edição (#35). Clicar num dia quer dizer, quase sempre, "mexer neste dia" —
   * por isso o padrão é a ocorrência, e mudar a série é uma escolha deliberada.
   */
  const [scope, setScope] = useState<EditScope>("occurrence");

  const today = new Date();
  const range = mode === "week" ? weekRange(anchor) : monthRange(anchor);

  const occurrences = trpc.events.list.useQuery(range);
  // Aniversários vêm à parte de propósito: são derivados de `people`, não compromissos.
  const birthdays = trpc.people.birthdaysInRange.useQuery(range);
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
  const deleteEvent = trpc.events.delete.useMutation({ onSuccess: close });
  const cancelOccurrence = trpc.events.cancelOccurrence.useMutation({ onSuccess: close });
  const overrideOccurrence = trpc.events.overrideOccurrence.useMutation({ onSuccess: close });
  const restoreOccurrence = trpc.events.restoreOccurrence.useMutation({ onSuccess: close });

  /** Um evento sem repetição não tem "só esta": a única ocorrência dele é a série. */
  const repeats = editing !== null && editing.event.frequency !== "none";
  const effectiveScope: EditScope = repeats ? scope : "series";
  const editingOccurrence = editing !== null && effectiveScope === "occurrence";

  const busy = deleteEvent.isPending || cancelOccurrence.isPending || restoreOccurrence.isPending;

  const openOccurrence = (occurrence: Occurrence) => {
    setScope("occurrence");
    setTarget(occurrence);
  };

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
          birthdays={birthdays.data ?? []}
          today={today}
          onOpen={openOccurrence}
        />
      ) : (
        <AgendaMonth
          monthAnchor={anchor}
          occurrences={occurrences.data ?? []}
          loading={occurrences.isLoading}
          birthdays={birthdays.data ?? []}
          today={today}
          onOpenDay={openDay}
        />
      )}

      <EventDialog
        target={editing ? { id: editing.event.id } : target === "new" ? "new" : null}
        heading={editing ? "Editar compromisso" : "Novo compromisso"}
        submitLabel={editing ? "Salvar" : "Marcar"}
        pendingLabel={editing ? "Salvando…" : "Marcando…"}
        pending={
          editing ? updateEvent.isPending || overrideOccurrence.isPending : createEvent.isPending
        }
        error={
          editing
            ? (updateEvent.error?.message ??
              overrideOccurrence.error?.message ??
              cancelOccurrence.error?.message)
            : createEvent.error?.message
        }
        areas={areaOptions}
        priorities={priorityOptions}
        fields={editingOccurrence ? "occurrence" : "full"}
        scope={repeats ? { value: scope, onChange: setScope } : undefined}
        notice={
          !repeats
            ? undefined
            : editingOccurrence
              ? "Vale só para este dia: a regra da série não muda."
              : "Vale para toda a série. Os horários abaixo são os da regra, não os da ocorrência clicada."
        }
        initial={
          editing
            ? editingOccurrence
              ? {
                  // Na ocorrência, o preenchimento é o do dia clicado — inclusive o que já
                  // tiver sido remarcado nele.
                  title: editing.title,
                  description: editing.description,
                  startsAt: editing.startsAt,
                  endsAt: editing.endsAt,
                  frequency: editing.event.frequency,
                  lifeAreaId: editing.event.lifeAreaId,
                  priorityId: editing.event.priorityId,
                  reminderMinutesBefore: editing.event.reminderMinutesBefore,
                }
              : {
                  // Na série, o preenchimento é o da **regra**, não o da ocorrência clicada:
                  // salvar com o horário do dia moveria a âncora da série inteira.
                  title: editing.event.title,
                  description: editing.event.description,
                  startsAt: editing.event.startsAt,
                  endsAt: editing.event.endsAt,
                  frequency: editing.event.frequency,
                  lifeAreaId: editing.event.lifeAreaId,
                  priorityId: editing.event.priorityId,
                  reminderMinutesBefore: editing.event.reminderMinutesBefore,
                }
            : undefined
        }
        busy={busy}
        remove={
          editing
            ? {
                label: editingOccurrence ? "Remover só este dia" : "Remover a série",
                onRemove: () =>
                  editingOccurrence
                    ? cancelOccurrence.mutate({
                        eventId: editing.event.id,
                        occurrenceStartsAt: editing.occurrenceStartsAt,
                      })
                    : deleteEvent.mutate({ id: editing.event.id }),
              }
            : undefined
        }
        restore={
          editing && editingOccurrence && editing.isException
            ? {
                onRestore: () =>
                  restoreOccurrence.mutate({
                    eventId: editing.event.id,
                    occurrenceStartsAt: editing.occurrenceStartsAt,
                  }),
              }
            : undefined
        }
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
        onSubmit={(values: EventFormValues) => {
          if (!editing) return createEvent.mutate(values);
          if (!editingOccurrence) return updateEvent.mutate({ id: editing.event.id, ...values });
          // No escopo da ocorrência os campos da série nem aparecem no formulário — só o
          // que é daquele dia é enviado.
          return overrideOccurrence.mutate({
            eventId: editing.event.id,
            occurrenceStartsAt: editing.occurrenceStartsAt,
            startsAt: values.startsAt,
            endsAt: values.endsAt,
            title: values.title,
            description: values.description,
          });
        }}
      />
    </div>
  );
}
