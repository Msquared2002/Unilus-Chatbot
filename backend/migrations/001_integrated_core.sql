-- RUNNER ONLY: all DDL, grants, RLS and ledger writes commit in ONE transaction.
DO $$ BEGIN
 IF current_setting('unilus.migration_context',true) IS DISTINCT FROM 'approved-v2' THEN RAISE EXCEPTION 'Use approved transactional runner'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='unilus_backend' AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolinherit) THEN RAISE EXCEPTION 'Restricted runtime role required'; END IF;
 IF current_user='unilus_backend' OR EXISTS (SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname='unilus_backend') THEN RAISE EXCEPTION 'Separate runtime without memberships required'; END IF;
END $$;
CREATE TABLE IF NOT EXISTS conversations (
            id SERIAL PRIMARY KEY,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'))
        );

CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations (session_id, id);

CREATE TABLE IF NOT EXISTS tickets (
            id SERIAL PRIMARY KEY,
            ticket_ref TEXT UNIQUE,
            session_id TEXT NOT NULL,
            question TEXT NOT NULL,
            summary TEXT NOT NULL,
            history_json TEXT NOT NULL,
            category TEXT NOT NULL,
            priority TEXT NOT NULL,
            department TEXT NOT NULL,
            contact_id TEXT,
            status TEXT NOT NULL DEFAULT 'Open',
            created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')),
            updated_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'))
        );

CREATE INDEX IF NOT EXISTS idx_tickets_session ON tickets (session_id, id);

CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets (status);

CREATE TABLE IF NOT EXISTS feedback (
            id SERIAL PRIMARY KEY,
            session_id TEXT,
            rating TEXT NOT NULL,
            comment TEXT,
            created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'))
        );

CREATE TABLE IF NOT EXISTS staff_answers (
            id SERIAL PRIMARY KEY,
            question TEXT NOT NULL,
            answer TEXT NOT NULL,
            visibility TEXT NOT NULL DEFAULT 'student',
            active INTEGER NOT NULL DEFAULT 1,
            times_used INTEGER NOT NULL DEFAULT 0,
            source_ticket TEXT,
            created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')),
            updated_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'))
        );

CREATE TABLE IF NOT EXISTS chat_sessions (id TEXT PRIMARY KEY,owner TEXT NOT NULL,created_at TEXT NOT NULL,expires_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS ticket_events(id SERIAL PRIMARY KEY,ticket_ref TEXT NOT NULL,kind TEXT NOT NULL,body TEXT NOT NULL,actor TEXT NOT NULL,visibility TEXT NOT NULL,created_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS ticket_assignments(ticket_ref TEXT PRIMARY KEY,department TEXT NOT NULL,assignee TEXT);

CREATE TABLE IF NOT EXISTS knowledge_records(id TEXT PRIMARY KEY,payload TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS managed_documents(id TEXT PRIMARY KEY,source_name TEXT NOT NULL,object_key TEXT NOT NULL,access TEXT NOT NULL,title TEXT,active INTEGER NOT NULL,created_at TEXT NOT NULL) ;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ticket_active_question ON tickets(session_id, lower(question)) WHERE status IN ('Open','In Progress');
CREATE INDEX IF NOT EXISTS idx_ticket_events_ref ON ticket_events(ticket_ref,id);
CREATE INDEX IF NOT EXISTS idx_documents_source ON managed_documents(source_name,active);

CREATE UNIQUE INDEX IF NOT EXISTS idx_managed_active_source ON managed_documents(source_name) WHERE active = 1;

CREATE TABLE IF NOT EXISTS schema_migrations(version TEXT PRIMARY KEY,checksum TEXT NOT NULL,applied_at TEXT NOT NULL);
-- Review schema-wide CREATE restriction and migration OWNER's future defaults with existing developer.
-- No provider internal schemas or supabase_admin defaults are changed.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC,anon,authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA public TO unilus_backend;
DO $$ DECLARE t text; seq text; BEGIN
 FOREACH t IN ARRAY ARRAY['conversations','feedback','staff_answers','tickets','chat_sessions','ticket_events','ticket_assignments','knowledge_records','managed_documents','schema_migrations'] LOOP
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=t AND pg_get_userbyid(c.relowner)='unilus_backend') THEN RAISE EXCEPTION 'Runtime must not own tables'; END IF;
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC,anon,authenticated,unilus_backend',t);
  IF t <> 'schema_migrations' THEN
   EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.%I TO unilus_backend',t);
   IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname='unilus_backend_access') THEN
    EXECUTE format('CREATE POLICY unilus_backend_access ON public.%I FOR ALL TO unilus_backend USING (true) WITH CHECK (true)',t);
   ELSE
    EXECUTE format('ALTER POLICY unilus_backend_access ON public.%I TO unilus_backend USING (true) WITH CHECK (true)',t);
   END IF;
  END IF;
  FOR seq IN SELECT pg_get_serial_sequence(format('public.%I',t),a.attname) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=t AND a.attnum>0 AND NOT a.attisdropped LOOP
   IF seq IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC,anon,authenticated,unilus_backend',seq);
    IF t <> 'schema_migrations' THEN EXECUTE format('GRANT USAGE ON SEQUENCE %s TO unilus_backend',seq); END IF;
   END IF;
  END LOOP;
 END LOOP;
END $$;
-- No runtime or browser ledger policy/grant. Backend-service policy delegates user/department checks to Express.
