import { clerkSetup } from "@clerk/testing/playwright";

/**
 * Setup global do Playwright (issue #7).
 *
 * O Clerk protege o sign-in com verificação anti-bot ("client trust"), que trava um
 * browser headless: o login navegava para `/sign-in/client-trust` e ficava lá. `clerkSetup`
 * troca o `CLERK_SECRET_KEY` por um *testing token* que a instância aceita como legítimo,
 * que é a via oficial — a alternativa seria desligar a proteção anti-bot da conta inteira.
 */
export default async function globalSetup() {
  await clerkSetup();
}
