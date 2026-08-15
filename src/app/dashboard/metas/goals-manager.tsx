"use client";

import type { inferRouterOutputs } from "@trpc/server";
import { useState } from "react";

import type { AppRouter } from "@/server/trpc/root";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/ui/form-dialog";
import { ProgressBar } from "@/components/ui/progress-bar";
import { trpc } from "@/trpc/react";

import { GoalForm } from "./goal-form";
import { MilestonesPanel } from "./milestones-panel";

type GoalItem = inferRouterOutputs<AppRouter>["goals"]["list"][number];

const STATUS_LABEL = { ativa: "Ativa", pausada: "Pausada", completada: "Concluída" } as const;

/** Ações de status válidas por status atual (espelha a máquina de estados de US-1.4). */
const STATUS_ACTIONS: Record<
  keyof typeof STATUS_LABEL,
  { to: keyof typeof STATUS_LABEL; label: string }[]
> = {
  ativa: [
    { to: "completada", label: "Concluir" },
    { to: "pausada", label: "Pausar" },
  ],
  pausada: [
    { to: "ativa", label: "Retomar" },
    { to: "completada", label: "Concluir" },
  ],
  completada: [{ to: "ativa", label: "Reabrir" }],
};

const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function GoalsManager() {
  const utils = trpc.useUtils();
  const goals = trpc.goals.list.useQuery();
  const areas = trpc.lifeAreas.list.useQuery();

  const [creating, setCreating] = useState(false);

  const invalidate = () => utils.goals.list.invalidate();

  const createGoal = trpc.goals.create.useMutation({
    onSuccess: async () => {
      setCreating(false);
      await invalidate();
    },
  });
  const setStatus = trpc.goals.setStatus.useMutation({ onSuccess: invalidate });
  const updateGoal = trpc.goals.update.useMutation({ onSuccess: invalidate });

  return (
    <div className="flex flex-col gap-6">
      {/* Criar meta (US-1.1) — janela flutuante, para a lista ficar inteira à vista. */}
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreating(true)}>
          + Nova meta
        </Button>
      </div>

      <FormDialog open={creating} onOpenChange={setCreating} title="Nova meta">
        <GoalForm
          areas={areas.data ?? []}
          pending={createGoal.isPending}
          error={createGoal.error?.message}
          onCancel={() => setCreating(false)}
          onSubmit={(values) => createGoal.mutate(values)}
        />
      </FormDialog>

      {/* Lista (US-1.2) */}
      {goals.isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando metas…</p>
      ) : goals.data && goals.data.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {goals.data.map((goal) => (
            <li key={goal.id} className="rounded-lg border p-4">
              <GoalRow
                goal={goal}
                onStatus={(status) => setStatus.mutate({ id: goal.id, status })}
                onRename={(newTitle) => updateGoal.mutate({ id: goal.id, title: newTitle })}
                busy={setStatus.isPending || updateGoal.isPending}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground text-sm">
            Você ainda não tem metas. Crie a primeira para começar. ✨
          </p>
          <Button size="sm" onClick={() => setCreating(true)}>
            + Nova meta
          </Button>
        </div>
      )}
    </div>
  );
}

function GoalRow({
  goal,
  onStatus,
  onRename,
  busy,
}: {
  goal: GoalItem;
  onStatus: (status: keyof typeof STATUS_LABEL) => void;
  onRename: (title: string) => void;
  busy: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(goal.title);
  const [showMilestones, setShowMilestones] = useState(false);
  const draftValid = draft.trim().length > 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        {editing ? (
          <input
            className={inputClass}
            value={draft}
            maxLength={120}
            onChange={(e) => setDraft(e.target.value)}
          />
        ) : (
          <div>
            <p className={goal.status === "completada" ? "line-through opacity-70" : "font-medium"}>
              {goal.title}
            </p>
            {goal.description && (
              <p className="text-muted-foreground mt-0.5 text-sm">{goal.description}</p>
            )}
          </div>
        )}
        <span className="text-muted-foreground rounded-full border px-2 py-0.5 text-xs whitespace-nowrap">
          {STATUS_LABEL[goal.status]}
        </span>
      </div>

      {/* Progresso derivado dos marcos (#15) — o número vem calculado do servidor. */}
      <div className="flex items-center gap-3">
        <ProgressBar
          value={goal.progress}
          label={`Progresso da meta ${goal.title}`}
          className="flex-1"
        />
        <span className="text-muted-foreground w-10 text-right text-xs tabular-nums">
          {goal.progress}%
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {editing ? (
          <>
            <Button
              size="sm"
              disabled={!draftValid || busy}
              onClick={() => {
                onRename(draft.trim());
                setEditing(false);
              }}
            >
              Salvar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft(goal.title);
                setEditing(false);
              }}
            >
              Cancelar
            </Button>
          </>
        ) : (
          <>
            {STATUS_ACTIONS[goal.status].map((action) => (
              <Button
                key={action.to}
                size="sm"
                variant={action.to === "completada" ? "default" : "outline"}
                disabled={busy}
                onClick={() => onStatus(action.to)}
              >
                {action.label}
              </Button>
            ))}
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setEditing(true)}>
              Editar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-expanded={showMilestones}
              onClick={() => setShowMilestones((open) => !open)}
            >
              {showMilestones ? "Ocultar marcos" : "Marcos"}
            </Button>
          </>
        )}
      </div>

      {showMilestones && <MilestonesPanel goalId={goal.id} />}
    </div>
  );
}
