import { clerkClient } from "@clerk/nextjs/server";
import { z } from "zod";

import { deleteAccount } from "@/server/services/users/account";

import { rateLimitedProcedure, router } from "../trpc";

/** Conta do usuário (#74). Router fino: valida a entrada e delega ao serviço. */
export const accountRouter = router({
  /** Apaga o dado e a identidade no Clerk. Exige a frase de confirmação. */
  delete: rateLimitedProcedure("account.delete")
    .input(z.object({ confirmation: z.string().max(20) }))
    .mutation(({ ctx, input }) =>
      deleteAccount(ctx.userId, input.confirmation, async (userId) => {
        const clerk = await clerkClient();
        await clerk.users.deleteUser(userId);
      }),
    ),
});
