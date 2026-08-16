/**
 * Dinheiro (#52) — regra **pura**, sem banco.
 *
 * **Valor é guardado em centavos inteiros**, nunca em ponto flutuante. `0.1 + 0.2` não dá
 * `0.3` e `19.99 * 100` não dá `1999`; num extrato isso não é curiosidade acadêmica, é
 * centavo sumido que ninguém consegue explicar depois. Em centavos, toda soma é aritmética
 * de inteiro e fecha exata (ver `money.test.ts`, que guarda a demonstração).
 *
 * `numeric` do Postgres também resolveria, mas trafega como string e obriga uma biblioteca
 * decimal em todo cálculo; inteiro é o que o JavaScript faz certo sem ajuda.
 */

/** Valor em centavos. Sempre inteiro. */
export type Cents = number;

/** Até onde o inteiro do JavaScript é exato — ~90 quatrilhões de reais, folga suficiente. */
const MAX_CENTS = Number.MAX_SAFE_INTEGER;

/**
 * Converte o que foi digitado em centavos. Aceita "1.234,56", "1234,56" e "1234.56" — o
 * campo numérico do navegador manda ponto, e gente digita vírgula.
 *
 * Devolve `null` para o que não é valor **e para zero ou negativo**: o sinal de um
 * lançamento vem do **tipo** (entrada/saída), não do número. Aceitar "-50" criaria duas
 * formas de dizer a mesma coisa, e uma delas some quando alguém troca o tipo e esquece o
 * sinal.
 */
export function parseAmount(input: string): Cents | null {
  const limpo = input
    .trim()
    .replace(/^R\$\s*/i, "")
    .replace(/\s/g, "");
  if (limpo === "") return null;

  // Formato brasileiro: o ponto é separador de milhar e a vírgula é o decimal.
  const normalizado = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  if (!/^\d+(\.\d+)?$/.test(normalizado)) return null;

  // A conversão é feita **em cima do texto**, sem passar por ponto flutuante nem uma vez.
  // `Math.round(Number("1.005") * 100)` devolve 100, não 101: `1.005 * 100` dá
  // 100.49999999999999. Ou seja, até o código que existe para fugir do float erra se
  // multiplicar por 100 no caminho — o teste guarda esse caso.
  const [inteiro, fracao = ""] = normalizado.split(".");
  const centavos = Number((fracao + "00").slice(0, 2));
  // Arredonda pelo terceiro decimal; truncar erra sempre para o mesmo lado, e "sempre para
  // o mesmo lado" é o que transforma arredondamento em prejuízo.
  const arredonda = Number(fracao[2] ?? "0") >= 5 ? 1 : 0;

  const cents = Number(inteiro) * 100 + centavos + arredonda;
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > MAX_CENTS) return null;

  return cents;
}

/** Centavos como texto no formato brasileiro, sempre com dois decimais. */
export function formatCents(cents: Cents): string {
  const negativo = cents < 0;
  const absoluto = Math.abs(cents);
  const reais = Math.floor(absoluto / 100);
  const centavos = String(absoluto % 100).padStart(2, "0");

  return `${negativo ? "-" : ""}${reais.toLocaleString("pt-BR")},${centavos}`;
}

/** Soma centavos. Existe para deixar claro que a soma é de inteiros, e nunca de reais. */
export function sumCents(values: readonly Cents[]): Cents {
  return values.reduce((total, value) => total + value, 0);
}
