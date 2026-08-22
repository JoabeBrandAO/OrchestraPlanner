-- Custom SQL migration file, put your code below! --

-- Row-Level Security de `budgets` (issue #53, épico #20). Mesmo padrão das anteriores:
-- ENABLE + FORCE + policy por `user_id` contra `current_setting('app.user_id')`, que devolve
-- NULL sem contexto → nega tudo (fail-safe). Orçamento diz quanto a pessoa ganha e no que
-- gasta: é dado tão sensível quanto o extrato.

ALTER TABLE "budgets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "budgets" FORCE ROW LEVEL SECURITY;
CREATE POLICY "budgets_isolation" ON "budgets"
  FOR ALL
  USING ("user_id" = current_setting('app.user_id', true))
  WITH CHECK ("user_id" = current_setting('app.user_id', true));

-- Orçar zero é o mesmo que não orçar, e as duas formas se desencontrariam na comparação
-- ("sem orçamento" ≠ "orçamento zero"). Negativo não existe: o sentido vem da categoria.
ALTER TABLE "budgets"
  ADD CONSTRAINT "budgets_planned_positive" CHECK ("planned_cents" > 0);

-- O mês é do calendário e mora como texto `AAAA-MM`. Sem o CHECK, um "2026-8" ou um
-- "2026-08-01" entrariam e virariam um mês fantasma que nenhuma tela encontra.
ALTER TABLE "budgets"
  ADD CONSTRAINT "budgets_month_format" CHECK ("month" ~ '^\d{4}-(0[1-9]|1[0-2])$');

-- GRANTs explícitos para o role restrito da app (idempotente; protege bancos onde o
-- `app_rls` foi criado DEPOIS das tabelas — ver docs/ERROS.md 2026-06-20).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_rls') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "budgets" TO app_rls;
  ELSE
    RAISE NOTICE 'Role app_rls inexistente; GRANTs pulados. Crie o role via SQL (ver docs/SETUP.md).';
  END IF;
END $$;
