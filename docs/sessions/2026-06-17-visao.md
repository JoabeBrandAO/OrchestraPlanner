# Session Log — 2026-06-17

> Registro do que foi aprendido/decidido nesta sessão, onde paramos e o próximo passo.
> Complementa [VISAO-DO-PRODUTO.md](VISAO-DO-PRODUTO.md) (fonte da verdade) e [PROGRESSO.md](PROGRESSO.md) (diário de bordo).

## Identificação da conversa
- **Data:** 2026-06-17
- **Sessão (Claude Code):** `f1c9d982-3695-4530-a1fc-f54538060ae4`
- **Hash da conversa (SHA-256 do transcrito, no momento da geração):**
  `B62141ED50273DF76FCC656B5020E6407547A46D9BE4926834574719491993CB`
- **Transcrito:** `C:\Users\joabe\.claude\projects\C--projetos\f1c9d982-3695-4530-a1fc-f54538060ae4.jsonl`
- _Para recalcular:_ `Get-FileHash <transcrito>.jsonl -Algorithm SHA256`
  _(o hash muda conforme a conversa cresce; este é um snapshot pontual.)_

---

## 1. O que aprendi hoje

### Produto
- **OrchestraPlanner** = sistema de **gestão de vida pessoal**: metas/prioridades, agenda, finanças e **convívio entre pessoas**. Dono = Joabe (cliente **e** administrador), que programa usando o Claude.
- **Para quem:** uso pessoal agora; **SaaS pago de produtividade pessoal** depois → multi-tenant por **`user_id`** (sem `organization_id`).
- **Plataforma:** Web → mobile → desktop (**API-first**).
- **Prazos:** 60 d web pessoal · +60 d público + app · +60 d desktop.
- **Sucesso:** planejamento e metas 100% executados; agenda/financeiro em dia.

### Bases conceituais estudadas
- **Planner Líder de Impacto 2026** (BR Books / Oseias Gomes — PDF na pasta, **material protegido, não versionado**): framework **Corpo / Alma / Espírito**, **Roda da Vida** (12 dimensões, score 0–10), **Lista/Árvore de Sonhos** (metas + marcos), plano de ação financeiro, "amigos aniversariantes".
- **IgrejasNet** (`C:\IgrejasNet\IgrejasNetHelp\build` — help grande, lido com parcimônia): modelo de **cadastro de pessoas** (dados pessoais, contato, endereço, **familiares/famílias**, aniversário, geolocalização).

### Decisões travadas
- Stack: **Next.js 15 + tRPC + Drizzle + PostgreSQL (Neon) + Clerk + shadcn/ui + Vitest/Playwright + Vercel**.
- Metodologia: **XP** (TDD, fatias verticais, CI). Ordem: **Metas → Agenda → Financeiro → Pessoas**.
- **Áreas de Vida:** Corpo/Alma/Espírito + 12 sub-áreas semeadas, **customizáveis**.
- **Financeiro:** simples no MVP; **OFX/CSV só na última iteração**.
- **Pessoas/Relacionamentos:** CRM pessoal (pessoas, contatos, círculos/famílias, vínculos, interações, aniversários→agenda).
- **Bônus:** **Roda da Vida** (avaliação 0–10 por área + radar) no onboarding.

### Processo / colaboração
- Há **outra sessão do Claude** trabalhando na metodologia XP nesta pasta. Coordenação por **arquivos** (`PROGRESSO.md`, esta `VISAO-DO-PRODUTO.md`) — `send_message` entre sessões só funciona em modo supervisionado.

---

## 2. Onde paramos
- Visão, brief, stack, arquitetura, modelo de dados e backlog **definidos e documentados**.
- Módulo **Pessoas/Relacionamentos** e **Roda da Vida** especificados.
- **Nada de código ainda** — projeto greenfield. Iteração 0 não iniciada.

## 3. Próximo passo
1. Confirmar 3 micro-decisões (posição do módulo Pessoas; Roda da Vida no onboarding; campos "somente casado").
2. **Iteração 0** — inicializar o projeto: Next.js + tRPC + Drizzle + Clerk + Postgres/RLS + CI + deploy + walking skeleton. Ver issues em [docs/ISSUES.md](docs/ISSUES.md).

## 4. Artefatos gerados nesta sessão
- `VISAO-DO-PRODUTO.md` · `PROGRESSO.md` · `SESSION-LOG-2026-06-17.md`
- `README.md` · `.gitignore` · `docs/ISSUES.md` · `scripts/create-github-issues.ps1`
- Memória persistente: `orchestraplanner-project`, `orchestraplanner-cross-session-handoff`, `working-log-convention`.

## 5. Decisões em aberto
- Posição do módulo **Pessoas** (recomendo após a Agenda).
- **Roda da Vida** no onboarding (recomendo versão mínima já).
- Campos condicionais **"somente casado"** (Relacionamento Conjugal).

---

## 6. Comando de finalização (registro)

> **Instrução do dono que originou esta finalização (verbatim):**
> _"Gere um arquivo .md para que você salve tudo o que você aprendeu hoje, onde paramos, qual o próximo passo, e salve o hash da conversa. e **fazendo por fim um commit com muito bem informado, formalizado e compartilhável, e corretamente gere novas issues com o que deve ser feito**"_

### Atendimento
- [x] **Arquivo de finalização (.md)** com aprendizados, onde paramos, próximo passo e **hash da conversa** → este arquivo (`SESSION-LOG-2026-06-17.md`).
- [x] **Commit bem informado, formalizado e compartilhável** → `b290489` (branch `main`, root-commit; PDF protegido por direitos autorais excluído via `.gitignore`).
- [x] **Issues geradas (o que deve ser feito)** → backlog em [docs/ISSUES.md](docs/ISSUES.md) + automação em [scripts/create-github-issues.ps1](scripts/create-github-issues.ps1) — 25 issues, com labels e milestones (Fases 1/2/3).
- [ ] **Publicar no GitHub e criar as issues remotamente** → pendente: `gh` (GitHub CLI) não instalado nesta máquina.

### Como publicar (quando quiser tornar realmente compartilhável)
```powershell
winget install --id GitHub.cli
gh auth login
gh repo create orchestraplanner --private --source "C:\projetos\OrchestraPlanner" --remote origin --push
pwsh "C:\projetos\OrchestraPlanner\scripts\create-github-issues.ps1"   # use -DryRun para simular
```
