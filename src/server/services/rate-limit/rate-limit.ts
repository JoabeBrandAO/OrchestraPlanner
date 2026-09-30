import { sql } from "drizzle-orm";

import { withUserContext } from "@/server/db/rls";
import { rateLimits } from "@/server/db/schema";

/**
 * Teto de chamadas por usuário e por rota (#75). Janela fixa, contada no Postgres.
 *
 * A contagem é **um upsert só**: incrementa se a janela é a mesma, recomeça em 1 se virou. Um
 * `select` antes do `update` teria a mesma cara e uma corrida no meio — duas chamadas
 * simultâneas leriam o mesmo número e as duas passariam.
 */

export type RateRule = { limit: number; windowMs: number };

const HOUR_MS = 60 * 60 * 1000;

/** Os tetos, num lugar só. Generosos para uso humano; apertados para um laço. */
export const RATE_RULES = {
  /** Até 4 MB de texto e parsing pesado por chamada. */
  "finance.importStatement": { limit: 10, windowMs: HOUR_MS },
  "push.subscribe": { limit: 10, windowMs: HOUR_MS },
  /** Lê todas as tabelas do usuário. */
  "account.export": { limit: 10, windowMs: HOUR_MS },
  "account.delete": { limit: 5, windowMs: HOUR_MS },
} satisfies Record<string, RateRule>;

export type RateKey = keyof typeof RATE_RULES;

/** Início da janela fixa que contém `now`. Puro. */
export function windowStart(now: Date, windowMs: number): Date {
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

export type RateDecision = { allowed: boolean; count: number; retryAt: Date };

/** Conta uma chamada e diz se ela cabe no teto. A chamada recusada também conta. */
export async function hitRateLimit(
  userId: string,
  key: RateKey,
  now: Date = new Date(),
): Promise<RateDecision> {
  const rule: RateRule = RATE_RULES[key];
  const start = windowStart(now, rule.windowMs);

  const [row] = await withUserContext(userId, (tx) =>
    tx
      .insert(rateLimits)
      .values({ userId, key, windowStart: start, count: 1 })
      .onConflictDoUpdate({
        target: [rateLimits.userId, rateLimits.key],
        set: {
          count: sql`case when ${rateLimits.windowStart} = excluded.window_start
                     then ${rateLimits.count} + 1 else 1 end`,
          windowStart: sql`excluded.window_start`,
        },
      })
      .returning({ count: rateLimits.count }),
  );

  const count = row!.count;
  return {
    allowed: count <= rule.limit,
    count,
    retryAt: new Date(start.getTime() + rule.windowMs),
  };
}

/** A frase da recusa, com a hora em que volta a caber — em português, não "429". */
export function tooManyMessage(retryAt: Date): string {
  const minutes = Math.max(1, Math.ceil((retryAt.getTime() - Date.now()) / 60_000));
  return `Muitas tentativas seguidas. Tente de novo em ${minutes} min.`;
}
