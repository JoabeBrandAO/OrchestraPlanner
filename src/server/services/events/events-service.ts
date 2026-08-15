// Comparações de data usam os helpers do Drizzle (`gt`/`gte`/`lt`), nunca `sql` cru: o
// template não mapeia o tipo do parâmetro e o driver recebe um `Date` que não sabe serializar.
import { and, asc, eq, gt, gte, inArray, isNull, lt, ne, or, sql, type SQL } from "drizzle-orm";

import { withUserContext } from "@/server/db/rls";
import { eventExceptions, events, lifeAreas, priorities, type EventRow } from "@/server/db/schema";
import { validateTitle } from "@/server/services/shared/validate-title";

import {
  expandOccurrences,
  isOccurrenceStart,
  reminderAt,
  type OccurrenceException,
  type Range,
  type RecurrenceFrequency,
} from "./recurrence";

/**
 * Camada de serviço da Agenda (#18). Como no resto do domínio, recebe `userId` e roda sob
 * `withUserContext` — a RLS isola. A matemática da recorrência vive em `recurrence.ts`,
 * pura e testável sem banco; aqui só ficam a leitura e as regras de escrita.
 */

/** Uma ocorrência concreta na tela: a linha do evento + o instante daquela repetição. */
export type EventOccurrence = {
  event: EventRow;
  /**
   * Instante **original** produzido pela regra — a identidade da ocorrência, que não muda
   * quando ela é remarcada. É por ele que a tela pede uma exceção (#35).
   */
  occurrenceStartsAt: Date;
  startsAt: Date;
  endsAt: Date;
  /** Já resolvidos: a sobrescrita da ocorrência quando existe, senão os da série. */
  title: string;
  description: string | null;
  /** Esta ocorrência foi remarcada ou reescrita (tem exceção própria). */
  isException: boolean;
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

    // Exceções dos candidatos (#35). Sem filtro de janela de propósito: uma ocorrência
    // remarcada **para dentro** da semana pode ter vindo de um instante fora dela, e o
    // filtro esconderia justamente essa. São poucas linhas por evento num uso pessoal; se
    // um dia crescer, é aqui que se aperta (índice `event_exceptions_user_event_idx`).
    const exceptionsByEvent = new Map<string, OccurrenceException[]>();
    if (rows.length > 0) {
      const exceptionRows = await tx
        .select()
        .from(eventExceptions)
        .where(
          inArray(
            eventExceptions.eventId,
            rows.map((row) => row.event.id),
          ),
        );

      for (const exception of exceptionRows) {
        const list = exceptionsByEvent.get(exception.eventId) ?? [];
        list.push(exception);
        exceptionsByEvent.set(exception.eventId, list);
      }
    }

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
        exceptionsByEvent.get(row.event.id) ?? [],
      );

      for (const occurrence of expanded) {
        occurrences.push({
          event: row.event,
          occurrenceStartsAt: occurrence.occurrenceStartsAt,
          startsAt: occurrence.startsAt,
          endsAt: occurrence.endsAt,
          title: occurrence.title ?? row.event.title,
          description: occurrence.description ?? row.event.description,
          isException:
            occurrence.startsAt.getTime() !== occurrence.occurrenceStartsAt.getTime() ||
            occurrence.title !== null ||
            occurrence.description !== null,
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
 * Edita o compromisso — a **série inteira**. Para mexer num dia só, `overrideOccurrence`
 * (#35). Devolve `null` se não existir para este usuário.
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

    // As exceções são identificadas pelo instante que a **regra** produz. Mover a âncora
    // da série desloca todos esses instantes, então as exceções precisam andar junto — na
    // mesma transação — ou deixariam de casar em silêncio.
    if (patch.startsAt !== undefined) {
      const delta = patch.startsAt.getTime() - current.startsAt.getTime();
      if (delta !== 0) {
        await tx
          .update(eventExceptions)
          .set({
            occurrenceStartsAt: sql`${eventExceptions.occurrenceStartsAt} + ${delta} * interval '1 millisecond'`,
            updatedAt: sql`now()`,
          })
          .where(eq(eventExceptions.eventId, id));
      }
    }

    // Trocar a regra (frequência ou intervalo) muda quais instantes existem: as exceções
    // da regra antiga não descrevem mais nada e são descartadas, em vez de virarem linhas
    // órfãs que a expansão teria que aprender a ignorar para sempre.
    const ruleChanged =
      (patch.frequency !== undefined && patch.frequency !== current.frequency) ||
      (patch.recurrenceInterval !== undefined &&
        patch.recurrenceInterval !== current.recurrenceInterval);
    if (ruleChanged) {
      await tx.delete(eventExceptions).where(eq(eventExceptions.eventId, id));
    }

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

/* -------------------------------------------------------------------------- */
/* Exceções de uma ocorrência (#35)                                            */
/* -------------------------------------------------------------------------- */

export type OccurrencePatch = {
  startsAt?: Date;
  endsAt?: Date;
  title?: string;
  description?: string | null;
};

/**
 * Confere que o instante é mesmo uma ocorrência **desta** série e devolve o evento.
 * Sem isso, a tela poderia gravar exceção para um instante que a regra nunca produz — uma
 * linha que não faz nada e assombra a próxima leitura.
 */
async function loadOccurrenceTarget(
  tx: Parameters<Parameters<typeof withUserContext>[1]>[0],
  eventId: string,
  occurrenceStartsAt: Date,
): Promise<EventRow> {
  const [event] = await tx.select().from(events).where(eq(events.id, eventId));
  if (!event) throw new Error("Compromisso não encontrado.");

  const isOccurrence = isOccurrenceStart(
    event.startsAt,
    {
      frequency: event.frequency,
      interval: event.recurrenceInterval,
      until: event.recurrenceUntil,
    },
    occurrenceStartsAt,
  );
  if (!isOccurrence) throw new Error("Esta data não é uma ocorrência deste compromisso.");

  return event;
}

/** Cancela uma ocorrência: some da agenda sem tocar no resto da série. */
export async function cancelOccurrence(
  userId: string,
  eventId: string,
  occurrenceStartsAt: Date,
): Promise<void> {
  await withUserContext(userId, async (tx) => {
    await loadOccurrenceTarget(tx, eventId, occurrenceStartsAt);

    // Uma exceção por ocorrência: cancelar depois de remarcar reescreve a mesma linha e
    // limpa as sobrescritas — cancelado é cancelado, sem horário fantasma guardado.
    await tx
      .insert(eventExceptions)
      .values({ userId, eventId, occurrenceStartsAt, cancelled: true })
      .onConflictDoUpdate({
        target: [eventExceptions.eventId, eventExceptions.occurrenceStartsAt],
        set: {
          cancelled: true,
          startsAt: null,
          endsAt: null,
          title: null,
          description: null,
          updatedAt: sql`now()`,
        },
      });
  });
}

/**
 * Remarca ou reescreve **uma** ocorrência. Repetição, lembrete, área e prioridade seguem
 * sendo da série: uma ocorrência editada não é um evento paralelo.
 */
export async function overrideOccurrence(
  userId: string,
  eventId: string,
  occurrenceStartsAt: Date,
  patch: OccurrencePatch,
): Promise<void> {
  await withUserContext(userId, async (tx) => {
    const event = await loadOccurrenceTarget(tx, eventId, occurrenceStartsAt);

    // A janela é validada com os valores finais, como no `updateEvent`: mudar só o fim
    // também pode invertê-la.
    const duration = event.endsAt.getTime() - event.startsAt.getTime();
    const startsAt = patch.startsAt ?? occurrenceStartsAt;
    const endsAt = patch.endsAt ?? new Date(startsAt.getTime() + duration);
    validateWindow(startsAt, endsAt);

    let title: string | null = null;
    if (patch.title !== undefined) {
      const validated = validateTitle(patch.title);
      if (!validated.ok) throw new Error(validated.error);
      // Título igual ao da série não é sobrescrita — guardar seria criar uma segunda
      // verdade que para de acompanhar a série quando ela for renomeada.
      title = validated.value === event.title ? null : validated.value;
    }

    await tx
      .insert(eventExceptions)
      .values({
        userId,
        eventId,
        occurrenceStartsAt,
        cancelled: false,
        startsAt,
        endsAt,
        title,
        description: patch.description ?? null,
      })
      .onConflictDoUpdate({
        target: [eventExceptions.eventId, eventExceptions.occurrenceStartsAt],
        set: {
          cancelled: false,
          startsAt,
          endsAt,
          title,
          description: patch.description ?? null,
          updatedAt: sql`now()`,
        },
      });
  });
}

/** Desfaz a exceção: a ocorrência volta a ser o que a regra manda. */
export async function restoreOccurrence(
  userId: string,
  eventId: string,
  occurrenceStartsAt: Date,
): Promise<void> {
  await withUserContext(userId, (tx) =>
    tx
      .delete(eventExceptions)
      .where(
        and(
          eq(eventExceptions.eventId, eventId),
          eq(eventExceptions.occurrenceStartsAt, occurrenceStartsAt),
        ),
      ),
  );
}
