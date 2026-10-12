import type { Viewport } from "next";

import { BottomNav, SideNav } from "./app-nav";

/**
 * `viewport-fit=cover`: no iPhone (app instalado na Tela de Início), sem isto o
 * `env(safe-area-inset-*)` vale sempre 0 e a barra inferior fica sob o indicador de início.
 * Só na área autenticada, que é onde existe a barra e o recuo correspondente.
 */
export const viewport: Viewport = { viewportFit: "cover" };

/**
 * Casca da área autenticada: menu lateral fixo no computador, barra inferior no celular.
 * O conteúdo ganha recuo embaixo (altura da barra + área segura) para a barra nunca cobrir o
 * fim da tela; do `md` para cima a barra some e o recuo também.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-1 pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
      <a
        href="#conteudo"
        className="bg-background sr-only z-50 rounded-md border px-3 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Pular para o conteúdo
      </a>
      <SideNav />
      <div
        id="conteudo"
        tabIndex={-1}
        className="min-w-0 flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))] outline-none md:pb-0"
      >
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
