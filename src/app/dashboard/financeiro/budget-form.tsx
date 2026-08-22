"use client";

import { useState } from "react";

import { formatCents, parseAmount } from "@/server/services/finance/money";
import { Button } from "@/components/ui/button";
import { fieldValue } from "@/lib/form";

import { type CategoryOption } from "./transaction-form";

export type BudgetFormValues = {
  categoryId: string;
  plannedCents: number;
};

const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

type Props = {
  categories: CategoryOption[];
  /** O que já está orçado no mês, por categoria — para o campo abrir com o valor de hoje. */
  planned: Record<string, number>;
  monthLabel: string;
  pending: boolean;
  error?: string | null;
  onSubmit: (values: BudgetFormValues) => void;
  onCancel: () => void;
};

/**
 * Orçar uma categoria no mês (#53).
 *
 * **Editar é orçar de novo:** escolher uma categoria já orçada preenche o campo com o valor
 * atual e salvar corrige — não existe "editar orçamento" como operação separada, porque no
 * banco também não existe (índice único + `on conflict do update`). Uma tela com dois
 * caminhos para o mesmo efeito é uma tela onde um dos dois some.
 */
export function BudgetForm({
  categories,
  planned,
  monthLabel,
  pending,
  error,
  onSubmit,
  onCancel,
}: Props) {
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [canSubmit, setCanSubmit] = useState(false);

  const atual = planned[categoryId];

  return (
    <form
      className="flex flex-col gap-3"
      onChange={(event) => {
        const ok = parseAmount(fieldValue(event.currentTarget, "planned")) !== null;
        setCanSubmit((current) => (current === ok ? current : ok));
      }}
      onSubmit={(event) => {
        event.preventDefault();
        const plannedCents = parseAmount(fieldValue(event.currentTarget, "planned"));
        // `parseAmount` recusa zero: orçar zero é o mesmo que não orçar, e as duas formas
        // se desencontrariam na comparação ("sem orçamento" ≠ "orçamento zero").
        if (plannedCents === null || categoryId === "") return;

        onSubmit({ categoryId, plannedCents });
      }}
    >
      <p className="text-muted-foreground text-xs">
        Orçamento de <span className="capitalize">{monthLabel}</span>. Cada mês começa zerado — nada
        é copiado do mês anterior.
      </p>

      <label className="text-muted-foreground flex flex-col gap-1 text-xs">
        Categoria
        <select
          name="categoryId"
          className={inputClass}
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name} {category.direction === "entrada" ? "(entrada)" : ""}
            </option>
          ))}
        </select>
      </label>

      <label className="text-muted-foreground flex flex-col gap-1 text-xs">
        Valor planejado
        <input
          name="planned"
          className={inputClass}
          placeholder="0,00"
          aria-label="Valor planejado"
          inputMode="decimal"
          // `key` força o campo a renascer ao trocar de categoria: sem isso o React mantém o
          // valor digitado e o formulário passaria a mentir sobre o que já está orçado.
          key={categoryId}
          defaultValue={atual === undefined ? "" : formatCents(atual)}
        />
      </label>

      {atual !== undefined && (
        <p className="text-muted-foreground text-xs">
          Já orçado: R$ {formatCents(atual)} — salvar corrige o valor, não cria outro.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={!canSubmit || pending}>
          {pending ? "Salvando…" : "Salvar orçamento"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
    </form>
  );
}
