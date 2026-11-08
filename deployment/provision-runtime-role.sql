-- REVIEW / EXPLICIT APPROVAL REQUIRED. Not executed remotely.
-- NOLOGIN avoids passwords in SQL/source. Operator sets a fresh password and enables
-- LOGIN through secure interactive administration ONLY after separate approval.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='unilus_backend') THEN
  CREATE ROLE unilus_backend NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
 ELSIF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='unilus_backend' AND (rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolinherit)) THEN
  RAISE EXCEPTION 'Existing runtime role requires review';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname='unilus_backend') THEN RAISE EXCEPTION 'Unexpected role membership'; END IF;
END $$;
ALTER ROLE unilus_backend SET search_path TO public,pg_catalog;
ALTER ROLE unilus_backend SET statement_timeout TO '30s';
ALTER ROLE unilus_backend SET lock_timeout TO '5s';
COMMIT;
