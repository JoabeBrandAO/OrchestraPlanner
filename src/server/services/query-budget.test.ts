import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { countQueries } from "@/server/db";
import { migrateForTests } from "@/server/db/migrate-for-tests";
import { withUserContext } from "@/server/db/rls";
import { circles, events, interactions, people, users } from "@/server/db/schema";
import { createEvent, listEventsInRange } from "@/server/services/events/events-service";
import { addInteraction } from "@/server/services/people/interactions-service";
import { addContact, createPerson, listPeople } from "@/server/services/people/people-service";
import {
  addCircleMember,
  createCircle,
  listCircles,
} from "@/server/services/people/relationships-service";

/**
 * Teto de **idas ao banco** por leitura de tela.
 *
 * Contra o Neon, cada statement é uma viagem pela rede: é ela que domina a resposta, não o
 * tempo de CPU do Postgres. Por isso o teto é contado, e não cronometrado — contar é
 * determinístico e não fica frágil conforme a máquina ou a fila da rede.
 *
 * Toda leitura carrega 3 statements de moldura (`BEGIN`, `set_config` da RLS e `COMMIT`),
 * então o que se mede aqui de verdade é **quantos SELECTs** a operação precisa. Um a mais
 * some no teste unitário e aparece na tela do dono como meio segundo parado.
 */
const hasDb = Boolean(process.env.DATABASE_URL);

const stamp = Date.now();
const uid = `qb_user_${stamp}`;

/** `BEGIN` + `select set_config(...)` + `COMMIT` — o custo fixo de qualquer operação. */
const MOLDURA = 3;

const utc = (iso: string) => new Date(`${iso}Z`);

describe.skipIf(!hasDb)("orçamento de consultas por leitura", () => {
  beforeAll(async () => {
    await migrateForTests();
    await withUserContext(uid, (tx) =>
      tx.insert(users).values({ id: uid, email: `${uid}@test.local`, name: "T" }),
    );

    // Massa pequena, mas com todos os relacionamentos ligados: o número de consultas não
    // pode depender de quantas linhas existem.
    for (const name of ["Ana", "Bruno", "Carla"]) {
      const pessoa = await createPerson(uid, {
        name,
        birthday: { day: 15, month: 8, year: 1990 },
      });
      await addContact(uid, pessoa.id, { kind: "telefone", value: "11999999999" });
      await addInteraction(uid, pessoa.id, { happenedAt: "2026-08-10" });
    }

    const circulo = await createCircle(uid, { name: "Família", kind: "familia" });
    const [primeira] = await listPeople(uid);
    await addCircleMember(uid, circulo.id, primeira!.id);

    for (const title of ["Reunião", "Consulta"]) {
      await createEvent(uid, {
        title,
        startsAt: utc("2026-08-10T09:00:00"),
        endsAt: utc("2026-08-10T10:00:00"),
        frequency: "weekly",
      });
    }
  });

  afterAll(async () => {
    await withUserContext(uid, (tx) => tx.delete(interactions));
    await withUserContext(uid, (tx) => tx.delete(circles));
    await withUserContext(uid, (tx) => tx.delete(events));
    await withUserContext(uid, (tx) => tx.delete(people));
    await withUserContext(uid, (tx) => tx.delete(users));
  });

  it("a lista de pessoas cabe em uma consulta", async () => {
    // Pessoas, contatos e último contato saem juntos: são a mesma tela.
    const [lista, consultas] = await countQueries(() => listPeople(uid));

    expect(lista).toHaveLength(3);
    expect(lista[0]!.contacts).toHaveLength(1);
    expect(lista[0]!.lastInteractionAt).toBe("2026-08-10");
    expect(consultas).toBe(MOLDURA + 1);
  });

  it("a agenda cabe em uma consulta", async () => {
    // Compromissos e as exceções deles saem juntos.
    const [ocorrencias, consultas] = await countQueries(() =>
      listEventsInRange(uid, { from: utc("2026-08-10T00:00:00"), to: utc("2026-08-17T00:00:00") }),
    );

    expect(ocorrencias.length).toBeGreaterThan(0);
    expect(consultas).toBe(MOLDURA + 1);
  });

  it("os círculos cabem em uma consulta", async () => {
    const [lista, consultas] = await countQueries(() => listCircles(uid));

    expect(lista).toHaveLength(1);
    expect(lista[0]!.members).toHaveLength(1);
    expect(consultas).toBe(MOLDURA + 1);
  });

  it("o número de consultas não cresce com o número de linhas", async () => {
    // A garantia que importa: nada de N+1 escondido atrás de uma lista pequena.
    const [, antes] = await countQueries(() => listPeople(uid));

    for (const name of ["Daniel", "Eva", "Fábio", "Gabi"]) {
      const pessoa = await createPerson(uid, { name });
      await addContact(uid, pessoa.id, { kind: "email", value: `${name}@exemplo.com` });
    }

    const [lista, depois] = await countQueries(() => listPeople(uid));
    expect(lista).toHaveLength(7);
    expect(depois).toBe(antes);
  });
});
