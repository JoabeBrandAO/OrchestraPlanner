# 2026-10-10 — Primeira rodada de UI/UX com o Impeccable

- **Sessão:** Claude como subagente "front-end/UX sênior", a partir de `f607e1b` (main).
- **Ferramenta:** Impeccable 4.5.2, instalado localmente em `.claude/skills/impeccable/` (fora
  do repositório, via `.git/info/exclude`). A Skill não estava registrada na sessão; o
  `SKILL.md` foi seguido à mão e o detector rodou pelo binário.

## O que foi feito

1. **`init`** → [PRODUCT.md](../../PRODUCT.md), a partir da Visão do Produto. Sem entrevista ao
   vivo (a sessão não tinha canal de perguntas); inferências marcadas no arquivo.
2. **Diagnóstico** → [docs/ux/2026-10-10-diagnostico-impeccable.md](../ux/2026-10-10-diagnostico-impeccable.md):
   `audit` 11/20, heurísticas 19/40, detector em 10 telas renderizadas, 18 achados por
   impacto ÷ esforço. Rodado em modo "degradado" (uma avaliação depois da outra, no mesmo
   contexto), como o próprio relatório avisa.
3. **Correções** — 5 PRs, um por tema, todos verificados localmente (typecheck, lint, testes,
   build e prints em 1280×800 e 390×844):

| PR | Tema | O que muda para quem usa |
|---|---|---|
| #122 | `ux/tipografia` | A fonte do app (Geist) finalmente aparece; datas com maiúscula certa |
| #123 | `ux/layout` | Roda da Vida cabe no celular; radar legível; todas as telas com a mesma largura |
| #124 | `ux/contraste` | Vermelho e verde legíveis (AA); erro anunciado ao leitor de tela; painel sem ID técnico |
| #125 | `ux/confirmar-exclusao` | Remover conta, pessoa ou área pergunta antes e diz o que vai junto |
| #126 | `ux/icones` | Ícones de verdade no lugar de emoji e setas; "Painel" em vez de "Dashboard" |

Mais #121 (diagnóstico + `PRODUCT.md` + `e2e/ux-prints.spec.ts`) e este fechamento.

## Evidência

- Prints antes/depois em `docs/ux/prints/<tema>/`, ligados no corpo de cada PR.
- Os seis ramos mesclados num ramo local de conferência: **sem conflito**, typecheck e lint
  limpos, 103 testes de UI verdes, build ok. Detector depois: 0 `low-contrast` e 0
  `tiny-text` nas telas do app; todas as telas com 390 px no celular.
- `npm test` em cada ramo: tudo verde menos `provisioning.test.ts`, que estoura 30 s contra o
  Neon — igual na `main` (ver `docs/ERROS.md`).

## O que travou

**Nada foi mergeado.** O CI da `main` está vermelho desde antes da rodada: o passo de
auditoria de dependências de produção acusa 13 falhas publicadas depois de 2026-10-01. Com a
`main` protegida, nenhum PR passa. A correção (atualizar dependências) foi testada localmente
e revertida — mexer em dependência ficou fora do que a sessão podia fazer sozinha. Os 7 PRs
estão abertos esperando o dono.

## Decisões e porquês

- **Login em português (achado 2) ficou de fora** apesar da razão alta: a correção certa é o
  pacote `@clerk/localizations`, dependência nova. Entrou o achado 8 (ícones), que usa uma
  biblioteca que o projeto já tinha e nunca usou.
- **Confirmação só para exclusão em cascata.** Apagar um contato ou um marco continua em um
  clique: confirmar tudo treina a pessoa a confirmar sem ler.
- **PRs independentes, todos a partir da `main`**, para o dono mergear em qualquer ordem. O
  custo: os prints "depois" de #123, #124 e #126 ainda aparecem em Times New Roman, porque a
  fonte só é corrigida no #122.
- **Nenhum dado escrito no banco.** O usuário de teste está vazio; telas cheias (Kanban,
  extrato, lista de pessoas) foram avaliadas pelo código. O print da confirmação foi tirado
  abrindo a janela e cancelando.

## Lições

- O defeito mais grave (fonte) passou por 4 meses de build verde e pelo detector estático. Só
  apareceu no print. Print de tela entra no ciclo de qualquer mudança visual.
- CI de repositório parado fica vermelho sozinho: a auditoria olha avisos publicados até
  hoje.

## Onde paramos / próximo passo

1. **Dono:** aprovar a atualização de dependências que destrava o CI; depois os PRs #121–#127
   podem ser mergeados (a sessão deixou todos prontos e sem conflito entre si).
2. **Dono:** decidir login em português (`@clerk/localizations`), tema escuro, identidade
   visual e instância de produção do Clerk.
3. **Próxima rodada de UX:** navegação persistente + tela de Conta (achados 9 e 12), ~3,5 h.
