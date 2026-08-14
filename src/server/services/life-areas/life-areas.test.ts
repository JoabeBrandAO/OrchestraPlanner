import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { migrateForTests } from "@/server/db/migrate-for-tests";
import { withUserContext } from "@/server/db/rls";
import { lifeAreas, users } from "@/server/db/schema";

import { DEFAULT_LIFE_AREAS } from "./default-areas";
import {
  createLifeArea,
  deleteLifeArea,
  listLifeAreas,
  seedDefaultLifeAreas,
  updateLifeArea,
} from "./life-areas-service";

/**
 * Áreas de Vida (#8). Integração com Postgres real sob RLS (role `app_rls`).
 * Roda só com `DATABASE_URL` definida (local), pulado no CI sem banco.
 */
const hasDb = Boolean(process.env.DATABASE_URL);

const stamp = Date.now();
const uid = `la_user_${stamp}`;
const other = `la_other_${stamp}`;

describe.skipIf(!hasDb)("life areas — seed + CRUD + isolamento", () => {
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
      await withUserContext(id, (tx) => tx.delete(lifeAreas));
      await withUserContext(id, (tx) => tx.delete(users));
    }
  });

  it("seeda as áreas padrão para um usuário novo, ordenadas por position", async () => {
    const n = await seedDefaultLifeAreas(uid);
    expect(n).toBe(DEFAULT_LIFE_AREAS.length);

    const areas = await listLifeAreas(uid);
    expect(areas).toHaveLength(DEFAULT_LIFE_AREAS.length);
    expect(areas[0]?.position).toBe(0);
    expect(areas[0]?.name).toBe(DEFAULT_LIFE_AREAS[0]?.name);
  });

  it("é idempotente — seedar de novo não duplica", async () => {
    const n = await seedDefaultLifeAreas(uid);
    expect(n).toBe(0);
    expect(await listLifeAreas(uid)).toHaveLength(DEFAULT_LIFE_AREAS.length);
  });

  it("isola por usuário (RLS) — outro usuário não enxerga as áreas", async () => {
    expect(await listLifeAreas(other)).toHaveLength(0);
  });

  it("dois seeds simultâneos de um usuário novo não duplicam (regressão)", async () => {
    // O bug real (docs/ERROS.md 2026-08-13): `ensureUserRecord()` roda em toda página
    // autenticada, então dois requests concorrentes de um usuário novo passavam ambos
    // pelo "já existe?" antes de qualquer um gravar, e a pessoa via 24 áreas.
    const racer = `la_race_${stamp}`;
    await withUserContext(racer, (tx) =>
      tx.insert(users).values({ id: racer, email: `${racer}@test.local`, name: "T" }),
    );

    await Promise.all([seedDefaultLifeAreas(racer), seedDefaultLifeAreas(racer)]);
    expect(await listLifeAreas(racer)).toHaveLength(DEFAULT_LIFE_AREAS.length);

    await withUserContext(racer, (tx) => tx.delete(lifeAreas));
    await withUserContext(racer, (tx) => tx.delete(users));
  });

  it("recusa duas áreas com o mesmo nome, ignorando maiúsculas", async () => {
    const created = await createLifeArea(other, { dimension: "alma", name: "Estudos" });

    try {
      await expect(createLifeArea(other, { dimension: "corpo", name: "estudos" })).rejects.toThrow(
        /já tem uma área/i,
      );
    } finally {
      // Limpa mesmo se a asserção falhar, senão a área vaza para o teste seguinte.
      await deleteLifeArea(other, created.id);
    }
  });

  it("CRUD — cria, edita e remove uma área customizada", async () => {
    const created = await createLifeArea(other, { dimension: "corpo", name: "Hobbies" });
    expect(created.name).toBe("Hobbies");
    expect(created.dimension).toBe("corpo");

    const updated = await updateLifeArea(other, created.id, { name: "Hobbies & Lazer" });
    expect(updated?.name).toBe("Hobbies & Lazer");

    await deleteLifeArea(other, created.id);
    expect(await listLifeAreas(other)).toHaveLength(0);
  });
});
