import { z } from "zod";

import { GOAL_STATUSES } from "@/server/services/goals/goal-status";
import {
  changeGoalStatus,
  createGoal,
  listGoals,
  updateGoal,
} from "@/server/services/goals/goals-service";

import { protectedProcedure, router } from "../trpc";

const title = z.string().trim().min(1, "O título é obrigatório.").max(120);
const uuid = z.string().uuid();

export const goalsRouter = router({
  list: protectedProcedure
    .input(z.object({ lifeAreaId: uuid.optional() }).optional())
    .query(({ ctx, input }) => listGoals(ctx.userId, input)),

  create: protectedProcedure
    .input(
      z.object({
        title,
        description: z.string().nullish(),
        lifeAreaId: uuid.nullish(),
        targetDate: z.string().nullish(),
      }),
    )
    .mutation(({ ctx, input }) => createGoal(ctx.userId, input)),

  update: protectedProcedure
    .input(
      z.object({
        id: uuid,
        title: title.optional(),
        description: z.string().nullish(),
        lifeAreaId: uuid.nullish(),
        targetDate: z.string().nullish(),
        progress: z.number().int().min(0).max(100).optional(),
      }),
    )
    .mutation(({ ctx, input }) => {
      const { id, ...patch } = input;
      return updateGoal(ctx.userId, id, patch);
    }),

  setStatus: protectedProcedure
    .input(z.object({ id: uuid, status: z.enum(GOAL_STATUSES) }))
    .mutation(({ ctx, input }) => changeGoalStatus(ctx.userId, input.id, input.status)),
});
