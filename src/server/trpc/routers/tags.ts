import { z } from "zod";

import { TAG_NAME_MAX_LENGTH } from "@/server/services/tags/tag-name";
import {
  createTag,
  deleteTag,
  listTags,
  setPriorityTags,
} from "@/server/services/tags/tags-service";

import { protectedProcedure, router } from "../trpc";

const uuid = z.string().uuid();

export const tagsRouter = router({
  list: protectedProcedure.query(({ ctx }) => listTags(ctx.userId)),

  /** Idempotente por nome (case-insensitive) — é o que o autocomplete do board usa. */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1, "O nome da tag é obrigatório.").max(TAG_NAME_MAX_LENGTH),
        color: z.string().nullish(),
      }),
    )
    .mutation(({ ctx, input }) => createTag(ctx.userId, input)),

  delete: protectedProcedure
    .input(z.object({ id: uuid }))
    .mutation(({ ctx, input }) => deleteTag(ctx.userId, input.id)),

  /** Define o conjunto de tags de uma prioridade (substitui o anterior). */
  setForPriority: protectedProcedure
    .input(z.object({ priorityId: uuid, tagIds: z.array(uuid) }))
    .mutation(({ ctx, input }) => setPriorityTags(ctx.userId, input.priorityId, input.tagIds)),
});
