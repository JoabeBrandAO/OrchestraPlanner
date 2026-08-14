import { dashboardRouter } from "./routers/dashboard";
import { goalsRouter } from "./routers/goals";
import { healthRouter } from "./routers/health";
import { lifeAreasRouter } from "./routers/life-areas";
import { milestonesRouter } from "./routers/milestones";
import { prioritiesRouter } from "./routers/priorities";
import { tagsRouter } from "./routers/tags";
import { router } from "./trpc";

export const appRouter = router({
  health: healthRouter,
  dashboard: dashboardRouter,
  lifeAreas: lifeAreasRouter,
  goals: goalsRouter,
  milestones: milestonesRouter,
  priorities: prioritiesRouter,
  tags: tagsRouter,
});

/** Tipo do router raiz — consumido pelo client tRPC para inferência ponta-a-ponta. */
export type AppRouter = typeof appRouter;
