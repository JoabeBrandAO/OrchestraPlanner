import { DIMENSION_STYLE, type Dimension } from "@/lib/dimension-style";
import { cn } from "@/lib/utils";

/** Marcador da dimensão (Corpo / Alma / Espírito). Decorativo: o nome vem sempre ao lado. */
export function DimensionDot({
  dimension,
  className,
}: {
  dimension: Dimension;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        DIMENSION_STYLE[dimension].dot,
        className,
      )}
    />
  );
}
