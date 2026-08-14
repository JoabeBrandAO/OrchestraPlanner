import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { migrateForTests } from "@/server/db/migrate-for-tests";
import { withUserContext } from "@/server/db/rls";
import { events, lifeAreas, priorities, users } from "@/server/db/schema";
import { createPriority } from "@/server/services/priorities/priorities-service";

import { createEvent, deleteEvent, listEventsInRange, updateEvent } from "./events-service";

/**
 * Agenda (#18). Integração com Postgres real sob RLS (role `app_rls`).
 * Roda só com `DATABASE_URL` (local), pulado no CI sem banco.
 */
const hasDb = Boolean(process.env.DATABASE_URL);

const stamp = Date.now();
const uid = `ev_user_${stamp}`;
const other = `ev_other_${stamp}`;

const utc = (iso: string) => new Date(`${iso}Z`);
const week = { from: utc("2026-08-10T00:00:00"), to: utc("2026-08-17T00:00:00") };

describe.skipIf(!hasDb)("agenda — compromissos, recorrência e isolamento", () => {
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
      await withUserContext(id, (tx) => tx.delete(events));
      await withUserContext(id, (tx) => tx.delete(priorities));
      await withUserContext(id, (tx) => tx.delete(lifeAreas));
      await withUserContext(id, (tx) => tx.delete(users));
    }
  });

  it("cria compromisso e o encontra na janela da semana", async () => {
    const event = await createEvent(uid, {
      title: "  Consulta médica  ",
      startsAt: utc("2026-08-12T14:00:00"),
      endsAt: utc("2026-08-12T15:00:00"),
    });
    expect(event.title).toBe("Consulta médica");
    expect(event.frequency).toBe("none");

    const occurrences = await listEventsInRange(uid, week);
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0]!.startsAt.toISOString()).toBe("2026-08-12T14:00:00.000Z");

    await deleteEvent(uid, event.id);
  });

  it("recusa janela invertida e título vazio", async () => {
    await expect(
      createEvent(uid, {
        title: "Impossível",
        startsAt: utc("2026-08-12T15:00:00"),
        endsAt: utc("2026-08-12T14:00:00"),
      }),
    ).rejects.toThrow(/depois do início/i);

    await expect(
      createEvent(uid, {
        title: "   ",
        startsAt: utc("2026-08-12T14:00:00"),
        endsAt: utc("2026-08-12T15:00:00"),
      }),
    ).rejects.toThrow();
  });

  it("expande a série semanal e guarda uma linha só", async () => {
    const event = await createEvent(uid, {
      title: "Célula de quarta",
      startsAt: utc("2026-07-01T22:00:00"),
      endsAt: utc("2026-07-01T23:30:00"),
      frequency: "weekly",
    });

    const occurrences = await listEventsInRange(uid, week);
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0]!.startsAt.toISOString()).toBe("2026-08-12T22:00:00.000Z");
    // A recorrência é regra, não linhas materializadas.
    const rows = await withUserContext(uid, (tx) => tx.select().from(events));
    expect(rows).toHaveLength(1);

    // Um mês inteiro traz as 4 quartas.
    const month = await listEventsInRange(uid, {
      from: utc("2026-08-01T00:00:00"),
      to: utc("2026-09-01T00:00:00"),
    });
    expect(month).toHaveLength(4);

    await deleteEvent(uid, event.id);
  });

  it("série encerrada antes da janela não aparece", async () => {
    const event = await createEvent(uid, {
      title: "Curso que terminou",
      startsAt: utc("2026-06-01T12:00:00"),
      endsAt: utc("2026-06-01T13:00:00"),
      frequency: "weekly",
      recurrenceUntil: utc("2026-07-01T00:00:00"),
    });

    expect(await listEventsInRange(uid, week)).toHaveLength(0);
    await deleteEvent(uid, event.id);
  });

  it("vincula o compromisso a uma prioridade e traz o título dela", async () => {
    const priority = await createPriority(uid, { title: "Escrever proposta" });
    const event = await createEvent(uid, {
      title: "Bloco de foco",
      startsAt: utc("2026-08-11T13:00:00"),
      endsAt: utc("2026-08-11T15:00:00"),
      priorityId: priority.id,
      reminderMinutesBefore: 30,
    });

    const [occurrence] = await listEventsInRange(uid, week);
    expect(occurrence!.priorityTitle).toBe("Escrever proposta");
    expect(occurrence!.reminderAt?.toISOString()).toBe("2026-08-11T12:30:00.000Z");

    await deleteEvent(uid, event.id);
  });

  it("edita validando a janela com os valores finais", async () => {
    const event = await createEvent(uid, {
      title: "Reunião",
      startsAt: utc("2026-08-13T10:00:00"),
      endsAt: utc("2026-08-13T11:00:00"),
    });

    // Mudar só o fim para antes do início existente também precisa ser recusado.
    await expect(
      updateEvent(uid, event.id, { endsAt: utc("2026-08-13T09:00:00") }),
    ).rejects.toThrow(/depois do início/i);

    const updated = await updateEvent(uid, event.id, { title: "Reunião com o time" });
    expect(updated?.title).toBe("Reunião com o time");

    await deleteEvent(uid, event.id);
  });

  it("isola por usuário (RLS) — outro não vê nem edita", async () => {
    const event = await createEvent(uid, {
      title: "Compromisso privado",
      startsAt: utc("2026-08-14T09:00:00"),
      endsAt: utc("2026-08-14T10:00:00"),
    });

    expect(await listEventsInRange(other, week)).toHaveLength(0);
    expect(await updateEvent(other, event.id, { title: "Invasão" })).toBeNull();

    await deleteEvent(uid, event.id);
  });
});
