/** Colunas do Kanban de prioridades (#13). Espelha o enum `priority_status` do schema. */
export const PRIORITY_STATUSES = ["todo", "in_progress", "done"] as const;
export type PriorityStatusValue = (typeof PRIORITY_STATUSES)[number];

/** Rótulos das colunas (PT-BR), fonte única para a UI. */
export const PRIORITY_STATUS_LABELS: Record<PriorityStatusValue, string> = {
  todo: "A fazer",
  in_progress: "Em progresso",
  done: "Feito",
};

/**
 * Ao contrário das Metas (US-1.4), o Kanban não tem máquina de estados: arrastar um
 * card de qualquer coluna para qualquer outra é legítimo — inclusive desfazer. A única
 * regra de domínio é o efeito colateral em `completed_at`, isolado aqui e testável sem DB.
 */

/** `true` quando a transição deve **marcar** a conclusão (`completed_at = now()`). */
export function entersDone(from: PriorityStatusValue, to: PriorityStatusValue): boolean {
  return to === "done" && from !== "done";
}

/** `true` quando a transição deve **limpar** a conclusão (`completed_at = null`). */
export function leavesDone(from: PriorityStatusValue, to: PriorityStatusValue): boolean {
  return from === "done" && to !== "done";
}
