import { z } from "zod";

import {
  createAccount,
  createCategory,
  createTransaction,
  deleteAccount,
  deleteCategory,
  deleteTransaction,
  getBudgetOverview,
  getFinanceReport,
  importStatement,
  listAccounts,
  listCategories,
  listTransactions,
  removeBudget,
  renameCategory,
  setBudget,
  updateTransaction,
} from "@/server/services/finance/finance-service";
import { TITLE_MAX_LENGTH } from "@/server/services/shared/validate-title";

import { protectedProcedure, router } from "../trpc";

const uuid = z.string().uuid();
const name = z.string().trim().min(1, "O nome é obrigatório.").max(TITLE_MAX_LENGTH);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");
const direction = z.enum(["entrada", "saida"]);
const ACCOUNT_KINDS = ["corrente", "poupanca", "carteira", "cartao", "investimento"] as const;

/**
 * Valor em **centavos inteiros** (ver `finance/money.ts`). Positivo sempre: o sinal do
 * lançamento vem do `direction`, não do número.
 */
const amountCents = z.number().int().positive();

/** Mês do calendário, `AAAA-MM` (ver `finance/budget.ts`). */
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mês inválido (use AAAA-MM).");

/** Financeiro (#52). Router fino: valida a entrada e delega ao serviço. */
export const financeRouter = router({
  accounts: protectedProcedure.query(({ ctx }) => listAccounts(ctx.userId)),

  createAccount: protectedProcedure
    .input(
      z.object({
        name,
        kind: z.enum(ACCOUNT_KINDS).optional(),
        // Saldo inicial pode ser negativo (cartão) ou zero — não é um lançamento.
        initialBalanceCents: z.number().int().optional(),
      }),
    )
    .mutation(({ ctx, input }) => createAccount(ctx.userId, input)),

  deleteAccount: protectedProcedure
    .input(z.object({ id: uuid }))
    .mutation(({ ctx, input }) => deleteAccount(ctx.userId, input.id)),

  categories: protectedProcedure.query(({ ctx }) => listCategories(ctx.userId)),

  createCategory: protectedProcedure
    .input(z.object({ name, direction }))
    .mutation(({ ctx, input }) => createCategory(ctx.userId, input)),

  /** Renomear e remover categoria (#63). O sentido não se edita — ver o serviço. */
  renameCategory: protectedProcedure
    .input(z.object({ id: uuid, name }))
    .mutation(({ ctx, input }) => renameCategory(ctx.userId, input.id, { name: input.name })),

  deleteCategory: protectedProcedure
    .input(z.object({ id: uuid }))
    .mutation(({ ctx, input }) => deleteCategory(ctx.userId, input.id)),

  transactions: protectedProcedure
    .input(z.object({ from: isoDate, to: isoDate }))
    .query(({ ctx, input }) => listTransactions(ctx.userId, input)),

  createTransaction: protectedProcedure
    .input(
      z.object({
        accountId: uuid,
        happenedAt: isoDate,
        direction,
        amountCents,
        categoryId: uuid.nullish(),
        lifeAreaId: uuid.nullish(),
        description: z.string().max(300).nullish(),
      }),
    )
    .mutation(({ ctx, input }) => createTransaction(ctx.userId, input)),

  /** Editar lançamento (#62) — mesma entrada da criação; a origem (`external_id`) não muda. */
  updateTransaction: protectedProcedure
    .input(
      z.object({
        id: uuid,
        accountId: uuid,
        happenedAt: isoDate,
        direction,
        amountCents,
        categoryId: uuid.nullish(),
        lifeAreaId: uuid.nullish(),
        description: z.string().max(300).nullish(),
      }),
    )
    .mutation(({ ctx, input: { id, ...patch } }) => updateTransaction(ctx.userId, id, patch)),

  deleteTransaction: protectedProcedure
    .input(z.object({ id: uuid }))
    .mutation(({ ctx, input }) => deleteTransaction(ctx.userId, input.id)),

  /** Orçamento (#53): planejado × realizado do mês. */
  budget: protectedProcedure
    .input(z.object({ month }))
    .query(({ ctx, input }) => getBudgetOverview(ctx.userId, input.month)),

  setBudget: protectedProcedure
    .input(z.object({ categoryId: uuid, month, plannedCents: amountCents }))
    .mutation(({ ctx, input }) => setBudget(ctx.userId, input)),

  removeBudget: protectedProcedure
    .input(z.object({ categoryId: uuid, month }))
    .mutation(({ ctx, input }) => removeBudget(ctx.userId, input)),

  /**
   * Relatório do mês (#54). O mês vem da tela — o servidor não decide qual é "hoje", senão
   * a evolução muda debaixo de quem está navegando pelos meses.
   */
  report: protectedProcedure
    .input(z.object({ month, months: z.number().int().min(1).max(24).optional() }))
    .query(({ ctx, input }) => getFinanceReport(ctx.userId, input)),

  /**
   * Importação de extrato (#55). O arquivo chega como texto já decodificado pelo navegador
   * (ver `decodeStatement`): o servidor não recebe bytes, e o teto de tamanho existe para
   * um arquivo enorme não virar uma requisição que ninguém consegue cancelar.
   */
  importStatement: protectedProcedure
    .input(
      z.object({
        accountId: uuid,
        content: z.string().min(1, "Arquivo vazio.").max(4_000_000, "Arquivo grande demais."),
      }),
    )
    .mutation(({ ctx, input }) => importStatement(ctx.userId, input)),
});
