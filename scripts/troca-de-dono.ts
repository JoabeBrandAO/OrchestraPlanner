/**
 * Troca de dono dos dados (docs/CLERK-PRODUCAO.md, etapa 7): leva tudo do ID de usuário
 * antigo do Clerk para o novo, numa transação só. A lógica e as garantias estão em
 * `src/server/services/users/transfer-owner.ts`; aqui só a linha de comando.
 *
 * **Por padrão só simula** (faz, confere e desfaz). Para gravar, `--aplicar`.
 *
 *   npx tsx scripts/troca-de-dono.ts --de user_ANTIGO --para user_NOVO            # simula
 *   npx tsx scripts/troca-de-dono.ts --de user_ANTIGO --para user_NOVO --aplicar  # grava
 *
 * Usa a `MIGRATION_DATABASE_URL` do `.env` (role dono, com BYPASSRLS). Antes de aplicar em
 * produção: baixe seus dados em Conta → "Baixar meus dados (JSON)".
 */
import "dotenv/config";

import postgres from "postgres";

import {
  TransferError,
  describeTarget,
  formatReport,
  parseTransferArgs,
  transferOwnership,
} from "../src/server/services/users/transfer-owner";

const USAGE = `Troca de dono dos dados (ID antigo do Clerk → ID novo)

  npx tsx scripts/troca-de-dono.ts --de user_ANTIGO --para user_NOVO [opções]

Opções:
  --aplicar                         grava (sem ela, só simula e desfaz no fim)
  --descartar-dados-da-conta-nova   apaga o que a conta nova já tiver além do cadastro
  --ajuda                           mostra esta ajuda`;

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv.includes("--ajuda")) {
    console.log(USAGE);
    return;
  }

  const args = parseTransferArgs(argv);
  const url = process.env.MIGRATION_DATABASE_URL;
  if (!url) throw new TransferError("MIGRATION_DATABASE_URL não definida no .env.");

  console.log(`Banco: ${describeTarget(url)}`);
  console.log(args.apply ? "Modo: APLICAR (grava)\n" : "Modo: simulação (nada é gravado)\n");

  const sql = postgres(url, { prepare: false, max: 1 });
  try {
    console.log(formatReport(await transferOwnership(sql, args)));
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof TransferError ? `Erro: ${error.message}` : error);
  process.exitCode = 1;
});
