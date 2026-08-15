// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PersonForm } from "./person-form";
import { todayISO, type PersonFormValues } from "./person-input";

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
  nascimento: () => screen.getByLabelText("Data de nascimento") as HTMLInputElement,
  estadoCivil: () => screen.getByLabelText("Estado civil") as HTMLSelectElement,
  cadastrar: () => screen.getByRole("button", { name: "Cadastrar" }) as HTMLButtonElement,
};

describe("PersonForm — estado inicial", () => {
  it("começa em branco e sem poder salvar", () => {
    renderForm();

    expect(campo.nome().value).toBe("");
    expect(campo.nascimento().value).toBe("");
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

describe("PersonForm — data de nascimento", () => {
  it("é um campo só, que o próprio formato impede de apontar para o futuro", () => {
    renderForm();

    const campoData = campo.nascimento();
    expect(campoData.type).toBe("date");
    // `max` de hoje: o calendário nativo nem oferece as datas seguintes.
    expect(campoData.getAttribute("max")).toBe(todayISO());
  });

  it("vira dia, mês e ano no envio", () => {
    const form = renderForm();

    fireEvent.change(campo.nome(), { target: { value: "Maria" } });
    fireEvent.change(campo.nascimento(), { target: { value: "1990-08-15" } });
    fireEvent.click(campo.cadastrar());

    expect(form.submetidas[0]!.birthday).toEqual({ day: 15, month: 8, year: 1990 });
  });

  it("é opcional — dá para cadastrar sem saber a data", () => {
    const form = renderForm();

    fireEvent.change(campo.nome(), { target: { value: "Maria" } });
    fireEvent.click(campo.cadastrar());

    expect(form.submetidas[0]!.birthday).toBeNull();
  });

  it("bloqueia e avisa se uma data futura chegar mesmo assim", () => {
    // O `max` cobre o calendário; digitação em navegador teimoso, não. Quem decide é a regra.
    const form = renderForm();
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);

    fireEvent.change(campo.nome(), { target: { value: "Maria" } });
    fireEvent.change(campo.nascimento(), { target: { value: todayISO(amanha) } });

    expect(screen.getByText("Confira a data: não pode ser futura nem inexistente.")).toBeTruthy();
    expect(campo.cadastrar().disabled).toBe(true);

    fireEvent.click(campo.cadastrar());
    expect(form.submetidas).toHaveLength(0);
  });
});

describe("PersonForm — envio", () => {
  it("entrega os campos preenchidos, com os vazios como `null`", () => {
    const form = renderForm();

    fireEvent.change(campo.nome(), { target: { value: "  Maria Silva  " } });
    fireEvent.change(campo.nascimento(), { target: { value: "1990-08-15" } });
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
    expect(campo.nascimento().value).toBe("1990-08-15");
    expect((screen.getByLabelText("Data de casamento") as HTMLInputElement).value).toBe(
      "2015-06-20",
    );
  });
});
