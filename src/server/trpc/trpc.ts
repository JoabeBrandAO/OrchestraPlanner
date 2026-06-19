import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";

import type { TRPCContext } from "./context";

const t = initTRPC.context<TRPCContext>().create({ transformer: superjson });

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;

/** Procedure pública (sem exigir autenticação). */
export const publicProcedure = t.procedure;

/** Garante que há `userId`; caso contrário, 401. Estreita o tipo para `string`. */
const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Autenticação necessária." });
  }
  return next({ ctx: { userId: ctx.userId } });
});

/** Procedure autenticada: `ctx.userId` é garantidamente `string`. */
export const protectedProcedure = t.procedure.use(enforceAuth);
