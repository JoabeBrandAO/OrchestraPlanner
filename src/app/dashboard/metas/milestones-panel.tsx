"use client";

import type { inferRouterOutputs } from "@trpc/server";
import { useState } from "react";

import type { AppRouter } from "@/server/trpc/root";
import { Button } from "@/components/ui/button";
import { trpc } from "@/trpc/react";

type Snapshot = inferRouterOutputs<AppRouter>["milestones"]["list"];

const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * Marcos de uma meta (#15). Só monta quando o usuário abre o painel, então a lista de
 * metas não dispara N queries de uma vez.
 *
 * Toda mutação devolve o retrato completo (marcos + progresso recalculado no servidor):
 * escrevemos esse retrato direto no cache do React Query — o da meta inclusive, para a
 * barra andar junto sem um refetch da lista inteira.
 */
export function MilestonesPanel({ goalId }: { goalId: string }) {
  const utils = trpc.useUtils();
  const milestones = trpc.milestones.list.useQuery({ goalId });
  const [title, setTitle] = useState("");

  const applySnapshot = (snapshot: Snapshot) => {
    utils.milestones.list.setData({ goalId }, snapshot);
    utils.goals.list.setData(undefined, (goals) =>
      goals?.map((goal) => (goal.id === goalId ? { ...goal, progress: snapshot.progress } : goal)),
    );
  };

  const add = trpc.milestones.add.useMutation({
    onSuccess: (snapshot) => {
      setTitle("");
      applySnapshot(snapshot);
    },
  });
  const setDone = trpc.milestones.setDone.useMutation({ onSuccess: applySnapshot });
  const remove = trpc.milestones.delete.useMutation({ onSuccess: applySnapshot });

  const busy = add.isPending || setDone.isPending || remove.isPending;
  const titleValid = title.trim().length > 0;
  const error = add.error ?? setDone.error ?? remove.error;

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-lg border border-dashed p-3">
      {milestones.isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando marcos…</p>
      ) : milestones.data && milestones.data.milestones.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {milestones.data.milestones.map((milestone) => {
            const done = milestone.completedAt !== null;
            return (
              <li key={milestone.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4 accent-current"
                  checked={done}
                  disabled={busy}
                  aria-label={milestone.title}
                  onChange={(e) => setDone.mutate({ id: milestone.id, done: e.target.checked })}
                />
                <span
                  className={done ? "flex-1 text-sm line-through opacity-70" : "flex-1 text-sm"}
                >
                  {milestone.title}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  aria-label={`Remover marco ${milestone.title}`}
                  onClick={() => remove.mutate({ id: milestone.id })}
                >
                  Remover
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">
          Nenhum marco ainda. Quebre a meta em passos concretos para acompanhar o progresso.
        </p>
      )}

      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!titleValid) return;
          add.mutate({ goalId, title });
        }}
      >
        <input
          className={inputClass}
          placeholder="Novo marco"
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Button type="submit" size="sm" disabled={!titleValid || busy}>
          Adicionar
        </Button>
      </form>

      {error && <span className="text-sm text-red-500">{error.message}</span>}
    </div>
  );
}
