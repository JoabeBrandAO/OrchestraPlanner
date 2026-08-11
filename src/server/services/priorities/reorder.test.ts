import { describe, expect, it } from "vitest";

import { computeReorder, type PositionedItem } from "./reorder";

/** Reordenação do Kanban (#13) — lógica pura, roda no CI sem banco. */

const board: PositionedItem[] = [
  { id: "a", status: "todo", position: 0 },
  { id: "b", status: "todo", position: 1 },
  { id: "c", status: "todo", position: 2 },
  { id: "x", status: "in_progress", position: 0 },
  { id: "y", status: "in_progress", position: 1 },
];

/** Aplica os updates no retrato e devolve a coluna resultante, em ordem. */
function columnAfter(
  items: PositionedItem[],
  updates: PositionedItem[],
  status: PositionedItem["status"],
): string[] {
  const merged = items.map((item) => updates.find((u) => u.id === item.id) ?? item);
  return merged
    .filter((item) => item.status === status)
    .sort((p, q) => p.position - q.position)
    .map((item) => item.id);
}

describe("computeReorder", () => {
  it("reordena dentro da mesma coluna", () => {
    const updates = computeReorder(board, "c", "todo", 0);
    expect(columnAfter(board, updates, "todo")).toEqual(["c", "a", "b"]);
  });

  it("move entre colunas e reindexa origem e destino", () => {
    const updates = computeReorder(board, "a", "in_progress", 1);
    expect(columnAfter(board, updates, "in_progress")).toEqual(["x", "a", "y"]);
    expect(columnAfter(board, updates, "todo")).toEqual(["b", "c"]);
  });

  it("clampeia o índice ao tamanho da coluna destino", () => {
    const updates = computeReorder(board, "a", "done", 99);
    expect(columnAfter(board, updates, "done")).toEqual(["a"]);
  });

  it("não devolve update para linha que não mudou", () => {
    const updates = computeReorder(board, "c", "todo", 2);
    expect(updates).toEqual([]);
  });

  it("mantém as posições contíguas a partir de zero", () => {
    const gapped: PositionedItem[] = [
      { id: "a", status: "todo", position: 5 },
      { id: "b", status: "todo", position: 9 },
    ];
    const updates = computeReorder(gapped, "b", "todo", 0);
    expect(updates.map((u) => u.position).sort()).toEqual([0, 1]);
  });

  it("falha quando o item não existe", () => {
    expect(() => computeReorder(board, "zzz", "todo", 0)).toThrow(/não encontrada/i);
  });
});
