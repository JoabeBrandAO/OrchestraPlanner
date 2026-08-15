"use client";

import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/ui/form-dialog";

import { EventForm, type EventFormValues, type SelectOption } from "./event-form";

/** Uma edição vale para o dia clicado ou para a regra inteira (#35). */
export type EditScope = "occurrence" | "series";

const SCOPE_LABELS: Record<EditScope, string> = {
  occurrence: "Só esta ocorrência",
  series: "Toda a série",
};

type Props = {
  /** `"new"` abre em branco; um evento abre preenchido para edição; `null` fica fechada. */
  target: "new" | { id: string } | null;
  heading: string;
  submitLabel: string;
  pendingLabel: string;
  pending: boolean;
  error?: string | null;
  areas: SelectOption[];
  priorities: SelectOption[];
  initial?: EventFormValues;
  notice?: string;
  fields?: "full" | "occurrence";
  /** Seletor de escopo; ausente quando o compromisso não se repete. */
  scope?: { value: EditScope; onChange: (scope: EditScope) => void };
  /** Remoção — o rótulo muda com o escopo, porque a consequência muda. */
  remove?: { label: string; onRemove: () => void };
  /** Desfazer a exceção: a ocorrência volta ao que a regra manda. */
  restore?: { onRestore: () => void };
  busy?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: EventFormValues) => void;
};

/**
 * O formulário de compromisso na janela flutuante (#34/#35).
 *
 * A remoção mora **aqui**, e não num botãozinho na lista, porque numa série ela é uma
 * escolha: apagar tudo ou só aquele dia. Um botão solto na lista não tem como perguntar.
 */
export function EventDialog({
  target,
  heading,
  onOpenChange,
  scope,
  remove,
  restore,
  busy = false,
  ...formProps
}: Props) {
  return (
    <FormDialog open={target !== null} onOpenChange={onOpenChange} title={heading}>
      {scope && (
        <div
          className="flex flex-wrap items-center gap-1"
          role="group"
          aria-label="Escopo da edição"
        >
          {(Object.keys(SCOPE_LABELS) as EditScope[]).map((option) => (
            <Button
              key={option}
              type="button"
              size="sm"
              variant={scope.value === option ? "default" : "ghost"}
              aria-pressed={scope.value === option}
              disabled={busy}
              onClick={() => scope.onChange(option)}
            >
              {SCOPE_LABELS[option]}
            </Button>
          ))}
        </div>
      )}

      <EventForm
        // Remonta ao trocar de compromisso **ou de escopo**: o preenchimento muda nos dois.
        key={`${target === null || target === "new" ? "novo" : target.id}-${scope?.value ?? "series"}`}
        {...formProps}
        pending={formProps.pending || busy}
        onCancel={() => onOpenChange(false)}
        extraActions={
          <>
            {restore && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={restore.onRestore}
              >
                Voltar ao horário da série
              </Button>
            )}
            {remove && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={busy}
                onClick={remove.onRemove}
              >
                {remove.label}
              </Button>
            )}
          </>
        }
      />
    </FormDialog>
  );
}
