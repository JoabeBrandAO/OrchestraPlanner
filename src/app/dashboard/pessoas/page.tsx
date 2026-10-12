import { ensureUserRecord } from "@/server/users";

import { PeopleManager } from "./people-manager";

// Área autenticada — sempre dinâmica (depende da sessão Clerk).
export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  // Garante usuário + Áreas de Vida padrão (idempotente) ao entrar.
  await ensureUserRecord();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-8">
      <header>
        <h1 className="text-2xl font-semibold">Pessoas</h1>
      </header>
      <PeopleManager />
    </main>
  );
}
