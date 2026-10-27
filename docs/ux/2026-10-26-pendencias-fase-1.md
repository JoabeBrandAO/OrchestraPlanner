# Pendências menores da Fase 1 — 2026-10-26

## Contraste das tags

As cores de tag são valores livres armazenados em `tags.color`, sem paleta fixa. Antes,
`priorities-board.tsx` e `tag-editor.tsx` aplicavam esse valor também ao texto: uma cor clara
sumia no tema claro e uma cor escura sumia no tema escuro.

Agora ambos usam `bg-background text-foreground` explicitamente. A cor cadastrada continua
na borda, e o nome continua identificando a tag. Nenhum dado ou preferência é regravado.
Mesmo uma cor cadastrada sem contraste deixa de afetar a legibilidade do texto.

O projeto não tem utilitário de luminância/contraste; as razões foram calculadas diretamente
dos tokens acromáticos de `src/app/globals.css`. Para `oklch(L 0 0)`, a luminância relativa
é `Y = L³`; WCAG usa `(Y mais clara + 0,05) / (Y mais escura + 0,05)`.

| Tema | Texto | Fundo | Razão calculada | WCAG AA (4,5:1) |
| --- | --- | --- | --- | --- |
| Claro | `oklch(0.145 0 0)` | `oklch(1 0 0)` | 19,793:1 | Atende |
| Escuro pelo sistema | `oklch(0.985 0 0)` | `oklch(0.145 0 0)` | 18,958:1 | Atende |

Cálculo reproduzível, sem pacotes externos:

```js
console.log(1.05 / (0.145 ** 3 + 0.05));
console.log((0.985 ** 3 + 0.05) / (0.145 ** 3 + 0.05));
```

## Resumo por área

A consulta existente do painel passa a trazer `life_areas.dimension`, e a agregação pura
repassa a dimensão junto com os números. A tela reutiliza `DimensionDot`, como Metas e
Áreas de Vida, com os tokens Corpo/Alma/Espírito dos dois temas. O nome da área fica visível;
o marcador é decorativo. "Sem área" tem dimensão nula e não recebe uma dimensão inventada.

## Botão Mais

Quando a rota real pertence ao menu, o botão tem `aria-current="true"` e nome acessível
`Mais, atual: <tela>`. O valor `true` indica o grupo atual; `page` continua reservado ao
link da página dentro da gaveta. O texto visível segue "Mais". O anúncio acompanha a rota,
inclusive nas subrotas, e não antecipa a tela apenas tocada enquanto a navegação está pendente.

## Limites da verificação

Os testes com Testing Library/jsdom verificam os marcadores e os atributos acessíveis.
Não houve navegador, captura de tela, leitor de tela real nem teste no iPhone nesta sessão.
As razões de contraste acima são cálculos dos tokens, não medições de uma tela renderizada.
