/**
 * Leitura de formulário não controlado. Os formulários do app deixam o navegador ser dono
 * do que está digitado e leem os campos pelo `name` na hora de validar ou salvar — assim
 * digitar não custa render (ver `docs/FORMATACAO.md` e `docs/ERROS.md` 2026-08-15).
 */
export function fieldValue(form: HTMLFormElement, name: string): string {
  return (form.elements.namedItem(name) as HTMLInputElement | null)?.value ?? "";
}

/** Campo de texto obrigatório: preenchido depois de aparar os espaços. */
export function hasText(form: HTMLFormElement, name: string): boolean {
  return fieldValue(form, name).trim() !== "";
}
