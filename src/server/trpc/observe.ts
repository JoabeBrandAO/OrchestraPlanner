import { TRPCError } from "@trpc/server";

import { DomainError } from "@/server/services/shared/domain-error";

/**
 * Rastro das chamadas em produção (#76). Uma linha JSON por evento no stdout, que a Vercel
 * guarda e deixa consultar em *Logs* — sem fornecedor novo.
 *
 * **O que nunca entra:** entrada da chamada, descrição de lançamento, nome ou dado de pessoa.
 * Por isso nem a mensagem de erro inesperado é registrada — a do driver pode citar valor de
 * coluna. Fica o que localiza o problema sem expor ninguém: rota, usuário, duração, código,
 * nome do erro, constraint/tabela e a pilha sem a primeira linha (que é a mensagem).
 */

export type CallInfo = { path: string; type: string; userId: string | null; ms: number };

type Level = "info" | "warn" | "error";

export function logEvent(level: Level, fields: Record<string, unknown>): void {
  const line = JSON.stringify(fields);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

/** O que dá para registrar de um erro inesperado sem vazar dado. */
export function describeUnexpected(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) return { name: typeof error };
  const pg = error as Error & {
    code?: unknown;
    constraint_name?: unknown;
    table_name?: unknown;
    routine?: unknown;
  };
  return {
    name: error.name,
    ...(typeof pg.code === "string" ? { code: pg.code } : {}),
    ...(typeof pg.constraint_name === "string" ? { constraint: pg.constraint_name } : {}),
    ...(typeof pg.table_name === "string" ? { table: pg.table_name } : {}),
    ...(typeof pg.routine === "string" ? { routine: pg.routine } : {}),
    stack: error.stack
      ?.split("\n")
      .slice(1, 8)
      .map((frame) => frame.trim()),
  };
}

/**
 * Decide o que fazer com o resultado de uma chamada: erro de domínio vira 400/404 (com a frase
 * do domínio), o resto segue como veio. Devolve o erro a relançar, ou `null`.
 */
export function translate(error: TRPCError, call: CallInfo): TRPCError | null {
  const cause = error.cause;

  if (cause instanceof DomainError) {
    logEvent("info", { event: "trpc", ...call, ok: false, code: cause.code });
    return new TRPCError({ code: cause.code, message: cause.message, cause });
  }

  if (error.code !== "INTERNAL_SERVER_ERROR") {
    // Previsto: sem login, entrada recusada pelo zod, teto de chamadas.
    logEvent("info", { event: "trpc", ...call, ok: false, code: error.code });
    return null;
  }

  logEvent("error", {
    event: "trpc_error",
    ...call,
    ok: false,
    code: error.code,
    error: describeUnexpected(cause ?? error),
  });
  return null;
}
