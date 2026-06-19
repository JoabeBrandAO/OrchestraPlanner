-- Custom SQL migration file, put your code below! --

-- Row-Level Security para `users` (issue #3).
-- Isolamento multi-tenant por `user_id`: cada conexão define `app.user_id`
-- (via set_config) e só enxerga/escreve a própria linha.
--
-- FORCE é essencial: sem ele, o dono da tabela (role usada pela app) ignora a
-- policy. Com FORCE, até o dono respeita a RLS — a barreira vale para todos.

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;

-- Política de isolamento: linha visível/gravável apenas quando seu id casa com
-- o usuário corrente. `current_setting(..., true)` retorna NULL se não definido,
-- e (NULL = id) é falso → nega tudo por padrão (fail-safe).
CREATE POLICY "users_isolation" ON "users"
  FOR ALL
  USING ("id" = current_setting('app.user_id', true))
  WITH CHECK ("id" = current_setting('app.user_id', true));
