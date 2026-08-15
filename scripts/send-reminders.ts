/**
 * Disparo dos lembretes (#36). Roda de fora do app (GitHub Actions, de tempos em tempos),
 * não numa rota HTTP: assim não depende de variável de ambiente na Vercel nem de um
 * endpoint público protegido por segredo compartilhado.
 *
 * **Duas conexões, de propósito.** A única coisa que exige olhar através dos usuários é
 * descobrir *quem* tem inscrição — e só isso usa o role elevado (`MIGRATION_DATABASE_URL`).
 * Todo o resto passa por `withUserContext` na conexão restrita (`DATABASE_URL`, role
 * `app_rls`), então a RLS continua sendo a guarda de verdade e um erro de laço aqui não
 * vira vazamento entre contas.
 *
 * Uso: `npx tsx scripts/send-reminders.ts`
 */
import "dotenv/config";

import postgres from "postgres";
import webpush from "web-push";

import { VAPID_PUBLIC_KEY, VAPID_SUBJECT } from "../src/lib/push";
import { lookbackStart } from "../src/server/services/reminders/due";
import {
  claimReminder,
  deleteSubscription,
  listSubscriptions,
  pendingReminders,
  releaseReminder,
} from "../src/server/services/reminders/reminders-service";

const timeLabel = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

/** Códigos com que o serviço de push diz "esta inscrição não existe mais". */
const GONE = [404, 410];

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} não definida.`);
  return value;
}

/**
 * Quem tem inscrição. É a única leitura através dos usuários, e por isso a única que usa a
 * conexão elevada — fechada logo em seguida.
 */
async function usersWithSubscriptions(): Promise<string[]> {
  const admin = postgres(requireEnv("MIGRATION_DATABASE_URL"), { prepare: false, max: 1 });
  try {
    const rows = await admin<{ user_id: string }[]>`
      select distinct user_id from push_subscriptions
    `;
    return rows.map((row) => row.user_id);
  } finally {
    await admin.end();
  }
}

async function main() {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, requireEnv("VAPID_PRIVATE_KEY"));

  const now = new Date();
  // Sem estado entre execuções: a janela é o teto de recuperação, e quem impede o reenvio
  // é a marca em `reminder_sends`, não a memória de quando rodou da última vez.
  const since = lookbackStart(null, now);

  const userIds = await usersWithSubscriptions();
  console.log(
    `[lembretes] ${userIds.length} usuário(s) com inscrição · janela desde ${since.toISOString()}`,
  );

  let enviados = 0;
  let falhas = 0;

  for (const userId of userIds) {
    const reminders = await pendingReminders(userId, { since, now });
    if (reminders.length === 0) continue;

    const subscriptions = await listSubscriptions(userId);
    if (subscriptions.length === 0) continue;

    for (const reminder of reminders) {
      // Reserva antes de enviar: se duas execuções se cruzarem, só uma manda.
      const claimed = await claimReminder(userId, reminder.eventId, reminder.occurrenceStartsAt);
      if (!claimed) continue;

      const payload = JSON.stringify({
        title: reminder.title,
        body: `Começa às ${timeLabel.format(reminder.startsAt)}.`,
        url: "/dashboard/agenda",
        tag: `${reminder.eventId}@${reminder.occurrenceStartsAt.getTime()}`,
      });

      // Um aparelho morto não pode impedir os outros de receber: cada envio é isolado.
      const results = await Promise.all(
        subscriptions.map(async (subscription) => {
          try {
            await webpush.sendNotification(
              {
                endpoint: subscription.endpoint,
                keys: { p256dh: subscription.p256dh, auth: subscription.auth },
              },
              payload,
            );
            return true;
          } catch (error) {
            const statusCode = (error as { statusCode?: number }).statusCode;
            if (statusCode && GONE.includes(statusCode)) {
              // O navegador desinstalou ou revogou: some com a inscrição em vez de tentar
              // para sempre.
              await deleteSubscription(userId, subscription.endpoint);
              console.log(`[lembretes] inscrição removida (${statusCode})`);
              return false;
            }
            console.error(`[lembretes] falha ao enviar: ${String(error)}`);
            return false;
          }
        }),
      );

      if (results.some(Boolean)) {
        enviados += 1;
      } else {
        // Ninguém recebeu: devolve a reserva para a próxima passada tentar de novo.
        await releaseReminder(userId, reminder.eventId, reminder.occurrenceStartsAt);
        falhas += 1;
      }
    }
  }

  console.log(`[lembretes] ${enviados} enviado(s), ${falhas} para tentar de novo`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[lembretes] erro:", error);
    process.exit(1);
  });
