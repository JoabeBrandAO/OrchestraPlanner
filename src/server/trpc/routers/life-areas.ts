import { z } from "zod";

import {
  createLifeArea,
  deleteLifeArea,
  listLifeAreas,
  updateLifeArea,
} from "@/server/services/life-areas/life-areas-service";

import { protectedProcedure, router } from "../trpc";

const dimension = z.enum(["corpo", "alma", "espirito"]);
const name = z.string().trim().min(1, "O nome é obrigatório.").max(120);

export const lifeAreasRouter = router({
  list: protectedProcedure.query(({ ctx }) => listLifeAreas(ctx.userId)),

  create: protectedProcedure
    .input(z.object({ dimension, name, color: z.string().nullish(), icon: z.string().nullish() }))
    .mutation(({ ctx, input }) => createLifeArea(ctx.userId, input)),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        dimension: dimension.optional(),
        name: name.optional(),
        color: z.string().nullish(),
        icon: z.string().nullish(),
        position: z.number().int().min(0).optional(),
      }),
    )
    .mutation(({ ctx, input }) => {
      const { id, ...patch } = input;
      return updateLifeArea(ctx.userId, id, patch);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await deleteLifeArea(ctx.userId, input.id);
      return { ok: true as const };
    }),
});
