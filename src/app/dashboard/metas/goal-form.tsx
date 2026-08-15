"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { fieldValue, hasText } from "@/lib/form";

export type GoalFormValues = {
  title: string;
  description: string | null;
  lifeAreaId: string | null;
};

export type AreaOption = { id: string; name: string };

const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

type Props = {
  areas: AreaOption[];
  pending: boolean;
  error?: string | null;
  onSubmit: (values: GoalFormValues) => void;
  onCancel: () => void;
};

/** Nova meta (US-1.1), no formulário não controlado padrão do app. */
export function GoalForm({ areas, pending, error, onSubmit, onCancel }: Props) {
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
        const description = fieldValue(form, "description");
        onSubmit({
          title: fieldValue(form, "title").trim(),
          description: description.trim() === "" ? null : description,
          lifeAreaId: fieldValue(form, "lifeAreaId") || null,
        });
      }}
    >
      <input
        name="title"
        className={inputClass}
        placeholder="Título da meta"
        aria-label="Título da meta"
        maxLength={120}
      />

      <textarea
        name="description"
        className={inputClass}
        placeholder="Descrição (opcional)"
        aria-label="Descrição"
        rows={2}
      />

      <label className="text-muted-foreground flex flex-col gap-1 text-xs">
        Área de vida
        <select name="lifeAreaId" className={inputClass} defaultValue="">
          <option value="">{areas.length > 0 ? "Sem área" : "Nenhuma área ainda"}</option>
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={!canSubmit || pending}>
          {pending ? "Criando…" : "Criar meta"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
    </form>
  );
}
