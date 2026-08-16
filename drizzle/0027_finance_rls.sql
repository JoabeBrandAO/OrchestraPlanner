-- Custom SQL migration file, put your code below! --

-- Row-Level Security para `accounts`, `transaction_categories` e `transactions`
-- (issue #52, épico #20). Mesmo padrão das migrations anteriores: ENABLE + FORCE + policy
-- de isolamento por `user_id` comparado a `current_setting('app.user_id')`. `FORCE` garante
-- que até o dono da tabela respeite a policy; `current_setting(..., true)` devolve NULL
-- quando o contexto não foi definido → `(NULL = user_id)` é falso → nega tudo (fail-safe).
--
-- Vale dobrado aqui: dado financeiro é o mais sensível do produto (Visão §Privacidade).

ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounts" FORCE ROW LEVEL SECURITY;
CREATE POLICY "accounts_isolation" ON "accounts"
  FOR ALL
  USING ("user_id" = current_setting('app.user_id', true))
  WITH CHECK ("user_id" = current_setting('app.user_id', true));

ALTER TABLE "transaction_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "transaction_categories" FORCE ROW LEVEL SECURITY;
CREATE POLICY "transaction_categories_isolation" ON "transaction_categories"
  FOR ALL
  USING ("user_id" = current_setting('app.user_id', true))
  WITH CHECK ("user_id" = current_setting('app.user_id', true));

ALTER TABLE "transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "transactions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "transactions_isolation" ON "transactions"
  FOR ALL
  USING ("user_id" = current_setting('app.user_id', true))
  WITH CHECK ("user_id" = current_setting('app.user_id', true));

-- O valor é sempre positivo: o sinal de um lançamento vem do `direction`, não do número.
-- A regra também está no serviço, com mensagem em português; aqui ela vira garantia — uma
-- importação de extrato (#55) ou um script não têm como driblar.
ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_amount_positive" CHECK ("amount_cents" > 0);

-- GRANTs explícitos para o role restrito da app (idempotente; protege bancos onde o
-- `app_rls` foi criado DEPOIS das tabelas — ver docs/ERROS.md 2026-06-20).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_rls') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "accounts" TO app_rls;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "transaction_categories" TO app_rls;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "transactions" TO app_rls;
  ELSE
    RAISE NOTICE 'Role app_rls inexistente; GRANTs pulados. Crie o role via SQL (ver docs/SETUP.md).';
  END IF;
END $$;
