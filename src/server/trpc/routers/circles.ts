import { z } from "zod";

import { RELATIONS } from "@/server/services/people/relations";
import {
  addCircleMember,
  createCircle,
  deleteCircle,
  linkPeople,
  listCircles,
  listLinksOf,
  removeCircleMember,
  unlinkPeople,
} from "@/server/services/people/relationships-service";
import { TITLE_MAX_LENGTH } from "@/server/services/shared/validate-title";

import { protectedProcedure, router } from "../trpc";

const uuid = z.string().uuid();
const name = z.string().trim().min(1, "O nome é obrigatório.").max(TITLE_MAX_LENGTH);
const CIRCLE_KINDS = ["familia", "celula", "amigos", "mentores", "outro"] as const;

/** Círculos e vínculos (#42). Router fino: valida a entrada e delega ao serviço. */
export const circlesRouter = router({
  list: protectedProcedure.query(({ ctx }) => listCircles(ctx.userId)),

  create: protectedProcedure
    .input(
      z.object({
        name,
        kind: z.enum(CIRCLE_KINDS).optional(),
        notes: z.string().max(2000).nullish(),
      }),
    )
    .mutation(({ ctx, input }) => createCircle(ctx.userId, input)),

  delete: protectedProcedure
    .input(z.object({ id: uuid }))
    .mutation(({ ctx, input }) => deleteCircle(ctx.userId, input.id)),

  addMember: protectedProcedure
    .input(z.object({ circleId: uuid, personId: uuid, role: z.string().trim().max(60).nullish() }))
    .mutation(({ ctx, input }) =>
      addCircleMember(ctx.userId, input.circleId, input.personId, input.role),
    ),

  removeMember: protectedProcedure
    .input(z.object({ id: uuid }))
    .mutation(({ ctx, input }) => removeCircleMember(ctx.userId, input.id)),

  /* Vínculos entre pessoas — moram aqui porque são o mesmo assunto: com quem cada um está. */

  linksOf: protectedProcedure
    .input(z.object({ personId: uuid }))
    .query(({ ctx, input }) => listLinksOf(ctx.userId, input.personId)),

  link: protectedProcedure
    .input(
      z.object({
        personId: uuid,
        relatedPersonId: uuid,
        /** O que `relatedPerson` é para `person` ("filho" = o outro é meu filho). */
        relation: z.enum(RELATIONS),
      }),
    )
    .mutation(({ ctx, input }) =>
      linkPeople(ctx.userId, input.personId, input.relatedPersonId, input.relation),
    ),

  unlink: protectedProcedure
    .input(z.object({ id: uuid }))
    .mutation(({ ctx, input }) => unlinkPeople(ctx.userId, input.id)),
});
