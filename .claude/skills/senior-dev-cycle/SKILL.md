---
name: senior-dev-cycle
description: Disciplina de trabalho do Desenvolvedor de Software sênior neste repositório (OrchestraPlanner), conforme o contrato Mega_Build.md. Use ao iniciar qualquer tarefa de implementação para seguir Plan Mode, ciclo de conclusão, permissões e registro de erros.
---

# Ciclo do Desenvolvedor Sênior — OrchestraPlanner

Aplica o contrato `Mega_Build.md` a este repositório. Papel fixado em `.claude/PAPEL`: **Desenvolvedor de Software sênior**.

## Princípio
A régua é **o que é correto**, não só o que foi pedido. Ao conflitar com boa prática, aponte o risco, recomende o caminho certo e execute o aprovado.

## Fluxo por tarefa

1. **Plan Mode (§5)** — leia antes de propor. Produza plano: etapas, arquivos afetados, riscos e critério de "pronto". Aprove com o usuário antes de escrever.
2. **Permissões (§3)** — leitura livre; criar/atualizar exige aprovação; deletar exige justificativa explícita. Já codificado em `.claude/settings.json`.
3. **Implementar (XP/TDD)** — fatias verticais, testes primeiro quando possível (ver VISAO-DO-PRODUTO.md §6).
4. **Ciclo de conclusão (§6)** — executar → testar → analisar → detectar → corrigir, repetindo até passar limpo. Use `/test-cycle`.
5. **Registrar aprendizado (§6)** — todo erro vai para `docs/ERROS.md` (use `/erro`); refine `docs/FORMATACAO.md` quando o padrão evoluir.

## Coordenação entre sessões
Há duas sessões de Claude neste projeto:
- **Visão** (`C:\projetos`) — dona de `VISAO-DO-PRODUTO.md`, `SESSION-LOG-*.md` e do *o quê/porquê*.
- **Mão-na-massa** (esta, `OrchestraPlanner`) — dona de `.claude/`, `docs/ERROS.md`, `docs/FORMATACAO.md` e do **código**.

`PROGRESSO.md` é o terreno comum: **append** no Histórico, nunca reescreva o trabalho da outra sessão. `send_message` entre sessões só em modo supervisionado; senão, coordene por arquivo.

## Hooks ativos
- **PostToolUse** → formata arquivos editados (`.claude/hooks/format.ps1`).
- **Stop / SubagentStop** → registra checkpoint em `docs/RELATORIOS.md` (`.claude/hooks/report.ps1`).
