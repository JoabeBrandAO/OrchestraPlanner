import { ensureUserRecord } from "@/server/users";

import { AccountData } from "./account-data";
import { SessionActions } from "./session-actions";
import { TimeZoneSetting } from "./time-zone-setting";

// Área autenticada — sempre dinâmica (depende da sessão Clerk).
export const dynamic = "force-dynamic";

/**
 * Conta (achado 12 do diagnóstico de UX): login, preferências e "Seus dados" (LGPD) saíram do
 * meio do panorama do painel e moram aqui — uma tela, uma tarefa.
 */
export default async function ContaPage() {
  await ensureUserRecord();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-8">
      <header>
        <h1 className="text-2xl font-semibold">Conta</h1>
      </header>

      <section aria-labelledby="conta-login" className="rounded-lg border p-6">
        <h2 id="conta-login" className="mb-2 text-lg font-medium">
          Login
        </h2>
        <SessionActions />
      </section>

      {/* Fuso horário (#72) — é dele que sai o "hoje" do painel e dos lembretes. */}
      <section aria-labelledby="conta-preferencias" className="rounded-lg border p-6">
        <h2 id="conta-preferencias" className="mb-4 text-lg font-medium">
          Preferências
        </h2>
        <TimeZoneSetting />
      </section>

      {/* Seus dados (#74) — o que é guardado, exportar e apagar a conta. */}
      <section aria-labelledby="conta-dados" className="rounded-lg border p-6">
        <h2 id="conta-dados" className="mb-4 text-lg font-medium">
          Seus dados
        </h2>
        <AccountData />
      </section>
    </main>
  );
}
