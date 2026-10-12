import type postgres from "postgres";

import { DEFAULT_LIFE_AREAS } from "@/server/services/life-areas/default-areas";

/**
 * Troca de dono dos dados: leva tudo do ID de usuário antigo para o novo.
 *
 * **Para que existe.** O banco guarda tudo pelo ID do Clerk (`user_…`). Ao trocar a produção
 * da instância de desenvolvimento do Clerk para a de produção (`docs/CLERK-PRODUCAO.md`,
 * etapa 7), o mesmo e-mail ganha um ID novo, e os dados ficariam presos ao antigo.
 *
 * **Garantias**, todas dentro de **uma transação** — qualquer surpresa desfaz tudo:
 * - só roda com a conexão do dono (`MIGRATION_DATABASE_URL`, com BYPASSRLS). Sob a RLS, o
 *   UPDATE não enxergaria linha nenhuma e o apagar do usuário antigo levaria tudo junto;
 * - as tabelas vêm do **catálogo** (toda tabela com `user_id`), a mesma régua do "Baixar meus
 *   dados": um módulo novo entra sozinho;
 * - cada UPDATE tem de mover exatamente o que foi contado antes, e no fim o ID antigo tem de
 *   estar zerado e o novo com as mesmas contagens. Senão, desfaz;
 * - a conta nova só é sobrescrita sem perguntar se estiver "recém-criada" (só as Áreas de
 *   Vida padrão e contadores de limite). Com qualquer outro dado, recusa, a não ser que
 *   venha `discardNewData`;
 * - **por padrão é simulação**: faz tudo, confere tudo e desfaz no fim.
 */

export class TransferError extends Error {
  override name = "TransferError";
}

export type TransferArgs = {
  from: string;
  to: string;
  apply: boolean;
  discardNewData?: boolean;
};

export type TransferReport = {
  from: string;
  to: string;
  applied: boolean;
  /** A linha nova em `users`: criada do zero, ou a da conta nova trocada pela antiga. */
  newUserRow: "criada" | "substituida";
  /** Tabela → linhas que passaram do ID antigo para o novo (todas as tabelas, até as zeradas). */
  moved: Record<string, number>;
  /** Tabela → linhas da conta nova descartadas antes da troca (só as que tinham alguma). */
  discardedFromNew: Record<string, number>;
};

/** ID do Clerk: `user_` + letras e números. Barra e-mail colado no lugar do ID, por exemplo. */
const CLERK_ID = /^user_[A-Za-z0-9]+$/;

/** Tabelas que uma conta recém-criada já tem e que podem ser descartadas sem perguntar. */
const DISPOSABLE_ON_FRESH_ACCOUNT = new Set(["life_areas", "rate_limits"]);
const DEFAULT_AREA_NAMES = new Set(DEFAULT_LIFE_AREAS.map((area) => area.name.toLowerCase()));

const USAGE_HINT = "Uso: --de user_ANTIGO --para user_NOVO [--aplicar]";

export function parseTransferArgs(argv: string[]): TransferArgs {
  const values: Record<string, string> = {};
  const flags = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const [name, inline] = arg.split("=", 2) as [string, string | undefined];
    if (name === "--de" || name === "--para") {
      values[name] = (inline ?? argv[++i] ?? "").trim();
    } else if (name === "--aplicar" || name === "--descartar-dados-da-conta-nova") {
      flags.add(name);
    } else {
      throw new TransferError(`Opção desconhecida: ${arg}. ${USAGE_HINT}`);
    }
  }

  for (const name of ["--de", "--para"]) {
    const value = values[name];
    if (!value) throw new TransferError(`Falta ${name}. ${USAGE_HINT}`);
    if (!CLERK_ID.test(value)) {
      throw new TransferError(
        `${name} "${value}" não parece um ID do Clerk (começa com user_). Copie do painel do Clerk.`,
      );
    }
  }
  if (values["--de"] === values["--para"]) {
    throw new TransferError("Os IDs --de e --para são iguais: não há o que trocar.");
  }

  return {
    from: values["--de"]!,
    to: values["--para"]!,
    apply: flags.has("--aplicar"),
    discardNewData: flags.has("--descartar-dados-da-conta-nova"),
  };
}

/** "host/banco (role x)" — para o dono ver onde vai rodar. Nunca a senha. */
export function describeTarget(connectionString: string): string {
  const url = new URL(connectionString);
  return `${url.host}${url.pathname} (role ${decodeURIComponent(url.username)})`;
}

/** Sinal interno para desfazer a transação no fim da simulação. */
class DryRun extends Error {
  constructor(readonly report: TransferReport) {
    super("simulação");
  }
}

type Sql = postgres.Sql | postgres.TransactionSql;
type UserRow = Record<string, unknown> & { id: string; email: string; name: string | null };

async function countByTable(
  tx: Sql,
  tables: string[],
  userId: string,
): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  for (const table of tables) {
    const [row] = await tx<{ n: number }[]>`
      select count(*)::int as n from ${tx(table)} where user_id = ${userId}
    `;
    result[table] = row!.n;
  }
  return result;
}

/** A conta nova só tem o que o cadastro cria sozinho? (Áreas padrão e contadores.) */
async function isFreshAccount(
  tx: Sql,
  userId: string,
  counts: Record<string, number>,
): Promise<boolean> {
  const withData = Object.keys(counts).filter((table) => counts[table]! > 0);
  if (withData.some((table) => !DISPOSABLE_ON_FRESH_ACCOUNT.has(table))) return false;
  if (!counts.life_areas) return true;
  const areas = await tx<{ name: string }[]>`
    select name from life_areas where user_id = ${userId}
  `;
  return areas.every((area) => DEFAULT_AREA_NAMES.has(area.name.toLowerCase()));
}

function listNonZero(counts: Record<string, number>): string {
  return Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([table, n]) => `${table}: ${n}`)
    .join(", ");
}

export async function transferOwnership(
  sql: postgres.Sql,
  args: TransferArgs,
): Promise<TransferReport> {
  const { from, to, apply, discardNewData = false } = args;
  if (from === to) throw new TransferError("Os IDs de origem e destino são iguais.");

  try {
    return await sql.begin(async (tx) => {
      // Não espera para sempre por um lock do app; melhor falhar e rodar de novo.
      await tx`set local lock_timeout = '10s'`;

      const [role] = await tx<{ bypass: boolean }[]>`
        select rolsuper or rolbypassrls as bypass from pg_roles where rolname = current_user
      `;
      if (!role?.bypass) {
        throw new TransferError(
          "Esta conexão está sujeita à RLS e não veria os dados de dois usuários. " +
            "Rode com a MIGRATION_DATABASE_URL (role dono, com BYPASSRLS), nunca com a do app.",
        );
      }

      const rows = await tx<UserRow[]>`
        select * from users where id in (${from}, ${to}) for update
      `;
      const oldRow = rows.find((row) => row.id === from);
      const newRow = rows.find((row) => row.id === to);
      if (!oldRow) throw new TransferError(`O usuário antigo ${from} não existe neste banco.`);

      const catalog = await tx<{ table_name: string }[]>`
        select c.table_name
        from information_schema.columns c
        join information_schema.tables t
          on t.table_schema = c.table_schema and t.table_name = c.table_name
        where c.table_schema = 'public' and c.column_name = 'user_id' and t.table_type = 'BASE TABLE'
        order by c.table_name
      `;
      const tables = catalog.map((row) => row.table_name);

      const fromBefore = await countByTable(tx, tables, from);
      const toBefore = await countByTable(tx, tables, to);
      const toHasData = Object.values(toBefore).some((n) => n > 0);

      if (toHasData && !discardNewData && !(await isFreshAccount(tx, to, toBefore))) {
        throw new TransferError(
          `A conta nova já tem dados (${listNonZero(toBefore)}). Nada foi mudado. ` +
            "Se eles podem ser apagados, rode de novo com --descartar-dados-da-conta-nova.",
        );
      }

      // 1. Some com a conta nova inteira (o `on delete cascade` leva o que ela tinha).
      if (newRow) await tx`delete from users where id = ${to}`;

      // 2. O e-mail é único: a linha antiga cede o dela antes de a nova nascer com ele.
      await tx`update users set email = ${`${from}@troca-de-dono.invalid`} where id = ${from}`;

      // 3. A linha nova: tudo da antiga (fuso, data de cadastro, o que vier a existir), com
      //    e-mail e nome da conta nova quando ela já existia — é o que o Clerk diz hoje.
      const inserted: Record<string, unknown> = {
        ...oldRow,
        id: to,
        email: newRow?.email || oldRow.email,
        name: newRow?.name ?? oldRow.name,
        updated_at: new Date(),
      };
      await tx`insert into users ${tx(inserted)}`;

      // 4. Cada tabela, conferindo que moveu exatamente o que foi contado.
      const moved: Record<string, number> = {};
      for (const table of tables) {
        const result = await tx`
          update ${tx(table)} set user_id = ${to} where user_id = ${from}
        `;
        if (result.count !== fromBefore[table]) {
          throw new TransferError(
            `${table}: esperava mover ${fromBefore[table]} linha(s) e moveu ${result.count}. Nada foi mudado.`,
          );
        }
        moved[table] = result.count;
      }

      // 5. A linha antiga, já sem nada pendurado.
      const deleted = await tx`delete from users where id = ${from}`;
      if (deleted.count !== 1) throw new TransferError("Não consegui apagar a linha antiga.");

      // 6. Conferência final: o antigo zerado, o novo igual ao antigo de antes.
      const fromAfter = await countByTable(tx, tables, from);
      const toAfter = await countByTable(tx, tables, to);
      for (const table of tables) {
        if (fromAfter[table] !== 0 || toAfter[table] !== fromBefore[table]) {
          throw new TransferError(
            `${table}: a conferência final não bateu (antigo ${fromAfter[table]}, novo ${toAfter[table]}, ` +
              `esperado ${fromBefore[table]}). Nada foi mudado.`,
          );
        }
      }

      const report: TransferReport = {
        from,
        to,
        applied: apply,
        newUserRow: newRow ? "substituida" : "criada",
        moved,
        discardedFromNew: Object.fromEntries(Object.entries(toBefore).filter(([, n]) => n > 0)),
      };
      if (!apply) throw new DryRun(report);
      return report;
    });
  } catch (error) {
    if (error instanceof DryRun) return error.report;
    throw error;
  }
}

/** Relatório para o terminal: o que mudou (ou mudaria), tabela por tabela. */
export function formatReport(report: TransferReport): string {
  const verb = report.applied ? "Movidas" : "Seriam movidas";
  const lines = [
    report.applied
      ? "APLICADO."
      : "SIMULAÇÃO — nada foi gravado. Para gravar, rode de novo com --aplicar.",
    `De ${report.from} para ${report.to}.`,
    `Linha em users: ${report.newUserRow === "criada" ? "criada a partir da antiga" : "a da conta nova foi trocada pela antiga"}.`,
    "",
    `${verb}, por tabela:`,
  ];
  const width = Math.max(...Object.keys(report.moved).map((table) => table.length));
  for (const [table, n] of Object.entries(report.moved)) {
    if (n > 0) lines.push(`  ${table.padEnd(width)}  ${n}`);
  }
  const total = Object.values(report.moved).reduce((sum, n) => sum + n, 0);
  lines.push(`  ${"total".padEnd(width)}  ${total}`);

  const discarded = listNonZero(report.discardedFromNew);
  if (discarded) {
    lines.push("", `Descartado da conta nova: ${discarded}.`);
  }
  return lines.join("\n");
}
