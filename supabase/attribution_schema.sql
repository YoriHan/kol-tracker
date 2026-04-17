-- ============================================================
-- Attribution Tracking — Schema Migration
-- Run this in Supabase SQL Editor after the initial schema
-- ============================================================

-- Add tracking fields to influencers
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS kol_slug text unique;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS tracking_url text;

-- ============================================================
-- CLICK EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS click_events (
  id            uuid primary key default uuid_generate_v4(),
  kol_slug      text not null,
  influencer_id uuid references influencers(id) on delete cascade,
  ip_hash       text,
  user_agent    text,
  referrer      text,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- CONVERSION EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS conversion_events (
  id            uuid primary key default uuid_generate_v4(),
  kol_slug      text not null,
  influencer_id uuid references influencers(id) on delete cascade,
  event_type    text not null default 'register',
  session_id    text,
  created_at    timestamptz not null default now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_click_events_kol_slug       ON click_events(kol_slug);
CREATE INDEX IF NOT EXISTS idx_click_events_influencer      ON click_events(influencer_id);
CREATE INDEX IF NOT EXISTS idx_conversion_events_kol_slug   ON conversion_events(kol_slug);
CREATE INDEX IF NOT EXISTS idx_conversion_events_influencer ON conversion_events(influencer_id);
CREATE INDEX IF NOT EXISTS idx_influencers_kol_slug         ON influencers(kol_slug);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE click_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversion_events ENABLE ROW LEVEL SECURITY;

-- Tracking inserts are public (called by tracking link + embed script)
CREATE POLICY "click_events_insert_public"      ON click_events      FOR INSERT WITH CHECK (true);
CREATE POLICY "conversion_events_insert_public" ON conversion_events FOR INSERT WITH CHECK (true);

-- Only authenticated team members can read tracking data
CREATE POLICY "click_events_select_auth"      ON click_events      FOR SELECT TO authenticated USING (true);
CREATE POLICY "conversion_events_select_auth" ON conversion_events FOR SELECT TO authenticated USING (true);

-- Allow anon to look up influencer by kol_slug (for tracking redirect)
CREATE POLICY "influencers_tracking_public" ON influencers
  FOR SELECT
  TO anon
  USING (kol_slug IS NOT NULL);
