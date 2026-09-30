-- Custom SQL migration file, put your code below! --

-- Row-Level Security para `rate_limits` (#75). Mesmo padrão das demais tabelas:
-- ENABLE + FORCE + policy por `user_id`. NULL sem contexto → nega tudo (fail-safe).

ALTER TABLE "rate_limits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rate_limits" FORCE ROW LEVEL SECURITY;
CREATE POLICY "rate_limits_isolation" ON "rate_limits"
  FOR ALL
  USING ("user_id" = current_setting('app.user_id', true))
  WITH CHECK ("user_id" = current_setting('app.user_id', true));

-- Contagem negativa ou janela zerada não existem: o upsert começa em 1.
ALTER TABLE "rate_limits"
  ADD CONSTRAINT "rate_limits_count_positive" CHECK ("count" > 0);

-- GRANTs explícitos para o role restrito da app (idempotente; ver docs/ERROS.md 2026-06-20).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_rls') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "rate_limits" TO app_rls;
  ELSE
    RAISE NOTICE 'Role app_rls inexistente; GRANTs pulados. Crie o role via SQL (ver docs/SETUP.md).';
  END IF;
END $$;
