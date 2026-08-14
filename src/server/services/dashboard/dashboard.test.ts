import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { migrateForTests } from "@/server/db/migrate-for-tests";
import { withUserContext } from "@/server/db/rls";
import { goalMilestones, goals, lifeAreas, users } from "@/server/db/schema";
import { createGoal, updateGoal } from "@/server/services/goals/goals-service";
import { addMilestone, setMilestoneDone } from "@/server/services/goals/milestones-service";
import { createLifeArea } from "@/server/services/life-areas/life-areas-service";

import { getGoalsDashboard } from "./dashboard-service";

/**
 * Dashboard de metas (#16). Integração com Postgres real sob RLS (role `app_rls`).
 * Roda só com `DATABASE_URL` (local), pulado no CI sem banco.
 */
const hasDb = Boolean(process.env.DATABASE_URL);

const stamp = Date.now();
const uid = `dash_user_${stamp}`;
const other = `dash_other_${stamp}`;

/** "Hoje" fixo: o teste não pode mudar de resultado por causa da virada do dia. */
const TODAY = "2026-08-13";

describe.skipIf(!hasDb)("dashboard de metas — agregação, vencidas e atividade", () => {
  beforeAll(async () => {
    await migrateForTests();

    for (const id of [uid, other]) {
      await withUserContext(id, (tx) =>
        tx.insert(users).values({ id, email: `${id}@test.local`, name: "T" }),
      );
    }
  });

  afterAll(async () => {
    for (const id of [uid, other]) {
      await withUserContext(id, (tx) => tx.delete(goalMilestones));
      await withUserContext(id, (tx) => tx.delete(goals));
      await withUserContext(id, (tx) => tx.delete(lifeAreas));
      await withUserContext(id, (tx) => tx.delete(users));
    }
  });

  it("agrega status, progresso, área e vencidas do usuário", async () => {
    const area = await createLifeArea(uid, { dimension: "corpo", name: "Saúde" });

    const ativa = await createGoal(uid, { title: "Correr 5km", lifeAreaId: area.id });
    await addMilestone(uid, ativa.id, { title: "Passo 1" });
    const marcos = await addMilestone(uid, ativa.id, { title: "Passo 2" });
    await setMilestoneDone(uid, marcos.milestones[0]!.id, true);

    const atrasada = await createGoal(uid, { title: "Declarar imposto" });
    await updateGoal(uid, atrasada.id, { targetDate: "2026-01-31" });

    const futura = await createGoal(uid, { title: "Viajar" });
    await updateGoal(uid, futura.id, { targetDate: "2026-12-31" });

    const dashboard = await getGoalsDashboard(uid, { today: TODAY });

    expect(dashboard.summary).toMatchObject({ total: 3, active: 3, completed: 0, overdue: 1 });
    expect(dashboard.overdue.map((goal) => goal.title)).toEqual(["Declarar imposto"]);

    const saude = dashboard.summary.byArea.find((entry) => entry.areaId === area.id);
    expect(saude).toMatchObject({ name: "Saúde", total: 1, averageProgress: 50 });

    const semArea = dashboard.summary.byArea.find((entry) => entry.areaId === null);
    expect(semArea).toMatchObject({ name: "Sem área", total: 2 });
  });

  it("atividade recente traz marcos concluídos e metas mexidas, mais novo primeiro", async () => {
    const dashboard = await getGoalsDashboard(uid, { today: TODAY });

    expect(dashboard.recent.length).toBeGreaterThan(0);
    expect(dashboard.recent.some((entry) => entry.kind === "milestone")).toBe(true);

    const marco = dashboard.recent.find((entry) => entry.kind === "milestone");
    expect(marco?.goalTitle).toBe("Correr 5km");

    const timestamps = dashboard.recent.map((entry) => entry.at.getTime());
    expect([...timestamps].sort((a, b) => b - a)).toEqual(timestamps);
  });

  it("isola por usuário (RLS) — o dashboard do outro vem zerado", async () => {
    const dashboard = await getGoalsDashboard(other, { today: TODAY });

    expect(dashboard.summary.total).toBe(0);
    expect(dashboard.overdue).toHaveLength(0);
    expect(dashboard.recent).toHaveLength(0);
  });
});
