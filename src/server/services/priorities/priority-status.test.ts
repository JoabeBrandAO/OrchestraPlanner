import { describe, expect, it } from "vitest";

import { entersDone, leavesDone, PRIORITY_STATUSES } from "./priority-status";

/** Regra de `completed_at` do Kanban (#13) — pura, roda no CI sem banco. */
describe("priority-status", () => {
  it("espelha as três colunas do schema", () => {
    expect(PRIORITY_STATUSES).toEqual(["todo", "in_progress", "done"]);
  });

  it("marca a conclusão só ao ENTRAR em done", () => {
    expect(entersDone("todo", "done")).toBe(true);
    expect(entersDone("in_progress", "done")).toBe(true);
    expect(entersDone("done", "done")).toBe(false);
    expect(entersDone("todo", "in_progress")).toBe(false);
  });

  it("limpa a conclusão só ao SAIR de done", () => {
    expect(leavesDone("done", "todo")).toBe(true);
    expect(leavesDone("done", "in_progress")).toBe(true);
    expect(leavesDone("done", "done")).toBe(false);
    expect(leavesDone("todo", "done")).toBe(false);
  });
});
