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

/**
 * Política de conteúdo em **Report-Only**, de propósito.
 *
 * O Clerk carrega script de terceiro (e o desafio anti-bot da Cloudflare), então uma CSP
 * obrigatória escrita às cegas quebraria o login em produção — e login quebrado por
 * cabeçalho é o tipo de falha que só aparece com o usuário na porta. Em Report-Only o
 * navegador **relata** a violação sem bloquear nada; depois de observar o que aparece no
 * console em uso real, ela vira obrigatória (issue de seguimento).
 *
 * `'unsafe-inline'` em `script-src` está aqui porque o Next injeta scripts inline de
 * hidratação; a saída correta é nonce por requisição, e isso entra junto com a promoção
 * para obrigatória.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://img.clerk.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com",
  "worker-src 'self' blob:",
  "frame-src https://challenges.cloudflare.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // O `X-Powered-By: Next.js` só serve para dizer a um atacante por onde começar.
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [...securityHeaders, { key: "Content-Security-Policy-Report-Only", value: csp }],
      },
    ];
  },
};

export default nextConfig;
