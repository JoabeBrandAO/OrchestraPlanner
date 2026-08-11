import { defineConfig } from "vitest/config";

export default defineConfig({
  // Resolução nativa dos paths do tsconfig (@/* → src/*) — Vitest 4+.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    // Carrega o `.env` antes dos testes: o teste de RLS (#3) só roda quando há
    // `DATABASE_URL` (local), e segue pulado no CI (que não tem `.env`).
    setupFiles: ["dotenv/config"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Os testes de integração falam com o Neon (rede, não localhost): os 5 s padrão
    // do Vitest estouram em cenários com várias idas e voltas (ex.: mover cards no
    // Kanban). Os testes puros continuam rodando em milissegundos.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // E2E (Playwright) fica em e2e/ e roda por outro runner.
    exclude: ["node_modules", ".next", "e2e"],
  },
});
