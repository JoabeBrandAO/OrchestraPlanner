import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Rotas de página que exigem login. A API (/api/trpc) NÃO é protegida aqui —
// o tRPC faz a própria autorização (protectedProcedure → 401 em JSON).
const isProtectedPage = createRouteMatcher(["/dashboard(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedPage(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Tudo, menos arquivos estáticos e internos do Next.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Sempre roda nas rotas de API/trpc (para popular o auth()).
    "/(api|trpc)(.*)",
  ],
};
