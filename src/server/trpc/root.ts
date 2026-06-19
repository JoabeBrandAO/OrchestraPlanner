import { healthRouter } from "./routers/health";
import { router } from "./trpc";

export const appRouter = router({
  health: healthRouter,
});

/** Tipo do router raiz — consumido pelo client tRPC para inferência ponta-a-ponta. */
export type AppRouter = typeof appRouter;
