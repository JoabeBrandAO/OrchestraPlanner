// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TransactionForm, type TransactionFormValues } from "./transaction-form";

/** Novo lançamento (#52) — o tipo manda no sinal e nas categorias. */

afterEach(cleanup);

const accounts = [{ id: "acc-1", name: "Conta corrente" }];
const categories = [
  { id: "cat-1", name: "Salário", direction: "entrada" as const },
  { id: "cat-2", name: "Moradia", direction: "saida" as const },
];
const areas = [{ id: "area-1", name: "Finanças" }];

function renderForm() {
  const submetidos: TransactionFormValues[] = [];

  render(
    <TransactionForm
      accounts={accounts}
      categories={categories}
      areas={areas}
      today="2026-08-15"
      pending={false}
      onSubmit={(values) => submetidos.push(values)}
      onCancel={() => {}}
    />,
  );

  return { submetidos };
}

const campo = {
  valor: () => screen.getByLabelText("Valor") as HTMLInputElement,
  data: () => screen.getByLabelText("Data do lançamento") as HTMLInputElement,
  categoria: () => screen.getByLabelText("Categoria") as HTMLSelectElement,
  lancarSaida: () => screen.getByRole("button", { name: "Lançar saída" }) as HTMLButtonElement,
};

describe("TransactionForm", () => {
  it("começa como saída, com a data de hoje", () => {
    renderForm();

    expect(screen.getByRole("button", { name: "Saída" }).getAttribute("aria-pressed")).toBe("true");
    expect(campo.data().value).toBe("2026-08-15");
    expect(campo.lancarSaida().disabled).toBe(true);
  });

  it("converte o valor digitado em centavos inteiros", () => {
    const form = renderForm();

    fireEvent.change(campo.valor(), { target: { value: "1.234,56" } });
    fireEvent.click(campo.lancarSaida());

    expect(form.submetidos[0]!.amountCents).toBe(123456);
    expect(form.submetidos[0]!.direction).toBe("saida");
  });

  it("recusa zero e negativo — o sinal é do tipo, não do número", () => {
    const form = renderForm();

    for (const valor of ["0", "0,00", "-50"]) {
      fireEvent.change(campo.valor(), { target: { value: valor } });
      expect(campo.lancarSaida().disabled).toBe(true);
    }

    fireEvent.click(campo.lancarSaida());
    expect(form.submetidos).toHaveLength(0);
  });

  it("as categorias seguem o tipo escolhido", () => {
    // Sem isso dá para lançar salário como "Moradia".
    renderForm();

    expect(screen.queryByRole("option", { name: "Moradia" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Salário" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Entrada" }));

    expect(screen.queryByRole("option", { name: "Salário" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Moradia" })).toBeNull();
  });

  it("trocar para entrada muda o que é enviado", () => {
    const form = renderForm();

    fireEvent.click(screen.getByRole("button", { name: "Entrada" }));
    fireEvent.change(campo.valor(), { target: { value: "3000" } });
    fireEvent.change(campo.categoria(), { target: { value: "cat-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Lançar entrada" }));

    expect(form.submetidos[0]).toMatchObject({
      direction: "entrada",
      amountCents: 300000,
      categoryId: "cat-1",
      accountId: "acc-1",
    });
  });

  it("categoria, área e descrição vazias viram `null`", () => {
    const form = renderForm();

    fireEvent.change(campo.valor(), { target: { value: "10" } });
    fireEvent.click(campo.lancarSaida());

    expect(form.submetidos[0]!.categoryId).toBeNull();
    expect(form.submetidos[0]!.lifeAreaId).toBeNull();
    expect(form.submetidos[0]!.description).toBeNull();
  });
});
