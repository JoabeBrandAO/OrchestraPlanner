"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { fieldValue, hasText } from "@/lib/form";

/** Rótulos do nível de prioridade — o índice é o valor guardado. */
export const LEVEL_LABELS = ["Normal", "Média", "Alta", "Urgente"] as const;

export type PriorityFormValues = {
  title: string;
  description: string | null;
  goalId: string | null;
  dueDate: string | null;
  priorityLevel: number;
};

export type GoalOption = { id: string; title: string };

const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

type Props = {
  goals: GoalOption[];
  pending: boolean;
  error?: string | null;
  onSubmit: (values: PriorityFormValues) => void;
  onCancel: () => void;
};

/** Nova prioridade (#13), no formulário não controlado padrão do app. */
export function PriorityForm({ goals, pending, error, onSubmit, onCancel }: Props) {
  const [canSubmit, setCanSubmit] = useState(false);

  return (
    <form
      className="flex flex-col gap-3"
      onChange={(event) => {
        const ok = hasText(event.currentTarget, "title");
        setCanSubmit((current) => (current === ok ? current : ok));
      }}
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        if (!hasText(form, "title")) return;
        onSubmit({
          title: fieldValue(form, "title").trim(),
          description: null,
          goalId: fieldValue(form, "goalId") || null,
          dueDate: fieldValue(form, "dueDate") || null,
          priorityLevel: Number(fieldValue(form, "priorityLevel")),
        });
      }}
    >
      <input
        name="title"
        className={inputClass}
        placeholder="O que precisa ser feito?"
        aria-label="O que precisa ser feito?"
        maxLength={120}
      />

      <label className="text-muted-foreground flex flex-col gap-1 text-xs">
        Meta vinculada
        <select name="goalId" className={inputClass} defaultValue="">
          <option value="">{goals.length > 0 ? "Sem meta" : "Nenhuma meta ainda"}</option>
          {goals.map((goal) => (
            <option key={goal.id} value={goal.id}>
              {goal.title}
            </option>
          ))}
        </select>
        {goals.length === 0 && (
          <span className="text-muted-foreground text-xs">
            Você ainda não tem metas —{" "}
            <Link href="/dashboard/metas" className="underline">
              crie uma
            </Link>{" "}
            para poder vincular. Prioridades soltas funcionam normalmente.
          </span>
        )}
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-muted-foreground flex flex-col gap-1 text-xs">
          Prazo
          <input name="dueDate" type="date" className={inputClass} />
        </label>
        <label className="text-muted-foreground flex flex-col gap-1 text-xs">
          Nível de prioridade
          <select name="priorityLevel" className={inputClass} defaultValue="0">
            {LEVEL_LABELS.map((label, value) => (
              <option key={label} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={!canSubmit || pending}>
          {pending ? "Criando…" : "Criar prioridade"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
    </form>
  );
}
