import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { getDb } from "./index";
import type * as schema from "./schema";

type Db = PostgresJsDatabase<typeof schema>;
/** Transação Drizzle dentro de um contexto de usuário. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Executa `fn` dentro de uma transação com `app.user_id` definido para `userId`.
 * É assim que a RLS sabe "quem" está consultando: as policies comparam a coluna
 * de tenancy com `current_setting('app.user_id')`. Usa `set_config(..., true)`
 * (escopo local à transação), então o valor não vaza para outras conexões do pool.
 */
export async function withUserContext<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const db = getDb();
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`);
    return fn(tx);
  });
}
