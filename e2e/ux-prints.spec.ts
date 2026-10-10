import { readFileSync } from "node:fs";
import path from "node:path";

import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { test, type Page } from "@playwright/test";

import { signIn } from "./sign-in";

/**
 * Prints das telas principais (desktop e celular) para revisão de UI/UX — não é teste de
 * regressão: não afirma nada, só fotografa. Roda só quando pedido, com `UX_PRINTS_DIR`
 * apontando para a pasta de saída:
 *
 *   UX_PRINTS_DIR=docs/ux/prints/antes npx playwright test e2e/ux-prints.spec.ts
 *
 * Com `IMPECCABLE_DETECT_JS` apontando para o `detect.js` do Impeccable, também roda o
 * detector de anti-padrões em cada tela e grava o resultado em `detector.json`.
 */
const outDir = process.env.UX_PRINTS_DIR;
const detectJs = process.env.IMPECCABLE_DETECT_JS;
const hasClerkKey = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
const hasTestUser = Boolean(process.env.E2E_CLERK_EMAIL && process.env.E2E_CLERK_PASSWORD);

const SCREENS = [
  { slug: "painel", path: "/dashboard" },
  { slug: "metas", path: "/dashboard/metas" },
  { slug: "prioridades", path: "/dashboard/prioridades" },
  { slug: "agenda", path: "/dashboard/agenda" },
  { slug: "pessoas", path: "/dashboard/pessoas" },
  { slug: "financeiro", path: "/dashboard/financeiro" },
  { slug: "areas", path: "/dashboard/areas" },
  { slug: "roda-da-vida", path: "/dashboard/roda-da-vida" },
] as const;

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "celular", width: 390, height: 844 },
] as const;

// O detector entra por `<script>` injetado, e a CSP obrigatória (#92) o bloquearia.
test.use({ bypassCSP: Boolean(detectJs) });
test.describe.configure({ mode: "serial" });

const findings: Record<string, unknown> = {};

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  // Os painéis client-side mostram "Carregando…" até a primeira resposta do tRPC.
  await page
    .getByText(/^Carregando/)
    .first()
    .waitFor({ state: "detached", timeout: 15_000 })
    .catch(() => undefined);
}

/** `UX_PRINTS_ONLY=painel,agenda` restringe as telas fotografadas. */
const only = process.env.UX_PRINTS_ONLY?.split(",").map((slug) => slug.trim());

async function capture(page: Page, name: string) {
  if (only && !only.includes(name)) return;
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(outDir!, `${name}-${viewport.name}.png`),
      fullPage: true,
    });
  }
  if (detectJs) {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.evaluate(() => {
      (window as unknown as { __IMPECCABLE_CONFIG__: unknown }).__IMPECCABLE_CONFIG__ = {
        autoScan: false,
      };
    });
    await page.addScriptTag({ content: readFileSync(detectJs, "utf8") });
    findings[name] = await page.evaluate(async () => {
      const w = window as unknown as { impeccableDetectAsync?: () => Promise<unknown> };
      return w.impeccableDetectAsync ? await w.impeccableDetectAsync() : "detector indisponível";
    });
  }
}

test.describe("prints de UX", () => {
  test.skip(!outDir, "Só roda com UX_PRINTS_DIR.");
  test.skip(!hasClerkKey || !hasTestUser, "Requer as chaves do Clerk e o usuário de teste.");
  test.setTimeout(300_000);

  test("landing e telas autenticadas", async ({ page }) => {
    await page.goto("/");
    await settle(page);
    await capture(page, "landing");

    await setupClerkTestingToken({ page });
    await page.goto("/sign-in");
    await page.locator('input[name="identifier"]').waitFor();
    await capture(page, "entrar");

    await signIn(page);
    for (const screen of SCREENS) {
      if (only && !only.includes(screen.slug)) continue;
      await page.goto(screen.path);
      await settle(page);
      await capture(page, screen.slug);
    }

    if (detectJs) {
      const { writeFileSync } = await import("node:fs");
      writeFileSync(path.join(outDir!, "detector.json"), JSON.stringify(findings, null, 2));
    }
  });
});
