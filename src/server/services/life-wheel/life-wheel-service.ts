import { asc, desc, eq } from "drizzle-orm";

import { withUserContext, type Tx } from "@/server/db/rls";
import { lifeAreas, lifeAssessments } from "@/server/db/schema";

import { suggestFocusAreas, validateScore, wheelAverage, type WheelScore } from "./wheel";

/**
 * Roda da Vida (#17). Grava e lê **rodadas**: cada avaliação salva uma linha por área,
 * todas com o mesmo `assessed_at`, o que torna a rodada um grupo exato (ver schema).
 * Roda sob `withUserContext` — a RLS isola. A matemática mora em `wheel.ts`.
 */

/** Uma área com a nota daquela rodada — o que o radar desenha. */
export type WheelEntry = {
  lifeAreaId: string;
  name: string;
  dimension: "corpo" | "alma" | "espirito";
  score: number;
};

export type Wheel = {
  assessedAt: Date;
  average: number;
  entries: WheelEntry[];
  /** Áreas de menor nota — onde vale a pena criar meta. */
  suggestions: WheelEntry[];
  notes: string | null;
};

export type SaveAssessmentInput = {
  scores: WheelScore[];
  notes?: string | null;
  /** Injetável para os testes; por padrão é o instante da gravação. */
  assessedAt?: Date;
};

/** Monta a roda de uma rodada específica, na ordem das áreas do usuário. */
async function readRound(tx: Tx, assessedAt: Date): Promise<Wheel | null> {
  const rows = await tx
    .select({
      lifeAreaId: lifeAssessments.lifeAreaId,
      score: lifeAssessments.score,
      notes: lifeAssessments.notes,
      name: lifeAreas.name,
      dimension: lifeAreas.dimension,
      position: lifeAreas.position,
    })
    .from(lifeAssessments)
    .innerJoin(lifeAreas, eq(lifeAreas.id, lifeAssessments.lifeAreaId))
    .where(eq(lifeAssessments.assessedAt, assessedAt))
    .orderBy(asc(lifeAreas.position), asc(lifeAreas.createdAt));

  if (rows.length === 0) return null;

  const entries: WheelEntry[] = rows.map((row) => ({
    lifeAreaId: row.lifeAreaId,
    name: row.name,
    dimension: row.dimension,
    score: row.score,
  }));

  return {
    assessedAt,
    average: wheelAverage(entries),
    entries,
    suggestions: suggestFocusAreas(entries),
    notes: rows[0]!.notes,
  };
}

/**
 * Salva uma rodada inteira. Valida as notas **antes** de escrever, para uma nota inválida
 * no fim da lista não deixar meia roda gravada. Áreas de outro usuário simplesmente não
 * existem sob RLS: o insert falharia na FK, então a checagem explícita dá o erro legível.
 */
export async function saveAssessment(userId: string, input: SaveAssessmentInput): Promise<Wheel> {
  if (input.scores.length === 0) throw new Error("Avalie ao menos uma área.");

  for (const entry of input.scores) {
    const score = validateScore(entry.score);
    if (!score.ok) throw new Error(score.error);
  }

  const assessedAt = input.assessedAt ?? new Date();

  return withUserContext(userId, async (tx) => {
    const owned = await tx.select({ id: lifeAreas.id }).from(lifeAreas);
    const ownedIds = new Set(owned.map((area) => area.id));
    for (const entry of input.scores) {
      if (!ownedIds.has(entry.lifeAreaId)) throw new Error("Área de vida não encontrada.");
    }

    await tx.insert(lifeAssessments).values(
      input.scores.map((entry) => ({
        userId,
        lifeAreaId: entry.lifeAreaId,
        score: entry.score,
        assessedAt,
        notes: input.notes ?? null,
      })),
    );

    return (await readRound(tx, assessedAt))!;
  });
}

/** A roda mais recente, ou `null` se o usuário ainda não se avaliou (estado de onboarding). */
export async function getLatestWheel(userId: string): Promise<Wheel | null> {
  return withUserContext(userId, async (tx) => {
    const [last] = await tx
      .select({ assessedAt: lifeAssessments.assessedAt })
      .from(lifeAssessments)
      .orderBy(desc(lifeAssessments.assessedAt))
      .limit(1);

    return last ? readRound(tx, last.assessedAt) : null;
  });
}

export type WheelHistoryEntry = { assessedAt: Date; average: number; areas: number };

/** Histórico: uma linha por rodada, da mais recente para a mais antiga. */
export async function listWheelHistory(userId: string, limit = 12): Promise<WheelHistoryEntry[]> {
  return withUserContext(userId, async (tx) => {
    const rows = await tx
      .select({ assessedAt: lifeAssessments.assessedAt, score: lifeAssessments.score })
      .from(lifeAssessments)
      .orderBy(desc(lifeAssessments.assessedAt));

    const rounds = new Map<number, { assessedAt: Date; scores: { score: number }[] }>();
    for (const row of rows) {
      const key = row.assessedAt.getTime();
      const round = rounds.get(key) ?? { assessedAt: row.assessedAt, scores: [] };
      round.scores.push({ score: row.score });
      rounds.set(key, round);
    }

    return [...rounds.values()].slice(0, limit).map((round) => ({
      assessedAt: round.assessedAt,
      average: wheelAverage(round.scores),
      areas: round.scores.length,
    }));
  });
}
