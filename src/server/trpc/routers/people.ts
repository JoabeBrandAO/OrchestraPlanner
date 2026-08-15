import { z } from "zod";

import {
  addContact,
  createPerson,
  deleteContact,
  deletePerson,
  listPeople,
  updatePerson,
} from "@/server/services/people/people-service";
import {
  CONTACT_KINDS,
  GENDERS,
  MARITAL_STATUSES,
  RELATION_TYPES,
} from "@/server/services/people/person-fields";
import { TITLE_MAX_LENGTH } from "@/server/services/shared/validate-title";

import { protectedProcedure, router } from "../trpc";

const uuid = z.string().uuid();
const name = z.string().trim().min(1, "O nome é obrigatório.").max(TITLE_MAX_LENGTH);

/** Dia, mês e ano opcional — a validação fina (31 de fevereiro) é do domínio. */
const birthday = z
  .object({
    day: z.number().int().min(1).max(31),
    month: z.number().int().min(1).max(12),
    year: z.number().int().nullable(),
  })
  .nullable();

const personFields = {
  nickname: z.string().trim().max(120).nullish(),
  birthday: birthday.optional(),
  gender: z.enum(GENDERS).optional(),
  maritalStatus: z.enum(MARITAL_STATUSES).optional(),
  /** Data ISO "YYYY-MM-DD", como as demais datas do projeto. */
  marriedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullish(),
  relationType: z.enum(RELATION_TYPES).optional(),
  lifeAreaId: uuid.nullish(),
  notes: z.string().max(2000).nullish(),
};

/** Pessoas & Relacionamentos (#41). Router fino: valida a entrada e delega ao serviço. */
export const peopleRouter = router({
  list: protectedProcedure.query(({ ctx }) => listPeople(ctx.userId)),

  create: protectedProcedure
    .input(z.object({ name, ...personFields }))
    .mutation(({ ctx, input }) => createPerson(ctx.userId, input)),

  update: protectedProcedure
    .input(z.object({ id: uuid, name: name.optional(), ...personFields }))
    .mutation(({ ctx, input }) => {
      const { id, ...patch } = input;
      return updatePerson(ctx.userId, id, patch);
    }),

  delete: protectedProcedure
    .input(z.object({ id: uuid }))
    .mutation(({ ctx, input }) => deletePerson(ctx.userId, input.id)),

  addContact: protectedProcedure
    .input(
      z.object({
        personId: uuid,
        kind: z.enum(CONTACT_KINDS),
        label: z.string().trim().max(60).nullish(),
        value: z.string().trim().min(1, "O contato não pode ser vazio.").max(300),
      }),
    )
    .mutation(({ ctx, input }) => {
      const { personId, ...contact } = input;
      return addContact(ctx.userId, personId, contact);
    }),

  deleteContact: protectedProcedure
    .input(z.object({ id: uuid }))
    .mutation(({ ctx, input }) => deleteContact(ctx.userId, input.id)),
});
