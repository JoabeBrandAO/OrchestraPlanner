// Carrega o `.env` antes de tudo: os specs decidem se rodam ou se pulam a partir de
// `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` e `E2E_CLERK_*`, e sem isto o Playwright não
// enxerga variável nenhuma — a suíte passava "verde" pulando os dois testes.
import "dotenv/config";

import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3000);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // Emite o testing token do Clerk antes da suíte (ver e2e/global-setup.ts).
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Sobe a app buildada antes dos testes (precisa de chaves Clerk em runtime).
  webServer: {
    command: "npm run start",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
