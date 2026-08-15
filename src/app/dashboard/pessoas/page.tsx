import Link from "next/link";

import { ensureUserRecord } from "@/server/users";

import { PeopleManager } from "./people-manager";

// Área autenticada — sempre dinâmica (depende da sessão Clerk).
export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  // Garante usuário + Áreas de Vida padrão (idempotente) ao entrar.
  await ensureUserRecord();

  return (
    <main className="mx-auto flex min-h-svh max-w-4xl flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Pessoas</h1>
        <Link href="/dashboard" className="text-muted-foreground text-sm hover:underline">
          ← Dashboard
        </Link>
      </header>
      <PeopleManager />
    </main>
  );
}
