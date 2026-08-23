import { parseSignedAmount, type Cents } from "./money";

/**
 * Importação de extrato (#55) — leitura **pura**, sem banco.
 *
 * Duas regras mandam neste arquivo:
 *
 * 1. **Identidade vem do arquivo, não de palpite.** No OFX existe o `FITID`, que o banco
 *    promete ser único; é ele quem impede a segunda importação de duplicar o extrato. No CSV
 *    não existe nada disso, então a identidade é uma **impressão digital** montada da linha
 *    (data + valor + descrição + a posição entre linhas idênticas). É honestamente inferior,
 *    e por isso está escrito aqui: dois cafés de R$ 5 no mesmo dia continuam sendo dois
 *    lançamentos, porque a posição os separa.
 * 2. **Linha que não dá para interpretar é reportada, nunca engolida.** Extrato pela metade,
 *    importado em silêncio, é pior do que importação nenhuma — o saldo fecha errado e
 *    ninguém sabe por quê.
 */

export type StatementFormat = "ofx" | "csv";

export type ParsedEntry = {
  /** Identidade estável do lançamento no arquivo — `ofx:<FITID>` ou `csv:<impressão>`. */
  externalId: string;
  happenedAt: string;
  direction: "entrada" | "saida";
  amountCents: Cents;
  description: string;
};

export type LineProblem = {
  /** Linha do arquivo (1-based), para a pessoa achar o problema no arquivo dela. */
  line: number;
  reason: string;
  /** O texto cru, cortado — sem isso o relato vira "deu erro em algum lugar". */
  raw: string;
};

export type ParsedStatement = {
  format: StatementFormat;
  entries: ParsedEntry[];
  problems: LineProblem[];
};

const MAX_RAW = 120;

const corta = (texto: string) => (texto.length > MAX_RAW ? `${texto.slice(0, MAX_RAW)}…` : texto);

/**
 * Texto comparável: sem acento, sem caixa, sem espaço repetido. Serve para a impressão
 * digital do CSV e para casar a descrição com o histórico ao sugerir categoria.
 */
export function normalizeDescription(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Descobre o formato pelo conteúdo, não pela extensão: arquivo de banco chega com nome de
 * tudo quanto é jeito, e `.txt` com OFX dentro é comum.
 */
export function detectFormat(content: string): StatementFormat | null {
  const inicio = content.slice(0, 2000).toUpperCase();
  if (inicio.includes("OFXHEADER") || inicio.includes("<OFX>") || inicio.includes("<STMTTRN>")) {
    return "ofx";
  }
  // CSV é o palpite de fallback, mas só se houver alguma linha com separador — arquivo
  // vazio ou binário não é "CSV com problema", é arquivo errado.
  return /[;,\t].*\r?\n/.test(content) || content.includes(";") || content.includes(",")
    ? "csv"
    : null;
}

/** Número da linha (1-based) onde um índice do texto cai. */
function lineAt(content: string, index: number): number {
  let linha = 1;
  for (let i = 0; i < index && i < content.length; i++) {
    if (content[i] === "\n") linha++;
  }
  return linha;
}

/** `YYYYMMDD…` (o `DTPOSTED` do OFX) → `AAAA-MM-DD`. Hora e fuso do banco são descartados. */
export function parseOfxDate(raw: string): string | null {
  const digitos = raw.trim().replace(/^\D+/, "");
  if (digitos.length < 8) return null;

  const iso = `${digitos.slice(0, 4)}-${digitos.slice(4, 6)}-${digitos.slice(6, 8)}`;
  return isValidIsoDate(iso) ? iso : null;
}

/** Data de CSV: `DD/MM/AAAA`, `DD-MM-AAAA` ou `AAAA-MM-DD`. */
export function parseCsvDate(raw: string): string | null {
  const texto = raw.trim();

  const brasileira = /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(texto);
  if (brasileira) {
    const iso = `${brasileira[3]}-${brasileira[2]}-${brasileira[1]}`;
    return isValidIsoDate(iso) ? iso : null;
  }

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto);
  return iso && isValidIsoDate(iso[0]) ? iso[0] : null;
}

/**
 * Data que existe no calendário. `2026-02-30` casa com qualquer regex de formato e não é dia
 * nenhum; o `Date` do UTC devolve 1º de março, e a comparação denuncia.
 */
function isValidIsoDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;

  const data = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === iso;
}

/** Valor de uma tag SGML/XML do OFX, que fecha por `<` ou por fim de linha. */
function ofxTag(block: string, tag: string): string | null {
  const match = new RegExp(`<${tag}>([^<\\r\\n]*)`, "i").exec(block);
  return match ? match[1]!.trim() : null;
}

/**
 * OFX 1.x (SGML, sem tag de fechamento) e 2.x (XML) — os dois têm `<STMTTRN>` delimitando
 * cada lançamento, e é só disso que a leitura precisa.
 */
export function parseOfx(content: string): ParsedStatement {
  const entries: ParsedEntry[] = [];
  const problems: LineProblem[] = [];

  const blocos = content.matchAll(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi);
  let achouAlgum = false;

  for (const bloco of blocos) {
    achouAlgum = true;
    const texto = bloco[1]!;
    const line = lineAt(content, bloco.index);

    const fitid = ofxTag(texto, "FITID");
    const dtposted = ofxTag(texto, "DTPOSTED");
    const trnamt = ofxTag(texto, "TRNAMT");
    // `MEMO` é o que o banco escreve para a pessoa ler; `NAME` costuma ser o estabelecimento.
    const descricao = ofxTag(texto, "MEMO") ?? ofxTag(texto, "NAME") ?? "";

    const happenedAt = dtposted ? parseOfxDate(dtposted) : null;
    const valor = trnamt ? parseSignedAmount(trnamt) : null;

    if (!happenedAt) {
      problems.push({ line, reason: "Sem data válida (DTPOSTED).", raw: corta(texto.trim()) });
      continue;
    }
    if (!valor) {
      problems.push({
        line,
        reason: "Sem valor válido (TRNAMT) — ou valor zero.",
        raw: corta(texto.trim()),
      });
      continue;
    }
    if (!fitid) {
      // Sem FITID não há identidade do banco, e importar assim traria duplicata na segunda
      // vez. Reportar é melhor do que inventar identidade num arquivo que deveria ter uma.
      problems.push({
        line,
        reason: "Sem identificador (FITID) — não dá para garantir que não duplica.",
        raw: corta(texto.trim()),
      });
      continue;
    }

    entries.push({
      externalId: `ofx:${fitid}`,
      happenedAt,
      direction: valor.direction,
      amountCents: valor.amountCents,
      description: descricao.replace(/\s+/g, " ").trim(),
    });
  }

  if (!achouAlgum) {
    problems.push({ line: 1, reason: "Nenhum lançamento (<STMTTRN>) encontrado.", raw: "" });
  }

  return { format: "ofx", entries, problems };
}

/** Divide uma linha de CSV respeitando aspas — descrição com o separador dentro é comum. */
function splitCsvLine(line: string, delimiter: string): string[] {
  const campos: string[] = [];
  let atual = "";
  let dentroDeAspas = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;

    if (c === '"') {
      // `""` dentro de aspas é uma aspa literal.
      if (dentroDeAspas && line[i + 1] === '"') {
        atual += '"';
        i++;
      } else {
        dentroDeAspas = !dentroDeAspas;
      }
      continue;
    }

    if (c === delimiter && !dentroDeAspas) {
      campos.push(atual);
      atual = "";
      continue;
    }

    atual += c;
  }

  campos.push(atual);
  return campos.map((campo) => campo.trim());
}

/** O separador é o que mais aparece no cabeçalho — `;` no Brasil, `,` lá fora. */
function detectDelimiter(header: string): string {
  const candidatos = [";", ",", "\t"];
  return candidatos.reduce((melhor, atual) =>
    header.split(atual).length > header.split(melhor).length ? atual : melhor,
  );
}

const COLUNAS = {
  date: ["data", "date", "data lancamento", "data movimento", "posted date"],
  description: ["descricao", "historico", "lancamento", "description", "memo", "detalhes"],
  amount: ["valor", "amount", "value", "quantia"],
};

/** Acha as colunas pelo nome, aceitando as variações que os bancos usam. */
function mapColumns(
  header: string[],
): { date: number; description: number; amount: number } | null {
  const normalizado = header.map(normalizeDescription);
  const acha = (nomes: string[]) =>
    normalizado.findIndex((coluna) => nomes.some((nome) => coluna.includes(nome)));

  const date = acha(COLUNAS.date);
  const amount = acha(COLUNAS.amount);
  const description = acha(COLUNAS.description);

  // Sem data ou sem valor não há extrato. Descrição é desejável, não obrigatória.
  return date >= 0 && amount >= 0 ? { date, amount, description } : null;
}

export function parseCsv(content: string): ParsedStatement {
  const problems: LineProblem[] = [];
  const entries: ParsedEntry[] = [];

  const linhas = content.split(/\r?\n/);
  const primeira = linhas.findIndex((linha) => linha.trim() !== "");
  if (primeira < 0) {
    return { format: "csv", entries, problems: [{ line: 1, reason: "Arquivo vazio.", raw: "" }] };
  }

  const delimiter = detectDelimiter(linhas[primeira]!);
  const colunas = mapColumns(splitCsvLine(linhas[primeira]!, delimiter));
  if (!colunas) {
    return {
      format: "csv",
      entries,
      problems: [
        {
          line: primeira + 1,
          reason: "Cabeçalho não reconhecido — preciso de uma coluna de data e uma de valor.",
          raw: corta(linhas[primeira]!),
        },
      ],
    };
  }

  /** Quantas vezes cada impressão digital já apareceu **neste arquivo**. */
  const vistas = new Map<string, number>();

  for (let i = primeira + 1; i < linhas.length; i++) {
    const linha = linhas[i]!;
    if (linha.trim() === "") continue;

    const line = i + 1;
    const campos = splitCsvLine(linha, delimiter);
    const happenedAt = parseCsvDate(campos[colunas.date] ?? "");
    const valor = parseSignedAmount(campos[colunas.amount] ?? "");

    if (!happenedAt) {
      problems.push({ line, reason: "Data não reconhecida.", raw: corta(linha) });
      continue;
    }
    if (!valor) {
      problems.push({ line, reason: "Valor não reconhecido — ou valor zero.", raw: corta(linha) });
      continue;
    }

    const description =
      colunas.description >= 0
        ? (campos[colunas.description] ?? "").replace(/\s+/g, " ").trim()
        : "";

    // A impressão digital não tem o número da linha: um extrato reexportado pode vir com
    // cabeçalho a mais ou linha em branco a menos, e a identidade não pode depender disso.
    // A ordem entre linhas **idênticas** entra, para dois cafés de R$ 5 no mesmo dia
    // continuarem sendo dois lançamentos.
    const impressao = [
      happenedAt,
      valor.direction === "saida" ? `-${valor.amountCents}` : `${valor.amountCents}`,
      normalizeDescription(description),
    ].join("|");
    const ordem = vistas.get(impressao) ?? 0;
    vistas.set(impressao, ordem + 1);

    entries.push({
      externalId: `csv:${impressao}|${ordem}`,
      happenedAt,
      direction: valor.direction,
      amountCents: valor.amountCents,
      description,
    });
  }

  if (entries.length === 0 && problems.length === 0) {
    problems.push({ line: primeira + 1, reason: "Nenhuma linha de lançamento.", raw: "" });
  }

  return { format: "csv", entries, problems };
}

/** Lê o extrato descobrindo o formato sozinho. */
export function parseStatement(content: string): ParsedStatement | null {
  const format = detectFormat(content);
  if (!format) return null;

  return format === "ofx" ? parseOfx(content) : parseCsv(content);
}

export type CategoryHistory = {
  description: string | null;
  direction: "entrada" | "saida";
  categoryId: string;
};

/**
 * Sugere categoria pelo histórico da descrição (#55).
 *
 * A regra é deliberadamente burra: **descrição igual (normalizada) e mesmo sentido**. Nada de
 * semelhança aproximada — categorizar errado em silêncio é pior do que não categorizar, e a
 * pessoa não tem como desconfiar de um palpite que ela nunca viu ser feito.
 *
 * Empate de frequência é desempatado pelo mais recente, então `history` deve vir do mais novo
 * para o mais antigo.
 */
export function suggestCategories(
  entries: readonly ParsedEntry[],
  history: readonly CategoryHistory[],
): Map<string, string> {
  const porDescricao = new Map<string, Map<string, number>>();

  for (const item of history) {
    if (!item.description) continue;
    const chave = `${item.direction}|${normalizeDescription(item.description)}`;
    const contagem = porDescricao.get(chave) ?? new Map<string, number>();
    contagem.set(item.categoryId, (contagem.get(item.categoryId) ?? 0) + 1);
    porDescricao.set(chave, contagem);
  }

  const sugestoes = new Map<string, string>();
  for (const entry of entries) {
    if (entry.description === "") continue;

    const contagem = porDescricao.get(
      `${entry.direction}|${normalizeDescription(entry.description)}`,
    );
    if (!contagem) continue;

    // `Map` preserva a ordem de inserção, que é a do histórico (mais recente primeiro):
    // com empate de frequência, o `>` estrito mantém quem entrou antes, o mais recente.
    let melhor: string | null = null;
    let maior = 0;
    for (const [categoryId, vezes] of contagem) {
      if (vezes > maior) {
        melhor = categoryId;
        maior = vezes;
      }
    }

    if (melhor) sugestoes.set(entry.externalId, melhor);
  }

  return sugestoes;
}

/**
 * Decodifica os bytes do arquivo. Extrato de banco brasileiro ainda vem em **windows-1252**
 * com frequência, e ler isso como UTF-8 transforma "SÃO JOÃO" em caractere quebrado — que
 * depois vira descrição errada, categoria não reconhecida e conciliação furada.
 *
 * A tentativa em UTF-8 é `fatal`: sem isso o decodificador engole o byte inválido, devolve
 * "�" e ninguém fica sabendo que o arquivo era de outra codificação.
 */
export function decodeStatement(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}
