import Link from "next/link";

import { ensureUserRecord } from "@/server/users";

import { AreasManager } from "./areas-manager";

// Área autenticada — sempre dinâmica (depende da sessão Clerk).
export const dynamic = "force-dynamic";

export default async function AreasPage() {
  await ensureUserRecord();

  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Áreas de Vida</h1>
        <Link href="/dashboard" className="text-muted-foreground text-sm hover:underline">
          ← Dashboard
        </Link>
      </header>
      <p className="text-muted-foreground text-sm">
        Suas áreas (Corpo / Alma / Espírito) seguem a Roda da Vida e são personalizáveis.
      </p>
      <AreasManager />
    </main>
  );
}
