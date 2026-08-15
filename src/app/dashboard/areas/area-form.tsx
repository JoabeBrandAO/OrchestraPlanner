"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { fieldValue, hasText } from "@/lib/form";

export const DIMENSIONS = [
  { value: "corpo", label: "Corpo" },
  { value: "alma", label: "Alma" },
  { value: "espirito", label: "Espírito" },
] as const;

export type Dimension = (typeof DIMENSIONS)[number]["value"];

export type AreaFormValues = { name: string; dimension: Dimension };

const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

type Props = {
  pending: boolean;
  error?: string | null;
  onSubmit: (values: AreaFormValues) => void;
  onCancel: () => void;
};

function asDimension(value: string): Dimension {
  return DIMENSIONS.some((option) => option.value === value) ? (value as Dimension) : "corpo";
}

/**
 * Nova Área de Vida. Como os demais formulários do app: campos **não controlados**, com o
 * estado guardando só se dá para salvar — digitar não custa render.
 */
export function AreaForm({ pending, error, onSubmit, onCancel }: Props) {
  const [canSubmit, setCanSubmit] = useState(false);

  return (
    <form
      className="flex flex-col gap-3"
      onChange={(event) => {
        const ok = hasText(event.currentTarget, "name");
        setCanSubmit((current) => (current === ok ? current : ok));
      }}
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        if (!hasText(form, "name")) return;
        onSubmit({
          name: fieldValue(form, "name").trim(),
          dimension: asDimension(fieldValue(form, "dimension")),
        });
      }}
    >
      <input
        name="name"
        className={inputClass}
        placeholder="Nome da área"
        aria-label="Nome da área"
        maxLength={120}
      />

      <label className="text-muted-foreground flex flex-col gap-1 text-xs">
        Dimensão
        <select name="dimension" className={inputClass} defaultValue="corpo">
          {DIMENSIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={!canSubmit || pending}>
          {pending ? "Criando…" : "Criar área"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
    </form>
  );
}
