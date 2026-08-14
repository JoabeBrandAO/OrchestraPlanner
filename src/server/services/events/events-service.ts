// Comparações de data usam os helpers do Drizzle (`gt`/`gte`/`lt`), nunca `sql` cru: o
// template não mapeia o tipo do parâmetro e o driver recebe um `Date` que não sabe serializar.
import { and, asc, eq, gt, gte, isNull, lt, ne, or, sql, type SQL } from "drizzle-orm";

import { withUserContext } from "@/server/db/rls";
import { events, lifeAreas, priorities, type EventRow } from "@/server/db/schema";
import { validateTitle } from "@/server/services/shared/validate-title";

import { expandOccurrences, reminderAt, type Range, type RecurrenceFrequency } from "./recurrence";

/**
 * Camada de serviço da Agenda (#18). Como no resto do domínio, recebe `userId` e roda sob
 * `withUserContext` — a RLS isola. A matemática da recorrência vive em `recurrence.ts`,
 * pura e testável sem banco; aqui só ficam a leitura e as regras de escrita.
 */

/** Uma ocorrência concreta na tela: a linha do evento + o instante daquela repetição. */
export type EventOccurrence = {
  event: EventRow;
  startsAt: Date;
  endsAt: Date;
  /** Quando o lembrete dispararia; `null` se o evento não tem lembrete. */
  reminderAt: Date | null;
  lifeAreaName: string | null;
  priorityTitle: string | null;
};

export type CreateEventInput = {
  title: string;
  description?: string | null;
  startsAt: Date;
  endsAt: Date;
  allDay?: boolean;
  lifeAreaId?: string | null;
  priorityId?: string | null;
  frequency?: RecurrenceFrequency;
  recurrenceInterval?: number;
  recurrenceUntil?: Date | null;
  reminderMinutesBefore?: number | null;
};

/** Regras de escrita comuns a criar e editar — um compromisso não pode acabar antes de começar. */
function validateWindow(startsAt: Date, endsAt: Date): void {
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    throw new Error("Data inválida.");
  }
  if (endsAt <= startsAt) throw new Error("O fim precisa ser depois do início.");
}

function validateInterval(interval: number | undefined): void {
  if (interval !== undefined && (!Number.isInteger(interval) || interval < 1)) {
    throw new Error("O intervalo da repetição precisa ser um número inteiro a partir de 1.");
  }
}

export async function createEvent(userId: string, input: CreateEventInput): Promise<EventRow> {
  const title = validateTitle(input.title);
  if (!title.ok) throw new Error(title.error);
  validateWindow(input.startsAt, input.endsAt);
  validateInterval(input.recurrenceInterval);

  return withUserContext(userId, async (tx) => {
    const [row] = await tx
      .insert(events)
      .values({
        userId,
        title: title.value,
        description: input.description ?? null,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        allDay: input.allDay ?? false,
        lifeAreaId: input.lifeAreaId ?? null,
        priorityId: input.priorityId ?? null,
        frequency: input.frequency ?? "none",
        recurrenceInterval: input.recurrenceInterval ?? 1,
        recurrenceUntil: input.recurrenceUntil ?? null,
        reminderMinutesBefore: input.reminderMinutesBefore ?? null,
      })
      .returning();
    return row!;
  });
}

/**
 * Compromissos que aparecem na janela, **já expandidos** em ocorrências e ordenados.
 *
 * O filtro no banco é deliberadamente largo — ele só descarta o que não tem chance de
 * aparecer (começou depois da janela; série que terminou antes dela). Quem decide de fato
 * é `expandOccurrences`, porque o passo da recorrência não se expressa bem em SQL.
 */
export async function listEventsInRange(userId: string, range: Range): Promise<EventOccurrence[]> {
  return withUserContext(userId, async (tx) => {
    const candidates: SQL | undefined = and(
      lt(events.startsAt, range.to),
      or(
        // Evento único: basta terminar depois do início da janela.
        and(eq(events.frequency, "none"), gt(events.endsAt, range.from)),
        // Série: vale enquanto não tiver terminado antes da janela.
        and(
          ne(events.frequency, "none"),
          or(isNull(events.recurrenceUntil), gte(events.recurrenceUntil, range.from)),
        ),
      ),
    );

    const rows = await tx
      .select({
        event: events,
        lifeAreaName: lifeAreas.name,
        priorityTitle: priorities.title,
      })
      .from(events)
      .leftJoin(lifeAreas, eq(lifeAreas.id, events.lifeAreaId))
      .leftJoin(priorities, eq(priorities.id, events.priorityId))
      .where(candidates)
      .orderBy(asc(events.startsAt));

    const occurrences: EventOccurrence[] = [];
    for (const row of rows) {
      const expanded = expandOccurrences(
        {
          startsAt: row.event.startsAt,
          endsAt: row.event.endsAt,
          rule: {
            frequency: row.event.frequency,
            interval: row.event.recurrenceInterval,
            until: row.event.recurrenceUntil,
          },
        },
        range,
      );

      for (const occurrence of expanded) {
        occurrences.push({
          event: row.event,
          startsAt: occurrence.startsAt,
          endsAt: occurrence.endsAt,
          reminderAt: reminderAt(occurrence, row.event.reminderMinutesBefore),
          lifeAreaName: row.lifeAreaName,
          priorityTitle: row.priorityTitle,
        });
      }
    }

    return occurrences.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  });
}

export type UpdateEventInput = Partial<CreateEventInput>;

/**
 * Edita o compromisso (a série inteira — editar uma ocorrência isolada exigiria exceções,
 * que esta fatia não cobre). Devolve `null` se não existir para este usuário.
 */
export async function updateEvent(
  userId: string,
  id: string,
  patch: UpdateEventInput,
): Promise<EventRow | null> {
  validateInterval(patch.recurrenceInterval);

  return withUserContext(userId, async (tx) => {
    const [current] = await tx.select().from(events).where(eq(events.id, id));
    if (!current) return null;

    // A janela é validada com os valores finais: mudar só o fim também pode invertê-la.
    const startsAt = patch.startsAt ?? current.startsAt;
    const endsAt = patch.endsAt ?? current.endsAt;
    validateWindow(startsAt, endsAt);

    const set: Record<string, unknown> = { updatedAt: sql`now()` };
    if (patch.title !== undefined) {
      const title = validateTitle(patch.title);
      if (!title.ok) throw new Error(title.error);
      set.title = title.value;
    }
    if (patch.description !== undefined) set.description = patch.description;
    if (patch.startsAt !== undefined) set.startsAt = patch.startsAt;
    if (patch.endsAt !== undefined) set.endsAt = patch.endsAt;
    if (patch.allDay !== undefined) set.allDay = patch.allDay;
    if (patch.lifeAreaId !== undefined) set.lifeAreaId = patch.lifeAreaId;
    if (patch.priorityId !== undefined) set.priorityId = patch.priorityId;
    if (patch.frequency !== undefined) set.frequency = patch.frequency;
    if (patch.recurrenceInterval !== undefined) set.recurrenceInterval = patch.recurrenceInterval;
    if (patch.recurrenceUntil !== undefined) set.recurrenceUntil = patch.recurrenceUntil;
    if (patch.reminderMinutesBefore !== undefined) {
      set.reminderMinutesBefore = patch.reminderMinutesBefore;
    }

    const [row] = await tx.update(events).set(set).where(eq(events.id, id)).returning();
    return row ?? null;
  });
}

export async function deleteEvent(userId: string, id: string): Promise<void> {
  await withUserContext(userId, (tx) => tx.delete(events).where(eq(events.id, id)));
}
