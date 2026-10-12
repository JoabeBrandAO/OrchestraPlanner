import { ensureUserRecord } from "@/server/users";

import { PrioritiesBoard } from "./priorities-board";

// Área autenticada — sempre dinâmica (depende da sessão Clerk).
export const dynamic = "force-dynamic";

export default async function PrioridadesPage() {
  // Garante usuário + Áreas de Vida padrão (idempotente) ao entrar.
  await ensureUserRecord();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-8">
      <header>
        <h1 className="text-2xl font-semibold">Prioridades</h1>
      </header>
      <PrioritiesBoard />
    </main>
  );
}
