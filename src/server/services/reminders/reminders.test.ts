import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { migrateForTests } from "@/server/db/migrate-for-tests";
import { withUserContext } from "@/server/db/rls";
import { events, people, pushSubscriptions, reminderSends, users } from "@/server/db/schema";
import { createEvent } from "@/server/services/events/events-service";
import { createPerson } from "@/server/services/people/people-service";

import {
  claimBirthdayReminder,
  claimReminder,
  deleteSubscription,
  listSubscriptions,
  pendingBirthdayReminders,
  pendingReminders,
  releaseReminder,
  saveSubscription,
} from "./reminders-service";

/**
 * Lembretes por Web Push (#36). Integração com Postgres real sob RLS (role `app_rls`).
 * Roda só com `DATABASE_URL` (local), pulado no CI sem banco.
 */
const hasDb = Boolean(process.env.DATABASE_URL);

const stamp = Date.now();
const uid = `rem_user_${stamp}`;
const other = `rem_other_${stamp}`;

const utc = (iso: string) => new Date(`${iso}Z`);

const inscricao = (endpoint: string) => ({
  endpoint,
  p256dh: "chave-publica-do-navegador",
  auth: "segredo-do-navegador",
  userAgent: "teste",
});

const limpar = async (id: string) => {
  await withUserContext(id, (tx) => tx.delete(reminderSends));
  await withUserContext(id, (tx) => tx.delete(events));
  await withUserContext(id, (tx) => tx.delete(people));
  await withUserContext(id, (tx) => tx.delete(pushSubscriptions));
};

describe.skipIf(!hasDb)("lembretes — inscrições, vencimento e idempotência", () => {
  beforeAll(async () => {
    await migrateForTests();
    for (const id of [uid, other]) {
      await withUserContext(id, (tx) =>
        tx.insert(users).values({ id, email: `${id}@test.local`, name: "T" }),
      );
    }
  });

  afterAll(async () => {
    for (const id of [uid, other]) {
      await limpar(id);
      await withUserContext(id, (tx) => tx.delete(users));
    }
  });

  it("guarda a inscrição e reinscrever atualiza em vez de duplicar", async () => {
    await saveSubscription(uid, inscricao("https://push.exemplo/abc"));
    await saveSubscription(uid, {
      ...inscricao("https://push.exemplo/abc"),
      p256dh: "chave-nova",
    });

    const lista = await listSubscriptions(uid);
    expect(lista).toHaveLength(1);
    expect(lista[0]!.p256dh).toBe("chave-nova");

    await limpar(uid);
  });

  it("o mesmo navegador pode servir a duas contas", async () => {
    // O único é (user_id, endpoint): cada conta tem direito aos próprios lembretes.
    await saveSubscription(uid, inscricao("https://push.exemplo/compartilhado"));
    await saveSubscription(other, inscricao("https://push.exemplo/compartilhado"));

    expect(await listSubscriptions(uid)).toHaveLength(1);
    expect(await listSubscriptions(other)).toHaveLength(1);

    await limpar(uid);
    await limpar(other);
  });

  it("remover a inscrição desliga os lembretes daquele aparelho", async () => {
    await saveSubscription(uid, inscricao("https://push.exemplo/abc"));
    await deleteSubscription(uid, "https://push.exemplo/abc");

    expect(await listSubscriptions(uid)).toEqual([]);
  });

  it("encontra o lembrete que venceu na janela", async () => {
    const evento = await createEvent(uid, {
      title: "Consulta",
      startsAt: utc("2026-08-17T09:00:00"),
      endsAt: utc("2026-08-17T10:00:00"),
      reminderMinutesBefore: 15,
    });

    const pendentes = await pendingReminders(uid, {
      since: utc("2026-08-17T08:40:00"),
      now: utc("2026-08-17T08:50:00"),
    });

    expect(pendentes).toHaveLength(1);
    expect(pendentes[0]!.eventId).toBe(evento.id);
    expect(pendentes[0]!.title).toBe("Consulta");
    expect(pendentes[0]!.reminderAt.toISOString()).toBe("2026-08-17T08:45:00.000Z");

    await limpar(uid);
  });

  it("compromisso sem lembrete não gera nada", async () => {
    await createEvent(uid, {
      title: "Sem aviso",
      startsAt: utc("2026-08-17T09:00:00"),
      endsAt: utc("2026-08-17T10:00:00"),
    });

    expect(
      await pendingReminders(uid, {
        since: utc("2026-08-17T08:00:00"),
        now: utc("2026-08-17T09:00:00"),
      }),
    ).toEqual([]);

    await limpar(uid);
  });

  it("o lembrete reservado some da lista de pendentes", async () => {
    const evento = await createEvent(uid, {
      title: "Consulta",
      startsAt: utc("2026-08-17T09:00:00"),
      endsAt: utc("2026-08-17T10:00:00"),
      reminderMinutesBefore: 15,
    });
    const janela = { since: utc("2026-08-17T08:40:00"), now: utc("2026-08-17T08:50:00") };

    const primeiro = await claimReminder(uid, evento.id, utc("2026-08-17T09:00:00"));
    expect(primeiro).toBe(true);
    expect(await pendingReminders(uid, janela)).toEqual([]);

    // Uma segunda passada que se cruze com a primeira não consegue a reserva.
    expect(await claimReminder(uid, evento.id, utc("2026-08-17T09:00:00"))).toBe(false);

    await limpar(uid);
  });

  it("devolver a reserva faz o lembrete voltar para a fila", async () => {
    const evento = await createEvent(uid, {
      title: "Consulta",
      startsAt: utc("2026-08-17T09:00:00"),
      endsAt: utc("2026-08-17T10:00:00"),
      reminderMinutesBefore: 15,
    });
    const janela = { since: utc("2026-08-17T08:40:00"), now: utc("2026-08-17T08:50:00") };

    await claimReminder(uid, evento.id, utc("2026-08-17T09:00:00"));
    await releaseReminder(uid, evento.id, utc("2026-08-17T09:00:00"));

    expect(await pendingReminders(uid, janela)).toHaveLength(1);

    await limpar(uid);
  });

  it("cada ocorrência de uma série avisa uma vez", async () => {
    const evento = await createEvent(uid, {
      title: "Reunião semanal",
      startsAt: utc("2026-08-03T09:00:00"),
      endsAt: utc("2026-08-03T10:00:00"),
      frequency: "weekly",
      reminderMinutesBefore: 15,
    });

    // Reservar a segunda-feira 10 não pode calar o lembrete da 17.
    await claimReminder(uid, evento.id, utc("2026-08-10T09:00:00"));

    const daSemanaSeguinte = await pendingReminders(uid, {
      since: utc("2026-08-17T08:40:00"),
      now: utc("2026-08-17T08:50:00"),
    });
    expect(daSemanaSeguinte).toHaveLength(1);
    expect(daSemanaSeguinte[0]!.occurrenceStartsAt.toISOString()).toBe("2026-08-17T09:00:00.000Z");

    await limpar(uid);
  });

  it("avisa do aniversário no dia, às 8h da manhã", async () => {
    // Aniversário é um dia, não um horário: o disparo é fixo, não configurável.
    await createPerson(uid, { name: "Ana", birthday: { day: 17, month: 8, year: 1990 } });

    const pendentes = await pendingBirthdayReminders(uid, {
      since: utc("2026-08-17T10:50:00"),
      now: utc("2026-08-17T11:10:00"),
    });

    expect(pendentes).toHaveLength(1);
    expect(pendentes[0]!.name).toBe("Ana");
    expect(pendentes[0]!.turningAge).toBe(36);
    expect(pendentes[0]!.remindAt.toISOString()).toBe("2026-08-17T11:00:00.000Z");

    await limpar(uid);
  });

  it("o aniversário reservado não sai de novo — a mesma marca dos compromissos", async () => {
    const ana = await createPerson(uid, {
      name: "Ana",
      birthday: { day: 17, month: 8, year: 1990 },
    });
    const janela = { since: utc("2026-08-17T10:50:00"), now: utc("2026-08-17T11:10:00") };

    expect(await claimBirthdayReminder(uid, ana.id, utc("2026-08-17T11:00:00"))).toBe(true);
    expect(await pendingBirthdayReminders(uid, janela)).toEqual([]);
    expect(await claimBirthdayReminder(uid, ana.id, utc("2026-08-17T11:00:00"))).toBe(false);

    await limpar(uid);
  });

  it("a reserva de aniversário não colide com a de compromisso", async () => {
    // As duas origens dividem a tabela; o CHECK garante que cada linha tem uma só.
    const ana = await createPerson(uid, {
      name: "Ana",
      birthday: { day: 17, month: 8, year: 1990 },
    });
    const evento = await createEvent(uid, {
      title: "Consulta",
      startsAt: utc("2026-08-17T11:00:00"),
      endsAt: utc("2026-08-17T12:00:00"),
      reminderMinutesBefore: 0,
    });

    expect(await claimBirthdayReminder(uid, ana.id, utc("2026-08-17T11:00:00"))).toBe(true);
    expect(await claimReminder(uid, evento.id, utc("2026-08-17T11:00:00"))).toBe(true);

    await limpar(uid);
  });

  it("isola por usuário (RLS) — inscrição e envio de um não aparecem para o outro", async () => {
    await saveSubscription(uid, inscricao("https://push.exemplo/do-dono"));
    const evento = await createEvent(uid, {
      title: "Consulta",
      startsAt: utc("2026-08-17T09:00:00"),
      endsAt: utc("2026-08-17T10:00:00"),
      reminderMinutesBefore: 15,
    });
    await claimReminder(uid, evento.id, utc("2026-08-17T09:00:00"));

    expect(await listSubscriptions(other)).toEqual([]);
    const enviosDoOutro = await withUserContext(other, (tx) => tx.select().from(reminderSends));
    expect(enviosDoOutro).toEqual([]);

    await limpar(uid);
  });
});
