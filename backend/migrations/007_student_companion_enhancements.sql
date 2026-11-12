-- Local-only reviewed academic publication metadata and existing-inbox read receipts.
CREATE TABLE public.academic_publications(id TEXT PRIMARY KEY,record_key TEXT NOT NULL,revision INTEGER NOT NULL,kind TEXT NOT NULL,status TEXT NOT NULL,title TEXT NOT NULL,summary TEXT NOT NULL,source_url TEXT NOT NULL,source_document TEXT REFERENCES public.managed_documents(id),verified_at TEXT NOT NULL,valid_until TEXT NOT NULL,effective_at TEXT NOT NULL,published_at TEXT,period TEXT NOT NULL,audience TEXT NOT NULL,targets_json TEXT NOT NULL,payload_json TEXT NOT NULL,supersedes TEXT REFERENCES public.academic_publications(id),publisher TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(record_key,revision));
CREATE INDEX academic_publication_visible ON academic_publications(kind,status,valid_until,effective_at);
CREATE TABLE public.academic_notice_reads(id TEXT PRIMARY KEY,publication_id TEXT NOT NULL REFERENCES public.academic_publications(id),owner TEXT NOT NULL,read_at TEXT NOT NULL,UNIQUE(publication_id,owner));
ALTER TABLE public.academic_publications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.academic_publications FROM PUBLIC,anon,authenticated,unilus_backend;
GRANT SELECT,INSERT,UPDATE ON public.academic_publications TO unilus_backend;
CREATE POLICY academic_select ON public.academic_publications FOR SELECT TO unilus_backend USING(true);
CREATE POLICY academic_insert ON public.academic_publications FOR INSERT TO unilus_backend WITH CHECK(true);
CREATE POLICY academic_update ON public.academic_publications FOR UPDATE TO unilus_backend USING(true) WITH CHECK(true);
ALTER TABLE public.academic_notice_reads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.academic_notice_reads FROM PUBLIC,anon,authenticated,unilus_backend;
GRANT SELECT,INSERT ON public.academic_notice_reads TO unilus_backend;
CREATE POLICY academic_select ON public.academic_notice_reads FOR SELECT TO unilus_backend USING(true);
CREATE POLICY academic_insert ON public.academic_notice_reads FOR INSERT TO unilus_backend WITH CHECK(true);
