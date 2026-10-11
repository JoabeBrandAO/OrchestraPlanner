# Product

<!-- impeccable:product-schema 1 -->

> Contexto de design do Impeccable (`init`), escrito em 2026-10-10 a partir de
> [VISAO-DO-PRODUTO.md](VISAO-DO-PRODUTO.md), [PROGRESSO.md](PROGRESSO.md) e do código.
> A entrevista do `init` não foi feita ao vivo: a sessão rodou sem canal de perguntas, com o
> brief do dono como fonte. O que é inferência está marcado com _(inferido)_; o resto está
> escrito nos documentos do produto. A Visão continua sendo a fonte da verdade do o quê e do
> porquê — se os dois discordarem, vale a Visão.

## Platform

web

## Users

- **Usuário primário:** o próprio dono (Joabe), que é cliente e administrador ao mesmo tempo.
  Uso diário e pessoal, para organizar a própria vida em torno de metas e prioridades.
- **Situação de uso** _(inferido da rotina do dono)_: sessões curtas entre outros
  compromissos — no computador no fim do expediente e no celular ao longo do dia (o app já
  tem manifest de PWA e lembrete por Web Push no iPhone). Poucas janelas longas de foco por
  semana, então cada visita precisa render sem reaprender a tela.
- **Futuro, não agora:** SaaS pago de produtividade pessoal (Fase 2, congelada em #21).
  Nenhuma decisão de UI deve supor outros usuários antes disso.

## Product Purpose

Gestão de vida pessoal integrada: **metas e prioridades** no centro, com **agenda**,
**pessoas e relacionamentos** e **financeiro** em volta. Existe para dar organização e
execução à vida. Sucesso, nas palavras da Visão: _planejamento e metas 100% executados,
agenda e financeiro em dia_.

## Positioning

O que um app de tarefas ou de finanças qualquer não pode copiar com verdade:

- **Corpo / Alma / Espírito** como estrutura de tudo. Metas, pessoas e a avaliação pertencem a
  áreas de vida agrupadas nessas três dimensões (base: Planner Líder de Impacto 2026).
- **Roda da Vida** (nota 0–10 por área, radar, histórico) como diagnóstico que aponta onde
  criar metas — o ponto de partida do uso, não um enfeite.
- **CRM pessoal de relacionamentos** inspirado no cadastro do IgrejasNet: aniversários,
  círculos (família, célula, amigos, mentores), convívio e "há quanto tempo não falo com X".

## Operating Context

- Rituais: avaliar a Roda da Vida → criar metas nas áreas mais baixas → levar o dia a dia no
  quadro de Prioridades → marcar compromissos na Agenda → cuidar das pessoas → fechar o mês
  no Financeiro.
- Vocabulário próprio do dono _(inferido do CLAUDE.md dele)_: "bloco" (sessão com hora
  marcada), "sprint", "Plano", "Metas". Evitar jargão de produtividade importado em inglês.
- Dados reais e sensíveis: finanças, dados de terceiros (Pessoas). LGPD tratada (#74).

## Capabilities and Constraints

- **No ar:** Metas (marcos, progresso, status), Prioridades (Kanban com arrastar e tags),
  Agenda (semana/mês, recorrência, exceções, lembrete por Web Push), Pessoas (contatos,
  vínculos, círculos, convívio, aniversários), Financeiro (contas, lançamentos, categorias,
  orçamento, relatório, importação OFX/CSV), Áreas de Vida, Roda da Vida, fuso do usuário,
  exportar e apagar a conta.
- **Stack travada:** Next.js 16 + tRPC + Drizzle + Postgres (Neon) + Clerk + shadcn/ui
  (sobre `@base-ui/react`) + Tailwind v4. Trabalho de UI não troca a stack.
- **CSP obrigatória com nonce** (#92): nada de script/estilo de origem externa sem passar por
  ela. Fonte via `next/font` (servida pelo próprio app).
- **Idioma:** português do Brasil em toda a interface, inclusive datas e moeda (`pt-BR`, R$).
- **Em aberto (decisão do dono):** tema escuro (os tokens existem, nada liga a classe
  `.dark`); idioma dos componentes do Clerk (login e menu da conta).

## Brand Commitments

- Nome: **OrchestraPlanner** (no iPhone, "Orchestra"). Não há logotipo, paleta ou tipografia
  de marca definidos; a identidade visual hoje é o tema neutro do shadcn.
- Voz _(inferida da cópia existente)_: direta, calorosa sem exagero, em segunda pessoa
  ("você"), frases curtas que dizem o próximo passo ("Comece pela Roda da Vida").

## Evidence on Hand

- O planner físico de referência está na raiz do repositório (PDF do Planner 2026), fora do
  controle de versão do app.
- Não há depoimentos, clientes, números de uso ou imagens de produto. Nada disso deve ser
  inventado em tela alguma.

## Product Principles

1. **A meta é o centro.** Toda tela responde "isto me aproxima de qual meta / área?".
2. **Retorno rápido.** Quem volta depois de dias acha onde parou sem reaprender a tela.
3. **Nada some sem querer.** Dado de vida (histórico, pessoas, dinheiro) não se perde num
   clique solto.
4. **Uso pessoal primeiro.** Nada de UI pensada para equipe ou para venda antes da Fase 2.

## Accessibility & Inclusion

WCAG 2.1 AA é requisito não funcional da Visão (§10): contraste mínimo de 4,5:1 em texto,
foco visível, rótulo em todo campo e anúncio de erro para leitor de tela.
