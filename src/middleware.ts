import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Rotas de página que exigem login. A API (/api/trpc) NÃO é protegida aqui —
// o tRPC faz a própria autorização (protectedProcedure → 401 em JSON).
const isProtectedPage = createRouteMatcher(["/dashboard(.*)"]);

export default clerkMiddleware(
  async (auth, req) => {
    if (isProtectedPage(req)) {
      await auth.protect();
    }
  },
  {
    /**
     * CSP **obrigatória**, com nonce por requisição (#92). Quem monta é o Clerk: ele tira o
     * domínio do Frontend API da chave publicável — o de desenvolvimento e o de produção são
     * diferentes, e escrever a lista à mão foi exatamente o risco que manteve a política em
     * Report-Only na #71.
     *
     * `strict` põe `'strict-dynamic'` + `'nonce-…'` em `script-src`: só roda script que o
     * servidor assinou nesta resposta (ou que um script assinado carregou). O `'unsafe-inline'`
     * que o Clerk mantém na lista é só recuo para navegador de CSP nível 1 — pela especificação,
     * navegador que entende nonce **ignora** `'unsafe-inline'` quando há nonce.
     *
     * As diretivas abaixo somam ao padrão do Clerk o que o app usa além dele.
     */
    contentSecurityPolicy: {
      strict: true,
      directives: {
        // Ícones gerados, radar em SVG e avatar do Clerk.
        "img-src": ["data:", "blob:"],
        "font-src": ["self", "data:"],
        // O manifest do PWA (Web Push no iPhone, #36).
        "manifest-src": ["self"],
        // Ninguém embute o app num iframe (clickjacking).
        "frame-ancestors": ["none"],
        "base-uri": ["self"],
        "object-src": ["none"],
      },
    },
  },
);

export const config = {
  matcher: [
    // Tudo, menos arquivos estáticos e internos do Next.
    "/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Sempre roda nas rotas de API/trpc (para popular o auth()).
    "/(api|trpc)(.*)",
  ],
};
