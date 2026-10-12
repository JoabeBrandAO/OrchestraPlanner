import {
  CalendarDays,
  ChartPie,
  CircleUserRound,
  House,
  type LucideIcon,
  Shapes,
  SquareKanban,
  Target,
  Users,
  Wallet,
} from "lucide-react";

/**
 * A lista de telas do menu — **uma fonte só** para o menu lateral (computador) e a barra
 * inferior (celular). Os dois nunca aparecem juntos (o corte é o `md`, 768 px) e nunca
 * discordam sobre o que existe, porque leem daqui.
 */
export type NavItem = { href: string; label: string; icon: LucideIcon };

export const PAINEL: NavItem = { href: "/dashboard", label: "Painel", icon: House };
const PRIORIDADES: NavItem = {
  href: "/dashboard/prioridades",
  label: "Prioridades",
  icon: SquareKanban,
};
const AGENDA: NavItem = { href: "/dashboard/agenda", label: "Agenda", icon: CalendarDays };
const METAS: NavItem = { href: "/dashboard/metas", label: "Metas", icon: Target };
const RODA: NavItem = { href: "/dashboard/roda-da-vida", label: "Roda da Vida", icon: ChartPie };
const AREAS: NavItem = { href: "/dashboard/areas", label: "Áreas de Vida", icon: Shapes };
const PESSOAS: NavItem = { href: "/dashboard/pessoas", label: "Pessoas", icon: Users };
const FINANCEIRO: NavItem = { href: "/dashboard/financeiro", label: "Financeiro", icon: Wallet };
export const CONTA: NavItem = { href: "/dashboard/conta", label: "Conta", icon: CircleUserRound };

/**
 * Grupos do menu lateral, pelo jeito de usar: o que se abre todo dia, o norte (Metas e o
 * diagnóstico que gera as metas) e o que se cuida com frequência própria.
 */
export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  { label: "Dia a dia", items: [PRIORIDADES, AGENDA] },
  { label: "Norte", items: [METAS, RODA, AREAS] },
  { label: "Cuidar", items: [PESSOAS, FINANCEIRO] },
];

/**
 * Barra do celular: 4 destinos + "Mais" (5 lugares é o que o polegar alcança com rótulo
 * legível). Metas fica na barra porque "a meta é o centro" (PRODUCT.md); trocar por
 * Financeiro é mudar esta lista — o teste garante que nada some.
 */
export const MOBILE_PRIMARY: NavItem[] = [PAINEL, PRIORIDADES, AGENDA, METAS];
export const MOBILE_MORE: NavItem[] = [PESSOAS, FINANCEIRO, RODA, AREAS, CONTA];

/**
 * A tela `pathname` está dentro do destino `href`? O Painel (`/dashboard`) é pai de tudo,
 * então só acende nele mesmo; os outros acendem neles e nas telas de dentro deles.
 */
export function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (href === PAINEL.href) return path === href;
  return path === href || path.startsWith(`${href}/`);
}
