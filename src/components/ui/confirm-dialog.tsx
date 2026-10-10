"use client";

import { useRef, type ReactNode } from "react";

import { Button } from "./button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog";

type Props = {
  /** Aberta quando há algo a confirmar. Fechar (Esc, clique fora, Cancelar) não apaga nada. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** O que vai junto: é isto que a pessoa precisa ler antes de decidir. */
  description: ReactNode;
  confirmLabel: string;
  pendingLabel: string;
  pending: boolean;
  error?: string | null;
  onConfirm: () => void;
};

/**
 * Confirmação antes de apagar o que leva outros dados junto (conta → lançamentos, pessoa →
 * contatos e convívio, área → histórico da Roda da Vida). Um clique solto não pode levar
 * isso embora — e o banco não tem desfazer.
 *
 * O foco abre em **Cancelar**: Enter logo depois de abrir não apaga nada. Só para exclusão
 * em cascata; apagar uma linha simples (um contato, um marco) continua em um clique.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  pendingLabel,
  pending,
  error,
  onConfirm,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <DialogContent role="alertdialog" initialFocus={cancelRef} className="gap-3">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            <Button
              ref={cancelRef}
              variant="outline"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button variant="destructive" disabled={pending} onClick={onConfirm}>
              {pending ? pendingLabel : confirmLabel}
            </Button>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
