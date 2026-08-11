import { goalsRouter } from "./routers/goals";
import { healthRouter } from "./routers/health";
import { lifeAreasRouter } from "./routers/life-areas";
import { router } from "./trpc";

export const appRouter = router({
  health: healthRouter,
  lifeAreas: lifeAreasRouter,
  goals: goalsRouter,
});

/** Tipo do router raiz — consumido pelo client tRPC para inferência ponta-a-ponta. */
export type AppRouter = typeof appRouter;
