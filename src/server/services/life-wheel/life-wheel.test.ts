import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { migrateForTests } from "@/server/db/migrate-for-tests";
import { withUserContext } from "@/server/db/rls";
import { lifeAreas, lifeAssessments, users } from "@/server/db/schema";
import { createLifeArea } from "@/server/services/life-areas/life-areas-service";

import { getLatestWheel, listWheelHistory, saveAssessment } from "./life-wheel-service";

/**
 * Roda da Vida (#17). Integração com Postgres real sob RLS (role `app_rls`).
 * Roda só com `DATABASE_URL` (local), pulado no CI sem banco.
 */
const hasDb = Boolean(process.env.DATABASE_URL);

const stamp = Date.now();
const uid = `wheel_user_${stamp}`;
const other = `wheel_other_${stamp}`;

/** Rodadas com instante fixo: o teste compara histórico, então a ordem precisa ser exata. */
const MARCO = new Date("2026-03-01T12:00:00.000Z");
const AGOSTO = new Date("2026-08-01T12:00:00.000Z");

describe.skipIf(!hasDb)("roda da vida — rodadas, sugestões, histórico e isolamento", () => {
  let saude = "";
  let financas = "";
  let lazer = "";

  beforeAll(async () => {
    await migrateForTests();

    for (const id of [uid, other]) {
      await withUserContext(id, (tx) =>
        tx.insert(users).values({ id, email: `${id}@test.local`, name: "T" }),
      );
    }

    saude = (await createLifeArea(uid, { dimension: "corpo", name: "Saúde", position: 0 })).id;
    financas = (await createLifeArea(uid, { dimension: "alma", name: "Finanças", position: 1 })).id;
    lazer = (await createLifeArea(uid, { dimension: "corpo", name: "Lazer", position: 2 })).id;
  });

  afterAll(async () => {
    for (const id of [uid, other]) {
      await withUserContext(id, (tx) => tx.delete(lifeAssessments));
      await withUserContext(id, (tx) => tx.delete(lifeAreas));
      await withUserContext(id, (tx) => tx.delete(users));
    }
  });

  it("salva a rodada com média e sugestões pelas menores notas", async () => {
    const wheel = await saveAssessment(uid, {
      assessedAt: MARCO,
      notes: "primeira roda",
      scores: [
        { lifeAreaId: saude, score: 8 },
        { lifeAreaId: financas, score: 3 },
        { lifeAreaId: lazer, score: 4 },
      ],
    });

    expect(wheel.entries.map((entry) => entry.name)).toEqual(["Saúde", "Finanças", "Lazer"]);
    expect(wheel.average).toBe(5);
    expect(wheel.suggestions.map((entry) => entry.name)).toEqual(["Finanças", "Lazer", "Saúde"]);
    expect(wheel.notes).toBe("primeira roda");
  });

  it("recusa nota fora da faixa sem gravar nada", async () => {
    await expect(
      saveAssessment(uid, {
        assessedAt: new Date("2026-04-01T12:00:00.000Z"),
        scores: [
          { lifeAreaId: saude, score: 7 },
          { lifeAreaId: financas, score: 42 },
        ],
      }),
    ).rejects.toThrow(/entre 0 e 10/i);

    // A rodada de março continua sendo a última — a de abril não deixou rastro.
    const latest = await getLatestWheel(uid);
    expect(latest?.assessedAt.toISOString()).toBe(MARCO.toISOString());
  });

  it("a roda mais recente é a última rodada; o histórico guarda as anteriores", async () => {
    await saveAssessment(uid, {
      assessedAt: AGOSTO,
      scores: [
        { lifeAreaId: saude, score: 9 },
        { lifeAreaId: financas, score: 7 },
        { lifeAreaId: lazer, score: 8 },
      ],
    });

    const latest = await getLatestWheel(uid);
    expect(latest?.assessedAt.toISOString()).toBe(AGOSTO.toISOString());
    expect(latest?.average).toBe(8);

    const history = await listWheelHistory(uid);
    expect(history.map((round) => round.average)).toEqual([8, 5]);
    expect(history.map((round) => round.areas)).toEqual([3, 3]);
  });

  it("isola por usuário (RLS) e recusa área de outro dono", async () => {
    expect(await getLatestWheel(other)).toBeNull();
    expect(await listWheelHistory(other)).toHaveLength(0);

    await expect(
      saveAssessment(other, { scores: [{ lifeAreaId: saude, score: 5 }] }),
    ).rejects.toThrow(/não encontrada/i);
  });
});
