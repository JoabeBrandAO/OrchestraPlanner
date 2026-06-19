---
description: Roda o ciclo de conclusão de tarefa (Mega_Build §6) — executar → testar → analisar → detectar → corrigir até passar limpo
---

Aja como Desenvolvedor de Software sênior e feche o **ciclo de conclusão de tarefa** (Mega_Build.md §6) sobre o que está em andamento:

1. **Executar** — confirme o que foi implementado/alterado (use `git diff`).
2. **Testar** — rode a suíte disponível (`npm test` / `vitest` / `playwright`); se não houver, diga o que falta para haver teste.
3. **Analisar** — interprete os resultados; não aceite "parece funcionar".
4. **Detectar** — liste os erros/falhas encontrados.
5. **Corrigir** — corrija e repita o ciclo até passar limpo.

Todo erro encontrado deve ser registrado em `docs/ERROS.md` (o que ocorreu, a causa, como evitar a recorrência). Ao final, relate: testes verdes/vermelhos, o que corrigiu, e o que ainda falta.
