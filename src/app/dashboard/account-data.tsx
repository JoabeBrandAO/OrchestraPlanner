"use client";

import { useClerk } from "@clerk/nextjs";
import { useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { FormDialog } from "@/components/ui/form-dialog";
import { fieldValue } from "@/lib/form";
import { trpc } from "@/trpc/react";

const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/** Tem de bater com `DELETE_CONFIRMATION` do serviço — o servidor confere de novo. */
const CONFIRMATION = "APAGAR";

/**
 * Seus dados (#74, LGPD art. 18): o que é guardado, baixar tudo e apagar a conta.
 * Apagar exige digitar a frase — um clique solto não pode levar anos de registro embora.
 */
export function AccountData() {
  const { signOut } = useClerk();
  const [open, setOpen] = useState(false);
  const remove = trpc.account.delete.useMutation({
    onSuccess: () => signOut({ redirectUrl: "/" }),
  });

  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="text-muted-foreground flex flex-col gap-2">
        <p>
          Guardamos o que você registra aqui — metas, prioridades, agenda, pessoas, conversas e
          finanças — só para mostrar de volta a você. Nada é vendido nem compartilhado.
        </p>
        <p>
          Em <strong>Pessoas</strong> ficam dados de terceiros (nome, aniversário, contatos, quando
          vocês se falaram). Eles existem para você cuidar dessas relações; não use o app para
          guardar o que a pessoa não gostaria que você anotasse. Ao apagar a pessoa ou a conta, tudo
          isso some junto.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <a href="/api/export" download className={buttonVariants({ variant: "outline" })}>
          Baixar meus dados (JSON)
        </a>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          Apagar minha conta
        </Button>
      </div>

      <FormDialog open={open} onOpenChange={setOpen} title="Apagar minha conta">
        <form
          className="flex flex-col gap-3 text-sm"
          onSubmit={(event) => {
            event.preventDefault();
            remove.mutate({ confirmation: fieldValue(event.currentTarget, "confirmation") });
          }}
        >
          <p>
            Isto apaga <strong>todo</strong> o seu registro — metas, agenda, pessoas e finanças — e
            o seu login. Não há como desfazer. Se quiser guardar uma cópia, baixe seus dados antes.
          </p>
          <label className="flex flex-col gap-1">
            Para confirmar, digite {CONFIRMATION}
            <input name="confirmation" autoComplete="off" className={inputClass} />
          </label>
          {remove.error ? <p className="text-red-500">{remove.error.message}</p> : null}
          <Button type="submit" variant="destructive" disabled={remove.isPending}>
            {remove.isPending ? "Apagando…" : "Apagar tudo, para sempre"}
          </Button>
        </form>
      </FormDialog>
    </div>
  );
}
