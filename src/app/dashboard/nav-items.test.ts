import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { CONTA, MOBILE_MORE, MOBILE_PRIMARY, NAV_GROUPS, PAINEL, isActive } from "./nav-items";

/** Toda tela da área autenticada — o menu tem de levar a cada uma, uma vez só. */
const TELAS = [
  "/dashboard",
  "/dashboard/prioridades",
  "/dashboard/agenda",
  "/dashboard/metas",
  "/dashboard/roda-da-vida",
  "/dashboard/areas",
  "/dashboard/pessoas",
  "/dashboard/financeiro",
  "/dashboard/conta",
];

const hrefs = (items: { href: string }[]) => items.map((item) => item.href);

describe("itens do menu", () => {
  it("o menu lateral leva a todas as telas, cada uma uma vez", () => {
    const lateral = [PAINEL, ...NAV_GROUPS.flatMap((group) => group.items), CONTA];
    expect(hrefs(lateral).sort()).toEqual([...TELAS].sort());
  });

  it("a barra do celular e o 'Mais' levam às mesmas telas, sem repetir", () => {
    expect(hrefs([...MOBILE_PRIMARY, ...MOBILE_MORE]).sort()).toEqual([...TELAS].sort());
  });

  it("a barra do celular tem 4 destinos + o 'Mais' (5 lugares, o limite do polegar)", () => {
    expect(MOBILE_PRIMARY).toHaveLength(4);
    expect(MOBILE_PRIMARY[0]).toBe(PAINEL);
  });

  it("todo item tem rótulo visível e ícone", () => {
    for (const item of [...MOBILE_PRIMARY, ...MOBILE_MORE]) {
      expect(item.label.trim()).not.toBe("");
      expect(item.icon).toBeTruthy();
    }
  });

  it("toda rota do menu tem uma página de verdade (nenhum link quebrado)", () => {
    for (const href of TELAS) {
      const page = path.join(process.cwd(), "src", "app", ...href.split("/"), "page.tsx");
      expect(existsSync(page), href).toBe(true);
    }
  });
});

describe("isActive", () => {
  it("o Painel só acende no próprio Painel", () => {
    expect(isActive("/dashboard", "/dashboard")).toBe(true);
    expect(isActive("/dashboard/", "/dashboard")).toBe(true);
    expect(isActive("/dashboard/agenda", "/dashboard")).toBe(false);
  });

  it("um módulo acende na tela dele e nas telas de dentro dele", () => {
    expect(isActive("/dashboard/agenda", "/dashboard/agenda")).toBe(true);
    expect(isActive("/dashboard/agenda/2026-10", "/dashboard/agenda")).toBe(true);
  });

  it("não confunde rota que só começa com o mesmo texto", () => {
    expect(isActive("/dashboard/areasx", "/dashboard/areas")).toBe(false);
    expect(isActive("/dashboard/metas", "/dashboard/agenda")).toBe(false);
  });

  it("sem rota (renderização sem navegador), nada acende", () => {
    expect(isActive(null, "/dashboard")).toBe(false);
  });
});
