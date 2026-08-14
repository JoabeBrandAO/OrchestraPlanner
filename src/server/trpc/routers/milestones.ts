import { z } from "zod";

import {
  addMilestone,
  deleteMilestone,
  listMilestones,
  renameMilestone,
  setMilestoneDone,
} from "@/server/services/goals/milestones-service";
import { TITLE_MAX_LENGTH } from "@/server/services/shared/validate-title";

import { protectedProcedure, router } from "../trpc";

const title = z.string().trim().min(1, "O título é obrigatório.").max(TITLE_MAX_LENGTH);
const uuid = z.string().uuid();

/** Marcos de uma meta (#15). Router fino: valida a entrada e delega ao serviço. */
export const milestonesRouter = router({
  list: protectedProcedure
    .input(z.object({ goalId: uuid }))
    .query(({ ctx, input }) => listMilestones(ctx.userId, input.goalId)),

  add: protectedProcedure
    .input(z.object({ goalId: uuid, title }))
    .mutation(({ ctx, input }) => addMilestone(ctx.userId, input.goalId, { title: input.title })),

  rename: protectedProcedure
    .input(z.object({ id: uuid, title }))
    .mutation(({ ctx, input }) => renameMilestone(ctx.userId, input.id, { title: input.title })),

  setDone: protectedProcedure
    .input(z.object({ id: uuid, done: z.boolean() }))
    .mutation(({ ctx, input }) => setMilestoneDone(ctx.userId, input.id, input.done)),

  delete: protectedProcedure
    .input(z.object({ id: uuid }))
    .mutation(({ ctx, input }) => deleteMilestone(ctx.userId, input.id)),
});
