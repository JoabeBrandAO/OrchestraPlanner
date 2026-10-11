"use client";

import { radarPoints, toPolygonPoints, SCORE_MAX } from "@/server/services/life-wheel/wheel";

import { wrapLabel } from "./wrap-label";

/**
 * Radar da Roda da Vida (#17). SVG à mão em vez de uma biblioteca de gráficos: são dois
 * polígonos e uns eixos, e a geometria já vive testada em `wheel.ts` — não vale arrastar
 * uma dependência (e o peso dela no bundle) para isso.
 *
 * O desenho é mais largo que alto: os rótulos das laterais precisam de espaço horizontal.
 * Com 360 de largura, o texto de 12 unidades sai com ~11 px num celular de 390 px e ~15 px
 * no computador — antes eram 7 unidades num quadrado de 240, e os nomes saíam cortados.
 */

const WIDTH = 360;
const HEIGHT = 270;
const CENTER_X = WIDTH / 2;
const CENTER_Y = HEIGHT / 2;
const RADIUS = 75;
const LABEL_GAP = 10;
const FONT_SIZE = 12;
const LINE_HEIGHT = 13;
/** Cabe na folga lateral: (WIDTH / 2 − RADIUS − LABEL_GAP) ÷ (~0,55 × FONT_SIZE). */
const LABEL_CHARS = 14;
const LABEL_LINES = 3;

export type RadarEntry = { lifeAreaId: string; name: string; score: number };

export function RadarChart({ entries }: { entries: RadarEntry[] }) {
  if (entries.length < 3) {
    return (
      <p className="text-muted-foreground text-sm">
        O radar aparece com pelo menos 3 áreas avaliadas.
      </p>
    );
  }

  // `wheel.ts` pensa num quadrado (um centro só); o deslocamento leva para o retângulo.
  const shift = (points: { x: number; y: number }[]) =>
    points.map((point) => ({ x: point.x + CENTER_X - CENTER_Y, y: point.y }));
  const full = new Array<number>(entries.length).fill(SCORE_MAX);
  const at = (scores: number[], radius: number) =>
    shift(radarPoints(scores, { radius, center: CENTER_Y }));

  const shape = toPolygonPoints(
    at(
      entries.map((entry) => entry.score),
      RADIUS,
    ),
  );
  const axes = at(full, RADIUS);
  const labels = at(full, RADIUS + LABEL_GAP);

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="mx-auto h-auto w-full max-w-[440px]"
      role="img"
      aria-label={`Radar da Roda da Vida: ${entries
        .map((entry) => `${entry.name} ${entry.score}`)
        .join(", ")}`}
    >
      {/* Anéis de referência e eixos. */}
      {[0.25, 0.5, 0.75].map((ring) => (
        <polygon
          key={ring}
          points={toPolygonPoints(at(full, RADIUS * ring))}
          className="fill-none stroke-current opacity-15"
        />
      ))}
      {axes.map((point, index) => (
        <line
          key={entries[index]!.lifeAreaId}
          x1={CENTER_X}
          y1={CENTER_Y}
          x2={point.x}
          y2={point.y}
          className="stroke-current opacity-15"
        />
      ))}
      <polygon points={toPolygonPoints(axes)} className="fill-none stroke-current opacity-25" />

      {/* A roda do usuário. */}
      <polygon points={shape} className="fill-primary/25 stroke-primary" strokeWidth={2} />

      {labels.map((point, index) => {
        const entry = entries[index]!;
        const lines = wrapLabel(entry.name, LABEL_CHARS, LABEL_LINES);
        const anchor = point.x > CENTER_X + 2 ? "start" : point.x < CENTER_X - 2 ? "end" : "middle";
        // Perto do topo o bloco cresce para cima, perto da base para baixo; nos lados fica
        // centrado no eixo. Assim nenhuma linha invade o desenho nem o rótulo vizinho.
        const dx = Math.abs(point.x - CENTER_X);
        const dy = point.y - CENTER_Y;
        const vertical = Math.abs(dy) > dx;
        const firstLineY = !vertical
          ? point.y - ((lines.length - 1) * LINE_HEIGHT) / 2
          : dy < 0
            ? point.y - (lines.length - 1) * LINE_HEIGHT
            : point.y;

        return (
          <text
            key={entry.lifeAreaId}
            textAnchor={anchor}
            dominantBaseline="middle"
            fontSize={FONT_SIZE}
            className="fill-current opacity-75"
          >
            <title>{`${entry.name}: ${entry.score}`}</title>
            {lines.map((line, lineIndex) => (
              <tspan key={lineIndex} x={point.x} y={firstLineY + lineIndex * LINE_HEIGHT}>
                {line}
              </tspan>
            ))}
          </text>
        );
      })}
    </svg>
  );
}
