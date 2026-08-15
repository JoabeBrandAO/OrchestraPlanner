import { circlesRouter } from "./routers/circles";
import { dashboardRouter } from "./routers/dashboard";
import { eventsRouter } from "./routers/events";
import { goalsRouter } from "./routers/goals";
import { healthRouter } from "./routers/health";
import { lifeAreasRouter } from "./routers/life-areas";
import { lifeWheelRouter } from "./routers/life-wheel";
import { milestonesRouter } from "./routers/milestones";
import { peopleRouter } from "./routers/people";
import { prioritiesRouter } from "./routers/priorities";
import { pushRouter } from "./routers/push";
import { tagsRouter } from "./routers/tags";
import { router } from "./trpc";

export const appRouter = router({
  health: healthRouter,
  dashboard: dashboardRouter,
  circles: circlesRouter,
  lifeAreas: lifeAreasRouter,
  lifeWheel: lifeWheelRouter,
  goals: goalsRouter,
  events: eventsRouter,
  milestones: milestonesRouter,
  people: peopleRouter,
  priorities: prioritiesRouter,
  push: pushRouter,
  tags: tagsRouter,
});

/** Tipo do router raiz — consumido pelo client tRPC para inferência ponta-a-ponta. */
export type AppRouter = typeof appRouter;
