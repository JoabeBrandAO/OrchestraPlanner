"use client";

import { useState } from "react";

import { parseAmount } from "@/server/services/finance/money";
import { Button } from "@/components/ui/button";
import { fieldValue, hasText } from "@/lib/form";

export const ACCOUNT_KINDS = [
  { value: "corrente", label: "Conta corrente" },
  { value: "poupanca", label: "Poupança" },
  { value: "carteira", label: "Carteira" },
  { value: "cartao", label: "Cartão" },
  { value: "investimento", label: "Investimento" },
] as const;

export type AccountKind = (typeof ACCOUNT_KINDS)[number]["value"];

export type AccountFormValues = {
  name: string;
  kind: AccountKind;
  initialBalanceCents: number;
};

const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

type Props = {
  pending: boolean;
  error?: string | null;
  onSubmit: (values: AccountFormValues) => void;
  onCancel: () => void;
};

/**
 * Nova conta (#52). O saldo inicial **pode ser negativo** — cartão nasce devendo —, então
 * aqui o sinal é aceito, ao contrário do valor de um lançamento, onde o sinal vem do tipo.
 */
export function AccountForm({ pending, error, onSubmit, onCancel }: Props) {
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

        const bruto = fieldValue(form, "initialBalance").trim();
        const negativo = bruto.startsWith("-");
        const cents = parseAmount(negativo ? bruto.slice(1) : bruto) ?? 0;

        onSubmit({
          name: fieldValue(form, "name").trim(),
          kind: fieldValue(form, "kind") as AccountKind,
          initialBalanceCents: negativo ? -cents : cents,
        });
      }}
    >
      <input
        name="name"
        className={inputClass}
        placeholder="Nome da conta"
        aria-label="Nome da conta"
        maxLength={120}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-muted-foreground flex flex-col gap-1 text-xs">
          Tipo
          <select name="kind" className={inputClass} defaultValue="corrente">
            {ACCOUNT_KINDS.map((kind) => (
              <option key={kind.value} value={kind.value}>
                {kind.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-muted-foreground flex flex-col gap-1 text-xs">
          Saldo inicial (pode ser negativo)
          <input
            name="initialBalance"
            className={inputClass}
            placeholder="0,00"
            aria-label="Saldo inicial"
            inputMode="decimal"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={!canSubmit || pending}>
          {pending ? "Criando…" : "Criar conta"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
    </form>
  );
}
