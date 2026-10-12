"use client";

import { useClerk } from "@clerk/nextjs";
import { KeyRound, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Login e sessão. Antes ficavam só no avatar do Clerk, no canto do painel; agora a Conta é o
 * único lugar de "quem sou eu no app": gerenciar login (janela do próprio Clerk, já em
 * português) e sair.
 */
export function SessionActions() {
  const { openUserProfile, signOut } = useClerk();

  return (
    <div className="flex flex-col gap-4 text-sm">
      <p className="text-muted-foreground max-w-prose">
        E-mail, senha e os aparelhos em que você está conectado.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={() => openUserProfile()}>
          <KeyRound aria-hidden />
          Gerenciar login
        </Button>
        <Button variant="outline" onClick={() => signOut({ redirectUrl: "/" })}>
          <LogOut aria-hidden />
          Sair
        </Button>
      </div>
    </div>
  );
}
