-- Prepared only. Apply through the guarded runner after separate release approval.
CREATE TABLE public.timetable_publications(id TEXT PRIMARY KEY, revision INTEGER NOT NULL UNIQUE, period TEXT NOT NULL, fingerprint TEXT NOT NULL, snapshot_json TEXT NOT NULL, previous_id TEXT REFERENCES public.timetable_publications(id), published_at TEXT NOT NULL, source TEXT NOT NULL);
CREATE TABLE public.timetable_changes(id TEXT PRIMARY KEY, publication_id TEXT NOT NULL REFERENCES public.timetable_publications(id), scope TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX idx_timetable_change_scope ON public.timetable_changes(scope,created_at);
CREATE TABLE public.timetable_subscriptions(owner TEXT PRIMARY KEY, period TEXT NOT NULL, scope TEXT NOT NULL);
CREATE TABLE public.timetable_notification_reads(owner TEXT NOT NULL,change_id TEXT NOT NULL REFERENCES public.timetable_changes(id),PRIMARY KEY(owner,change_id));
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['timetable_publications','timetable_changes','timetable_subscriptions','timetable_notification_reads'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,unilus_backend',t);
  EXECUTE format('GRANT SELECT,INSERT ON public.%I TO unilus_backend',t);
  EXECUTE format('CREATE POLICY timetable_select ON public.%I FOR SELECT TO unilus_backend USING(true)',t);
  EXECUTE format('CREATE POLICY timetable_insert ON public.%I FOR INSERT TO unilus_backend WITH CHECK(true)',t);
 END LOOP;
END $$;
GRANT UPDATE,DELETE ON public.timetable_subscriptions TO unilus_backend;
CREATE POLICY subscription_update ON public.timetable_subscriptions FOR UPDATE TO unilus_backend USING(true) WITH CHECK(true);
CREATE POLICY subscription_delete ON public.timetable_subscriptions FOR DELETE TO unilus_backend USING(true);

CREATE TABLE public.timetable_demo_overrides(id TEXT PRIMARY KEY,publication_id TEXT NOT NULL REFERENCES public.timetable_publications(id),session_key TEXT NOT NULL,target_owner TEXT NOT NULL,profile_id TEXT NOT NULL,record_json TEXT NOT NULL,venue TEXT NOT NULL,starts_at TEXT NOT NULL,expires_at TEXT NOT NULL);
CREATE INDEX idx_timetable_override_expiry ON public.timetable_demo_overrides(publication_id,expires_at);
ALTER TABLE public.timetable_demo_overrides ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.timetable_demo_overrides FROM PUBLIC,anon,authenticated,unilus_backend;
GRANT SELECT,INSERT ON public.timetable_demo_overrides TO unilus_backend;
CREATE POLICY timetable_select ON public.timetable_demo_overrides FOR SELECT TO unilus_backend USING(true);
CREATE POLICY timetable_insert ON public.timetable_demo_overrides FOR INSERT TO unilus_backend WITH CHECK(true);
