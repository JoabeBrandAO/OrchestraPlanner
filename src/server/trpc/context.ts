import { getAuthUserId } from "@/server/auth";

/** Contexto injetado em toda chamada tRPC. */
export interface TRPCContext {
  userId: string | null;
}

/** Cria o contexto a partir da requisição (lê o usuário autenticado do Clerk). */
export async function createTRPCContext(): Promise<TRPCContext> {
  return { userId: await getAuthUserId() };
}
