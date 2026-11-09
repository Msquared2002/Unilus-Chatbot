-- Additive read receipts. Existing ticket events remain the notification inbox.
CREATE TABLE public.ticket_notification_reads (
 owner TEXT NOT NULL,
 event_id INTEGER NOT NULL REFERENCES public.ticket_events(id),
 PRIMARY KEY(owner,event_id)
);
ALTER TABLE public.ticket_notification_reads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ticket_notification_reads FROM PUBLIC,anon,authenticated,unilus_backend;
GRANT SELECT,INSERT ON public.ticket_notification_reads TO unilus_backend;
CREATE POLICY notification_reads_select ON public.ticket_notification_reads
 FOR SELECT TO unilus_backend USING(true);
CREATE POLICY notification_reads_insert ON public.ticket_notification_reads
 FOR INSERT TO unilus_backend WITH CHECK(true);
