"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

import { cn } from "@/lib/utils";

/**
 * Janela flutuante (modal) sobre o primitivo do `@base-ui/react`, que já entrega o que dá
 * trabalho fazer à mão: foco preso enquanto aberta, `Esc` para fechar, clique fora, e o
 * resto da página escondido do leitor de tela.
 *
 * Wrapper fino, no mesmo padrão do `button.tsx`: só estilo e `data-slot`, sem lógica.
 */

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

function DialogBackdrop({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-backdrop"
      className={cn(
        "fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0",
        className,
      )}
      {...props}
    />
  );
}

/**
 * O conteúdo. Em telas pequenas ocupa quase tudo e **rola por dentro** — um formulário
 * comprido numa janela fixa esconderia o botão de salvar no celular.
 */
function DialogContent({ className, children, ...props }: DialogPrimitive.Popup.Props) {
  return (
    <DialogPrimitive.Portal>
      <DialogBackdrop />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "bg-background fixed top-1/2 left-1/2 z-50 flex max-h-[90svh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto rounded-xl border p-4 shadow-lg transition-all duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 sm:p-6",
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg font-medium", className)}
      {...props}
    />
  );
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
};
