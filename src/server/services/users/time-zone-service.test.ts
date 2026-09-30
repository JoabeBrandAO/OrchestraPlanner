import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { migrateForTests } from "@/server/db/migrate-for-tests";
import { withUserContext } from "@/server/db/rls";
import { goals, users } from "@/server/db/schema";
import { getGoalsDashboard } from "@/server/services/dashboard/dashboard-service";
import { todayIso } from "@/server/services/dashboard/summary";
import { createGoal, updateGoal } from "@/server/services/goals/goals-service";

import { getTimeZone, seedTimeZone, setTimeZone } from "./time-zone-service";

/**
 * Fuso do usuário (#72). Integração com Postgres real sob RLS (role `app_rls`).
 * Roda só com `DATABASE_URL`.
 */
const hasDb = Boolean(process.env.DATABASE_URL);

const stamp = Date.now();
const uid = `tz_user_${stamp}`;
const other = `tz_other_${stamp}`;

describe.skipIf(!hasDb)("fuso do usuário — guardar, semear e usar no 'hoje'", () => {
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
      await withUserContext(id, (tx) => tx.delete(goals));
      await withUserContext(id, (tx) => tx.delete(users));
    }
  });

  it("nasce nulo, o navegador semeia uma vez, e a tela troca depois", async () => {
    expect(await getTimeZone(uid)).toBeNull();

    expect(await seedTimeZone(uid, "America/Sao_Paulo")).toBe("America/Sao_Paulo");
    // Um segundo palpite do navegador (outra aba, outro aparelho) não sobrescreve.
    expect(await seedTimeZone(uid, "Asia/Tokyo")).toBe("America/Sao_Paulo");

    // A escolha explícita, essa sim, vale.
    await setTimeZone(uid, "Europe/Lisbon");
    expect(await getTimeZone(uid)).toBe("Europe/Lisbon");
    expect(await seedTimeZone(uid, "America/Sao_Paulo")).toBe("Europe/Lisbon");
  });

  it("recusa fuso inventado sem gravar nada", async () => {
    await expect(setTimeZone(other, "Brasil/Gama")).rejects.toThrow("Fuso horário desconhecido.");
    expect(await getTimeZone(other)).toBeNull();
  });

  it("o fuso de um usuário não vaza para o outro (RLS)", async () => {
    await setTimeZone(uid, "Asia/Tokyo");
    expect(await getTimeZone(other)).toBeNull();
  });

  it("o painel usa o fuso guardado: o mesmo prazo é 'hoje' num fuso e 'vencido' no outro", async () => {
    // UTC-12 e UTC+14 estão sempre em dias diferentes (26 h de distância), então o teste não
    // depende da hora em que roda — ao contrário de "às 22h de Brasília", que só pegaria o
    // defeito entre 21h e meia-noite.
    const atrasado = "Etc/GMT+12"; // UTC-12
    const adiantado = "Pacific/Kiritimati"; // UTC+14
    const prazo = todayIso(new Date(), atrasado);

    const meta = await createGoal(other, { title: "Entregar hoje" });
    await updateGoal(other, meta.id, { targetDate: prazo });

    await setTimeZone(other, atrasado);
    expect((await getGoalsDashboard(other)).overdue.map((goal) => goal.id)).not.toContain(meta.id);

    await setTimeZone(other, adiantado);
    expect((await getGoalsDashboard(other)).overdue.map((goal) => goal.id)).toContain(meta.id);
  });
});
