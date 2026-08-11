/**
 * Regra pura do nome de uma tag (#14). Vive num módulo **sem dependência de banco**
 * porque a UI (client component) também precisa do limite e da normalização — importar
 * isto de `tags-service.ts` puxaria `postgres`/Drizzle para o bundle do browser.
 */

/** Tamanho máximo do nome de uma tag — curto de propósito: é um chip, não um título. */
export const TAG_NAME_MAX_LENGTH = 32;

/** Faz trim, colapsa espaços internos e valida o limite. Lança com mensagem em PT-BR. */
export function normalizeTagName(input: string): string {
  const value = input.trim().replace(/\s+/g, " ");
  if (value.length === 0) throw new Error("O nome da tag é obrigatório.");
  if (value.length > TAG_NAME_MAX_LENGTH) {
    throw new Error(`A tag deve ter no máximo ${TAG_NAME_MAX_LENGTH} caracteres.`);
  }
  return value;
}
