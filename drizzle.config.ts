import "dotenv/config";

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    // `generate` não precisa de conexão; `migrate`/`push`/`studio` leem do .env.
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
