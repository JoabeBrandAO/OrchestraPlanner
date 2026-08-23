"use client";

import { formatCents } from "@/server/services/finance/money";
import { trpc } from "@/trpc/react";

type Props = {
  /** Mês do calendário, `AAAA-MM` — o mesmo do extrato e do orçamento. */
  month: string;
};

const monthShort = new Intl.DateTimeFormat("pt-BR", { month: "short" });

/** "2026-08" → "ago." — sem `new Date("2026-08")`, que o fuso empurraria para julho. */
function monthLabel(month: string): string {
  const [year, index] = month.split("-").map(Number) as [number, number];
  return monthShort.format(new Date(year, index - 1, 1));
}

function Card({ label, value, tone }: { label: string; value: number; tone?: "bad" | "good" }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p
        className={
          tone === "bad"
            ? "text-red-500 tabular-nums"
            : tone === "good"
              ? "text-emerald-600 tabular-nums"
              : "tabular-nums"
        }
      >
        R$ {formatCents(value)}
      </p>
    </div>
  );
}

/** Uma lista de fatias (categoria ou área), com a barra proporcional ao gasto. */
function Slices({ slices }: { slices: { label: string; cents: number; share: number }[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {slices.map((fatia) => (
        <li key={fatia.label} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span>{fatia.label}</span>
            <span className="text-muted-foreground tabular-nums">
              R$ {formatCents(fatia.cents)} · {fatia.share}%
            </span>
          </div>
          <div className="bg-muted h-1.5 overflow-hidden rounded-full">
            <div className="bg-foreground/60 h-full" style={{ width: `${fatia.share}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Panorama do mês (#54): para onde foi o dinheiro e como os meses vêm se comportando.
 *
 * Os números do panorama vêm do **servidor**, da mesma leitura que soma as contas — em vez de
 * serem recalculados aqui a partir do extrato. Duas contas para o mesmo número na mesma tela
 * é o começo de duas verdades.
 */
export function ReportPanel({ month }: Props) {
  const report = trpc.finance.report.useQuery({ month });

  if (report.isLoading) {
    return <p className="text-muted-foreground text-sm">Carregando o panorama…</p>;
  }
  if (!report.data) return null;

  const { totals, consolidatedCents, byCategory, byLifeArea, evolution } = report.data;
  const vazio = totals.incomeCents === 0 && totals.expenseCents === 0;

  // A barra da evolução é relativa ao maior mês da janela: comparar meses entre si é a
  // pergunta, e uma escala fixa achataria justamente o que se quer enxergar.
  const teto = Math.max(...evolution.map((mes) => Math.max(mes.incomeCents, mes.expenseCents)), 1);

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-medium">Panorama</h2>

      <div className="grid gap-3 sm:grid-cols-4">
        <Card label="Entradas" value={totals.incomeCents} tone="good" />
        <Card label="Saídas" value={totals.expenseCents} tone="bad" />
        <Card
          label="Resultado do mês"
          value={totals.resultCents}
          tone={totals.resultCents < 0 ? "bad" : undefined}
        />
        <Card label="Saldo das contas" value={consolidatedCents} />
      </div>

      {vazio ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
          Nenhum lançamento neste mês — nada para relatar ainda.
        </p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">Gastos por categoria</h3>
            <Slices slices={byCategory} />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">Gastos por área de vida</h3>
            <Slices slices={byLifeArea} />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Evolução</h3>
        <ul className="flex flex-col gap-2">
          {evolution.map((mes) => (
            <li key={mes.month} className="flex items-center gap-3 text-xs">
              <span className="text-muted-foreground w-10 shrink-0 capitalize">
                {monthLabel(mes.month)}
              </span>
              <div className="flex flex-1 flex-col gap-1">
                <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                  <div
                    className="h-full bg-emerald-600"
                    style={{ width: `${(mes.incomeCents / teto) * 100}%` }}
                  />
                </div>
                <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                  <div
                    className="h-full bg-red-500"
                    style={{ width: `${(mes.expenseCents / teto) * 100}%` }}
                  />
                </div>
              </div>
              <span
                className={
                  mes.resultCents < 0
                    ? "w-24 shrink-0 text-right text-red-500 tabular-nums"
                    : "w-24 shrink-0 text-right tabular-nums"
                }
              >
                R$ {formatCents(mes.resultCents)}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground text-xs">
          Barra de cima: entradas. De baixo: saídas. À direita, o resultado do mês.
        </p>
      </div>
    </section>
  );
}
