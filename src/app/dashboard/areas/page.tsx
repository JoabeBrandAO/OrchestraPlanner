import { ensureUserRecord } from "@/server/users";

import { AreasManager } from "./areas-manager";

// Área autenticada — sempre dinâmica (depende da sessão Clerk).
export const dynamic = "force-dynamic";

export default async function AreasPage() {
  await ensureUserRecord();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-8">
      <header>
        <h1 className="text-2xl font-semibold">Áreas de Vida</h1>
      </header>
      <p className="text-muted-foreground text-sm">
        Suas áreas (Corpo / Alma / Espírito) seguem a Roda da Vida e são personalizáveis.
      </p>
      <AreasManager />
    </main>
  );
}
