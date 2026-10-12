// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/dashboard" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));

import { BottomNav, SideNav } from "./app-nav";

afterEach(cleanup);

function at(pathname: string) {
  navigation.pathname = pathname;
}

describe("SideNav (computador)", () => {
  beforeEach(() => at("/dashboard/agenda"));

  it("leva a todas as telas, agrupadas pelo jeito de usar", () => {
    render(<SideNav />);
    const nav = screen.getByRole("navigation", { name: "Navegação principal" });
    for (const name of [
      "Painel",
      "Prioridades",
      "Agenda",
      "Metas",
      "Roda da Vida",
      "Áreas de Vida",
      "Pessoas",
      "Financeiro",
      "Conta",
    ]) {
      expect(within(nav).getByRole("link", { name })).toBeTruthy();
    }
    expect(within(nav).getByRole("list", { name: "Dia a dia" })).toBeTruthy();
    expect(within(nav).getByRole("list", { name: "Norte" })).toBeTruthy();
    expect(within(nav).getByRole("list", { name: "Cuidar" })).toBeTruthy();
  });

  it("marca a tela atual com aria-current, e só ela", () => {
    render(<SideNav />);
    expect(screen.getByRole("link", { name: "Agenda" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Painel" }).getAttribute("aria-current")).toBeNull();
    expect(document.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  });

  it("a Conta acende na tela de Conta", () => {
    at("/dashboard/conta");
    render(<SideNav />);
    expect(screen.getByRole("link", { name: "Conta" }).getAttribute("aria-current")).toBe("page");
  });
});

describe.each(["pilula", "traco"] as const)("BottomNav (celular), estilo %s", (variant) => {
  beforeEach(() => at("/dashboard"));

  function bar() {
    return screen.getByRole("navigation", { name: "Navegação principal" });
  }

  it("mostra 4 destinos com rótulo visível e o botão Mais", () => {
    render(<BottomNav variant={variant} />);
    const links = within(bar()).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Painel",
      "Prioridades",
      "Agenda",
      "Metas",
    ]);
    expect(within(bar()).getByRole("button", { name: "Mais" })).toBeTruthy();
  });

  it("marca o destino atual com aria-current", () => {
    at("/dashboard/agenda");
    render(<BottomNav variant={variant} />);
    expect(within(bar()).getByRole("link", { name: "Agenda" }).getAttribute("aria-current")).toBe(
      "page",
    );
    expect(bar().querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  });

  it("o Mais abre a folha com o resto das telas e a Conta", () => {
    render(<BottomNav variant={variant} />);
    const more = within(bar()).getByRole("button", { name: "Mais" });
    expect(more.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(more);

    const sheet = screen.getByRole("dialog", { name: "Mais telas" });
    expect(
      within(sheet)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Pessoas", "Financeiro", "Roda da Vida", "Áreas de Vida", "Conta"]);
    expect(more.getAttribute("aria-expanded")).toBe("true");
  });

  it("numa tela que mora no Mais, o Mais acende e a folha marca a tela", () => {
    at("/dashboard/pessoas");
    render(<BottomNav variant={variant} />);
    const more = within(bar()).getByRole("button", { name: "Mais" });
    expect(more.getAttribute("data-active")).toBe("true");
    expect(bar().querySelectorAll('[aria-current="page"]')).toHaveLength(0);

    fireEvent.click(more);
    const sheet = screen.getByRole("dialog", { name: "Mais telas" });
    expect(within(sheet).getByRole("link", { name: "Pessoas" }).getAttribute("aria-current")).toBe(
      "page",
    );
  });

  it("escolher uma tela na folha fecha a folha", () => {
    render(<BottomNav variant={variant} />);
    fireEvent.click(within(bar()).getByRole("button", { name: "Mais" }));
    const sheet = screen.getByRole("dialog", { name: "Mais telas" });

    fireEvent.click(within(sheet).getByRole("link", { name: "Financeiro" }));

    expect(within(bar()).getByRole("button", { name: "Mais" }).getAttribute("aria-expanded")).toBe(
      "false",
    );
  });
});
