# Diagnóstico de UI/UX com o Impeccable — 2026-10-10

> ⚠️ **DEGRADED: single-context** — o `critique` do Impeccable pede duas avaliações em
> subagentes isolados (revisão de design e detector). Esta sessão rodou como subagente, sem
> licença para abrir outros; as duas avaliações foram feitas em sequência, a de design
> primeiro, o detector depois, e só então juntadas.
>
> **Perguntas do `critique` puladas:** o brief do dono já respondeu prioridade e escopo
> (corrigir o que tem maior impacto ÷ esforço, no máximo 5 PRs, só UI/UX).

## Como foi feito

- **Contexto:** [PRODUCT.md](../../PRODUCT.md), escrito no `init` a partir da Visão do
  Produto (sem entrevista ao vivo; inferências marcadas lá).
- **Telas:** landing, login, painel (que hoje também é a tela de configurações e conta),
  Metas, Prioridades, Agenda, Pessoas, Financeiro, Áreas de Vida e Roda da Vida — em
  1280×800 e 390×844, com o build de produção local e o usuário de teste do Clerk de
  desenvolvimento (`e2e/ux-prints.spec.ts`).
- **Detector:** `impeccable detect src` (varredura estática, **0** achados) e o `detect.js`
  injetado em cada tela renderizada (achados abaixo). O detector estático não vê CSS de
  tema nem dado vindo do servidor — o defeito mais grave (fonte) só apareceu no print.
- **Limite:** o usuário de teste não tem metas, pessoas nem lançamentos. Listas cheias,
  cartões do Kanban e o extrato foram avaliados pelo código, não pelo print.

## Nota técnica (audit) — 11/20, "aceitável"

| # | Dimensão | Nota | Achado principal |
|---|---|---|---|
| 1 | Acessibilidade | 2 | Vermelho e verde abaixo de 4,5:1; erro de formulário não é anunciado ao leitor de tela |
| 2 | Performance | 3 | Sem problema visível; carregamento só em texto ("Carregando…") |
| 3 | Tema | 2 | 35 usos de cor fixa (`red-500`, `emerald-600`); tema escuro definido e nunca ligado |
| 4 | Responsivo | 2 | Roda da Vida estoura a largura no celular; botões de 28–32 px de altura |
| 5 | Integridade | 2 | Fonte do app nunca carregou; 19 cópias da mesma classe de campo; ID interno na tela |

**Veredito de integridade: reprova.** O sistema é o tema neutro do shadcn sem nenhuma
decisão própria — e nem ele chega inteiro: a variável da fonte aponta para si mesma
(`--font-sans: var(--font-sans)` em `globals.css`), então o navegador cai na fonte padrão
(Times New Roman) em **todas** as telas, inclusive no login do Clerk.

## Heurísticas (critique) — 19/40, "fraco"

| # | Heurística | Nota | Problema-chave |
|---|---|---|---|
| 1 | Visibilidade do estado | 2 | Salvar não confirma nada; carregamento só em texto |
| 2 | Linguagem do usuário | 2 | Login inteiro em inglês; "Outubro De 2026", "Segunda-Feira, 05 De Out."; "API ok" |
| 3 | Controle e liberdade | 2 | Sem desfazer; a única saída de cada tela é "← Dashboard" |
| 4 | Consistência | 2 | "Remover" ora discreto, ora vermelho; cada formulário copia o próprio estilo de campo |
| 5 | Prevenção de erro | 1 | Um clique em "Remover" apaga uma conta **com todos os lançamentos**, sem perguntar |
| 6 | Reconhecer em vez de lembrar | 2 | Nenhuma tela mostra onde você está nem para onde ir, fora o painel |
| 7 | Flexibilidade | 1 | Nenhum atalho; tudo passa pelo painel |
| 8 | Estética e minimalismo | 2 | Painel mistura panorama, preferências, LGPD e um ID técnico; fonte serifada de sistema |
| 9 | Recuperação de erro | 2 | Mensagem do servidor crua, em vermelho de baixo contraste, sem `role="alert"` |
| 10 | Ajuda | 3 | Boas dicas em linha (categorias, Roda da Vida, Seus dados) |

**Especificidade de design:** a estrutura é intercambiável — trocando os textos, serviria a
qualquer CRUD. O que é do produto (Corpo / Alma / Espírito, a Roda como diagnóstico, o "há
quanto tempo não falo com X") vive só na cópia, não na forma. Isso não é defeito para
corrigir nesta rodada: é a decisão de identidade visual que ainda não foi tomada (ver
"Decisões do dono").

**O que está bom:** o padrão de "novo registro" em janela é o mesmo em todo módulo; os
estados vazios convidam à ação certa ("Comece pela Roda da Vida"); a cópia é humana e em
pt-BR; `aria-expanded`, `aria-pressed` e barras de progresso com `role="progressbar"` já
estão no lugar.

## Detector nas telas renderizadas (1280×800)

| Tela | Regra | Detalhe |
|---|---|---|
| Painel | `low-contrast` | botão "Apagar minha conta": `#e7000b` sobre `#fde6e7`, 4,0:1 |
| Painel | `line-length` | ~114 caracteres por linha em "Seus dados" (alvo < 80) |
| Financeiro | `low-contrast` | "Entradas" `#009966` sobre branco, 3,7:1 |
| Financeiro | `low-contrast` | "Saídas" `#fb2c36` sobre branco, 3,8:1 |
| Roda da Vida | `tiny-text` | rótulos do radar com 7 px (4 ocorrências) |

Sem falso positivo. Landing, Metas, Prioridades, Agenda, Pessoas e Áreas: nenhum achado (com
as telas vazias, o detector tem pouco o que medir).

## Achados priorizados por impacto ÷ esforço

Impacto de 1 (cosmético) a 5 (perda de dado ou tela inteira afetada). Esforço em horas de
trabalho, incluindo teste e print.

| # | Tela | Problema | Impacto | Esforço (h) | Imp.÷esf. | Regra do Impeccable |
|---|---|---|---|---|---|---|
| 1 | Todas | Fonte do app nunca carregou: tudo em Times New Roman | 5 | 0,25 | 20 | audit · integridade; craft-floor "superfícies do navegador" |
| 2 | Login e menu da conta | Componentes do Clerk em inglês ("Sign in", "Continue") | 4 | 0,5 | 8 | critique · heurística 2 (linguagem do usuário) |
| 3 | Roda da Vida | Estoura a largura no celular (435 px numa tela de 390); rótulos do radar cortados e com 7 px | 4 | 1 | 4 | audit · responsivo (rolagem horizontal); detector `tiny-text` |
| 4 | Painel | "API ok · user_…": ID interno do Clerk na tela de todo dia | 3 | 0,25 | 12 | critique · heurística 8; audit · integridade (conteúdo de depuração) |
| 5 | Agenda, Financeiro | Maiúscula errada em data: "Outubro De 2026", "Segunda-Feira, 05 De Out." | 2 | 0,5 | 4 | critique · heurística 2; craft-floor "cópia na língua do produto" |
| 6 | Painel, Financeiro, formulários | Vermelho (3,8:1) e verde (3,7:1) reprovam AA; erro sem `role="alert"` | 4 | 1,5 | 2,7 | audit · acessibilidade (contraste ≥ 4,5:1) e tema (cor fixa) |
| 7 | Financeiro, Pessoas, Áreas | Um clique apaga em cascata: conta → lançamentos; pessoa → contatos, convívio, vínculos; área → histórico da Roda | 5 | 2 | 2,5 | critique · heurística 5 (prevenção de erro) |
| 8 | Estados vazios | Emoji no lugar de ícone (✨ 💰 👥 🎂) e setas Unicode (← →) como ícone | 1 | 0,5 | 2 | craft-floor "glifo Unicode ou emoji no lugar de ícone" |
| 9 | Todas as internas | Sem navegação persistente; trocar de módulo exige voltar ao painel; painel com 7 botões de mesmo peso | 4 | 2,5 | 1,6 | critique · carga cognitiva ("navegação escondida"), heurística 6; operate "navegação padrão" |
| 10 | Todas (celular) | Botões de 28–32 px de altura (alvo de toque recomendado: 44 px) | 3 | 2 | 1,5 | audit · responsivo (alvos de toque) |
| 11 | Financeiro | Sem conta, mostra 5 blocos vazios e um gráfico de zeros | 2 | 1,5 | 1,3 | onboard · estado vazio; carga cognitiva (revelação progressiva) |
| 12 | Painel | Preferências e "Seus dados" (LGPD) no meio do panorama do dia | 2 | 1 | 2 | critique · heurística 8; operate "uma tela, uma tarefa" |
| 13 | Formulários | 19 cópias da mesma classe de campo (`inputClass`) | 2 | 2 | 1 | audit · integridade (deriva do design system) |
| 14 | Pessoas | Cada linha com 6 botões; "Remover" vermelho em todas | 2 | 2 | 1 | critique · carga cognitiva (≤ 4 opções por decisão) |
| 15 | Todas | Carregamento só em texto, sem esqueleto | 1 | 2 | 0,5 | operate "esqueleto, não spinner no meio do conteúdo" |

## O que entra nesta rodada (5 PRs)

| PR | Tema | Achados |
|---|---|---|
| 1 | `ux/tipografia` | 1 e 5 — fonte do app e caixa das datas |
| 2 | `ux/login-pt-br` | 2 — Clerk em português |
| 3 | `ux/roda-da-vida` | 3 — largura no celular e radar legível |
| 4 | `ux/contraste` | 6 e 4 — cores semânticas com contraste AA, erro anunciado, painel sem ID técnico |
| 5 | `ux/confirmar-exclusao` | 7 — confirmação antes de apagar o que leva outros dados junto |

## O que fica de fora, e por quê

- **9 (navegação persistente)** — o maior ganho estrutural que sobra, mas tem a menor razão
  impacto ÷ esforço do grupo de cima e mexe em todas as telas. Merece rodada própria,
  junto com o **12** (tirar Preferências e "Seus dados" do painel para uma tela de Conta).
- **10 (alvos de toque)** — mexer no tamanho padrão do botão muda a densidade de todas as
  telas; precisa ser decidido junto com a navegação para o celular.
- **8, 11, 13, 14, 15** — razão abaixo de 2 ou impacto baixo; ficam no backlog de UX.

## Pendências que não são só de UI

Nenhum achado desta rodada exigiu mudar regra de negócio, schema, RLS, rota de API, CSP ou
variável de ambiente. Duas observações para quando houver rodada de produto:

- **Desfazer em vez de confirmar.** A confirmação (PR 5) é o remédio de UI. O remédio melhor
  — apagar "macio" com desfazer por alguns segundos — exige mudar schema e serviço.
- **Remover área de vida apaga o histórico da Roda da Vida daquela área** (`on delete
  cascade` em `life_assessments`). A tela agora avisa, mas talvez a regra devesse ser outra
  (arquivar a área em vez de apagar).

## Decisões do dono

1. **Identidade visual.** Hoje é o tema neutro do shadcn. Quer uma identidade própria
   (cor por dimensão Corpo / Alma / Espírito, tipografia de marca)? Isso é `/impeccable
   shape` + `document`, não polimento.
2. **Tema escuro.** Os tokens existem; nada liga a classe `.dark`. Seguir o sistema
   operacional, ter um botão, ou apagar os tokens?
3. **Próxima rodada de UX:** navegação persistente + tela de Conta (achados 9 e 12),
   estimativa ~3,5 h — mais de meia semana da janela livre.
