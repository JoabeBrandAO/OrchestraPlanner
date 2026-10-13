# 2026-10-12 — Barra mais alta, gaveta do Mais e resposta ao toque

Pedido do dono, depois de testar a barra inferior no celular: (1) barra 10% mais alta,
(2) "Mais" como gaveta que fecha arrastando, (3) "tempo de resposta lento" ao tocar nas abas.

## O que mudou

| Item | Antes | Depois |
|---|---|---|
| Alvo de cada lugar da barra | 56 px | 62 px (pílula 56×28 → 62×31, ícone 20 → 22 px) |
| Altura da barra (com a borda) | 61 px | 67 px (+9,8%) |
| Recuo do conteúdo (layout) | 4,5 rem | 5 rem (a barra cobriria só 67 px; sobra folga) |
| Rótulo | 11 px | 11 px (de propósito: "Prioridades" mede 62 px e a coluna tem 70 px em tela de 360) |
| "Mais" | `Dialog` com `translate-y-full` | `Drawer` do `@base-ui/react` 1.8.0 (já instalado, sem dependência nova) |
| Animação da gaveta | 200 ms | 240 ms, `ease-out`, sem animação em `prefers-reduced-motion` |
| Fechar a gaveta | Esc, fundo, rota | + arrastar para baixo; o fundo clareia junto |
| Toque numa aba | pílula só muda quando a rota muda | muda no toque (`aria-current` segue a rota real) |
| `loading.tsx` | nenhum | 5 arquivos + `page-skeleton.tsx` (mesma largura de cada tela) |

## Gaveta: limite do arrasto (diferença em relação ao pedido)

O `Drawer` do Base UI decide sozinho, e o limite **não é configurável**: fecha se a folha passar
de **50% da altura do popup** (que inclui 3 rem de "sobra" embaixo, então ≈ 58% da parte visível)
**ou** se o gesto for rápido (≥ 0,5 px/ms). O pedido era ~30%.

Medido no navegador (folha com 294 px visíveis): arrasto lento de 100 px e de 150 px volta ao
lugar; arrasto lento de 200 px fecha; gesto de 60 px em 80 ms fecha. Os testes de
`app-nav.test.tsx` fixam esse comportamento, para uma atualização da biblioteca não mudá-lo sem
aviso. Se no celular a folha parecer "dura", o caminho é trocar por implementação própria com
30% (o preço: reescrever o que o Base UI já resolve — rolagem × arrasto, iOS, foco).

## Lentidão: medição

**Região.** `x-vercel-id` da produção: `gru1::iad1` — borda em São Paulo, **função em Washington
(iad1)**, que é o padrão da Vercel (não existe `vercel.json`). O host do `DATABASE_URL` do `.env`
local é `us-east-1` (Neon, Virgínia), vizinho do iad1. **Estão alinhadas**, então não mexi em
`regions`. (O valor da variável na Vercel não é legível daqui; usei o do `.env`.)

**Piso de rede a partir de Brasília** (Node, conexão reaproveitada, 12 amostras):

| Pedido | Mediana |
|---|---|
| Arquivo estático na borda (gru1) | 38 ms |
| `/dashboard` deslogado (borda → função em iad1 → middleware do Clerk → 404) | 205 ms (mín. 181) |

Ou seja, **cada ida ao servidor custa ~165 ms só de distância até Washington**, antes de o banco
ou o React fazerem qualquer coisa. Essa é a causa estrutural.

**Por tela** (código): o servidor faz 1 `select` (4 comandos numa transação: `BEGIN`,
`set_config`, `select`, `COMMIT`) em `ensureUserRecord`, mais `currentUser()` no Painel; os dados
vêm depois, do cliente, por tRPC (Prioridades 4 consultas, Agenda 4, Pessoas 5, Financeiro 8,
Metas 3, Roda 3, Áreas 1, Conta 1) — uma segunda ida e volta depois da primeira. `<Link>` com
prefetch automático: **a documentação do Next 16.4 diz que rota dinâmica sem `loading.js` não é
prefetchada**, e todas as telas são `force-dynamic`. Sem prefetch e sem esqueleto, o Next só troca
a tela (e a URL, e a pílula, que lia `usePathname`) quando a resposta inteira chega.

**Cronometragem em ponta a ponta** (E2E no CI, build de produção, banco Neon real, Chromium em
390×844 com 150 ms de latência, ~10 Mbps e CPU 4× mais lenta; toque por `link.click()` dentro da
página; 4 rodadas por aba; rodadas 2–4 = "uso normal", 12 amostras):

| Do toque até… | Antes (mediana / máx.) | Depois (mediana / máx.) |
|---|---|---|
| a pílula mudar | 186 ms / 195 | **5 ms / 8** |
| a tela mudar de qualquer jeito (esqueleto incluído) | 186 ms / 195 | **26 ms / 34** |
| o título da tela nova aparecer | 186 ms / 195 | 326 ms / 399 |
| primeira visita de cada aba (rodada 1): pílula / título | 348–403 / 348–403 | 7–15 / 384–442 |

**O custo, dito com todas as letras:** o conteúdo pronto chega ~140 ms **depois** do que chegava.
Não é a rede nem o servidor: é o React 19, que depois de mostrar um esqueleto (fallback do
`Suspense`) segura o conteúdo até 300 ms desde que o esqueleto apareceu, para a tela não piscar
(`globalMostRecentFallbackTime + 300` em `react-dom`). Em rede mais lenta que a emulada
(a real, do celular, soma mais 40–100 ms ao 205 ms medido) o conteúdo chega depois dos 300 ms e a
espera some. A troca vale: o toque deixa de parecer ignorado (5 ms em vez de ~190–400 ms) ao custo
de um conteúdo até ~140 ms mais tardio numa rede boa.

## Opções que ficam com o dono (não feitas)

1. **Mover Vercel (`gru1`) e Neon (`sa-east-1`) para São Paulo juntos**: corta ~165 ms de cada
   pedido (navegação e tRPC). Só a função sem o banco seria pior (cada um dos 4 comandos da
   transação pagaria a ida a Virgínia). Exige migrar o banco (dump/restore e troca de
   `DATABASE_URL`/`MIGRATION_DATABASE_URL`), então é decisão e janela do dono.
2. **`experimental.staleTimes.dynamic: 30`** no `next.config.ts`: tela visitada há menos de 30 s
   abre sem ir ao servidor (some o esqueleto e os ~330 ms). É experimental no Next 16.4 e o
   padrão voltou a 0 de propósito na v15; os dados vêm por tRPC, então o risco é pequeno, mas
   não liguei sem pedido.
3. **Limite do arrasto em 30%** com implementação própria (ver acima).

## Testes

- `app-nav.test.tsx`: 9 → 25 casos (pílula otimista, pendente expira ao mudar a rota e em 8 s,
  Ctrl/Cmd não conta, gaveta fecha por Esc / fundo / rota, foco volta ao botão, limite do
  arrasto lento/rápido/curto, fundo acompanha o arrasto). O primeiro rascunho tinha um defeito
  que o teste pegou: o "pendente" ficava guardado com a rota de origem e **reacendia a aba
  tocada quando o usuário voltava para essa rota** (voltar do navegador); agora ele cai na
  mesma renderização em que a rota muda.
- `page-skeleton.test.tsx`: esqueleto sem `h1`/`main`, `role="status"`, e a largura de cada
  `loading.tsx` bate com o `max-w-*` da página que ele substitui.
- E2E (`navegacao.spec.ts`): alvo da barra ≥ 62 px e um passo novo — com o servidor atrasado em
  3 s, a pílula muda em ≤ 1 s e o esqueleto aparece em ≤ 1,5 s; `aria-current` só muda quando a
  tela chega.
- Typecheck, lint (0 erros) e prettier limpos; `next build` ok. No `vitest` local só falham os
  testes de banco que estouram 30 s contra o Neon a partir do Brasil (já registrado em
  `docs/ERROS.md`; passam no CI com Postgres local).

## Como a medição foi feita (reproduzir)

O spec de medição **não entrou na `main`**: `e2e/medicao-navegacao.spec.ts` vive nos ramos
descartáveis `chore/medicao-antes` (código da `main`) e `tmp/medicao-depois` (ramo da feature +
o spec). O `e2e.yml` desses ramos roda só ele (`workflow_dispatch`). Primeira tentativa falhou por
defeito meu no spec (escolhia o `<nav>` do menu lateral, que existe escondido, e a pílula nunca
aparecia): cada toque esperava 20 s e o teste estourou o tempo. Corrigido com
`getClientRects().length > 0` para pegar o `nav` visível.
