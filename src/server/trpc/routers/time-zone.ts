import { z } from "zod";

import { getTimeZone, seedTimeZone, setTimeZone } from "@/server/services/users/time-zone-service";

import { protectedProcedure, router } from "../trpc";

/** Fuso do usuário (#72). Router fino: valida a entrada e delega ao serviço. */
export const timeZoneRouter = router({
  /** O fuso guardado, ou `null` se nunca foi definido. */
  get: protectedProcedure.query(({ ctx }) => getTimeZone(ctx.userId)),

  /** Palpite do navegador — só grava se ainda não houver fuso. */
  seed: protectedProcedure
    .input(z.object({ timeZone: z.string().min(1).max(64) }))
    .mutation(({ ctx, input }) => seedTimeZone(ctx.userId, input.timeZone)),

  /** Escolha explícita na tela. */
  set: protectedProcedure
    .input(z.object({ timeZone: z.string().min(1).max(64) }))
    .mutation(({ ctx, input }) => setTimeZone(ctx.userId, input.timeZone)),
});
