// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AreaForm, type AreaFormValues } from "./area-form";

/** Nova Área de Vida — o mesmo contrato dos outros formulários de cadastro do app. */

afterEach(cleanup);

function renderForm() {
  const submetidos: AreaFormValues[] = [];
  let cancelou = false;

  render(
    <AreaForm
      pending={false}
      onSubmit={(values) => submetidos.push(values)}
      onCancel={() => (cancelou = true)}
    />,
  );

  return { submetidos, cancelou: () => cancelou };
}

const campo = {
  nome: () => screen.getByLabelText("Nome da área") as HTMLInputElement,
  dimensao: () => screen.getByLabelText("Dimensão") as HTMLSelectElement,
  criar: () => screen.getByRole("button", { name: "Criar área" }),
};

describe("AreaForm", () => {
  it("começa em branco, na primeira dimensão e sem poder salvar", () => {
    renderForm();

    expect(campo.nome().value).toBe("");
    expect(campo.dimensao().value).toBe("corpo");
    expect((campo.criar() as HTMLButtonElement).disabled).toBe(true);
  });

  it("libera o salvar quando o nome tem conteúdo", () => {
    renderForm();

    fireEvent.change(campo.nome(), { target: { value: "Finanças" } });
    expect((campo.criar() as HTMLButtonElement).disabled).toBe(false);

    // Só espaço não é nome.
    fireEvent.change(campo.nome(), { target: { value: "   " } });
    expect((campo.criar() as HTMLButtonElement).disabled).toBe(true);
  });

  it("entrega nome aparado e dimensão escolhida", () => {
    const form = renderForm();

    fireEvent.change(campo.nome(), { target: { value: "  Finanças  " } });
    fireEvent.change(campo.dimensao(), { target: { value: "alma" } });
    fireEvent.click(campo.criar());

    expect(form.submetidos).toEqual([{ name: "Finanças", dimension: "alma" }]);
  });

  it("cancelar avisa o container", () => {
    const form = renderForm();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(form.cancelou()).toBe(true);
  });
});
