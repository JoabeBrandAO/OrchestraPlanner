import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

/**
 * Client Drizzle (postgres-js) — **lazy**: a conexão só é aberta na primeira
 * query. Isso mantém `next build` e os testes unitários verdes mesmo sem
 * `DATABASE_URL` (Phase A do setup), e funciona tanto com Postgres local
 * (docker-compose) quanto com Neon (string padrão com `sslmode=require`).
 */

function getConnectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL não definida. Copie .env.example para .env e preencha " +
        "(Postgres local via docker-compose ou string do Neon).",
    );
  }
  return url;
}

let client: ReturnType<typeof postgres> | undefined;
let db: ReturnType<typeof drizzle<typeof schema>> | undefined;

/** Retorna o client Drizzle singleton, criando a conexão sob demanda. */
export function getDb() {
  if (!db) {
    // `prepare: false` é necessário para pools em modo transaction (Neon/pgBouncer).
    client = postgres(getConnectionString(), { prepare: false });
    db = drizzle(client, { schema });
  }
  return db;
}

export type Database = ReturnType<typeof getDb>;
export { schema };
