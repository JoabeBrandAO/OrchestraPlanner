"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { SERVICE_WORKER_PATH, urlBase64ToUint8Array, VAPID_PUBLIC_KEY } from "@/lib/push";
import { trpc } from "@/trpc/react";

/** O que a tela precisa dizer ao usuário sobre o estado das notificações. */
type Status =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "on" }
  | { kind: "off" }
  | { kind: "unsupported" }
  | { kind: "denied" }
  | { kind: "error"; message: string };

/**
 * Ativa/desativa os lembretes por Web Push (#36).
 *
 * O estado real mora no navegador (a inscrição do `PushManager`), não no React: por isso o
 * componente **pergunta ao navegador** ao clicar, em vez de tentar espelhar. Uma inscrição
 * pode sumir sem avisar o app — permissão revogada, dados do site limpos —, e um espelho
 * mentiria com toda a confiança.
 */
export function NotificationsToggle() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const subscribe = trpc.push.subscribe.useMutation();
  const unsubscribe = trpc.push.unsubscribe.useMutation();

  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  async function ativar() {
    if (!supported) return setStatus({ kind: "unsupported" });
    setStatus({ kind: "working" });

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setStatus({ kind: "denied" });

      const registration = await navigator.serviceWorker.register(SERVICE_WORKER_PATH);
      await navigator.serviceWorker.ready;

      // Reaproveita a inscrição existente: reinscrever à toa troca o endpoint e deixa a
      // inscrição antiga apodrecendo no banco.
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          // Sem isto o navegador recusa: só aceitamos push que vira notificação visível.
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        }));

      const json = subscription.toJSON();
      if (!json.keys?.p256dh || !json.keys?.auth) {
        return setStatus({ kind: "error", message: "O navegador não devolveu as chaves." });
      }

      await subscribe.mutateAsync({
        endpoint: subscription.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        userAgent: navigator.userAgent.slice(0, 500),
      });

      setStatus({ kind: "on" });
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "Falhou." });
    }
  }

  async function desativar() {
    setStatus({ kind: "working" });
    try {
      const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_PATH);
      const subscription = await registration?.pushManager.getSubscription();

      if (subscription) {
        // Avisa o servidor antes: uma inscrição cancelada só no navegador viraria envio
        // para um endpoint morto na próxima passada do disparo.
        await unsubscribe.mutateAsync({ endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }

      setStatus({ kind: "off" });
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "Falhou." });
    }
  }

  if (!supported) {
    return (
      <p className="text-muted-foreground text-xs">
        Este navegador não recebe notificações. No iPhone, adicione o app à Tela de Início primeiro.
      </p>
    );
  }

  const working = status.kind === "working";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant={status.kind === "on" ? "outline" : "ghost"}
        disabled={working}
        onClick={() => (status.kind === "on" ? desativar() : ativar())}
      >
        {working
          ? "Um instante…"
          : status.kind === "on"
            ? "Desativar lembretes"
            : "Ativar lembretes"}
      </Button>

      {status.kind === "on" && (
        <span className="text-muted-foreground text-xs">Lembretes ligados neste aparelho.</span>
      )}
      {status.kind === "off" && (
        <span className="text-muted-foreground text-xs">Lembretes desligados aqui.</span>
      )}
      {status.kind === "denied" && (
        <span className="text-muted-foreground text-xs">
          A permissão foi negada — para reativar, libere as notificações nas configurações do site.
        </span>
      )}
      {status.kind === "error" && <span className="text-xs text-red-500">{status.message}</span>}
    </div>
  );
}
