// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CategoryForm, type CategoryFormValues } from "./category-form";

/** Categoria (#63) — o mesmo formulário cria e renomeia; o sentido só se escolhe ao criar. */

afterEach(cleanup);

function renderForm(initial?: CategoryFormValues) {
  const submetidos: CategoryFormValues[] = [];

  render(
    <CategoryForm
      initial={initial}
      pending={false}
      onSubmit={(values) => submetidos.push(values)}
      onCancel={() => {}}
    />,
  );

  return { submetidos };
}

const campo = {
  nome: () => screen.getByLabelText("Nome da categoria") as HTMLInputElement,
  sentido: () => screen.getByLabelText("Sentido") as HTMLSelectElement,
  criar: () => screen.getByRole("button", { name: "Criar categoria" }) as HTMLButtonElement,
  salvar: () => screen.getByRole("button", { name: "Salvar" }) as HTMLButtonElement,
};

describe("CategoryForm", () => {
  it("criando, começa vazia, como saída e sem poder submeter", () => {
    renderForm();

    expect(campo.nome().value).toBe("");
    expect(campo.sentido().value).toBe("saida");
    expect(campo.criar().disabled).toBe(true);
  });

  it("nome só de espaços não vale", () => {
    const form = renderForm();

    fireEvent.change(campo.nome(), { target: { value: "   " } });
    expect(campo.criar().disabled).toBe(true);

    fireEvent.click(campo.criar());
    expect(form.submetidos).toHaveLength(0);
  });

  it("cria com o nome aparado e o sentido escolhido", () => {
    const form = renderForm();

    fireEvent.change(campo.nome(), { target: { value: "  Freelas  " } });
    fireEvent.change(campo.sentido(), { target: { value: "entrada" } });
    fireEvent.click(campo.criar());

    expect(form.submetidos[0]).toEqual({ name: "Freelas", direction: "entrada" });
  });

  it("renomeando, preenche o nome e trava o sentido", () => {
    // Virar entrada uma categoria com saídas lançadas deixaria os lançamentos órfãos de
    // sentido — por isso o campo aparece, mas não se edita.
    const form = renderForm({ name: "Lazer", direction: "saida" });

    expect(campo.nome().value).toBe("Lazer");
    expect(campo.sentido().disabled).toBe(true);
    expect(campo.salvar().disabled).toBe(false);

    fireEvent.change(campo.nome(), { target: { value: "Diversão" } });
    fireEvent.click(campo.salvar());

    expect(form.submetidos[0]).toEqual({ name: "Diversão", direction: "saida" });
  });
});
