import { UserButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { ensureUserRecord } from "@/server/users";

import { HealthStatus } from "./health-status";

// Área autenticada — sempre dinâmica (depende da sessão Clerk).
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Garante a linha do usuário no banco (upsert idempotente) ao entrar.
  await ensureUserRecord();

  const user = await currentUser();
  const greeting = user?.firstName ?? "bem-vindo";

  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Olá, {greeting}</h1>
        <UserButton />
      </header>
      <section className="rounded-lg border p-6">
        <h2 className="mb-2 text-lg font-medium">OrchestraPlanner</h2>
        <p className="text-muted-foreground text-sm">
          Núcleo de valor da Iteração 1: organize suas Metas por Áreas de Vida. Agenda, Financeiro e
          Pessoas chegam nas próximas iterações.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/dashboard/metas" className={buttonVariants({ variant: "default" })}>
            Minhas Metas
          </Link>
          <Link href="/dashboard/areas" className={buttonVariants({ variant: "outline" })}>
            Áreas de Vida
          </Link>
        </div>
        <div className="mt-4">
          <HealthStatus />
        </div>
      </section>
    </main>
  );
}
