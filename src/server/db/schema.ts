import { sql } from "drizzle-orm";
import { date, index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Schema Drizzle do OrchestraPlanner.
// Toda tabela carrega o dono (`user_id`/`id`) e é protegida por RLS (ver VISAO §5/§10).
// A RLS (ENABLE + FORCE + POLICY) é aplicada por migrations custom, pois inclui
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

// === Áreas de Vida (Corpo / Alma / Espírito) — issue #8 ===

/** Dimensão-raiz da área de vida (Visão §4). As sub-áreas são linhas de `life_areas`. */
export const lifeDimension = pgEnum("life_dimension", ["corpo", "alma", "espirito"]);

/**
 * Áreas de Vida (sub-áreas da Roda da Vida). Seedadas com o padrão Corpo/Alma/Espírito
 * e **customizáveis** pelo usuário (editar/remover/reordenar). Metas pertencem a uma área.
 */
export const lifeAreas = pgTable(
  "life_areas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    dimension: lifeDimension("dimension").notNull(),
    name: text("name").notNull(),
    color: text("color"),
    icon: text("icon"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("life_areas_user_position_idx").on(t.userId, t.position)],
);

export type LifeArea = typeof lifeAreas.$inferSelect;
export type NewLifeArea = typeof lifeAreas.$inferInsert;

// === Metas & Prioridades — issues #9–#12 ===

/** Status de uma meta (US-1.4). `completada` carrega `completed_at`. */
export const goalStatus = pgEnum("goal_status", ["ativa", "pausada", "completada"]);

/**
 * Metas (a "Lista/Árvore de Sonhos" do planner). Pertencem opcionalmente a uma área
 * de vida; ao remover a área, a meta permanece (área vira NULL). Tudo sob RLS por `user_id`.
 */
export const goals = pgTable(
  "goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lifeAreaId: uuid("life_area_id").references(() => lifeAreas.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
    status: goalStatus("status").notNull().default("ativa"),
    targetDate: date("target_date"),
    progress: integer("progress").notNull().default(0),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("goals_user_status_idx").on(t.userId, t.status),
    index("goals_user_updated_idx").on(t.userId, t.updatedAt),
  ],
);

export type Goal = typeof goals.$inferSelect;
export type NewGoal = typeof goals.$inferInsert;
