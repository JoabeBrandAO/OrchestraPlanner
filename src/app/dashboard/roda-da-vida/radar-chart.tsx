"use client";

import { radarPoints, toPolygonPoints, SCORE_MAX } from "@/server/services/life-wheel/wheel";

/**
 * Radar da Roda da Vida (#17). SVG à mão em vez de uma biblioteca de gráficos: são dois
 * polígonos e uns eixos, e a geometria já vive testada em `wheel.ts` — não vale arrastar
 * uma dependência (e o peso dela no bundle) para isso.
 */

const SIZE = 240;
const CENTER = SIZE / 2;
const RADIUS = CENTER - 28; // margem para os rótulos das áreas

export type RadarEntry = { lifeAreaId: string; name: string; score: number };

export function RadarChart({ entries }: { entries: RadarEntry[] }) {
  if (entries.length < 3) {
    return (
      <p className="text-muted-foreground text-sm">
        O radar aparece com pelo menos 3 áreas avaliadas.
      </p>
    );
  }

  const scores = entries.map((entry) => entry.score);
  const shape = toPolygonPoints(radarPoints(scores, { radius: RADIUS, center: CENTER }));
  const outline = toPolygonPoints(
    radarPoints(new Array<number>(entries.length).fill(SCORE_MAX), {
      radius: RADIUS,
      center: CENTER,
    }),
  );
  const axes = radarPoints(new Array<number>(entries.length).fill(SCORE_MAX), {
    radius: RADIUS,
    center: CENTER,
  });
  const labels = radarPoints(new Array<number>(entries.length).fill(SCORE_MAX), {
    radius: RADIUS + 16,
    center: CENTER,
  });

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="mx-auto h-auto w-full max-w-[320px]"
      role="img"
      aria-label={`Radar da Roda da Vida: ${entries
        .map((entry) => `${entry.name} ${entry.score}`)
        .join(", ")}`}
    >
      {/* Anéis de referência (2 em 2 pontos) e eixos. */}
      {[0.25, 0.5, 0.75, 1].map((ring) => (
        <polygon
          key={ring}
          points={toPolygonPoints(
            radarPoints(new Array<number>(entries.length).fill(SCORE_MAX), {
              radius: RADIUS * ring,
              center: CENTER,
            }),
          )}
          className="fill-none stroke-current opacity-15"
        />
      ))}
      {axes.map((point, index) => (
        <line
          key={entries[index]!.lifeAreaId}
          x1={CENTER}
          y1={CENTER}
          x2={point.x}
          y2={point.y}
          className="stroke-current opacity-15"
        />
      ))}
      <polygon points={outline} className="fill-none stroke-current opacity-25" />

      {/* A roda do usuário. */}
      <polygon points={shape} className="fill-primary/25 stroke-primary" strokeWidth={2} />

      {labels.map((point, index) => (
        <text
          key={entries[index]!.lifeAreaId}
          x={point.x}
          y={point.y}
          textAnchor={point.x > CENTER + 2 ? "start" : point.x < CENTER - 2 ? "end" : "middle"}
          dominantBaseline="middle"
          className="fill-current text-[7px] opacity-70"
        >
          {entries[index]!.name}
        </text>
      ))}
    </svg>
  );
}
