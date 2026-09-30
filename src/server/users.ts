import { currentUser } from "@clerk/nextjs/server";

import { getAuthUserId } from "@/server/auth";
import { provisionUser, userExists } from "@/server/services/users/provisioning";

/**
 * Rede de segurança do provisionamento (#73). Quem cria o usuário no banco é o webhook do
 * Clerk (`/api/webhooks/clerk`); aqui só se **lê**. A escrita acontece apenas se a linha não
 * existir — usuário anterior ao webhook, ou webhook que ainda não chegou no primeiro acesso.
 *
 * Antes, toda página fazia `upsert` em `users` + `insert` das 12 áreas: duas transações de
 * escrita, oito statements, em toda visita, para algo que muda uma vez na vida do usuário.
 */
export async function ensureUserRecord(): Promise<void> {
  const userId = await getAuthUserId();
  if (!userId || (await userExists(userId))) return;

  const clerkUser = await currentUser();
  if (!clerkUser) return;
  await provisionUser({
    id: clerkUser.id,
    email:
      clerkUser.primaryEmailAddress?.emailAddress ??
      clerkUser.emailAddresses[0]?.emailAddress ??
      "",
    name: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null,
  });
}
