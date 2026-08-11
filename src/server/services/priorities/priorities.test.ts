import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { migrateForTests } from "@/server/db/migrate-for-tests";
import { withUserContext } from "@/server/db/rls";
import { priorities, priorityTags, tags, users } from "@/server/db/schema";
import { createTag, listTags, setPriorityTags } from "@/server/services/tags/tags-service";

import {
  createPriority,
  deletePriority,
  listPriorities,
  movePriority,
  updatePriority,
} from "./priorities-service";

/**
 * Prioridades + Tags (#13–#14). Integração com Postgres real sob RLS (role `app_rls`).
 * Roda só com `DATABASE_URL` (local), pulado no CI sem banco.
 */
const hasDb = Boolean(process.env.DATABASE_URL);

const stamp = Date.now();
const uid = `prio_user_${stamp}`;
const other = `prio_other_${stamp}`;

/** Devolve os títulos de uma coluna, na ordem persistida. */
async function column(userId: string, status: "todo" | "in_progress" | "done") {
  const list = await listPriorities(userId, { status });
  return list.map((p) => p.title);
}

describe.skipIf(!hasDb)("priorities — CRUD, Kanban, tags e isolamento", () => {
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
      await withUserContext(id, (tx) => tx.delete(priorityTags));
      await withUserContext(id, (tx) => tx.delete(priorities));
      await withUserContext(id, (tx) => tx.delete(tags));
      await withUserContext(id, (tx) => tx.delete(users));
    }
  });

  it("cria em 'todo' no fim da fila, com título normalizado", async () => {
    const first = await createPriority(uid, { title: "  Pagar contas  " });
    const second = await createPriority(uid, { title: "Comprar pão" });

    expect(first.title).toBe("Pagar contas");
    expect(first.status).toBe("todo");
    expect(first.completedAt).toBeNull();
    expect(second.position).toBeGreaterThan(first.position);

    await expect(createPriority(uid, { title: "   " })).rejects.toThrow(/obrigatório/i);
  });

  it("reordena dentro da coluna e persiste a ordem", async () => {
    expect(await column(uid, "todo")).toEqual(["Pagar contas", "Comprar pão"]);

    const list = await listPriorities(uid, { status: "todo" });
    await movePriority(uid, list[1]!.id, { toStatus: "todo", toIndex: 0 });

    expect(await column(uid, "todo")).toEqual(["Comprar pão", "Pagar contas"]);
  });

  it("move entre colunas, marca e limpa completed_at", async () => {
    const [card] = await listPriorities(uid, { status: "todo" });

    const done = await movePriority(uid, card!.id, { toStatus: "done", toIndex: 0 });
    expect(done.status).toBe("done");
    expect(done.completedAt).not.toBeNull();
    expect(await column(uid, "done")).toEqual(["Comprar pão"]);

    const back = await movePriority(uid, card!.id, { toStatus: "in_progress", toIndex: 0 });
    expect(back.completedAt).toBeNull();
    expect(await column(uid, "in_progress")).toEqual(["Comprar pão"]);
    expect(await column(uid, "done")).toEqual([]);
  });

  it("edita e remove", async () => {
    const card = await createPriority(uid, { title: "Rascunho" });
    const edited = await updatePriority(uid, card.id, { title: "Revisar contrato" });
    expect(edited?.title).toBe("Revisar contrato");

    await deletePriority(uid, card.id);
    const titles = (await listPriorities(uid)).map((p) => p.title);
    expect(titles).not.toContain("Revisar contrato");
  });

  it("tags: cria idempotente (case-insensitive) e associa à prioridade", async () => {
    const casa = await createTag(uid, { name: "Casa", color: "#f00" });
    const mesma = await createTag(uid, { name: "  casa " });
    expect(mesma.id).toBe(casa.id);
    expect(await listTags(uid)).toHaveLength(1);

    const [card] = await listPriorities(uid, { status: "in_progress" });
    const applied = await setPriorityTags(uid, card!.id, [casa.id]);
    expect(applied.map((t) => t.name)).toEqual(["Casa"]);

    const withTags = await listPriorities(uid, { status: "in_progress" });
    expect(withTags[0]?.tags.map((t) => t.name)).toEqual(["Casa"]);

    // filtro por tag
    expect(await listPriorities(uid, { tagId: casa.id })).toHaveLength(1);

    // substituir por conjunto vazio limpa as associações
    await setPriorityTags(uid, card!.id, []);
    expect(await listPriorities(uid, { tagId: casa.id })).toHaveLength(0);
  });

  it("isola por usuário (RLS) — outro não vê prioridades nem tags", async () => {
    expect(await listPriorities(other)).toHaveLength(0);
    expect(await listTags(other)).toHaveLength(0);
    await expect(
      movePriority(other, (await listPriorities(uid))[0]!.id, {
        toStatus: "done",
        toIndex: 0,
      }),
    ).rejects.toThrow(/não encontrada/i);
  });
});
