import { expect, test, type Page } from "@playwright/test";

import { signIn } from "./sign-in";

/**
 * Navegação persistente: barra inferior no celular, menu lateral no computador — os dois com
 * o mesmo nome acessível ("Navegação principal") e nunca visíveis ao mesmo tempo.
 *
 * Um login só para os dois tamanhos: a instância de desenvolvimento do Clerk tem limite de
 * requisição (ver e2e.yml).
 */
const hasClerkKey = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
const hasTestUser = Boolean(process.env.E2E_CLERK_EMAIL && process.env.E2E_CLERK_PASSWORD);

function mainNav(page: Page) {
  // `getByRole` ignora o que está escondido por CSS: só a navegação do tamanho atual responde.
  return page.getByRole("navigation", { name: "Navegação principal" });
}

async function heading(page: Page, name: string) {
  await expect(page.locator("main h1")).toHaveText(name);
}

test.describe("navegação persistente", () => {
  test.skip(!hasClerkKey || !hasTestUser, "Requer as chaves do Clerk e o usuário de teste.");

  test("barra inferior no celular e menu lateral no computador", async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page);

    await test.step("celular (390×844): barra inferior com o ativo marcado", async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/dashboard");
      await expect(page.locator("main h1")).toContainText(/olá/i);

      await expect(mainNav(page)).toHaveCount(1);
      const bar = mainNav(page);
      await expect(bar.getByRole("link", { name: "Painel" })).toHaveAttribute(
        "aria-current",
        "page",
      );

      // Alvo de toque de pelo menos 44 px em todos os lugares da barra.
      for (const item of await bar.locator("a, button").all()) {
        const box = await item.boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }

      await bar.getByRole("link", { name: "Agenda" }).click();
      await page.waitForURL("**/dashboard/agenda");
      await heading(page, "Agenda");
      await expect(bar.getByRole("link", { name: "Agenda" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      await expect(bar.getByRole("link", { name: "Painel" })).not.toHaveAttribute(
        "aria-current",
        "page",
      );
    });

    await test.step("celular: o Mais abre a folha e acende quando a tela mora nele", async () => {
      const bar = mainNav(page);
      await bar.getByRole("button", { name: "Mais" }).click();
      const sheet = page.getByRole("dialog", { name: "Mais telas" });
      await expect(sheet).toBeVisible();

      await sheet.getByRole("link", { name: "Pessoas" }).click();
      await page.waitForURL("**/dashboard/pessoas");
      await heading(page, "Pessoas");
      await expect(sheet).toBeHidden();
      await expect(bar.getByRole("button", { name: "Mais" })).toHaveAttribute(
        "data-active",
        "true",
      );
    });

    await test.step("celular: a barra não cobre o fim da tela", async () => {
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const barBox = await mainNav(page).boundingBox();
      const mainBox = await page.locator("main").boundingBox();
      expect(mainBox!.y + mainBox!.height).toBeLessThanOrEqual(barBox!.y + 1);
    });

    await test.step("computador (1280×800): menu lateral, sem barra inferior", async () => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto("/dashboard");
      await expect(mainNav(page)).toHaveCount(1);
      const side = page.locator("aside").getByRole("navigation", { name: "Navegação principal" });
      await expect(side).toBeVisible();
      await expect(page.getByRole("button", { name: "Mais" })).toBeHidden();

      await side.getByRole("link", { name: "Conta" }).click();
      await page.waitForURL("**/dashboard/conta");
      await heading(page, "Conta");
      await expect(side.getByRole("link", { name: "Conta" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      for (const name of ["Login", "Preferências", "Seus dados"]) {
        await expect(page.getByRole("heading", { name, level: 2 })).toBeVisible();
      }
    });

    await test.step("o painel ficou só com o panorama", async () => {
      await page.goto("/dashboard");
      await expect(page.getByRole("heading", { name: "Panorama das metas" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Seus dados" })).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "Preferências" })).toHaveCount(0);
    });
  });
});
