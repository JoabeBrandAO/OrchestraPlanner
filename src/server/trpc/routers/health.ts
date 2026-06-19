import { protectedProcedure, router } from "../trpc";

export const healthRouter = router({
  /** Procedure autenticada de saúde: confirma sessão e devolve o `userId`. */
  healthcheck: protectedProcedure.query(({ ctx }) => ({
    ok: true as const,
    userId: ctx.userId,
  })),
});
