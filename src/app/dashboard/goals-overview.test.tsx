// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { summarizeGoals, type SummaryArea } from "@/server/services/dashboard/summary";

const dashboard = vi.hoisted(() => ({ useQuery: vi.fn() }));
vi.mock("@/trpc/react", () => ({ trpc: { dashboard: { goals: dashboard } } }));

import { GoalsOverview } from "./goals-overview";

afterEach(cleanup);

describe("GoalsOverview: distribuição por área", () => {
  it("usa o marcador de cada dimensão e deixa Sem área sem marcador", () => {
    const areas = [
      { id: "saude", name: "Saúde", dimension: "corpo" },
      { id: "financas", name: "Finanças", dimension: "alma" },
      { id: "fe", name: "Fé", dimension: "espirito" },
    ] satisfies SummaryArea[];
    const summary = summarizeGoals(
      [{ lifeAreaId: null, status: "ativa", progress: 25, targetDate: null }],
      areas,
      "2026-10-26",
    );
    dashboard.useQuery.mockReturnValue({
      isLoading: false,
      data: { summary, overdue: [], recent: [] },
    });

    render(<GoalsOverview />);

    for (const area of areas) {
      const label = screen.getByText(area.name).parentElement!;
      const dot = label.querySelector("span[aria-hidden]")!;
      expect(dot.classList.contains(`bg-${area.dimension}`)).toBe(true);
      expect(
        screen.getByRole("progressbar", { name: `Progresso médio em ${area.name}` }),
      ).toBeTruthy();
    }
    expect(
      screen.getByText("Sem área").parentElement!.querySelector("span[aria-hidden]"),
    ).toBeNull();
    expect(
      screen
        .getByRole("progressbar", { name: "Progresso médio em Sem área" })
        .getAttribute("aria-valuenow"),
    ).toBe("25");
  });
});
