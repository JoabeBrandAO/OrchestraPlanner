/**
 * Agregações do dashboard de metas (#16). Regra **pura**: recebe as linhas já lidas e
 * devolve os números da tela. Fica fora do serviço para rodar no CI sem banco e para a
 * definição de "vencida" ter um único lugar.
 *
 * Os tipos são estruturais de propósito (nada importado de `db/schema`): o módulo é
 * consumido também pelo client, e importar do schema arrasta o driver `postgres` para o
 * bundle (ver `docs/ERROS.md` 2026-08-11).
 */

export type SummaryGoalStatus = "ativa" | "pausada" | "completada";

export type SummaryGoal = {
  lifeAreaId: string | null;
  status: SummaryGoalStatus;
  progress: number;
  /** `date` do Postgres chega como "YYYY-MM-DD". */
  targetDate: string | null;
};

export type SummaryArea = { id: string; name: string };

export type AreaBreakdown = {
  areaId: string | null;
  name: string;
  total: number;
  completed: number;
  averageProgress: number;
};

export type GoalsSummary = {
  total: number;
  active: number;
  paused: number;
  completed: number;
  /** Metas com prazo no passado que ainda não foram concluídas. */
  overdue: number;
  /** Média de `progress` das metas **não concluídas** (0 quando não há nenhuma). */
  averageProgress: number;
  byArea: AreaBreakdown[];
};

/** Data de hoje em "YYYY-MM-DD" — o mesmo formato do `date` do Postgres. */
export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Vencida = tinha prazo, o prazo já passou e a meta não foi concluída. Pausada conta como
 * vencida: o prazo passou do mesmo jeito, e esconder isso mascararia o atraso. Comparar as
 * strings ISO basta — elas ordenam como as datas que representam.
 */
export function isOverdue(goal: SummaryGoal, today: string): boolean {
  return goal.targetDate !== null && goal.targetDate < today && goal.status !== "completada";
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

/**
 * Números do dashboard. A distribuição por área lista **todas** as áreas do usuário —
 * inclusive as vazias, que são justamente o sinal interessante ("nada plantado aqui") —
 * e fecha com um balde "Sem área" quando ele tem alguma meta.
 */
export function summarizeGoals(
  goals: readonly SummaryGoal[],
  areas: readonly SummaryArea[],
  today: string,
): GoalsSummary {
  const byArea: AreaBreakdown[] = areas.map((area) => {
    const inArea = goals.filter((goal) => goal.lifeAreaId === area.id);
    return {
      areaId: area.id,
      name: area.name,
      total: inArea.length,
      completed: inArea.filter((goal) => goal.status === "completada").length,
      averageProgress: average(inArea.map((goal) => goal.progress)),
    };
  });

  const orphans = goals.filter((goal) => goal.lifeAreaId === null);
  if (orphans.length > 0) {
    byArea.push({
      areaId: null,
      name: "Sem área",
      total: orphans.length,
      completed: orphans.filter((goal) => goal.status === "completada").length,
      averageProgress: average(orphans.map((goal) => goal.progress)),
    });
  }

  return {
    total: goals.length,
    active: goals.filter((goal) => goal.status === "ativa").length,
    paused: goals.filter((goal) => goal.status === "pausada").length,
    completed: goals.filter((goal) => goal.status === "completada").length,
    overdue: goals.filter((goal) => isOverdue(goal, today)).length,
    averageProgress: average(
      goals.filter((goal) => goal.status !== "completada").map((goal) => goal.progress),
    ),
    byArea,
  };
}
