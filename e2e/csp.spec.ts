import { expect, test, type Page } from "@playwright/test";

import { signIn } from "./sign-in";

/**
 * CSP obrigatória (#92): o cabeçalho é o de verdade (não Report-Only), carrega nonce, e uma
 * sessão de uso normal **não gera nenhuma violação**. Uma violação numa CSP obrigatória é um
 * script, estilo ou conexão que o navegador **bloqueou** — ou seja, algo quebrado na tela.
 */
const hasClerkKey = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
const hasTestUser = Boolean(process.env.E2E_CLERK_EMAIL && process.env.E2E_CLERK_PASSWORD);

/**
 * Toda violação, em todas as navegações. No Chromium, cada bloqueio da CSP sai no console
 * como erro ("Refused to load/execute … Content Security Policy"). Ouvir o console, e não um
 * evento dentro da página, atravessa os redirecionamentos do login sem perder nada.
 */
function watchViolations(page: Page): string[] {
  const found: string[] = [];
  page.on("console", (message) => {
    const text = message.text();
    if (/Content Security Policy/i.test(text)) found.push(`${page.url()} → ${text}`);
  });
  return found;
}

test.describe("CSP obrigatória", () => {
  test.skip(!hasClerkKey, "Requer NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.");

  test("a landing responde com CSP obrigatória e nonce", async ({ page }) => {
    const response = await page.goto("/");
    const headers = response!.headers();
    expect(headers["content-security-policy"]).toMatch(/script-src [^;]*'nonce-[^']+'/);
    expect(headers["content-security-policy"]).toContain("'strict-dynamic'");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["content-security-policy-report-only"]).toBeUndefined();
  });

  test("login e as telas do painel não geram nenhuma violação", async ({ page }) => {
    test.skip(!hasTestUser, "Requer E2E_CLERK_EMAIL/E2E_CLERK_PASSWORD.");
    // Oito telas autenticadas, cada uma com suas consultas: da máquina de desenvolvimento
    // (Brasil → Neon us-east-1) passa fácil dos 30 s padrão.
    test.setTimeout(120_000);
    const violations = watchViolations(page);

    await signIn(page);

    for (const path of [
      "/dashboard",
      "/dashboard/metas",
      "/dashboard/prioridades",
      "/dashboard/agenda",
      "/dashboard/pessoas",
      "/dashboard/financeiro",
      "/dashboard/areas",
      "/dashboard/roda-da-vida",
    ]) {
      await page.goto(path);
      // `networkidle` nunca chega com o Clerk consultando a sessão de tempos em tempos. O
      // título da tela diz que ela montou; a folga deixa as consultas dela saírem.
      await page.locator("main h1").first().waitFor();
      await page.waitForTimeout(1_000);
    }

    // A janela de importação de extrato é a tela com mais JavaScript do app.
    await page.goto("/dashboard/financeiro");
    const importar = page.getByRole("button", { name: /importar/i }).first();
    if (await importar.isVisible()) {
      await importar.click();
      await page.waitForTimeout(500);
    }

    expect(violations).toEqual([]);
  });
});
