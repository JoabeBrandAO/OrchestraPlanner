# OrchestraPlanner — Progresso (Diário de Bordo)

> **Para que serve:** log compartilhado entre as sessões do Claude (visão de produto e metodologia XP) e visível no GitHub.
> **Convenção:** atualizar **a cada sessão de trabalho**. Seções — ✅ Feito · 🔄 Fazendo · 📋 A fazer + **Histórico** (data + quem + o quê).

---

## Estado atual — atualizado em 2026-06-17

### ✅ Feito
- Brief do produto completo (o quê/porquê, para quem, onde, prazos 60/60/60, métrica de sucesso) — [VISAO-DO-PRODUTO.md](VISAO-DO-PRODUTO.md).
- Decisões travadas: público (pessoal → SaaS), plataforma (web→app→desktop), stack (Next.js+tRPC+Drizzle+Postgres), XP, ordem dos módulos, SaaS=produtividade pessoal (`user_id`).
- **Decisões fechadas:** Auth = **Clerk** · Financeiro **simples** (OFX/CSV só na última iteração) · Áreas de Vida = **Corpo/Alma/Espírito** + 12 sub-áreas, **customizáveis**.
- **Bases conceituais estudadas:** *Planner Líder de Impacto 2026* (Roda da Vida 12 dimensões, Lista/Árvore de Sonhos, plano financeiro, amigos aniversariantes) e **IgrejasNet** (CRUD de pessoas: dados, contato, endereço, familiares, famílias, aniversário).
- **Módulo Pessoas & Relacionamentos definido** (CRM pessoal — ver §7 da visão).
- Modelo de dados estendido: `life_areas` (com dimensão), `life_assessments` (Roda da Vida), `people`/`circles`/`interactions`.
- **Infra Mega_Build (auto-bootstrap §2/§3/§7/§8)** — sessão mão-na-massa: papel gravado (`.claude/PAPEL` = Desenvolvedor de Software), `.claude/settings.json` (permissões + hooks), hooks `PostToolUse` (format) e `Stop/SubagentStop` (report), slash commands `/test-cycle` `/status` `/erro`, skill `senior-dev-cycle`, `docs/ERROS.md` + `docs/FORMATACAO.md`. Hooks testados ✅ (1 bug de encoding detectado e corrigido — ver ERROS.md).

### 🔄 Fazendo
- **Sessão de Visão** (`C:\projetos`): consolidou requisitos, fontes conceituais e este diário; dona dos docs de produto.
- **Sessão Mão-na-massa** (`OrchestraPlanner`): infra + código. Divisão acordada: eu = `.claude/`, `docs/ERROS.md`, `docs/FORMATACAO.md`, código; Visão = `VISAO-DO-PRODUTO.md`, `SESSION-LOG-*.md`. `PROGRESSO.md` = terreno comum (append no Histórico).

### 📋 A fazer (próximo)
- Confirmar micro-decisões: **posição do módulo Pessoas** (após Agenda?), **Roda da Vida no onboarding?**, campos condicionais "somente casado".
- **Iteração 0** — setup: repo GitHub, Next.js+TS, tRPC, Drizzle, Postgres (Neon)+RLS, **Clerk**, CI (GitHub Actions), deploy (Vercel), walking skeleton.
- Walking skeleton de negócio: criar meta → listar → concluir + 1 teste E2E.

---

## Histórico
- **2026-06-17 — Sessão de Visão:** criou VISAO-DO-PRODUTO.md e PROGRESSO.md; coletou brief; estudou o PDF do planner e o help do IgrejasNet; fechou Auth/Financeiro/Áreas; **definiu o módulo Pessoas/Relacionamentos** e a Roda da Vida; adicionou prazos 60/60/60.
- **2026-06-18 — Sessão Mão-na-massa:** verificou o `Mega_Build.md` (nada da infra §2 existia) e executou o **auto-bootstrap** completo: papel, permissões, hooks, slash commands, skill, `docs/ERROS.md`, `docs/FORMATACAO.md`. Testou os hooks; detectou e corrigiu bug de encoding UTF-8 no `report.ps1` (1ª entrada de `ERROS.md`). Acordou a divisão de trabalho com a sessão de Visão.
- **2026-06-19 — Sessão Mão-na-massa (Iteração 0):**
  - Consolidou o bootstrap em 2 commits limpos (`97812b6` infra, `e45eef2` docs) + push.
  - Criou as **25 issues** no GitHub (`#1`–`#25`) + 10 labels + 3 milestones via `scripts/create-github-issues.ps1`.
  - **#1 ✅** Next.js 16 + TS strict + Tailwind v4 + shadcn/ui + Prettier + `.gitattributes`. typecheck/lint/build verdes (`2c85664`, `fac686f`). _Nota: Next 16 (latest) em vez do 15 da visão — a confirmar._
  - **#2 ✅** Drizzle + postgres-js + drizzle-kit + zod + dotenv; client lazy; `docker-compose.yml`; `.env.example`; scripts `db:*`. typecheck/lint verdes; `db:generate` lê o config (`d89ffc1`).
  - **#3 🟡 código pronto** (`44e50aa`) — schema `users`, migrations 0000+0001 (RLS ENABLE+FORCE+policy), `withUserContext()`, teste de isolamento (`skip` sem DB). _Falta: rodar com `DATABASE_URL` p/ provar isolamento._
  - **#5 ✅** (`72b17e1`) — tRPC (context `userId`, `protectedProcedure`, `healthcheck`), route handler, client React no layout, teste unitário do router verde.
  - **#4 🟡 código pronto** (`aeb6dba`) — ClerkProvider, middleware (`/dashboard`), sign-in/up, dashboard (UserButton + upsert), landing auth-aware. Build verde sem chaves. _Falta: chaves Clerk p/ login real._
  - **#7 🟡 unit ✅ / E2E pendente** (`d1a43cb`) — `validateGoalTitle` + 5 testes verdes; Playwright + spec login→home (`skip` sem chaves). _Falta: rodar E2E com Clerk._
  - **#6 ✅ CI / deploy pendente** (`2153dbe`,`907bb17`) — GitHub Actions (typecheck·lint·test·build) **verde** em ~44s. `docs/SETUP.md`. _Falta: conectar Vercel; branch protection é decisão do dono._
  - **Resumo Iteração 0:** Phase A (tudo sem segredo) **concluída e verde**. Phase B (Neon + Clerk + Vercel) documentada em `docs/SETUP.md`; issues #3/#4/#6/#7 abertas com comentário do que falta.
- **2026-06-20 — Sessão Mão-na-massa (Phase B / Neon):**
  - **#3 ✅ PROVADO** — RLS isolando de verdade contra o Neon. Banco real conectado (`DATABASE_URL`), migrations aplicadas, suíte **11/11 verde** (4 testes de RLS rodando, antes pulados).
  - **Achado de segurança:** o `neondb_owner` e todo role criado pelo **Console do Neon** vêm com `BYPASSRLS` → a RLS era furada em silêncio (e `ALTER ROLE NOBYPASSRLS` é negado pelo Neon). Via oficial: criar o role da app **via SQL** (`app_rls`, sem BYPASSRLS). Registrado em `docs/ERROS.md` (2026-06-20).
  - **Arquitetura de 2 roles:** `DATABASE_URL` = `app_rls` (restrito, runtime) · `MIGRATION_DATABASE_URL` = `neondb_owner` (migrations/DDL). Atualizados `drizzle.config.ts`, `.env(.example)`, `docs/SETUP.md`.
  - **Blindagem:** `rls.test.ts` agora tem teste fail-safe que assere `rolbypassrls = false` no role corrente; `vitest.config.ts` carrega `.env` via `dotenv/config`. `users.ts` (upsert) já usava `withUserContext` → app RLS-safe em runtime.
  - typecheck · lint · build verdes. _Falta Phase B: chaves Clerk (#4/#7) e deploy Vercel._
- **2026-06-20 (cont.) — Sessão Mão-na-massa (Iteração 1, autônoma):**
  - **#3 fechada** na `main` (`4e05e71`): migration `0002` (GRANTs idempotentes do `app_rls`) + commit + issue fechada.
  - **Iteração 1** entregue na branch `feat/iteracao-1-metas` (PR aberto — Closes #8–#12):
    - **#8 Áreas de Vida** — `life_areas` + enum dimensão; seed idempotente das 12 sub-áreas padrão (Visão §4) no upsert; serviço CRUD + tRPC; UI `/dashboard/areas`.
    - **#9–#12 Metas (US-1.1…1.4)** — `goals` + status enum; serviço `createGoal/listGoals/updateGoal/changeGoalStatus` (máquina de estados pura `canTransition`, reusa `validateGoalTitle`); tRPC `goals`; UI `/dashboard/metas` (criar/listar/editar/status + estado vazio). Walking skeleton de negócio coberto por unit/integração.
    - Migrations `0003` (tabelas) + `0004` (RLS ENABLE+FORCE+policy por `user_id`). Tudo sob `withUserContext` → RLS isola.
    - Qualidade: helper `migrateForTests`; `docs/FORMATACAO.md` atualizado. **Suíte 23 verdes**; typecheck·lint·build verdes.
  - **Decisões abertas registradas:** Next 16 vs 15 (**#26**, nova); #23/#24/#25 (produto). Bloqueios comentados em #4/#6/#7.
  - **Pendência do dono:** apagar o role órfão `app_user` (Console, BYPASSRLS) no Neon.
