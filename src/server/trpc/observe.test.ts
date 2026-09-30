import { TRPCError } from "@trpc/server";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { z } from "zod";

import { DomainError, NotFoundError } from "@/server/services/shared/domain-error";

import { createCallerFactory, protectedProcedure, router } from "./trpc";

/** Borda de erros e rastro (#76), sem banco. */

const SEGREDO = "Pão na padaria da Dona Maria, R$ 19,90";

const testRouter = router({
  lancar: protectedProcedure
    .input(z.object({ description: z.string() }))
    .mutation(() => ({ ok: true })),
  valorZero: protectedProcedure.mutation(() => {
    throw new DomainError("O valor precisa ser maior que zero.");
  }),
  semConta: protectedProcedure.mutation(() => {
    throw new NotFoundError("Conta não encontrada.");
  }),
  bancoCaiu: protectedProcedure.mutation(() => {
    const erro = Object.assign(new Error(`duplicate key: (description)=(${SEGREDO})`), {
      name: "PostgresError",
      code: "23505",
      constraint_name: "transactions_external_key",
    });
    throw erro;
  }),
  ler: protectedProcedure.query(() => "ok"),
});

const caller = createCallerFactory(testRouter)({ userId: "user_x" });

async function codeOf(promise: Promise<unknown>): Promise<string> {
  const error = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(TRPCError);
  return (error as TRPCError).code;
}

describe("borda do tRPC — erros e rastro", () => {
  let logs: MockInstance[];
  const allLines = () => logs.flatMap((spy) => spy.mock.calls.map((call) => String(call[0])));

  beforeEach(() => {
    logs = [
      vi.spyOn(console, "info").mockImplementation(() => {}),
      vi.spyOn(console, "warn").mockImplementation(() => {}),
      vi.spyOn(console, "error").mockImplementation(() => {}),
    ];
  });
  afterEach(() => vi.restoreAllMocks());

  it("erro de domínio vira 400 com a frase do domínio — não 500", async () => {
    const error = await caller.valorZero().catch((caught: unknown) => caught as TRPCError);
    expect(error.code).toBe("BAD_REQUEST");
    expect(error.message).toBe("O valor precisa ser maior que zero.");
  });

  it("'não encontrado' vira 404", async () => {
    expect(await codeOf(caller.semConta())).toBe("NOT_FOUND");
  });

  it("erro inesperado continua 500 e deixa rastro consultável, sem a mensagem", async () => {
    expect(await codeOf(caller.bancoCaiu())).toBe("INTERNAL_SERVER_ERROR");

    const [line] = logs[2]!.mock.calls.map((call) => JSON.parse(String(call[0])));
    expect(line).toMatchObject({
      event: "trpc_error",
      path: "bancoCaiu",
      userId: "user_x",
      error: { name: "PostgresError", code: "23505", constraint: "transactions_external_key" },
    });
    expect(line.error.stack.length).toBeGreaterThan(0);
  });

  it("toda mutação deixa uma linha com quem, rota e duração", async () => {
    await caller.lancar({ description: SEGREDO });
    const line = JSON.parse(String(logs[0]!.mock.calls[0]![0]));
    expect(line).toMatchObject({ event: "trpc", path: "lancar", type: "mutation", ok: true });
    expect(typeof line.ms).toBe("number");
  });

  it("consulta bem-sucedida não gera log (é a maior parte do tráfego)", async () => {
    await caller.ler();
    expect(allLines()).toHaveLength(0);
  });

  it("nenhum dado pessoal ou financeiro aparece em nenhuma linha", async () => {
    await caller.lancar({ description: SEGREDO });
    await caller.bancoCaiu().catch(() => {});
    const texto = allLines().join("\n");
    expect(texto).not.toContain("Dona Maria");
    expect(texto).not.toContain("19,90");
  });
});
