"use client";

import { useState } from "react";

import { formatCents, sumCents } from "@/server/services/finance/money";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/ui/form-dialog";
import { trpc } from "@/trpc/react";

import { ACCOUNT_KINDS, AccountForm } from "./account-form";
import { BudgetPanel } from "./budget-panel";
import { TransactionForm } from "./transaction-form";

const dateLabel = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Primeiro e último dia do mês da âncora, em ISO — a janela do extrato. */
function monthRange(anchor: Date) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  return { from: iso(first), to: iso(last) };
}

/**
 * Financeiro (#52): contas com saldo e o extrato do mês. Segue o padrão de "novo registro"
 * das demais telas — botão, janela flutuante, formulário não controlado.
 */
export function FinanceManager() {
  const utils = trpc.useUtils();
  const [anchor, setAnchor] = useState(() => new Date());
  const [dialog, setDialog] = useState<"conta" | "lancamento" | null>(null);

  const range = monthRange(anchor);
  /** O mesmo mês do extrato, em `AAAA-MM` — extrato e orçamento andam juntos. */
  const month = range.from.slice(0, 7);
  const accounts = trpc.finance.accounts.useQuery();
  const categories = trpc.finance.categories.useQuery();
  const areas = trpc.lifeAreas.list.useQuery();
  const transactions = trpc.finance.transactions.useQuery(range);

  const invalidate = () => {
    utils.finance.accounts.invalidate();
    utils.finance.transactions.invalidate();
    // O realizado do orçamento é derivado dos lançamentos: mexeu num, o outro está velho.
    utils.finance.budget.invalidate();
    return utils.finance.categories.invalidate();
  };
  const close = () => {
    setDialog(null);
    return invalidate();
  };

  const createAccount = trpc.finance.createAccount.useMutation({ onSuccess: close });
  const createTransaction = trpc.finance.createTransaction.useMutation({ onSuccess: close });
  const deleteTransaction = trpc.finance.deleteTransaction.useMutation({ onSuccess: invalidate });
  const deleteAccount = trpc.finance.deleteAccount.useMutation({ onSuccess: invalidate });

  const contas = accounts.data ?? [];
  const lancamentos = transactions.data ?? [];
  const temConta = contas.length > 0;

  // Somas do mês, em centavos: aritmética de inteiro, nunca de reais.
  const entradas = sumCents(
    lancamentos.filter((t) => t.direction === "entrada").map((t) => t.amountCents),
  );
  const saidas = sumCents(
    lancamentos.filter((t) => t.direction === "saida").map((t) => t.amountCents),
  );
  const consolidado = sumCents(contas.map((account) => account.balanceCents));

  return (
    <div className="flex flex-col gap-6">
      {/* Contas */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium">Contas</h2>
          {temConta && (
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground text-sm">
                Total: <span className="tabular-nums">R$ {formatCents(consolidado)}</span>
              </span>
              <Button size="sm" onClick={() => setDialog("conta")}>
                + Nova conta
              </Button>
            </div>
          )}
        </div>

        {accounts.isLoading ? (
          <p className="text-muted-foreground text-sm">Carregando contas…</p>
        ) : temConta ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {contas.map((account) => (
              <li
                key={account.id}
                className="flex items-start justify-between gap-3 rounded-lg border p-4"
              >
                <div>
                  <p className="font-medium">{account.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {ACCOUNT_KINDS.find((kind) => kind.value === account.kind)?.label}
                  </p>
                  <p
                    className={
                      account.balanceCents < 0
                        ? "mt-1 text-red-500 tabular-nums"
                        : "mt-1 tabular-nums"
                    }
                  >
                    R$ {formatCents(account.balanceCents)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={deleteAccount.isPending}
                  aria-label={`Remover conta ${account.name}`}
                  onClick={() => deleteAccount.mutate({ id: account.id })}
                >
                  Remover
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
            <p className="text-muted-foreground text-sm">
              Nenhuma conta ainda. Comece por onde o dinheiro entra e sai. 💰
            </p>
            <Button size="sm" onClick={() => setDialog("conta")}>
              + Nova conta
            </Button>
          </div>
        )}
      </section>

      {/* Extrato do mês */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              aria-label="Mês anterior"
              onClick={() => setAnchor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            >
              ←
            </Button>
            <span className="text-sm font-medium capitalize">{monthLabel.format(anchor)}</span>
            <Button
              size="sm"
              variant="outline"
              aria-label="Próximo mês"
              onClick={() => setAnchor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            >
              →
            </Button>
          </div>

          {temConta && (
            <Button size="sm" onClick={() => setDialog("lancamento")}>
              + Novo lançamento
            </Button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { rotulo: "Entradas", valor: entradas, classe: "text-emerald-600" },
            { rotulo: "Saídas", valor: saidas, classe: "text-red-500" },
            { rotulo: "Resultado", valor: entradas - saidas, classe: "" },
          ].map((cartao) => (
            <div key={cartao.rotulo} className="rounded-lg border p-3">
              <p className="text-muted-foreground text-xs">{cartao.rotulo}</p>
              <p className={`tabular-nums ${cartao.classe}`}>R$ {formatCents(cartao.valor)}</p>
            </div>
          ))}
        </div>

        {transactions.isLoading ? (
          <p className="text-muted-foreground text-sm">Carregando lançamentos…</p>
        ) : lancamentos.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {lancamentos.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-3 rounded-lg border p-3"
              >
                <div>
                  <p className="text-sm">
                    <span className="text-muted-foreground tabular-nums">
                      {dateLabel.format(new Date(`${item.happenedAt}T12:00:00`))}
                    </span>{" "}
                    <span className="font-medium">
                      {item.description ?? item.categoryName ?? "Lançamento"}
                    </span>
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {[item.accountName, item.categoryName].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={
                      item.direction === "entrada"
                        ? "text-emerald-600 tabular-nums"
                        : "text-red-500 tabular-nums"
                    }
                  >
                    {item.direction === "entrada" ? "+" : "−"} R$ {formatCents(item.amountCents)}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={deleteTransaction.isPending}
                    aria-label="Remover lançamento"
                    onClick={() => deleteTransaction.mutate({ id: item.id })}
                  >
                    Remover
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
            {temConta ? "Nenhum lançamento neste mês." : "Crie uma conta para começar a lançar."}
          </p>
        )}
      </section>

      <BudgetPanel month={month} monthLabel={monthLabel.format(anchor)} />

      <FormDialog
        open={dialog === "conta"}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Nova conta"
      >
        <AccountForm
          pending={createAccount.isPending}
          error={createAccount.error?.message}
          onCancel={() => setDialog(null)}
          onSubmit={(values) => createAccount.mutate(values)}
        />
      </FormDialog>

      <FormDialog
        open={dialog === "lancamento"}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Novo lançamento"
      >
        <TransactionForm
          accounts={contas.map((account) => ({ id: account.id, name: account.name }))}
          categories={(categories.data ?? []).map((category) => ({
            id: category.id,
            name: category.name,
            direction: category.direction,
          }))}
          areas={areas.data ?? []}
          today={iso(new Date())}
          pending={createTransaction.isPending}
          error={createTransaction.error?.message}
          onCancel={() => setDialog(null)}
          onSubmit={(values) => createTransaction.mutate(values)}
        />
      </FormDialog>
    </div>
  );
}
