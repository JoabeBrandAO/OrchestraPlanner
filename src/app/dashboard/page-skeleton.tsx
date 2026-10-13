import { cn } from "@/lib/utils";

/**
 * Esqueleto das telas do painel, mostrado pelos `loading.tsx` enquanto o servidor monta a
 * tela de destino. Existe por um motivo só: **o toque na barra precisa ter resposta na hora**.
 * Sem um `loading.tsx` o Next espera a resposta inteira do servidor antes de trocar qualquer
 * coisa na tela, e no celular (a ida e volta até a Vercel em Washington custa ~200 ms) o
 * toque parece ignorado.
 *
 * Leve de propósito: só blocos cinza com o mesmo contêiner das telas (largura e recuo), para
 * a página não "pular" quando o conteúdo de verdade chega. Sem título (`h1`) e sem `main`: o
 * esqueleto não é uma tela, e a tela de verdade traz os dois.
 */
export function PageSkeleton({ maxWidth }: { maxWidth: "3xl" | "4xl" | "5xl" }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-slot="page-skeleton"
      className={cn(
        "mx-auto flex w-full flex-col gap-6 p-4 sm:p-8",
        maxWidth === "3xl" && "max-w-3xl",
        maxWidth === "4xl" && "max-w-4xl",
        maxWidth === "5xl" && "max-w-5xl",
      )}
    >
      <span className="sr-only">Carregando a tela…</span>
      <div aria-hidden className="flex flex-col gap-6">
        <div className="bg-muted h-8 w-44 animate-pulse rounded-md motion-reduce:animate-none" />
        <div className="h-40 animate-pulse rounded-lg border motion-reduce:animate-none" />
        <div className="h-28 animate-pulse rounded-lg border motion-reduce:animate-none" />
      </div>
    </div>
  );
}
