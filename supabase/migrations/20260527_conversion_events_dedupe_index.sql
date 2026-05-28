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
-- This non-partial unique index closes both: the route now upserts with
-- ON CONFLICT (kol_slug, session_id, event_type) DO NOTHING.
--
-- A previous draft used a partial index (WHERE session_id IS NOT NULL), but
-- PostgREST/Supabase `upsert(..., { onConflict: "..." })` only emits the
-- column list — it cannot express a partial-index predicate, so Postgres
-- can't match a partial index as the conflict target and the upsert fails at
-- runtime with "no unique or exclusion constraint matching the ON CONFLICT
-- specification".
--
-- A non-partial index gives the same dedupe behavior because Postgres treats
-- NULLs as distinct in unique indexes by default (NULLS DISTINCT) — multiple
-- rows where session_id IS NULL are still allowed, so anonymous (no-session)
-- events stay un-deduped exactly as before.

-- Step 1: dedupe pre-existing rows.
--
-- The whole reason this migration exists is that production was inserting
-- duplicates. So before we can build a UNIQUE index, we have to collapse the
-- duplicates that are already in the table — otherwise CREATE UNIQUE INDEX
-- aborts with "could not create unique index ... Key (...)=(...) is duplicated"
-- and the route is left with no conflict target, so every upsert with a
-- session_id 500s.
--
-- Keep the earliest row per (kol_slug, session_id, event_type), drop the rest.
-- Restrict to session_id IS NOT NULL because:
--   - the unique index treats NULL session_ids as distinct (NULLS DISTINCT),
--     so multiple anonymous rows are not duplicates from the index's POV;
--   - more importantly, anonymous events were never meant to dedupe — every
--     no-session conversion is a real (separate) event we want to keep.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY kol_slug, session_id, event_type
           ORDER BY created_at ASC, id ASC
         ) AS rn
    FROM conversion_events
   WHERE session_id IS NOT NULL
)
DELETE FROM conversion_events
 WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Step 2: now that the table is clean, build the conflict-target index.
CREATE UNIQUE INDEX IF NOT EXISTS conversion_events_dedup_idx
  ON conversion_events (kol_slug, session_id, event_type);
