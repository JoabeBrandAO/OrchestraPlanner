import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ensureUserRecord } from "@/server/users";

import { PrioritiesBoard } from "./priorities-board";

// Área autenticada — sempre dinâmica (depende da sessão Clerk).
export const dynamic = "force-dynamic";

export default async function PrioridadesPage() {
  // Garante usuário + Áreas de Vida padrão (idempotente) ao entrar.
  await ensureUserRecord();

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-5xl flex-col gap-6 p-4 sm:p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Prioridades</h1>
        <Link
          href="/dashboard"
          className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Painel
        </Link>
      </header>
      <PrioritiesBoard />
    </main>
  );
}
