import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { migrateForTests } from "@/server/db/migrate-for-tests";
import { withUserContext } from "@/server/db/rls";
import { people, users } from "@/server/db/schema";

import { createPerson, listBirthdaysInRange, updatePerson } from "./people-service";

/**
 * Aniversários na Agenda (#44). Integração com Postgres real sob RLS (role `app_rls`).
 * Roda só com `DATABASE_URL` (local), pulado no CI sem banco.
 */
const hasDb = Boolean(process.env.DATABASE_URL);

const stamp = Date.now();
const uid = `bd_user_${stamp}`;
const other = `bd_other_${stamp}`;

const local = (year: number, month: number, day: number) => new Date(year, month - 1, day);
const iso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const agosto = { from: local(2026, 8, 1), to: local(2026, 9, 1) };
const limpar = (id: string) => withUserContext(id, (tx) => tx.delete(people));

describe.skipIf(!hasDb)("aniversários na agenda", () => {
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

  it("aparece no dia certo, com a idade que completa", async () => {
    await createPerson(uid, { name: "Ana", birthday: { day: 15, month: 8, year: 1990 } });

    const [aniversario] = await listBirthdaysInRange(uid, agosto);
    expect(iso(aniversario!.date)).toBe("2026-08-15");
    expect(aniversario!.turningAge).toBe(36);
    expect(aniversario!.name).toBe("Ana");

    await limpar(uid);
  });

  it("quem não tem data de nascimento não aparece", async () => {
    await createPerson(uid, { name: "Sem data" });

    expect(await listBirthdaysInRange(uid, agosto)).toEqual([]);

    await limpar(uid);
  });

  it("corrigir a data de nascimento move o aniversário, sem passo manual", async () => {
    // É a razão de ser derivado: um evento materializado ficaria para trás mentindo.
    const ana = await createPerson(uid, {
      name: "Ana",
      birthday: { day: 15, month: 8, year: 1990 },
    });

    await updatePerson(uid, ana.id, { birthday: { day: 20, month: 8, year: 1990 } });

    const [aniversario] = await listBirthdaysInRange(uid, agosto);
    expect(iso(aniversario!.date)).toBe("2026-08-20");

    await limpar(uid);
  });

  it("volta todo ano sem nada ser criado", async () => {
    await createPerson(uid, { name: "Ana", birthday: { day: 15, month: 8, year: 1990 } });

    const em2030 = await listBirthdaysInRange(uid, {
      from: local(2030, 8, 1),
      to: local(2030, 9, 1),
    });
    expect(iso(em2030[0]!.date)).toBe("2030-08-15");
    expect(em2030[0]!.turningAge).toBe(40);

    await limpar(uid);
  });

  it("aniversariante sem ano aparece sem idade, não com idade errada", async () => {
    await createPerson(uid, { name: "Sem ano", birthday: { day: 15, month: 8, year: null } });

    const [aniversario] = await listBirthdaysInRange(uid, agosto);
    expect(aniversario!.turningAge).toBeNull();

    await limpar(uid);
  });

  it("isola por usuário (RLS) — o aniversário de um não entra na agenda do outro", async () => {
    await createPerson(uid, { name: "Ana", birthday: { day: 15, month: 8, year: 1990 } });

    expect(await listBirthdaysInRange(other, agosto)).toEqual([]);

    await limpar(uid);
  });
});
