# FORMATACAO.md — Padrão de formatação (evolui a cada execução)

> **Por quê (Mega_Build §2/§6):** padrão de formatação do repositório que o agente
> **refina continuamente**. O hook `PostToolUse` (`.claude/hooks/format.ps1`) aplica
> automaticamente o que for automatizável; este documento registra as convenções.

## Estado atual

Toolchain ativo (desde a Iteração 0): Next.js 16 + TS strict + ESLint + Prettier +
Tailwind v4 + shadcn/ui (base-ui). O hook `PostToolUse` formata os arquivos editados.

## Convenções de código (TS/TSX/JS/CSS/JSON)
- **Prettier** como formatador único (aspas duplas, ponto-e-vírgula on).
- **ESLint** (TS strict) + **import ordering** (grupos: libs externas → `@/...` → relativos
  `./`, cada grupo em ordem alfabética; quebra de linha entre grupos).
- TypeScript **strict**; sem `any` implícito. Para tipos ponta-a-ponta no front, derivar de
  `inferRouterOutputs<AppRouter>` em vez de reconstruir tipos do schema no client.

## Convenções de arquitetura (Iteração 1+)
- **Tabela nova** → sempre `user_id` (ou `id` de tenancy) + `created_at`/`updated_at`;
  migration de tabela (`drizzle-kit generate`) **+** migration custom de RLS
  (`ENABLE` + `FORCE` + policy `user_id = current_setting('app.user_id', true)`), como
  em `drizzle/0001`/`0004`. Índices `(user_id, …)` para as queries quentes (Visão §10).
- **Serviço de domínio** (`src/server/services/<modulo>/`): funções puras de aplicação que
  recebem `userId` e rodam sob `withUserContext(userId, (tx) => …)` — a RLS isola, sem
  `where(user_id)` manual. Lógica pura (validações, máquinas de estado) em módulos próprios,
  testáveis **sem DB** (rodam no CI).
- **tRPC**: routers finos em `src/server/trpc/routers/`, `protectedProcedure` + `zod`,
  delegando ao serviço com `ctx.userId`. Registrar em `root.ts`.
- **UI** autenticada sob `src/app/dashboard/<rota>/`: página server (`force-dynamic`,
  `ensureUserRecord()`) + client manager (`"use client"`) usando `trpc` + `useUtils` para
  invalidar. Rotas em português (`/dashboard/metas`, `/dashboard/areas`).
- **Testes de integração** com DB: `describe.skipIf(!hasDb)` + `migrateForTests()`
  (`src/server/db/migrate-for-tests.ts`) no `beforeAll` — pulam no CI sem banco. Eles falam
  com o Neon pela rede: `testTimeout`/`hookTimeout` de 30 s no `vitest.config.ts`.
- **Regra pura compartilhada com a UI** mora em módulo próprio, **sem import de `db/`**
  (`shared/validate-title.ts`, `priorities/priority-status.ts`, `tags/tag-name.ts`). Importar
  uma constante de um serviço arrasta o driver `postgres` para o bundle do client e quebra o
  build (ver `docs/ERROS.md` 2026-08-11).
- **Update otimista** no client: escrever no cache do React Query (`utils.<router>.setData`)
  em vez de espelhar a lista em `useState` + `useEffect` — o lint (`react-hooks/set-state-in-effect`)
  barra o espelhamento. Estado local só para o que é efêmero de verdade (ex.: o preview
  enquanto se arrasta um card).

### Markdown
- Títulos em sentence case; uma frase por linha em parágrafos longos quando ajudar o diff.
- Tabelas alinhadas por pipe; blocos de código com linguagem declarada.
- Links relativos entre docs do repo (ex.: `[VISAO](VISAO-DO-PRODUTO.md)`).

### Commits
- **Conventional Commits**: `tipo(escopo): assunto` no imperativo, ≤72 caracteres.
- Corpo explica **o quê e o porquê**; rodapé referencia issues e id de sessão.

## Histórico de refinamentos
- **2026-06-18** — documento criado no auto-bootstrap do Mega_Build (papel: Desenvolvedor de Software).
- **2026-06-20** — convenções reais (toolchain ativo) + padrões de arquitetura da Iteração 1
  (tabela+RLS, serviço com `userId`+`withUserContext`, tRPC fino, UI server+client, helper de teste).
- **2026-08-11** — Iteração 2: módulo puro para regra compartilhada com a UI, update otimista
  via cache do React Query, timeout dos testes de integração contra o Neon.
