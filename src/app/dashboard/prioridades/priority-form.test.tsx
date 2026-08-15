// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PriorityForm, type PriorityFormValues } from "./priority-form";

/** Nova prioridade (#13). */

afterEach(cleanup);

const goals = [{ id: "goal-1", title: "Correr 10 km" }];

function renderForm(comMetas = goals) {
  const submetidas: PriorityFormValues[] = [];

  render(
    <PriorityForm
      goals={comMetas}
      pending={false}
      onSubmit={(values) => submetidas.push(values)}
      onCancel={() => {}}
    />,
  );

  return { submetidas };
}

const campo = {
  titulo: () => screen.getByLabelText("O que precisa ser feito?") as HTMLInputElement,
  meta: () => screen.getByLabelText("Meta vinculada") as HTMLSelectElement,
  prazo: () => screen.getByLabelText("Prazo") as HTMLInputElement,
  nivel: () => screen.getByLabelText("Nível de prioridade") as HTMLSelectElement,
  criar: () => screen.getByRole("button", { name: "Criar prioridade" }) as HTMLButtonElement,
};

describe("PriorityForm", () => {
  it("começa em branco, no nível normal e sem poder salvar", () => {
    renderForm();

    expect(campo.titulo().value).toBe("");
    expect(campo.nivel().value).toBe("0");
    expect(campo.criar().disabled).toBe(true);
  });

  it("entrega os campos preenchidos, com o nível como número", () => {
    const form = renderForm();

    fireEvent.change(campo.titulo(), { target: { value: "Comprar tênis" } });
    fireEvent.change(campo.meta(), { target: { value: "goal-1" } });
    fireEvent.change(campo.prazo(), { target: { value: "2026-09-01" } });
    fireEvent.change(campo.nivel(), { target: { value: "3" } });
    fireEvent.click(campo.criar());

    expect(form.submetidas).toEqual([
      {
        title: "Comprar tênis",
        description: null,
        goalId: "goal-1",
        dueDate: "2026-09-01",
        priorityLevel: 3,
      },
    ]);
  });

  it("meta e prazo vazios viram `null`", () => {
    const form = renderForm();

    fireEvent.change(campo.titulo(), { target: { value: "Comprar tênis" } });
    fireEvent.click(campo.criar());

    expect(form.submetidas[0]!.goalId).toBeNull();
    expect(form.submetidas[0]!.dueDate).toBeNull();
    expect(form.submetidas[0]!.priorityLevel).toBe(0);
  });

  it("sem metas, explica e mantém o cadastro possível", () => {
    renderForm([]);

    expect(screen.getByText("Nenhuma meta ainda")).toBeTruthy();
    fireEvent.change(campo.titulo(), { target: { value: "Comprar tênis" } });
    expect(campo.criar().disabled).toBe(false);
  });
});
