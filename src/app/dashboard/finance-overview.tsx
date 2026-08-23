"use client";

import { useState } from "react";

import { formatCents } from "@/server/services/finance/money";
import { currentMonth } from "@/server/services/finance/reports";
import { trpc } from "@/trpc/react";

/**
 * Panorama do dinheiro no dashboard principal (#54).
 *
 * Mostra o mês corrente e os três maiores gastos — o suficiente para saber se está tudo bem
 * sem abrir o Financeiro. O mês é fixado uma vez, no primeiro render: recalcular a cada
 * render faria a tela trocar de mês sozinha na virada da meia-noite, no meio de uma leitura.
 */
export function FinanceOverview() {
  const [month] = useState(() => currentMonth(new Date()));
  const report = trpc.finance.report.useQuery({ month, months: 1 });

  if (report.isLoading) {
    return <p className="text-muted-foreground text-sm">Carregando seu panorama…</p>;
  }
  if (!report.data) return null;

  const { totals, consolidatedCents, byCategory } = report.data;

  if (consolidatedCents === 0 && totals.incomeCents === 0 && totals.expenseCents === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Seu panorama financeiro aparece aqui assim que você criar uma conta e lançar algo.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { rotulo: "Entradas", valor: totals.incomeCents, classe: "text-emerald-600" },
          { rotulo: "Saídas", valor: totals.expenseCents, classe: "text-red-500" },
          {
            rotulo: "Saldo das contas",
            valor: consolidatedCents,
            classe: consolidatedCents < 0 ? "text-red-500" : "",
          },
        ].map((cartao) => (
          <div key={cartao.rotulo} className="rounded-lg border p-3">
            <p className="text-muted-foreground text-xs">{cartao.rotulo}</p>
            <p className={`tabular-nums ${cartao.classe}`}>R$ {formatCents(cartao.valor)}</p>
          </div>
        ))}
      </div>

      {byCategory.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium">Onde o dinheiro foi este mês</h3>
          <ul className="flex flex-col gap-1">
            {byCategory.slice(0, 3).map((fatia) => (
              <li key={fatia.label} className="flex justify-between gap-3 text-sm">
                <span>{fatia.label}</span>
                <span className="text-muted-foreground tabular-nums">
                  R$ {formatCents(fatia.cents)} · {fatia.share}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
