"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

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
 * O formulário de compromisso numa janela flutuante (#34). Marcar e editar deixaram de
 * ocupar a tela o tempo todo: a agenda fica inteira à vista e o formulário aparece quando
 * é chamado.
 *
 * Fechar **desmonta** o formulário, então nada do compromisso anterior sobrevive à próxima
 * abertura — é o mesmo mecanismo de limpeza da `key`, só que de graça.
 */
export function EventDialog({ target, heading, onOpenChange, ...formProps }: Props) {
  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      {target !== null && (
        <DialogContent
          // Trocar de alvo com a janela aberta (clicar noutro compromisso) precisa remontar.
          key={target === "new" ? "novo" : target.id}
        >
          <DialogTitle>{heading}</DialogTitle>
          <EventForm {...formProps} onCancel={() => onOpenChange(false)} />
        </DialogContent>
      )}
    </Dialog>
  );
}
