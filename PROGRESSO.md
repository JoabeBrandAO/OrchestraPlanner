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

### 🔄 Fazendo
- **Sessão de Visão** (`C:\projetos`): consolidou requisitos, fontes conceituais e este diário.
- **Sessão de Metodologia XP** (`OrchestraPlanner`): define práticas de XP — _(esta sessão atualiza aqui)_.

### 📋 A fazer (próximo)
- Confirmar micro-decisões: **posição do módulo Pessoas** (após Agenda?), **Roda da Vida no onboarding?**, campos condicionais "somente casado".
- **Iteração 0** — setup: repo GitHub, Next.js+TS, tRPC, Drizzle, Postgres (Neon)+RLS, **Clerk**, CI (GitHub Actions), deploy (Vercel), walking skeleton.
- Walking skeleton de negócio: criar meta → listar → concluir + 1 teste E2E.

---

## Histórico
- **2026-06-17 — Sessão de Visão:** criou VISAO-DO-PRODUTO.md e PROGRESSO.md; coletou brief; estudou o PDF do planner e o help do IgrejasNet; fechou Auth/Financeiro/Áreas; **definiu o módulo Pessoas/Relacionamentos** e a Roda da Vida; adicionou prazos 60/60/60.
