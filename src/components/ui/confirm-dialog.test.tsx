// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ConfirmDialog } from "./confirm-dialog";

afterEach(cleanup);

function renderConfirm(overrides: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  const calls = { confirm: 0, openChanges: [] as boolean[] };
  render(
    <ConfirmDialog
      open
      onOpenChange={(open) => calls.openChanges.push(open)}
      title="Remover a conta Nubank?"
      description="Todos os lançamentos dela também são apagados."
      confirmLabel="Remover conta e lançamentos"
      pendingLabel="Removendo…"
      pending={false}
      onConfirm={() => calls.confirm++}
      {...overrides}
    />,
  );
  return calls;
}

describe("ConfirmDialog", () => {
  it("diz o que vai junto antes de apagar", () => {
    renderConfirm();
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(screen.getByText("Remover a conta Nubank?")).toBeTruthy();
    expect(screen.getByText("Todos os lançamentos dela também são apagados.")).toBeTruthy();
  });

  it("só apaga no botão de confirmar; Cancelar fecha sem apagar", () => {
    const calls = renderConfirm();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(calls.confirm).toBe(0);
    expect(calls.openChanges).toEqual([false]);

    fireEvent.click(screen.getByRole("button", { name: "Remover conta e lançamentos" }));
    expect(calls.confirm).toBe(1);
  });

  it("enquanto apaga, os dois botões travam e o rótulo diz o que está acontecendo", () => {
    renderConfirm({ pending: true });
    const confirmar = screen.getByRole("button", { name: "Removendo…" }) as HTMLButtonElement;
    const cancelar = screen.getByRole("button", { name: "Cancelar" }) as HTMLButtonElement;
    expect(confirmar.disabled).toBe(true);
    expect(cancelar.disabled).toBe(true);
  });

  it("erro do servidor aparece dentro da janela e é anunciado", () => {
    renderConfirm({ error: "Conta não encontrada." });
    expect(screen.getByRole("alert").textContent).toBe("Conta não encontrada.");
  });

  it("fechada, não desenha nada", () => {
    renderConfirm({ open: false });
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});
