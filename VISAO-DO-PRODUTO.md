# OrchestraPlanner — Visão do Produto (Briefing)

> **Origem:** gerado pela sessão do Claude em `C:\projetos` a pedido do Joabe (dono do produto), para **transmitir e interpretar a visão** à sessão de **metodologia XP**. É a **fonte da verdade** do *o quê* e *por quê*. Execução em [PROGRESSO.md](PROGRESSO.md).
> **Última atualização:** 2026-06-17

---

## 1. O que é o OrchestraPlanner

Um **sistema de gestão de vida pessoal** que ajuda a pessoa a organizar a vida de forma integrada: **metas/prioridades, agenda, finanças e convívio entre pessoas (relacionamentos)**.

**Bases conceituais:**
- **Planner Líder de Impacto 2026** (BR Books / Oseias Gomes) — framework **Corpo / Alma / Espírito**, **Roda da Vida** (avaliação 0–10 por dimensão), **Lista/Árvore de Sonhos** (metas + marcos), plano de ação financeiro, "amigos aniversariantes".
- **IgrejasNet** (sistema de gestão de igreja) — modelo estruturado de **cadastro de pessoas** (dados pessoais, contato, endereço, **familiares/famílias**, aniversário) que inspira o módulo de Pessoas/Relacionamentos.

**Persona primária:** o próprio usuário organizando a vida — **cliente e administrador** ao mesmo tempo.

---

## 2. Brief do Produto (levantamento de requisitos)

1. **O que é / por quê:** produto **pessoal** para o Joabe se organizar em **financeiro, agenda e convívio entre pessoas**, em torno de **metas e prioridades**. Existe para dar organização e execução à vida.
2. **Para quem:** o **usuário-dono** (cliente + administrador), uso diário. **Futuramente SaaS pago**; primeiro uso próprio + testes.
3. **Onde:** **web** agora (uso local) → **nuvem** depois.
4. **Prazo:** 0–60 d web pessoal (1ª entrega) · +60 d público + app mobile · +60 d desktop.
5. **Custo/sucesso:** o dono programa (Claude como ferramenta); **sucesso = planejamento e metas 100% executados**, agenda e financeiro em dia.

---

## 3. Decisões travadas

| Decisão | Definição |
|---|---|
| **Público** | Começa **single-user (pessoal)**; arquitetura pronta para **SaaS pago** depois |
| **Visão SaaS** | **Produtividade pessoal** → multi-tenant por **`user_id`** (sem `organization_id`) |
| **Plataforma** | **Web** → mobile → desktop; design **API-first** |
| **Stack** | **Next.js 15 + tRPC + Drizzle + PostgreSQL (Neon) + shadcn/ui** |
| **Auth** | **Clerk** ✅ |
| **Metodologia** | **XP** (TDD, fatias verticais, iterações curtas, CI) |
| **Ordem dos módulos** | **Prioridades & Metas (MVP) → Agenda → Financeiro → Pessoas/Relacionamentos** *(Pessoas integra com Agenda — ver §8)* |
| **Áreas de Vida** | Padrão **Corpo / Alma / Espírito** com sub-áreas, **customizáveis** pelo usuário |
| **Financeiro** | **Simples** no MVP; **importação OFX/CSV só na última implementação** do módulo |

---

## 4. Áreas de Vida (Corpo / Alma / Espírito)

Modelo de **dois níveis**: 3 dimensões-raiz + sub-áreas seedadas (da Roda da Vida do planner), **todas editáveis/removíveis** pelo usuário.

| Dimensão | Sub-áreas padrão |
|---|---|
| **Espírito** | Vida Espiritual (relação com Deus) · Contribuição / Impacto Social |
| **Corpo** | Saúde & Disposição Física · Lazer & Descanso |
| **Alma** | Crescimento Pessoal & Intelectual · Vida Emocional · Felicidade · Carreira & Propósito · Finanças · Família · Relacionamento Conjugal · Vida Social |

Metas e prioridades pertencem a uma área; pessoas podem ser ligadas a áreas (Família, Conjugal, Social).

---

## 5. Arquitetura

- **API-first:** domínio numa **camada de serviço pura** (sem HTTP), exposta via tRPC → testável (TDD) e reaproveitável por mobile/desktop.
- `app/` (UI) ↔ `server/routers` (tRPC) ↔ `server/services` (domínio) ↔ `server/db` (Drizzle) ↔ PostgreSQL (RLS). Auth (Clerk) num adapter isolado.

### Modelo de dados (MVP + Pessoas)

```
users (id, email, name)

-- Áreas de Vida (Corpo/Alma/Espírito)
life_areas      (user_id, dimension['corpo'|'alma'|'espirito'], name, color, icon, position)

-- Metas & Prioridades
goals           (user_id, life_area_id, title, description, status, target_date, progress%)
 ├─ goal_milestones (user_id, goal_id, title, target_date, is_completed)   -- "Árvore de Sonhos"
 └─ priorities      (user_id, goal_id?, title, status[todo/in_progress/done], priority_level, due_date)
                    └─ priority_tags ──N:N── tags (user_id, name, color)

-- Roda da Vida (avaliação periódica)
life_assessments (user_id, life_area_id, score[0..10], assessed_at, notes)

-- Pessoas & Relacionamentos (CRM pessoal)
people          (user_id, name, nickname, photo_url, birth_date, gender, marital_status,
                 relation_type[familia|conjuge|amigo|mentor|colega|irmao_fe|outro], notes)
 ├─ people_contacts (person_id, kind[phone|email|social|address], label, value)
 ├─ person_links    (person_id, related_person_id, relation)   -- parentesco/relacionamento
 └─ interactions    (user_id, person_id, happened_at, kind, notes)  -- acompanhamento do convívio
circles         (user_id, name, kind[familia|celula|amigos|mentores|outro])
 └─ circle_members (circle_id, person_id, role)
```
Regras: todo registro carrega `user_id` + RLS. `progress` derivado de milestones/tarefas.

---

## 6. Backlog por módulo (XP)

### Épicos
1. **Prioridades & Metas** (MVP) ⭐ — áreas de vida, metas, marcos, prioridades (Kanban), dashboard
2. Conta & Autenticação (Clerk)
3. Onboarding (inclui 1ª **Roda da Vida**)
4. **Agenda** — calendário, compromissos, recorrência, lembretes
5. **Financeiro** — contas, lançamentos, orçamento, relatórios *(OFX/CSV na última iteração)*
6. **Pessoas & Relacionamentos** — ver §7
7. **Roda da Vida / Avaliação** — score 0–10 por área, gráfico radar, sugere onde criar metas
8. Infra & DevOps (transversal)

### Walking skeleton (1ª fatia de valor)
**Criar meta → ver na lista → marcar como concluída**, com 1 teste E2E (Playwright) verde no CI.

### Stories MUST do MVP (critérios testáveis — TDD)
- **US-1.1 Criar Meta** — título+descrição+área → "Ativa", `created_at`, validação.
- **US-1.2 Listar Metas** — ativas `updated_at DESC`, filtro por área, estado vazio com CTA.
- **US-1.3 Editar Meta** — salvar atualiza `updated_at`; cancelar descarta; "Salvar" off se vazio.
- **US-1.4 Alterar Status** — Ativa/Pausada/Completada; `completed_at`; transição inválida erra; histórico.

SHOULD: Priorizar (Kanban) · Marcos/progresso · Dashboard. COULD: Tags · Datas/lembretes · Exportar.

---

## 7. Módulo Pessoas & Relacionamentos (definição)

**O que é:** um **CRM pessoal de relacionamentos** — organizar o convívio com as pessoas importantes da vida, inspirado no cadastro do IgrejasNet e nos "amigos aniversariantes"/dimensões Família-Conjugal-Social do planner.

**Funcionalidades:**
- **Cadastro de pessoas:** nome, apelido, foto, **aniversário**, gênero, estado civil, tipo de relação, notas.
- **Contatos:** telefones, e-mails, redes sociais, endereço (múltiplos por pessoa).
- **Vínculos & círculos:** ligar pessoas entre si (parentesco/relação) e agrupar em **círculos/famílias** (família, célula, amigos próximos, mentores).
- **Interações (acompanhamento do convívio):** registrar encontros/contatos (data, tipo, nota); ver "há quanto tempo não falo com X".
- **Lembretes de relacionamento:** aniversários e "cuidar do relacionamento" → **integra com a Agenda**.
- **Conexões:** ligar pessoa a uma **área de vida** (Família/Conjugal/Social) e a **metas** de relacionamento.

**Fora do MVP de Pessoas (church-specific, só se virar útil):** cargos/funções, pré-cadastro com aprovação, geolocalização em mapa.

---

## 8. Decisões em aberto
1. **Posição do módulo Pessoas:** recomendo **logo após a Agenda** (aniversários/lembretes dependem do calendário) — ou manter como 4º após o Financeiro. ⚠️ confirmar.
2. **Roda da Vida:** entra já no **Onboarding** (1ª avaliação) ou vira módulo só na Fase 2? Recomendo uma versão mínima no Onboarding.
3. Campos "somente casado" (Relacionamento Conjugal) — exibir condicionalmente conforme estado civil.

*(Resolvidas: Auth=Clerk · Financeiro simples→OFX/CSV no fim · Áreas=Corpo/Alma/Espírito customizável · SaaS=produtividade pessoal.)*

---

## 9. Roadmap (prazos macro 60/60/60)

| Fase | Janela | Entrega |
|---|---|---|
| **1** | 0–60 d | App **web pessoal** (Metas → Agenda → Financeiro → Pessoas) + Roda da Vida no onboarding |
| **2** | 60–120 d | **Público (SaaS)** + **app mobile** |
| **3** | 120–180 d | **Desktop** |

### Iterações XP (~1 semana) — Fase 1
| Iter | Objetivo |
|---|---|
| **0** | Setup: repo, CI, Clerk (auth single-user), DB+RLS, walking skeleton, deploy automático |
| **1** | Áreas de Vida (seed Corpo/Alma/Espírito) + CRUD de Metas |
| **2** | Prioridades em Kanban + drag-and-drop |
| **3** | Marcos, progresso, dashboard + Roda da Vida (mínima) → **MVP Metas em produção** |
| 4–5 | Agenda (calendário + recorrência/lembretes) |
| 6 | Pessoas & Relacionamentos (cadastro, círculos, aniversários→agenda) |
| 7–8 | Financeiro (contas, orçamento, relatórios; OFX/CSV por último) |

**Caminho crítico:** Iter 0 → Metas → Prioridades → Dashboard → Agenda → (Pessoas / Financeiro).

### Checklist da Iteração 0
- [ ] Repo GitHub `orchestraplanner` + `create-next-app` (TS strict, Tailwind, App Router)
- [ ] Deps: `drizzle-orm`, `drizzle-kit`, `@trpc/*`, `zod`, `@clerk/nextjs`, `shadcn/ui`
- [ ] `docker-compose.yml` (Postgres local) + projeto Neon (produção)
- [ ] Schema `users` + migration; **RLS** + policy por `user_id`
- [ ] Clerk: login/logout + middleware protegendo `(app)/`
- [ ] tRPC: context com `user_id` + procedure `healthcheck`
- [ ] GitHub Actions: `typecheck` + `lint` + `vitest`; Vercel deploy no merge
- [ ] 1º teste unitário + 1º E2E (login → home) verdes

---

## 10. Requisitos não-funcionais
- **Privacidade:** dados pessoais/financeiros sensíveis — criptografia em trânsito/repouso; RLS como barreira dupla.
- **Multi-tenant-ready** desde o dia 1 (`user_id` + RLS).
- **Performance:** índices em `(user_id, created_at)` e `(user_id, status)`.
- **Acessibilidade:** WCAG 2.1 AA.
