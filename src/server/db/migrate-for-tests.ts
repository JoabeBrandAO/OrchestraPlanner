import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/**
 * Aplica as migrations nos testes de integração, conectando como o **dono**
 * (`MIGRATION_DATABASE_URL`) — o role `app_rls` não tem privilégio de DDL nem acesso
 * ao schema `drizzle`. Fallback p/ `DATABASE_URL` em setups onde dono == app
 * (ex.: Postgres local). Usado nos `beforeAll` que precisam do schema garantido.
 */
export async function migrateForTests(): Promise<void> {
  const url = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL!;
  const client = postgres(url, { prepare: false, max: 1 });
  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  await client.end();
}
