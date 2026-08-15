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

/**
 * Contador de **idas ao banco**. Contra o Neon cada statement é uma viagem pela rede, e é
 * ela — não o tempo de CPU do Postgres — que domina a resposta. Contar é determinístico,
 * ao contrário de cronometrar, então dá para pôr teto num teste sem ficar frágil.
 *
 * O custo em produção é uma soma numa closure; a instrumentação de verdade (`debug`) só é
 * ligada por quem chama `countQueries`.
 */
let queryCount = 0;

/** Roda `fn` contando quantos statements foram ao banco. */
export async function countQueries<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const before = queryCount;
  const result = await fn();
  return [result, queryCount - before];
}

/** Retorna o client Drizzle singleton, criando a conexão sob demanda. */
export function getDb() {
  if (!db) {
    client = postgres(getConnectionString(), {
      // `prepare: false` é necessário para pools em modo transaction (Neon/pgBouncer).
      prepare: false,
      debug: () => {
        queryCount += 1;
      },
    });
    db = drizzle(client, { schema });
  }
  return db;
}

export type Database = ReturnType<typeof getDb>;
export { schema };
