import { z } from "zod";

import {
  deleteSubscription,
  listSubscriptions,
  saveSubscription,
} from "@/server/services/reminders/reminders-service";

import { protectedProcedure, router } from "../trpc";

/** Inscrições de Web Push (#36). Router fino: valida a entrada e delega ao serviço. */
export const pushRouter = router({
  /** Este navegador já está inscrito? É o que decide o rótulo do botão na tela. */
  isSubscribed: protectedProcedure
    .input(z.object({ endpoint: z.string().url() }))
    .query(async ({ ctx, input }) => {
      const subscriptions = await listSubscriptions(ctx.userId);
      return subscriptions.some((subscription) => subscription.endpoint === input.endpoint);
    }),

  subscribe: protectedProcedure
    .input(
      z.object({
        endpoint: z.string().url(),
        p256dh: z.string().min(1),
        auth: z.string().min(1),
        userAgent: z.string().max(500).nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await saveSubscription(ctx.userId, { ...input, userAgent: input.userAgent ?? null });
    }),

  unsubscribe: protectedProcedure
    .input(z.object({ endpoint: z.string().url() }))
    .mutation(({ ctx, input }) => deleteSubscription(ctx.userId, input.endpoint)),
});
