import { describe, expect, it } from "vitest";

import { compareBudget, isMonth, monthOf, monthRange, type BudgetCategory } from "./budget";

/** Orçamento (#53) — regra pura, sem banco. */

const alimentacao: BudgetCategory = { id: "cat-ali", name: "Alimentação", direction: "saida" };
const lazer: BudgetCategory = { id: "cat-laz", name: "Lazer", direction: "saida" };
const salario: BudgetCategory = { id: "cat-sal", name: "Salário", direction: "entrada" };
const categorias = [alimentacao, lazer, salario];

describe("mês do calendário", () => {
  it("aceita AAAA-MM e recusa o resto", () => {
    expect(isMonth("2026-08")).toBe(true);
    expect(isMonth("2026-13")).toBe(false);
    expect(isMonth("2026-00")).toBe(false);
    expect(isMonth("2026-8")).toBe(false);
    expect(isMonth("2026-08-01")).toBe(false);
  });

  it("fecha o intervalo no último dia, inclusive em fevereiro bissexto", () => {
    expect(monthRange("2026-08")).toEqual({ from: "2026-08-01", to: "2026-08-31" });
    expect(monthRange("2026-04")).toEqual({ from: "2026-04-01", to: "2026-04-30" });
    // 2026 não é bissexto; 2028 é. O dia 0 do mês seguinte, em UTC, acerta os dois.
    expect(monthRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(monthRange("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    // Dezembro é o caso que estoura o índice do mês se alguém somar 1 sem virar o ano.
    expect(monthRange("2026-12")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });

  it("recusa mês inválido em vez de devolver intervalo torto", () => {
    expect(() => monthRange("agosto")).toThrow(/Mês inválido/);
  });

  it("tira o mês da data por recorte de texto, sem fuso no caminho", () => {
    expect(monthOf("2026-01-31")).toBe("2026-01");
    expect(monthOf("2026-12-01")).toBe("2026-12");
  });
});

describe("planejado × realizado", () => {
  it("no mês sem lançamento nenhum, o realizado é zero e sobra o orçamento inteiro", () => {
    const resultado = compareBudget({
      month: "2026-08",
      categories: categorias,
      plans: [{ categoryId: alimentacao.id, plannedCents: 80_000 }],
      actuals: [],
    });

    expect(resultado.lines).toHaveLength(1);
    expect(resultado.lines[0]).toMatchObject({
      categoryId: alimentacao.id,
      plannedCents: 80_000,
      realizedCents: 0,
      remainingCents: 80_000,
      status: "dentro",
    });
    expect(resultado.totalRealizedCents).toBe(0);
  });

  it("categoria sem orçamento aparece como 'sem orçamento', não como orçamento zero", () => {
    const resultado = compareBudget({
      month: "2026-08",
      categories: categorias,
      plans: [],
      actuals: [{ categoryId: lazer.id, amountCents: 5_000 }],
    });

    const linha = resultado.lines.find((l) => l.categoryId === lazer.id)!;
    expect(linha.plannedCents).toBeNull();
    expect(linha.remainingCents).toBeNull();
    expect(linha.status).toBe("sem-orcamento");
    // O gasto não desaparece só por não ter sido planejado.
    expect(linha.realizedCents).toBe(5_000);
    expect(resultado.unbudgetedRealizedCents).toBe(5_000);
    expect(resultado.totalPlannedCents).toBe(0);
  });

  it("soma os lançamentos da mesma categoria e acusa o estouro", () => {
    const resultado = compareBudget({
      month: "2026-08",
      categories: categorias,
      plans: [{ categoryId: alimentacao.id, plannedCents: 10_000 }],
      actuals: [
        { categoryId: alimentacao.id, amountCents: 6_000 },
        { categoryId: alimentacao.id, amountCents: 5_050 },
      ],
    });

    const linha = resultado.lines[0]!;
    expect(linha.realizedCents).toBe(11_050);
    // Estouro é sobra negativa, não um campo separado: um número só, sem duas verdades.
    expect(linha.remainingCents).toBe(-1_050);
    expect(linha.status).toBe("estourado");
  });

  it("gastar exatamente o orçado ainda está dentro", () => {
    const resultado = compareBudget({
      month: "2026-08",
      categories: [alimentacao],
      plans: [{ categoryId: alimentacao.id, plannedCents: 10_000 }],
      actuals: [{ categoryId: alimentacao.id, amountCents: 10_000 }],
    });

    expect(resultado.lines[0]!.remainingCents).toBe(0);
    expect(resultado.lines[0]!.status).toBe("dentro");
  });

  it("mostra o que foi lançado sem categoria em vez de escondê-lo", () => {
    const resultado = compareBudget({
      month: "2026-08",
      categories: categorias,
      plans: [{ categoryId: alimentacao.id, plannedCents: 10_000 }],
      actuals: [{ categoryId: null, amountCents: 3_300 }],
    });

    const solto = resultado.lines.find((l) => l.categoryId === null)!;
    expect(solto.name).toBe("Sem categoria");
    expect(solto.realizedCents).toBe(3_300);
    expect(resultado.unbudgetedRealizedCents).toBe(3_300);
  });

  it("não polui a lista com categoria sem orçamento e sem movimento", () => {
    const resultado = compareBudget({
      month: "2026-08",
      categories: categorias,
      plans: [{ categoryId: alimentacao.id, plannedCents: 10_000 }],
      actuals: [],
    });

    expect(resultado.lines.map((l) => l.categoryId)).toEqual([alimentacao.id]);
  });

  it("orça entrada também — receita planejada é plano igual", () => {
    const resultado = compareBudget({
      month: "2026-08",
      categories: categorias,
      plans: [{ categoryId: salario.id, plannedCents: 500_000 }],
      actuals: [{ categoryId: salario.id, amountCents: 480_000 }],
    });

    const linha = resultado.lines.find((l) => l.categoryId === salario.id)!;
    expect(linha.direction).toBe("entrada");
    expect(linha.remainingCents).toBe(20_000);
  });

  it("os totais contam só o que foi orçado, e o resto vai à parte", () => {
    const resultado = compareBudget({
      month: "2026-08",
      categories: categorias,
      plans: [
        { categoryId: alimentacao.id, plannedCents: 80_000 },
        { categoryId: lazer.id, plannedCents: 20_000 },
      ],
      actuals: [
        { categoryId: alimentacao.id, amountCents: 75_000 },
        { categoryId: lazer.id, amountCents: 25_000 },
        { categoryId: null, amountCents: 1_000 },
      ],
    });

    expect(resultado.totalPlannedCents).toBe(100_000);
    expect(resultado.totalRealizedCents).toBe(100_000);
    // O total realizado do orçamento bate por coincidência; o gasto solto não entra nele.
    expect(resultado.unbudgetedRealizedCents).toBe(1_000);
  });

  it("recusa mês inválido", () => {
    expect(() =>
      compareBudget({ month: "2026-13", categories: [], plans: [], actuals: [] }),
    ).toThrow(/Mês inválido/);
  });
});
