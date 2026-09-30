# OrchestraPlanner

Sistema de **gestão de vida pessoal**: metas e prioridades, agenda, finanças e o convívio entre
pessoas, integrados sobre o framework **Corpo / Alma / Espírito** (12 áreas de vida).

> **Status:** **Fase 1 completa e em produção** (uso pessoal). Em manutenção. As Fases 2 e 3 estão
> congeladas no backlog. Estado do dia: [PROGRESSO.md](PROGRESSO.md).

## O que existe hoje
| Módulo | O que faz |
|---|---|
| **Prioridades & Metas** | Áreas de vida, metas com marcos e progresso, Kanban de prioridades com tags, painel e Roda da Vida |
| **Agenda** | Semana e mês, recorrência guardada como regra, exceção numa ocorrência, lembretes por Web Push (PWA) |
| **Pessoas & Relacionamentos** | Cadastro e contatos, vínculos e círculos, interações ("há quanto tempo não falo"), aniversários na agenda |
| **Financeiro** | Contas e lançamentos em centavos inteiros, orçamento por categoria, relatórios, importação OFX/CSV com conciliação |
| **Conta** | Fuso horário, exportar todos os dados (JSON) e apagar a conta (LGPD) |

## Stack
**Next.js 16 · React 19 · tRPC 11 · Drizzle ORM · PostgreSQL (Neon) · Clerk · Tailwind 4 + shadcn/ui ·
Vitest + Playwright · Vercel · GitHub Actions**

- **Isolamento por usuário na RLS do Postgres:** toda tabela tem `user_id` com
  `ENABLE + FORCE ROW LEVEL SECURITY`, e a app conecta com um role **sem** `BYPASSRLS`. O CI prova
  o isolamento contra um Postgres real.
- **Segurança:** CSP obrigatória com nonce, HSTS e demais cabeçalhos, teto de chamadas por
  usuário, Dependabot e `npm audit` barrando o CI. TLS `verify-full` no código e no CI; na
  Vercel, a troca está pendente (#91).
- **Regra de domínio pura** (sem banco) ao lado de cada serviço: é ela que os testes exercitam em
  milissegundos.

## Rodar local
```bash
npm install
cp .env.example .env      # preencha DATABASE_URL e as chaves do Clerk (docs/SETUP.md)
npm run db:migrate
npm run dev
```
| Comando | Para quê |
|---|---|
| `npm test` | Vitest. Sem `DATABASE_URL`, os testes de integração são pulados |
| `npm run test:e2e` | Playwright (precisa das chaves do Clerk e do usuário de teste) |
| `npm run typecheck` · `npm run lint` · `npm run format` | Qualidade |
| `npm run db:generate` | Gera migration a partir do schema |

Setup completo (Neon, Clerk, Vercel, segredos do CI, webhook): [docs/SETUP.md](docs/SETUP.md).

## Documentação
- [VISAO-DO-PRODUTO.md](VISAO-DO-PRODUTO.md): visão, decisões, modelo de dados
- [PROGRESSO.md](PROGRESSO.md): diário de bordo (estado atual)
- [docs/sessions/](docs/sessions/): registro de cada sessão e o histórico arquivado do diário
- [docs/ERROS.md](docs/ERROS.md): erros cometidos e a lição de cada um
- [docs/FORMATACAO.md](docs/FORMATACAO.md): convenções de código e arquitetura

## Roadmap
| Fase | Entrega | Situação |
|---|---|---|
| 1 | App web pessoal (Metas → Agenda → Pessoas → Financeiro) | ✅ Completa (2026-08-22) e auditada (2026-09-30) |
| 2 | Público (SaaS multiusuário) + app mobile | 🧊 Congelada (#21) |
| 3 | Desktop | 🧊 Congelada (#22) |
