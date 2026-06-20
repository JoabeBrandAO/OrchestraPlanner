-- Custom SQL migration file, put your code below! --

-- Row-Level Security para `life_areas` e `goals` (issues #8–#12).
-- Mesmo padrão da migration 0001 (users): ENABLE + FORCE + policy de isolamento
-- por `user_id` comparado a `current_setting('app.user_id')`. `FORCE` garante que
-- até o dono da tabela respeite a policy; `current_setting(..., true)` retorna NULL
-- se o contexto não foi definido → `(NULL = user_id)` é falso → nega tudo (fail-safe).

ALTER TABLE "life_areas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "life_areas" FORCE ROW LEVEL SECURITY;
CREATE POLICY "life_areas_isolation" ON "life_areas"
  FOR ALL
  USING ("user_id" = current_setting('app.user_id', true))
  WITH CHECK ("user_id" = current_setting('app.user_id', true));

ALTER TABLE "goals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "goals" FORCE ROW LEVEL SECURITY;
CREATE POLICY "goals_isolation" ON "goals"
  FOR ALL
  USING ("user_id" = current_setting('app.user_id', true))
  WITH CHECK ("user_id" = current_setting('app.user_id', true));