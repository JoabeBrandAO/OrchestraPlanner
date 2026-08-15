import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { migrateForTests } from "@/server/db/migrate-for-tests";
import { withUserContext } from "@/server/db/rls";
import { circleMembers, circles, people, personLinks, users } from "@/server/db/schema";

import { createPerson } from "./people-service";
import {
  addCircleMember,
  createCircle,
  deleteCircle,
  linkPeople,
  listCircles,
  listLinksOf,
  removeCircleMember,
  unlinkPeople,
} from "./relationships-service";

/**
 * Vínculos e círculos (#42). Integração com Postgres real sob RLS (role `app_rls`).
 * Roda só com `DATABASE_URL` (local), pulado no CI sem banco.
 */
const hasDb = Boolean(process.env.DATABASE_URL);

const stamp = Date.now();
const uid = `rel_user_${stamp}`;
const other = `rel_other_${stamp}`;

const limpar = async (id: string) => {
  await withUserContext(id, (tx) => tx.delete(circleMembers));
  await withUserContext(id, (tx) => tx.delete(circles));
  await withUserContext(id, (tx) => tx.delete(personLinks));
  await withUserContext(id, (tx) => tx.delete(people));
};

const duasPessoas = async (userId: string) => [
  await createPerson(userId, { name: "Ana" }),
  await createPerson(userId, { name: "Bruno" }),
];

describe.skipIf(!hasDb)("vínculos e círculos", () => {
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

  it("o vínculo é recíproco na leitura, com uma linha só no banco", async () => {
    const [ana, bruno] = await duasPessoas(uid);

    // Bruno é filho de Ana.
    await linkPeople(uid, ana!.id, bruno!.id, "filho");

    const linhas = await withUserContext(uid, (tx) => tx.select().from(personLinks));
    expect(linhas).toHaveLength(1);

    const daAna = await listLinksOf(uid, ana!.id);
    expect(daAna).toEqual([
      expect.objectContaining({ personId: bruno!.id, name: "Bruno", relation: "filho" }),
    ]);

    const doBruno = await listLinksOf(uid, bruno!.id);
    expect(doBruno).toEqual([
      expect.objectContaining({ personId: ana!.id, name: "Ana", relation: "pai_mae" }),
    ]);

    await limpar(uid);
  });

  it("ligar pelo outro lado atualiza a mesma linha, não cria o espelho", async () => {
    const [ana, bruno] = await duasPessoas(uid);

    await linkPeople(uid, ana!.id, bruno!.id, "filho");
    await linkPeople(uid, bruno!.id, ana!.id, "pai_mae"); // a mesma verdade, dita ao contrário

    const linhas = await withUserContext(uid, (tx) => tx.select().from(personLinks));
    expect(linhas).toHaveLength(1);

    await limpar(uid);
  });

  it("corrigir a relação sobrescreve em vez de acumular", async () => {
    const [ana, bruno] = await duasPessoas(uid);

    await linkPeople(uid, ana!.id, bruno!.id, "amigo");
    await linkPeople(uid, ana!.id, bruno!.id, "irmao");

    const daAna = await listLinksOf(uid, ana!.id);
    expect(daAna).toHaveLength(1);
    expect(daAna[0]!.relation).toBe("irmao");

    await limpar(uid);
  });

  it("cônjuge aparece igual dos dois lados", async () => {
    const [ana, bruno] = await duasPessoas(uid);

    await linkPeople(uid, ana!.id, bruno!.id, "conjuge");

    expect((await listLinksOf(uid, ana!.id))[0]!.relation).toBe("conjuge");
    expect((await listLinksOf(uid, bruno!.id))[0]!.relation).toBe("conjuge");

    await limpar(uid);
  });

  it("uma pessoa não se vincula a si mesma", async () => {
    const ana = await createPerson(uid, { name: "Ana" });

    await expect(linkPeople(uid, ana.id, ana.id, "irmao")).rejects.toThrow(/si mesma/i);

    await limpar(uid);
  });

  it("apagar a pessoa não deixa vínculo órfão", async () => {
    const [ana, bruno] = await duasPessoas(uid);
    await linkPeople(uid, ana!.id, bruno!.id, "amigo");

    await withUserContext(uid, (tx) => tx.delete(people));

    const linhas = await withUserContext(uid, (tx) => tx.select().from(personLinks));
    expect(linhas).toEqual([]);
  });

  it("desfazer o vínculo some com ele dos dois lados", async () => {
    const [ana, bruno] = await duasPessoas(uid);
    await linkPeople(uid, ana!.id, bruno!.id, "amigo");

    const [vinculo] = await listLinksOf(uid, ana!.id);
    await unlinkPeople(uid, vinculo!.id);

    expect(await listLinksOf(uid, ana!.id)).toEqual([]);
    expect(await listLinksOf(uid, bruno!.id)).toEqual([]);

    await limpar(uid);
  });

  it("círculo guarda membros com papel, sem duplicar quem entra duas vezes", async () => {
    const [ana, bruno] = await duasPessoas(uid);
    const familia = await createCircle(uid, { name: "Família", kind: "familia" });

    await addCircleMember(uid, familia.id, ana!.id, "matriarca");
    await addCircleMember(uid, familia.id, bruno!.id);
    await addCircleMember(uid, familia.id, ana!.id, "líder"); // de novo, com outro papel

    const [circulo] = await listCircles(uid);
    expect(circulo!.members).toHaveLength(2);
    expect(circulo!.members.find((m) => m.personId === ana!.id)!.role).toBe("líder");
    expect(circulo!.members.map((m) => m.name)).toEqual(["Ana", "Bruno"]);

    await limpar(uid);
  });

  it("apagar a pessoa não deixa membro fantasma no círculo", async () => {
    const [ana] = await duasPessoas(uid);
    const familia = await createCircle(uid, { name: "Família", kind: "familia" });
    await addCircleMember(uid, familia.id, ana!.id);

    await withUserContext(uid, (tx) => tx.delete(people));

    const [circulo] = await listCircles(uid);
    expect(circulo!.members).toEqual([]);

    await limpar(uid);
  });

  it("apagar o círculo não apaga as pessoas dele", async () => {
    const [ana] = await duasPessoas(uid);
    const familia = await createCircle(uid, { name: "Família" });
    await addCircleMember(uid, familia.id, ana!.id);

    await deleteCircle(uid, familia.id);

    const restantes = await withUserContext(uid, (tx) => tx.select().from(people));
    expect(restantes).toHaveLength(2);

    await limpar(uid);
  });

  it("tirar do círculo mantém a pessoa cadastrada", async () => {
    const [ana] = await duasPessoas(uid);
    const familia = await createCircle(uid, { name: "Família" });
    await addCircleMember(uid, familia.id, ana!.id);

    const [circulo] = await listCircles(uid);
    await removeCircleMember(uid, circulo!.members[0]!.id);

    expect((await listCircles(uid))[0]!.members).toEqual([]);
    expect(await withUserContext(uid, (tx) => tx.select().from(people))).toHaveLength(2);

    await limpar(uid);
  });

  it("isola por usuário (RLS) — não dá para vincular nem ver o que é de outro", async () => {
    const [ana, bruno] = await duasPessoas(uid);
    await linkPeople(uid, ana!.id, bruno!.id, "amigo");
    await createCircle(uid, { name: "Família" });

    await expect(linkPeople(other, ana!.id, bruno!.id, "irmao")).rejects.toThrow(/não encontrada/i);
    expect(await listLinksOf(other, ana!.id)).toEqual([]);
    expect(await listCircles(other)).toEqual([]);

    await limpar(uid);
  });
});
