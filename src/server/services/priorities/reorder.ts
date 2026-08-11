import type { PriorityStatusValue } from "./priority-status";

/**
 * Cálculo puro da reordenação do Kanban (#13) — o miolo do drag-and-drop, separado do
 * banco para ser testado sem DB (roda no CI). Recebe o retrato atual das prioridades e
 * devolve **apenas as linhas que mudaram**, com `position` contígua (0-based) por coluna.
 */

export type PositionedItem = {
  id: string;
  status: PriorityStatusValue;
  position: number;
};

export type PositionUpdate = PositionedItem;

/** Ordena por `position` e usa o `id` como desempate — resultado determinístico. */
function byPosition(a: PositionedItem, b: PositionedItem): number {
  return a.position - b.position || a.id.localeCompare(b.id);
}

/**
 * Move `movedId` para a coluna `toStatus`, no índice `toIndex`, e reindexa as colunas
 * afetadas. `toIndex` é clampeado ao tamanho da coluna destino (soltar "no fim" pode
 * mandar um índice maior). Lança se o item não estiver na lista.
 */
export function computeReorder(
  items: readonly PositionedItem[],
  movedId: string,
  toStatus: PriorityStatusValue,
  toIndex: number,
): PositionUpdate[] {
  const moved = items.find((item) => item.id === movedId);
  if (!moved) throw new Error("Prioridade não encontrada.");

  const fromStatus = moved.status;

  const columnOf = (status: PriorityStatusValue) =>
    items.filter((item) => item.status === status && item.id !== movedId).sort(byPosition);

  const target = columnOf(toStatus);
  const index = Math.max(0, Math.min(Math.trunc(toIndex), target.length));
  // Insere o item **com o status original**: é a comparação lá embaixo (`item.status !==
  // status`) que detecta a troca de coluna e emite o update. Inserir já com `toStatus`
  // esconderia exatamente a mudança que precisamos gravar.
  target.splice(index, 0, moved);

  const columns: Array<[PriorityStatusValue, PositionedItem[]]> = [[toStatus, target]];
  if (fromStatus !== toStatus) columns.push([fromStatus, columnOf(fromStatus)]);

  const updates: PositionUpdate[] = [];
  for (const [status, column] of columns) {
    column.forEach((item, position) => {
      // Só escreve o que realmente mudou — o move típico toca poucas linhas.
      if (item.position !== position || item.status !== status) {
        updates.push({ id: item.id, status, position });
      }
    });
  }

  return updates;
}
