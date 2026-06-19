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
