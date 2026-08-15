import { z } from "zod";

import {
  cancelOccurrence,
  createEvent,
  deleteEvent,
  listEventsInRange,
  overrideOccurrence,
  restoreOccurrence,
  updateEvent,
} from "@/server/services/events/events-service";
import { RECURRENCE_FREQUENCIES } from "@/server/services/events/recurrence";
import { TITLE_MAX_LENGTH } from "@/server/services/shared/validate-title";

import { protectedProcedure, router } from "../trpc";

const title = z.string().trim().min(1, "O título é obrigatório.").max(TITLE_MAX_LENGTH);
const uuid = z.string().uuid();
const frequency = z.enum(RECURRENCE_FREQUENCIES);
/** Teto de 1 ano por leitura: a tela pede semana ou mês, e evita expandir sem limite. */
const MAX_RANGE_MS = 366 * 24 * 60 * 60 * 1000;

const eventFields = {
  description: z.string().nullish(),
  allDay: z.boolean().optional(),
  lifeAreaId: uuid.nullish(),
  priorityId: uuid.nullish(),
  frequency: frequency.optional(),
  recurrenceInterval: z.number().int().min(1).max(365).optional(),
  recurrenceUntil: z.date().nullish(),
  reminderMinutesBefore: z
    .number()
    .int()
    .min(0)
    .max(60 * 24 * 30)
    .nullish(),
};

/** Agenda (#18). Router fino: valida a entrada e delega ao serviço. */
export const eventsRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({ from: z.date(), to: z.date() })
        .refine((range) => range.to > range.from, "A janela precisa terminar depois de começar.")
        .refine(
          (range) => range.to.getTime() - range.from.getTime() <= MAX_RANGE_MS,
          "A janela não pode passar de um ano.",
        ),
    )
    .query(({ ctx, input }) => listEventsInRange(ctx.userId, input)),

  create: protectedProcedure
    .input(z.object({ title, startsAt: z.date(), endsAt: z.date(), ...eventFields }))
    .mutation(({ ctx, input }) => createEvent(ctx.userId, input)),

  update: protectedProcedure
    .input(
      z.object({
        id: uuid,
        title: title.optional(),
        startsAt: z.date().optional(),
        endsAt: z.date().optional(),
        ...eventFields,
      }),
    )
    .mutation(({ ctx, input }) => {
      const { id, ...patch } = input;
      return updateEvent(ctx.userId, id, patch);
    }),

  delete: protectedProcedure
    .input(z.object({ id: uuid }))
    .mutation(({ ctx, input }) => deleteEvent(ctx.userId, input.id)),

  /* Exceções de uma ocorrência (#35). `occurrenceStartsAt` é sempre o instante que a
     regra produziu — a identidade da ocorrência, não o horário remarcado. */

  cancelOccurrence: protectedProcedure
    .input(z.object({ eventId: uuid, occurrenceStartsAt: z.date() }))
    .mutation(({ ctx, input }) =>
      cancelOccurrence(ctx.userId, input.eventId, input.occurrenceStartsAt),
    ),

  overrideOccurrence: protectedProcedure
    .input(
      z.object({
        eventId: uuid,
        occurrenceStartsAt: z.date(),
        startsAt: z.date().optional(),
        endsAt: z.date().optional(),
        title: title.optional(),
        description: z.string().nullish(),
      }),
    )
    .mutation(({ ctx, input }) => {
      const { eventId, occurrenceStartsAt, ...patch } = input;
      return overrideOccurrence(ctx.userId, eventId, occurrenceStartsAt, {
        ...patch,
        description: patch.description ?? null,
      });
    }),

  restoreOccurrence: protectedProcedure
    .input(z.object({ eventId: uuid, occurrenceStartsAt: z.date() }))
    .mutation(({ ctx, input }) =>
      restoreOccurrence(ctx.userId, input.eventId, input.occurrenceStartsAt),
    ),
});
