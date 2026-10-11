import { cn } from "@/lib/utils";

/**
 * Mensagem de erro de formulário ou de ação. Uma implementação para o app inteiro:
 *
 * - **Cor com contraste AA** (`text-destructive`, ≥ 4,5:1 sobre o fundo). O `red-500` que
 *   cada tela usava dava 3,8:1 e reprovava (ver `docs/ux/2026-10-10-diagnostico-impeccable.md`).
 * - **`role="alert"`**: o leitor de tela anuncia o erro quando ele aparece. Antes o texto
 *   surgia em silêncio ao lado do botão e quem não enxerga a tela não ficava sabendo.
 *
 * Sem mensagem, não desenha nada — quem chama não precisa do `&&`.
 */
export function FormError({ message, className }: { message?: string | null; className?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className={cn("text-destructive text-sm", className)}>
      {message}
    </p>
  );
}
