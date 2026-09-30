import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { countQueries } from "@/server/db";
import { migrateForTests } from "@/server/db/migrate-for-tests";
import { withUserContext } from "@/server/db/rls";
import { rateLimits, users } from "@/server/db/schema";

import { hitRateLimit, RATE_RULES, windowStart } from "./rate-limit";

/** Teto de chamadas (#75). */

describe("windowStart", () => {
  it("a janela de uma hora começa na hora cheia", () => {
    const hora = 60 * 60 * 1000;
    expect(windowStart(new Date("2026-09-30T14:59:59Z"), hora).toISOString()).toBe(
      "2026-09-30T14:00:00.000Z",
    );
    expect(windowStart(new Date("2026-09-30T15:00:00Z"), hora).toISOString()).toBe(
      "2026-09-30T15:00:00.000Z",
    );
  });
});

const hasDb = Boolean(process.env.DATABASE_URL);
const stamp = Date.now();
const uid = `rl_user_${stamp}`;
const other = `rl_other_${stamp}`;

describe.skipIf(!hasDb)("hitRateLimit — por usuário, no banco", () => {
  const limite = RATE_RULES["finance.importStatement"].limit;
  const agora = new Date("2026-09-30T14:10:00Z");

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
      await withUserContext(id, (tx) => tx.delete(users));
    }
  });

  it("deixa passar até o teto e recusa a chamada seguinte", async () => {
    for (let i = 1; i <= limite; i += 1) {
      const decisao = await hitRateLimit(uid, "finance.importStatement", agora);
      expect(decisao).toMatchObject({ allowed: true, count: i });
    }
    const recusada = await hitRateLimit(uid, "finance.importStatement", agora);
    expect(recusada.allowed).toBe(false);
    expect(recusada.retryAt.toISOString()).toBe("2026-09-30T15:00:00.000Z");
  });

  it("o teto é por usuário: um não silencia o outro", async () => {
    expect((await hitRateLimit(other, "finance.importStatement", agora)).allowed).toBe(true);
  });

  it("o teto é por rota: estourar a importação não bloqueia o push", async () => {
    expect((await hitRateLimit(uid, "push.subscribe", agora)).allowed).toBe(true);
  });

  it("a janela seguinte recomeça do zero, na mesma linha", async () => {
    const depois = new Date("2026-09-30T15:00:01Z");
    expect(await hitRateLimit(uid, "finance.importStatement", depois)).toMatchObject({
      allowed: true,
      count: 1,
    });
    const linhas = await withUserContext(uid, (tx) => tx.select().from(rateLimits));
    expect(linhas.filter((linha) => linha.key === "finance.importStatement")).toHaveLength(1);
  });

  it("chamadas simultâneas não passam juntas do teto (sem corrida)", async () => {
    const outraHora = new Date("2026-09-30T18:00:00Z");
    const decisoes = await Promise.all(
      Array.from({ length: limite + 5 }, () => hitRateLimit(other, "account.export", outraHora)),
    );
    const teto = RATE_RULES["account.export"].limit;
    expect(decisoes.filter((d) => d.allowed)).toHaveLength(teto);
    expect(new Set(decisoes.map((d) => d.count)).size).toBe(decisoes.length);
  });

  it("custa uma ida ao banco além da moldura", async () => {
    const [, consultas] = await countQueries(() => hitRateLimit(other, "push.subscribe", agora));
    expect(consultas).toBe(3 + 1);
  });
});
