"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { hasText } from "@/lib/form";

import { type Direction } from "./transaction-form";

export type CategoryFormValues = { name: string; direction: Direction };

const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

type Props = {
  /** Retrato da categoria quando se está **renomeando**. Quem cria não passa nada. */
  initial?: CategoryFormValues;
  pending: boolean;
  error?: string | null;
  onSubmit: (values: CategoryFormValues) => void;
  onCancel: () => void;
};

/**
 * Categoria (#63) — o mesmo formulário para criar e para renomear.
 *
 * **Renomear não mexe no sentido:** virar "entrada" uma categoria com saídas lançadas
 * deixaria os lançamentos num sentido que a categoria não descreve mais. Editando, o campo
 * aparece só para dizer de que lado a categoria está.
 */
export function CategoryForm({ initial, pending, error, onSubmit, onCancel }: Props) {
  const editando = initial !== undefined;
  const [canSubmit, setCanSubmit] = useState(editando);

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
        const name = (form.elements.namedItem("name") as HTMLInputElement).value.trim();
        if (name === "") return;

        onSubmit({
          name,
          direction:
            initial?.direction ??
            ((form.elements.namedItem("direction") as HTMLSelectElement).value as Direction),
        });
      }}
    >
      <label className="text-muted-foreground flex flex-col gap-1 text-xs">
        Nome
        <input
          name="name"
          className={inputClass}
          aria-label="Nome da categoria"
          placeholder="Mercado, Freelas, Pets…"
          maxLength={120}
          defaultValue={initial?.name ?? ""}
        />
      </label>

      <label className="text-muted-foreground flex flex-col gap-1 text-xs">
        Sentido
        <select
          name="direction"
          className={inputClass}
          aria-label="Sentido"
          defaultValue={initial?.direction ?? "saida"}
          disabled={editando}
        >
          <option value="saida">Saída</option>
          <option value="entrada">Entrada</option>
        </select>
        {editando && (
          <span className="text-muted-foreground text-xs">
            O sentido não muda: os lançamentos já classificados aqui deixariam de bater com ele.
          </span>
        )}
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={!canSubmit || pending}>
          {pending ? "Salvando…" : editando ? "Salvar" : "Criar categoria"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
    </form>
  );
}
