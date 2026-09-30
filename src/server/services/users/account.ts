import { eq, sql } from "drizzle-orm";

import { withUserContext } from "@/server/db/rls";
import { users } from "@/server/db/schema";
import { DomainError } from "@/server/services/shared/domain-error";

import { deleteUserData } from "./provisioning";

/**
 * Direitos do titular (#74, LGPD art. 18): portabilidade e eliminação.
 *
 * As tabelas vêm do **catálogo** (toda tabela com `user_id`), não de uma lista escrita à mão:
 * um módulo novo entra na exportação sozinho, em vez de ficar de fora até alguém lembrar.
 */

export type UserExport = {
  format: "orchestraplanner-export";
  version: 1;
  exportedAt: string;
  user: Record<string, unknown> | null;
  /** Nome da tabela → as linhas do usuário, como estão no banco (dinheiro em centavos). */
  tables: Record<string, Record<string, unknown>[]>;
};

/** Frase que a pessoa digita para confirmar — clique solto não apaga conta. */
export const DELETE_CONFIRMATION = "APAGAR";

export async function exportUserData(userId: string, now: Date = new Date()): Promise<UserExport> {
  return withUserContext(userId, async (tx) => {
    const catalog = await tx.execute<{ table_name: string }>(sql`
      select table_name from information_schema.columns
      where table_schema = 'public' and column_name = 'user_id'
      order by table_name
    `);

    const tables: UserExport["tables"] = {};
    for (const { table_name: table } of catalog) {
      // O `where` repete o que a RLS já garante: exportação é o lugar errado para confiar numa
      // camada só. O nome vem do catálogo e entra como identificador, nunca como texto.
      const rows = await tx.execute<Record<string, unknown>>(
        sql`select * from ${sql.identifier(table)} where user_id = ${userId}`,
      );
      tables[table] = [...rows];
    }

    const [user] = await tx.select().from(users).where(eq(users.id, userId));
    return {
      format: "orchestraplanner-export",
      version: 1,
      exportedAt: now.toISOString(),
      user: user ?? null,
      tables,
    };
  });
}

/**
 * Apaga a conta: primeiro o **dado** (a obrigação da LGPD), depois a identidade no Clerk.
 * Nessa ordem, uma falha no Clerk deixa no máximo um login sem dado nenhum — nunca dado sem
 * dono. A identidade é injetada, para o teste não depender do Clerk.
 */
export async function deleteAccount(
  userId: string,
  confirmation: string,
  deleteIdentity: (userId: string) => Promise<void>,
): Promise<void> {
  if (confirmation.trim() !== DELETE_CONFIRMATION) {
    throw new DomainError(`Para apagar a conta, digite ${DELETE_CONFIRMATION}.`);
  }
  await deleteUserData(userId);
  await deleteIdentity(userId);
}
