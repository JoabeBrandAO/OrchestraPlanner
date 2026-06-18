<#
.SYNOPSIS
  Cria labels, milestones e issues do OrchestraPlanner no GitHub via GitHub CLI (gh).

.PRE-REQUISITOS
  1. Instalar o GitHub CLI:  winget install --id GitHub.cli
  2. Autenticar:             gh auth login
  3. Ter o repositório criado e definido como remoto 'origin', ex.:
       gh repo create orchestraplanner --private --source . --remote origin --push

.USO
  pwsh ./scripts/create-github-issues.ps1
  pwsh ./scripts/create-github-issues.ps1 -DryRun   # apenas mostra o que faria

.NOTAS
  Detalhe completo de cada issue está em docs/ISSUES.md.
#>
param([switch]$DryRun)

$ErrorActionPreference = 'Stop'

function Invoke-Gh {
  param([string[]]$GhArgs)
  if ($DryRun) { Write-Host "DRYRUN> gh $($GhArgs -join ' ')" -ForegroundColor Yellow }
  else { & gh @GhArgs }
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw "gh (GitHub CLI) não encontrado. Instale com: winget install --id GitHub.cli ; depois 'gh auth login'."
}

Write-Host "== Criando labels ==" -ForegroundColor Cyan
$labels = @(
  @{ name='setup';    color='0E8A16'; desc='Configuração inicial / Iteração 0' }
  @{ name='auth';     color='5319E7'; desc='Autenticação (Clerk)' }
  @{ name='api';      color='1D76DB'; desc='Camada de API / tRPC' }
  @{ name='ci';       color='C2E0C6'; desc='CI/CD e automação' }
  @{ name='test';     color='BFD4F2'; desc='Testes (Vitest/Playwright)' }
  @{ name='feature';  color='A2EEEF'; desc='Funcionalidade de produto' }
  @{ name='epic';     color='3E4B9E'; desc='Épico / módulo grande' }
  @{ name='decision'; color='D93F0B'; desc='Decisão a confirmar com o dono' }
  @{ name='chore';    color='FEF2C0'; desc='Tarefa de manutenção' }
  @{ name='infra';    color='000000'; desc='Banco de dados / infraestrutura' }
)
foreach ($l in $labels) {
  Invoke-Gh @('label','create',$l.name,'--color',$l.color,'--description',$l.desc,'--force')
}

Write-Host "== Criando milestones ==" -ForegroundColor Cyan
$milestones = @(
  'Fase 1 — Web Pessoal (0-60d)'
  'Fase 2 — Publico + App (60-120d)'
  'Fase 3 — Desktop (120-180d)'
)
foreach ($m in $milestones) {
  Invoke-Gh @('api','--method','POST','repos/{owner}/{repo}/milestones','-f',"title=$m")
}

Write-Host "== Criando issues ==" -ForegroundColor Cyan
# title | labels (csv) | milestone | body
$issues = @(
  @{ t='[setup] Inicializar Next.js 15 + TS strict + Tailwind + shadcn/ui'; l='setup'; m=$milestones[0]; b='Base do app web. Aceite: create-next-app, TS strict, Tailwind+shadcn/ui, npm run dev sobe a home.' }
  @{ t='[setup] Drizzle ORM + PostgreSQL (Neon) + Docker Compose local';     l='setup,infra'; m=$milestones[0]; b='docker-compose com Postgres local; Drizzle conectado; DATABASE_URL em .env.example; projeto Neon para produção.' }
  @{ t='[infra] Schema users + migrations + Row-Level Security por user_id'; l='infra'; m=$milestones[0]; b='Tabela users migrada; RLS habilitado; policy por user_id; teste de isolamento entre 2 usuários.' }
  @{ t='[auth] Integrar Clerk (login/logout) + middleware em (app)';         l='auth'; m=$milestones[0]; b='Registro/login/logout; middleware protege rotas; user_id do Clerk no backend.' }
  @{ t='[api] tRPC (context com user_id) + procedure healthcheck';           l='api'; m=$milestones[0]; b='/api/trpc ativo; context injeta user_id; healthcheck autenticada retorna { ok, userId }.' }
  @{ t='[ci] GitHub Actions (typecheck+lint+vitest) + deploy Vercel';        l='ci'; m=$milestones[0]; b='Pipeline em todo PR bloqueia merge se falhar; merge em main faz deploy no Vercel.' }
  @{ t='[test] Vitest + Playwright + 1o unit e 1o E2E (login -> home)';      l='test'; m=$milestones[0]; b='Vitest e Playwright configurados; teste unit (validateGoalTitle) e E2E (login->home) verdes.' }
  @{ t='[feature] Areas de Vida: seed Corpo/Alma/Espirito + 12 sub, CRUD';   l='feature'; m=$milestones[0]; b='Semear 3 dimensoes + 12 sub-areas ao criar conta; CRUD customizavel; dimensao, cor, icone.' }
  @{ t='[feature] US-1.1 Criar Meta';                                        l='feature'; m=$milestones[0]; b='titulo+descricao+area -> meta Ativa com created_at; titulo vazio -> erro e foco.' }
  @{ t='[feature] US-1.2 Listar Metas (filtro/ordenacao/estado vazio)';      l='feature'; m=$milestones[0]; b='ativas em updated_at DESC; filtro por area; contador; estado vazio com CTA.' }
  @{ t='[feature] US-1.3 Editar Meta';                                       l='feature'; m=$milestones[0]; b='salvar atualiza updated_at; cancelar descarta; Salvar off com titulo vazio.' }
  @{ t='[feature] US-1.4 Alterar Status + historico';                        l='feature'; m=$milestones[0]; b='completar seta completed_at; transicao invalida erra; historico registrado.' }
  @{ t='[feature] Prioridades em Kanban + drag-and-drop';                    l='feature'; m=$milestones[0]; b='tarefa vinculada a meta; mover entre colunas persiste status/ordem; filtro; badge.' }
  @{ t='[feature] Tags em prioridades';                                      l='feature'; m=$milestones[0]; b='criar/associar tags reutilizaveis; filtrar por tag; autocomplete.' }
  @{ t='[feature] Marcos (goal_milestones) + calculo de progresso';          l='feature'; m=$milestones[0]; b='marcos; progress recalculado; barra de progresso por meta.' }
  @{ t='[feature] Dashboard de metas';                                       l='feature'; m=$milestones[0]; b='cards (ativas, vencidas, progresso), distribuicao por area, atividade recente.' }
  @{ t='[feature] Roda da Vida (0-10 por area + radar) no onboarding';       l='feature'; m=$milestones[0]; b='pontuar areas 0-10; grafico radar; sugere areas; historico life_assessments.' }
  @{ t='[epic] Modulo Agenda (calendario + recorrencia + lembretes)';        l='epic'; m=$milestones[0]; b='calendario, compromissos, recorrencia, lembretes; vincular tarefas a blocos.' }
  @{ t='[epic] Modulo Pessoas & Relacionamentos (CRM pessoal)';             l='epic'; m=$milestones[0]; b='pessoas, contatos, circulos/familias, vinculos, interacoes, aniversarios->agenda.' }
  @{ t='[epic] Modulo Financeiro (OFX/CSV por ultimo)';                      l='epic'; m=$milestones[0]; b='contas, lancamentos, categorias, orcamento, relatorios; OFX/CSV na ultima iteracao.' }
  @{ t='[epic] Fase 2 — Publico (SaaS) + App mobile';                       l='epic'; m=$milestones[1]; b='onboarding multiusuario, planos/cobranca, app mobile consumindo a mesma API.' }
  @{ t='[epic] Fase 3 — Desktop';                                           l='epic'; m=$milestones[2]; b='empacotar desktop (Electron/Tauri) reusando a API.' }
  @{ t='[decision] Posicao do modulo Pessoas no roadmap';                    l='decision'; m=$milestones[0]; b='Recomendacao: apos a Agenda. Confirmar com o dono.' }
  @{ t='[decision] Roda da Vida no onboarding vs Fase 2';                    l='decision'; m=$milestones[0]; b='Recomendacao: versao minima no onboarding.' }
  @{ t='[chore] Campos condicionais somente casado (Conjugal)';             l='chore'; m=$milestones[0]; b='exibir area/campos conjugais conforme marital_status.' }
)

foreach ($i in $issues) {
  $ghArgs = @('issue','create','--title',$i.t,'--label',$i.l,'--milestone',$i.m,'--body',$i.b)
  Invoke-Gh $ghArgs
}

Write-Host "Concluido. $($issues.Count) issues, $($labels.Count) labels, $($milestones.Count) milestones." -ForegroundColor Green
