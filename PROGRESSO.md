# OrchestraPlanner — Progresso (Diário de Bordo)

> **Para que serve:** log compartilhado entre as sessões do Claude (visão de produto e metodologia XP) e visível no GitHub.
> **Convenção:** atualizar **a cada sessão de trabalho**. Seções — ✅ Feito · 🔄 Fazendo · 📋 A fazer + **Histórico** (data + quem + o quê).

---

## Estado atual — atualizado em 2026-08-15

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

- **Módulo Agenda (#18) — semana, mês e edição** (Iterações 4 e 5): recorrência guardada como
  regra e expandida na leitura, lembrete, bloco de tempo para uma prioridade, visão semanal e
  mensal na mesma rota e edição do compromisso pela tela. Faltam as exceções na série (#35) e
  o disparo real dos lembretes (#36).

### 🔄 Fazendo
- **Sessão de Visão** (`C:\projetos`): consolidou requisitos, fontes conceituais e este diário; dona dos docs de produto.
- **Sessão Mão-na-massa** (`OrchestraPlanner`): infra + código. Divisão acordada: eu = `.claude/`, `docs/ERROS.md`, `docs/FORMATACAO.md`, código; Visão = `VISAO-DO-PRODUTO.md`, `SESSION-LOG-*.md`. `PROGRESSO.md` = terreno comum (append no Histórico).

### 📋 A fazer (próximo)
- **Bloqueado no dono:** 🔴 rotacionar a senha de teste do Clerk (**#30**, segue válida no
  repo público) · cadastrar o secret `MIGRATION_DATABASE_URL` no GitHub (senão o workflow de
  migrations falha de propósito) · desligar a proteção anti-bot do Clerk, que **segue ativa**
  e trava o E2E de login em `/sign-in/client-trust` (**#7**).
- **Validação manual** das telas da Agenda (semana, mês e edição).
- **Agenda — fatias restantes (#18):** exceções numa ocorrência da série (**#35**), disparo
  real dos lembretes (**#36** — hoje só o horário é calculado).
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
