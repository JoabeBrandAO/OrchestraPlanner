import { verifyWebhook, type WebhookEvent } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";

import { deleteUserData, provisionUser } from "@/server/services/users/provisioning";

/**
 * Webhook do Clerk (#73): é aqui que o usuário nasce, muda e deixa de existir no banco.
 *
 * A assinatura (Svix) é verificada com `CLERK_WEBHOOK_SIGNING_SECRET`. **Sem o segredo, tudo é
 * recusado**: rota que apaga conta não pode aceitar requisição que ninguém assinou. Por isso
 * a rota nem existe na prática até o segredo ser cadastrado — e `ensureUserRecord()` segue
 * como rede de segurança para o provisionamento.
 */
export async function POST(request: NextRequest): Promise<Response> {
  let event: WebhookEvent;
  try {
    event = await verifyWebhook(request);
  } catch {
    return new Response("Assinatura inválida.", { status: 400 });
  }

  switch (event.type) {
    case "user.created":
    case "user.updated": {
      const data = event.data;
      const email =
        data.email_addresses.find((address) => address.id === data.primary_email_address_id)
          ?.email_address ??
        data.email_addresses[0]?.email_address ??
        "";
      const name = [data.first_name, data.last_name].filter(Boolean).join(" ") || null;
      await provisionUser({ id: data.id, email, name });
      break;
    }
    case "user.deleted": {
      // O `on delete cascade` leva todo o resto: lançamentos, pessoas, agenda, metas.
      if (event.data.id) await deleteUserData(event.data.id);
      break;
    }
    default:
      // Evento que não nos interessa: 2xx, senão o Clerk reentrega para sempre.
      break;
  }

  return new Response(null, { status: 204 });
}
