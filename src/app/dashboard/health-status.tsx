"use client";

import { FormError } from "@/components/ui/form-error";
import { trpc } from "@/trpc/react";

/**
 * Exercita o client tRPC do front: chama a procedure autenticada `healthcheck`.
 *
 * Só aparece quando há problema. Antes mostrava "API ok · user_…" o tempo todo — um ID
 * interno do Clerk na tela de todo dia, que não diz nada a quem usa o app.
 */
export function HealthStatus() {
  const health = trpc.health.healthcheck.useQuery();

  if (!health.error) return null;
  return (
    <FormError
      className="mt-4"
      message="Não foi possível falar com o servidor agora. Recarregue a página em instantes."
    />
  );
}
