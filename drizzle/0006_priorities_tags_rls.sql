-- Custom SQL migration file, put your code below! --

-- Row-Level Security para `priorities`, `tags` e `priority_tags` (issues #13–#14).
-- Mesmo padrão das migrations 0001 e 0004: ENABLE + FORCE + policy de isolamento por
-- `user_id` comparado a `current_setting('app.user_id')`. `FORCE` garante que até o dono
-- da tabela respeite a policy; `current_setting(..., true)` retorna NULL se o contexto não
-- foi definido → `(NULL = user_id)` é falso → nega tudo (fail-safe).

ALTER TABLE "priorities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "priorities" FORCE ROW LEVEL SECURITY;
CREATE POLICY "priorities_isolation" ON "priorities"
  FOR ALL
  USING ("user_id" = current_setting('app.user_id', true))
  WITH CHECK ("user_id" = current_setting('app.user_id', true));

ALTER TABLE "tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tags" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tags_isolation" ON "tags"
  FOR ALL
  USING ("user_id" = current_setting('app.user_id', true))
  WITH CHECK ("user_id" = current_setting('app.user_id', true));

-- A tabela de junção carrega `user_id` justamente para poder ser isolada por linha:
-- sob RLS as FKs não bastam (a checagem de FK ignora a policy da tabela referenciada).
ALTER TABLE "priority_tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "priority_tags" FORCE ROW LEVEL SECURITY;
CREATE POLICY "priority_tags_isolation" ON "priority_tags"
  FOR ALL
  USING ("user_id" = current_setting('app.user_id', true))
  WITH CHECK ("user_id" = current_setting('app.user_id', true));

-- GRANTs explícitos para o role restrito da app. O `ALTER DEFAULT PRIVILEGES` da
-- migration 0002 já cobriria estas tabelas, mas repetir aqui é idempotente e protege
-- bancos onde o `app_rls` foi criado DEPOIS das tabelas (ver docs/ERROS.md 2026-06-20).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_rls') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "priorities", "tags", "priority_tags" TO app_rls;
  ELSE
    RAISE NOTICE 'Role app_rls inexistente; GRANTs pulados. Crie o role via SQL (ver docs/SETUP.md).';
  END IF;
END $$;
