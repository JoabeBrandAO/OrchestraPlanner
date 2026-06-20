/** Status possíveis de uma meta (US-1.4). Espelha o enum `goal_status` do schema. */
export const GOAL_STATUSES = ["ativa", "pausada", "completada"] as const;
export type GoalStatusValue = (typeof GOAL_STATUSES)[number];

/**
 * Transições válidas entre status (máquina de estados de US-1.4):
 * - `ativa`      → pausar ou completar
 * - `pausada`    → retomar (ativa) ou completar
 * - `completada` → reabrir (ativa)
 * Qualquer outra (incl. para o mesmo status) é inválida.
 */
const ALLOWED: Record<GoalStatusValue, readonly GoalStatusValue[]> = {
  ativa: ["pausada", "completada"],
  pausada: ["ativa", "completada"],
  completada: ["ativa"],
};

export function canTransition(from: GoalStatusValue, to: GoalStatusValue): boolean {
  return ALLOWED[from].includes(to);
}
