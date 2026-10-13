// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

describe("BottomNav (celular)", () => {
  beforeEach(() => at("/dashboard"));

  function bar() {
    return screen.getByRole("navigation", { name: "Navegação principal" });
  }

  it("mostra 4 destinos com rótulo visível e o botão Mais", () => {
    render(<BottomNav />);
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
    render(<BottomNav />);
    expect(within(bar()).getByRole("link", { name: "Agenda" }).getAttribute("aria-current")).toBe(
      "page",
    );
    expect(bar().querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  });

  it("só o destino atual ganha a pílula (o marcador de página)", () => {
    at("/dashboard/agenda");
    render(<BottomNav />);
    const pills = bar().querySelectorAll('[data-slot="marcador"]');
    expect(pills).toHaveLength(1);
    expect(pills[0]!.closest("a")?.textContent).toBe("Agenda");
  });

  it("o Mais abre a folha com o resto das telas e a Conta", () => {
    render(<BottomNav />);
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
    render(<BottomNav />);
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
    render(<BottomNav />);
    fireEvent.click(within(bar()).getByRole("button", { name: "Mais" }));
    const sheet = screen.getByRole("dialog", { name: "Mais telas" });

    fireEvent.click(within(sheet).getByRole("link", { name: "Financeiro" }));

    expect(within(bar()).getByRole("button", { name: "Mais" }).getAttribute("aria-expanded")).toBe(
      "false",
    );
  });
});

describe("BottomNav: resposta ao toque", () => {
  beforeEach(() => at("/dashboard"));
  afterEach(() => vi.useRealTimers());

  const bar = () => screen.getByRole("navigation", { name: "Navegação principal" });
  const link = (name: string) => within(bar()).getByRole("link", { name });
  const lit = (name: string) => link(name).querySelector('[data-slot="marcador"]') !== null;

  it("o toque acende a aba na hora, antes de a rota mudar", () => {
    render(<BottomNav />);
    expect(lit("Painel")).toBe(true);

    fireEvent.click(link("Agenda"));

    expect(lit("Agenda")).toBe(true);
    expect(lit("Painel")).toBe(false);
    // Uma pílula só, nunca duas.
    expect(bar().querySelectorAll('[data-slot="marcador"]')).toHaveLength(1);
  });

  it("aria-current continua dizendo a página em que o app está, não a tocada", () => {
    render(<BottomNav />);
    fireEvent.click(link("Agenda"));
    expect(link("Painel").getAttribute("aria-current")).toBe("page");
    expect(link("Agenda").getAttribute("aria-current")).toBeNull();
  });

  it("quando a rota muda, a pílula e o aria-current ficam na tela nova", () => {
    const { rerender } = render(<BottomNav />);
    fireEvent.click(link("Agenda"));

    at("/dashboard/agenda");
    rerender(<BottomNav />);

    expect(lit("Agenda")).toBe(true);
    expect(lit("Painel")).toBe(false);
    expect(link("Agenda").getAttribute("aria-current")).toBe("page");
  });

  it("depois que a rota mudou, voltar para a anterior não reacende a aba que foi tocada", () => {
    const { rerender } = render(<BottomNav />);
    fireEvent.click(link("Agenda"));
    at("/dashboard/agenda");
    rerender(<BottomNav />);

    at("/dashboard");
    rerender(<BottomNav />);

    expect(lit("Painel")).toBe(true);
    expect(lit("Agenda")).toBe(false);
  });

  it("tocar noutra aba antes de a primeira chegar passa a pílula para a última tocada", () => {
    render(<BottomNav />);
    fireEvent.click(link("Agenda"));
    fireEvent.click(link("Metas"));
    expect(lit("Metas")).toBe(true);
    expect(lit("Agenda")).toBe(false);
    expect(bar().querySelectorAll('[data-slot="marcador"]')).toHaveLength(1);
  });

  it("clique com Ctrl/Cmd (abrir em outra aba) não mexe na pílula", () => {
    render(<BottomNav />);
    fireEvent.click(link("Agenda"), { ctrlKey: true });
    fireEvent.click(link("Agenda"), { metaKey: true });
    expect(lit("Painel")).toBe(true);
    expect(lit("Agenda")).toBe(false);
  });

  it("se a rota não mudar em 8 s (troca cancelada), a pílula volta para a aba real", () => {
    vi.useFakeTimers();
    render(<BottomNav />);
    fireEvent.click(link("Agenda"));
    expect(lit("Agenda")).toBe(true);

    act(() => {
      vi.advanceTimersByTime(8000);
    });

    expect(lit("Painel")).toBe(true);
    expect(lit("Agenda")).toBe(false);
  });

  it("escolher uma tela do Mais acende o Mais na hora", () => {
    render(<BottomNav />);
    const more = within(bar()).getByRole("button", { name: "Mais" });
    expect(more.getAttribute("data-active")).toBeNull();

    fireEvent.click(more);
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Mais telas" })).getByRole("link", {
        name: "Financeiro",
      }),
    );

    expect(more.getAttribute("data-active")).toBe("true");
    expect(lit("Painel")).toBe(false);
  });
});

describe("BottomNav: gaveta do Mais", () => {
  beforeEach(() => {
    at("/dashboard");
    // O jsdom não tem layout: a gaveta mede 300 px de altura e o limite do arrasto sai dela.
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(300);
    // O Base UI pergunta ao documento qual elemento está sob o dedo; o jsdom não implementa.
    // Aqui o "dedo" está sempre sobre o elemento onde o gesto começou (`drag` o define).
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: () => underFinger,
    });
  });
  afterEach(() => {
    underFinger = null;
    vi.restoreAllMocks();
  });

  let underFinger: Element | null = null;
  // Com a gaveta aberta a barra some para o leitor de tela (de propósito), então o botão
  // é achado pelo atributo, não pelo papel.
  const more = () => document.querySelector("button[aria-expanded]") as HTMLElement;
  const sheet = () => screen.queryByRole("dialog", { name: "Mais telas" });
  const open = () => fireEvent.click(more());

  it("sobe com a animação de entrada curta e fecha por Esc", async () => {
    render(<BottomNav />);
    open();
    const popup = screen.getByRole("dialog", { name: "Mais telas" });
    // 200–250 ms, ease-out, e sem animação para quem pediu menos movimento.
    expect(popup.className).toContain("duration-[240ms]");
    expect(popup.className).toContain("ease-out");
    expect(popup.className).toContain("motion-reduce:transition-none");

    fireEvent.keyDown(popup, { key: "Escape" });

    await waitFor(() => expect(sheet()).toBeNull());
    expect(more().getAttribute("aria-expanded")).toBe("false");
  });

  it("fecha com um toque no fundo escurecido", async () => {
    render(<BottomNav />);
    open();
    const viewport = screen.getByRole("dialog", { name: "Mais telas" }).parentElement!;

    fireEvent.pointerDown(viewport, { pointerType: "touch", button: 0 });
    fireEvent.pointerUp(viewport, { pointerType: "touch", button: 0 });
    fireEvent.click(viewport);

    await waitFor(() => expect(sheet()).toBeNull());
  });

  it("fecha quando a rota muda (voltar do navegador, por exemplo)", async () => {
    const { rerender } = render(<BottomNav />);
    open();
    expect(sheet()).not.toBeNull();

    at("/dashboard/pessoas");
    rerender(<BottomNav />);

    await waitFor(() => expect(sheet()).toBeNull());
  });

  it("devolve o foco ao botão Mais quando fecha", async () => {
    render(<BottomNav />);
    open();
    fireEvent.keyDown(screen.getByRole("dialog", { name: "Mais telas" }), { key: "Escape" });
    await waitFor(() => expect(sheet()).toBeNull());
    expect(document.activeElement).toBe(more());
  });

  /**
   * O limite do arrasto é o do `Drawer` do Base UI, não nosso: fecha se a folha passar de
   * 50% da altura **ou** se o gesto for rápido (≥ 0,5 px/ms). Estes casos fixam esse
   * comportamento — se uma atualização da biblioteca o mudar, o teste avisa.
   *
   * O arrasto começa na alça: com mouse, o conteúdo da folha não arrasta (deixa selecionar
   * texto); no dedo vale a folha toda.
   */
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  async function drag(
    handle: Element,
    totalPx: number,
    steps: number,
    stepMs: number,
    beforeRelease?: () => void,
  ) {
    underFinger = handle;
    const init = { pointerId: 1, pointerType: "mouse", isPrimary: true, button: 0 };
    fireEvent.pointerDown(handle, { ...init, buttons: 1, clientX: 100, clientY: 400 });
    for (let i = 1; i <= steps; i++) {
      if (stepMs > 0) await sleep(stepMs);
      fireEvent.pointerMove(handle, {
        ...init,
        buttons: 1,
        clientX: 100,
        clientY: 400 + (totalPx / steps) * i,
      });
    }
    beforeRelease?.();
    fireEvent.pointerUp(handle, { ...init, buttons: 0, clientX: 100, clientY: 400 + totalPx });
  }
  const handleOf = () =>
    screen.getByRole("dialog", { name: "Mais telas" }).querySelector("[aria-hidden=true]")!;

  it("arrasto curto e lento (um terço da altura) devolve a gaveta ao lugar", async () => {
    render(<BottomNav />);
    open();
    const popup = screen.getByRole("dialog", { name: "Mais telas" });

    await drag(handleOf(), 100 + 50, 5, 80, () => {
      // Sem isto o teste passaria também se o arrasto nem tivesse começado.
      expect(popup.hasAttribute("data-swiping")).toBe(true);
      expect(parseFloat(popup.style.getPropertyValue("--drawer-swipe-movement-y"))).toBeGreaterThan(
        50,
      );
    });
    await act(async () => sleep(30));

    expect(sheet()).not.toBeNull();
    expect(more().getAttribute("aria-expanded")).toBe("true");
    expect(popup.hasAttribute("data-ending-style")).toBe(false);
  });

  it("arrasto lento além da metade da altura fecha", async () => {
    render(<BottomNav />);
    open();

    await drag(handleOf(), 260, 8, 90);

    await waitFor(() => expect(sheet()).toBeNull());
    expect(more().getAttribute("aria-expanded")).toBe("false");
  });

  it("gesto rápido, mesmo curto, fecha", async () => {
    render(<BottomNav />);
    open();

    await drag(handleOf(), 90, 3, 0);

    await waitFor(() => expect(sheet()).toBeNull());
  });

  it("o fundo clareia junto com o arrasto", async () => {
    render(<BottomNav />);
    open();
    const backdrop = document.querySelector('[data-slot="gaveta-fundo"]') as HTMLElement;
    const handle = handleOf();
    underFinger = handle;
    const init = { pointerId: 1, pointerType: "mouse", isPrimary: true, button: 0, buttons: 1 };

    fireEvent.pointerDown(handle, { ...init, clientX: 100, clientY: 400 });
    await sleep(40);
    fireEvent.pointerMove(handle, { ...init, clientX: 100, clientY: 430 });
    await sleep(40);
    fireEvent.pointerMove(handle, { ...init, clientX: 100, clientY: 520 });

    const progress = Number(backdrop.style.getPropertyValue("--drawer-swipe-progress"));
    expect(progress).toBeGreaterThan(0);
    expect(progress).toBeLessThan(1);
    fireEvent.pointerUp(handle, { ...init, buttons: 0, clientX: 100, clientY: 520 });
  });
});
