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
| `DATABASE_URL` | [Neon](https://neon.tech) → connection string (pooled, `sslmode=require`) | migrations + teste de RLS (#3); upsert de usuário |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | [Clerk](https://dashboard.clerk.com) → API Keys | login/logout (#4); E2E (#7) |
| `CLERK_SECRET_KEY` | Clerk → API Keys | idem |

### Aplicar o banco (com `DATABASE_URL` definida)

```bash
npm run db:migrate         # cria a tabela users + RLS (migrations 0000, 0001)
npm run test               # agora a suíte de RLS roda e prova o isolamento (#3)
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
