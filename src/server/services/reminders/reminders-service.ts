import { and, eq } from "drizzle-orm";

import { withUserContext } from "@/server/db/rls";
import { pushSubscriptions, reminderSends, type PushSubscriptionRow } from "@/server/db/schema";
import { listEventsInRange } from "@/server/services/events/events-service";

import { dueReminders, type DueReminder } from "./due";

/**
 * Lembretes por Web Push (#36). Como no resto do domínio, tudo recebe `userId` e roda sob
 * `withUserContext` — inclusive o disparo, que é um processo de fora do app: ele descobre
 * **quem** notificar com uma conexão elevada e faz o resto usuário a usuário, sob RLS.
 * A decisão de o que vence está em `due.ts`, pura.
 */

/** Antecedência máxima aceita pelo router (30 dias) — o quanto o disparo olha para frente. */
const MAX_REMINDER_LEAD_MS = 30 * 24 * 60 * 60 * 1000;

export type SubscriptionInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
};

/**
 * Guarda (ou atualiza) a inscrição deste navegador. Reinscrever é comum — o navegador
 * troca o endpoint sozinho de tempos em tempos —, então a operação é idempotente.
 */
export async function saveSubscription(
  userId: string,
  input: SubscriptionInput,
): Promise<PushSubscriptionRow> {
  if (!input.endpoint || !input.p256dh || !input.auth) {
    throw new Error("Inscrição de notificação incompleta.");
  }

  return withUserContext(userId, async (tx) => {
    const [row] = await tx
      .insert(pushSubscriptions)
      .values({
        userId,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent ?? null,
      })
      .onConflictDoUpdate({
        target: [pushSubscriptions.userId, pushSubscriptions.endpoint],
        set: { p256dh: input.p256dh, auth: input.auth, userAgent: input.userAgent ?? null },
      })
      .returning();
    return row!;
  });
}

export async function deleteSubscription(userId: string, endpoint: string): Promise<void> {
  await withUserContext(userId, (tx) =>
    tx
      .delete(pushSubscriptions)
      .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint))),
  );
}

export async function listSubscriptions(userId: string): Promise<PushSubscriptionRow[]> {
  return withUserContext(userId, (tx) =>
    tx.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId)),
  );
}

/**
 * Lembretes deste usuário que venceram na janela e **ainda não foram enviados**.
 *
 * A busca de ocorrências vai de `since` até `agora + antecedência máxima`: um lembrete que
 * vence agora pode pertencer a um compromisso de daqui a 30 dias, e procurar só o dia de
 * hoje deixaria esse de fora.
 */
export async function pendingReminders(
  userId: string,
  window: { since: Date; now: Date },
): Promise<DueReminder[]> {
  const occurrences = await listEventsInRange(userId, {
    from: window.since,
    to: new Date(window.now.getTime() + MAX_REMINDER_LEAD_MS),
  });

  const due = dueReminders(occurrences, window);
  if (due.length === 0) return [];

  const alreadySent = await withUserContext(userId, (tx) =>
    tx
      .select({
        eventId: reminderSends.eventId,
        occurrenceStartsAt: reminderSends.occurrenceStartsAt,
      })
      .from(reminderSends)
      .where(eq(reminderSends.userId, userId)),
  );

  const sentKeys = new Set(
    alreadySent.map((row) => `${row.eventId}@${row.occurrenceStartsAt.getTime()}`),
  );

  return due.filter(
    (reminder) => !sentKeys.has(`${reminder.eventId}@${reminder.occurrenceStartsAt.getTime()}`),
  );
}

/**
 * Reserva o envio **antes** de enviar: quem consegue inserir manda, e uma segunda passada
 * que se sobreponha à primeira encontra a linha e desiste. `false` = outro já pegou.
 *
 * A alternativa (marcar depois de enviar) deixa a janela aberta para a mesma notificação
 * sair duas vezes se duas passadas se cruzarem — e notificação repetida é o defeito mais
 * caro deste recurso.
 */
export async function claimReminder(
  userId: string,
  eventId: string,
  occurrenceStartsAt: Date,
): Promise<boolean> {
  const claimed = await withUserContext(userId, (tx) =>
    tx
      .insert(reminderSends)
      .values({ userId, eventId, occurrenceStartsAt })
      .onConflictDoNothing({
        target: [reminderSends.eventId, reminderSends.occurrenceStartsAt],
      })
      .returning({ id: reminderSends.id }),
  );

  return claimed.length > 0;
}

/** Devolve a reserva quando o envio falha de vez, para a próxima passada tentar de novo. */
export async function releaseReminder(
  userId: string,
  eventId: string,
  occurrenceStartsAt: Date,
): Promise<void> {
  await withUserContext(userId, (tx) =>
    tx
      .delete(reminderSends)
      .where(
        and(
          eq(reminderSends.eventId, eventId),
          eq(reminderSends.occurrenceStartsAt, occurrenceStartsAt),
        ),
      ),
  );
}
