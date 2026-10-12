import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { migrateForTests } from "@/server/db/migrate-for-tests";
import { createAccount, createTransaction } from "@/server/services/finance/finance-service";
import { createGoal } from "@/server/services/goals/goals-service";
import { createLifeArea } from "@/server/services/life-areas/life-areas-service";
import { createPerson } from "@/server/services/people/people-service";
import { setTimeZone } from "@/server/services/users/time-zone-service";

import { exportUserData } from "./account";
import { deleteUserData, provisionUser, userExists } from "./provisioning";
import {
  TransferError,
  describeTarget,
  parseTransferArgs,
  transferOwnership,
} from "./transfer-owner";

describe("parseTransferArgs (linha de comando)", () => {
  it("por padrão só simula: nada é gravado sem --aplicar", () => {
    expect(parseTransferArgs(["--de", "user_antigo1", "--para", "user_novo2"])).toEqual({
      from: "user_antigo1",
      to: "user_novo2",
      apply: false,
      discardNewData: false,
    });
  });

  it("--aplicar e --descartar-dados-da-conta-nova são explícitos", () => {
    expect(
      parseTransferArgs([
        "--aplicar",
        "--de=user_a1",
        "--para=user_b2",
        "--descartar-dados-da-conta-nova",
      ]),
    ).toEqual({ from: "user_a1", to: "user_b2", apply: true, discardNewData: true });
  });

  it("exige os dois IDs", () => {
    expect(() => parseTransferArgs(["--de", "user_a1"])).toThrow(TransferError);
    expect(() => parseTransferArgs(["--para", "user_b2"])).toThrow("--de");
  });

  it("recusa ID que não é do Clerk (user_…) — erro de cópia não pode virar UPDATE", () => {
    expect(() => parseTransferArgs(["--de", "user_a1", "--para", "joabe@x.com"])).toThrow("user_");
    expect(() => parseTransferArgs(["--de", "", "--para", "user_b2"])).toThrow(TransferError);
  });

  it("recusa o mesmo ID dos dois lados", () => {
    expect(() => parseTransferArgs(["--de", "user_a1", "--para", "user_a1"])).toThrow("iguais");
  });

  it("recusa opção desconhecida (um --aplica com erro de digitação não pode virar simulação)", () => {
    expect(() => parseTransferArgs(["--de", "user_a1", "--para", "user_b2", "--aplica"])).toThrow(
      "--aplica",
    );
  });
});

describe("describeTarget", () => {
  it("diz em qual banco vai rodar sem mostrar a senha", () => {
    const text = describeTarget(
      "postgres://neondb_owner:segredo123@ep-x.us-east-1.aws.neon.tech/neondb?sslmode=require",
    );
    expect(text).toContain("ep-x.us-east-1.aws.neon.tech/neondb");
    expect(text).toContain("neondb_owner");
    expect(text).not.toContain("segredo123");
  });
});

/**
 * Troca de dono contra Postgres de verdade. Precisa das **duas** conexões: a do dono
 * (`MIGRATION_DATABASE_URL`, com BYPASSRLS — é a que o script usa) e a do app (`DATABASE_URL`,
 * `app_rls`), por onde os dados de teste entram e são conferidos, sob RLS, como o app veria.
 */
const hasDb = Boolean(process.env.DATABASE_URL && process.env.MIGRATION_DATABASE_URL);

const stamp = Date.now();
const id = (name: string) => `user_tt${name}${stamp}`;

async function fill(userId: string, marker: string): Promise<void> {
  await createGoal(userId, { title: `Meta ${marker}` });
  await createPerson(userId, { name: `Pessoa ${marker}`, birthday: null });
  const conta = await createAccount(userId, { name: `Conta ${marker}` });
  await createTransaction(userId, {
    accountId: conta.id,
    direction: "saida",
    amountCents: 4321,
    happenedAt: "2026-10-01",
    description: `Gasto ${marker}`,
  });
}

/** Linhas por tabela, como o "Baixar meus dados" vê — a régua de "nada se perdeu". */
async function counts(userId: string): Promise<Record<string, number>> {
  const exported = await exportUserData(userId);
  return Object.fromEntries(
    Object.entries(exported.tables).map(([table, rows]) => [table, rows.length]),
  );
}

describe.skipIf(!hasDb)("transferOwnership — troca de dono dos dados", () => {
  let owner: ReturnType<typeof postgres>;
  const created: string[] = [];

  async function newOldUser(name: string): Promise<string> {
    const userId = id(name);
    created.push(userId);
    await provisionUser({ id: userId, email: `${userId}@test.local`, name: "Joabe" });
    await fill(userId, name);
    return userId;
  }

  beforeAll(async () => {
    await migrateForTests();
    owner = postgres(process.env.MIGRATION_DATABASE_URL!, { prepare: false, max: 1 });
  });

  afterAll(async () => {
    for (const userId of created) await deleteUserData(userId);
    await owner?.end();
  });

  it("simulação (o padrão) mostra o que mudaria e não muda nada", async () => {
    const from = await newOldUser("sim");
    const to = id("simnovo");
    created.push(to);
    const before = await counts(from);

    const report = await transferOwnership(owner, { from, to, apply: false });

    expect(report.applied).toBe(false);
    expect(report.moved.goals).toBe(1);
    expect(report.moved.transactions).toBe(1);
    expect(report.moved.life_areas).toBe(12);
    expect(await counts(from)).toEqual(before);
    expect(await userExists(to)).toBe(false);
  });

  it("aplicar leva tudo para o ID novo — inclusive o e-mail, que é único", async () => {
    const from = await newOldUser("apl");
    await setTimeZone(from, "America/Manaus");
    const neighbor = await newOldUser("viz");
    const neighborBefore = await counts(neighbor);
    const before = await counts(from);
    const to = id("aplnovo");
    created.push(to);

    const report = await transferOwnership(owner, { from, to, apply: true });

    expect(report.applied).toBe(true);
    expect(report.newUserRow).toBe("criada");
    expect(await userExists(from)).toBe(false);
    expect(await counts(to)).toEqual(before);

    const exported = await exportUserData(to);
    expect(exported.user).toMatchObject({
      email: `${from}@test.local`,
      timeZone: "America/Manaus",
    });
    expect(exported.tables.goals?.[0]).toMatchObject({ title: "Meta apl", user_id: to });

    // O vizinho não é tocado.
    expect(await counts(neighbor)).toEqual(neighborBefore);
  });

  it("conta nova recém-criada (só as áreas padrão) é substituída sem precisar de opção", async () => {
    const from = await newOldUser("pad");
    await createLifeArea(from, { dimension: "espirito", name: "Ministério de mídia" });
    const before = await counts(from);
    const to = id("padnovo");
    created.push(to);
    await provisionUser({ id: to, email: `${to}@test.local`, name: "Joabe Prod" });

    const report = await transferOwnership(owner, { from, to, apply: true });

    expect(report.newUserRow).toBe("substituida");
    expect(report.discardedFromNew.life_areas).toBe(12);
    expect(await counts(to)).toEqual(before);
    const exported = await exportUserData(to);
    // E-mail e nome da conta nova (é o que o Clerk de produção diz); o resto vem da antiga.
    expect(exported.user).toMatchObject({ email: `${to}@test.local`, name: "Joabe Prod" });
    expect(exported.tables.life_areas?.map((area) => area.name)).toContain("Ministério de mídia");
  });

  it("conta nova com dado de verdade: recusa sem a opção e não muda nada", async () => {
    const from = await newOldUser("rec");
    const before = await counts(from);
    const to = id("recnovo");
    created.push(to);
    await provisionUser({ id: to, email: `${to}@test.local`, name: null });
    await createGoal(to, { title: "Meta criada na conta nova" });
    const toBefore = await counts(to);

    await expect(transferOwnership(owner, { from, to, apply: true })).rejects.toThrow(
      /conta nova já tem dados \(.*goals: 1/,
    );
    expect(await counts(from)).toEqual(before);
    expect(await counts(to)).toEqual(toBefore);

    const report = await transferOwnership(owner, {
      from,
      to,
      apply: true,
      discardNewData: true,
    });
    expect(report.discardedFromNew.goals).toBe(1);
    expect(await counts(to)).toEqual(before);
  });

  it("recusa a conexão do app (sem BYPASSRLS): sob RLS o UPDATE não veria nada", async () => {
    const from = await newOldUser("rls");
    const before = await counts(from);
    const app = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
    try {
      await expect(
        transferOwnership(app, { from, to: id("rlsnovo"), apply: true }),
      ).rejects.toThrow(/MIGRATION_DATABASE_URL/);
    } finally {
      await app.end();
    }
    expect(await counts(from)).toEqual(before);
  });

  it("recusa ID antigo que não existe no banco", async () => {
    await expect(
      transferOwnership(owner, { from: id("fantasma"), to: id("fantasmanovo"), apply: false }),
    ).rejects.toThrow(/não existe/);
  });
});
