// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { GoalForm, type GoalFormValues } from "./goal-form";

/** Nova meta (US-1.1). */

afterEach(cleanup);

const areas = [
  { id: "area-1", name: "Corpo" },
  { id: "area-2", name: "Espírito" },
];

function renderForm(comAreas = areas) {
  const submetidas: GoalFormValues[] = [];

  render(
    <GoalForm
      areas={comAreas}
      pending={false}
      onSubmit={(values) => submetidas.push(values)}
      onCancel={() => {}}
    />,
  );

  return { submetidas };
}

const campo = {
  titulo: () => screen.getByLabelText("Título da meta") as HTMLInputElement,
  descricao: () => screen.getByLabelText("Descrição") as HTMLTextAreaElement,
  area: () => screen.getByLabelText("Área de vida") as HTMLSelectElement,
  criar: () => screen.getByRole("button", { name: "Criar meta" }) as HTMLButtonElement,
};

describe("GoalForm", () => {
  it("começa em branco e sem poder salvar", () => {
    renderForm();

    expect(campo.titulo().value).toBe("");
    expect(campo.descricao().value).toBe("");
    expect(campo.area().value).toBe("");
    expect(campo.criar().disabled).toBe(true);
  });

  it("entrega os campos preenchidos", () => {
    const form = renderForm();

    fireEvent.change(campo.titulo(), { target: { value: "Correr 10 km" } });
    fireEvent.change(campo.descricao(), { target: { value: "até dezembro" } });
    fireEvent.change(campo.area(), { target: { value: "area-1" } });
    fireEvent.click(campo.criar());

    expect(form.submetidas).toEqual([
      { title: "Correr 10 km", description: "até dezembro", lifeAreaId: "area-1" },
    ]);
  });

  it("descrição e área vazias viram `null`, não string vazia", () => {
    const form = renderForm();

    fireEvent.change(campo.titulo(), { target: { value: "Correr 10 km" } });
    fireEvent.click(campo.criar());

    expect(form.submetidas[0]!.description).toBeNull();
    expect(form.submetidas[0]!.lifeAreaId).toBeNull();
  });

  it("sem áreas cadastradas, o select diz isso em vez de fingir uma opção", () => {
    renderForm([]);
    expect(screen.getByText("Nenhuma área ainda")).toBeTruthy();
  });
});
