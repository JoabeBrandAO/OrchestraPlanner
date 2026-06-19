import { expect, test } from "@playwright/test";

/**
 * Walking skeleton E2E (issue #7): login → home.
 *
 * Runtime exige chave Clerk (o ClerkProvider falha sem ela), então estes testes
 * só rodam quando o ambiente tem as variáveis — no CI da Phase B (com secrets).
 * Sem isso, são pulados para manter o pipeline verde.
 */
const hasClerkKey = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
const hasTestUser = Boolean(process.env.E2E_CLERK_EMAIL && process.env.E2E_CLERK_PASSWORD);

test.describe("walking skeleton", () => {
  test.skip(!hasClerkKey, "Requer NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY (Phase B).");

  test("a landing pública carrega", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "OrchestraPlanner" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Entrar" })).toBeVisible();
  });

  test("login leva ao painel autenticado", async ({ page }) => {
    test.skip(!hasTestUser, "Requer E2E_CLERK_EMAIL/E2E_CLERK_PASSWORD (Phase B).");

    await page.goto("/sign-in");
    await page.getByLabel(/e-?mail/i).fill(process.env.E2E_CLERK_EMAIL!);
    await page.getByRole("button", { name: /continuar|continue/i }).click();
    await page.getByLabel(/senha|password/i).fill(process.env.E2E_CLERK_PASSWORD!);
    await page.getByRole("button", { name: /continuar|continue|entrar|sign in/i }).click();

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /olá|ola/i })).toBeVisible();
  });
});
