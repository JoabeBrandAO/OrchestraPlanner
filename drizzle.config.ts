import "dotenv/config";

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    // `generate` não precisa de conexão; `migrate`/`push`/`studio` leem do .env.
    // Migrations rodam como o DONO (neondb_owner), não como o role restrito da app:
    // DDL e o journal `drizzle.__drizzle_migrations` exigem privilégios que o
    // `app_rls` (sem BYPASSRLS, só DML) não tem. Fallback p/ DATABASE_URL em setups
    // onde dono == app (ex.: Postgres local via docker-compose).
    url: process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
