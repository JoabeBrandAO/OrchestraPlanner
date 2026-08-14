import { asc, desc, eq, isNotNull } from "drizzle-orm";

import { withUserContext } from "@/server/db/rls";
import { goalMilestones, goals, lifeAreas } from "@/server/db/schema";

import { summarizeGoals, todayIso, type GoalsSummary } from "./summary";

/**
 * Dashboard de metas (#16). Uma leitura só: números agregados, distribuição por área e
 * atividade recente. Roda sob `withUserContext`, então tudo já vem isolado pela RLS.
 *
 * A agregação acontece em memória (`summary.ts`, pura e testável) e não em SQL: a escala
 * é pessoal — dezenas de metas por usuário — e o ganho de clareza/teste vale mais do que
 * o de um `GROUP BY` aqui. Se um dia isso doer, o lugar de mudar é este arquivo.
 */

/** Um evento da linha do tempo — meta mexida ou marco concluído. */
export type ActivityEntry = {
  kind: "goal" | "milestone";
  id: string;
  title: string;
  /** Meta a que o marco pertence (só em `kind: "milestone"`). */
  goalTitle?: string;
  at: Date;
};

export type GoalsDashboard = {
  summary: GoalsSummary;
  /** Metas vencidas, da mais atrasada para a menos — a lista de "o que cobrar de mim". */
  overdue: { id: string; title: string; targetDate: string; progress: number }[];
  recent: ActivityEntry[];
};

const ACTIVITY_LIMIT = 6;

export async function getGoalsDashboard(
  userId: string,
  options?: { today?: string },
): Promise<GoalsDashboard> {
  const today = options?.today ?? todayIso();

  return withUserContext(userId, async (tx) => {
    const [goalRows, areaRows, recentMilestones] = await Promise.all([
      tx.select().from(goals),
      tx
        .select({ id: lifeAreas.id, name: lifeAreas.name })
        .from(lifeAreas)
        .orderBy(asc(lifeAreas.position), asc(lifeAreas.createdAt)),
      tx
        .select({
          id: goalMilestones.id,
          title: goalMilestones.title,
          completedAt: goalMilestones.completedAt,
          goalTitle: goals.title,
        })
        .from(goalMilestones)
        .innerJoin(goals, eq(goals.id, goalMilestones.goalId))
        .where(isNotNull(goalMilestones.completedAt))
        .orderBy(desc(goalMilestones.completedAt))
        .limit(ACTIVITY_LIMIT),
    ]);

    const summary = summarizeGoals(goalRows, areaRows, today);

    const overdue = goalRows
      .filter((goal) => goal.targetDate !== null && goal.targetDate < today)
      .filter((goal) => goal.status !== "completada")
      .sort((a, b) => a.targetDate!.localeCompare(b.targetDate!))
      .map((goal) => ({
        id: goal.id,
        title: goal.title,
        targetDate: goal.targetDate!,
        progress: goal.progress,
      }));

    const recent: ActivityEntry[] = [
      ...goalRows.map((goal) => ({
        kind: "goal" as const,
        id: goal.id,
        title: goal.title,
        at: goal.updatedAt,
      })),
      ...recentMilestones.map((milestone) => ({
        kind: "milestone" as const,
        id: milestone.id,
        title: milestone.title,
        goalTitle: milestone.goalTitle,
        at: milestone.completedAt!,
      })),
    ]
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, ACTIVITY_LIMIT);

    return { summary, overdue, recent };
  });
}
