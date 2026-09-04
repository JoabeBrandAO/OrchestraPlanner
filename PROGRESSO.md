# OrchestraPlanner — Progresso (Diário de Bordo)

> **Para que serve:** log compartilhado entre as sessões do Claude (visão de produto e metodologia XP) e visível no GitHub.
> **Convenção:** atualizar **a cada sessão de trabalho**. Seções — ✅ Feito · 🔄 Fazendo · 📋 A fazer + **Histórico** (data + quem + o quê).

---

## Estado atual — atualizado em 2026-09-03

### ✅ Feito
- Brief do produto completo (o quê/porquê, para quem, onde, prazos 60/60/60, métrica de sucesso) — [VISAO-DO-PRODUTO.md](VISAO-DO-PRODUTO.md).
- Decisões travadas: público (pessoal → SaaS), plataforma (web→app→desktop), stack (Next.js+tRPC+Drizzle+Postgres), XP, ordem dos módulos, SaaS=produtividade pessoal (`user_id`).
- **Decisões fechadas:** Auth = **Clerk** · Financeiro **simples** (OFX/CSV só na última iteração) · Áreas de Vida = **Corpo/Alma/Espírito** + 12 sub-áreas, **customizáveis**.
- **Bases conceituais estudadas:** *Planner Líder de Impacto 2026* (Roda da Vida 12 dimensões, Lista/Árvore de Sonhos, plano financeiro, amigos aniversariantes) e **IgrejasNet** (CRUD de pessoas: dados, contato, endereço, familiares, famílias, aniversário).
- **Módulo Pessoas & Relacionamentos definido** (CRM pessoal — ver §7 da visão).
- Modelo de dados estendido: `life_areas` (com dimensão), `life_assessments` (Roda da Vida), `people`/`circles`/`interactions`.
- **Infra Mega_Build (auto-bootstrap §2/§3/§7/§8)** — sessão mão-na-massa: papel gravado (`.claude/PAPEL` = Desenvolvedor de Software), `.claude/settings.json` (permissões + hooks), hooks `PostToolUse` (format) e `Stop/SubagentStop` (report), slash commands `/test-cycle` `/status` `/erro`, skill `senior-dev-cycle`, `docs/ERROS.md` + `docs/FORMATACAO.md`. Hooks testados ✅ (1 bug de encoding detectado e corrigido — ver ERROS.md).

- **Módulo Prioridades & Metas (épico 1) entregue** — Iteração 0 (setup + walking skeleton),
  1 (Áreas de Vida + Metas), 2 (Prioridades/Kanban + Tags) e 3 (Marcos + Dashboard + Roda da
  Vida). Tudo sob RLS por `user_id`, com serviço de domínio puro + tRPC + UI em português.

- **Módulo Agenda (#18) — COMPLETO:** recorrência guardada como regra e expandida na leitura,
  visão de semana e de mês, edição pela tela, **exceções numa ocorrência da série** (cancelar,
  remarcar, reescrever um dia) e **lembretes de verdade por Web Push**, disparados por
  workflow a cada 5 minutos.

- **Módulo Pessoas & Relacionamentos (#19) — COMPLETO:** cadastro e contatos, círculos e
  vínculos (uma linha por par, com o inverso derivado), interações com "há quanto tempo não
  falo com X", e aniversários na Agenda derivados da data em `people`.

- **Módulo Financeiro (#20) — COMPLETO:** contas e lançamentos (#52), orçamento por categoria
  (#53), relatórios e panorama (#54) e **importação OFX/CSV com conciliação (#55)**. Dinheiro
  em centavos inteiros; saldo, realizado e agregações todos derivados.
- **Financeiro — buracos do checkpoint fechados (2026-09-03):** **editar lançamento (#62)**,
  preservando o `external_id` (reimportar o mesmo extrato continua conciliando em vez de
  duplicar), e **gerenciar categorias na tela (#63)** — criar, renomear e remover, com o
  lançamento da categoria removida passando a contar como "Sem categoria".
- **🏁 Fase 1 (uso pessoal) fechada:** Prioridades & Metas, Agenda, Pessoas & Relacionamentos e
  Financeiro entregues, no ar na Vercel, sob RLS por `user_id`.

- **Infra e qualidade:** E2E de login passando ponta a ponta (#7), secrets do CI cadastrados
  (#6), senha exposta rotacionada (#30), padrão de "novo registro" em janela flutuante em
  todas as telas de cadastro, e **teto testado** para custo de interação (commits do React) e
  de leitura (statements no banco).

### 🔄 Fazendo
- **Nada em andamento.** Fase 1 fechada (#55) e os dois achados do checkpoint entregues
  (#62/#63). O que vem depois é decisão do dono: dívida técnica (#57 E2E no CI, #58 moldura
  da transação) ou começar a **Fase 2** (#21 — SaaS multiusuário + app mobile).
- _Nota:_ a divisão "sessão de Visão × sessão Mão-na-massa" das primeiras iterações não vale
  mais — desde 2026-08-15 uma sessão só cuida de docs e código. `PROGRESSO.md` segue sendo o
  terreno comum, com **append** no Histórico.

### 📋 A fazer (próximo)
- **Na mão do dono (2026-08-22):**
  1. **Segredos do Clerk no GitHub** — `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`,
     `E2E_CLERK_EMAIL`, `E2E_CLERK_PASSWORD`. Hoje o repo só tem `DATABASE_URL`,
     `MIGRATION_DATABASE_URL` e `VAPID_PRIVATE_KEY`; sem eles o **#57** não sai do lugar — e
     com merge autônomo, o E2E de login é a única rede que pega regressão de autenticação.
  2. **Validação manual** do Financeiro (#52/#53), dos vínculos e convívio de Pessoas e das
     exceções e lembretes da Agenda. Cada fatia nova se empilha na anterior.
  3. ~~Deploy na Vercel~~ — **já feito**: a produção roda desde 2026-08-15 e o PR #59 gerou
     preview automático. O registro de "deploy pendente" aqui no diário era história velha
     lida como estado atual; corrigido.
- **Autonomia acordada (2026-08-22):** trabalho em branch, abro PR e **mergeio sozinho com o CI
  verde**; CI vermelho deixa o PR aberto esperando o dono.
- **Validação manual da Fase 1 (#64)** — roteiro completo na issue; é o principal ponto de
  controle humano agora que o merge é autônomo.
- ~~**Achados do checkpoint** (#62 editar lançamento, #63 gerenciar categorias)~~ —
  **entregues em 2026-09-03**.
- **Próximo passo é escolha do dono:** dívida técnica (#57/#58) ou a **Fase 2** (#21 — SaaS +
  app mobile). O **#57** segue travado nos segredos do Clerk no GitHub.
- **Dívidas técnicas registradas:** rodar o E2E no CI (**#57**) e cortar a moldura da
  transação, que hoje é 3 dos 4 statements de toda leitura (**#58**).
- Épicos seguintes: Pessoas & Relacionamentos (#19), Financeiro (#20), Fase 2/3 (#21/#22).

---

## Histórico
- **2026-06-17 — Sessão de Visão:** criou VISAO-DO-PRODUTO.md e PROGRESSO.md; coletou brief; estudou o PDF do planner e o help do IgrejasNet; fechou Auth/Financeiro/Áreas; **definiu o módulo Pessoas/Relacionamentos** e a Roda da Vida; adicionou prazos 60/60/60.
- **2026-06-18 — Sessão Mão-na-massa:** verificou o `Mega_Build.md` (nada da infra §2 existia) e executou o **auto-bootstrap** completo: papel, permissões, hooks, slash commands, skill, `docs/ERROS.md`, `docs/FORMATACAO.md`. Testou os hooks; detectou e corrigiu bug de encoding UTF-8 no `report.ps1` (1ª entrada de `ERROS.md`). Acordou a divisão de trabalho com a sessão de Visão.
- **2026-06-19 — Sessão Mão-na-massa (Iteração 0):**
  - Consolidou o bootstrap em 2 commits limpos (`97812b6` infra, `e45eef2` docs) + push.
  - Criou as **25 issues** no GitHub (`#1`–`#25`) + 10 labels + 3 milestones via `scripts/create-github-issues.ps1`.
  - **#1 ✅** Next.js 16 + TS strict + Tailwind v4 + shadcn/ui + Prettier + `.gitattributes`. typecheck/lint/build verdes (`2c85664`, `fac686f`). _Nota: Next 16 (latest) em vez do 15 da visão — a confirmar._
  - **#2 ✅** Drizzle + postgres-js + drizzle-kit + zod + dotenv; client lazy; `docker-compose.yml`; `.env.example`; scripts `db:*`. typecheck/lint verdes; `db:generate` lê o config (`d89ffc1`).
  - **#3 🟡 código pronto** (`44e50aa`) — schema `users`, migrations 0000+0001 (RLS ENABLE+FORCE+policy), `withUserContext()`, teste de isolamento (`skip` sem DB). _Falta: rodar com `DATABASE_URL` p/ provar isolamento._
  - **#5 ✅** (`72b17e1`) — tRPC (context `userId`, `protectedProcedure`, `healthcheck`), route handler, client React no layout, teste unitário do router verde.
  - **#4 🟡 código pronto** (`aeb6dba`) — ClerkProvider, middleware (`/dashboard`), sign-in/up, dashboard (UserButton + upsert), landing auth-aware. Build verde sem chaves. _Falta: chaves Clerk p/ login real._
  - **#7 🟡 unit ✅ / E2E pendente** (`d1a43cb`) — `validateGoalTitle` + 5 testes verdes; Playwright + spec login→home (`skip` sem chaves). _Falta: rodar E2E com Clerk._
  - **#6 ✅ CI / deploy pendente** (`2153dbe`,`907bb17`) — GitHub Actions (typecheck·lint·test·build) **verde** em ~44s. `docs/SETUP.md`. _Falta: conectar Vercel; branch protection é decisão do dono._
  - **Resumo Iteração 0:** Phase A (tudo sem segredo) **concluída e verde**. Phase B (Neon + Clerk + Vercel) documentada em `docs/SETUP.md`; issues #3/#4/#6/#7 abertas com comentário do que falta.
- **2026-06-20 — Sessão Mão-na-massa (Phase B / Neon):**
  - **#3 ✅ PROVADO** — RLS isolando de verdade contra o Neon. Banco real conectado (`DATABASE_URL`), migrations aplicadas, suíte **11/11 verde** (4 testes de RLS rodando, antes pulados).
  - **Achado de segurança:** o `neondb_owner` e todo role criado pelo **Console do Neon** vêm com `BYPASSRLS` → a RLS era furada em silêncio (e `ALTER ROLE NOBYPASSRLS` é negado pelo Neon). Via oficial: criar o role da app **via SQL** (`app_rls`, sem BYPASSRLS). Registrado em `docs/ERROS.md` (2026-06-20).
  - **Arquitetura de 2 roles:** `DATABASE_URL` = `app_rls` (restrito, runtime) · `MIGRATION_DATABASE_URL` = `neondb_owner` (migrations/DDL). Atualizados `drizzle.config.ts`, `.env(.example)`, `docs/SETUP.md`.
  - **Blindagem:** `rls.test.ts` agora tem teste fail-safe que assere `rolbypassrls = false` no role corrente; `vitest.config.ts` carrega `.env` via `dotenv/config`. `users.ts` (upsert) já usava `withUserContext` → app RLS-safe em runtime.
  - typecheck · lint · build verdes. _Falta Phase B: chaves Clerk (#4/#7) e deploy Vercel._
- **2026-06-20 (cont.) — Sessão Mão-na-massa (Iteração 1, autônoma):**
  - **#3 fechada** na `main` (`4e05e71`): migration `0002` (GRANTs idempotentes do `app_rls`) + commit + issue fechada.
  - **Iteração 1** entregue na branch `feat/iteracao-1-metas` (PR aberto — Closes #8–#12):
    - **#8 Áreas de Vida** — `life_areas` + enum dimensão; seed idempotente das 12 sub-áreas padrão (Visão §4) no upsert; serviço CRUD + tRPC; UI `/dashboard/areas`.
    - **#9–#12 Metas (US-1.1…1.4)** — `goals` + status enum; serviço `createGoal/listGoals/updateGoal/changeGoalStatus` (máquina de estados pura `canTransition`, reusa `validateGoalTitle`); tRPC `goals`; UI `/dashboard/metas` (criar/listar/editar/status + estado vazio). Walking skeleton de negócio coberto por unit/integração.
    - Migrations `0003` (tabelas) + `0004` (RLS ENABLE+FORCE+policy por `user_id`). Tudo sob `withUserContext` → RLS isola.
    - Qualidade: helper `migrateForTests`; `docs/FORMATACAO.md` atualizado. **Suíte 23 verdes**; typecheck·lint·build verdes.
  - **Decisões abertas registradas:** Next 16 vs 15 (**#26**, nova); #23/#24/#25 (produto). Bloqueios comentados em #4/#6/#7.
  - **Pendência do dono:** apagar o role órfão `app_user` (Console, BYPASSRLS) no Neon.
- **2026-08-11 — Sessão Mão-na-massa (Iteração 2: Prioridades + Tags):**
  - **Iteração 1 fechada:** PR #27 mergeado na `main` (`4ed22de`); issues **#8–#12 fechadas**.
  - **Iteração 2** entregue na branch `feat/iteracao-2-prioridades` (Closes #13–#14):
    - **#13 Prioridades (Kanban)** — tabela `priorities` (status/position/nível/prazo, meta opcional);
      `computeReorder` puro (matemática do DnD, testada sem banco) + `movePriority` numa transação,
      mantendo as posições contíguas; regra de `completed_at` isolada em `priority-status.ts`.
    - **#14 Tags** — `tags` + junção `priority_tags` (com `user_id` próprio para a RLS isolar a
      associação); `createTag` idempotente case-insensitive (índice único em `lower(name)`);
      `setPriorityTags` substitui o conjunto; filtro por tag.
    - Migrations `0005` (tabelas) + `0006` (RLS ENABLE+FORCE+policies + GRANTs ao `app_rls`),
      **aplicadas no Neon**.
    - UI `/dashboard/prioridades`: board de 3 colunas com **@dnd-kit** (sensores de teclado —
      mover card sem mouse), update otimista no cache do React Query, editor de tags com
      autocomplete, filtros por meta/tag, link no dashboard.
    - `validateGoalTitle` promovido a `shared/validate-title` (Metas e Prioridades usam a mesma regra).
  - Qualidade: **suíte 38 verdes** (era 23), typecheck · lint · format · build verdes.
    2 erros registrados em `docs/ERROS.md` (diff que apagava a própria mudança; import de serviço
    puxando `postgres` para o bundle do client) e as lições viraram convenção em `FORMATACAO.md`.
  - **Ainda bloqueado no dono:** chaves do Clerk (#4/#7 — sem elas `/dashboard` responde 404 em
    modo keyless, então a validação manual no browser fica pendente), deploy Vercel (#6), role
    órfão `app_user` no Neon, decisões #23–#26.
- **2026-08-11 (cont.) — fechamento da sessão** (log completo em
  [docs/sessions/2026-08-11-iteracao-2.md](docs/sessions/2026-08-11-iteracao-2.md)):
  - **PR #28 e #29 mergeados**; #13 e #14 fechadas. Correções do 1º teste manual do dono: a tag
    digitada era descartada ao salvar (só o `Enter` a criava), e os selects de filtro agora
    dizem "Nenhuma meta/tag ainda" em vez de fingir um filtro vazio.
  - **Decisões #23–#26 fechadas** — §8 da Visão zerada. **#4 (Clerk) fechado.**
  - **Neon limpo** (verificado por query): `app_user` removido, `app_rls` com
    `rolbypassrls = false`.
  - **#7 parcial:** a suíte E2E passava "verde" **pulando os dois testes** (o Playwright nunca
    carregava o `.env`). Corrigido + seletores estáveis + `@clerk/testing`. A landing pública
    passa de verdade; o login para em `/sign-in/client-trust` — falta desligar a proteção
    anti-bot na instância de desenvolvimento do Clerk.
  - **🔴 Incidente de segurança (#30):** credenciais de teste foram publicadas no `.env.example`
    (repo público) pelo commit `ed711e8` e **a senha ainda é válida**. Rotacionar no Clerk.
  - **Próximo:** Iteração 3 — #15 Marcos · #16 Dashboard · #17 Roda da Vida.
- **2026-08-13 — Sessão Mão-na-massa (Iteração 3: Marcos + Dashboard + Roda da Vida):**
  - Entregue na branch `feat/iteracao-3-marcos` (Closes #15–#17):
    - **#15 Marcos** — `goal_milestones` (conclusão só por `completed_at`, sem booleano
      paralelo); `computeProgress` puro traduz concluídos/total em % e o serviço recalcula
      `goals.progress` **na mesma transação** de toda mutação — a coluna vira cache, não uma
      segunda verdade. UI: barra por meta + painel de marcos que só consulta ao abrir.
    - **#16 Dashboard de metas** — cards (ativas/vencidas/progresso/concluídas), distribuição
      por área e atividade recente (metas mexidas + marcos concluídos). Agregação pura em
      `dashboard/summary.ts`; "vencida" inclui a pausada e a média ignora as concluídas.
      O "hoje" é injetável, então o teste não vira com o dia.
    - **#17 Roda da Vida** — `life_assessments` com **uma linha por área** e o mesmo
      `assessed_at` por rodada (grupo exato → histórico real); notas validadas antes de
      qualquer escrita; radar em SVG à mão (geometria testada em `wheel.ts`, sem biblioteca
      de gráficos); sugestão das menores notas; convite de onboarding no `/dashboard`.
    - Migrations `0007`/`0009` (tabelas) + `0008`/`0010` (RLS ENABLE+FORCE+policies + GRANTs),
      **aplicadas no Neon**.
  - Qualidade: **suíte 71 verdes** (era 38), typecheck · lint · format · build verdes.
    Convenções novas registradas em `FORMATACAO.md` (valor derivado, retrato completo na
    mutação, formulário com fallback do servidor, "hoje" injetável).
  - **Ainda bloqueado no dono:** 🔴 **#30 rotacionar a senha de teste do Clerk** (segue
    válida no repo público), proteção anti-bot do Clerk para o E2E de login (#7), deploy
    Vercel (#6). Validação manual no browser das telas novas também pende do Clerk.
- **2026-08-13 (cont.) — Sessão Mão-na-massa (Iteração 4: Agenda + correções):**
  - **PR #31 mergeado** (`42fdc8f`); **#15, #16 e #17 fechadas**. Dono validou as três telas
    no browser: metas/marcos, panorama e roda da vida funcionando.
  - 🐛 **Bug achado pelo dono:** Áreas de Vida apareciam **duplicadas**. Causa: o seed era
    idempotente por um `if` (*check-then-act*) e `ensureUserRecord()` roda em toda página —
    dois requests simultâneos de usuário novo inseriam as 12 áreas cada. Corrigido com
    índice único `(user_id, lower(name))` + `on conflict do nothing` (migration `0011`,
    que **remapeia metas e avaliações** antes de apagar cópias). Registrado em `ERROS.md`.
  - **#6 automatizado:** `.github/workflows/migrate.yml` aplica as migrations no merge para
    `main` que toque `drizzle/` — nunca no build da Vercel, que roda em preview de cada PR.
    _Falta o dono cadastrar o secret `MIGRATION_DATABASE_URL`._
  - **Iteração 4 — Agenda (#18), 1ª fatia:** tabela `events`; recorrência guardada como
    **regra** e expandida na leitura (`recurrence.ts` puro, 13 testes: mês sem o dia é
    pulado, ocorrência que atravessa a janela entra, intervalo inválido não vira laço);
    lembrete (minutos antes) e **bloco de tempo para uma prioridade**. Migrations `0012`
    (tabela) + `0013` (RLS), aplicadas no Neon. UI `/dashboard/agenda` com navegação semanal.
  - Qualidade: **suíte 93 verdes** (era 71), typecheck · lint · format · build verdes.
  - **E2E ainda travado (#7):** rodado nesta sessão, o login para em `/sign-in/client-trust`
    — a proteção anti-bot do Clerk continua ativa. A landing pública passa.
- **2026-08-15 — Sessão Mão-na-massa (Iteração 5: visão de mês + edição pela tela):**
  - **PR #32 mergeado** na `main` (`fcdc3e6`, squash). O épico **#18 foi reaberto**: a
    1ª fatia da Agenda entrou, mas #33–#36 ainda pertencem a ele.
  - Entregue na branch `feat/iteracao-5-agenda-mes` (Closes #33–#34):
    - **Refatoração da tela** — `agenda-week.tsx` (322 linhas fazendo tudo) virou container
      (`agenda.tsx`: modo, âncora, queries e mutações) + visões que **só desenham**
      (`agenda-week.tsx`, `agenda-month.tsx`) + **um formulário só** (`event-form.tsx`)
      para criar e editar. A navegação passou de "deslocamento em semanas" para uma
      **data-âncora** — sem isso, "clicar num dia abre a semana dele" não se expressa.
    - **#33 Visão de mês** — grade de semanas inteiras (4 a 6 linhas, calculadas: um
      fevereiro que começa na segunda não ganha linha vazia), dias vizinhos esmaecidos,
      hoje destacado, até 3 compromissos por dia + "＋N", clique abre a semana daquele dia.
      Reusa `events.list`, que já expande a recorrência em qualquer janela.
    - **#34 Editar pela tela** — clicar no compromisso abre o mesmo formulário preenchido e
      salva por `events.update`. Numa série, o formulário mostra os horários **da regra**
      (não os da ocorrência clicada) e avisa que a edição vale para toda a série — senão
      salvar moveria a âncora da série em silêncio. A exceção numa ocorrência é a #35.
      Ganhou também o campo **descrição**, que existia no schema e faltava na tela.
    - `events/calendar.ts` — matemática pura da grade, **sem banco**: passo por
      `setDate`/`setMonth` (com horário de verão o dia não tem 24 h) e no **fuso local**,
      ao contrário da recorrência, que expande em UTC.
  - Qualidade: **suíte 115 verdes** (era 93; +22 na grade do calendário), typecheck · lint ·
    format · build verdes. **Sem migration nesta fatia** — nada mudou no schema.
- **2026-08-15 (cont.) — correção do formulário da Agenda (teste manual do dono):**
  - 🐛 **Reportado:** o formulário não limpava depois de salvar, a escolha de data/hora
    estava travada e reutilizava os horários do evento anterior, e o lembrete tinha atraso.
  - **Duas causas, um sintoma.** (a) Eu havia semeado o próximo formulário com o dia e a
    repetição recém-usados "para poupar digitação" — na prática, campo pré-preenchido é
    campo para apagar. (b) Todos os campos eram **controlados**: cada tecla virava um
    render e o React reescrevia o campo logo depois, o que num `datetime-local` faz o campo
    brigar com quem digita. Registrado em `docs/ERROS.md`.
  - **Ciclo TDD:** teste primeiro, medindo o custo por tecla em **commits do React**
    (`Profiler`) — determinístico, ao contrário de milissegundos no CI. Linha de base
    medida: **22 teclas = 22 commits**. Depois da correção: **0 commits**.
  - **Correção:** formulário volta em branco (o container só troca a `key`); campos passaram
    a **não controlados** (`defaultValue`), com as regras puras em `event-fields.ts` e o
    estado guardando só o veredito "pode salvar / janela invertida" — quando ele não muda, o
    *setter* devolve o objeto atual e o React aborta sem render. Lembrete ganhou `datalist`
    com os valores comuns (5, 10, 15, 30, 60, 120).
  - **Ganho medido:** mediana **15,22 ms → 4,44 ms** por preenchimento (30 rodadas com as
    duas implementações alternadas no mesmo processo) — **−70,8%**, acima dos 40% pedidos.
  - Primeiros **testes de componente** do repositório (jsdom + Testing Library, devDeps).
    Suíte **139 verdes** (era 115); typecheck · lint · format · build verdes.
- **2026-08-15 (cont.) — formulário da Agenda numa janela flutuante:**
  - A pedido do dono, marcar e editar saíram do fim da página para um **modal**, aberto pelo
    botão "+ Novo compromisso" (ou clicando num compromisso, que abre a mesma janela em modo
    de edição). A agenda passa a ocupar a tela inteira.
  - `src/components/ui/dialog.tsx` — wrapper fino sobre o `Dialog` do `@base-ui/react`, que
    já entrega foco preso, `Esc`, clique fora e o resto da página escondido do leitor de
    tela. No mesmo padrão do `button.tsx`: só estilo, sem lógica. No celular a janela rola
    por dentro (`max-h-[90svh]`), senão o botão de salvar ficaria fora do alcance.
  - Fechar **desmonta** o formulário, então a limpeza entre uma marcação e a seguinte deixou
    de precisar do contador de `key` no container.
  - Suíte **146 verdes** (era 139; +7 na janela); typecheck · lint · format · build verdes.
- **2026-08-15 (cont.) — padrão de "novo registro" em todas as telas de cadastro:**
  - A pedido do dono, o botão + janela flutuante da Agenda virou o padrão de **Áreas de
    Vida**, **Metas** e **Prioridades**: o formulário sai do topo da página (onde empurrava
    a lista para baixo) e passa a abrir por `+ Nova …`. Nas Metas, o estado vazio também
    ganhou o botão — é onde a primeira meta nasce.
  - Peças novas: `components/ui/form-dialog.tsx` (janela de cadastro, usada inclusive pela
    Agenda) e `lib/form.ts` (`fieldValue`/`hasText` — leitura de formulário não controlado,
    uma implementação só).
  - Cada formulário virou **componente próprio** (`area-form`, `goal-form`, `priority-form`)
    que recebe opções e devolve valores de domínio, sem conhecer tRPC — por isso os três
    ganharam teste de componente sem precisar de provider. Todos seguem o padrão não
    controlado da correção anterior.
  - **Ficaram inline de propósito:** marcos (um campo dentro de um painel já aberto), tags
    (autocomplete dentro do card) e a Roda da Vida (as 12 notas *são* a tela, e o radar ao
    lado é o ponto). Modal ali seria mais clique para menos.
  - Suíte **158 verdes** (era 146; +12 nos formulários); typecheck · lint · format · build
    verdes.
- **2026-08-15 (cont.) — Agenda: exceções numa ocorrência da série (#35):**
  - **PR #38 mergeado** (`2b94d29`). Fatia entregue na branch `feat/agenda-excecoes`.
  - **Tabela `event_exceptions`** (migrations `0014` + `0015` RLS/GRANTs, **aplicadas no
    Neon**), chaveada pelo instante **original** que a regra produz — o `RECURRENCE-ID` do
    RFC 5545. Só o que é daquele dia pode ser sobrescrito (horário, título, descrição);
    repetição, lembrete, área e prioridade seguem sendo da série.
  - **As duas armadilhas, resolvidas e testadas:** mover a âncora da série desloca as
    exceções pelo mesmo delta **na mesma transação** (senão elas deixariam de casar em
    silêncio); trocar frequência/intervalo **descarta** as exceções da regra antiga. E a
    expansão confere se o instante é mesmo um passo da regra (`isOccurrenceStart`), então
    uma sobra nunca ressuscita compromisso nenhum.
  - Expansão pura cobre remarcada **para fora** (some da janela) e **para dentro** (aparece,
    mesmo vindo de um instante fora dela).
  - **UI:** clicar num compromisso de série abre a janela com o seletor
    **"Só esta ocorrência" | "Toda a série"** (padrão: só esta). No escopo da ocorrência,
    os campos da série somem. A **remoção saiu da lista** e foi para dentro da janela, com
    o rótulo dizendo a consequência ("Remover só este dia" / "Remover a série") — o botão
    solto de antes apagava a série inteira sem perguntar. Dia alterado se anuncia na lista,
    e há "Voltar ao horário da série" para desfazer.
  - Suíte **188 verdes** (era 158): +13 puros, +11 de integração com RLS, +6 de componente.
    typecheck · lint · format · build verdes.
- **2026-08-15 (cont.) — Agenda: lembretes de verdade, por Web Push (#36):**
  - **PR #39 mergeado** (`88a2ada`). Canal escolhido pelo dono: **Web Push**.
  - **Desenhado para não exigir nada dele na Vercel:** a chave VAPID **pública** vai no
    código (é pública por design — o navegador a recebe em toda inscrição), e o segredo
    vive só no GitHub Secrets, onde as migrations já viviam.
  - **Tabelas** `push_subscriptions` (a inscrição do navegador) e `reminder_sends` (a marca
    que impede o reenvio), migrations `0016` + `0017` (RLS/GRANTs), **aplicadas no Neon**.
  - **Disparo:** workflow `reminders.yml` a cada 5 min roda `scripts/send-reminders.ts`.
    **Duas conexões de propósito:** a única leitura através dos usuários (quem tem
    inscrição) usa o role elevado; todo o resto passa por `withUserContext` na conexão
    restrita, então quem isola continua sendo a RLS, não a disciplina do laço.
  - **Reserva antes de enviar** (`claimReminder`): se duas passadas se cruzarem, só uma
    manda; falhou o envio, a reserva é devolvida e a próxima passada tenta. Inscrição morta
    (404/410) é apagada em vez de ser tentada para sempre.
  - **No app:** service worker (`public/sw.js`, só notificação — sem cache), botão
    "Ativar lembretes" na Agenda, e manifest + ícones PWA, **porque no iPhone o Web Push só
    existe para site adicionado à Tela de Início**.
  - **Secrets cadastrados por mim** via `gh`: `DATABASE_URL`, `MIGRATION_DATABASE_URL` e
    `VAPID_PRIVATE_KEY`. Isso **destrava o #6** — o workflow de migrations parou de falhar
    por falta do secret.
  - **Limite declarado:** o agendador do GitHub atrasa (5–15 min). O script manda tudo que
    venceu na última hora, então nada se perde, mas um lembrete pode chegar atrasado. A
    troca por precisão de minuto é o Vercel Cron (plano Pro).
  - Suíte **209 verdes** (era 188): +12 puros (vencimento e teto de recuperação), +9 de
    integração sob RLS. typecheck · lint · format · build verdes.
- **2026-08-15 (cont.) — Pessoas & Relacionamentos: cadastro e contatos (#41):**
  - **PR #40 mergeado** (`0b775ed`); **épico da Agenda (#18) completo**. Épico #19 fatiado em
    **#41** (cadastro e contatos), **#42** (círculos e vínculos), **#43** (interações e "há
    quanto tempo não falo") e **#44** (aniversários na Agenda).
  - **Decisão de modelo:** o aniversário é **dia, mês e ano opcional**, não uma `date`. Muita
    gente sabe o dia e o mês de alguém e não sabe o ano; um `date` obrigaria a inventar um ano
    e depois fingir que ele não existe — e alguém acabaria mostrando idade errada. Sem ano,
    não há idade a mostrar.
  - **29 de fevereiro comemora em 28/02** nos anos comuns: continua no mês em que a pessoa
    nasceu, e é melhor que pular três aniversários em cada quatro.
  - **Decisão #25 implementada dos dois lados:** a data de casamento só aparece para
    casado/união estável **e** só é gravada nesses casos. Campo escondido que continua sendo
    salvo vira dado fantasma, que reaparece quando o estado civil muda de novo. O **cônjuge**
    não entra como texto — é um vínculo, e vem na #42.
  - Tabelas `people` e `people_contacts` (migrations `0018` + `0019` RLS/GRANTs, **aplicadas
    no Neon**); tela `/dashboard/pessoas` no padrão de janela flutuante, com painel de
    contatos inline por pessoa.
  - Suíte **246 verdes** (era 209): +15 puros (aniversário), +12 de integração sob RLS,
    +10 de componente. typecheck · lint · format · build verdes.
- **2026-08-15 (cont.) — correções do teste manual + Pessoas #42:**
  - 🐛 **Botão duplicado** no estado vazio de Pessoas ("+ Nova pessoa" no topo e no card).
    A barra de cima agora só existe quando há lista. **As Metas tinham o mesmo defeito**,
    herdado do mesmo padrão, e foram corrigidas junto (PR #46).
  - 🐛 **Data de nascimento**: de três campos para **um** `<input type="date">` com `max` no
    dia de hoje — o calendário nativo não oferece data futura, sem precisar de mensagem. O
    domínio confere de novo (`isValidBirthday` recusa futuro, com "hoje" injetável).
    _Custo assumido:_ pela tela não dá mais para cadastrar aniversário **sem ano**; o modelo
    continua aceitando. Se voltar a fazer falta, o caminho é máscara `dd/mm/aaaa`.
  - **Aba de Pessoas validada pelo dono.**
  - **#42 — círculos e vínculos:** tabelas `person_links`, `circles` e `circle_members`
    (migrations `0020` + `0021`, **aplicadas no Neon**).
    - **Vínculo é uma linha só**, nunca duas: duas linhas (A→B e B→A) divergem assim que
      alguém edita um lado. O par é gravado em **ordem canônica** e a leitura do outro lado
      é derivada pelo **inverso** (`relations.ts`, puro: pai↔filho, avô↔neto, mentor↔
      mentorado; cônjuge, irmão e primo são o próprio inverso). Dois `CHECK` no banco
      garantem: nada de vínculo consigo mesmo e nada fora da ordem canônica.
    - Círculos com membros e papel, idempotentes na entrada; apagar círculo não apaga
      pessoa, apagar pessoa não deixa membro fantasma.
    - UI: painel de **vínculos** por pessoa (frase completa: "Bruno é filho(a) de Ana") e
      seção de **círculos** na mesma tela.
  - Suíte **272 verdes** (era 250): +10 puros, +12 de integração sob RLS.
- **2026-08-15 (cont.) — Pessoas #43: interações e "há quanto tempo não falo":**
  - Tabela `interactions` (migrations `0022` + `0023` RLS/GRANTs, **aplicadas no Neon**).
    `happened_at` é **data, não instante**: ninguém lembra a que horas ligou para a mãe, e
    a pergunta da tela ("há quanto tempo") se mede em dias.
  - **"Nunca procurado" é `null`, não zero** — são coisas diferentes, e a ordenação "há mais
    tempo sem contato" põe esse caso **em primeiro**, que é exatamente quem a tela precisa
    mostrar. Mandá-lo para o fim esconderia o problema que o módulo existe para resolver.
  - O último contato **sai da própria tabela** (`max(happened_at)`), sem coluna espelho em
    `people` para manter em sincronia — mesma regra do progresso das metas. Uma consulta
    agregada para a lista inteira, não uma por linha.
  - Toda mutação devolve o **retrato completo** (histórico + último contato) e o client
    escreve direto no cache, inclusive na linha da lista: registrar uma conversa atualiza o
    "há quanto tempo" sem refazer a lista.
  - Frases em vez de números crus: "falaram ontem", "há 5 dias", "há mais de um mês".
  - Suíte **291 verdes** (era 272): +10 puros, +9 de integração sob RLS.
- **2026-08-15 (cont.) — Pessoas #44: aniversários na Agenda (épico #19 fechado):**
  - **Decisão registrada:** o aniversário é **derivado** da data em `people` na leitura, e
    **não** materializado como `event`. Materializar criaria uma segunda verdade — corrigir
    a data de nascimento deixaria para trás um compromisso anual mentindo no calendário.
    Derivado, corrigir a data já move o aniversário (tem teste exatamente disso).
  - Aparece na semana e no mês com 🎂, com a idade que a pessoa completa; **sem ano de
    nascimento, aparece sem idade** — nunca com uma errada. Quem nasceu em 29/02 aparece em
    28/02 nos anos comuns, a mesma regra do resto do módulo.
  - **Lembrete por Web Push** às **8h da manhã** do dia (fuso do Brasil, fixo): aniversário
    é um dia, não um horário, então não há "minutos antes" configurável.
  - `reminder_sends` passou a servir **duas origens** (`event_id` ou `person_id`), com
    `CHECK` de que exatamente uma está preenchida — mesma marca de "já enviado", porque o
    problema é o mesmo e duas tabelas se desencontrariam (migrations `0024` + `0025`,
    **aplicadas no Neon**).
  - Suíte **309 verdes** (era 291): +9 puros, +6 de integração dos aniversários, +3 dos
    lembretes de aniversário. typecheck · lint · format · build verdes.
- **2026-08-15 (cont.) — E2E de login destravado (#7 e #30 fechadas):**
  - O dono rotacionou a senha de teste do Clerk (**#30**) e desligou a proteção anti-bot.
  - **A causa real do travamento não era o anti-bot:** a página parada em
    `/sign-in/client-trust` dizia *"You're signing in from a new device"* — é a verificação
    de dispositivo novo, que pede código por e-mail **depois** de a senha ser aceita.
  - **Resolvido sem depender de caixa de entrada:** o E2E passou a usar um usuário com
    e-mail de teste do Clerk (`+clerk_test@`), criado pela Backend API. Em instância de
    desenvolvimento, o código desses e-mails é sempre `424242` — é a via oficial.
  - Dois defeitos de teste corrigidos no caminho: `isVisible()` **não espera** (respondia na
    hora, antes de a tela do código existir, e o passo era pulado em silêncio), e o campo
    de código é mascarado — ignora digitação tecla a tecla, precisa de `fill`.
  - **E um servidor fantasma:** havia um `next start` das 06:51 ocupando a porta 3000, e o
    Playwright o reusava (`reuseExistingServer`). Todo o "This page couldn't load" vinha de
    um build de antes do trabalho do dia.
  - **E2E: 2/2 verdes** — landing pública e login → painel.
- **2026-08-15 (cont.) — ciclo de otimização: menos idas ao banco:**
  - **Medido antes de mexer.** Instrumentei o driver para contar statements e escrevi um
    teste de **teto por leitura** (`query-budget.test.ts`). Linha de base: lista de pessoas
    **6** statements, agenda **5**, círculos **5** — sendo 3 deles moldura da transação
    (`BEGIN`, `set_config` da RLS, `COMMIT`), presente em toda operação.
  - **Causa:** cada tela fazia 2 ou 3 SELECTs sequenciais. Contra o Neon (banco na rede)
    cada statement é uma viagem de ~130 ms; é ela que domina a resposta, não o Postgres.
  - **Correção:** as três leituras viraram **uma consulta só** com join — pessoas + contatos
    + último contato; eventos + rótulos + exceções; círculos + membros + nomes. O join
    duplica a linha-pai e o agrupamento passou para memória.
  - **Ganho medido** (12 rodadas alternadas contra o Neon, 10 pessoas com contato e
    interação): mediana **909,3 ms → 649,7 ms**, **−28,6%**. Um teste extra garante que as
    duas implementações devolviam o mesmo conteúdo — otimização que muda resultado é bug.
  - **O próximo limite, já identificado:** sobrando 4 statements, **3 são a moldura da
    transação** — ou seja, ~75% do que resta. Cortá-la exige ou montar SQL multi-statement
    por concatenação (risco de injeção) ou fixar o contexto por conexão (quebra o pool).
    Nenhum dos dois vale sem decisão consciente, então ficou registrado em vez de feito.
  - Suíte **313 verdes** (era 309): +4 do orçamento de consultas.
- **2026-08-15 (cont.) — Financeiro: contas e lançamentos (#52):**
  - Épico #20 fatiado em **#52** (contas e lançamentos), **#53** (orçamento por categoria),
    **#54** (relatórios) e **#55** (importação OFX/CSV, por último — decisão da Visão §3).
  - **Decisão travada: dinheiro em centavos inteiros.** `0.1 + 0.2` não dá `0.3` e
    `19.99 * 100` não dá `1999`; num extrato isso é centavo sumido. O teste que demonstra a
    armadilha ficou no repositório para ninguém "simplificar" depois — e ele **pegou a
    armadilha na minha primeira implementação**: `Math.round(Number("1.005") * 100)` devolve
    100, não 101. A conversão passou a ser feita em cima do texto, sem float nenhuma vez.
  - **O sinal vem do tipo do lançamento, nunca do número:** valor é sempre positivo, com
    `CHECK` no banco. Aceitar "-50" criaria duas formas de dizer a mesma coisa, e uma delas
    some quando alguém troca o tipo e esquece o sinal.
  - **Saldo é derivado** dos lançamentos, sem coluna espelho — mesma regra do progresso das
    metas e do último contato das pessoas.
  - 🐛 **Erro registrado:** a subconsulta correlacionada do saldo, escrita à mão no template
    `sql`, devolvia **zero em silêncio**. Trocada por agregação sobre `left join`. Detalhes e
    lição em `docs/ERROS.md`.
  - Tabelas `accounts`, `transaction_categories` e `transactions` (migrations `0026` + `0027`
    RLS/GRANTs/CHECK, **aplicadas no Neon**); tela `/dashboard/financeiro` com contas, extrato
    do mês e navegação mês a mês.
  - Suíte **347 verdes** (era 313): +14 puros de dinheiro, +14 de integração sob RLS,
    +6 de componente.
- **2026-08-22 — Financeiro: orçamento por categoria (#53):**
  - **Decisões do dono nesta sessão:** mês é o do **calendário e começa zerado** (nada copiado
    do mês anterior — orçamento herdado em silêncio é orçamento que ninguém decidiu); ordem de
    trabalho #53 → #54 → #55; e **merge autônomo com o CI verde**.
  - **Correção de rota:** cheguei a supor que faltaria ligar categoria → área de vida para o
    "gasto por área". Não falta: `transactions.life_area_id` já existe desde o #52, com select
    no formulário. A #54 agrega direto dos lançamentos.
  - Tabela `budgets` (categoria + mês `AAAA-MM` em texto + planejado em centavos), migrations
    `0028` + `0029` (RLS ENABLE+FORCE+policy, GRANTs ao `app_rls`, `CHECK` de valor positivo e
    de formato do mês), **aplicadas no Neon**.
  - **Repetir corrige em vez de duplicar:** índice único (usuário + categoria + mês) com
    `on conflict do update`. Um `select` antes do `insert` teria a mesma cara e uma corrida no
    meio. Na tela, "editar" não existe como operação separada — orçar de novo *é* editar.
  - **"Sem orçamento" ≠ "orçamento zero":** planejado nulo é um estado próprio, e zero é
    recusado no formulário, no serviço e por `CHECK` no banco. As duas formas de dizer a mesma
    coisa sempre se desencontram numa comparação.
  - **A conta é pura** (`budget.ts`): planejado × realizado, sobra e estouro fora do banco, para
    ser a mesma no painel e nos relatórios (#54) e para o teste rodar em milissegundos. Estouro
    é sobra negativa, não um campo à parte.
  - **Leitura em uma consulta só** (teto de 4 statements testado): o `full join` com os
    lançamentos do mês traz, pela esquerda, as categorias sem movimento e, pela direita, o que
    foi lançado **sem categoria** — que numa lista de categorias não teria onde aparecer, e é
    justamente o que estoura o mês. O filtro do mês fica na subconsulta: num `full join`,
    condição no `where` descartaria as linhas não-pareadas e devolveria o mês inteiro errado.
  - Painel em `/dashboard/financeiro`, sob o extrato e **no mesmo mês dele**; lançar ou apagar
    invalida o orçamento junto, porque o realizado é derivado.
  - Suíte **377 verdes** (era 347): +13 puros do orçamento, +11 de integração sob RLS,
    +6 de componente. typecheck · lint · format · build verdes.
  - **PR #59 mergeado na `main` (`45f5386`), #53 fechada** — primeiro merge autônomo, com CI
    verde (incluindo o preview da Vercel).
  - **Achado ao ler o CI:** a Vercel **já está conectada** e a produção roda desde 2026-08-15.
    O diário ainda carregava "deploy pendente" das iterações antigas e eu li isso como estado
    atual. Lição: no `PROGRESSO.md`, pendência antiga no Histórico não é pendência de hoje —
    confirmar no CI/no GitHub antes de pedir algo ao dono.
- **2026-08-22 (cont.) — Financeiro: relatórios e panorama (#54):**
  - **Nada no relatório lê o relógio.** O mês de referência entra por parâmetro em toda a
    cadeia (tela → tRPC → serviço → agregação pura). Relatório que chama `new Date()` por
    dentro é relatório cujo teste passa hoje e vira na virada do mês — e cuja evolução mudaria
    debaixo de quem está navegando pelos meses.
  - **Agregação pura** (`reports.ts`): panorama do mês, gastos por categoria e por área de
    vida, e evolução mês a mês. O que não tem rótulo vira fatia "Sem categoria"/"Sem área" em
    vez de sumir — o que some do relatório é o que ninguém consegue explicar no fim do mês.
    Empate de valor é desempatado pelo nome, senão a lista dança a cada leitura.
  - **Mês vazio entra zerado na evolução**, e não some da linha do tempo: buraco no meio mente
    sobre o que aconteceu.
  - **Duas consultas, e o número não cresce com a janela:** uma para as contas com saldo (a
    mesma da tela de Contas — o consolidado não pode discordar do que está logo acima) e uma
    para a janela de lançamentos com os rótulos. Separar por mês, por categoria e por área
    viraria três `group by` e três viagens pela rede; em memória são algumas centenas de
    linhas. Teto de **5 statements** testado.
  - **Uma verdade por número na tela:** os cartões de entradas/saídas que o extrato calculava
    no cliente saíram; agora vêm do panorama, do servidor. Um teste de integração prova que o
    panorama bate com a soma do extrato e que o consolidado bate com a tela de contas.
  - **Tela reorganizada:** um seletor de mês só, no topo, governando panorama, orçamento e
    extrato — antes o seletor morava dentro do extrato.
  - **Dashboard principal:** cartão "Panorama do dinheiro" (entradas, saídas, saldo das contas
    e os 3 maiores gastos do mês). De quebra, o texto que ainda dizia "Financeiro e Pessoas
    chegam nas próximas iterações" foi corrigido — os dois existem desde julho/agosto.
  - Suíte **398 verdes** (era 377): +14 puros, +7 de integração sob RLS. typecheck · lint ·
    format · build verdes.
- **2026-08-22 (cont.) — Financeiro: importação OFX/CSV (#55) — épico #20 e Fase 1 fechados:**
  - **Identidade vem do arquivo, não de palpite.** No OFX é o `FITID`, que o banco promete
    único. Lançamento **sem** FITID é reportado, não importado: sem identidade, a segunda
    importação duplicaria — e inventar id num arquivo que deveria ter um é mentir para si
    mesmo. No CSV não existe FITID, então a identidade é uma **impressão digital** da linha
    (data + valor + descrição + a posição entre linhas idênticas). É honestamente inferior e
    está escrito no código: dois cafés de R$ 5 no mesmo dia continuam sendo dois lançamentos,
    e a impressão **não** usa o número da linha, senão um extrato reexportado com uma linha em
    branco a mais duplicaria tudo.
  - **A conciliação é do banco:** coluna `external_id` + **índice único parcial** (usuário +
    conta + origem, só onde `external_id` não é nulo) e `on conflict do nothing`. Um `select`
    antes de cada `insert` faria o mesmo com N viagens e uma corrida no meio. Migration `0030`,
    **aplicada no Neon**. A identidade é **por conta**: dois bancos podem repetir FITID, e um
    cancelar o lançamento do outro seria sumiço silencioso.
  - **Nada é engolido em silêncio:** linha ruim volta com número, motivo e o texto cru, e a
    janela da importação só fecha depois que a pessoa lê. Extrato importado pela metade sem
    aviso é pior que importação nenhuma — o saldo fecha errado e ninguém sabe por quê.
  - **O sinal do banco vira sentido do app na fronteira** (`parseSignedAmount`): o extrato fala
    em negativo, o app não. Valor zero não é lançamento, é linha para reportar.
  - **Codificação:** os bytes viram texto no navegador, tentando UTF-8 em modo `fatal` e caindo
    para windows-1252 — que é como boa parte dos bancos brasileiros ainda exporta. Sem o
    `fatal`, o decodificador engole o byte inválido, devolve o caractere de substituição e a descrição chega torta.
  - **Sugestão de categoria deliberadamente burra:** descrição igual (normalizada) e mesmo
    sentido, com a mais usada vencendo e o mais recente desempatando. Nada de semelhança
    aproximada — categorizar errado em silêncio é pior do que não categorizar.
  - **Data que casa com o formato mas não existe no calendário é recusada** (`30/02/2026`), o
    caso que vira 1º de março sem ninguém notar.
  - Suíte **446 verdes** (era 398): +29 puros do parser, +10 de integração sob RLS, +4 de
    dinheiro com sinal, +5 de componente. typecheck · lint · format · build verdes.
  - **Checkpoint da sessão** (log completo em
    [docs/sessions/2026-08-22-financeiro-completo.md](docs/sessions/2026-08-22-financeiro-completo.md)):
    épico **#20 fechado** e **Fase 1 completa**; três PRs (#59, #60, #61) mergeados por mim com
    o CI verde, estreando a autonomia acordada. Abertas **#62** (editar lançamento), **#63**
    (gerenciar categorias) e **#64** (validação manual da Fase 1), e comentado em **#57** o que
    exatamente falta do dono para destravá-la.
- **2026-09-03 — Financeiro: editar lançamento (#62) e gerenciar categorias (#63):**
  - **A edição existe para não abrir porta para duplicata.** `updateTransaction` deixa o
    `external_id` **fora do `set`**: a origem do lançamento não muda porque alguém corrigiu a
    categoria. Antes, o único conserto era apagar e relançar — e o relançado perdia a origem,
    de modo que a importação seguinte do mesmo extrato o recriava. O teste importa, edita e
    reimporta: continua dizendo "já existia".
  - **Mesmas validações da criação**, inclusive o valor positivo: trocar entrada por saída é
    trocar **um campo**, não o sinal do número. Saldo da conta e realizado do orçamento
    acompanham a edição porque são derivados — não há coluna espelho para desandar.
  - **Um formulário só para criar e editar** (`transaction-form.tsx`), com `initial` e reset
    por `key`, como já era na Agenda. O extrato ganhou "Editar" ao lado de "Remover".
  - **Categorias na tela** (`categories-panel.tsx` + `category-form.tsx`): criar, renomear e
    remover. **Renomear não mexe no sentido** — virar "entrada" uma categoria com saídas
    lançadas deixaria os lançamentos num sentido que ela não descreve mais. Remover não apaga
    lançamento (`on delete set null`); o orçamento dela, esse vai junto (`on delete cascade`).
    Nome repetido no mesmo sentido devolve frase do domínio, não o erro do driver; criar o que
    já existe avisa "já existia" em vez de fingir que nasceu algo.
  - **Sem migration:** o schema já comportava as duas fatias. A detecção de `23505` virou
    `shared/unique-violation.ts`, agora usada por Áreas de Vida e Financeiro.
  - Suíte **461 verdes** (era 446): +9 de integração sob RLS, +6 de componente.
    typecheck · lint · format · build verdes.
