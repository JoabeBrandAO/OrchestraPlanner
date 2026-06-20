"use client";

import type { inferRouterOutputs } from "@trpc/server";
import { useState } from "react";

import type { AppRouter } from "@/server/trpc/root";
import { Button } from "@/components/ui/button";
import { trpc } from "@/trpc/react";

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

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [lifeAreaId, setLifeAreaId] = useState("");

  const invalidate = () => utils.goals.list.invalidate();

  const createGoal = trpc.goals.create.useMutation({
    onSuccess: async () => {
      setTitle("");
      setDescription("");
      setLifeAreaId("");
      await invalidate();
    },
  });
  const setStatus = trpc.goals.setStatus.useMutation({ onSuccess: invalidate });
  const updateGoal = trpc.goals.update.useMutation({ onSuccess: invalidate });

  const titleValid = title.trim().length > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Criar meta (US-1.1) */}
      <form
        className="flex flex-col gap-3 rounded-lg border p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!titleValid) return;
          createGoal.mutate({
            title,
            description: description.trim() || null,
            lifeAreaId: lifeAreaId || null,
          });
        }}
      >
        <h2 className="text-lg font-medium">Nova meta</h2>
        <input
          className={inputClass}
          placeholder="Título da meta"
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className={inputClass}
          placeholder="Descrição (opcional)"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <select
          className={inputClass}
          value={lifeAreaId}
          onChange={(e) => setLifeAreaId(e.target.value)}
        >
          <option value="">Sem área</option>
          {areas.data?.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={!titleValid || createGoal.isPending}>
            {createGoal.isPending ? "Criando…" : "Criar meta"}
          </Button>
          {createGoal.error && (
            <span className="text-sm text-red-500">{createGoal.error.message}</span>
          )}
        </div>
      </form>

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
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground text-sm">
            Você ainda não tem metas. Crie a primeira acima para começar. ✨
          </p>
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
          </>
        )}
      </div>
    </div>
  );
}
