# OrchestraPlanner — Progresso (Diário de Bordo)

> **Para que serve:** o estado de hoje, compartilhado entre as sessões do Claude e visível no GitHub.
> **Convenção:** atualizar a cada sessão — ✅ Feito · 🔄 Fazendo · 📋 A fazer + **Histórico recente**.
> Quando o Histórico passar de uns 10 KB, ele é rotacionado para `docs/sessions/` sem edição.
> **Pendência antiga no Histórico não é pendência de hoje:** confira no GitHub antes de agir.

---

## Estado atual — atualizado em 2026-10-11

### ✅ Feito
- **Fase 1 (uso pessoal) completa e no ar** na Vercel (`orchestra-planner.vercel.app`), sob RLS por
  `user_id`: **Prioridades & Metas**, **Agenda** (recorrência, exceções, lembretes por Web Push),
  **Pessoas & Relacionamentos** (vínculos, círculos, interações, aniversários) e **Financeiro**
  (contas, orçamento, relatórios, importação OFX/CSV).
- **Auditoria de 2026-09-04 zerada:** as 12 issues fechadas (as últimas 7 em 2026-09-30).
- **Rodada de UI/UX com o Impeccable (2026-10-10), toda no ar:** os 12 PRs (#121–#132) mesclados
  na `main` (`829d488`) e em produção (site respondendo 200). Fonte do app corrigida, Roda da
  Vida no celular, contraste AA, confirmação antes de exclusão em cascata, ícones, login em
  português, tema escuro pelo sistema, uma cor por dimensão (Corpo / Alma / Espírito).
  Contexto de design em `PRODUCT.md`; diagnóstico em `docs/ux/2026-10-10-diagnostico-impeccable.md`.
- **Segurança zerada:** `npm audit --omit=dev` com 0 vulnerabilidades desde o #128 (Next.js
  16.3.8, `shadcn` em `devDependencies`).
- **Qualidade:** 517 casos no Vitest e 4 E2E (landing, login → painel, CSP obrigatória e varredura
  de violações). A `main` é protegida: PR obrigatório com o CI exigido, inclusive para admin.

### 🔄 Onde paramos
- **Manutenção.** Nada em execução no OrchestraPlanner. O próximo projeto é o **DOM**
  (`C:\projetos\DOM\DOM.txt`).

### 📋 Próximos passos, em ordem
1. **Menu fixo e tela de Conta** (achados 9 e 12 do diagnóstico), ~3,5 h: navegação persistente
   entre os módulos e Preferências/"Seus dados" fora do painel.
2. **Script de troca de dono dos dados** — leva o `user_id` de toda tabela do ID antigo para o
   novo, numa transação. Tem de existir **antes** de trocar o Clerk para produção. Mexe em dado
   de produção: **pede aprovação do dono**.
3. **Clerk de produção** pelo `docs/CLERK-PRODUCAO.md`, ~2,5 h do dono em dois dias (domínio,
   DNS, chaves, webhook). A etapa 7 usa o script do passo 2.
4. **Pendências menores:** contraste das cores de tag (escolhidas pelo usuário, sem garantia nos
   dois temas); resumo por área do painel sem a cor da dimensão (o serviço não manda a
   dimensão); `provisioning.test.ts` estourando 30 s contra o Neon quando roda local.
5. **Com o dono:** #64 (validação manual da Fase 1, ~3 h) e #114 (opcional: prova de exclusão de
   usuário de ponta a ponta).
6. **Dependabot (conferido em 2026-10-11):** #117 e #120 fechados pelo próprio Dependabot (as
   atualizações já tinham entrado pelo #128). Abertos, com CI verde: **#118** (Vitest 4 → 5) e
   **#119** (dotenv 17 → 18) — as duas são versão major e pedem leitura das notas de mudança
   antes do merge.

### 💡 Aprendizados de 2026-10-10/11
- **O merge autônomo agora é barrado pelo sistema de permissões do Claude Code.** O fluxo atual:
  o agente deixa o CI verde e informa a ordem de merge; o dono mescla no GitHub (ou libera
  `Bash(gh pr merge:*)` em `/permissions`).
- **PRs que dependem uns dos outros entram com "Create a merge commit",** não com *squash*:
  esmagar os anteriores faz os empilhados conflitarem.
- **Vários pontos de partida em comum (bases de merge) enganam a simulação local:** o git local
  mescla limpo e o GitHub acusa conflito. Detalhe e prevenção em `docs/ERROS.md` (2026-10-10,
  "A simulação da ordem de merge…").
- **Print de tela entra no ciclo de toda mudança visual:** a fonte quebrada passou meses por
  build verde e pelo detector estático.

### 🧊 Congelado (backlog sem data)
- **#21** Fase 2 (SaaS + app mobile), **#22** Fase 3 (desktop) e **#106** (recorrência da Agenda
  ciente de fuso; hoje assume UTC-3 fixo, o que é correto para o Brasil).

---

## Histórico recente
_Histórico de 2026-06-17 a 2026-09-04:
[docs/sessions/historico-progresso-ate-2026-09-04.md](docs/sessions/historico-progresso-ate-2026-09-04.md)._

- **2026-10-11 — Checkpoint de fim de sessão:** os 12 PRs da rodada de UX mesclados pelo dono
  (`main` em `829d488`), deploy de produção ok (200) e auditoria de produção em 0. Projeto volta
  para a manutenção; próximos passos e aprendizados no Estado atual. Fechamento no log
  [docs/sessions/2026-10-10-ux-impeccable.md](docs/sessions/2026-10-10-ux-impeccable.md).

- **2026-10-10 — Primeira rodada de UI/UX com o Impeccable (subagente front-end/UX):**
  - **Contexto e diagnóstico (#121):** `PRODUCT.md` (o `init` do Impeccable, a partir da Visão) e
    `docs/ux/2026-10-10-diagnostico-impeccable.md`: nota técnica 11/20, heurísticas 19/40, 18
    achados por impacto ÷ esforço. `e2e/ux-prints.spec.ts` fotografa as telas sob demanda.
  - **Achado mais grave:** a fonte do app nunca carregou (`--font-sans` apontava para si mesma);
    tudo em Times New Roman desde a Iteração 0, com build verde o tempo todo.
  - **Correções em PR, uma por tema:** #122 fonte e datas · #123 Roda da Vida no celular, radar e
    largura das telas · #124 contraste AA e erro anunciado · #125 confirmação antes de exclusão
    em cascata · #126 ícones no lugar de emoji.
  - **CI vermelho na `main`** por 13 falhas novas de dependência de produção (1 crítica). Corrigido
    em #128 (`npm audit fix`, Next.js 16.3.8, `shadcn` em `devDependencies`): auditoria em 0.
  - **Segunda leva, liberada pelo dono no mesmo dia:** #129 login em português
    (`@clerk/localizations`) · #130 tema escuro pelo sistema operacional · #131 uma cor por
    dimensão (Corpo terracota, Alma azul-petróleo, Espírito dourado; AA nos dois temas) · #132
    guia do Clerk de produção. Todos os PRs com CI verde; **nenhum merge feito pela sessão**.
  - **Merge pelo dono:** #128, #121–#126, #129 e #130 entraram (`de612fb`). O #131 ficou em
    conflito no GitHub, embora o git local mesclasse limpo: o ramo tinha cinco bases de merge
    com a `main`. Resolvido com um merge da `main` no ramo; faltam #131, #132 e #127.
  - Cinco lições em `docs/ERROS.md`.
  - Log: [docs/sessions/2026-10-10-ux-impeccable.md](docs/sessions/2026-10-10-ux-impeccable.md).

- **2026-10-01 — Pendências de infraestrutura do dono (guiado, sem código):**
  - **#114 fechada:** webhook do Clerk cadastrado (`user.created/updated/deleted`),
    `CLERK_WEBHOOK_SIGNING_SECRET` em Production, redeploy sem cache. *Testing* com
    `user.updated` entregue com sucesso.
  - **#91 fechada:** `DATABASE_URL` (app_rls) com `sslmode=verify-full` em Production e Preview.
    O painel abre com dados, e é essa a prova de que o certificado validou.
  - **Primeiro login depois da CSP obrigatória (#92):** feito, painel normal.
  - **Lições:** variável *Secret* na Vercel não mostra o valor salvo; o campo de edição vem
    **vazio** e salvar assim derruba a produção. Para trocar um parâmetro é preciso colar a
    string inteira. A #91 mandava editar `MIGRATION_DATABASE_URL` na Vercel, mas ela não pode
    estar lá (SETUP §4).
  - Log: [docs/sessions/2026-10-01-pendencias-infra.md](docs/sessions/2026-10-01-pendencias-infra.md).

- **2026-09-30 — Fechamento da Fase 1 (sessão única, merge autônomo com CI verde):**
  - **Dependabot:** 9 PRs de dependência mergeados. TypeScript 7, ESLint 10 e `@types/node` > 22
    foram recusados **com motivo** registrado no `dependabot.yml`. A `main` tinha uma falha
    **alta** de produção (`brace-expansion`), corrigida no lockfile (#102).
  - **#72 fuso (#107):** `users.time_zone` (migration `0031`), `shared/time-zone.ts` puro e o painel
    derivando o "hoje" do fuso do usuário. O navegador semeia o fuso uma vez e a tela troca depois.
    Aniversário às 8h no fuso do usuário. Teste determinístico: UTC−12 e UTC+14 nunca estão no
    mesmo dia.
  - **#73 webhook (#108):** `/api/webhooks/clerk` com `verifyWebhook`, que recusa tudo sem segredo.
    `ensureUserRecord` passou a só ler (1 SELECT; antes eram 8 statements de escrita por página).
    O teste de exclusão varre **toda tabela com `user_id` pelo catálogo**.
  - **#74 LGPD (#109):** "Baixar meus dados" (JSON de toda tabela do usuário) e "Apagar minha
    conta" (digitar APAGAR; apaga primeiro o dado, depois o Clerk), mais o aviso sobre dado de
    terceiros.
  - **#75 rate limit (#110):** contador de janela fixa no **Postgres** (em memória cada instância
    serverless teria o seu). Um upsert atômico; `limite + 5` chamadas simultâneas deixam passar
    exatamente `limite`.
  - **#76 erros (#111):** `DomainError`/`NotFoundError` com 400/404 em vez de 500, cobrindo os 66
    `throw` dos serviços. Uma linha JSON por mutação e por erro, **sem entrada nem mensagem de
    erro inesperado**, e há teste que prova isso.
  - **#92 CSP (#112):** obrigatória, emitida pelo middleware do Clerk com nonce e `strict-dynamic`.
    O E2E varre login + 8 telas + importação atrás de violação; o detector foi provado com
    sabotagem. A produção usa a mesma instância do Clerk que o E2E.
  - **#77 higiene:** README reescrito, este diário rotacionado (52 KB → abaixo de 20 KB), logs de
    sessão movidos para `docs/sessions/` e ~300 backups tirados de `src/`/`e2e/`. A causa era o
    hook global `xlsx_guard.ps1`, que copiava **qualquer** arquivo editado e não só `.xlsx`;
    corrigido.
  - **Fechamentos:** #58 "não fazer" (a medição mostra ~10–20 ms em produção). #21/#22 congeladas.
    Aberta a #106 (recorrência com fuso).
  - **Checkpoint:** log em
    [docs/sessions/2026-09-30-fechamento-fase-1.md](docs/sessions/2026-09-30-fechamento-fase-1.md),
    três lições em `docs/ERROS.md` e #114 aberta (webhook do Clerk em produção).
