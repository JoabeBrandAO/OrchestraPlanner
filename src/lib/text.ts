/**
 * Maiúscula só na primeira letra ("outubro de 2026" → "Outubro de 2026").
 *
 * Existe porque `text-transform: capitalize` põe maiúscula em **toda** palavra — "Outubro De
 * 2026", "Segunda-Feira" —, o que em português é erro: preposição e a segunda parte do
 * dia da semana ficam em minúscula.
 */
export function capitalizeFirst(text: string): string {
  return text.charAt(0).toLocaleUpperCase("pt-BR") + text.slice(1);
}
