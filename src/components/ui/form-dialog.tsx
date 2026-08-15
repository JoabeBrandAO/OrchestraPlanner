"use client";

import type { ReactNode } from "react";

import { Dialog, DialogContent, DialogTitle } from "./dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
};

/**
 * Janela flutuante para formulário de cadastro — o padrão de "novo registro" do app:
 * um botão abre, a lista atrás continua inteira à vista, e **fechar desmonta** o
 * formulário, que é o que garante que nada do registro anterior sobreviva à próxima
 * abertura (ver `docs/ERROS.md` 2026-08-15).
 *
 * O `open &&` não é redundante com o primitivo: é ele que torna o desmonte — e portanto a
 * limpeza — uma garantia nossa, e não um detalhe da biblioteca.
 */
export function FormDialog({ open, onOpenChange, title, children }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <DialogContent>
          <DialogTitle>{title}</DialogTitle>
          {children}
        </DialogContent>
      )}
    </Dialog>
  );
}
