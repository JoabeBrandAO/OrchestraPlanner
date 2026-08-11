# ERROS.md — Registro vivo de erros e aprendizados

> **Por quê (Mega_Build §6):** todo erro encontrado é registrado aqui — o que ocorreu,
> a causa raiz e como evitar a recorrência — para que **não se repita**.
> Append-only: nunca apague entradas; corrija acrescentando.

## Formato de cada entrada

```
### YYYY-MM-DD — <título curto do erro>
- **Contexto:** onde/quando ocorreu (módulo, comando, arquivo).
- **O que ocorreu:** o sintoma observado.
- **Causa raiz:** por que aconteceu.
- **Correção:** o que foi feito para resolver.
- **Como evitar a recorrência:** regra, teste ou checagem para o futuro.
```

---

## Entradas

### 2026-06-18 — Mojibake no relatório do hook Stop (`report.ps1`)
- **Contexto:** teste do hook `Stop` (`.claude/hooks/report.ps1`) durante o auto-bootstrap do Mega_Build.
- **O que ocorreu:** a linha do `git log -1 --oneline` foi gravada em `docs/RELATORIOS.md` com caracteres corrompidos (`finaliza├º├úo` em vez de `finalização`).
- **Causa raiz:** o git emite UTF-8, mas o PowerShell decodificou a saída usando o code page legado do console (CP-1252/850), corrompendo acentos.
- **Correção:** forçar `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8` (e `$OutputEncoding`) no início do `report.ps1`, antes de capturar a saída do git.
- **Como evitar a recorrência:** em qualquer script PowerShell que capture saída de ferramentas externas (git, npx) com texto acentuado, fixar `OutputEncoding` para UTF-8 no topo. Padrão a ser herdado por novos hooks/scripts.

### 2026-06-18 — Comentário inline no `.gitignore` não funciona
- **Contexto:** ao ignorar `docs/RELATORIOS.md` (log gerado por hook) no `.gitignore`.
- **O que ocorreu:** o arquivo continuou aparecendo como untracked no `git status` mesmo após adicionar a regra.
- **Causa raiz:** a regra foi escrita como `docs/RELATORIOS.md   # comentário` — o `.gitignore` **não suporta comentário na mesma linha do padrão**; o `#` e o texto viraram parte do padrão, que então não casou com o arquivo.
- **Correção:** mover o comentário para a linha de cima (começando com `#`) e deixar o padrão sozinho na sua linha. Confirmado com `git check-ignore docs/RELATORIOS.md`.
- **Como evitar a recorrência:** comentários no `.gitignore` sempre em linha própria. Validar regras novas com `git check-ignore <caminho>` antes de dar por feito.

### 2026-06-19 — `_backups/` (autohook global) poluindo tsc/eslint/prettier
- **Contexto:** typecheck e lint da Iteração 0 falhando/avisando em arquivos dentro de `_backups/`.
- **O que ocorreu:** um autohook global cria backups (`*.autohook.*`) ao editar arquivos; como ficam dentro do projeto, o `tsc` (via `**/*.ts`) e o ESLint os analisavam, gerando erros de versões antigas.
- **Causa raiz:** `_backups/` é gitignored, mas ignore do git não exclui das ferramentas de build.
- **Correção:** excluir `_backups`/`**/_backups` em `tsconfig.json` (`exclude`), `eslint.config.mjs` (`globalIgnores`) e `.prettierignore`.
- **Como evitar a recorrência:** ao adicionar diretórios gerados, lembrar que cada ferramenta tem seu próprio ignore (git ≠ tsc ≠ eslint ≠ prettier) — propagar para todos.

### 2026-06-19 — shadcn (base-ui) Button sem `asChild` e Clerk sem `SignedIn/SignedOut` no índice
- **Contexto:** integração do Clerk (#4) com botões shadcn na landing.
- **O que ocorreu:** (a) `<Button asChild>` deu erro de tipo — esta versão do shadcn usa o primitivo `@base-ui/react` que não tem `asChild`; (b) `import { SignedIn, SignedOut } from "@clerk/nextjs"` quebrou o build — não são exportados pelo índice nesta versão.
- **Causa raiz:** APIs assumidas de memória diferem das versões instaladas (shadcn base-ui; Clerk recente).
- **Correção:** (a) usar `buttonVariants({ variant })` como `className` de um `<Link>`; (b) tornar a landing server component e usar `auth()` de `@clerk/nextjs/server` para gating, em vez dos control components.
- **Como evitar a recorrência:** conferir a API real (ler o componente/d.ts instalado) antes de usar; não assumir props/exports de versões antigas. O ciclo §6 (typecheck+build) pegou ambos antes do commit.

### 2026-06-20 — RLS silenciosamente furada: roles do Neon vêm com `BYPASSRLS`
- **Contexto:** prova do isolamento multi-tenant (#3) contra o Neon, conectando o app ao banco real pela primeira vez.
- **O que ocorreu:** com `DATABASE_URL` apontando para o `neondb_owner`, o teste de RLS falhou — sem contexto de usuário a query retornava **todas** as linhas. A policy `users_isolation` + `FORCE ROW LEVEL SECURITY` estavam corretas no banco (`relrowsecurity`/`relforcerowsecurity = true`), mas eram ignoradas.
- **Causa raiz:** o role tinha o atributo **`BYPASSRLS = true`**, que ignora RLS em qualquer tabela — e `FORCE` **não** vence `BYPASSRLS`. No Neon, o `neondb_owner` **e todo role criado pelo Console/CLI/API** ganham membership em `neon_superuser` + `BYPASSRLS`. Pior: `ALTER ROLE ... NOBYPASSRLS` **não é permitido** (nem pelo dono — "permission denied to alter role"), pois o Neon não expõe superusuário.
- **Correção:** seguir a via oficial do Neon — criar o role da app **via SQL** (`CREATE ROLE app_rls WITH LOGIN PASSWORD '…'`), que **não** entra no `neon_superuser` e nasce **sem** `BYPASSRLS`. Arquitetura de dois roles: `app_rls` (restrito, só DML) em `DATABASE_URL` para runtime; `neondb_owner` em `MIGRATION_DATABASE_URL` só para migrations/DDL. Isolamento provado: A vê só A, B só B, sem contexto vê 0.
- **Como evitar a recorrência:** (1) **nunca** usar role criado pelo Console do Neon para a app — só via SQL; (2) `rls.test.ts` agora tem um teste fail-safe que assere `rolbypassrls = false` no role corrente — se alguém apontar a app para um role que fura RLS, a suíte quebra alto em vez de passar furada; (3) migrations e runtime usam roles distintos por design (ver `docs/SETUP.md`). Refs: [Neon — RLS query execution](https://neon.com/docs/guides/rls-query-execution), [Neon — Manage roles](https://neon.com/docs/manage/roles).

### 2026-08-11 — Reordenação do Kanban perdia a troca de coluna
- **Contexto:** Iteração 2, `computeReorder` (`src/server/services/priorities/reorder.ts`, #13).
- **O que ocorreu:** mover um card para **outra** coluna sem mudar de índice (ex.: `todo[0]` → `done[0]`) não gerava nenhum update — o teste puro `clampeia o índice…` falhou com a coluna destino vazia.
- **Causa raiz:** ao inserir o item na coluna destino eu já o inseria com o `status` novo (`{...moved, status: toStatus}`). A comparação final (`item.status !== status || item.position !== position`) então não via diferença alguma — o próprio código apagara a mudança que precisava detectar.
- **Correção:** inserir o item com o **status original** e deixar a comparação final descobrir a troca. Comentário no ponto exato explicando o porquê.
- **Como evitar a recorrência:** em rotinas de diff, **nunca** normalizar o dado para o estado-alvo antes de comparar com o estado-alvo. O teste puro pegou antes de qualquer ida ao banco — manter a matemática de ordenação fora do serviço, testável sem DB.

### 2026-08-11 — Import de serviço puxou `postgres` para o bundle do client
- **Contexto:** `npm run build` da Iteração 2; `tag-editor.tsx` (client component) importava `TAG_NAME_MAX_LENGTH` de `tags-service.ts`.
- **O que ocorreu:** build quebrou com *module not found* em `node_modules/postgres/src/connection.js`, listando a cadeia `tag-editor.tsx → tags-service.ts → db/rls.ts → db/index.ts → postgres`.
- **Causa raiz:** importar **qualquer** símbolo de um módulo traz o módulo inteiro para o grafo — mesmo uma constante. Como o serviço importa o client do banco, o bundler tentou empacotar o driver `postgres` para o browser.
- **Correção:** extrair a regra pura para `src/server/services/tags/tag-name.ts` (sem dependência de banco) e importar dela tanto na UI quanto no serviço/router.
- **Como evitar a recorrência:** constantes e regras puras que a UI compartilha moram em módulo próprio, sem import de `db/`. Regra geral já usada em `validate-title.ts` e `priority-status.ts`; agora documentada em `docs/FORMATACAO.md`.
