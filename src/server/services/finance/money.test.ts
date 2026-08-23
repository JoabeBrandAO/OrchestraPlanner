import { describe, expect, it } from "vitest";

import { formatCents, parseAmount, parseSignedAmount, sumCents } from "./money";

/**
 * Dinheiro (#52) — regra pura. O teste mais importante deste arquivo é o que demonstra
 * **por que** o valor é guardado em centavos inteiros: em ponto flutuante a conta erra, e
 * num extrato o erro tem nome — centavo sumido.
 */

describe("por que centavos inteiros", () => {
  it("ponto flutuante erra a conta que qualquer criança acerta", () => {
    // Este é o motivo da decisão, escrito como teste para ninguém "simplificar" depois.
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(19.99 * 100).not.toBe(1999);
    // E truncar em vez de arredondar transforma o erro em dinheiro perdido:
    expect(Math.trunc(19.99 * 100)).toBe(1998);
  });

  it("em centavos, a mesma conta fecha", () => {
    expect(sumCents([10, 20])).toBe(30);
    expect(parseAmount("19,99")).toBe(1999);
  });
});

describe("parseAmount", () => {
  it("aceita o formato brasileiro", () => {
    expect(parseAmount("1.234,56")).toBe(123456);
    expect(parseAmount("1234,56")).toBe(123456);
    expect(parseAmount("0,05")).toBe(5);
  });

  it("aceita o formato com ponto decimal, que é o que os campos numéricos mandam", () => {
    expect(parseAmount("1234.56")).toBe(123456);
    expect(parseAmount("0.05")).toBe(5);
  });

  it("completa os centavos que faltam", () => {
    expect(parseAmount("10")).toBe(1000);
    expect(parseAmount("10,5")).toBe(1050);
  });

  it("ignora espaços e o símbolo da moeda", () => {
    expect(parseAmount(" R$ 1.234,56 ")).toBe(123456);
  });

  it("arredonda o terceiro decimal em vez de truncar — truncar é sempre a favor de alguém", () => {
    expect(parseAmount("1,005")).toBe(101);
    expect(parseAmount("1,004")).toBe(100);
  });

  it("recusa o que não é valor", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("1,2,3")).toBeNull();
  });

  it("recusa zero e negativo — o sinal vem do tipo do lançamento, não do número", () => {
    // Guardar "-50" como saída deixaria duas formas de dizer a mesma coisa, e uma delas
    // some quando alguém troca o tipo sem trocar o sinal.
    expect(parseAmount("0")).toBeNull();
    expect(parseAmount("0,00")).toBeNull();
    expect(parseAmount("-50")).toBeNull();
  });
});

describe("formatCents", () => {
  it("mostra sempre com dois decimais", () => {
    expect(formatCents(123456)).toBe("1.234,56");
    expect(formatCents(5)).toBe("0,05");
    expect(formatCents(1000)).toBe("10,00");
  });

  it("mostra o negativo com sinal — saldo devedor existe", () => {
    // Aqui o negativo é legítimo: é um saldo, não um lançamento.
    expect(formatCents(-1234)).toBe("-12,34");
  });

  it("zero é zero, não vazio", () => {
    expect(formatCents(0)).toBe("0,00");
  });
});

describe("sumCents", () => {
  it("soma sem erro de arredondamento, por mais parcelas que sejam", () => {
    // 1000 × 1 centavo tem que dar exatamente 10 reais.
    expect(sumCents(Array.from({ length: 1000 }, () => 1))).toBe(1000);
  });

  it("lista vazia soma zero", () => {
    expect(sumCents([])).toBe(0);
  });
});

describe("valor com sinal (extrato)", () => {
  it("traduz o sinal do banco para o sentido do app", () => {
    expect(parseSignedAmount("-120.00")).toEqual({ direction: "saida", amountCents: 12000 });
    expect(parseSignedAmount("120.00")).toEqual({ direction: "entrada", amountCents: 12000 });
    expect(parseSignedAmount("+120,00")).toEqual({ direction: "entrada", amountCents: 12000 });
  });

  it("aceita as duas notações decimais que os bancos usam", () => {
    expect(parseSignedAmount("-1.234,56")).toEqual({ direction: "saida", amountCents: 123456 });
    expect(parseSignedAmount("-1234.56")).toEqual({ direction: "saida", amountCents: 123456 });
  });

  it("o número que sai é sempre positivo — o menos virou sentido", () => {
    expect(parseSignedAmount("-0,01")!.amountCents).toBe(1);
  });

  it("zero e lixo devolvem null, para virarem linha reportada", () => {
    expect(parseSignedAmount("0.00")).toBeNull();
    expect(parseSignedAmount("-0,00")).toBeNull();
    expect(parseSignedAmount("")).toBeNull();
    expect(parseSignedAmount("abc")).toBeNull();
  });
});
