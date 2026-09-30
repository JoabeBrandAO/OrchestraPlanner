# OrchestraPlanner — Progresso (Diário de Bordo)

> **Para que serve:** o estado de hoje, compartilhado entre as sessões do Claude e visível no GitHub.
> **Convenção:** atualizar a cada sessão — ✅ Feito · 🔄 Fazendo · 📋 A fazer + **Histórico recente**.
> Quando o Histórico passar de uns 10 KB, ele é rotacionado para `docs/sessions/` sem edição.
> **Pendência antiga no Histórico não é pendência de hoje:** confira no GitHub antes de agir.

---

## Estado atual — atualizado em 2026-09-30

### ✅ Feito
- **Fase 1 (uso pessoal) completa e no ar** na Vercel (`orchestra-planner.vercel.app`), sob RLS por
  `user_id`: **Prioridades & Metas**, **Agenda** (recorrência, exceções, lembretes por Web Push),
  **Pessoas & Relacionamentos** (vínculos, círculos, interações, aniversários) e **Financeiro**
  (contas, orçamento, relatórios, importação OFX/CSV).
- **Auditoria de 2026-09-04 zerada:** as 12 issues fechadas. As últimas 7 fecharam em
  2026-09-30: fuso do usuário (#72), webhook do Clerk (#73), LGPD (#74), rate limiting (#75),
  erros e rastro (#76), CSP obrigatória (#92) e higiene (#77).
- **Qualidade:** 503 casos no Vitest (unitários, de componente e de integração sob RLS contra
  Postgres real no CI) e 4 E2E (landing, login → painel, CSP obrigatória e varredura de violações).
  A `main` é protegida: PR obrigatório com o CI exigido, e isso vale também para admin.

### 🔄 Fazendo
- Nada. O próximo projeto é o **DOM** (`C:\projetos\DOM\DOM.txt`), começando por uma sessão de
  alinhamento sem código. O OrchestraPlanner fica em manutenção.

### 📋 A fazer — na mão do dono
1. **#64 — validação manual da Fase 1.** O roteiro está na issue. Estimativa: ~3 h.
2. **Webhook do Clerk (#73):** cadastrar o endpoint no Clerk e `CLERK_WEBHOOK_SIGNING_SECRET` na
   Vercel (passo a passo em `docs/SETUP.md` §4.2). **Até lá, apagar a conta no Clerk não apaga o
   dado.** Apagar pela tela ("Seus dados") já apaga as duas coisas.
3. **#91 — `sslmode=verify-full`** em `DATABASE_URL` na Vercel. O passo a passo está na issue.
4. **Primeiro login em produção depois da CSP obrigatória (#92):** entrar e abrir Agenda e
   Financeiro. Uma tela em branco ou um login travado significa bloqueio pela CSP; me avise com o
   console do navegador.

### 🧊 Congelado (backlog sem data)
- **#21** Fase 2 (SaaS + app mobile), **#22** Fase 3 (desktop) e **#106** (recorrência da Agenda
  ciente de fuso; hoje assume UTC-3 fixo, o que é correto para o Brasil).

---

## Histórico recente
_Histórico de 2026-06-17 a 2026-09-04:
[docs/sessions/historico-progresso-ate-2026-09-04.md](docs/sessions/historico-progresso-ate-2026-09-04.md)._

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
