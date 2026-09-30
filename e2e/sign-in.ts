import { setupClerkTestingToken } from "@clerk/testing/playwright";
import type { Page } from "@playwright/test";

/** Código fixo que o Clerk aceita para e-mails de teste (`+clerk_test@`) em desenvolvimento. */
const CLERK_TEST_CODE = "424242";

/**
 * Login pelo formulário do Clerk, até sair do `/sign-in` com sessão. Compartilhado pelos specs
 * que precisam do painel (walking skeleton, CSP).
 */
export async function signIn(page: Page): Promise<void> {
  // Seletores ancorados nos `name`/classe do próprio Clerk, não em texto visível: os
  // rótulos mudam com o idioma da instância, e buscar por "password"/"continue" casa
  // também com o botão "Mostrar senha" e com o "Entrar com o Google".
  const submit = page.locator("button.cl-formButtonPrimary");
  const identifier = page.locator('input[name="identifier"]');
  const password = page.locator('input[name="password"]');

  // Marca esta página como confiável para o Clerk (ver e2e/global-setup.ts).
  await setupClerkTestingToken({ page });

  await page.goto("/sign-in");
  await identifier.fill(process.env.E2E_CLERK_EMAIL!);
  await submit.click();

  await password.waitFor({ state: "visible" });
  await password.fill(process.env.E2E_CLERK_PASSWORD!);
  await submit.click();

  // Verificação de dispositivo novo: com a senha aceita, o Clerk ainda pede um código
  // por e-mail ("You're signing in from a new device"). Num e-mail de teste
  // (`+clerk_test@`), numa instância de desenvolvimento, o código é sempre 424242 — é a
  // via oficial para automatizar login sem caixa de entrada de verdade.
  // `waitFor`, e não `isVisible()`: este último **não espera** — responde na hora, e a
  // tela do código ainda não existe no instante em que a senha é enviada.
  const code = page.getByRole("textbox", { name: /verification code|código de verificação/i });
  const pediuCodigo = await code
    .waitFor({ state: "visible", timeout: 15_000 })
    .then(() => true)
    .catch(() => false);

  if (pediuCodigo) {
    // `fill`, e não digitação tecla a tecla: o campo é mascarado e ignora teclas soltas.
    // Ele se envia sozinho quando o último dígito entra.
    await code.fill(CLERK_TEST_CODE);
  }

  // O Clerk sai do /sign-in assim que a sessão existe.
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"), { timeout: 20_000 });
}
