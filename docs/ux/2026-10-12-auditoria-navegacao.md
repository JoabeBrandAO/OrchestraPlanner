# 2026-10-12 — Auditoria do Impeccable: menu fixo, barra inferior e tela de Conta

> `audit` + leitura de `critique`, rodados sobre o resultado **antes** de abrir o PR. Mesma
> régua do [diagnóstico de 2026-10-10](2026-10-10-diagnostico-impeccable.md). Modo da tela:
> *Operate* (quem usa veio fazer uma tarefa). Extensão do visual que já existe: nenhuma fonte ou
> componente novo; uma cor nova só para o menu (`--marcador`, abaixo). O `DESIGN.md` não muda.

## O que foi auditado

- Menu lateral fixo (computador, a partir de 768 px) e barra inferior (celular, abaixo de
  768 px), os dois lendo a mesma lista: `src/app/dashboard/nav-items.ts`.
- Tela de Conta (`/dashboard/conta`): login, preferências e "Seus dados".
- Painel sem os atalhos, sem preferências e sem "Seus dados".
- Mockup da barra escolhida (Pílula), claro e escuro: [`docs/mockups/menu-inferior.html`](../mockups/menu-inferior.html).

**Evidência:** prints em 320, 390, 768 e 1280 px, claro e escuro
([`prints/menu-fixo-conta/`](prints/menu-fixo-conta/)); E2E `e2e/navegacao.spec.ts` (390×844 e
1280×800); medição de rolagem horizontal em 9 telas (0 px em todas); detector do Impeccable nos
arquivos alterados. Tudo em navegador emulado (Chromium); **nada foi testado em iPhone de
verdade**.

## Nota

| # | Dimensão | Nota | Achado principal |
|---|---|---|---|
| 1 | Acessibilidade | 4 | `aria-current` no ativo, foco forte nos dois temas, "Pular para o conteúdo", rótulo em todos os itens |
| 2 | Desempenho | 4 | Nenhum efeito caro; transições de 150–200 ms só em cor e posição |
| 3 | Tema | 4 | Só tokens; folha "Mais" corrigida para a superfície elevada no escuro (achado abaixo) |
| 4 | Responsivo | 3 | Alvos de 56 px, área segura do iPhone tratada, mas não conferida em aparelho real |
| 5 | Integridade | 4 | Uma lista de itens para os dois menus; detector sem achado no código do app |
| **Total** | | **19/20** | **Excelente** |

**Integridade (veredito): passa.** O menu lateral e a barra inferior não brigam: o corte é o
mesmo (`md`), a lista é a mesma e um teste garante que as duas levam às nove telas, sem repetir
e sem link quebrado (confere se cada rota tem `page.tsx`).

## Achados

- **[P2, corrigido] Folha "Mais" sumia no escuro.** O fundo era o mesmo da página e se misturava
  ao véu. Passou para `bg-popover` (superfície elevada).
- **[P2, aberto] Área segura do iPhone sem teste em aparelho.** O `viewport-fit=cover` (só na área
  autenticada) e os recuos `env(safe-area-inset-*)` estão no código e o `<meta viewport>` sai
  certo, mas o efeito real (barra acima do indicador de início, conteúdo abaixo da barra de
  status no app instalado) só se vê no iPhone. **Tarefa do dono, ~10 min.**
- **[P3, aberto] "Mais" não diz ao leitor de tela qual tela está dentro dele.** O botão acende
  quando a tela atual mora na folha, e a folha marca a tela com `aria-current`; o botão em si
  não anuncia. Baixo impacto: o título da página (`h1`) já diz onde se está.
- **[P3, observação] Grupos "Norte" e "Cuidar"** usam o vocabulário do dono. Na Fase 2 (SaaS),
  rever com quem não conhece o planner.
- **Detector:** um aviso, `overused-font` (Geist), só no mockup. A Geist é a fonte do app desde a
  Iteração 0 e foi consertada em 2026-10-10; trocar de fonte está fora desta tarefa.

## Leitura de critique (heurísticas que mudaram)

- **Visibilidade do estado:** o ativo é marcado por forma (pílula ou fundo sólido), cor e
  negrito, igual no celular e no computador. Antes não havia "onde estou" fora do título.
- **Reconhecer em vez de lembrar:** todos os destinos à vista no computador; no celular, 4 + "Mais",
  todos com nome. Antes, trocar de módulo era voltar ao painel.
- **Uma tela, uma tarefa (achado 12):** o painel ficou só com o panorama; Conta tem o resto.
- **Linha de "Seus dados":** de ~114 para ~75 caracteres (`max-w-prose`).

## Decisões

- **Estilo da barra: Pílula**, escolhido pelo dono em 2026-10-12 entre Pílula, Traço e Botão
  central. Só a Pílula ficou no código.
- **A pílula é o marcador de página do planner** (`--marcador`): couro de capa no claro
  (`oklch(0.4 0.075 45)`), papel no escuro (`oklch(0.87 0.03 80)`). Conversa com o jeito de
  caderno do app e com a família quente das dimensões, sem ser nenhuma delas. Contraste: pílula
  ≥ 9:1 contra o fundo e ícone ≥ 8,8:1 sobre ela, nos dois temas. O menu lateral e a folha "Mais"
  usam o mesmo marcador. Os prints `depois-*` desta pasta foram tirados com a pílula na versão
  final, menos `depois-agenda-desktop-escuro`, `depois-conta-*`, `depois-foco-*` e
  `depois-prioridades-768`, que mostram a primeira versão (pílula preta/branca); a forma é a mesma.
- **Metas na barra, Financeiro no "Mais"**, porque a meta é o centro (`PRODUCT.md`). Se o uso no
  celular for mais lançar gasto do que olhar meta, trocar é mudar a lista `MOBILE_PRIMARY`.
- **Cores das dimensões fora do menu:** terracota no item ativo faria "estou aqui" parecer
  "Corpo". Elas aparecem só na marca (os três pontos) e onde significam a dimensão.
- **Sugestões fora da barra (não aplicadas, a pedido do dono):** levar o `--marcador` a outros
  "você está aqui" do app (aba Semana/Mês da Agenda, filtros); revisar o peso dos cartões com
  borda em todas as telas. Ficam para quando a direção visual for reavaliada.
- **O avatar do Clerk saiu do painel.** "Gerenciar login" e "Sair" moram na Conta, que é o único
  lugar de conta do app. A janela do Clerk entrou na varredura de CSP do E2E.
