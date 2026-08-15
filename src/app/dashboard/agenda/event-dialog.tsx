"use client";

import { FormDialog } from "@/components/ui/form-dialog";

import { EventForm, type EventFormValues, type SelectOption } from "./event-form";

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
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: EventFormValues) => void;
};

/**
 * O formulário de compromisso na janela flutuante (#34) — marcar e editar deixaram de
 * ocupar a tela o tempo todo.
 */
export function EventDialog({ target, heading, onOpenChange, ...formProps }: Props) {
  return (
    <FormDialog open={target !== null} onOpenChange={onOpenChange} title={heading}>
      <EventForm
        // Trocar de alvo com a janela aberta (clicar noutro compromisso) precisa remontar.
        key={target === null || target === "new" ? "novo" : target.id}
        {...formProps}
        onCancel={() => onOpenChange(false)}
      />
    </FormDialog>
  );
}
