import { describe, expect, it } from "vitest";

import {
  buildReport,
  currentMonth,
  previousMonth,
  recentMonths,
  type ReportTransaction,
} from "./reports";

/** Relatórios (#54) — agregação pura, com o "hoje" injetado de fora. */

const lancamento = (
  happenedAt: string,
  direction: "entrada" | "saida",
  amountCents: number,
  categoryName: string | null = null,
  lifeAreaName: string | null = null,
): ReportTransaction => ({ happenedAt, direction, amountCents, categoryName, lifeAreaName });

describe("meses", () => {
  it("tira o mês de um instante — o 'hoje' entra por parâmetro", () => {
    // Sem injetar, este teste viraria na virada do mês.
    expect(currentMonth(new Date(2026, 7, 22))).toBe("2026-08");
    expect(currentMonth(new Date(2026, 0, 1))).toBe("2026-01");
  });

  it("janeiro volta para dezembro do ano anterior", () => {
    expect(previousMonth("2026-03")).toBe("2026-02");
    expect(previousMonth("2026-01")).toBe("2025-12");
  });

  it("lista os meses da evolução do mais antigo ao mais recente", () => {
    expect(recentMonths("2026-03", 4)).toEqual(["2025-12", "2026-01", "2026-02", "2026-03"]);
    expect(recentMonths("2026-03", 1)).toEqual(["2026-03"]);
    expect(recentMonths("2026-03", 0)).toEqual([]);
  });
});

describe("panorama do mês", () => {
  it("separa entradas, saídas e resultado do período", () => {
    const relatorio = buildReport({
      month: "2026-08",
      transactions: [
        lancamento("2026-08-05", "entrada", 500_000),
        lancamento("2026-08-10", "saida", 120_000),
        lancamento("2026-08-20", "saida", 80_000),
      ],
      consolidatedCents: 1_000_000,
      months: 1,
    });

    expect(relatorio.totals).toEqual({
      month: "2026-08",
      incomeCents: 500_000,
      expenseCents: 200_000,
      resultCents: 300_000,
    });
    // Saldo consolidado é quanto existe; resultado é quanto entrou no mês. São duas coisas.
    expect(relatorio.consolidatedCents).toBe(1_000_000);
  });

  it("ignora o que é de outro mês, inclusive na virada", () => {
    const relatorio = buildReport({
      month: "2026-08",
      transactions: [
        lancamento("2026-07-31", "saida", 999_00),
        lancamento("2026-08-01", "saida", 10_00),
        lancamento("2026-08-31", "saida", 20_00),
        lancamento("2026-09-01", "saida", 999_00),
      ],
      consolidatedCents: 0,
      months: 1,
    });

    expect(relatorio.totals.expenseCents).toBe(30_00);
  });

  it("mês sem lançamento nenhum mostra zero honesto, não tela quebrada", () => {
    const relatorio = buildReport({
      month: "2026-08",
      transactions: [],
      consolidatedCents: 0,
      months: 3,
    });

    expect(relatorio.totals.resultCents).toBe(0);
    expect(relatorio.byCategory).toEqual([]);
    expect(relatorio.byLifeArea).toEqual([]);
    expect(relatorio.evolution).toHaveLength(3);
    expect(relatorio.evolution.every((mes) => mes.resultCents === 0)).toBe(true);
  });
});

describe("para onde foi o dinheiro", () => {
  const transactions = [
    lancamento("2026-08-02", "saida", 60_000, "Moradia", "Corpo"),
    lancamento("2026-08-05", "saida", 30_000, "Alimentação", "Corpo"),
    lancamento("2026-08-09", "saida", 10_000, "Lazer", "Alma"),
    lancamento("2026-08-10", "entrada", 500_000, "Salário", "Corpo"),
  ];

  it("agrupa as saídas por categoria, da maior para a menor, com percentual", () => {
    const relatorio = buildReport({
      month: "2026-08",
      transactions,
      consolidatedCents: 0,
      months: 1,
    });

    expect(relatorio.byCategory).toEqual([
      { label: "Moradia", cents: 60_000, share: 60 },
      { label: "Alimentação", cents: 30_000, share: 30 },
      { label: "Lazer", cents: 10_000, share: 10 },
    ]);
  });

  it("não mistura entrada na conta de gasto", () => {
    const relatorio = buildReport({
      month: "2026-08",
      transactions,
      consolidatedCents: 0,
      months: 1,
    });

    // O salário existe no panorama, mas não vira fatia de gasto.
    expect(relatorio.totals.incomeCents).toBe(500_000);
    expect(relatorio.byCategory.some((fatia) => fatia.label === "Salário")).toBe(false);
  });

  it("agrupa por área de vida somando as categorias", () => {
    const relatorio = buildReport({
      month: "2026-08",
      transactions,
      consolidatedCents: 0,
      months: 1,
    });

    expect(relatorio.byLifeArea).toEqual([
      { label: "Corpo", cents: 90_000, share: 90 },
      { label: "Alma", cents: 10_000, share: 10 },
    ]);
  });

  it("o que não tem rótulo vira fatia própria em vez de sumir", () => {
    const relatorio = buildReport({
      month: "2026-08",
      transactions: [lancamento("2026-08-02", "saida", 40_000)],
      consolidatedCents: 0,
      months: 1,
    });

    expect(relatorio.byCategory).toEqual([{ label: "Sem categoria", cents: 40_000, share: 100 }]);
    expect(relatorio.byLifeArea).toEqual([{ label: "Sem área", cents: 40_000, share: 100 }]);
  });

  it("desempata pelo nome para a lista não dançar a cada leitura", () => {
    const relatorio = buildReport({
      month: "2026-08",
      transactions: [
        lancamento("2026-08-02", "saida", 10_000, "Transporte"),
        lancamento("2026-08-03", "saida", 10_000, "Alimentação"),
      ],
      consolidatedCents: 0,
      months: 1,
    });

    expect(relatorio.byCategory.map((fatia) => fatia.label)).toEqual(["Alimentação", "Transporte"]);
  });
});

describe("evolução mês a mês", () => {
  it("preenche o mês vazio com zero em vez de deixar buraco", () => {
    const relatorio = buildReport({
      month: "2026-08",
      transactions: [
        lancamento("2026-06-10", "entrada", 100_00),
        // Julho não teve nada.
        lancamento("2026-08-10", "saida", 50_00),
      ],
      consolidatedCents: 0,
      months: 3,
    });

    expect(relatorio.evolution).toEqual([
      { month: "2026-06", incomeCents: 100_00, expenseCents: 0, resultCents: 100_00 },
      { month: "2026-07", incomeCents: 0, expenseCents: 0, resultCents: 0 },
      { month: "2026-08", incomeCents: 0, expenseCents: 50_00, resultCents: -50_00 },
    ]);
  });

  it("o último mês da evolução é o mês do relatório, e bate com o panorama", () => {
    const relatorio = buildReport({
      month: "2026-08",
      transactions: [
        lancamento("2026-08-10", "entrada", 300_00),
        lancamento("2026-08-11", "saida", 100_00),
      ],
      consolidatedCents: 0,
      months: 6,
    });

    const ultimo = relatorio.evolution.at(-1)!;
    expect(ultimo.month).toBe("2026-08");
    expect(ultimo).toEqual({ ...relatorio.totals });
  });

  it("recusa mês inválido", () => {
    expect(() =>
      buildReport({ month: "agosto", transactions: [], consolidatedCents: 0, months: 1 }),
    ).toThrow(/Mês inválido/);
  });
});
