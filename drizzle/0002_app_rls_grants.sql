-- Custom SQL migration file, put your code below! --

-- Privilégios do role restrito da APP (`app_rls`) — issue #3.
--
-- Por quê (ver docs/ERROS.md 2026-06-20): no Neon, `neondb_owner` e qualquer role
-- criado pelo Console têm `BYPASSRLS` e furam a RLS. A app conecta por `app_rls`,
-- criado VIA SQL (sem BYPASSRLS), que só deve ter DML — nunca DDL/admin.
--
-- Esta migration roda como o DONO (MIGRATION_DATABASE_URL). É idempotente e não
-- falha em bancos onde o role ainda não existe (ex.: Postgres local): nesse caso
-- apenas emite um NOTICE. O `ALTER DEFAULT PRIVILEGES` garante que tabelas/sequences
-- FUTURAS (life_areas, goals, ...) criadas pelo dono já nasçam acessíveis ao app_rls.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_rls') THEN
    GRANT USAGE ON SCHEMA public TO app_rls;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_rls;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_rls;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_rls;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT USAGE, SELECT ON SEQUENCES TO app_rls;
  ELSE
    RAISE NOTICE 'Role app_rls inexistente; GRANTs pulados. Crie o role via SQL (ver docs/SETUP.md).';
  END IF;
END $$;
