import { describe, expect, it } from "vitest";

import {
  decodeStatement,
  detectFormat,
  normalizeDescription,
  parseCsv,
  parseCsvDate,
  parseOfx,
  parseOfxDate,
  parseStatement,
  suggestCategories,
  type ParsedEntry,
} from "./statement-import";

/**
 * Importação de extrato (#55) — leitura pura, com pedaços de extrato de verdade.
 *
 * Os dois arquivos abaixo são recortes do que os bancos brasileiros mandam: OFX 1.x em SGML
 * (sem tag de fechamento nos campos, `TRNAMT` negativo, `DTPOSTED` com hora e fuso) e CSV com
 * `;`, data `DD/MM/AAAA` e decimal com vírgula.
 */

const OFX = `OFXHEADER:100
DATA:OFXSGML
VERSION:102

<OFX>
<BANKMSGSRSV1><STMTTRNRS><STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260805120000[-3:BRT]
<TRNAMT>-120.50
<FITID>202608050001
<MEMO>SUPERMERCADO SAO JOAO
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260805
<TRNAMT>3500.00
<FITID>202608050002
<NAME>PAGAMENTO SALARIO
</STMTTRN>
</BANKTRANLIST>
</STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>`;

const CSV = `Data;Histórico;Valor
05/08/2026;SUPERMERCADO SÃO JOÃO;-120,50
06/08/2026;"PADARIA CENTRAL; LTDA";-15,00
07/08/2026;PAGAMENTO SALARIO;3.500,00`;

describe("descoberta do formato", () => {
  it("reconhece OFX pelo conteúdo, não pela extensão", () => {
    expect(detectFormat(OFX)).toBe("ofx");
    // `.txt` com OFX dentro é comum.
    expect(detectFormat("<OFX><STMTTRN></STMTTRN></OFX>")).toBe("ofx");
  });

  it("cai para CSV quando há separador, e recusa arquivo que não é extrato", () => {
    expect(detectFormat(CSV)).toBe("csv");
    expect(detectFormat("um texto qualquer sem nada")).toBeNull();
  });
});

describe("datas", () => {
  it("descarta hora e fuso do OFX", () => {
    expect(parseOfxDate("20260805120000[-3:BRT]")).toBe("2026-08-05");
    expect(parseOfxDate("20260805")).toBe("2026-08-05");
  });

  it("aceita as três formas de data que aparecem em CSV", () => {
    expect(parseCsvDate("05/08/2026")).toBe("2026-08-05");
    expect(parseCsvDate("05-08-2026")).toBe("2026-08-05");
    expect(parseCsvDate("2026-08-05")).toBe("2026-08-05");
  });

  it("recusa data que casa com o formato mas não existe no calendário", () => {
    // O caso que passa por qualquer regex e vira 1º de março sem ninguém notar.
    expect(parseCsvDate("30/02/2026")).toBeNull();
    expect(parseOfxDate("20260230")).toBeNull();
    expect(parseCsvDate("data")).toBeNull();
  });
});

describe("OFX", () => {
  it("lê os lançamentos, com o sinal virando sentido", () => {
    const extrato = parseOfx(OFX);

    expect(extrato.problems).toEqual([]);
    expect(extrato.entries).toEqual([
      {
        externalId: "ofx:202608050001",
        happenedAt: "2026-08-05",
        direction: "saida",
        amountCents: 12050,
        description: "SUPERMERCADO SAO JOAO",
      },
      {
        externalId: "ofx:202608050002",
        happenedAt: "2026-08-05",
        direction: "entrada",
        amountCents: 350000,
        // Sem MEMO, o NAME é o que sobra — e é o nome do estabelecimento.
        description: "PAGAMENTO SALARIO",
      },
    ]);
  });

  it("a identidade é o FITID do banco, não um palpite nosso", () => {
    // Ler duas vezes dá exatamente os mesmos ids: é isso que impede a duplicata.
    expect(parseOfx(OFX).entries.map((e) => e.externalId)).toEqual(
      parseOfx(OFX).entries.map((e) => e.externalId),
    );
  });

  it("reporta o lançamento sem FITID em vez de inventar identidade", () => {
    const semId = OFX.replace("<FITID>202608050001\n", "");
    const extrato = parseOfx(semId);

    expect(extrato.entries).toHaveLength(1);
    expect(extrato.problems).toHaveLength(1);
    expect(extrato.problems[0]!.reason).toMatch(/FITID/);
    expect(extrato.problems[0]!.raw).toMatch(/SUPERMERCADO/);
  });

  it("reporta data e valor ruins, e segue com o resto do arquivo", () => {
    const quebrado = OFX.replace("<TRNAMT>-120.50", "<TRNAMT>0.00").replace(
      "<DTPOSTED>20260805\n",
      "<DTPOSTED>nada\n",
    );
    const extrato = parseOfx(quebrado);

    expect(extrato.entries).toEqual([]);
    expect(extrato.problems.map((p) => p.reason)).toEqual([
      expect.stringMatching(/TRNAMT|zero/),
      expect.stringMatching(/DTPOSTED/),
    ]);
    // A linha do problema aponta para dentro do arquivo, senão o relato não ajuda ninguém.
    expect(extrato.problems[0]!.line).toBeGreaterThan(1);
  });

  it("arquivo sem lançamento nenhum é reportado, não devolvido vazio em silêncio", () => {
    const extrato = parseOfx("<OFX></OFX>");
    expect(extrato.problems[0]!.reason).toMatch(/Nenhum lançamento/);
  });
});

describe("CSV", () => {
  it("lê separador, decimal e data no formato brasileiro", () => {
    const extrato = parseCsv(CSV);

    expect(extrato.problems).toEqual([]);
    expect(extrato.entries).toHaveLength(3);
    expect(extrato.entries[0]).toMatchObject({
      happenedAt: "2026-08-05",
      direction: "saida",
      amountCents: 12050,
      description: "SUPERMERCADO SÃO JOÃO",
    });
    expect(extrato.entries[2]).toMatchObject({ direction: "entrada", amountCents: 350000 });
  });

  it("respeita aspas: separador dentro da descrição não parte a linha", () => {
    expect(parseCsv(CSV).entries[1]!.description).toBe("PADARIA CENTRAL; LTDA");
  });

  it("aceita o CSV internacional — vírgula como separador e ponto decimal", () => {
    const internacional = `Date,Description,Amount
2026-08-05,GROCERY STORE,-120.50`;
    const extrato = parseCsv(internacional);

    expect(extrato.problems).toEqual([]);
    expect(extrato.entries[0]).toMatchObject({
      happenedAt: "2026-08-05",
      direction: "saida",
      amountCents: 12050,
    });
  });

  it("duas linhas idênticas continuam sendo dois lançamentos", () => {
    // Dois cafés de R$ 5 no mesmo dia acontecem; a posição entre idênticas os separa.
    const repetido = `Data;Histórico;Valor
05/08/2026;CAFE;-5,00
05/08/2026;CAFE;-5,00`;
    const ids = parseCsv(repetido).entries.map((e) => e.externalId);

    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it("a impressão digital não depende de linha em branco nem da ordem do arquivo", () => {
    // O mesmo extrato reexportado com uma linha em branco no meio tem que dar os mesmos ids,
    // senão a segunda importação duplicaria tudo.
    const comEspaco = CSV.split("\n").join("\n\n");
    expect(parseCsv(comEspaco).entries.map((e) => e.externalId)).toEqual(
      parseCsv(CSV).entries.map((e) => e.externalId),
    );
  });

  it("reporta a linha ruim e importa as boas", () => {
    const comLixo = `Data;Histórico;Valor
05/08/2026;SUPERMERCADO;-120,50
linha estragada
07/08/2026;SALARIO;3.500,00`;
    const extrato = parseCsv(comLixo);

    expect(extrato.entries).toHaveLength(2);
    expect(extrato.problems).toHaveLength(1);
    expect(extrato.problems[0]!.line).toBe(3);
    expect(extrato.problems[0]!.raw).toBe("linha estragada");
  });

  it("cabeçalho irreconhecível é reportado em vez de virar lixo importado", () => {
    const extrato = parseCsv("a;b;c\n1;2;3");

    expect(extrato.entries).toEqual([]);
    expect(extrato.problems[0]!.reason).toMatch(/Cabeçalho não reconhecido/);
  });

  it("arquivo vazio é reportado", () => {
    expect(parseCsv("").problems[0]!.reason).toMatch(/vazio/i);
  });
});

describe("parseStatement", () => {
  it("escolhe o leitor sozinho e devolve null para o que não é extrato", () => {
    expect(parseStatement(OFX)!.format).toBe("ofx");
    expect(parseStatement(CSV)!.format).toBe("csv");
    expect(parseStatement("nada disso aqui")).toBeNull();
  });
});

describe("sugestão de categoria pelo histórico", () => {
  const entrada = (description: string, direction: "entrada" | "saida" = "saida"): ParsedEntry => ({
    externalId: `ofx:${description}`,
    happenedAt: "2026-08-05",
    direction,
    amountCents: 1000,
    description,
  });

  it("casa descrição igual, ignorando acento e caixa", () => {
    const sugestoes = suggestCategories(
      [entrada("SUPERMERCADO SAO JOAO")],
      [{ description: "Supermercado São João", direction: "saida", categoryId: "cat-ali" }],
    );

    expect(sugestoes.get("ofx:SUPERMERCADO SAO JOAO")).toBe("cat-ali");
  });

  it("não sugere nada quando a descrição só se parece — palpite errado é pior que nenhum", () => {
    const sugestoes = suggestCategories(
      [entrada("SUPERMERCADO SAO JOAO FILIAL 2")],
      [{ description: "Supermercado São João", direction: "saida", categoryId: "cat-ali" }],
    );

    expect(sugestoes.size).toBe(0);
  });

  it("não atravessa o sentido: entrada não herda categoria de saída", () => {
    const sugestoes = suggestCategories(
      [entrada("TRANSFERENCIA", "entrada")],
      [{ description: "TRANSFERENCIA", direction: "saida", categoryId: "cat-out" }],
    );

    expect(sugestoes.size).toBe(0);
  });

  it("com histórico dividido, vence a categoria mais usada", () => {
    const sugestoes = suggestCategories(
      [entrada("POSTO IPIRANGA")],
      [
        { description: "Posto Ipiranga", direction: "saida", categoryId: "cat-transporte" },
        { description: "Posto Ipiranga", direction: "saida", categoryId: "cat-lazer" },
        { description: "Posto Ipiranga", direction: "saida", categoryId: "cat-transporte" },
      ],
    );

    expect(sugestoes.get("ofx:POSTO IPIRANGA")).toBe("cat-transporte");
  });

  it("empate na frequência é desempatado pelo mais recente", () => {
    const sugestoes = suggestCategories(
      [entrada("FARMACIA")],
      [
        // Histórico chega do mais novo para o mais antigo.
        { description: "Farmacia", direction: "saida", categoryId: "cat-saude" },
        { description: "Farmacia", direction: "saida", categoryId: "cat-outros" },
      ],
    );

    expect(sugestoes.get("ofx:FARMACIA")).toBe("cat-saude");
  });

  it("lançamento sem descrição não recebe palpite", () => {
    const sugestoes = suggestCategories(
      [entrada("")],
      [{ description: "", direction: "saida", categoryId: "cat-x" }],
    );

    expect(sugestoes.size).toBe(0);
  });
});

describe("normalização", () => {
  it("tira acento, caixa e espaço repetido", () => {
    expect(normalizeDescription("  SUPERMERCADO   São  João ")).toBe("supermercado sao joao");
  });
});

describe("codificação do arquivo", () => {
  it("lê UTF-8 normalmente", () => {
    const bytes = new TextEncoder().encode("SUPERMERCADO SÃO JOÃO");
    expect(decodeStatement(bytes)).toBe("SUPERMERCADO SÃO JOÃO");
  });

  it("cai para windows-1252 quando o arquivo não é UTF-8", () => {
    // "SÃO" em windows-1252: o 0xC3 sozinho é inválido em UTF-8, e é isso que denuncia.
    const bytes = new Uint8Array([0x53, 0xc3, 0x4f]);
    expect(decodeStatement(bytes)).toBe("SÃO");
  });

  it("não devolve caractere de substituição em silêncio", () => {
    const bytes = new Uint8Array([0x50, 0xc3, 0x83, 0x4f]);
    expect(decodeStatement(bytes)).not.toContain("�");
  });
});
