-- Custom SQL migration file, put your code below! --

-- Row-Level Security para `life_assessments` (issue #17).
-- Mesmo padrão das migrations 0001, 0004, 0006 e 0008: ENABLE + FORCE + policy de
-- isolamento por `user_id` comparado a `current_setting('app.user_id')`. `FORCE` garante
-- que até o dono da tabela respeite a policy; `current_setting(..., true)` retorna NULL se
-- o contexto não foi definido → `(NULL = user_id)` é falso → nega tudo (fail-safe).

ALTER TABLE "life_assessments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "life_assessments" FORCE ROW LEVEL SECURITY;
CREATE POLICY "life_assessments_isolation" ON "life_assessments"
  FOR ALL
  USING ("user_id" = current_setting('app.user_id', true))
  WITH CHECK ("user_id" = current_setting('app.user_id', true));

-- GRANTs explícitos para o role restrito da app (idempotente; protege bancos onde o
-- `app_rls` foi criado DEPOIS das tabelas — ver docs/ERROS.md 2026-06-20).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_rls') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "life_assessments" TO app_rls;
  ELSE
    RAISE NOTICE 'Role app_rls inexistente; GRANTs pulados. Crie o role via SQL (ver docs/SETUP.md).';
  END IF;
END $$;
