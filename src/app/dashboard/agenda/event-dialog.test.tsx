// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { EventDialog } from "./event-dialog";
import { type EventFormValues } from "./event-form";

/** Janela flutuante de compromisso (#34) — abrir, fechar e não guardar sobras. */

afterEach(cleanup);

const baseProps = {
  heading: "Novo compromisso",
  submitLabel: "Marcar",
  pendingLabel: "Marcando…",
  pending: false,
  areas: [{ id: "area-1", name: "Corpo" }],
  priorities: [{ id: "prio-1", name: "Treinar" }],
  onSubmit: () => {},
};

function renderDialog(overrides: Partial<React.ComponentProps<typeof EventDialog>> = {}) {
  const aberturas: boolean[] = [];
  const submetidos: EventFormValues[] = [];

  const ui = (props: Partial<React.ComponentProps<typeof EventDialog>>) => (
    <EventDialog
      target={null}
      {...baseProps}
      onOpenChange={(open) => aberturas.push(open)}
      onSubmit={(values) => submetidos.push(values)}
      {...props}
    />
  );

  const view = render(ui(overrides));
  return {
    aberturas,
    submetidos,
    atualizar: (props: Partial<React.ComponentProps<typeof EventDialog>>) =>
      view.rerender(ui(props)),
  };
}

describe("EventDialog", () => {
  it("fechada, não renderiza o formulário — a agenda fica inteira à vista", () => {
    renderDialog();
    expect(screen.queryByLabelText("Título")).toBeNull();
  });

  it("com alvo `new`, abre em branco e com o título de criação", () => {
    renderDialog({ target: "new" });

    expect(screen.getByText("Novo compromisso")).toBeTruthy();
    expect((screen.getByLabelText("Título") as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("button", { name: "Marcar" })).toBeTruthy();
  });

  it("com um evento como alvo, abre preenchido para edição", () => {
    renderDialog({
      target: { id: "evento-1" },
      heading: "Editar compromisso",
      submitLabel: "Salvar",
      pendingLabel: "Salvando…",
      initial: {
        title: "Terapia",
        description: null,
        startsAt: new Date(2026, 7, 18, 9, 0),
        endsAt: new Date(2026, 7, 18, 10, 0),
        frequency: "weekly",
        lifeAreaId: null,
        priorityId: null,
        reminderMinutesBefore: 30,
      },
      notice: "Este compromisso se repete.",
    });

    expect(screen.getByText("Editar compromisso")).toBeTruthy();
    expect((screen.getByLabelText("Título") as HTMLInputElement).value).toBe("Terapia");
    expect(screen.getByText("Este compromisso se repete.")).toBeTruthy();
  });

  it("cancelar pede o fechamento ao container", () => {
    const dialog = renderDialog({ target: "new" });

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(dialog.aberturas).toContain(false);
  });

  it("reabrir depois de fechar não traz sobras do compromisso anterior", () => {
    // É a garantia de limpeza depois de salvar: fechar desmonta o formulário.
    const dialog = renderDialog({ target: "new" });

    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Corrida" } });
    fireEvent.change(screen.getByLabelText("Início"), { target: { value: "2026-08-17T07:00" } });

    dialog.atualizar({ target: null });
    dialog.atualizar({ target: "new" });

    expect((screen.getByLabelText("Título") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Início") as HTMLInputElement).value).toBe("");
  });

  it("trocar de compromisso com a janela aberta troca o preenchimento", () => {
    const primeiro: EventFormValues = {
      title: "Terapia",
      description: null,
      startsAt: new Date(2026, 7, 18, 9, 0),
      endsAt: new Date(2026, 7, 18, 10, 0),
      frequency: "none",
      lifeAreaId: null,
      priorityId: null,
      reminderMinutesBefore: null,
    };
    const dialog = renderDialog({ target: { id: "evento-1" }, initial: primeiro });

    dialog.atualizar({
      target: { id: "evento-2" },
      initial: { ...primeiro, title: "Dentista" },
    });

    expect((screen.getByLabelText("Título") as HTMLInputElement).value).toBe("Dentista");
  });

  it("salvar entrega os valores ao container", () => {
    const dialog = renderDialog({ target: "new" });

    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Corrida" } });
    fireEvent.change(screen.getByLabelText("Início"), { target: { value: "2026-08-17T07:00" } });
    fireEvent.change(screen.getByLabelText("Fim"), { target: { value: "2026-08-17T08:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Marcar" }));

    expect(dialog.submetidos).toHaveLength(1);
    expect(dialog.submetidos[0]!.title).toBe("Corrida");
  });
});
