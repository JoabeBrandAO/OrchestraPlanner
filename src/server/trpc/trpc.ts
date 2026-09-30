import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";

import {
  hitRateLimit,
  tooManyMessage,
  type RateKey,
} from "@/server/services/rate-limit/rate-limit";

import type { TRPCContext } from "./context";
import { logEvent, translate } from "./observe";

const t = initTRPC.context<TRPCContext>().create({ transformer: superjson });

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;

/**
 * Borda de toda chamada (#76): traduz erro de domínio para 400/404 e deixa rastro — uma linha
 * por mutação (quem, qual rota, quanto tempo) e uma por erro. Consultas bem-sucedidas não são
 * registradas: são a maior parte do tráfego e não contam história.
 */
const observe = t.middleware(async ({ ctx, path, type, next }) => {
  const started = performance.now();
  const result = await next();
  const call = { path, type, userId: ctx.userId, ms: Math.round(performance.now() - started) };

  if (result.ok) {
    if (type === "mutation") logEvent("info", { event: "trpc", ...call, ok: true });
    return result;
  }

  const translated = translate(result.error, call);
  if (translated) throw translated;
  return result;
});

/** Procedure pública (sem exigir autenticação). */
export const publicProcedure = t.procedure.use(observe);

/** Garante que há `userId`; caso contrário, 401. Estreita o tipo para `string`. */
const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Autenticação necessária." });
  }
  return next({ ctx: { userId: ctx.userId } });
});

/** Procedure autenticada: `ctx.userId` é garantidamente `string`. */
export const protectedProcedure = publicProcedure.use(enforceAuth);

/**
 * Procedure autenticada **com teto de chamadas** por usuário (#75). A chamada acima do teto é
 * recusada com 429 e registrada — só `userId` e rota, nunca o conteúdo da chamada.
 */
export function rateLimitedProcedure(key: RateKey) {
  return protectedProcedure.use(async ({ ctx, next }) => {
    const decision = await hitRateLimit(ctx.userId, key);
    if (!decision.allowed) {
      console.warn(
        JSON.stringify({ event: "rate_limited", userId: ctx.userId, key, count: decision.count }),
      );
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: tooManyMessage(decision.retryAt) });
    }
    return next();
  });
}
