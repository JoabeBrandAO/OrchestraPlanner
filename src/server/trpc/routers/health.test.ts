import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";

import { appRouter } from "../root";
import { createCallerFactory } from "../trpc";

// Testa o router com contexto sintético — sem tocar no Clerk (auth mockado via ctx).
const createCaller = createCallerFactory(appRouter);

describe("health.healthcheck", () => {
  it("retorna { ok, userId } quando autenticado", async () => {
    const caller = createCaller({ userId: "user_123" });
    await expect(caller.health.healthcheck()).resolves.toEqual({
      ok: true,
      userId: "user_123",
    });
  });

  it("lança UNAUTHORIZED quando não há usuário", async () => {
    const caller = createCaller({ userId: null });
    await expect(caller.health.healthcheck()).rejects.toBeInstanceOf(TRPCError);
  });
});
