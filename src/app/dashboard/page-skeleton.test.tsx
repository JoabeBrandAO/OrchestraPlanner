// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PageSkeleton } from "./page-skeleton";

afterEach(cleanup);

describe("PageSkeleton", () => {
  it("avisa o leitor de tela que carrega e não se passa por uma tela", () => {
    render(<PageSkeleton maxWidth="3xl" />);
    expect(screen.getByRole("status").textContent).toContain("Carregando");
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.queryByRole("main")).toBeNull();
  });

  it("usa a mesma largura da tela que vai substituir", () => {
    const { rerender } = render(<PageSkeleton maxWidth="3xl" />);
    expect(screen.getByRole("status").className).toContain("max-w-3xl");
    rerender(<PageSkeleton maxWidth="4xl" />);
    expect(screen.getByRole("status").className).toContain("max-w-4xl");
    rerender(<PageSkeleton maxWidth="5xl" />);
    expect(screen.getByRole("status").className).toContain("max-w-5xl");
  });

  it("as larguras batem com as das páginas reais", async () => {
    // Se uma página mudar de largura, o esqueleto precisa mudar junto (senão a tela "pula").
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const dir = join(process.cwd(), "src", "app", "dashboard");
    const casos: [string, string][] = [
      ["loading.tsx", "page.tsx"],
      ["prioridades/loading.tsx", "prioridades/page.tsx"],
      ["agenda/loading.tsx", "agenda/page.tsx"],
      ["pessoas/loading.tsx", "pessoas/page.tsx"],
      ["financeiro/loading.tsx", "financeiro/page.tsx"],
    ];
    for (const [loading, page] of casos) {
      const esqueleto = readFileSync(join(dir, loading), "utf8").match(/maxWidth="(\w+)"/)?.[1];
      const tela = readFileSync(join(dir, page), "utf8").match(/max-w-(\w+)/)?.[1];
      expect(esqueleto, loading).toBe(tela);
    }
  });
});
