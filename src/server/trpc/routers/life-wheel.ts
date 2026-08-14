import { z } from "zod";

import {
  getLatestWheel,
  listWheelHistory,
  saveAssessment,
} from "@/server/services/life-wheel/life-wheel-service";
import { SCORE_MAX, SCORE_MIN } from "@/server/services/life-wheel/wheel";

import { protectedProcedure, router } from "../trpc";

const uuid = z.string().uuid();
const score = z.number().int().min(SCORE_MIN).max(SCORE_MAX);

/** Roda da Vida (#17). Router fino: valida a entrada e delega ao serviço. */
export const lifeWheelRouter = router({
  latest: protectedProcedure.query(({ ctx }) => getLatestWheel(ctx.userId)),

  history: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50) }).optional())
    .query(({ ctx, input }) => listWheelHistory(ctx.userId, input?.limit)),

  save: protectedProcedure
    .input(
      z.object({
        scores: z.array(z.object({ lifeAreaId: uuid, score })).min(1),
        notes: z.string().nullish(),
      }),
    )
    .mutation(({ ctx, input }) => saveAssessment(ctx.userId, input)),
});
