# SETUP — OrchestraPlanner (Iteração 0)

Como rodar localmente e o que falta plugar (segredos/contas) para fechar a
**Definition of Done** da Iteração 0. Pré-requisitos: Node 20+ e npm.

## 1. Rodar local (sem segredos → build/teste; com segredos → app de pé)

```bash
npm install
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run test        # vitest (RLS pulado sem DATABASE_URL)
npm run build       # next build (não exige segredos)
```

Para subir o app de verdade (`npm run dev`) é preciso **chave do Clerk** (o
`ClerkProvider` exige a publishable key em runtime).

## 2. Segredos / contas a criar (Phase B — destrava login, DB e deploy)

Copie `.env.example` para `.env` e preencha:

| Variável | Onde obter | Destrava |
|---|---|---|
| `DATABASE_URL` | Neon → role **`app_rls`** (ver abaixo), `sslmode=require` | runtime da app + teste de RLS (#3); upsert de usuário |
| `MIGRATION_DATABASE_URL` | Neon → role **`neondb_owner`** (o padrão do projeto) | migrations/DDL (drizzle-kit) e setup do teste de RLS |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | [Clerk](https://dashboard.clerk.com) → API Keys | login/logout (#4); E2E (#7) |
| `CLERK_SECRET_KEY` | Clerk → API Keys | idem |

> ⚠️ **RLS no Neon — dois roles, por design.** O `neondb_owner` (e **qualquer role
> criado pelo Console do Neon**) vem com o atributo `BYPASSRLS`, que **ignora a RLS**
> e fura o isolamento multi-tenant — e isso **não** pode ser removido (`ALTER ROLE`
> é negado; o Neon não dá superusuário). A app **precisa** conectar por um role
> criado **via SQL**, que nasce **sem** `BYPASSRLS`. Detalhes em `docs/ERROS.md`
> (2026-06-20). Crie o role da app uma vez, como `neondb_owner`:
>
> ```sql
> CREATE ROLE app_rls WITH LOGIN PASSWORD '<senha-forte>';
> GRANT USAGE ON SCHEMA public TO app_rls;
> GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_rls;
> GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_rls;
> ALTER DEFAULT PRIVILEGES IN SCHEMA public
>   GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_rls;
> ALTER DEFAULT PRIVILEGES IN SCHEMA public
>   GRANT USAGE, SELECT ON SEQUENCES TO app_rls;
> ```
>
> Depois monte `DATABASE_URL` com `app_rls` e `MIGRATION_DATABASE_URL` com `neondb_owner`.

### Aplicar o banco

```bash
npm run db:migrate         # roda como neondb_owner (MIGRATION_DATABASE_URL): users + RLS
npm run test               # a suíte de RLS roda como app_rls e prova o isolamento (#3)
```

### Postgres local (alternativa ao Neon, se tiver Docker)

```bash
docker compose up -d
# DATABASE_URL=postgres://postgres:postgres@localhost:5432/orchestraplanner
```

## 3. CI (já configurado)

`.github/workflows/ci.yml` roda em todo push/PR para `main`: **typecheck · lint ·
test · build**. Não precisa de segredos.

Para **bloquear merge** quando o CI falhar, habilite a proteção de branch em
`main` exigindo o check `quality` (Settings → Branches, ou via `gh api`).

## 4. Deploy (Vercel — Phase B)

Recomendado via **integração Git** (sem token em workflow):

1. Importar o repositório em [vercel.com/new](https://vercel.com/new).
2. Adicionar as envs (`DATABASE_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`,
   `CLERK_SECRET_KEY`) no projeto Vercel.
3. Merge em `main` → deploy automático de produção; PRs ganham preview.

## 5. E2E (Playwright — Phase B)

```bash
npx playwright install --with-deps   # baixa os browsers (1ª vez)
npm run test:e2e
```

Os specs de login (`e2e/walking-skeleton.spec.ts`) pulam sem
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` e `E2E_CLERK_EMAIL`/`E2E_CLERK_PASSWORD`
(usuário de teste do Clerk).
