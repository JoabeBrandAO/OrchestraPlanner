# OrchestraPlanner

Sistema de **gestão de vida pessoal** — organiza **metas/prioridades, agenda, finanças e o convívio entre pessoas (relacionamentos)** de forma integrada, sobre o framework **Corpo / Alma / Espírito**.

> Status: **planejamento concluído / Iteração 0 não iniciada** (greenfield).

## Visão geral
- **Para quem:** uso pessoal (cliente = administrador), evoluindo para **SaaS de produtividade pessoal**.
- **Plataforma:** Web → mobile → desktop (arquitetura **API-first**).
- **Metodologia:** Extreme Programming (XP) — TDD, fatias verticais, iterações curtas.

## Stack
**Next.js 15 · tRPC · Drizzle ORM · PostgreSQL (Neon) · Clerk (auth) · shadcn/ui · Vitest + Playwright · Vercel · GitHub Actions**

Multi-tenant desde o dia 1 por `user_id` + Row-Level Security (sem `organization_id` por ora).

## Módulos (ordem)
1. **Prioridades & Metas** (MVP) — áreas de vida, metas, marcos, Kanban, dashboard, Roda da Vida
2. **Agenda** — calendário, compromissos, recorrência, lembretes
3. **Financeiro** — contas, orçamento, relatórios (importação OFX/CSV por último)
4. **Pessoas & Relacionamentos** — CRM pessoal (contatos, círculos/famílias, interações, aniversários)

## Documentação
- [VISAO-DO-PRODUTO.md](VISAO-DO-PRODUTO.md) — fonte da verdade (visão, arquitetura, modelo de dados, backlog)
- [PROGRESSO.md](PROGRESSO.md) — diário de bordo (feito / fazendo / a fazer)
- [SESSION-LOG-2026-06-17.md](SESSION-LOG-2026-06-17.md) — registro da sessão de planejamento
- [docs/ISSUES.md](docs/ISSUES.md) — backlog de issues
- [scripts/create-github-issues.ps1](scripts/create-github-issues.ps1) — cria as issues no GitHub via `gh`

## Como começar (Iteração 0)
Ver checklist em [VISAO-DO-PRODUTO.md](VISAO-DO-PRODUTO.md#checklist-da-iteração-0) e as issues de setup em [docs/ISSUES.md](docs/ISSUES.md).

## Roadmap (60 / 60 / 60 dias)
| Fase | Janela | Entrega |
|---|---|---|
| 1 | 0–60 d | App web pessoal (Metas → Agenda → Financeiro → Pessoas) |
| 2 | 60–120 d | Público (SaaS) + app mobile |
| 3 | 120–180 d | Desktop |

---
_Roadmap, decisões e bases conceituais detalhados nos documentos acima._
