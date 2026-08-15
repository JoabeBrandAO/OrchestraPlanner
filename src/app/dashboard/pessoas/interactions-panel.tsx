"use client";

import type { inferRouterOutputs } from "@trpc/server";

import { describeGap } from "@/server/services/people/contact-gap";
import type { AppRouter } from "@/server/trpc/root";
import { Button } from "@/components/ui/button";
import { fieldValue } from "@/lib/form";
import { todayISO } from "@/app/dashboard/pessoas/person-input";
import { trpc } from "@/trpc/react";

type Snapshot = inferRouterOutputs<AppRouter>["people"]["interactionsOf"];

const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const KIND_LABELS = {
  encontro: "Encontro",
  ligacao: "Ligação",
  mensagem: "Mensagem",
  outro: "Outro",
} as const;

const dateLabel = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" });

type Props = { personId: string; today: Date };

/**
 * Convívio com uma pessoa (#43): o histórico e o registro de um contato novo.
 *
 * Toda mutação devolve o **retrato completo** (histórico + data do último contato), e o
 * client escreve esse retrato direto no cache — inclusive na linha da pessoa na lista, que
 * é onde o "há quanto tempo" aparece. Assim registrar uma conversa atualiza a tela sem
 * refazer a lista inteira.
 */
export function InteractionsPanel({ personId, today }: Props) {
  const utils = trpc.useUtils();
  const snapshot = trpc.people.interactionsOf.useQuery({ personId });

  const apply = (next: Snapshot | null) => {
    if (!next) return;
    utils.people.interactionsOf.setData({ personId }, next);
    utils.people.list.setData(undefined, (people) =>
      people?.map((person) =>
        person.id === next.personId
          ? { ...person, lastInteractionAt: next.lastInteractionAt }
          : person,
      ),
    );
  };

  const add = trpc.people.addInteraction.useMutation({ onSuccess: apply });
  const remove = trpc.people.deleteInteraction.useMutation({ onSuccess: apply });

  const busy = add.isPending || remove.isPending;
  const error = add.error ?? remove.error;

  return (
    <div className="mt-2 flex flex-col gap-2 rounded-lg border border-dashed p-3">
      {snapshot.isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando convívio…</p>
      ) : snapshot.data && snapshot.data.interactions.length > 0 ? (
        <>
          <p className="text-muted-foreground text-xs">
            Último contato: {describeGap(snapshot.data.lastInteractionAt, today)}
          </p>
          <ul className="flex flex-col gap-1">
            {snapshot.data.interactions.map((interaction) => (
              <li key={interaction.id} className="flex items-start gap-2">
                <span className="text-muted-foreground w-28 shrink-0 text-xs tabular-nums">
                  {dateLabel.format(new Date(`${interaction.happenedAt}T12:00:00`))}
                </span>
                <span className="flex-1 text-sm">
                  {KIND_LABELS[interaction.kind]}
                  {interaction.notes && (
                    <span className="text-muted-foreground"> · {interaction.notes}</span>
                  )}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  aria-label={`Remover interação de ${interaction.happenedAt}`}
                  onClick={() => remove.mutate({ id: interaction.id })}
                >
                  Remover
                </Button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-muted-foreground text-sm">
          Nenhum contato registrado. Anote o próximo para saber quanto tempo passa.
        </p>
      )}

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const happenedAt = fieldValue(form, "happenedAt");
          if (!happenedAt) return;

          add.mutate({
            personId,
            happenedAt,
            kind: fieldValue(form, "kind") as keyof typeof KIND_LABELS,
            notes: fieldValue(form, "notes").trim() || null,
          });
          form.reset();
        }}
      >
        <input
          name="happenedAt"
          type="date"
          // Contato no futuro não é contato: é compromisso, e isso é a Agenda.
          max={todayISO(today)}
          defaultValue={todayISO(today)}
          className={`${inputClass} w-auto`}
          aria-label="Quando foi"
        />
        <select name="kind" className={`${inputClass} w-auto`} aria-label="Tipo de contato">
          {(Object.keys(KIND_LABELS) as (keyof typeof KIND_LABELS)[]).map((kind) => (
            <option key={kind} value={kind}>
              {KIND_LABELS[kind]}
            </option>
          ))}
        </select>
        <input
          name="notes"
          className={`${inputClass} min-w-40 flex-1`}
          placeholder="Sobre o quê?"
          aria-label="Nota do contato"
          maxLength={2000}
        />
        <Button type="submit" size="sm" disabled={busy}>
          Registrar
        </Button>
      </form>

      {error && <span className="text-sm text-red-500">{error.message}</span>}
    </div>
  );
}
