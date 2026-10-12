import { ensureUserRecord } from "@/server/users";

import { LifeWheelManager } from "./life-wheel-manager";

// Área autenticada — sempre dinâmica (depende da sessão Clerk).
export const dynamic = "force-dynamic";

export default async function RodaDaVidaPage() {
  // Garante usuário + Áreas de Vida padrão (idempotente) ao entrar.
  await ensureUserRecord();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-8">
      <header>
        <h1 className="text-2xl font-semibold">Roda da Vida</h1>
      </header>
      <LifeWheelManager />
    </main>
  );
}
