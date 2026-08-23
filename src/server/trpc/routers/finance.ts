import { z } from "zod";

import {
  createAccount,
  createCategory,
  createTransaction,
  deleteAccount,
  deleteTransaction,
  getBudgetOverview,
  getFinanceReport,
  listAccounts,
  listCategories,
  listTransactions,
  removeBudget,
  setBudget,
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
});
