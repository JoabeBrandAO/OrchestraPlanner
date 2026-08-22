import { type Cents } from "./money";

/**
 * Orçamento (#53) — regra **pura**, sem banco.
 *
 * Lançar sem orçar mostra o passado; orçar é o que permite decidir o presente. Aqui mora
 * a comparação planejado × realizado, que é a única parte do módulo com risco de conta
 * errada — por isso ela não toca no Postgres e é testada sozinha.
 *
 * **Mês é o do calendário** e começa zerado: nada é copiado do mês anterior. Orçamento
 * herdado em silêncio é orçamento que ninguém decidiu, e o valor do módulo está justamente
 * na decisão consciente.
 */

/** Mês do calendário, no formato `YYYY-MM`. Nunca um `Date`: mês não tem fuso. */
export type Month = string;

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isMonth(value: string): value is Month {
  return MONTH.test(value);
}

/**
 * O intervalo de datas do mês, para filtrar os lançamentos.
 *
 * O último dia sai de `Date.UTC(ano, mês, 0)` — dia 0 do mês seguinte é o último do mês
 * pedido, e o UTC evita que fevereiro encolha um dia em quem está a oeste de Greenwich.
 */
export function monthRange(month: Month): { from: string; to: string } {
  if (!isMonth(month)) throw new Error("Mês inválido (use AAAA-MM).");

  const [year, index] = month.split("-").map(Number) as [number, number];
  const lastDay = new Date(Date.UTC(year, index, 0)).getUTCDate();

  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, "0")}` };
}

/** O mês em que uma data ISO (`AAAA-MM-DD`) cai. Recorte de texto, sem `Date` no caminho. */
export function monthOf(isoDate: string): Month {
  return isoDate.slice(0, 7);
}

export type BudgetCategory = {
  id: string;
  name: string;
  direction: "entrada" | "saida";
};

export type BudgetPlan = {
  categoryId: string;
  plannedCents: Cents;
};

/** O que já aconteceu no mês. `categoryId` nulo = lançamento sem categoria. */
export type BudgetActual = {
  categoryId: string | null;
  amountCents: Cents;
};

export type BudgetLine = {
  categoryId: string | null;
  name: string;
  direction: "entrada" | "saida";
  /** `null` quando a categoria **não tem orçamento** — que é diferente de orçar zero. */
  plannedCents: Cents | null;
  realizedCents: Cents;
  /** Quanto ainda cabe. `null` sem orçamento; negativo quando estourou. */
  remainingCents: Cents | null;
  status: "sem-orcamento" | "dentro" | "estourado";
};

export type BudgetComparison = {
  month: Month;
  lines: BudgetLine[];
  /** Totais **só do que foi orçado** — somar o não-orçado inventaria um plano que não existe. */
  totalPlannedCents: Cents;
  totalRealizedCents: Cents;
  /** O realizado que ficou fora de qualquer orçamento, contado à parte e não escondido. */
  unbudgetedRealizedCents: Cents;
};

/** Categoria sem orçamento e sem lançamento não vira linha — seria ruído numa lista longa. */
function hasSomethingToShow(line: BudgetLine): boolean {
  return line.plannedCents !== null || line.realizedCents > 0;
}

/**
 * Compara o planejado com o realizado do mês.
 *
 * Recebe tudo pronto (categorias, orçamentos e lançamentos **já filtrados pelo mês**) em vez
 * de ir buscar: assim a conta é a mesma na tela, no relatório (#54) e num teste que roda em
 * milissegundos sem banco.
 *
 * O realizado sai sempre dos lançamentos, nunca de uma coluna espelho — mesma regra do saldo
 * das contas e do progresso das metas.
 */
export function compareBudget(input: {
  month: Month;
  categories: readonly BudgetCategory[];
  plans: readonly BudgetPlan[];
  actuals: readonly BudgetActual[];
}): BudgetComparison {
  if (!isMonth(input.month)) throw new Error("Mês inválido (use AAAA-MM).");

  const planned = new Map(input.plans.map((plan) => [plan.categoryId, plan.plannedCents]));

  const realized = new Map<string | null, Cents>();
  for (const actual of input.actuals) {
    realized.set(actual.categoryId, (realized.get(actual.categoryId) ?? 0) + actual.amountCents);
  }

  const lines: BudgetLine[] = [];
  for (const category of input.categories) {
    const plannedCents = planned.get(category.id) ?? null;
    const realizedCents = realized.get(category.id) ?? 0;

    const remainingCents = plannedCents === null ? null : plannedCents - realizedCents;

    const line: BudgetLine = {
      categoryId: category.id,
      name: category.name,
      direction: category.direction,
      plannedCents,
      realizedCents,
      remainingCents,
      status:
        plannedCents === null ? "sem-orcamento" : remainingCents! < 0 ? "estourado" : "dentro",
    };

    if (hasSomethingToShow(line)) lines.push(line);
  }

  // Lançamento sem categoria existe (o campo é opcional) e some se ninguém o mostrar — e o
  // que some do orçamento é exatamente o que estoura a conta no fim do mês.
  const semCategoria = realized.get(null) ?? 0;
  if (semCategoria > 0) {
    lines.push({
      categoryId: null,
      name: "Sem categoria",
      direction: "saida",
      plannedCents: null,
      realizedCents: semCategoria,
      remainingCents: null,
      status: "sem-orcamento",
    });
  }

  let totalPlannedCents = 0;
  let totalRealizedCents = 0;
  let unbudgetedRealizedCents = 0;
  for (const line of lines) {
    if (line.plannedCents === null) {
      unbudgetedRealizedCents += line.realizedCents;
    } else {
      totalPlannedCents += line.plannedCents;
      totalRealizedCents += line.realizedCents;
    }
  }

  return {
    month: input.month,
    lines,
    totalPlannedCents,
    totalRealizedCents,
    unbudgetedRealizedCents,
  };
}
