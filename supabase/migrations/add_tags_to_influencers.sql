-- Add tags column to influencers table
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/xkenmudvuldplcreljdc/sql

ALTER TABLE influencers
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
