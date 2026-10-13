"use client";

import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";
import { Ellipsis } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type MouseEvent, useEffect, useState } from "react";

import { DimensionDot } from "@/components/ui/dimension-dot";
import { cn } from "@/lib/utils";

import {
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
 * A tela atual é marcada do mesmo jeito nos dois, como o **marcador de página** de um planner:
 * pílula na cor `--marcador` (couro no claro, papel no escuro) + `aria-current="page"`. As
 * cores de Corpo / Alma / Espírito ficam fora do menu de propósito: lá elas querem dizer a
 * dimensão.
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
          ? "bg-marcador text-marcador-foreground"
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

/**
 * Conteúdo de um lugar da barra: ícone + rótulo sempre visível. O ativo ganha a pílula atrás
 * do ícone (o marcador de página) e o rótulo em negrito: forma, cor e peso, não só cor.
 *
 * Medidas 10% acima das anteriores (pílula 56×28 → 62×31, ícone 20 → 22 px), na mesma
 * proporção. O rótulo ficou em 11 px de propósito: em tela de 360 px "Prioridades" já
 * enche a coluna, e 12 px o cortaria.
 */
function BarItemBody({ item, active }: { item: Pick<NavItem, "label" | "icon">; active: boolean }) {
  const Icon = item.icon;
  return (
    <>
      <span
        data-slot={active ? "marcador" : undefined}
        className={cn(
          "grid h-[1.9375rem] w-[3.875rem] place-items-center rounded-full transition-colors duration-200 ease-out motion-reduce:transition-none",
          active && "bg-marcador text-marcador-foreground",
        )}
      >
        <Icon aria-hidden className="size-[1.375rem]" />
      </span>
      <span className="max-w-full truncate px-0.5">{item.label}</span>
    </>
  );
}

/** Um lugar da barra: alvo de toque de 62 px de altura (o mínimo é 44). */
function barItemClass(active: boolean) {
  return cn(
    "relative flex min-h-[3.875rem] w-full flex-col items-center justify-center gap-1 rounded-lg pt-1.5 pb-1 text-[0.6875rem] leading-none",
    "outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-inset",
    active ? "text-foreground font-semibold" : "text-muted-foreground font-medium",
  );
}

/**
 * Quanto tempo o toque "empresta" a pílula à aba tocada se a rota ainda não mudou. É uma rede
 * de segurança (voltar do navegador no meio da troca, por exemplo): no caminho normal o
 * pendente expira sozinho assim que a rota muda.
 */
const PENDING_MAX_MS = 8000;

/** Toque simples (sem Ctrl/Cmd/Shift/Alt, botão principal): o que de fato troca de tela. */
function isPlainClick(event: MouseEvent) {
  return event.button === 0 && !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);
}

/**
 * Barra inferior — só abaixo do `md`. Quatro destinos e o "Mais", que abre uma gaveta com o
 * resto (`Drawer` do Base UI: sobe em ~240 ms, fecha por Esc, toque no fundo ou arrastando
 * para baixo). A gaveta fecha sozinha quando a tela muda (inclusive pelo voltar do
 * navegador): ela guarda a rota em que foi aberta e só fica aberta enquanto a rota for a mesma.
 *
 * **Resposta ao toque.** As telas são dinâmicas: a rota só muda depois que o servidor
 * responde, e até lá a pílula ficava parada na aba antiga. Por isso o toque acende a aba
 * tocada na hora (`pending`), enquanto `aria-current` continua dizendo a verdade — a página
 * em que o app está de fato.
 */
export function BottomNav() {
  const pathname = usePathname();
  const [openAt, setOpenAt] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [seenPath, setSeenPath] = useState(pathname);
  const open = openAt !== null && openAt === pathname;
  // A rota mudou: o toque foi atendido (ou superado), então o pendente cai na mesma renderização
  // — sem isto, o voltar do navegador reacenderia a aba tocada antes.
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setPending(null);
  }
  const shown = pending ?? pathname;
  const moreLit = MOBILE_MORE.some((item) => isActive(shown, item.href));

  useEffect(() => {
    if (pending === null) return;
    const timer = window.setTimeout(() => setPending(null), PENDING_MAX_MS);
    return () => window.clearTimeout(timer);
  }, [pending]);

  function touched(event: MouseEvent, href: string) {
    if (isPlainClick(event)) setPending(href);
  }

  return (
    <nav
      aria-label="Navegação principal"
      className="bg-background fixed inset-x-0 bottom-0 z-40 border-t pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] md:hidden"
    >
      <ul className="grid grid-cols-5 px-1 pt-1">
        {MOBILE_PRIMARY.map((item) => {
          const current = isActive(pathname, item.href);
          const lit = isActive(shown, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                onClick={(event) => touched(event, item.href)}
                className={barItemClass(lit)}
              >
                <BarItemBody item={item} active={lit} />
              </Link>
            </li>
          );
        })}
        <li>
          <DrawerPrimitive.Root
            open={open}
            onOpenChange={(next) => setOpenAt(next ? (pathname ?? "") : null)}
          >
            <DrawerPrimitive.Trigger
              aria-expanded={open}
              data-active={moreLit ? "true" : undefined}
              className={barItemClass(moreLit)}
            >
              <BarItemBody item={{ label: "Mais", icon: Ellipsis }} active={moreLit} />
            </DrawerPrimitive.Trigger>
            <DrawerPrimitive.Portal>
              <DrawerPrimitive.Backdrop
                data-slot="gaveta-fundo"
                className={cn(
                  "fixed inset-0 z-50 min-h-dvh bg-black/50 backdrop-blur-[2px] md:hidden",
                  // O fundo clareia junto com o arrasto: `--drawer-swipe-progress` vai de 0 a 1.
                  "opacity-[calc(1-var(--drawer-swipe-progress,0))]",
                  "transition-opacity duration-[240ms] ease-out motion-reduce:transition-none",
                  "data-ending-style:opacity-0 data-starting-style:opacity-0 data-swiping:duration-0",
                  "data-ending-style:duration-[calc(var(--drawer-swipe-strength,1)*240ms)]",
                  // iOS 26+: sem isto o fundo não cobre a área visível inteira.
                  "supports-[-webkit-touch-callout:none]:absolute",
                )}
              />
              <DrawerPrimitive.Viewport className="fixed inset-0 z-50 flex items-end justify-center md:hidden">
                <DrawerPrimitive.Popup
                  data-slot="gaveta"
                  className={cn(
                    // `-mb-12` + 3 rem a mais de padding: a folha passa 48 px da borda de baixo,
                    // então puxar além do limite não deixa um vão debaixo dela.
                    "bg-popover text-popover-foreground -mb-12 max-h-[calc(100svh-2rem+3rem)] w-full overflow-y-auto overscroll-contain rounded-t-2xl border-t",
                    "pr-[calc(env(safe-area-inset-right)+0.75rem)] pb-[calc(env(safe-area-inset-bottom)+0.75rem+3rem)] pl-[calc(env(safe-area-inset-left)+0.75rem)]",
                    "touch-auto shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.25)] outline-none",
                    // Segue o dedo (`--drawer-swipe-movement-y`); sem arrasto vale 0 e a folha
                    // fica no lugar. Soltou sem passar do limite: o `transition` a devolve.
                    "[transform:translateY(var(--drawer-swipe-movement-y,0px))]",
                    "transition-transform duration-[240ms] ease-out motion-reduce:transition-none",
                    "data-swiping:duration-0 data-swiping:select-none",
                    "data-ending-style:[transform:translateY(calc(100%-3rem+2px))] data-starting-style:[transform:translateY(calc(100%-3rem+2px))]",
                    // Fechando por arrasto, o tempo encolhe com a força do gesto (0,1 a 1).
                    "data-ending-style:duration-[calc(var(--drawer-swipe-strength,1)*240ms)]",
                  )}
                >
                  {/* Alça: só dica visual (a folha toda é arrastável); a faixa maior é onde o
                      mouse também pega, já que o `Content` não deixa o mouse arrastar. */}
                  <div aria-hidden className="flex justify-center py-2">
                    <span className="bg-border h-1 w-9 rounded-full" />
                  </div>
                  <DrawerPrimitive.Content>
                    <DrawerPrimitive.Title className="sr-only">Mais telas</DrawerPrimitive.Title>
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
                              onClick={(event) => {
                                setOpenAt(null);
                                touched(event, item.href);
                              }}
                              className={cn(
                                "focus-visible:ring-foreground flex min-h-12 items-center gap-3 rounded-lg px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-inset",
                                active
                                  ? "bg-marcador text-marcador-foreground font-semibold"
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
                  </DrawerPrimitive.Content>
                </DrawerPrimitive.Popup>
              </DrawerPrimitive.Viewport>
            </DrawerPrimitive.Portal>
          </DrawerPrimitive.Root>
        </li>
      </ul>
    </nav>
  );
}
