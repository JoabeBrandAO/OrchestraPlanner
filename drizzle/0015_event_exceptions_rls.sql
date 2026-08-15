-- Custom SQL migration file, put your code below! --

-- Row-Level Security para `event_exceptions` (issue #35).
-- Mesmo padrão das migrations 0001, 0004, 0006, 0008, 0010 e 0013: ENABLE + FORCE + policy
-- de isolamento por `user_id` comparado a `current_setting('app.user_id')`. `FORCE` garante
-- que até o dono da tabela respeite a policy; `current_setting(..., true)` retorna NULL se
-- o contexto não foi definido → `(NULL = user_id)` é falso → nega tudo (fail-safe).
--
-- A exceção tem `user_id` próprio (e não só o `event_id`) pelo mesmo motivo de
-- `priority_tags`: a policy precisa decidir sozinha, sem depender de um join com a tabela
-- pai para saber de quem é a linha.

ALTER TABLE "event_exceptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "event_exceptions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "event_exceptions_isolation" ON "event_exceptions"
  FOR ALL
  USING ("user_id" = current_setting('app.user_id', true))
  WITH CHECK ("user_id" = current_setting('app.user_id', true));

-- GRANTs explícitos para o role restrito da app (idempotente; protege bancos onde o
-- `app_rls` foi criado DEPOIS das tabelas — ver docs/ERROS.md 2026-06-20).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_rls') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "event_exceptions" TO app_rls;
  ELSE
    RAISE NOTICE 'Role app_rls inexistente; GRANTs pulados. Crie o role via SQL (ver docs/SETUP.md).';
  END IF;
END $$;
