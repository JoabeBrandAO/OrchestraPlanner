import { describe, expect, it } from "vitest";

import { isOverdue, summarizeGoals, todayIso, type SummaryGoal } from "./summary";

/** Agregações do dashboard (#16) — regra pura, sem banco, roda no CI. */

const TODAY = "2026-08-13";

const goal = (patch: Partial<SummaryGoal> = {}): SummaryGoal => ({
  lifeAreaId: null,
  status: "ativa",
  progress: 0,
  targetDate: null,
  ...patch,
});

describe("isOverdue", () => {
  it("só é vencida com prazo no passado e meta não concluída", () => {
    expect(isOverdue(goal({ targetDate: "2026-08-12" }), TODAY)).toBe(true);
    expect(isOverdue(goal({ targetDate: TODAY }), TODAY)).toBe(false);
    expect(isOverdue(goal({ targetDate: "2026-08-14" }), TODAY)).toBe(false);
    expect(isOverdue(goal({ targetDate: null }), TODAY)).toBe(false);
  });

  it("concluída no atraso não conta como vencida; pausada conta", () => {
    expect(isOverdue(goal({ targetDate: "2026-01-01", status: "completada" }), TODAY)).toBe(false);
    expect(isOverdue(goal({ targetDate: "2026-01-01", status: "pausada" }), TODAY)).toBe(true);
  });
});

describe("summarizeGoals", () => {
  const areas = [
    { id: "a1", name: "Saúde" },
    { id: "a2", name: "Finanças" },
  ];

  it("conta por status e média só das não concluídas", () => {
    const summary = summarizeGoals(
      [
        goal({ status: "ativa", progress: 20 }),
        goal({ status: "ativa", progress: 40 }),
        goal({ status: "pausada", progress: 0 }),
        goal({ status: "completada", progress: 100 }),
      ],
      areas,
      TODAY,
    );

    expect(summary).toMatchObject({ total: 4, active: 2, paused: 1, completed: 1, overdue: 0 });
    // (20 + 40 + 0) / 3 — a concluída ficaria de fora para não inflar a média.
    expect(summary.averageProgress).toBe(20);
  });

  it("distribui por área, mantém áreas vazias e agrupa as órfãs em 'Sem área'", () => {
    const summary = summarizeGoals(
      [
        goal({ lifeAreaId: "a1", progress: 50 }),
        goal({ lifeAreaId: "a1", progress: 100, status: "completada" }),
        goal({ lifeAreaId: null, progress: 10 }),
      ],
      areas,
      TODAY,
    );

    expect(summary.byArea).toEqual([
      { areaId: "a1", name: "Saúde", total: 2, completed: 1, averageProgress: 75 },
      { areaId: "a2", name: "Finanças", total: 0, completed: 0, averageProgress: 0 },
      { areaId: null, name: "Sem área", total: 1, completed: 0, averageProgress: 10 },
    ]);
  });

  it("omite 'Sem área' quando toda meta tem área", () => {
    const summary = summarizeGoals([goal({ lifeAreaId: "a1" })], areas, TODAY);
    expect(summary.byArea.map((area) => area.areaId)).toEqual(["a1", "a2"]);
  });

  it("sem metas, tudo zero", () => {
    const summary = summarizeGoals([], [], TODAY);
    expect(summary).toMatchObject({ total: 0, averageProgress: 0, overdue: 0, byArea: [] });
  });
});

describe("todayIso", () => {
  it("formata como o `date` do Postgres", () => {
    expect(todayIso(new Date("2026-08-13T22:45:00Z"))).toBe("2026-08-13");
  });
});
