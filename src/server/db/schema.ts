import { sql } from "drizzle-orm";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Schema Drizzle do OrchestraPlanner.
// Toda tabela carrega o dono e é protegida por RLS (ver VISAO-DO-PRODUTO.md §5/§10).
// A RLS (ENABLE + FORCE + POLICY) é aplicada por uma migration custom, pois inclui
// `FORCE ROW LEVEL SECURITY` (necessário para o dono da tabela também respeitar a policy).

/**
 * Usuários. O `id` é o **Clerk user id** (ex.: "user_2abc...") e funciona como o
 * `user_id` de tenancy: cada usuário só enxerga a própria linha via RLS.
 */
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
