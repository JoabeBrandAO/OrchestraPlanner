// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PersonForm } from "./person-form";
import { type PersonFormValues } from "./person-input";

/** Cadastro de pessoa (#41) — o que aparece, o que libera o salvar e o que é enviado. */

afterEach(cleanup);

const areas = [{ id: "area-1", name: "Família" }];

function renderForm(initial?: PersonFormValues) {
  const submetidas: PersonFormValues[] = [];

  render(
    <PersonForm
      areas={areas}
      pending={false}
      submitLabel="Cadastrar"
      pendingLabel="Cadastrando…"
      initial={initial}
      onSubmit={(values) => submetidas.push(values)}
      onCancel={() => {}}
    />,
  );

  return { submetidas };
}

const campo = {
  nome: () => screen.getByLabelText("Nome") as HTMLInputElement,
  apelido: () => screen.getByLabelText("Apelido") as HTMLInputElement,
  dia: () => screen.getByLabelText("Dia do aniversário") as HTMLSelectElement,
  mes: () => screen.getByLabelText("Mês do aniversário") as HTMLSelectElement,
  ano: () => screen.getByLabelText("Ano do aniversário") as HTMLInputElement,
  estadoCivil: () => screen.getByLabelText("Estado civil") as HTMLSelectElement,
  cadastrar: () => screen.getByRole("button", { name: "Cadastrar" }) as HTMLButtonElement,
};

describe("PersonForm — estado inicial", () => {
  it("começa em branco e sem poder salvar", () => {
    renderForm();

    expect(campo.nome().value).toBe("");
    expect(campo.dia().value).toBe("");
    expect(campo.cadastrar().disabled).toBe(true);
  });

  it("o nome sozinho já libera o cadastro — o resto é opcional", () => {
    renderForm();

    fireEvent.change(campo.nome(), { target: { value: "Maria" } });
    expect(campo.cadastrar().disabled).toBe(false);
  });
});

describe("PersonForm — data de casamento condicional (#25)", () => {
  it("não aparece para quem não é casado", () => {
    renderForm();
    expect(screen.queryByLabelText("Data de casamento")).toBeNull();
  });

  it("aparece ao escolher casado ou união estável", () => {
    renderForm();

    fireEvent.change(campo.estadoCivil(), { target: { value: "casado" } });
    expect(screen.getByLabelText("Data de casamento")).toBeTruthy();

    fireEvent.change(campo.estadoCivil(), { target: { value: "uniao_estavel" } });
    expect(screen.getByLabelText("Data de casamento")).toBeTruthy();
  });

  it("some de novo — e a data não vai escondida no envio", () => {
    // Campo escondido que continua sendo enviado vira dado fantasma.
    const form = renderForm();

    fireEvent.change(campo.nome(), { target: { value: "Maria" } });
    fireEvent.change(campo.estadoCivil(), { target: { value: "casado" } });
    fireEvent.change(screen.getByLabelText("Data de casamento"), {
      target: { value: "2015-06-20" },
    });
    fireEvent.change(campo.estadoCivil(), { target: { value: "divorciado" } });

    expect(screen.queryByLabelText("Data de casamento")).toBeNull();
    fireEvent.click(campo.cadastrar());
    expect(form.submetidas[0]!.marriedAt).toBeNull();
  });
});

describe("PersonForm — aniversário", () => {
  it("dia e mês bastam; o ano é opcional", () => {
    const form = renderForm();

    fireEvent.change(campo.nome(), { target: { value: "Maria" } });
    fireEvent.change(campo.dia(), { target: { value: "15" } });
    fireEvent.change(campo.mes(), { target: { value: "8" } });
    fireEvent.click(campo.cadastrar());

    expect(form.submetidas[0]!.birthday).toEqual({ day: 15, month: 8, year: null });
  });

  it("bloqueia e avisa quando a data não existe no calendário", () => {
    const form = renderForm();

    fireEvent.change(campo.nome(), { target: { value: "Maria" } });
    fireEvent.change(campo.dia(), { target: { value: "31" } });
    fireEvent.change(campo.mes(), { target: { value: "2" } });

    expect(screen.getByText("Essa data não existe no calendário.")).toBeTruthy();
    expect(campo.cadastrar().disabled).toBe(true);

    fireEvent.click(campo.cadastrar());
    expect(form.submetidas).toHaveLength(0);
  });

  it("dia sem mês não vira aniversário nem erro — é preenchimento pela metade", () => {
    const form = renderForm();

    fireEvent.change(campo.nome(), { target: { value: "Maria" } });
    fireEvent.change(campo.dia(), { target: { value: "15" } });

    expect(campo.cadastrar().disabled).toBe(false);
    fireEvent.click(campo.cadastrar());
    expect(form.submetidas[0]!.birthday).toBeNull();
  });
});

describe("PersonForm — envio", () => {
  it("entrega os campos preenchidos, com os vazios como `null`", () => {
    const form = renderForm();

    fireEvent.change(campo.nome(), { target: { value: "  Maria Silva  " } });
    fireEvent.change(campo.ano(), { target: { value: "1990" } });
    fireEvent.change(campo.dia(), { target: { value: "15" } });
    fireEvent.change(campo.mes(), { target: { value: "8" } });
    fireEvent.click(campo.cadastrar());

    const values = form.submetidas[0]!;
    expect(values.name).toBe("Maria Silva");
    expect(values.nickname).toBeNull();
    expect(values.notes).toBeNull();
    expect(values.lifeAreaId).toBeNull();
    expect(values.birthday).toEqual({ day: 15, month: 8, year: 1990 });
  });

  it("preenche para edição, inclusive a data de casamento", () => {
    renderForm({
      name: "Maria",
      nickname: "Mari",
      birthday: { day: 15, month: 8, year: 1990 },
      gender: "feminino",
      maritalStatus: "casado",
      marriedAt: "2015-06-20",
      relationType: "familia",
      lifeAreaId: "area-1",
      notes: "aniversário sempre na praia",
    });

    expect(campo.nome().value).toBe("Maria");
    expect(campo.apelido().value).toBe("Mari");
    expect(campo.dia().value).toBe("15");
    expect(campo.ano().value).toBe("1990");
    expect((screen.getByLabelText("Data de casamento") as HTMLInputElement).value).toBe(
      "2015-06-20",
    );
  });
});
