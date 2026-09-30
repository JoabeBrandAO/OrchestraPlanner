import { and, eq, isNull } from "drizzle-orm";

import { withUserContext } from "@/server/db/rls";
import { users } from "@/server/db/schema";
import { isValidTimeZone } from "@/server/services/shared/time-zone";
import { DomainError } from "@/server/services/shared/domain-error";

/**
 * Fuso do usuário (#72). Guardado em `users.time_zone`; nulo significa "nunca definido".
 * Validação e conta de datas ficam em `shared/time-zone.ts`, puro.
 */

/** O fuso guardado, ou `null` se o usuário nunca definiu. */
export async function getTimeZone(userId: string): Promise<string | null> {
  const [row] = await withUserContext(userId, (tx) =>
    tx.select({ timeZone: users.timeZone }).from(users).where(eq(users.id, userId)),
  );
  return row?.timeZone ?? null;
}

function assertTimeZone(timeZone: string): void {
  if (!isValidTimeZone(timeZone)) throw new DomainError("Fuso horário desconhecido.");
}

/** Troca o fuso — é a escolha explícita na tela, então vale sempre. */
export async function setTimeZone(userId: string, timeZone: string): Promise<string> {
  assertTimeZone(timeZone);
  await withUserContext(userId, (tx) =>
    tx.update(users).set({ timeZone }).where(eq(users.id, userId)),
  );
  return timeZone;
}

/**
 * Semeia o fuso vindo do navegador **só se ainda não houver um**. A condição fica no próprio
 * `update` (`where time_zone is null`), não num `select` antes: assim a escolha feita na tela
 * nunca é sobrescrita pelo palpite do navegador, nem numa corrida entre abas.
 * Devolve o fuso que ficou valendo.
 */
export async function seedTimeZone(userId: string, timeZone: string): Promise<string | null> {
  assertTimeZone(timeZone);
  await withUserContext(userId, (tx) =>
    tx
      .update(users)
      .set({ timeZone })
      .where(and(eq(users.id, userId), isNull(users.timeZone))),
  );
  return getTimeZone(userId);
}
