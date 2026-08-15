import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { migrateForTests } from "@/server/db/migrate-for-tests";
import { withUserContext } from "@/server/db/rls";
import { eventExceptions, events, users } from "@/server/db/schema";

import {
  cancelOccurrence,
  createEvent,
  listEventsInRange,
  overrideOccurrence,
  restoreOccurrence,
  updateEvent,
} from "./events-service";

/**
 * Exceções numa ocorrência da série (#35). Integração com Postgres real sob RLS
 * (role `app_rls`). Roda só com `DATABASE_URL` (local), pulado no CI sem banco.
 */
const hasDb = Boolean(process.env.DATABASE_URL);

const stamp = Date.now();
const uid = `exc_user_${stamp}`;
const other = `exc_other_${stamp}`;

const utc = (iso: string) => new Date(`${iso}Z`);
/** Agosto de 2026 inteiro: as segundas são 03, 10, 17, 24 e 31. */
const agosto = { from: utc("2026-08-01T00:00:00"), to: utc("2026-09-01T00:00:00") };

/** Série semanal às segundas, 9h–10h. */
async function serieSemanal(userId: string, title = "Reunião do time") {
  return createEvent(userId, {
    title,
    startsAt: utc("2026-08-03T09:00:00"),
    endsAt: utc("2026-08-03T10:00:00"),
    frequency: "weekly",
  });
}

const inicios = async (userId: string) =>
  (await listEventsInRange(userId, agosto)).map((o) => o.startsAt.toISOString());

/** Cada caso monta a sua série; limpar entre eles mantém os testes independentes. */
const limpar = () => withUserContext(uid, (tx) => tx.delete(events));

describe.skipIf(!hasDb)("agenda — exceções de ocorrência", () => {
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
      await withUserContext(id, (tx) => tx.delete(eventExceptions));
      await withUserContext(id, (tx) => tx.delete(events));
      await withUserContext(id, (tx) => tx.delete(users));
    }
  });

  it("cancelar uma ocorrência não afeta as demais da série", async () => {
    const serie = await serieSemanal(uid);

    await cancelOccurrence(uid, serie.id, utc("2026-08-17T09:00:00"));

    expect(await inicios(uid)).toEqual([
      "2026-08-03T09:00:00.000Z",
      "2026-08-10T09:00:00.000Z",
      "2026-08-24T09:00:00.000Z",
      "2026-08-31T09:00:00.000Z",
    ]);

    await limpar();
  });

  it("remarcar move só ela; a regra continua intacta", async () => {
    const serie = await serieSemanal(uid);

    await overrideOccurrence(uid, serie.id, utc("2026-08-10T09:00:00"), {
      startsAt: utc("2026-08-11T14:00:00"),
      endsAt: utc("2026-08-11T15:30:00"),
    });

    const lista = await listEventsInRange(uid, agosto);
    expect(lista.map((o) => o.startsAt.toISOString())).toEqual([
      "2026-08-03T09:00:00.000Z",
      "2026-08-11T14:00:00.000Z",
      "2026-08-17T09:00:00.000Z",
      "2026-08-24T09:00:00.000Z",
      "2026-08-31T09:00:00.000Z",
    ]);

    const remarcada = lista[1]!;
    expect(remarcada.occurrenceStartsAt.toISOString()).toBe("2026-08-10T09:00:00.000Z");
    expect(remarcada.isException).toBe(true);
    // A série não foi tocada: continua começando na primeira segunda.
    expect(remarcada.event.startsAt.toISOString()).toBe("2026-08-03T09:00:00.000Z");

    await limpar();
  });

  it("sobrescreve o texto só daquela ocorrência", async () => {
    const serie = await serieSemanal(uid);

    await overrideOccurrence(uid, serie.id, utc("2026-08-17T09:00:00"), {
      title: "Reunião com o cliente",
      description: "levar o protótipo",
    });

    const lista = await listEventsInRange(uid, agosto);
    expect(lista[2]!.title).toBe("Reunião com o cliente");
    expect(lista[2]!.description).toBe("levar o protótipo");
    expect(lista[3]!.title).toBe("Reunião do time");

    await limpar();
  });

  it("as exceções continuam valendo depois de mover a série", async () => {
    const serie = await serieSemanal(uid);
    await cancelOccurrence(uid, serie.id, utc("2026-08-17T09:00:00"));

    // A série inteira anda uma hora para a frente.
    await updateEvent(uid, serie.id, {
      startsAt: utc("2026-08-03T10:00:00"),
      endsAt: utc("2026-08-03T11:00:00"),
    });

    // A terceira segunda segue cancelada — agora no novo horário da série.
    expect(await inicios(uid)).toEqual([
      "2026-08-03T10:00:00.000Z",
      "2026-08-10T10:00:00.000Z",
      "2026-08-24T10:00:00.000Z",
      "2026-08-31T10:00:00.000Z",
    ]);

    await limpar();
  });

  it("trocar a regra descarta exceções que não descrevem mais nada", async () => {
    const serie = await serieSemanal(uid);
    await cancelOccurrence(uid, serie.id, utc("2026-08-17T09:00:00"));

    await updateEvent(uid, serie.id, { frequency: "daily" });

    const restantes = await withUserContext(uid, (tx) => tx.select().from(eventExceptions));
    expect(restantes).toHaveLength(0);

    await limpar();
  });

  it("desfazer devolve a ocorrência ao horário da série", async () => {
    const serie = await serieSemanal(uid);
    await overrideOccurrence(uid, serie.id, utc("2026-08-10T09:00:00"), {
      startsAt: utc("2026-08-11T14:00:00"),
      endsAt: utc("2026-08-11T15:00:00"),
    });

    await restoreOccurrence(uid, serie.id, utc("2026-08-10T09:00:00"));

    expect(await inicios(uid)).toEqual([
      "2026-08-03T09:00:00.000Z",
      "2026-08-10T09:00:00.000Z",
      "2026-08-17T09:00:00.000Z",
      "2026-08-24T09:00:00.000Z",
      "2026-08-31T09:00:00.000Z",
    ]);

    await limpar();
  });

  it("cancelar depois de remarcar não deixa horário fantasma guardado", async () => {
    const serie = await serieSemanal(uid);
    await overrideOccurrence(uid, serie.id, utc("2026-08-10T09:00:00"), {
      startsAt: utc("2026-08-11T14:00:00"),
      endsAt: utc("2026-08-11T15:00:00"),
    });
    await cancelOccurrence(uid, serie.id, utc("2026-08-10T09:00:00"));

    const [linha] = await withUserContext(uid, (tx) => tx.select().from(eventExceptions));
    expect(linha!.cancelled).toBe(true);
    expect(linha!.startsAt).toBeNull();
    expect(await inicios(uid)).not.toContain("2026-08-11T14:00:00.000Z");

    await limpar();
  });

  it("recusa exceção num instante que a regra não produz", async () => {
    const serie = await serieSemanal(uid);

    // Uma terça no meio de uma série de segundas.
    await expect(cancelOccurrence(uid, serie.id, utc("2026-08-11T09:00:00"))).rejects.toThrow(
      /não é uma ocorrência/i,
    );

    await limpar();
  });

  it("recusa remarcação com fim antes do início", async () => {
    const serie = await serieSemanal(uid);

    await expect(
      overrideOccurrence(uid, serie.id, utc("2026-08-10T09:00:00"), {
        startsAt: utc("2026-08-10T15:00:00"),
        endsAt: utc("2026-08-10T14:00:00"),
      }),
    ).rejects.toThrow(/depois do início/i);

    await limpar();
  });

  it("apagar a série leva as exceções junto", async () => {
    const serie = await serieSemanal(uid);
    await cancelOccurrence(uid, serie.id, utc("2026-08-17T09:00:00"));

    await limpar();

    const restantes = await withUserContext(uid, (tx) => tx.select().from(eventExceptions));
    expect(restantes).toHaveLength(0);
  });

  it("isola por usuário (RLS) — outro não vê nem cancela", async () => {
    const serie = await serieSemanal(uid);
    await cancelOccurrence(uid, serie.id, utc("2026-08-17T09:00:00"));

    const doOutro = await withUserContext(other, (tx) => tx.select().from(eventExceptions));
    expect(doOutro).toHaveLength(0);

    await expect(cancelOccurrence(other, serie.id, utc("2026-08-24T09:00:00"))).rejects.toThrow(
      /não encontrado/i,
    );
    // A série do dono segue com a mesma exceção, só a dela.
    const doDono = await withUserContext(uid, (tx) => tx.select().from(eventExceptions));
    expect(doDono).toHaveLength(1);

    await limpar();
  });
});
