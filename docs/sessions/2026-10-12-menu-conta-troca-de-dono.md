# 2026-10-12 — Menu fixo, barra do celular, tela de Conta e troca de dono

- **Sessão:** Claude como subagente do OrchestraPlanner, a partir de `fe52b9a` (main). O dono
  liberou o trabalho ("está tudo liberado"); nenhum merge feito pela sessão.

## Entregue

| PR | O que é | CI |
|---|---|---|
| #135 | Menu lateral fixo (≥ 768 px), barra inferior Pílula (< 768 px), tela de Conta, mockup e auditoria do Impeccable | verde; E2E verde por *Run workflow* |
| #136 | `scripts/troca-de-dono.ts` + correção do `provisionUser` + etapa 7 do guia do Clerk | verde (13 testes da troca rodaram no Postgres do CI) |

## Decisões e porquês

- **Uma lista de telas para os dois menus** (`nav-items.ts`), corte único em `md`: menu lateral
  e barra nunca aparecem juntos nem discordam.
- **Pílula** (escolha do dono entre Pílula, Traço e Botão central) na cor `--marcador`: marcador
  de página do planner, couro no claro e papel no escuro. As cores de Corpo / Alma / Espírito
  ficam fora do menu porque lá querem dizer a dimensão.
- **Metas na barra, Financeiro no "Mais"**: "a meta é o centro" (`PRODUCT.md`). Trocar é mudar
  `MOBILE_PRIMARY`.
- **Conta é o único lugar de conta:** o avatar do Clerk saiu do painel; "Gerenciar login" e
  "Sair" moram na Conta.
- **Troca de dono numa transação, simulando por padrão**, recusando conexão sujeita à RLS (sob
  ela, o apagar do usuário antigo levaria tudo junto) e conferindo cada UPDATE contra a contagem.
- **Testes de integração da troca só no CI:** o `.env` local aponta para o Neon; localmente
  rodaram só os testes puros, com as conexões desligadas.

## Achados

- O **e-mail é único** em `users`: entrar no app de produção com o ID novo antes da etapa 7 dá
  erro na tela. Guia corrigido para criar o usuário pelo painel do Clerk, rodar o script e só
  então entrar.
- `provisionUser` ressuscitava área padrão apagada a cada `user.updated` (`docs/ERROS.md`).

## Onde paramos / próximo passo

1. Dono: mesclar #135 e #136 (independentes).
2. Dono: conferir a barra no iPhone (~10 min).
3. Dono: Clerk de produção pelo `docs/CLERK-PRODUCAO.md`, com a etapa 7 usando o script.
4. Sugestões de UI fora da barra, não aplicadas a pedido do dono, em
   `docs/ux/2026-10-12-auditoria-navegacao.md`.
