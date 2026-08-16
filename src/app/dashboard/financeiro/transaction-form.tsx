"use client";

import { useState } from "react";

import { parseAmount } from "@/server/services/finance/money";
import { Button } from "@/components/ui/button";
import { fieldValue } from "@/lib/form";

export type Direction = "entrada" | "saida";

export type TransactionFormValues = {
  accountId: string;
  happenedAt: string;
  direction: Direction;
  amountCents: number;
  categoryId: string | null;
  lifeAreaId: string | null;
  description: string | null;
};

export type Option = { id: string; name: string };
export type CategoryOption = Option & { direction: Direction };

const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

type Props = {
  accounts: Option[];
  categories: CategoryOption[];
  areas: Option[];
  today: string;
  pending: boolean;
  error?: string | null;
  onSubmit: (values: TransactionFormValues) => void;
  onCancel: () => void;
};

/**
 * Novo lançamento (#52).
 *
 * O **tipo decide o sinal** e decide as categorias que fazem sentido, então ele é a única
 * coisa que precisa de estado aqui: trocar de "saída" para "entrada" tem que trocar a lista
 * de categorias junto, senão dá para lançar salário como "Moradia".
 *
 * O valor é digitado como texto e vira **centavos inteiros** (`parseAmount`), que recusa
 * zero e negativo — o menos é dito pelo tipo, nunca pelo número.
 */
export function TransactionForm({
  accounts,
  categories,
  areas,
  today,
  pending,
  error,
  onSubmit,
  onCancel,
}: Props) {
  const [direction, setDirection] = useState<Direction>("saida");
  const [canSubmit, setCanSubmit] = useState(false);

  const doTipo = categories.filter((category) => category.direction === direction);

  const revalidate = (form: HTMLFormElement) => {
    const ok =
      fieldValue(form, "accountId") !== "" &&
      fieldValue(form, "happenedAt") !== "" &&
      parseAmount(fieldValue(form, "amount")) !== null;
    setCanSubmit((current) => (current === ok ? current : ok));
  };

  return (
    <form
      className="flex flex-col gap-3"
      onChange={(event) => revalidate(event.currentTarget)}
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const amountCents = parseAmount(fieldValue(form, "amount"));
        if (amountCents === null) return;

        onSubmit({
          accountId: fieldValue(form, "accountId"),
          happenedAt: fieldValue(form, "happenedAt"),
          direction,
          amountCents,
          categoryId: fieldValue(form, "categoryId") || null,
          lifeAreaId: fieldValue(form, "lifeAreaId") || null,
          description: fieldValue(form, "description").trim() || null,
        });
      }}
    >
      <div className="flex items-center gap-1" role="group" aria-label="Tipo do lançamento">
        {(["saida", "entrada"] as const).map((option) => (
          <Button
            key={option}
            type="button"
            size="sm"
            variant={direction === option ? "default" : "ghost"}
            aria-pressed={direction === option}
            onClick={() => setDirection(option)}
          >
            {option === "saida" ? "Saída" : "Entrada"}
          </Button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-muted-foreground flex flex-col gap-1 text-xs">
          Valor
          <input
            name="amount"
            className={inputClass}
            placeholder="0,00"
            aria-label="Valor"
            inputMode="decimal"
          />
        </label>
        <label className="text-muted-foreground flex flex-col gap-1 text-xs">
          Data
          <input
            name="happenedAt"
            type="date"
            className={inputClass}
            aria-label="Data do lançamento"
            defaultValue={today}
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-muted-foreground flex flex-col gap-1 text-xs">
          Conta
          <select name="accountId" className={inputClass} aria-label="Conta">
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-muted-foreground flex flex-col gap-1 text-xs">
          Categoria
          <select name="categoryId" className={inputClass} defaultValue="">
            <option value="">{doTipo.length > 0 ? "Sem categoria" : "Nenhuma ainda"}</option>
            {doTipo.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-muted-foreground flex flex-col gap-1 text-xs">
          Área de vida
          <select name="lifeAreaId" className={inputClass} defaultValue="">
            <option value="">Sem área</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-muted-foreground flex flex-col gap-1 text-xs">
          Descrição
          <input
            name="description"
            className={inputClass}
            placeholder="opcional"
            aria-label="Descrição"
            maxLength={300}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={!canSubmit || pending}>
          {pending ? "Lançando…" : direction === "saida" ? "Lançar saída" : "Lançar entrada"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
    </form>
  );
}
