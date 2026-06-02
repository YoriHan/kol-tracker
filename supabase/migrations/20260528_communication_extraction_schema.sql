-- ============================================================
-- Migration: extraction layer for "paste-then-extract" auto-tracking
-- ============================================================
-- Yori's ask (2026-05-28): most KOL panel data is still manual entry;
-- can we automate it?
--
-- MVP shape (locked with Trace, not a Twitter DM scraper):
--   1. User pastes a DM/email/screenshot into communication_logs.summary
--      as they do today.
--   2. A background extractor (separate PR) runs an LLM over the
--      summary, fills `extracted` jsonb with structured fields, and
--      sets `extraction_status = 'ready'`.
--   3. UI shows a diff card; user approves → server applies the
--      mapped fields onto the influencer row and flips status to
--      'applied'. Discard → 'discarded'.
--
-- This migration is ADDITIVE ONLY. Every existing row gets defaults
-- and stays valid; no enum widening on `current_stage` (the LLM
-- output maps onto the existing 11-value Chinese enum — we are not
-- introducing a parallel `stage` field, per Trace's correction).
--
-- Run AFTER PR #4 migration (20260527_conversion_events_dedupe_index)
-- — these are independent, but Yori's batch-run will likely include
-- both at once.
-- ============================================================

-- ----- INFLUENCERS: lightweight follow-up + risk surface --------

-- Free-text companion to `next_followup_date`. The date alone tells
-- you WHEN; this column tells you WHY ("waiting on contract redline",
-- "hold until Q3 budget"). Kept short — long context belongs in a
-- communication_logs entry, not here.
alter table influencers
  add column if not exists next_followup_note text;

-- Flexible per-influencer flag map populated by extraction:
--   { "price_sensitive": true,
--     "deadline_risk": "high",
--     "wants_renegotiate": true }
-- Schema-less on purpose so we can iterate flag shapes without
-- another migration; UI reads known keys, ignores unknown ones.
alter table influencers
  add column if not exists risk_flags jsonb not null default '{}'::jsonb;


-- ----- COMMUNICATION_LOGS: extraction results ------------------

-- Postgres has no `create type if not exists`; wrap in a DO block so
-- the migration is re-runnable without erroring on the second pass.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'extraction_status') then
    create type extraction_status as enum (
      'pending',    -- log created, extractor has not run yet
      'ready',      -- extracted fields available, awaiting user review
      'applied',    -- user approved, influencer row updated
      'discarded'   -- user dismissed; do not surface again
    );
  end if;
end$$;

-- Structured LLM output. Shape (informal contract — UI tolerates
-- missing keys, never trusts unknown values blindly):
--   {
--     "current_stage": "谈判中",                  -- maps onto influencer_stage enum
--     "quote_per_post": 1500,
--     "next_followup_date": "2026-06-05",
--     "next_followup_note": "等对方法务回复",
--     "risk_flags": { "price_sensitive": true },
--     "summary_short": "对方接受合作，价格再砍 10% 后能签"
--   }
-- Only keys the user approves get applied to the influencer row;
-- the apply step is a server route, not a client write.
alter table communication_logs
  add column if not exists extracted jsonb;

alter table communication_logs
  add column if not exists extraction_status extraction_status
    not null default 'pending';

-- Provenance — which model produced `extracted`. Useful for
-- debugging quality regressions and for the activity log when we
-- record "applied extraction from <model>".
alter table communication_logs
  add column if not exists extraction_model text;


-- ----- INDEXES -------------------------------------------------

-- The extractor worker polls "logs that need work":
--   select id from communication_logs where extraction_status = 'pending'
-- Partial index keeps it tiny — once a log moves past 'pending' it
-- drops out of the index.
create index if not exists idx_comm_logs_extraction_pending
  on communication_logs (created_at)
  where extraction_status = 'pending';

-- The review UI lists "logs awaiting your approval":
--   select ... from communication_logs
--    where extraction_status = 'ready' and influencer_id = $1
create index if not exists idx_comm_logs_extraction_ready
  on communication_logs (influencer_id, created_at desc)
  where extraction_status = 'ready';
