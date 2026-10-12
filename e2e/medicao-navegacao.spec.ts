import { expect, test } from "@playwright/test";

import { signIn } from "./sign-in";

/**
 * MEDIÇÃO (descartável, não vai para a main): quanto tempo passa entre o toque numa aba da
 * barra inferior e (a) a pílula mudar, (b) a área de conteúdo mudar de qualquer jeito
 * (esqueleto incluído) e (c) o título da tela de destino aparecer.
 *
 * Celular simulado: 390×844, rede com 150 ms de latência e ~10 Mbps, CPU 4× mais lenta.
 * Cada toque é feito por `link.click()` dentro da página, para o relógio de partida ser
 * exatamente o do evento `click` (sem a espera de ação do Playwright).
 */
const hasClerkKey = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
const hasTestUser = Boolean(process.env.E2E_CLERK_EMAIL && process.env.E2E_CLERK_PASSWORD);

const ABAS: { nome: string; titulo: string }[] = [
  { nome: "Prioridades", titulo: "^Prioridades$" },
  { nome: "Agenda", titulo: "^Agenda$" },
  { nome: "Metas", titulo: "^Metas$" },
  { nome: "Painel", titulo: "^Olá" },
];

type Marcas = { pilula: number | null; conteudo: number | null; titulo: number | null };

test.describe("medição da navegação no celular", () => {
  test.skip(!hasClerkKey || !hasTestUser, "Requer as chaves do Clerk e o usuário de teste.");

  test("tempo do toque até a pílula, o conteúdo e o título", async ({ page, context }) => {
    test.setTimeout(240_000);
    await signIn(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");
    await expect(page.locator("main h1")).toContainText(/olá/i);

    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 150,
      downloadThroughput: (10 * 1024 * 1024) / 8,
      uploadThroughput: (4 * 1024 * 1024) / 8,
    });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

    // Deixa o prefetch dos links da barra terminar, como acontece com quem olha a tela.
    await page.waitForTimeout(4000);

    const linhas: string[] = [];
    for (let rodada = 1; rodada <= 4; rodada++) {
      for (const aba of ABAS) {
        const m = await page.evaluate(
          ([nome, titulo]) =>
            new Promise<Marcas>((resolve) => {
              const navs = [
                ...document.querySelectorAll('nav[aria-label="Navegação principal"]'),
              ];
              const nav = navs.find((n) => getComputedStyle(n).display !== "none")!;
              const link = [...nav.querySelectorAll("a")].find(
                (a) => a.textContent?.trim() === nome,
              )!;
              const conteudo = document.getElementById("conteudo")!;
              const re = new RegExp(titulo);
              const t0 = performance.now();
              const m: Marcas = { pilula: null, conteudo: null, titulo: null };
              const olhar = (records?: MutationRecord[]) => {
                const agora = performance.now() - t0;
                if (m.pilula === null && link.querySelector('[data-slot="marcador"]')) {
                  m.pilula = agora;
                }
                if (
                  m.conteudo === null &&
                  records?.some((r) => r.type === "childList" && conteudo.contains(r.target))
                ) {
                  m.conteudo = agora;
                }
                const h1 = document.querySelector("main h1");
                if (m.titulo === null && h1 && re.test(h1.textContent ?? "")) {
                  m.titulo = agora;
                }
                if (m.pilula !== null && m.conteudo !== null && m.titulo !== null) {
                  obs.disconnect();
                  resolve(m);
                }
              };
              const obs = new MutationObserver((r) => olhar(r));
              obs.observe(document.body, {
                subtree: true,
                childList: true,
                attributes: true,
                characterData: true,
              });
              setTimeout(() => {
                obs.disconnect();
                resolve(m);
              }, 20000);
              link.click();
            }),
          [aba.nome, aba.titulo] as const,
        );
        const f = (v: number | null) => (v === null ? "NA" : v.toFixed(0));
        linhas.push(
          `MEDICAO|rodada=${rodada}|aba=${aba.nome}|pilula=${f(m.pilula)}|conteudo=${f(m.conteudo)}|titulo=${f(m.titulo)}`,
        );
        // Espera a tela assentar (consultas do cliente, prefetch) antes do próximo toque.
        await page.waitForTimeout(2500);
      }
    }
    console.log(linhas.join("\n"));
  });
});
