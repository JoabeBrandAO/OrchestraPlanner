-- Custom SQL migration file, put your code below! --

-- Row-Level Security para `push_subscriptions` e `reminder_sends` (issue #36).
-- Mesmo padrão das migrations anteriores: ENABLE + FORCE + policy de isolamento por
-- `user_id` comparado a `current_setting('app.user_id')`. `FORCE` garante que até o dono
-- da tabela respeite a policy; `current_setting(..., true)` devolve NULL quando o contexto
-- não foi definido → `(NULL = user_id)` é falso → nega tudo (fail-safe).
--
-- Vale especialmente aqui: o disparo dos lembretes roda **fora** do app (GitHub Actions).
-- Ele usa o role elevado numa única query — descobrir quem tem inscrição — e faz todo o
-- resto pela conexão restrita, sob estas policies. É a RLS, e não a disciplina do laço,
-- que impede um lembrete de um usuário sair para o aparelho de outro.

ALTER TABLE "push_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "push_subscriptions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "push_subscriptions_isolation" ON "push_subscriptions"
  FOR ALL
  USING ("user_id" = current_setting('app.user_id', true))
  WITH CHECK ("user_id" = current_setting('app.user_id', true));

ALTER TABLE "reminder_sends" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reminder_sends" FORCE ROW LEVEL SECURITY;
CREATE POLICY "reminder_sends_isolation" ON "reminder_sends"
  FOR ALL
  USING ("user_id" = current_setting('app.user_id', true))
  WITH CHECK ("user_id" = current_setting('app.user_id', true));

-- GRANTs explícitos para o role restrito da app (idempotente; protege bancos onde o
-- `app_rls` foi criado DEPOIS das tabelas — ver docs/ERROS.md 2026-06-20).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_rls') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "push_subscriptions" TO app_rls;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "reminder_sends" TO app_rls;
  ELSE
    RAISE NOTICE 'Role app_rls inexistente; GRANTs pulados. Crie o role via SQL (ver docs/SETUP.md).';
  END IF;
END $$;
