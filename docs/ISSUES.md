# Backlog de Issues — OrchestraPlanner

> Backlog formal do que deve ser feito, pronto para virar issues no GitHub.
> Como o `gh` (GitHub CLI) ainda não está instalado neste ambiente, este arquivo é a fonte;
> use [`scripts/create-github-issues.ps1`](../scripts/create-github-issues.ps1) para criá-las automaticamente após instalar/autenticar o `gh` e criar o repositório.

**Milestones (fases):** `Fase 1 — Web Pessoal (0–60d)` · `Fase 2 — Público + App (60–120d)` · `Fase 3 — Desktop (120–180d)`
**Labels:** `setup` · `auth` · `api` · `ci` · `test` · `feature` · `epic` · `decision` · `chore` · `infra`

---

## Iteração 0 — Setup & Walking Skeleton  · _milestone: Fase 1_

### #1 — [setup] Inicializar projeto Next.js 15 (App Router) + TypeScript strict + Tailwind + shadcn/ui
**Contexto:** base do app web. **Aceite:** `create-next-app` rodando; TS strict; Tailwind + shadcn/ui configurados; `npm run dev` sobe a home.

### #2 — [setup] Drizzle ORM + PostgreSQL (Neon) + Docker Compose local
**Aceite:** `docker-compose.yml` sobe Postgres local; conexão Drizzle configurada; `DATABASE_URL` documentada em `.env.example`; projeto Neon criado para produção.

### #3 — [infra] Schema `users` + migrations + Row-Level Security por `user_id`
**Aceite:** tabela `users` migrada; RLS habilitado; policy de isolamento por `user_id`; teste confirma isolamento entre 2 usuários fictícios.

### #4 — [auth] Integrar Clerk (login/logout) + middleware protegendo `(app)/`
**Aceite:** registro/login/logout funcionando; middleware bloqueia rotas autenticadas; `user_id` do Clerk disponível no backend.

### #5 — [api] Configurar tRPC (context com `user_id`) + procedure `healthcheck`
**Aceite:** `/api/trpc` ativo; context injeta `user_id`; `healthcheck` autenticada retorna `{ ok: true, userId }`; cliente tRPC chamando do front.

### #6 — [ci] GitHub Actions (typecheck + lint + vitest) + deploy automático Vercel
**Aceite:** pipeline roda em todo PR e bloqueia merge se falhar; merge em `main` dispara deploy no Vercel.

### #7 — [test] Setup Vitest + Playwright + 1º teste unitário e 1º E2E (login → home)
**Aceite:** Vitest e Playwright configurados; teste unitário (`validateGoalTitle`) e E2E (login→home) verdes no CI.

**✅ Definition of Done da Iteração 0:** login funciona, home autenticada, CI verde, deploy automático, `healthcheck` retorna `user_id`.

---

## Iteração 1 — Áreas de Vida & Metas  · _milestone: Fase 1_

### #8 — [feature] Áreas de Vida: seed Corpo/Alma/Espírito + 12 sub-áreas, CRUD customizável
**Aceite:** ao criar conta, semear 3 dimensões + 12 sub-áreas; usuário pode criar/editar/remover/reordenar; cada área tem dimensão, cor, ícone.

### #9 — [feature] US-1.1 Criar Meta
**Aceite (Given/When/Then):** título+descrição+área → meta "Ativa" com `created_at`; título vazio → erro de validação e foco no campo.

### #10 — [feature] US-1.2 Listar Metas (filtro por área, ordenação, estado vazio)
**Aceite:** ativas em `updated_at DESC`; filtro por área; contador; estado vazio com CTA "Criar primeira meta".

### #11 — [feature] US-1.3 Editar Meta
**Aceite:** salvar atualiza `updated_at`; cancelar descarta; "Salvar" desabilitado com título vazio.

### #12 — [feature] US-1.4 Alterar Status (Ativa/Pausada/Completada) + histórico
**Aceite:** completar seta `completed_at` e move para "Completadas"; transição inválida (Completada→Ativa) erra; histórico de transições registrado.

---

## Iteração 2 — Prioridades (Kanban)  · _milestone: Fase 1_

### #13 — [feature] Prioridades em Kanban (todo / in_progress / done) + drag-and-drop
**Aceite:** criar tarefa vinculada (ou não) a meta; mover entre colunas persiste `status` e ordem; filtro por meta/área; badge de prioridade.

### #14 — [feature] Tags em prioridades
**Aceite:** criar/associar tags (reutilizáveis); filtrar por tag; autocomplete de tags existentes.

---

## Iteração 3 — Progresso, Dashboard & Roda da Vida  · _milestone: Fase 1_

### #15 — [feature] Marcos (goal_milestones) + cálculo de progresso da meta
**Aceite:** adicionar/editar marcos; `progress` recalculado a partir dos marcos concluídos; barra de progresso por meta.

### #16 — [feature] Dashboard de metas
**Aceite:** cards de resumo (ativas, vencidas, progresso geral), distribuição por área, atividade recente.

### #17 — [feature] Roda da Vida (avaliação 0–10 por área + gráfico radar) no onboarding
**Aceite:** usuário pontua cada área 0–10; gera gráfico radar; sugere áreas para criar metas; histórico de avaliações (`life_assessments`).
**Marco:** 🏁 MVP de Prioridades & Metas em produção.

---

## Épicos das fases seguintes

### #18 — [epic] Módulo Agenda (Iter. 4–5)  · _Fase 1_
Calendário, compromissos, **recorrência** (diário/semanal/mensal), **lembretes**; vincular tarefas a blocos de tempo.

### #19 — [epic] Módulo Pessoas & Relacionamentos (Iter. 6)  · _Fase 1_
CRM pessoal: pessoas (nome, aniversário, relação), contatos múltiplos, **círculos/famílias**, vínculos (parentesco), **interações** (acompanhamento), **aniversários/lembretes → Agenda**, ligação a áreas/metas.

### #20 — [epic] Módulo Financeiro (Iter. 7–8)  · _Fase 1_
Contas, lançamentos, categorias, **orçamento**, relatórios. **Importação OFX/CSV apenas na última iteração** do módulo.

### #21 — [epic] Fase 2 — Tornar público (SaaS) + App mobile  · _Fase 2_
Onboarding multiusuário, planos/cobrança, app mobile (Expo/PWA) consumindo a mesma API.

### #22 — [epic] Fase 3 — Desktop  · _Fase 3_
Empacotar como desktop (Electron/Tauri) reusando a API.

---

## Decisões a confirmar

### #23 — [decision] Posição do módulo Pessoas no roadmap
Recomendação: **após a Agenda** (aniversários/lembretes dependem do calendário). Confirmar com o dono.

### #24 — [decision] Roda da Vida no onboarding vs Fase 2
Recomendação: **versão mínima já no onboarding**.

### #25 — [chore] Campos condicionais "somente casado" (Relacionamento Conjugal)
Exibir campos/área conjugal conforme `marital_status`.
