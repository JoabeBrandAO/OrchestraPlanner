/**
 * Violação de unicidade do Postgres (`23505`) — a única forma de saber que um índice único
 * barrou a escrita sem ler a mensagem do driver, que é em inglês e cita o nome do índice.
 *
 * Percorre a cadeia de `cause` porque o Drizzle embrulha o erro do driver num
 * `DrizzleQueryError`: o `code` do Postgres não está no topo. Quem chama traduz para uma
 * frase do domínio — o erro cru nunca chega à tela (ver `docs/FORMATACAO.md`).
 */
export function isUniqueViolation(error: unknown): boolean {
  for (let current = error; current != null; current = (current as { cause?: unknown }).cause) {
    if (typeof current !== "object") return false;
    if ("code" in current && (current as { code?: string }).code === "23505") return true;
  }
  return false;
}
