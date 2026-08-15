/**
 * Web Push (#36) — o que o navegador e o servidor precisam saber em comum.
 *
 * **A chave pública VAPID é pública por design**: ela vai para o navegador em toda
 * inscrição e é enviada ao serviço de push. Ficar no código é o lugar certo dela — evita
 * uma variável de ambiente a mais e mantém a build determinística. O par privado é o
 * segredo, e vive só no `VAPID_PRIVATE_KEY` do disparo (GitHub Secrets).
 */
export const VAPID_PUBLIC_KEY =
  "BNG2Gg2uoAENxxaKWnOJoeVbGz22q3xoikWIxyz2iLYxiZPGrOMMUwqlj-30g-VFjK5h141qAyeWM5DFLNknq7c";

/** Identifica quem envia, exigido pelo protocolo VAPID. */
export const VAPID_SUBJECT = "mailto:joabebrandao@gmail.com";

export const SERVICE_WORKER_PATH = "/sw.js";

/**
 * A chave viaja em base64url e o `PushManager` quer bytes. A conversão é chata o
 * suficiente para merecer nome próprio: base64url troca `-_` por `+/` e não leva padding.
 */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);

  // Buffer explícito: o `PushManager` exige um `ArrayBuffer` de verdade, e o tipo genérico
  // do `Uint8Array` admite `SharedArrayBuffer`, que ele não aceita.
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}
