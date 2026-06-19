# FORMATACAO.md — Padrão de formatação (evolui a cada execução)

> **Por quê (Mega_Build §2/§6):** padrão de formatação do repositório que o agente
> **refina continuamente**. O hook `PostToolUse` (`.claude/hooks/format.ps1`) aplica
> automaticamente o que for automatizável; este documento registra as convenções.

## Estado atual (projeto greenfield)

Ainda **não há** toolchain instalado (o projeto Next.js não foi inicializado). Até lá,
o hook de formatação é um no-op seguro. As convenções abaixo passam a valer assim que a
Iteração 0 criar o `package.json`.

## Convenções-alvo (a aplicar na Iteração 0)

### Código (TS/TSX/JS/CSS/JSON)
- **Prettier** como formatador único (largura padrão, aspas duplas, ponto-e-vírgula on).
- **ESLint** com config do `create-next-app` (TS strict) + import ordering.
- TypeScript em **strict mode**; sem `any` implícito.

### Markdown
- Títulos em sentence case; uma frase por linha em parágrafos longos quando ajudar o diff.
- Tabelas alinhadas por pipe; blocos de código com linguagem declarada.
- Links relativos entre docs do repo (ex.: `[VISAO](VISAO-DO-PRODUTO.md)`).

### Commits
- **Conventional Commits**: `tipo(escopo): assunto` no imperativo, ≤72 caracteres.
- Corpo explica **o quê e o porquê**; rodapé referencia issues e id de sessão.

## Histórico de refinamentos
- **2026-06-18** — documento criado no auto-bootstrap do Mega_Build (papel: Desenvolvedor de Software).
