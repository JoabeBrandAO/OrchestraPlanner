// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { BudgetForm, type BudgetFormValues } from "./budget-form";

/** Orçar categoria (#53) — editar é orçar de novo. */

afterEach(cleanup);

const categories = [
  { id: "cat-ali", name: "Alimentação", direction: "saida" as const },
  { id: "cat-laz", name: "Lazer", direction: "saida" as const },
];

function renderForm(planned: Record<string, number> = {}) {
  const submetidos: BudgetFormValues[] = [];

  render(
    <BudgetForm
      categories={categories}
      planned={planned}
      monthLabel="agosto de 2026"
      pending={false}
      onSubmit={(values) => submetidos.push(values)}
      onCancel={() => {}}
    />,
  );

  return { submetidos };
}

const campo = {
  valor: () => screen.getByLabelText("Valor planejado") as HTMLInputElement,
  categoria: () => screen.getByLabelText("Categoria") as HTMLSelectElement,
  salvar: () => screen.getByRole("button", { name: "Salvar orçamento" }) as HTMLButtonElement,
};

describe("BudgetForm", () => {
  it("só deixa salvar depois de um valor válido", () => {
    renderForm();

    expect(campo.salvar().disabled).toBe(true);
    fireEvent.change(campo.valor(), { target: { value: "800" } });
    expect(campo.salvar().disabled).toBe(false);
  });

  it("converte o valor digitado em centavos inteiros", () => {
    const form = renderForm();

    fireEvent.change(campo.valor(), { target: { value: "1.234,56" } });
    fireEvent.click(campo.salvar());

    expect(form.submetidos[0]).toEqual({ categoryId: "cat-ali", plannedCents: 123456 });
  });

  it("recusa orçar zero — orçar zero é o mesmo que não orçar", () => {
    const form = renderForm();

    fireEvent.change(campo.valor(), { target: { value: "0" } });
    fireEvent.click(campo.salvar());

    expect(form.submetidos).toHaveLength(0);
  });

  it("abre com o valor já orçado da categoria, e avisa que salvar corrige", () => {
    renderForm({ "cat-ali": 80000 });

    expect(campo.valor().value).toBe("800,00");
    expect(screen.getByText(/Já orçado: R\$ 800,00/)).toBeTruthy();
  });

  it("trocar de categoria troca o valor mostrado, sem herdar o da anterior", () => {
    // Sem a `key` no input, o React reaproveitaria o campo e o formulário mentiria sobre o
    // que está orçado na categoria escolhida.
    renderForm({ "cat-ali": 80000, "cat-laz": 20000 });

    expect(campo.valor().value).toBe("800,00");
    fireEvent.change(campo.categoria(), { target: { value: "cat-laz" } });
    expect(campo.valor().value).toBe("200,00");
  });

  it("categoria sem orçamento abre com o campo vazio, não com zero", () => {
    renderForm({ "cat-ali": 80000 });

    fireEvent.change(campo.categoria(), { target: { value: "cat-laz" } });
    expect(campo.valor().value).toBe("");
    expect(screen.queryByText(/Já orçado/)).toBeNull();
  });
});
