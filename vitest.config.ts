import { defineConfig } from "vitest/config";

export default defineConfig({
  // Resolução nativa dos paths do tsconfig (@/* → src/*) — Vitest 4+.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // E2E (Playwright) fica em e2e/ e roda por outro runner.
    exclude: ["node_modules", ".next", "e2e"],
  },
});
