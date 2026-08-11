import { z } from "zod";

import {
  createPriority,
  deletePriority,
  listPriorities,
  movePriority,
  updatePriority,
} from "@/server/services/priorities/priorities-service";
import { PRIORITY_STATUSES } from "@/server/services/priorities/priority-status";

import { protectedProcedure, router } from "../trpc";

const title = z.string().trim().min(1, "O título é obrigatório.").max(120);
const uuid = z.string().uuid();
const status = z.enum(PRIORITY_STATUSES);

export const prioritiesRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({ goalId: uuid.optional(), status: status.optional(), tagId: uuid.optional() })
        .optional(),
    )
    .query(({ ctx, input }) => listPriorities(ctx.userId, input)),

  create: protectedProcedure
    .input(
      z.object({
        title,
        description: z.string().nullish(),
        goalId: uuid.nullish(),
        priorityLevel: z.number().int().min(0).max(3).optional(),
        dueDate: z.string().nullish(),
      }),
    )
    .mutation(({ ctx, input }) => createPriority(ctx.userId, input)),

  update: protectedProcedure
    .input(
      z.object({
        id: uuid,
        title: title.optional(),
        description: z.string().nullish(),
        goalId: uuid.nullish(),
        priorityLevel: z.number().int().min(0).max(3).optional(),
        dueDate: z.string().nullish(),
      }),
    )
    .mutation(({ ctx, input }) => {
      const { id, ...patch } = input;
      return updatePriority(ctx.userId, id, patch);
    }),

  /** Drag-and-drop: coluna de destino + índice dentro dela (o serviço reindexa). */
  move: protectedProcedure
    .input(z.object({ id: uuid, toStatus: status, toIndex: z.number().int().min(0) }))
    .mutation(({ ctx, input }) =>
      movePriority(ctx.userId, input.id, { toStatus: input.toStatus, toIndex: input.toIndex }),
    ),

  delete: protectedProcedure
    .input(z.object({ id: uuid }))
    .mutation(({ ctx, input }) => deletePriority(ctx.userId, input.id)),
});
