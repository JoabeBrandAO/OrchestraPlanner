import { cn } from "@/lib/utils";

/**
 * Barra de progresso (0–100). Primitivo compartilhado por Metas (#15) e Dashboard (#16).
 *
 * `role="progressbar"` + `aria-valuenow` fazem o leitor de tela anunciar o número que a
 * barra desenha; o `<span>` visual fica `aria-hidden` para não duplicar a leitura.
 */
export function ProgressBar({
  value,
  label,
  className,
}: {
  value: number;
  label?: string;
  className?: string;
}) {
  const clamped = Math.min(100, Math.max(0, Math.round(value)));

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn("bg-muted h-2 w-full overflow-hidden rounded-full", className)}
    >
      <span
        aria-hidden
        className="bg-primary block h-full rounded-full transition-[width] duration-300"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
