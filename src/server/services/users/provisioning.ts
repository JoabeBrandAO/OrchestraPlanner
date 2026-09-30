import { eq, sql } from "drizzle-orm";

import { withUserContext } from "@/server/db/rls";
import { users, type User } from "@/server/db/schema";
import { seedDefaultLifeAreas } from "@/server/services/life-areas/life-areas-service";

/**
 * Ciclo de vida do usuário no banco (#73). Quem chama é o webhook do Clerk — o momento em
 * que o usuário nasce, muda ou deixa de existir —, e não mais toda renderização de página.
 * Sem Clerk aqui dentro: recebe os dados prontos, então o teste roda contra o banco puro.
 */

export type UserProfile = { id: string; email: string; name: string | null };

/**
 * Cria (ou atualiza) a linha do usuário e garante as Áreas de Vida padrão. Idempotente: o
 * Clerk reentrega webhook quando não recebe 2xx, e `user.updated` chega a toda troca de
 * nome ou e-mail.
 */
export async function provisionUser(profile: UserProfile): Promise<User> {
  const [row] = await withUserContext(profile.id, (tx) =>
    tx
      .insert(users)
      .values(profile)
      .onConflictDoUpdate({
        target: users.id,
        set: { email: profile.email, name: profile.name, updatedAt: sql`now()` },
      })
      .returning(),
  );
  await seedDefaultLifeAreas(profile.id);
  return row!;
}

/** O usuário já existe no banco? Uma leitura só — é o que roda na renderização. */
export async function userExists(userId: string): Promise<boolean> {
  const rows = await withUserContext(userId, (tx) =>
    tx.select({ id: users.id }).from(users).where(eq(users.id, userId)),
  );
  return rows.length > 0;
}

/**
 * Apaga o usuário e **todo** o dado dele. Todas as tabelas apontam para `users` com
 * `on delete cascade`, então apagar a linha basta — e uma tabela nova que esquecer o
 * cascade é pega pelo teste, que confere tabela por tabela.
 */
export async function deleteUserData(userId: string): Promise<void> {
  await withUserContext(userId, (tx) => tx.delete(users).where(eq(users.id, userId)));
}
