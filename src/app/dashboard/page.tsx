import { currentUser } from "@clerk/nextjs/server";

import { ensureUserRecord } from "@/server/users";

import { FinanceOverview } from "./finance-overview";
import { GoalsOverview } from "./goals-overview";
import { HealthStatus } from "./health-status";
import { LifeWheelCallout } from "./life-wheel-callout";

// Área autenticada — sempre dinâmica (depende da sessão Clerk).
export const dynamic = "force-dynamic";

/**
 * O panorama do dia. Os atalhos para os módulos viraram o menu fixo (layout) e as
 * preferências, o login e "Seus dados" foram para a tela de Conta: aqui fica só o que se lê
 * ao abrir o app.
 */
export default async function DashboardPage() {
  // Garante a linha do usuário no banco (upsert idempotente) ao entrar.
  await ensureUserRecord();

  const user = await currentUser();
  const greeting = user?.firstName ?? "bem-vindo";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-8">
      <header>
        <h1 className="text-2xl font-semibold">Olá, {greeting}</h1>
        <HealthStatus />
      </header>

      <LifeWheelCallout />

      {/* Panorama das metas (#16) — o que está ativo, atrasado e andando. */}
      <section className="rounded-lg border p-6">
        <h2 className="mb-4 text-lg font-medium">Panorama das metas</h2>
        <GoalsOverview />
      </section>

      {/* Panorama do dinheiro (#54) — o mês corrente, sem precisar abrir o Financeiro. */}
      <section className="rounded-lg border p-6">
        <h2 className="mb-4 text-lg font-medium">Panorama do dinheiro</h2>
        <FinanceOverview />
      </section>
    </main>
  );
}
