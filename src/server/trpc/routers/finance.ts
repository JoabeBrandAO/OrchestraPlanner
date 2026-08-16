import { z } from "zod";

import {
  createAccount,
  createCategory,
  createTransaction,
  deleteAccount,
  deleteTransaction,
  listAccounts,
  listCategories,
  listTransactions,
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
});
