import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { migrateForTests } from "@/server/db/migrate-for-tests";
import { withUserContext } from "@/server/db/rls";
import { people, peopleContacts, users } from "@/server/db/schema";

import {
  addContact,
  createPerson,
  deleteContact,
  deletePerson,
  listPeople,
  updatePerson,
} from "./people-service";

/**
 * Pessoas & Relacionamentos (#41). Integração com Postgres real sob RLS (role `app_rls`).
 * Roda só com `DATABASE_URL` (local), pulado no CI sem banco.
 */
const hasDb = Boolean(process.env.DATABASE_URL);

const stamp = Date.now();
const uid = `ppl_user_${stamp}`;
const other = `ppl_other_${stamp}`;

const limpar = async (id: string) => {
  await withUserContext(id, (tx) => tx.delete(peopleContacts));
  await withUserContext(id, (tx) => tx.delete(people));
};

describe.skipIf(!hasDb)("pessoas — cadastro, contatos e isolamento", () => {
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

  it("cadastra e encontra a pessoa, aparando o nome", async () => {
    await createPerson(uid, {
      name: "  Maria Silva  ",
      nickname: "Mari",
      birthday: { day: 15, month: 8, year: 1990 },
      relationType: "amigo",
    });

    const lista = await listPeople(uid);
    expect(lista).toHaveLength(1);
    expect(lista[0]!.name).toBe("Maria Silva");
    expect(lista[0]!.nickname).toBe("Mari");
    expect(lista[0]!.birthDay).toBe(15);
    expect(lista[0]!.birthMonth).toBe(8);
    expect(lista[0]!.birthYear).toBe(1990);

    await limpar(uid);
  });

  it("aceita aniversário sem ano", async () => {
    await createPerson(uid, { name: "Sem ano", birthday: { day: 3, month: 4, year: null } });

    const [pessoa] = await listPeople(uid);
    expect(pessoa!.birthDay).toBe(3);
    expect(pessoa!.birthYear).toBeNull();

    await limpar(uid);
  });

  it("recusa data de nascimento que não existe", async () => {
    await expect(
      createPerson(uid, { name: "Impossível", birthday: { day: 31, month: 2, year: 1990 } }),
    ).rejects.toThrow(/inválida/i);

    expect(await listPeople(uid)).toEqual([]);
  });

  it("recusa nome vazio", async () => {
    await expect(createPerson(uid, { name: "   " })).rejects.toThrow();
  });

  it("guarda a data de casamento de quem é casado", async () => {
    await createPerson(uid, {
      name: "Casada",
      maritalStatus: "casado",
      marriedAt: "2015-06-20",
    });

    const [pessoa] = await listPeople(uid);
    expect(pessoa!.marriedAt).toBe("2015-06-20");

    await limpar(uid);
  });

  it("não guarda data de casamento para quem não é casado", async () => {
    // O campo some da tela; guardar escondido viraria dado fantasma reaparecendo depois.
    await createPerson(uid, {
      name: "Solteiro",
      maritalStatus: "solteiro",
      marriedAt: "2015-06-20",
    });

    const [pessoa] = await listPeople(uid);
    expect(pessoa!.marriedAt).toBeNull();

    await limpar(uid);
  });

  it("mudar o estado civil limpa a data que deixou de fazer sentido", async () => {
    const pessoa = await createPerson(uid, {
      name: "Antes casada",
      maritalStatus: "casado",
      marriedAt: "2015-06-20",
    });

    await updatePerson(uid, pessoa.id, { maritalStatus: "divorciado" });

    const [depois] = await listPeople(uid);
    expect(depois!.maritalStatus).toBe("divorciado");
    expect(depois!.marriedAt).toBeNull();

    await limpar(uid);
  });

  it("edita sem apagar o que não foi enviado", async () => {
    const pessoa = await createPerson(uid, {
      name: "Maria",
      nickname: "Mari",
      relationType: "amigo",
    });

    await updatePerson(uid, pessoa.id, { name: "Maria Silva" });

    const [depois] = await listPeople(uid);
    expect(depois!.name).toBe("Maria Silva");
    expect(depois!.nickname).toBe("Mari");
    expect(depois!.relationType).toBe("amigo");

    await limpar(uid);
  });

  it("guarda vários contatos por pessoa, com rótulo próprio", async () => {
    const pessoa = await createPerson(uid, { name: "Maria" });

    await addContact(uid, pessoa.id, { kind: "telefone", label: "celular", value: "11999999999" });
    await addContact(uid, pessoa.id, { kind: "email", label: "trabalho", value: "m@exemplo.com" });

    const [comContatos] = await listPeople(uid);
    expect(comContatos!.contacts).toHaveLength(2);
    expect(comContatos!.contacts[0]!.label).toBe("celular");

    await limpar(uid);
  });

  it("remover contato não mexe na pessoa", async () => {
    const pessoa = await createPerson(uid, { name: "Maria" });
    const contato = await addContact(uid, pessoa.id, { kind: "telefone", value: "11999999999" });

    await deleteContact(uid, contato.id);

    const [depois] = await listPeople(uid);
    expect(depois!.contacts).toEqual([]);
    expect(depois!.name).toBe("Maria");

    await limpar(uid);
  });

  it("apagar a pessoa leva os contatos junto", async () => {
    const pessoa = await createPerson(uid, { name: "Maria" });
    await addContact(uid, pessoa.id, { kind: "telefone", value: "11999999999" });

    await deletePerson(uid, pessoa.id);

    const orfaos = await withUserContext(uid, (tx) => tx.select().from(peopleContacts));
    expect(orfaos).toEqual([]);
  });

  it("isola por usuário (RLS) — outro não vê, não edita e não anexa contato", async () => {
    const pessoa = await createPerson(uid, { name: "Maria" });

    expect(await listPeople(other)).toEqual([]);
    expect(await updatePerson(other, pessoa.id, { name: "Invadida" })).toBeNull();
    await expect(
      addContact(other, pessoa.id, { kind: "telefone", value: "11999999999" }),
    ).rejects.toThrow(/não encontrada/i);

    const [intacta] = await listPeople(uid);
    expect(intacta!.name).toBe("Maria");

    await limpar(uid);
  });
});
