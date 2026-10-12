"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Ellipsis } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { DialogBackdrop } from "@/components/ui/dialog";
import { DimensionDot } from "@/components/ui/dimension-dot";
import { cn } from "@/lib/utils";

import {
  BOTTOM_NAV_STYLE,
  type BottomNavStyle,
  CONTA,
  MOBILE_MORE,
  MOBILE_PRIMARY,
  NAV_GROUPS,
  type NavItem,
  PAINEL,
  isActive,
} from "./nav-items";

/**
 * Navegação persistente da área autenticada (achado 9 do diagnóstico de UX): menu lateral
 * fixo no computador, barra inferior no celular. Os dois leem a mesma lista
 * (`nav-items.ts`) e se excluem pelo corte `md` (768 px): nunca aparecem juntos.
 *
 * A tela atual é marcada do mesmo jeito nos dois: fundo sólido na cor principal (preto no
 * claro, quase branco no escuro) + `aria-current="page"`. As cores de Corpo / Alma /
 * Espírito ficam fora do menu de propósito: lá elas querem dizer a dimensão.
 */

/** Anel de foco forte (cor do texto), visível nos dois temas — o padrão `ring/50` some no branco. */
const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar";

function SideLink({ item, pathname }: { item: NavItem; pathname: string | null }) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors duration-150 motion-reduce:transition-none",
        focusRing,
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      )}
    >
      <Icon aria-hidden className="size-4 shrink-0" />
      {item.label}
    </Link>
  );
}

/** Menu lateral fixo — só do `md` para cima. */
export function SideNav() {
  const pathname = usePathname();
  return (
    <aside className="bg-sidebar text-sidebar-foreground sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r md:flex">
      <div className="flex items-center gap-2.5 px-6 pt-6 pb-5">
        {/* A marca são as três dimensões da Roda da Vida, na ordem do app. */}
        <span aria-hidden className="flex gap-1">
          <DimensionDot dimension="corpo" />
          <DimensionDot dimension="alma" />
          <DimensionDot dimension="espirito" />
        </span>
        <span className="font-semibold tracking-tight">OrchestraPlanner</span>
      </div>

      <nav
        aria-label="Navegação principal"
        className="flex flex-1 flex-col overflow-y-auto px-3 pb-3"
      >
        <ul>
          <li>
            <SideLink item={PAINEL} pathname={pathname} />
          </li>
        </ul>

        {NAV_GROUPS.map((group, index) => {
          const labelId = `menu-grupo-${index}`;
          return (
            <div key={group.label} className="mt-5">
              <p id={labelId} className="text-muted-foreground px-3 pb-1.5 text-xs font-medium">
                {group.label}
              </p>
              <ul aria-labelledby={labelId} className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <SideLink item={item} pathname={pathname} />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}

        <ul className="mt-auto border-t pt-3">
          <li>
            <SideLink item={CONTA} pathname={pathname} />
          </li>
        </ul>
      </nav>
    </aside>
  );
}

/** Conteúdo de um lugar da barra: ícone + rótulo sempre visível, no estilo escolhido. */
function BarItemBody({
  item,
  active,
  variant,
}: {
  item: Pick<NavItem, "label" | "icon">;
  active: boolean;
  variant: BottomNavStyle;
}) {
  const Icon = item.icon;
  return (
    <>
      {variant === "traco" && (
        <span
          aria-hidden
          className={cn(
            "bg-foreground absolute top-0 left-1/2 h-[3px] w-7 -translate-x-1/2 rounded-b-full transition-transform duration-200 ease-out motion-reduce:transition-none",
            active ? "scale-x-100" : "scale-x-0",
          )}
        />
      )}
      <span
        className={cn(
          "grid h-7 w-14 place-items-center rounded-full transition-colors duration-200 ease-out motion-reduce:transition-none",
          variant === "pilula" && active && "bg-primary text-primary-foreground",
        )}
      >
        <Icon aria-hidden className="size-5" />
      </span>
      <span className="max-w-full truncate px-0.5">{item.label}</span>
    </>
  );
}

/** Um lugar da barra: alvo de toque de 56 px de altura (o mínimo é 44). */
function barItemClass(active: boolean) {
  return cn(
    "relative flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-lg pt-1.5 pb-1 text-[0.6875rem] leading-none",
    "outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-inset",
    active ? "text-foreground font-semibold" : "text-muted-foreground font-medium",
  );
}

/**
 * Barra inferior — só abaixo do `md`. Quatro destinos e o "Mais", que abre uma folha com o
 * resto. A folha fecha sozinha quando a tela muda (inclusive pelo voltar do navegador): ela
 * guarda a rota em que foi aberta e só fica aberta enquanto a rota for a mesma.
 */
export function BottomNav({ variant = BOTTOM_NAV_STYLE }: { variant?: BottomNavStyle }) {
  const pathname = usePathname();
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt !== null && openAt === pathname;
  const moreActive = MOBILE_MORE.some((item) => isActive(pathname, item.href));

  return (
    <nav
      aria-label="Navegação principal"
      className="bg-background fixed inset-x-0 bottom-0 z-40 border-t pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] md:hidden"
    >
      <ul className="grid grid-cols-5 px-1 pt-1">
        {MOBILE_PRIMARY.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={barItemClass(active)}
              >
                <BarItemBody item={item} active={active} variant={variant} />
              </Link>
            </li>
          );
        })}
        <li>
          <DialogPrimitive.Root
            open={open}
            onOpenChange={(next) => setOpenAt(next ? (pathname ?? "") : null)}
          >
            <DialogPrimitive.Trigger
              aria-expanded={open}
              data-active={moreActive ? "true" : undefined}
              className={barItemClass(moreActive)}
            >
              <BarItemBody
                item={{ label: "Mais", icon: Ellipsis }}
                active={moreActive}
                variant={variant}
              />
            </DialogPrimitive.Trigger>
            <DialogPrimitive.Portal>
              <DialogBackdrop className="md:hidden" />
              <DialogPrimitive.Popup className="bg-popover text-popover-foreground fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t pt-2 pr-[calc(env(safe-area-inset-right)+0.75rem)] pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pl-[calc(env(safe-area-inset-left)+0.75rem)] shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.25)] transition-transform duration-200 ease-out outline-none data-ending-style:translate-y-full data-starting-style:translate-y-full motion-reduce:transition-none md:hidden">
                <div aria-hidden className="bg-border mx-auto mb-2 h-1 w-9 rounded-full" />
                <DialogPrimitive.Title className="sr-only">Mais telas</DialogPrimitive.Title>
                <ul className="flex flex-col gap-0.5">
                  {MOBILE_MORE.map((item) => {
                    const active = isActive(pathname, item.href);
                    const Icon = item.icon;
                    return (
                      <li
                        key={item.href}
                        className={cn(item === CONTA && "mt-1.5 border-t pt-1.5")}
                      >
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          onClick={() => setOpenAt(null)}
                          className={cn(
                            "focus-visible:ring-foreground flex min-h-12 items-center gap-3 rounded-lg px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-inset",
                            active
                              ? "bg-primary text-primary-foreground font-semibold"
                              : "hover:bg-muted font-medium",
                          )}
                        >
                          <Icon
                            aria-hidden
                            className={cn("size-5", !active && "text-muted-foreground")}
                          />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </DialogPrimitive.Popup>
            </DialogPrimitive.Portal>
          </DialogPrimitive.Root>
        </li>
      </ul>
    </nav>
  );
}
