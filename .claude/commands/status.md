---
description: Gera um relatório de status do projeto (Mega_Build §8) a partir de git + PROGRESSO.md
---

Gere um **relatório de status** conciso do OrchestraPlanner:

1. Leia `PROGRESSO.md` (seções ✅ Feito / 🔄 Fazendo / 📋 A fazer).
2. Rode `git log --oneline -5`, `git status -s` e `git branch`.
3. Resuma em até 10 linhas: onde o projeto está, o que está em andamento, próximo passo acionável, e qualquer bloqueio.
4. Sinalize o que depende de decisão humana (ex.: micro-decisões em aberto na VISAO-DO-PRODUTO.md §8).

Não escreva arquivos — apenas relate.
