/**
 * Quebra o nome de uma área em linhas curtas para o rótulo do radar (#17).
 *
 * O SVG não quebra texto sozinho: um rótulo comprido numa linha só ("Crescimento Pessoal &
 * Intelectual") sai pela borda do desenho e é cortado. A quebra é por palavra, gulosa, e a
 * última linha que ainda sobrar ganha reticências — o nome inteiro continua no `<title>` e
 * no rótulo acessível do gráfico.
 */
export function wrapLabel(name: string, maxChars: number, maxLines: number): string[] {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars || current === "") {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);

  if (lines.length <= maxLines) return lines.map((line) => clip(line, maxChars));

  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = clip(`${kept[maxLines - 1]}…`, maxChars);
  return kept.map((line) => clip(line, maxChars));
}

function clip(line: string, maxChars: number): string {
  if (line.length <= maxChars) return line;
  return `${line.slice(0, maxChars - 1).trimEnd()}…`;
}
