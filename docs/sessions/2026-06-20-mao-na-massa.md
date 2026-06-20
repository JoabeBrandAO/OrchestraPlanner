# Session Log — 2026-06-20 (Sessão Mão-na-massa / Dev)

> Registro de finalização da sessão **mão-na-massa** (Desenvolvedor de Software sênior),
> que roda em `C:\projetos\OrchestraPlanner` sob o contrato `Mega_Build.md`.
> Complementa [VISAO-DO-PRODUTO.md](../../VISAO-DO-PRODUTO.md), [PROGRESSO.md](../../PROGRESSO.md),
> [ERROS.md](../ERROS.md) e [SETUP.md](../SETUP.md).

## Identificação
- **Data:** 2026-06-20 · **Papel:** Desenvolvedor de Software (`.claude/PAPEL`).
- **ID estável da sessão:** `mnm-20260620-rls-iter1` (session ID do Claude Code não exposto nesta execução).
- **Branch:** `feat/iteracao-1-metas` · **Último commit:** `d72d9c1`. Base em `main` `4e05e71`.

## 1. O que foi feito
- **#3 RLS real PROVADO e fechado** (`4e05e71`, direto na `main`; issue #3 fechada):
  - Conectado o banco Neon de verdade pela 1ª vez; migrations aplicadas; isolamento provado (A→só A, B→só B, sem contexto→0).
  - Arquitetura de **2 roles**: `DATABASE_URL=app_rls` (restrito, runtime) · `MIGRATION_DATABASE_URL=neondb_owner` (migrations/DDL). `drizzle.config` e testes usam o split.
  - **Migration `0002`** idempotente com os GRANTs do `app_rls` (+ ALTER DEFAULT PRIVILEGES p/ tabelas futuras).
  - `rls.test.ts` com **fail-safe `rolbypassrls=false`**; Vitest carrega `.env` (dotenv).
- **Iteração 1 entregue** na branch `feat/iteracao-1-metas` (3 commits):
  - `5107d03` **backend** — `life_areas` + `goals` (migrations 0003 tabelas, 0004 RLS); seed idempotente das 12 áreas padrão (Visão §4) no upsert; serviços de domínio (`createGoal/listGoals/updateGoal/changeGoalStatus` + `canTransition` puro; CRUD de áreas); tRPC `lifeAreas`/`goals`.
  - `5a33763` **UI** — `/dashboard/metas` (criar/listar/editar/status + estado vazio) e `/dashboard/areas` (por dimensão + add/remove) + navegação.
  - `d72d9c1` **refactor/qualidade** — helper `migrateForTests`; `docs/FORMATACAO.md` atualizado com convenções reais + padrões da Iteração 1.
- **Suíte 23 testes verdes** (6 arquivos); typecheck·lint·build verdes.

## 2. Decisões / aprendizados
- **Gotcha de segurança (registrado em `ERROS.md`):** no Neon, `neondb_owner` e roles criados pelo **Console** têm `BYPASSRLS` → a RLS é furada em silêncio (FORCE não vence BYPASSRLS), e `ALTER ROLE NOBYPASSRLS` é **negado**. Via oficial: role criado **via SQL** (`app_rls`) nasce sem BYPASSRLS. Refs: docs do Neon (RLS query execution / Manage roles).
- **Role `app_rls` em vez de `app_user`:** o Master Prompt pedia `app_user`, mas o `app_user` criado no Console tem BYPASSRLS e não é corrigível — `app_rls` (via SQL) é a realização correta da intenção.
- **Máquina de estados de metas (US-1.4):** ativa↔pausada→completada; completada→ativa (reabrir, limpa `completed_at`); demais transições (incl. mesmo→mesmo) inválidas.
- **Áreas opcionais na meta** (`life_area_id` nullable, `on delete set null`): remover uma área não apaga metas.

## 3. Onde paramos
- `main`: #3 fechado (RLS real). Branch `feat/iteracao-1-metas` com a Iteração 1 completa e verde, **pronta para PR** (Closes #8–#12).
- Bloqueado só pelo que depende do Joabe (Clerk, Vercel) — ver §4.

## 4. Próximos passos (ordenados)
1. **Revisar e mergear o PR** da Iteração 1 (Áreas + Metas).
2. **Phase B (Joabe):** chaves Clerk (#4) + usuário de teste (#7) → login real e E2E; conectar Vercel + branch protection (#6).
3. **Decisões abertas:** Next 16 vs 15 (#26); posição de Pessoas (#23); Roda da Vida no onboarding (#24); campos "somente casado" (#25).
4. **Higiene:** apagar no Console do Neon o role órfão `app_user` (tem BYPASSRLS, sem uso).
5. **Iteração 2:** Prioridades em Kanban (#13) + drag-and-drop.

## 5. Provisionamentos desta sessão
- Nenhum novo provisionamento global (skills `checkpoint`/`session-checkpoint` já existiam — §0 reconciliado, não sobrescrito).
- Repo: migrations 0002/0003/0004; serviços `life-areas`/`goals`; routers tRPC; páginas `/dashboard/metas` e `/dashboard/areas`; helper `migrate-for-tests`; este log.
