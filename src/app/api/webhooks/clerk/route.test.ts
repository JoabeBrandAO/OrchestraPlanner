import { NextRequest } from "next/server";
import { Webhook } from "standardwebhooks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Webhook do Clerk (#73) — a porta de entrada, sem banco. O que ela faz no banco é testado em
 * `provisioning.test.ts`; aqui se prova que **só requisição assinada** chega até lá.
 */
vi.mock("@/server/services/users/provisioning", () => ({
  provisionUser: vi.fn(),
  deleteUserData: vi.fn(),
}));

const { deleteUserData, provisionUser } = await import("@/server/services/users/provisioning");
const { POST } = await import("./route");

// Segredo só de teste, no formato do Clerk (`whsec_` + base64).
const SECRET = `whsec_${Buffer.from("segredo-de-teste-do-webhook-32by").toString("base64")}`;

function signed(body: object, secret = SECRET): NextRequest {
  const payload = JSON.stringify(body);
  const id = `msg_${Math.random().toString(36).slice(2)}`;
  const timestamp = new Date();
  const signature = new Webhook(secret).sign(id, timestamp, payload);
  return new NextRequest("http://localhost/api/webhooks/clerk", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "svix-id": id,
      "svix-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
      "svix-signature": signature,
    },
    body: payload,
  });
}

const userData = {
  id: "user_abc",
  first_name: "Ana",
  last_name: "Souza",
  primary_email_address_id: "idn_2",
  email_addresses: [
    { id: "idn_1", email_address: "antigo@exemplo.com" },
    { id: "idn_2", email_address: "ana@exemplo.com" },
  ],
};

describe("POST /api/webhooks/clerk", () => {
  beforeEach(() => {
    vi.stubEnv("CLERK_WEBHOOK_SIGNING_SECRET", SECRET);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("recusa requisição sem assinatura, e nada chega ao banco", async () => {
    const request = new NextRequest("http://localhost/api/webhooks/clerk", {
      method: "POST",
      body: JSON.stringify({ type: "user.deleted", data: { id: "user_abc" } }),
    });
    expect((await POST(request)).status).toBe(400);
    expect(deleteUserData).not.toHaveBeenCalled();
  });

  it("recusa assinatura feita com outro segredo", async () => {
    const outro = `whsec_${Buffer.from("outro-segredo-qualquer-de-32-byt").toString("base64")}`;
    const response = await POST(signed({ type: "user.deleted", data: { id: "user_abc" } }, outro));
    expect(response.status).toBe(400);
    expect(deleteUserData).not.toHaveBeenCalled();
  });

  it("sem o segredo configurado, recusa tudo — inclusive o que viria assinado", async () => {
    const request = signed({ type: "user.deleted", data: { id: "user_abc" } });
    vi.stubEnv("CLERK_WEBHOOK_SIGNING_SECRET", "");
    expect((await POST(request)).status).toBe(400);
    expect(deleteUserData).not.toHaveBeenCalled();
  });

  it("user.created provisiona com o e-mail **principal**, não o primeiro da lista", async () => {
    const response = await POST(signed({ type: "user.created", data: userData }));
    expect(response.status).toBe(204);
    expect(provisionUser).toHaveBeenCalledWith({
      id: "user_abc",
      email: "ana@exemplo.com",
      name: "Ana Souza",
    });
  });

  it("user.deleted apaga o dado do usuário", async () => {
    const response = await POST(signed({ type: "user.deleted", data: { id: "user_abc" } }));
    expect(response.status).toBe(204);
    expect(deleteUserData).toHaveBeenCalledWith("user_abc");
  });

  it("evento que não interessa responde 2xx, senão o Clerk reentrega para sempre", async () => {
    const response = await POST(signed({ type: "session.created", data: { id: "sess_1" } }));
    expect(response.status).toBe(204);
    expect(provisionUser).not.toHaveBeenCalled();
    expect(deleteUserData).not.toHaveBeenCalled();
  });
});
