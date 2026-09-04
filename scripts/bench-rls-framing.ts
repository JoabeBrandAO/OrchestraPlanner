import "dotenv/config";
import { sql } from "drizzle-orm";
import postgres from "postgres";

import { getDb } from "@/server/db";

/**
 * Mede a **moldura da RLS** contra o banco real (#58).
 *
 * Toda leitura roda hoje como `BEGIN` → `set_config` → `SELECT` → `COMMIT`, e contra o Neon
 * cada um desses é uma viagem pela rede. O que este script responde é: quanto custa a
 * moldura, e quanto sobra dela em cada alternativa.
 *
 * As variantes rodam **alternadas** em várias rodadas, para a fila da rede não favorecer
 * uma delas. Uso: `npx tsx scripts/bench-rls-framing.ts [execuções] [rodadas]`.
 */

const db = getDb();
const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const uid = "bench_user";

async function medir(rotulo: string, fn: () => Promise<unknown>, execucoes: number) {
  await fn(); // aquece conexão e plano
  const marcas: number[] = [];
  for (let i = 0; i < execucoes; i += 1) {
    const inicio = performance.now();
    await fn();
    marcas.push(performance.now() - inicio);
  }
  marcas.sort((a, b) => a - b);
  const mediana = marcas[Math.floor(marcas.length / 2)]!;
  console.log(
    `  ${rotulo.padEnd(30)} mediana ${mediana.toFixed(1)}ms   min ${marcas[0]!.toFixed(1)}   max ${marcas.at(-1)!.toFixed(1)}`,
  );
  return mediana;
}

/** O piso: uma viagem só, sem transação e sem RLS. */
const piso = () => client`select 1`;

/** Como está hoje: cada statement espera a resposta do anterior. */
const atual = () =>
  db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${uid}, true)`);
    return tx.execute(sql`select 1`);
  });

/** Transação crua do driver, sem Drizzle — separa o custo da moldura do custo do ORM. */
const transacaoCrua = () =>
  client.begin(async (tx) => {
    await tx`select set_config('app.user_id', ${uid}, true)`;
    return tx`select 1`;
  });

/**
 * Pipelining documentado do postgres.js: devolvendo um **array** de consultas, elas vão
 * juntas para o socket e as respostas voltam na ordem. `BEGIN` e `COMMIT` continuam sendo
 * viagens próprias.
 */
const pipelineArray = () =>
  client.begin((tx) => [tx`select set_config('app.user_id', ${uid}, true)`, tx`select 1`]);

/**
 * Conexão reservada (exclusiva da requisição) + GUC de **sessão**, com `reset` antes de
 * devolver a conexão ao pool. Sem transação: some o `BEGIN` e o `COMMIT`.
 */
const reservada = async () => {
  const conexao = await client.reserve();
  try {
    await conexao`select set_config('app.user_id', ${uid}, false)`;
    return await conexao`select 1`;
  } finally {
    await conexao`select set_config('app.user_id', '', false)`;
    conexao.release();
  }
};

/** A mesma conexão reservada, com as três indo juntas pelo socket. */
const reservadaPipeline = async () => {
  const conexao = await client.reserve();
  try {
    const [, resultado] = await Promise.all([
      conexao`select set_config('app.user_id', ${uid}, false)`,
      conexao`select 1`,
      conexao`select set_config('app.user_id', '', false)`,
    ]);
    return resultado;
  } finally {
    conexao.release();
  }
};

async function main() {
  const execucoes = Number(process.argv[2] ?? 12);
  const rodadas = Number(process.argv[3] ?? 3);
  console.log(`\n${execucoes} execuções por variante, ${rodadas} rodadas alternadas\n`);

  const variantes: [string, () => Promise<unknown>][] = [
    ["piso (1 viagem)", piso],
    ["atual (drizzle + txn)", atual],
    ["txn crua (sem drizzle)", transacaoCrua],
    ["txn + pipeline em array", pipelineArray],
    ["reservada + guc de sessão", reservada],
    ["reservada + pipeline", reservadaPipeline],
  ];

  const medianas = new Map(variantes.map(([nome]) => [nome, [] as number[]]));
  for (let rodada = 1; rodada <= rodadas; rodada += 1) {
    console.log(`rodada ${rodada}`);
    for (const [nome, fn] of variantes) {
      medianas.get(nome)!.push(await medir(nome, fn, execucoes));
    }
  }

  console.log("\nmedianas por rodada:");
  for (const [nome, valores] of medianas) {
    console.log(`  ${nome.padEnd(30)} ${valores.map((v) => v.toFixed(1)).join(" · ")}`);
  }
  process.exit(0);
}

void main();
