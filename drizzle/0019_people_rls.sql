-- Custom SQL migration file, put your code below! --

-- Row-Level Security para `people` e `people_contacts` (issue #41, épico #19).
-- Mesmo padrão das migrations anteriores: ENABLE + FORCE + policy de isolamento por
-- `user_id` comparado a `current_setting('app.user_id')`. `FORCE` garante que até o dono
-- da tabela respeite a policy; `current_setting(..., true)` devolve NULL quando o contexto
-- não foi definido → `(NULL = user_id)` é falso → nega tudo (fail-safe).
--
-- `people_contacts` tem `user_id` próprio (e não só `person_id`) pelo mesmo motivo de
-- `priority_tags` e `event_exceptions`: a policy precisa decidir sozinha, sem join com a
-- tabela pai para descobrir de quem é a linha.

ALTER TABLE "people" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "people" FORCE ROW LEVEL SECURITY;
CREATE POLICY "people_isolation" ON "people"
  FOR ALL
  USING ("user_id" = current_setting('app.user_id', true))
  WITH CHECK ("user_id" = current_setting('app.user_id', true));

ALTER TABLE "people_contacts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "people_contacts" FORCE ROW LEVEL SECURITY;
CREATE POLICY "people_contacts_isolation" ON "people_contacts"
  FOR ALL
  USING ("user_id" = current_setting('app.user_id', true))
  WITH CHECK ("user_id" = current_setting('app.user_id', true));

-- GRANTs explícitos para o role restrito da app (idempotente; protege bancos onde o
-- `app_rls` foi criado DEPOIS das tabelas — ver docs/ERROS.md 2026-06-20).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_rls') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "people" TO app_rls;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "people_contacts" TO app_rls;
  ELSE
    RAISE NOTICE 'Role app_rls inexistente; GRANTs pulados. Crie o role via SQL (ver docs/SETUP.md).';
  END IF;
END $$;
