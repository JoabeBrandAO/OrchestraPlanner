import { sql } from "drizzle-orm";
import {
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

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
  (t) => [
    index("life_areas_user_position_idx").on(t.userId, t.position),
    // Duas áreas com o mesmo nome não significam nada para o usuário — e sem esta regra
    // no banco, dois requests simultâneos do seed padrão criavam 24 áreas em vez de 12
    // (ver docs/ERROS.md 2026-08-13). O único é a garantia; o serviço só a respeita.
    uniqueIndex("life_areas_user_lower_name_uq").on(t.userId, sql`lower(${t.name})`),
  ],
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

// === Roda da Vida — issue #17 ===

/**
 * Avaliação da Roda da Vida (Visão §5): **uma linha por área** com a nota 0–10.
 *
 * Uma "rodada" (a roda inteira de um dia) é o conjunto de linhas que compartilham o mesmo
 * `assessed_at` — o serviço grava todas com o mesmo instante, então agrupar por ele é
 * exato, e não uma janela de tempo aproximada. Guardar rodadas em vez de sobrescrever a
 * nota é o que dá o histórico ("como eu estava em março").
 */
export const lifeAssessments = pgTable(
  "life_assessments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lifeAreaId: uuid("life_area_id")
      .notNull()
      .references(() => lifeAreas.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    assessedAt: timestamp("assessed_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("life_assessments_user_assessed_idx").on(t.userId, t.assessedAt),
    uniqueIndex("life_assessments_round_area_uq").on(t.userId, t.assessedAt, t.lifeAreaId),
  ],
);

export type LifeAssessment = typeof lifeAssessments.$inferSelect;
export type NewLifeAssessment = typeof lifeAssessments.$inferInsert;

// === Marcos das metas — issue #15 ===

/**
 * Marcos (checkpoints) de uma meta — os passos que provam que ela anda. A conclusão é
 * representada **só** por `completed_at` (NULL = pendente): um booleano paralelo poderia
 * discordar da data. `goals.progress` é derivado destes marcos (ver `goals/progress.ts`)
 * e recalculado pelo serviço a cada mudança — a coluna é cache do cálculo, não a verdade.
 */
export const goalMilestones = pgTable(
  "goal_milestones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    goalId: uuid("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    position: integer("position").notNull().default(0),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("goal_milestones_user_goal_position_idx").on(t.userId, t.goalId, t.position)],
);

export type GoalMilestone = typeof goalMilestones.$inferSelect;
export type NewGoalMilestone = typeof goalMilestones.$inferInsert;

// === Prioridades (Kanban) & Tags — issues #13–#14 ===

/** Coluna do Kanban de prioridades (Visão §5). `done` carrega `completed_at`. */
export const priorityStatus = pgEnum("priority_status", ["todo", "in_progress", "done"]);

/**
 * Prioridades: as tarefas acionáveis do dia a dia, opcionalmente puxando uma meta.
 * Ao remover a meta, a prioridade permanece (`goal_id` vira NULL) — mesmo critério de
 * `goals.life_area_id`. `position` é a ordem **dentro da coluna** (contígua, 0-based),
 * mantida pelo serviço em transação; é ela que o drag-and-drop persiste.
 */
export const priorities = pgTable(
  "priorities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    goalId: uuid("goal_id").references(() => goals.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
    status: priorityStatus("status").notNull().default("todo"),
    priorityLevel: integer("priority_level").notNull().default(0),
    position: integer("position").notNull().default(0),
    dueDate: date("due_date"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("priorities_user_status_position_idx").on(t.userId, t.status, t.position),
    index("priorities_user_goal_idx").on(t.userId, t.goalId),
  ],
);

export type Priority = typeof priorities.$inferSelect;
export type NewPriority = typeof priorities.$inferInsert;

/**
 * Tags reutilizáveis do usuário. O único por `(user_id, lower(name))` evita duplicar
 * "Casa" e "casa" — o serviço reaproveita a tag existente em vez de criar outra.
 */
export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [uniqueIndex("tags_user_lower_name_uq").on(t.userId, sql`lower(${t.name})`)],
);

export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;

/**
 * Junção N:N prioridade↔tag. Carrega `user_id` porque a RLS é por linha: sem ele a
 * policy não teria como isolar a associação (as FKs sozinhas não são verificadas sob RLS).
 */
export const priorityTags = pgTable(
  "priority_tags",
  {
    priorityId: uuid("priority_id")
      .notNull()
      .references(() => priorities.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    primaryKey({ columns: [t.priorityId, t.tagId] }),
    index("priority_tags_user_tag_idx").on(t.userId, t.tagId),
  ],
);

export type PriorityTag = typeof priorityTags.$inferSelect;
export type NewPriorityTag = typeof priorityTags.$inferInsert;
