import { auth } from "@clerk/nextjs/server";

/**
 * Fonte única do `user_id` autenticado no backend (Clerk).
 * Retorna `null` quando não há sessão — o tRPC decide o que fazer (ver
 * `protectedProcedure`). Isola o Clerk atrás de uma função fácil de mockar.
 */
export async function getAuthUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId ?? null;
}
