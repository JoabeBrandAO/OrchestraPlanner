"use client";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { trpc } from "@/trpc/react";

/**
 * Convite de onboarding (#17): quem ainda não fez a primeira Roda da Vida vê o chamado;
 * quem já fez vê a média da última rodada e as áreas mais baixas. Some do caminho quando
 * não há o que dizer — o dashboard é para as metas, este é só o empurrão inicial.
 */
export function LifeWheelCallout() {
  const latest = trpc.lifeWheel.latest.useQuery();

  if (latest.isLoading) return null;

  if (!latest.data) {
    return (
      <section className="rounded-lg border border-dashed p-6">
        <h2 className="mb-1 text-lg font-medium">Comece pela Roda da Vida</h2>
        <p className="text-muted-foreground mb-4 text-sm">
          Dê uma nota de 0 a 10 para cada área da sua vida. É daí que saem as metas que realmente
          importam agora.
        </p>
        <Link href="/dashboard/roda-da-vida" className={buttonVariants({ variant: "default" })}>
          Fazer minha primeira avaliação
        </Link>
      </section>
    );
  }

  const lowest = latest.data.suggestions.slice(0, 3);

  return (
    <section className="rounded-lg border p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-medium">Roda da Vida</h2>
        <span className="text-muted-foreground text-sm tabular-nums">
          média {latest.data.average}
        </span>
      </div>
      {lowest.length > 0 && (
        <p className="text-muted-foreground mt-2 text-sm">
          Mais baixas: {lowest.map((entry) => `${entry.name} (${entry.score})`).join(" · ")}
        </p>
      )}
      <Link
        href="/dashboard/roda-da-vida"
        className="mt-3 inline-block text-sm underline underline-offset-4"
      >
        Reavaliar
      </Link>
    </section>
  );
}
