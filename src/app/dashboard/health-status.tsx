"use client";

import { trpc } from "@/trpc/react";

/** Exercita o client tRPC do front: chama a procedure autenticada `healthcheck`. */
export function HealthStatus() {
  const health = trpc.health.healthcheck.useQuery();

  if (health.isLoading) return <p className="text-muted-foreground text-sm">Verificando API…</p>;
  if (health.error)
    return <p className="text-sm text-red-500">API indisponível: {health.error.message}</p>;

  return (
    <p className="text-muted-foreground text-sm">
      API ok · <span className="font-mono">{health.data?.userId}</span>
    </p>
  );
}
