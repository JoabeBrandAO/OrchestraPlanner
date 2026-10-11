/**
 * Cor de cada dimensão da Roda da Vida — Corpo, Alma e Espírito — como classes do Tailwind
 * ligadas aos tokens `--corpo`/`--alma`/`--espirito` do `globals.css` (claro e escuro).
 *
 * As classes estão escritas por inteiro, e não montadas (`text-${d}`), para o Tailwind
 * enxergá-las no código. A cor nunca é a única pista: o nome da dimensão ou da área está
 * sempre ao lado.
 */
export type Dimension = "corpo" | "alma" | "espirito";

export const DIMENSION_LABEL: Record<Dimension, string> = {
  corpo: "Corpo",
  alma: "Alma",
  espirito: "Espírito",
};

export const DIMENSION_STYLE: Record<
  Dimension,
  { text: string; dot: string; fill: string; accent: string }
> = {
  corpo: { text: "text-corpo", dot: "bg-corpo", fill: "fill-corpo", accent: "accent-corpo" },
  alma: { text: "text-alma", dot: "bg-alma", fill: "fill-alma", accent: "accent-alma" },
  espirito: {
    text: "text-espirito",
    dot: "bg-espirito",
    fill: "fill-espirito",
    accent: "accent-espirito",
  },
};
