import { sql } from "drizzle-orm";
import {
  boolean,
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

// === Agenda — issue #18 ===

/** Frequência da recorrência de um compromisso. `none` = evento único. */
export const recurrenceFrequency = pgEnum("recurrence_frequency", [
  "none",
  "daily",
  "weekly",
  "monthly",
  "yearly",
]);

/**
 * Compromissos da Agenda (Visão §6, épico 4).
 *
 * A recorrência é guardada como **regra**, não como linhas materializadas: um "toda
 * segunda" vira uma linha só, e as ocorrências são expandidas na leitura (ver
 * `events/recurrence.ts`). Materializar exigiria decidir até quando gerar, e editar a
 * série significaria caçar e reescrever N linhas.
 *
 * `priority_id` é o "vincular tarefas a blocos" do épico: o compromisso pode ser o bloco
 * de tempo reservado para uma prioridade do Kanban. Ao apagar a prioridade o bloco
 * permanece (vira NULL) — mesmo critério de `goals.life_area_id`.
 */
export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lifeAreaId: uuid("life_area_id").references(() => lifeAreas.id, { onDelete: "set null" }),
    priorityId: uuid("priority_id").references(() => priorities.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    allDay: boolean("all_day").notNull().default(false),
    frequency: recurrenceFrequency("frequency").notNull().default("none"),
    /** A cada quantos períodos repete (2 = de duas em duas semanas). */
    recurrenceInterval: integer("recurrence_interval").notNull().default(1),
    /** Fim da série; NULL = sem fim previsto (a expansão é sempre limitada pela janela). */
    recurrenceUntil: timestamp("recurrence_until", { withTimezone: true }),
    /** Minutos de antecedência do lembrete; NULL = sem lembrete. */
    reminderMinutesBefore: integer("reminder_minutes_before"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("events_user_starts_idx").on(t.userId, t.startsAt),
    index("events_user_priority_idx").on(t.userId, t.priorityId),
  ],
);

export type EventRow = typeof events.$inferSelect;
export type NewEventRow = typeof events.$inferInsert;

/**
 * Exceções de uma ocorrência da série (#35). Guardar a recorrência como **regra** custa
 * isto: "esta terça não tem" não é uma linha para apagar, é uma exceção à parte.
 *
 * A chave é `occurrence_starts_at` — o instante **original** que a regra produziu, o mesmo
 * papel do `RECURRENCE-ID` do RFC 5545. Quando a âncora da série se move, o serviço desloca
 * as exceções pelo mesmo delta na mesma transação, senão elas deixariam de casar em
 * silêncio (ver `events-service.ts`).
 *
 * Só o que é **daquela** ocorrência pode ser sobrescrito: horário, título e descrição.
 * Repetição, lembrete, área e prioridade continuam sendo da série — uma ocorrência editada
 * não é um evento paralelo, e duplicar esses campos criaria uma segunda verdade.
 */
export const eventExceptions = pgTable(
  "event_exceptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    /** O instante original da ocorrência, calculado pela regra. */
    occurrenceStartsAt: timestamp("occurrence_starts_at", { withTimezone: true }).notNull(),
    /** Ocorrência cancelada: some da agenda sem tocar no resto da série. */
    cancelled: boolean("cancelled").notNull().default(false),
    /** Sobrescritas; NULL = herda a série. */
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    title: text("title"),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    // Uma exceção por ocorrência: cancelar e depois remarcar reescreve a mesma linha.
    uniqueIndex("event_exceptions_event_occurrence_key").on(t.eventId, t.occurrenceStartsAt),
    index("event_exceptions_user_event_idx").on(t.userId, t.eventId),
  ],
);

export type EventExceptionRow = typeof eventExceptions.$inferSelect;

/**
 * Inscrições de Web Push (#36) — o que o navegador devolve ao aceitar receber notificação:
 * um `endpoint` (a caixa postal daquele navegador no serviço de push) e as duas chaves da
 * criptografia ponta a ponta. Sem elas o servidor não consegue cifrar a mensagem.
 *
 * O único é `(user_id, endpoint)`, não `endpoint` sozinho: o mesmo navegador pode estar
 * logado em duas contas, e cada uma tem direito aos próprios lembretes. Único global também
 * vazaria a existência da inscrição alheia através do erro de conflito.
 */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    /** Só para o usuário reconhecer o aparelho numa lista futura. */
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("push_subscriptions_user_endpoint_key").on(t.userId, t.endpoint),
    index("push_subscriptions_user_idx").on(t.userId),
  ],
);

export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;

/**
 * Lembretes já disparados (#36). É o que impede a mesma notificação de sair duas vezes: o
 * disparo roda de tempos em tempos e, sem esta marca, cada passada reenviaria tudo que
 * ainda estivesse dentro da janela.
 *
 * A chave é a mesma identidade usada nas exceções — evento + instante **original** da
 * ocorrência —, então remarcar um dia não faz o lembrete dele ser reenviado.
 *
 * Aniversários (#44) usam a **mesma** marca, por `person_id`: são outra origem, mas o
 * problema é idêntico, e duas tabelas se desencontrariam. Exatamente uma das duas origens
 * é preenchida — garantido por CHECK na migration `0024`.
 */
export const reminderSends = pgTable(
  "reminder_sends",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventId: uuid("event_id").references(() => events.id, { onDelete: "cascade" }),
    personId: uuid("person_id").references(() => people.id, { onDelete: "cascade" }),
    occurrenceStartsAt: timestamp("occurrence_starts_at", { withTimezone: true }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("reminder_sends_event_occurrence_key").on(t.eventId, t.occurrenceStartsAt),
    uniqueIndex("reminder_sends_person_occurrence_key").on(t.personId, t.occurrenceStartsAt),
    index("reminder_sends_user_sent_idx").on(t.userId, t.sentAt),
  ],
);

/* -------------------------------------------------------------------------- */
/* Pessoas & Relacionamentos — CRM pessoal (épico #19)                         */
/* -------------------------------------------------------------------------- */

export const gender = pgEnum("gender", ["feminino", "masculino", "outro", "nao_informado"]);

export const maritalStatus = pgEnum("marital_status", [
  "solteiro",
  "casado",
  "uniao_estavel",
  "divorciado",
  "viuvo",
  "nao_informado",
]);

export const relationType = pgEnum("relation_type", [
  "familia",
  "conjuge",
  "amigo",
  "mentor",
  "colega",
  "irmao_fe",
  "outro",
]);

/**
 * Pessoas (#41). O aniversário é guardado como **dia, mês e ano opcional**, não como uma
 * `date`: muita gente sabe o dia e o mês de alguém e não sabe o ano. Um `date` obrigaria a
 * inventar um ano e depois fingir que ele não existe — e alguém acabaria mostrando idade
 * errada. A matemática fica em `people/birthday.ts`, pura.
 *
 * `married_at` só faz sentido para casado/união estável (decisão #25) e a regra é do
 * serviço: o banco guarda nulo quando o estado civil não o comporta. O **cônjuge** não é
 * texto solto aqui — ele é um vínculo entre pessoas, e vem na fatia #42; guardar o nome
 * agora criaria uma segunda verdade sobre a mesma pessoa.
 */
export const people = pgTable(
  "people",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lifeAreaId: uuid("life_area_id").references(() => lifeAreas.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    nickname: text("nickname"),
    birthDay: integer("birth_day"),
    birthMonth: integer("birth_month"),
    /** NULL = ano desconhecido; sem ele não há idade a mostrar. */
    birthYear: integer("birth_year"),
    gender: gender("gender").notNull().default("nao_informado"),
    maritalStatus: maritalStatus("marital_status").notNull().default("nao_informado"),
    marriedAt: date("married_at"),
    relationType: relationType("relation_type").notNull().default("outro"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("people_user_name_idx").on(t.userId, t.name),
    // Aniversariantes do mês são a consulta quente do módulo (#44).
    index("people_user_birthday_idx").on(t.userId, t.birthMonth, t.birthDay),
  ],
);

export type PersonRow = typeof people.$inferSelect;

export const contactKind = pgEnum("contact_kind", ["telefone", "email", "social", "endereco"]);

/**
 * Contatos de uma pessoa (#41) — vários por pessoa, cada um com o rótulo de quem o usa
 * ("celular", "trabalho"). `user_id` próprio pelo mesmo motivo de `priority_tags`: a policy
 * de RLS precisa decidir sozinha, sem join com a tabela pai.
 */
export const peopleContacts = pgTable(
  "people_contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    kind: contactKind("kind").notNull(),
    label: text("label"),
    value: text("value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("people_contacts_person_idx").on(t.userId, t.personId)],
);

export type PersonContactRow = typeof peopleContacts.$inferSelect;

export const personRelation = pgEnum("person_relation", [
  "conjuge",
  "pai_mae",
  "filho",
  "irmao",
  "avo",
  "neto",
  "tio",
  "sobrinho",
  "primo",
  "sogro",
  "genro_nora",
  "cunhado",
  "amigo",
  "mentor",
  "mentorado",
  "colega",
  "outro",
]);

/**
 * Vínculo entre duas pessoas (#42). **Uma linha por par**, nunca duas: duas linhas (A→B e
 * B→A) podem divergir, e aí a mesma relação passa a dizer duas coisas. A leitura do outro
 * lado é derivada pelo inverso (`people/relations.ts`).
 *
 * O par é gravado em ordem canônica (`person_id <= related_person_id`), o que faz o índice
 * único impedir o espelho sem precisar de gatilho. `relation` diz o que
 * **`related_person` é para `person`**.
 */
export const personLinks = pgTable(
  "person_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    relatedPersonId: uuid("related_person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    relation: personRelation("relation").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("person_links_pair_key").on(t.personId, t.relatedPersonId),
    index("person_links_user_related_idx").on(t.userId, t.relatedPersonId),
  ],
);

export type PersonLinkRow = typeof personLinks.$inferSelect;

export const circleKind = pgEnum("circle_kind", [
  "familia",
  "celula",
  "amigos",
  "mentores",
  "outro",
]);

/** Grupos de pessoas (#42): família, célula, amigos próximos, mentores. */
export const circles = pgTable(
  "circles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: circleKind("kind").notNull().default("outro"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [uniqueIndex("circles_user_lower_name_uq").on(t.userId, sql`lower(${t.name})`)],
);

export type CircleRow = typeof circles.$inferSelect;

/** Quem está no círculo, e com que papel ("líder", "caçula"). Uma vez por círculo. */
export const circleMembers = pgTable(
  "circle_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    circleId: uuid("circle_id")
      .notNull()
      .references(() => circles.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    role: text("role"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("circle_members_circle_person_key").on(t.circleId, t.personId),
    index("circle_members_user_person_idx").on(t.userId, t.personId),
  ],
);

export type CircleMemberRow = typeof circleMembers.$inferSelect;

export const interactionKind = pgEnum("interaction_kind", [
  "encontro",
  "ligacao",
  "mensagem",
  "outro",
]);

/**
 * Interações com uma pessoa (#43) — o acompanhamento do convívio, que é o que separa este
 * módulo de uma agenda de telefone.
 *
 * `happened_at` é uma **data**, não um instante: ninguém lembra que horas ligou para a mãe,
 * e o que a tela pergunta é "há quanto tempo", que se mede em dias. O cálculo vive em
 * `people/contact-gap.ts`, puro, com o "hoje" injetável.
 */
export const interactions = pgTable(
  "interactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    happenedAt: date("happened_at").notNull(),
    kind: interactionKind("kind").notNull().default("outro"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    // A consulta quente é "o último contato de cada pessoa".
    index("interactions_user_person_date_idx").on(t.userId, t.personId, t.happenedAt),
  ],
);

export type InteractionRow = typeof interactions.$inferSelect;

/* -------------------------------------------------------------------------- */
/* Financeiro (épico #20)                                                      */
/* -------------------------------------------------------------------------- */

export const accountKind = pgEnum("account_kind", [
  "corrente",
  "poupanca",
  "carteira",
  "cartao",
  "investimento",
]);

/**
 * Contas (#52). `initial_balance_cents` é o ponto de partida — o que havia antes do
 * primeiro lançamento registrado aqui.
 *
 * **Não existe coluna de saldo.** O saldo é derivado dos lançamentos a cada leitura, pela
 * mesma regra do progresso das metas e do último contato das pessoas: guardar o número
 * pronto cria uma segunda verdade que desanda no primeiro lançamento corrigido.
 *
 * Dinheiro em **centavos inteiros**, nunca ponto flutuante (ver `finance/money.ts`).
 */
export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: accountKind("kind").notNull().default("corrente"),
    initialBalanceCents: integer("initial_balance_cents").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [uniqueIndex("accounts_user_lower_name_uq").on(t.userId, sql`lower(${t.name})`)],
);

export type AccountRow = typeof accounts.$inferSelect;

export const transactionDirection = pgEnum("transaction_direction", ["entrada", "saida"]);

/** Categorias de lançamento (#52) — semeadas na primeira conta, editáveis depois. */
export const transactionCategories = pgTable(
  "transaction_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    direction: transactionDirection("direction").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    // Único por nome **e sentido**: "Bônus" pode existir como entrada e "Bonificação" como
    // saída sem se atrapalharem.
    uniqueIndex("transaction_categories_user_name_direction_uq").on(
      t.userId,
      sql`lower(${t.name})`,
      t.direction,
    ),
  ],
);

export type TransactionCategoryRow = typeof transactionCategories.$inferSelect;

/**
 * Lançamentos (#52). O **sinal vem do `direction`**, não do número: `amount_cents` é sempre
 * positivo (garantido por CHECK na migration). Aceitar valor negativo criaria duas formas
 * de dizer a mesma coisa, e uma delas some quando alguém troca o tipo e esquece o sinal.
 *
 * `happened_at` é data, não instante: extrato é por dia, e ninguém lembra a hora da compra.
 */
export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => transactionCategories.id, {
      onDelete: "set null",
    }),
    lifeAreaId: uuid("life_area_id").references(() => lifeAreas.id, { onDelete: "set null" }),
    happenedAt: date("happened_at").notNull(),
    direction: transactionDirection("direction").notNull(),
    amountCents: integer("amount_cents").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    // As consultas quentes: o extrato de uma conta e o mês inteiro.
    index("transactions_user_account_date_idx").on(t.userId, t.accountId, t.happenedAt),
    index("transactions_user_date_idx").on(t.userId, t.happenedAt),
  ],
);

export type TransactionRow = typeof transactions.$inferSelect;
