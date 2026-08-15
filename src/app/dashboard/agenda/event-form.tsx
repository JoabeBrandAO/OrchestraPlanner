"use client";

import { useState, type ReactNode } from "react";

import { RECURRENCE_FREQUENCIES, RECURRENCE_LABELS } from "@/server/services/events/recurrence";
import { Button } from "@/components/ui/button";

import {
  checkEventFields,
  parseEventFields,
  suggestEnd,
  toRawFields,
  type EventFormValues,
  type FieldsStatus,
  type RawEventFields,
} from "./event-fields";

export type { EventFormValues } from "./event-fields";
export { toLocalInput } from "./event-fields";

const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export type SelectOption = { id: string; name: string };

type Props = {
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
  /**
   * `"occurrence"` esconde o que é **da série** — repetição, lembrete, área e prioridade.
   * Editar um dia isolado não muda a regra nem reclassifica o compromisso inteiro (#35).
   */
  fields?: "full" | "occurrence";
  /** Ações extras à direita dos botões (remover, desfazer). */
  extraActions?: ReactNode;
  onSubmit: (values: EventFormValues) => void;
  onCancel?: () => void;
};

/** Lê os campos do formulário direto do DOM — a ponte entre o `<form>` e as regras puras. */
function readFields(form: HTMLFormElement): RawEventFields {
  const value = (name: string) =>
    (form.elements.namedItem(name) as HTMLInputElement | null)?.value ?? "";

  return {
    title: value("title"),
    description: value("description"),
    startsAt: value("startsAt"),
    endsAt: value("endsAt"),
    frequency: value("frequency"),
    lifeAreaId: value("lifeAreaId"),
    priorityId: value("priorityId"),
    reminder: value("reminder"),
  };
}

/**
 * Formulário de compromisso (#18/#34) — o **mesmo** para criar e para editar. O que muda
 * entre os dois é só o preenchimento inicial e o que acontece no `onSubmit`.
 *
 * Os campos são **não controlados** (`defaultValue`): o navegador é dono do que está
 * digitado e o React nunca reescreve o campo. Foi o que consertou a digitação travada em
 * data/hora e lembrete — um `<input type="datetime-local">` controlado é reescrito a cada
 * tecla, e o campo briga com quem está digitando. O estado guarda só o **veredito**
 * (`FieldsStatus`), e como ele quase nunca muda, digitar deixou de custar render:
 * 22 teclas iam a 22 commits; agora vão a 1.
 *
 * O estado inicial é lido de `initial` no `useState`, e o container troca a `key` quando
 * muda de alvo — remontar é o que limpa o formulário depois de salvar.
 */
export function EventForm({
  submitLabel,
  pendingLabel,
  pending,
  error,
  areas,
  priorities,
  initial,
  notice,
  fields: mode = "full",
  extraActions,
  onSubmit,
  onCancel,
}: Props) {
  const fields = toRawFields(initial);
  const [status, setStatus] = useState<FieldsStatus>(() => checkEventFields(fields));

  /**
   * Roda a cada tecla, mas só encosta no estado quando o veredito muda: devolver o objeto
   * atual faz o React abortar a atualização, sem render nem commit.
   */
  const revalidate = (event: React.FormEvent<HTMLFormElement>) => {
    const form = event.currentTarget;
    // O evento sobe de qualquer campo: um `onChange` no `<form>` cobre o formulário todo.
    const changed = event.target as HTMLInputElement;

    // Sugere 1 hora de duração — escrita direta no campo, que segue não controlado.
    if (changed.name === "startsAt") {
      const end = form.elements.namedItem("endsAt") as HTMLInputElement | null;
      if (end && end.value === "") end.value = suggestEnd(changed.value);
    }

    const next = checkEventFields(readFields(form));
    setStatus((current) =>
      current.canSubmit === next.canSubmit && current.invertedWindow === next.invertedWindow
        ? current
        : next,
    );
  };

  return (
    <form
      // Sem moldura própria: quem dá a caixa é a janela flutuante que o contém.
      className="flex flex-col gap-3"
      onChange={revalidate}
      onSubmit={(event) => {
        event.preventDefault();
        const values = parseEventFields(readFields(event.currentTarget));
        if (values !== null) onSubmit(values);
      }}
    >
      <input
        name="title"
        className={inputClass}
        placeholder="Título"
        aria-label="Título"
        maxLength={120}
        defaultValue={fields.title}
      />

      <textarea
        name="description"
        className={inputClass}
        placeholder="Descrição (opcional)"
        aria-label="Descrição"
        rows={2}
        defaultValue={fields.description}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-muted-foreground flex flex-col gap-1 text-xs">
          Início
          <input
            name="startsAt"
            type="datetime-local"
            className={inputClass}
            defaultValue={fields.startsAt}
          />
        </label>
        <label className="text-muted-foreground flex flex-col gap-1 text-xs">
          Fim
          <input
            name="endsAt"
            type="datetime-local"
            className={inputClass}
            defaultValue={fields.endsAt}
          />
        </label>
      </div>

      {/* Só a série tem repetição, lembrete, área e prioridade — editar um dia isolado
          não muda a regra nem reclassifica o compromisso inteiro (#35). */}
      {mode === "full" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-muted-foreground flex flex-col gap-1 text-xs">
              Repetição
              <select name="frequency" className={inputClass} defaultValue={fields.frequency}>
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
                name="reminder"
                type="number"
                min={0}
                step={5}
                list="lembretes-comuns"
                className={inputClass}
                placeholder="sem lembrete"
                defaultValue={fields.reminder}
              />
              <datalist id="lembretes-comuns">
                {[5, 10, 15, 30, 60, 120].map((minutes) => (
                  <option key={minutes} value={minutes} />
                ))}
              </datalist>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-muted-foreground flex flex-col gap-1 text-xs">
              Área de vida
              <select name="lifeAreaId" className={inputClass} defaultValue={fields.lifeAreaId}>
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
              <select name="priorityId" className={inputClass} defaultValue={fields.priorityId}>
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
        </>
      )}

      {notice && <p className="text-muted-foreground text-xs">{notice}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={!status.canSubmit || pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            Cancelar
          </Button>
        )}
        {extraActions}
        {status.invertedWindow && (
          <span className="text-muted-foreground text-sm">O fim precisa ser depois do início.</span>
        )}
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
    </form>
  );
}
