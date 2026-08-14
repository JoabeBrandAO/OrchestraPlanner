"use client";

import Link from "next/link";
import { useState } from "react";

import { SCORE_MAX, SCORE_MIN } from "@/server/services/life-wheel/wheel";
import { Button } from "@/components/ui/button";
import { trpc } from "@/trpc/react";

import { RadarChart } from "./radar-chart";

/** Nota inicial de quem nunca se avaliou: o meio da escala, sem sugerir otimismo nem pessimismo. */
const DEFAULT_SCORE = 5;

const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" });

/**
 * Roda da Vida (#17): pontuar 0–10 por área, ver o radar, receber sugestões de onde criar
 * metas e acompanhar o histórico.
 *
 * As notas ficam num `Record` local que começa vazio e é lido com fallback para a última
 * avaliação — em vez de copiar os dados do servidor para o estado num efeito, que o lint
 * barra (`react-hooks/set-state-in-effect`) e que dessincronizaria depois de salvar.
 */
export function LifeWheelManager() {
  const utils = trpc.useUtils();
  const areas = trpc.lifeAreas.list.useQuery();
  const latest = trpc.lifeWheel.latest.useQuery();
  const history = trpc.lifeWheel.history.useQuery();

  const [draft, setDraft] = useState<Record<string, number>>({});

  const save = trpc.lifeWheel.save.useMutation({
    onSuccess: async () => {
      setDraft({});
      await Promise.all([
        utils.lifeWheel.latest.invalidate(),
        utils.lifeWheel.history.invalidate(),
      ]);
    },
  });

  const scoreOf = (areaId: string): number =>
    draft[areaId] ??
    latest.data?.entries.find((entry) => entry.lifeAreaId === areaId)?.score ??
    DEFAULT_SCORE;

  if (areas.isLoading || latest.isLoading) {
    return <p className="text-muted-foreground text-sm">Carregando sua roda…</p>;
  }

  if (!areas.data || areas.data.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-muted-foreground text-sm">
          Você precisa de Áreas de Vida para se avaliar.{" "}
          <Link href="/dashboard/areas" className="underline">
            Criar áreas
          </Link>
        </p>
      </div>
    );
  }

  const radarEntries = areas.data.map((area) => ({
    lifeAreaId: area.id,
    name: area.name,
    score: scoreOf(area.id),
  }));

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border p-4">
        <RadarChart entries={radarEntries} />
        {latest.data ? (
          <p className="text-muted-foreground mt-2 text-center text-sm">
            Última avaliação em {dateFormat.format(latest.data.assessedAt)} · média{" "}
            {latest.data.average}
          </p>
        ) : (
          <p className="text-muted-foreground mt-2 text-center text-sm">
            Esta é a sua primeira Roda da Vida. Dê uma nota de 0 a 10 para cada área.
          </p>
        )}
      </section>

      <form
        className="flex flex-col gap-4 rounded-lg border p-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate({
            scores: areas.data.map((area) => ({ lifeAreaId: area.id, score: scoreOf(area.id) })),
          });
        }}
      >
        <h2 className="text-lg font-medium">Como está cada área hoje?</h2>
        {areas.data.map((area) => (
          <div key={area.id} className="flex items-center gap-3">
            <label htmlFor={`score-${area.id}`} className="w-40 shrink-0 truncate text-sm">
              {area.name}
            </label>
            <input
              id={`score-${area.id}`}
              type="range"
              min={SCORE_MIN}
              max={SCORE_MAX}
              step={1}
              value={scoreOf(area.id)}
              className="accent-primary flex-1"
              onChange={(e) =>
                setDraft((current) => ({ ...current, [area.id]: Number(e.target.value) }))
              }
            />
            <span className="w-6 text-right text-sm tabular-nums">{scoreOf(area.id)}</span>
          </div>
        ))}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Salvando…" : "Salvar avaliação"}
          </Button>
          {save.error && <span className="text-sm text-red-500">{save.error.message}</span>}
        </div>
      </form>

      {latest.data && latest.data.suggestions.length > 0 && (
        <section className="rounded-lg border p-4">
          <h2 className="mb-2 text-lg font-medium">Onde vale criar metas</h2>
          <p className="text-muted-foreground mb-3 text-sm">
            Suas áreas com as menores notas na última avaliação:
          </p>
          <ul className="flex flex-wrap gap-2">
            {latest.data.suggestions.map((entry) => (
              <li key={entry.lifeAreaId}>
                <Link
                  href="/dashboard/metas"
                  className="hover:bg-accent inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm"
                >
                  {entry.name}
                  <span className="text-muted-foreground tabular-nums">{entry.score}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {history.data && history.data.length > 1 && (
        <section className="rounded-lg border p-4">
          <h2 className="mb-2 text-lg font-medium">Histórico</h2>
          <ul className="flex flex-col gap-1">
            {history.data.map((round) => (
              <li
                key={round.assessedAt.toISOString()}
                className="flex items-center justify-between text-sm"
              >
                <span>{dateFormat.format(round.assessedAt)}</span>
                <span className="text-muted-foreground tabular-nums">
                  média {round.average} · {round.areas} áreas
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
