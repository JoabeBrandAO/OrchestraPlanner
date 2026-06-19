# ERROS.md — Registro vivo de erros e aprendizados

> **Por quê (Mega_Build §6):** todo erro encontrado é registrado aqui — o que ocorreu,
> a causa raiz e como evitar a recorrência — para que **não se repita**.
> Append-only: nunca apague entradas; corrija acrescentando.

## Formato de cada entrada

```
### YYYY-MM-DD — <título curto do erro>
- **Contexto:** onde/quando ocorreu (módulo, comando, arquivo).
- **O que ocorreu:** o sintoma observado.
- **Causa raiz:** por que aconteceu.
- **Correção:** o que foi feito para resolver.
- **Como evitar a recorrência:** regra, teste ou checagem para o futuro.
```

---

## Entradas

### 2026-06-18 — Mojibake no relatório do hook Stop (`report.ps1`)
- **Contexto:** teste do hook `Stop` (`.claude/hooks/report.ps1`) durante o auto-bootstrap do Mega_Build.
- **O que ocorreu:** a linha do `git log -1 --oneline` foi gravada em `docs/RELATORIOS.md` com caracteres corrompidos (`finaliza├º├úo` em vez de `finalização`).
- **Causa raiz:** o git emite UTF-8, mas o PowerShell decodificou a saída usando o code page legado do console (CP-1252/850), corrompendo acentos.
- **Correção:** forçar `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8` (e `$OutputEncoding`) no início do `report.ps1`, antes de capturar a saída do git.
- **Como evitar a recorrência:** em qualquer script PowerShell que capture saída de ferramentas externas (git, npx) com texto acentuado, fixar `OutputEncoding` para UTF-8 no topo. Padrão a ser herdado por novos hooks/scripts.

### 2026-06-18 — Comentário inline no `.gitignore` não funciona
- **Contexto:** ao ignorar `docs/RELATORIOS.md` (log gerado por hook) no `.gitignore`.
- **O que ocorreu:** o arquivo continuou aparecendo como untracked no `git status` mesmo após adicionar a regra.
- **Causa raiz:** a regra foi escrita como `docs/RELATORIOS.md   # comentário` — o `.gitignore` **não suporta comentário na mesma linha do padrão**; o `#` e o texto viraram parte do padrão, que então não casou com o arquivo.
- **Correção:** mover o comentário para a linha de cima (começando com `#`) e deixar o padrão sozinho na sua linha. Confirmado com `git check-ignore docs/RELATORIOS.md`.
- **Como evitar a recorrência:** comentários no `.gitignore` sempre em linha própria. Validar regras novas com `git check-ignore <caminho>` antes de dar por feito.
