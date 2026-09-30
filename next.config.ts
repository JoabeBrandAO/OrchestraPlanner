import type { NextConfig } from "next";

/**
 * Cabeçalhos de segurança (#71).
 *
 * A aplicação é autenticada e mostra extrato bancário na tela; até aqui ela respondia sem
 * nenhum cabeçalho de proteção. Estes valem para **todas** as rotas.
 */
const securityHeaders = [
  // HTTPS obrigatório por dois anos, subdomínios inclusos. A Vercel só serve HTTPS, então
  // isto não muda o que funciona hoje — fecha a janela do primeiro acesso por HTTP.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Impede o navegador de "adivinhar" o tipo de um arquivo e executar como script algo que
  // foi servido como texto.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // A URL do painel carrega identificadores; para fora do site, só a origem viaja.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nenhum site pode embutir o app num iframe (clickjacking). O `frame-ancestors` da CSP
  // diz o mesmo para navegadores modernos; este cobre os antigos.
  { key: "X-Frame-Options", value: "DENY" },
  // O app não usa câmera, microfone, localização nem pagamento — negar é mais barato do
  // que confiar que nunca vai usar por engano.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

/*
 * A política de conteúdo (CSP) não mora aqui: ela precisa de um **nonce por requisição**, e
 * cabeçalho estático não tem como carregar isso. Quem a emite é o middleware (`src/middleware.ts`,
 * #92), já obrigatória.
 */

const nextConfig: NextConfig = {
  // O `X-Powered-By: Next.js` só serve para dizer a um atacante por onde começar.
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
