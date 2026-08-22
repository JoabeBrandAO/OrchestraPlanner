"use client";

import { useState } from "react";

import { formatCents } from "@/server/services/finance/money";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/ui/form-dialog";
import { trpc } from "@/trpc/react";

import { BudgetForm } from "./budget-form";

type Props = {
  /** Mês do calendário, `AAAA-MM` — o mesmo que o extrato está mostrando. */
  month: string;
  monthLabel: string;
};

/** Quanto da barra encher. Estouro não passa de 100%: a cor é que denuncia, não o tamanho. */
function percent(realized: number, planned: number): number {
  if (planned <= 0) return 0;
  return Math.min(100, Math.round((realized / planned) * 100));
}

/**
 * Orçamento do mês (#53): planejado × realizado, categoria por categoria.
 *
 * Lançar sem orçar mostra o passado; orçar é o que permite decidir o presente. O realizado
 * vem sempre dos lançamentos — não há número digitado duas vezes para se desencontrar.
 */
export function BudgetPanel({ month, monthLabel }: Props) {
  const utils = trpc.useUtils();
  const [aberto, setAberto] = useState(false);

  const budget = trpc.finance.budget.useQuery({ month });
  const categories = trpc.finance.categories.useQuery();

  const invalidate = () => utils.finance.budget.invalidate();
  const setBudget = trpc.finance.setBudget.useMutation({
    onSuccess: () => {
      setAberto(false);
      return invalidate();
    },
  });
  const removeBudget = trpc.finance.removeBudget.useMutation({ onSuccess: invalidate });

  const painel = budget.data;
  const linhas = painel?.lines ?? [];
  const orcadas = linhas.filter((linha) => linha.plannedCents !== null);

  // O campo do formulário abre com o que já está orçado: editar é orçar de novo.
  const planned: Record<string, number> = {};
  for (const linha of orcadas) {
    if (linha.categoryId) planned[linha.categoryId] = linha.plannedCents!;
  }

  const temCategoria = (categories.data ?? []).length > 0;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-medium">Orçamento</h2>
        {temCategoria && (
          <Button size="sm" variant="outline" onClick={() => setAberto(true)}>
            + Orçar categoria
          </Button>
        )}
      </div>

      {budget.isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando orçamento…</p>
      ) : orcadas.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
          {temCategoria
            ? "Nenhuma categoria orçada neste mês. Orçar é o que transforma o extrato em decisão."
            : "Crie uma conta para ganhar as categorias e poder orçar."}
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { rotulo: "Planejado", valor: painel!.totalPlannedCents, classe: "" },
              { rotulo: "Realizado", valor: painel!.totalRealizedCents, classe: "" },
              {
                rotulo: "Sobra",
                valor: painel!.totalPlannedCents - painel!.totalRealizedCents,
                classe:
                  painel!.totalRealizedCents > painel!.totalPlannedCents ? "text-red-500" : "",
              },
            ].map((cartao) => (
              <div key={cartao.rotulo} className="rounded-lg border p-3">
                <p className="text-muted-foreground text-xs">{cartao.rotulo}</p>
                <p className={`tabular-nums ${cartao.classe}`}>R$ {formatCents(cartao.valor)}</p>
              </div>
            ))}
          </div>

          <ul className="flex flex-col gap-2">
            {orcadas.map((linha) => {
              const estourou = linha.status === "estourado";
              return (
                <li key={linha.categoryId} className="flex flex-col gap-2 rounded-lg border p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">{linha.name}</span>
                    <span className="text-muted-foreground text-sm tabular-nums">
                      R$ {formatCents(linha.realizedCents)} de R$ {formatCents(linha.plannedCents!)}
                    </span>
                  </div>

                  <div className="bg-muted h-2 overflow-hidden rounded-full">
                    <div
                      className={estourou ? "h-full bg-red-500" : "h-full bg-emerald-600"}
                      style={{ width: `${percent(linha.realizedCents, linha.plannedCents!)}%` }}
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={
                        estourou ? "text-xs text-red-500" : "text-muted-foreground text-xs"
                      }
                    >
                      {estourou
                        ? `Estourou R$ ${formatCents(-linha.remainingCents!)}`
                        : `Ainda cabem R$ ${formatCents(linha.remainingCents!)}`}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={removeBudget.isPending}
                      aria-label={`Remover orçamento de ${linha.name}`}
                      onClick={() => removeBudget.mutate({ categoryId: linha.categoryId!, month })}
                    >
                      Remover
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* O que foi gasto fora de qualquer orçamento é justamente o que estoura o mês. */}
      {painel && painel.unbudgetedRealizedCents > 0 && orcadas.length > 0 && (
        <p className="text-muted-foreground text-xs">
          Fora do orçamento neste mês:{" "}
          <span className="tabular-nums">R$ {formatCents(painel.unbudgetedRealizedCents)}</span> em
          categorias sem plano.
        </p>
      )}

      <FormDialog
        open={aberto}
        onOpenChange={(open) => !open && setAberto(false)}
        title="Orçar categoria"
      >
        <BudgetForm
          categories={(categories.data ?? []).map((category) => ({
            id: category.id,
            name: category.name,
            direction: category.direction,
          }))}
          planned={planned}
          monthLabel={monthLabel}
          pending={setBudget.isPending}
          error={setBudget.error?.message}
          onCancel={() => setAberto(false)}
          onSubmit={(values) => setBudget.mutate({ ...values, month })}
        />
      </FormDialog>
    </section>
  );
}
