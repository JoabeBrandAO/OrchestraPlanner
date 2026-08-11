import { currentUser } from "@clerk/nextjs/server";
import { sql } from "drizzle-orm";

import { withUserContext } from "@/server/db/rls";
import { users, type User } from "@/server/db/schema";
import { seedDefaultLifeAreas } from "@/server/services/life-areas/life-areas-service";

/**
 * Garante que o usuário logado (Clerk) exista na tabela `users` (upsert) e que
 * tenha as Áreas de Vida padrão (seed idempotente — Visão §4).
 * Roda dentro do contexto RLS do próprio usuário, então a policy aprova a
 * escrita (id = app.user_id). Chamado ao entrar na área autenticada.
 */
export async function ensureUserRecord(): Promise<User | null> {
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const email =
    clerkUser.primaryEmailAddress?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress ?? "";
  const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null;

  const [row] = await withUserContext(clerkUser.id, (tx) =>
    tx
      .insert(users)
      .values({ id: clerkUser.id, email, name })
      .onConflictDoUpdate({
        target: users.id,
        set: { email, name, updatedAt: sql`now()` },
      })
      .returning(),
  );

  // Provisiona as Áreas de Vida padrão na primeira vez (idempotente nas próximas).
  await seedDefaultLifeAreas(clerkUser.id);

  return row ?? null;
}
