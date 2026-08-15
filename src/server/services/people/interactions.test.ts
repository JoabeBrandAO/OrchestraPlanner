import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { migrateForTests } from "@/server/db/migrate-for-tests";
import { withUserContext } from "@/server/db/rls";
import { interactions, people, users } from "@/server/db/schema";

import { addInteraction, deleteInteraction, listInteractionsOf } from "./interactions-service";
import { createPerson, listPeople } from "./people-service";

/**
 * Interações e "há quanto tempo não falo" (#43). Integração com Postgres real sob RLS
 * (role `app_rls`). Roda só com `DATABASE_URL` (local), pulado no CI sem banco.
 */
const hasDb = Boolean(process.env.DATABASE_URL);

const stamp = Date.now();
const uid = `int_user_${stamp}`;
const other = `int_other_${stamp}`;

const limpar = async (id: string) => {
  await withUserContext(id, (tx) => tx.delete(interactions));
  await withUserContext(id, (tx) => tx.delete(people));
};

describe.skipIf(!hasDb)("interações — convívio e último contato", () => {
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

  it("registrar devolve o retrato completo — histórico e último contato", async () => {
    const ana = await createPerson(uid, { name: "Ana" });

    const snapshot = await addInteraction(uid, ana.id, {
      happenedAt: "2026-08-10",
      kind: "ligacao",
      notes: "  falamos da viagem  ",
    });

    expect(snapshot.interactions).toHaveLength(1);
    expect(snapshot.lastInteractionAt).toBe("2026-08-10");
    expect(snapshot.interactions[0]!.notes).toBe("falamos da viagem");

    await limpar(uid);
  });

  it("o último contato é o mais recente, não o último registrado", async () => {
    // Anotar uma conversa antiga depois não pode fazer a pessoa parecer procurada agora.
    const ana = await createPerson(uid, { name: "Ana" });

    await addInteraction(uid, ana.id, { happenedAt: "2026-08-10", kind: "encontro" });
    const snapshot = await addInteraction(uid, ana.id, {
      happenedAt: "2026-07-01",
      kind: "mensagem",
    });

    expect(snapshot.lastInteractionAt).toBe("2026-08-10");
    expect(snapshot.interactions.map((i) => i.happenedAt)).toEqual(["2026-08-10", "2026-07-01"]);

    await limpar(uid);
  });

  it("quem nunca teve contato aparece como tal na lista, não como 'há 0 dias'", async () => {
    await createPerson(uid, { name: "Ana" });

    const [pessoa] = await listPeople(uid);
    expect(pessoa!.lastInteractionAt).toBeNull();

    await limpar(uid);
  });

  it("a lista traz o último contato de cada pessoa", async () => {
    const ana = await createPerson(uid, { name: "Ana" });
    await createPerson(uid, { name: "Bruno" });
    await addInteraction(uid, ana.id, { happenedAt: "2026-08-10" });

    const lista = await listPeople(uid);
    expect(lista.find((p) => p.name === "Ana")!.lastInteractionAt).toBe("2026-08-10");
    expect(lista.find((p) => p.name === "Bruno")!.lastInteractionAt).toBeNull();

    await limpar(uid);
  });

  it("remover a última interação faz o contato anterior voltar a valer", async () => {
    const ana = await createPerson(uid, { name: "Ana" });
    await addInteraction(uid, ana.id, { happenedAt: "2026-07-01" });
    const comDuas = await addInteraction(uid, ana.id, { happenedAt: "2026-08-10" });

    const recente = comDuas.interactions.find((i) => i.happenedAt === "2026-08-10")!;
    const depois = await deleteInteraction(uid, recente.id);

    expect(depois!.lastInteractionAt).toBe("2026-07-01");

    await limpar(uid);
  });

  it("remover a única interação devolve ao estado de nunca procurado", async () => {
    const ana = await createPerson(uid, { name: "Ana" });
    const snapshot = await addInteraction(uid, ana.id, { happenedAt: "2026-08-10" });

    const depois = await deleteInteraction(uid, snapshot.interactions[0]!.id);

    expect(depois!.lastInteractionAt).toBeNull();
    expect(depois!.interactions).toEqual([]);

    await limpar(uid);
  });

  it("recusa data que não é data", async () => {
    const ana = await createPerson(uid, { name: "Ana" });

    await expect(addInteraction(uid, ana.id, { happenedAt: "ontem" })).rejects.toThrow(/inválida/i);

    await limpar(uid);
  });

  it("apagar a pessoa leva o histórico junto", async () => {
    const ana = await createPerson(uid, { name: "Ana" });
    await addInteraction(uid, ana.id, { happenedAt: "2026-08-10" });

    await withUserContext(uid, (tx) => tx.delete(people));

    const restantes = await withUserContext(uid, (tx) => tx.select().from(interactions));
    expect(restantes).toEqual([]);
  });

  it("isola por usuário (RLS) — outro não registra nem lê o convívio alheio", async () => {
    const ana = await createPerson(uid, { name: "Ana" });
    await addInteraction(uid, ana.id, { happenedAt: "2026-08-10" });

    await expect(addInteraction(other, ana.id, { happenedAt: "2026-08-11" })).rejects.toThrow(
      /não encontrada/i,
    );

    const doOutro = await listInteractionsOf(other, ana.id);
    expect(doOutro.interactions).toEqual([]);
    expect(doOutro.lastInteractionAt).toBeNull();

    await limpar(uid);
  });
});
