import { getGoalsDashboard } from "@/server/services/dashboard/dashboard-service";

import { protectedProcedure, router } from "../trpc";

/** Dashboard de metas (#16). Leitura agregada; o "hoje" é o do servidor. */
export const dashboardRouter = router({
  goals: protectedProcedure.query(({ ctx }) => getGoalsDashboard(ctx.userId)),
});
