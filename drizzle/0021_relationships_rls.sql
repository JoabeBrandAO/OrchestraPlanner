-- Custom SQL migration file, put your code below! --

-- Row-Level Security para `person_links`, `circles` e `circle_members` (issue #42).
-- Mesmo padrão das migrations anteriores: ENABLE + FORCE + policy de isolamento por
-- `user_id` comparado a `current_setting('app.user_id')`. `FORCE` garante que até o dono
-- da tabela respeite a policy; `current_setting(..., true)` devolve NULL quando o contexto
-- não foi definido → `(NULL = user_id)` é falso → nega tudo (fail-safe).

ALTER TABLE "person_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "person_links" FORCE ROW LEVEL SECURITY;
CREATE POLICY "person_links_isolation" ON "person_links"
  FOR ALL
  USING ("user_id" = current_setting('app.user_id', true))
  WITH CHECK ("user_id" = current_setting('app.user_id', true));

ALTER TABLE "circles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "circles" FORCE ROW LEVEL SECURITY;
CREATE POLICY "circles_isolation" ON "circles"
  FOR ALL
  USING ("user_id" = current_setting('app.user_id', true))
  WITH CHECK ("user_id" = current_setting('app.user_id', true));

ALTER TABLE "circle_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "circle_members" FORCE ROW LEVEL SECURITY;
CREATE POLICY "circle_members_isolation" ON "circle_members"
  FOR ALL
  USING ("user_id" = current_setting('app.user_id', true))
  WITH CHECK ("user_id" = current_setting('app.user_id', true));

-- Uma pessoa não se vincula a si mesma. A regra também está no serviço, com mensagem em
-- português; aqui ela vira garantia — nenhum caminho futuro (script, importação) escapa.
ALTER TABLE "person_links"
  ADD CONSTRAINT "person_links_no_self" CHECK ("person_id" <> "related_person_id");

-- O par é gravado em ordem canônica (ver `people/relations.ts`), e é isso que faz o índice
-- único `person_links_pair_key` impedir o espelho A→B / B→A. Sem esta checagem, uma
-- escrita que pulasse a normalização criaria a segunda linha que a modelagem existe para
-- evitar.
ALTER TABLE "person_links"
  ADD CONSTRAINT "person_links_canonical_order" CHECK ("person_id" <= "related_person_id");

-- GRANTs explícitos para o role restrito da app (idempotente; protege bancos onde o
-- `app_rls` foi criado DEPOIS das tabelas — ver docs/ERROS.md 2026-06-20).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_rls') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "person_links" TO app_rls;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "circles" TO app_rls;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "circle_members" TO app_rls;
  ELSE
    RAISE NOTICE 'Role app_rls inexistente; GRANTs pulados. Crie o role via SQL (ver docs/SETUP.md).';
  END IF;
END $$;
