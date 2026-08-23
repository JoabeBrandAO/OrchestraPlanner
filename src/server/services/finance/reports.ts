import { isMonth, monthOf, type Month } from "./budget";
import { type Cents } from "./money";

/**
 * Relatórios do Financeiro (#54) — regra **pura**, sem banco.
 *
 * É o que responde "para onde foi o dinheiro". Toda a agregação mora aqui, e **nada aqui lê
 * o relógio**: o mês de referência é sempre recebido de fora. Um relatório que consulta
 * `new Date()` por dentro é um relatório cujo teste passa hoje e vira na virada do mês.
 */

/** O lançamento como o relatório precisa dele — já com os rótulos, sem ids. */
export type ReportTransaction = {
  happenedAt: string;
  direction: "entrada" | "saida";
  amountCents: Cents;
  categoryName: string | null;
  lifeAreaName: string | null;
};

export type MonthTotals = {
  month: Month;
  incomeCents: Cents;
  expenseCents: Cents;
  /** Entradas − saídas **do período**. Não confundir com o saldo das contas. */
  resultCents: Cents;
};

export type SpendingSlice = {
  label: string;
  cents: Cents;
  /** Percentual **inteiro** do total de saídas. Arredondado: a soma pode não dar 100. */
  share: number;
};

export type FinanceReport = {
  month: Month;
  totals: MonthTotals;
  /** Saldo somado de todas as contas — o quanto existe, não o quanto entrou no mês. */
  consolidatedCents: Cents;
  byCategory: SpendingSlice[];
  byLifeArea: SpendingSlice[];
  /** Do mais antigo para o mais recente, terminando no mês do relatório. */
  evolution: MonthTotals[];
};

/** O mês do calendário em que um instante cai. O "hoje" entra por aqui, nunca por dentro. */
export function currentMonth(now: Date): Month {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** O mês anterior. Janeiro volta para dezembro do ano passado — o caso que quebra `-1`. */
export function previousMonth(month: Month): Month {
  if (!isMonth(month)) throw new Error("Mês inválido (use AAAA-MM).");

  const [year, index] = month.split("-").map(Number) as [number, number];
  return index === 1 ? `${year - 1}-12` : `${year}-${String(index - 1).padStart(2, "0")}`;
}

/** Os `count` meses que terminam em `anchor`, do mais antigo para o mais recente. */
export function recentMonths(anchor: Month, count: number): Month[] {
  if (count < 1) return [];

  const meses = [anchor];
  while (meses.length < count) meses.unshift(previousMonth(meses[0]!));
  return meses;
}

/** Entradas, saídas e resultado de um conjunto de lançamentos já filtrado pelo mês. */
function totalize(month: Month, transactions: readonly ReportTransaction[]): MonthTotals {
  let incomeCents = 0;
  let expenseCents = 0;

  for (const item of transactions) {
    if (item.direction === "entrada") incomeCents += item.amountCents;
    else expenseCents += item.amountCents;
  }

  return { month, incomeCents, expenseCents, resultCents: incomeCents - expenseCents };
}

/**
 * Fatia as **saídas** por um rótulo. Entradas ficam de fora de propósito: "para onde foi o
 * dinheiro" é uma pergunta sobre gasto, e misturar salário com aluguel numa mesma pizza não
 * responde nada.
 *
 * Sem rótulo vira uma fatia própria (`semRotulo`) em vez de sumir — o que some do relatório
 * é exatamente o que ninguém consegue explicar no fim do mês.
 */
function slice(
  transactions: readonly ReportTransaction[],
  label: (item: ReportTransaction) => string | null,
  semRotulo: string,
): SpendingSlice[] {
  const totais = new Map<string, Cents>();
  let total = 0;

  for (const item of transactions) {
    if (item.direction !== "saida") continue;
    const chave = label(item) ?? semRotulo;
    totais.set(chave, (totais.get(chave) ?? 0) + item.amountCents);
    total += item.amountCents;
  }

  return (
    [...totais.entries()]
      .map(([rotulo, cents]) => ({
        label: rotulo,
        cents,
        // Percentual inteiro, arredondado: a soma das fatias pode dar 99 ou 101. Prefiro isso
        // a inventar precisão que o número não tem.
        share: total === 0 ? 0 : Math.round((cents / total) * 100),
      }))
      // Maior gasto primeiro; empate desempatado pelo nome, para a lista não dançar a cada
      // leitura (a ordem de um `Map` é a de inserção, que depende do banco).
      .sort((a, b) => b.cents - a.cents || a.label.localeCompare(b.label, "pt-BR"))
  );
}

/**
 * Monta o relatório do mês a partir da janela de lançamentos já lida do banco.
 *
 * Recebe a janela inteira (o mês do relatório **mais** os anteriores da evolução) e separa
 * em memória: são poucas centenas de linhas, e uma ida ao banco a menos vale mais do que
 * um `group by` a mais no Postgres.
 */
export function buildReport(input: {
  month: Month;
  transactions: readonly ReportTransaction[];
  consolidatedCents: Cents;
  /** Quantos meses a evolução mostra, terminando no mês do relatório. */
  months: number;
}): FinanceReport {
  if (!isMonth(input.month)) throw new Error("Mês inválido (use AAAA-MM).");

  const doMes = input.transactions.filter((item) => monthOf(item.happenedAt) === input.month);

  return {
    month: input.month,
    totals: totalize(input.month, doMes),
    consolidatedCents: input.consolidatedCents,
    byCategory: slice(doMes, (item) => item.categoryName, "Sem categoria"),
    byLifeArea: slice(doMes, (item) => item.lifeAreaName, "Sem área"),
    // Mês sem lançamento nenhum entra zerado, e não some da linha do tempo: buraco no meio
    // da evolução faria a leitura mentir sobre o que aconteceu.
    evolution: recentMonths(input.month, input.months).map((mes) =>
      totalize(
        mes,
        input.transactions.filter((item) => monthOf(item.happenedAt) === mes),
      ),
    ),
  };
}
