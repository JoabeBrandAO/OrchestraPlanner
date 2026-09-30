import { TRPCError } from "@trpc/server";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * A borda do teto (#75), sem banco: acima do teto, a mutação **nem chega** ao serviço e a
 * resposta é 429 com frase em português. A contagem em si é testada em `rate-limit.test.ts`.
 */
vi.mock("@/server/services/rate-limit/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/services/rate-limit/rate-limit")>()),
  hitRateLimit: vi.fn(),
}));
vi.mock("@/server/services/reminders/reminders-service", () => ({
  saveSubscription: vi.fn(),
  deleteSubscription: vi.fn(),
  listSubscriptions: vi.fn(),
}));

const { hitRateLimit } = await import("@/server/services/rate-limit/rate-limit");
const { saveSubscription } = await import("@/server/services/reminders/reminders-service");
const { pushRouter } = await import("./routers/push");
const { createCallerFactory } = await import("./trpc");

const caller = createCallerFactory(pushRouter)({ userId: "user_x" });
const input = { endpoint: "https://push.exemplo.com/abc", p256dh: "k", auth: "a" };

describe("rateLimitedProcedure", () => {
  afterEach(() => vi.clearAllMocks());

  it("dentro do teto, a mutação segue para o serviço", async () => {
    vi.mocked(hitRateLimit).mockResolvedValue({
      allowed: true,
      count: 1,
      retryAt: new Date(Date.now() + 60_000),
    });
    await caller.subscribe(input);
    expect(hitRateLimit).toHaveBeenCalledWith("user_x", "push.subscribe");
    expect(saveSubscription).toHaveBeenCalledOnce();
  });

  it("acima do teto, recusa com 429 em português e o serviço não é chamado", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(hitRateLimit).mockResolvedValue({
      allowed: false,
      count: 11,
      retryAt: new Date(Date.now() + 25 * 60_000),
    });

    const erro = await caller.subscribe(input).catch((error: unknown) => error);
    expect(erro).toBeInstanceOf(TRPCError);
    expect((erro as TRPCError).code).toBe("TOO_MANY_REQUESTS");
    expect((erro as TRPCError).message).toMatch(/Tente de novo em 2[56] min/);
    expect(saveSubscription).not.toHaveBeenCalled();

    // Registrada, e sem o conteúdo da chamada.
    expect(warn).toHaveBeenCalledOnce();
    const linha = String(warn.mock.calls[0]![0]);
    expect(JSON.parse(linha)).toMatchObject({ event: "rate_limited", key: "push.subscribe" });
    expect(linha).not.toContain(input.endpoint);
    warn.mockRestore();
  });
});
