import { auth } from "@clerk/nextjs/server";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default async function Home() {
  const { userId } = await auth();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-8 text-center">
      <div className="space-y-3">
        <h1 className="text-4xl font-semibold tracking-tight">OrchestraPlanner</h1>
        <p className="text-muted-foreground max-w-md text-lg">
          Organize sua vida de forma integrada: metas e prioridades, agenda, finanças e
          relacionamentos.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        {userId ? (
          <Link href="/dashboard" className={buttonVariants()}>
            Ir para o painel
          </Link>
        ) : (
          <>
            <Link href="/sign-in" className={buttonVariants()}>
              Entrar
            </Link>
            <Link href="/sign-up" className={buttonVariants({ variant: "outline" })}>
              Criar conta
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
