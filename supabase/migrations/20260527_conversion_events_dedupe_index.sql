-- Race-free dedupe for /api/convert.
--
-- Without a unique index, the previous select-then-insert flow had two problems:
--   1. The dedupe SELECT ran under the anon key, which RLS blocks on
--      conversion_events — every request saw zero existing rows and inserted a
--      duplicate.
--   2. Even with the service role, two near-simultaneous requests with the
--      same (kol_slug, session_id, event_type) would both pass the SELECT and
--      both INSERT.
--
-- This partial unique index closes both: the route now upserts with
-- ON CONFLICT DO NOTHING. NULL session_ids are excluded from the index so
-- anonymous (no-session) events still record (NULLs are not equal in postgres
-- and would otherwise never collide anyway).
CREATE UNIQUE INDEX IF NOT EXISTS conversion_events_dedup_idx
  ON conversion_events (kol_slug, session_id, event_type)
  WHERE session_id IS NOT NULL;
