// @vitest-environment jsdom
import { Profiler } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { EventForm, type EventFormValues } from "./event-form";

/**
 * Formulário de compromisso (#34) — comportamento e **custo por tecla**.
 *
 * O bug relatado pelo dono era duplo: o formulário não limpava depois de salvar e digitar
 * data/hora/lembrete travava. A parte de latência é medida aqui em **commits do React**
 * (via `Profiler`), não em milissegundos: commit é o trabalho real de cada tecla e é
 * determinístico, então o teste não vira flaky no CI conforme a máquina.
 */

afterEach(cleanup);

const areas = [{ id: "area-1", name: "Corpo" }];
const priorities = [{ id: "prio-1", name: "Treinar" }];

const baseProps = {
  heading: "Novo compromisso",
  submitLabel: "Marcar",
  pendingLabel: "Marcando…",
  pending: false,
  areas,
  priorities,
};

function renderForm(overrides: Partial<React.ComponentProps<typeof EventForm>> = {}) {
  const submitted: EventFormValues[] = [];
  let commits = 0;

  const ui = (props: Partial<React.ComponentProps<typeof EventForm>>) => (
    <Profiler
      id="event-form"
      onRender={() => {
        commits += 1;
      }}
    >
      <EventForm {...baseProps} onSubmit={(values) => submitted.push(values)} {...props} />
    </Profiler>
  );

  const view = render(ui(overrides));

  return {
    submitted,
    commits: () => commits,
    zeraContador: () => {
      commits = 0;
    },
    remontar: (props: Partial<React.ComponentProps<typeof EventForm>> = {}) =>
      view.rerender(ui(props)),
  };
}

/** Digita caractere a caractere, como um teclado de verdade. */
function digitar(field: HTMLElement, text: string) {
  for (let index = 1; index <= text.length; index += 1) {
    fireEvent.change(field, { target: { value: text.slice(0, index) } });
  }
}

const campo = {
  titulo: () => screen.getByLabelText("Título"),
  descricao: () => screen.getByLabelText("Descrição"),
  inicio: () => screen.getByLabelText("Início") as HTMLInputElement,
  fim: () => screen.getByLabelText("Fim") as HTMLInputElement,
  repeticao: () => screen.getByLabelText("Repetição") as HTMLSelectElement,
  lembrete: () => screen.getByLabelText("Lembrete (minutos antes)") as HTMLInputElement,
  area: () => screen.getByLabelText("Área de vida") as HTMLSelectElement,
  prioridade: () => screen.getByLabelText("Bloco para a prioridade") as HTMLSelectElement,
};

describe("EventForm — estado limpo", () => {
  it("sem `initial`, começa com todos os campos vazios", () => {
    renderForm();

    expect((campo.titulo() as HTMLInputElement).value).toBe("");
    expect((campo.descricao() as HTMLTextAreaElement).value).toBe("");
    expect(campo.inicio().value).toBe("");
    expect(campo.fim().value).toBe("");
    expect(campo.repeticao().value).toBe("none");
    expect(campo.lembrete().value).toBe("");
    expect(campo.area().value).toBe("");
    expect(campo.prioridade().value).toBe("");
  });

  it("remontar por `key` apaga tudo que foi digitado — inclusive data, hora e lembrete", () => {
    // É assim que o container limpa o formulário depois de salvar: nada do compromisso
    // anterior pode sobrar, nem os horários.
    const form = renderForm();

    digitar(campo.titulo(), "Corrida");
    fireEvent.change(campo.inicio(), { target: { value: "2026-08-17T07:00" } });
    fireEvent.change(campo.fim(), { target: { value: "2026-08-17T08:00" } });
    fireEvent.change(campo.lembrete(), { target: { value: "15" } });
    fireEvent.change(campo.repeticao(), { target: { value: "weekly" } });

    form.remontar({ key: "outro" } as never);

    expect((campo.titulo() as HTMLInputElement).value).toBe("");
    expect(campo.inicio().value).toBe("");
    expect(campo.fim().value).toBe("");
    expect(campo.lembrete().value).toBe("");
    expect(campo.repeticao().value).toBe("none");
  });

  it("com `initial`, preenche para edição", () => {
    renderForm({
      initial: {
        title: "Terapia",
        description: "quinzenal",
        startsAt: new Date(2026, 7, 18, 9, 0),
        endsAt: new Date(2026, 7, 18, 10, 0),
        frequency: "weekly",
        lifeAreaId: "area-1",
        priorityId: "prio-1",
        reminderMinutesBefore: 30,
      },
    });

    expect((campo.titulo() as HTMLInputElement).value).toBe("Terapia");
    expect(campo.inicio().value).toBe("2026-08-18T09:00");
    expect(campo.fim().value).toBe("2026-08-18T10:00");
    expect(campo.repeticao().value).toBe("weekly");
    expect(campo.lembrete().value).toBe("30");
    expect(campo.area().value).toBe("area-1");
  });
});

describe("EventForm — submissão", () => {
  it("entrega os valores digitados, com os vazios como `null`", () => {
    const form = renderForm();

    digitar(campo.titulo(), "Corrida");
    fireEvent.change(campo.inicio(), { target: { value: "2026-08-17T07:00" } });
    fireEvent.change(campo.fim(), { target: { value: "2026-08-17T08:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Marcar" }));

    expect(form.submitted).toHaveLength(1);
    const values = form.submitted[0]!;
    expect(values.title).toBe("Corrida");
    expect(values.description).toBeNull();
    expect(values.reminderMinutesBefore).toBeNull();
    expect(values.lifeAreaId).toBeNull();
    expect(values.startsAt.getHours()).toBe(7);
    expect(values.endsAt.getHours()).toBe(8);
  });

  it("sugere uma hora de duração quando o fim está vazio, sem atropelar o que já foi posto", () => {
    renderForm();

    fireEvent.change(campo.inicio(), { target: { value: "2026-08-17T07:00" } });
    expect(campo.fim().value).toBe("2026-08-17T08:00");

    fireEvent.change(campo.fim(), { target: { value: "2026-08-17T09:30" } });
    fireEvent.change(campo.inicio(), { target: { value: "2026-08-17T06:00" } });
    expect(campo.fim().value).toBe("2026-08-17T09:30");
  });

  it("recusa fim antes do início — sem chegar ao `onSubmit`", () => {
    const form = renderForm();

    digitar(campo.titulo(), "Corrida");
    fireEvent.change(campo.inicio(), { target: { value: "2026-08-17T08:00" } });
    fireEvent.change(campo.fim(), { target: { value: "2026-08-17T07:00" } });

    expect(screen.getByText("O fim precisa ser depois do início.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Marcar" }));
    expect(form.submitted).toHaveLength(0);
  });

  it("não salva sem título", () => {
    const form = renderForm();

    fireEvent.change(campo.inicio(), { target: { value: "2026-08-17T07:00" } });
    fireEvent.change(campo.fim(), { target: { value: "2026-08-17T08:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Marcar" }));

    expect(form.submitted).toHaveLength(0);
  });

  it("cancelar avisa o container", () => {
    let cancelou = false;
    renderForm({ onCancel: () => (cancelou = true) });

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(cancelou).toBe(true);
  });
});

/**
 * Orçamento de latência. A linha de base do formulário controlado era **1 commit por
 * tecla** — 22 teclas, 22 commits. O teto abaixo exige uma redução bem maior que os 40%
 * pedidos; ele existe para a regressão aparecer aqui, e não na digitação do dono.
 */
describe("EventForm — custo por tecla", () => {
  const TEXTO = "Reunião de alinhamento"; // 22 caracteres
  const TETO_DE_COMMITS = 4;

  it(`digitar o título custa no máximo ${TETO_DE_COMMITS} commits (linha de base: ${TEXTO.length})`, () => {
    const form = renderForm();
    form.zeraContador();

    const inicio = performance.now();
    digitar(campo.titulo(), TEXTO);
    const decorrido = performance.now() - inicio;

    console.log(
      `[perf] título: ${TEXTO.length} teclas → ${form.commits()} commits em ${decorrido.toFixed(1)} ms`,
    );
    expect(form.commits()).toBeLessThanOrEqual(TETO_DE_COMMITS);
  });

  it(`preencher data, hora e lembrete custa no máximo ${TETO_DE_COMMITS} commits`, () => {
    const form = renderForm();
    form.zeraContador();

    const inicio = performance.now();
    digitar(campo.inicio(), "2026-08-17T07:00");
    digitar(campo.fim(), "2026-08-17T08:30");
    digitar(campo.lembrete(), "15");
    const decorrido = performance.now() - inicio;

    console.log(
      `[perf] data/hora/lembrete: 34 teclas → ${form.commits()} commits em ${decorrido.toFixed(1)} ms`,
    );
    expect(form.commits()).toBeLessThanOrEqual(TETO_DE_COMMITS);
  });
});
