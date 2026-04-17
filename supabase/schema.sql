-- ============================================================
-- KOL Tracker — Supabase Schema
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================

create type influencer_stage as enum (
  '待接触',
  '已发DM',
  '谈判中',
  '已签约',
  '合作中-Draft1',
  '合作中-Draft2',
  '待发布',
  '已发送',
  '已发Invoice',
  '已付款',
  '完成'
);

create type deal_type as enum (
  '推文',
  '视频',
  'Story',
  '直播',
  '其他'
);

create type contact_method as enum (
  'DM',
  '邮件',
  '电话',
  '其他'
);

create type payment_status as enum (
  '未开票',
  '已开票',
  '已付款'
);

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================

create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ============================================================
-- INFLUENCERS
-- ============================================================

create table influencers (
  id                  uuid primary key default uuid_generate_v4(),

  -- Basic info
  twitter_handle      text not null unique,
  twitter_id          text unique,   -- stable Twitter numeric user ID (filled when API connected)
  display_name        text,
  avatar_url          text,
  followers_count     integer,
  category            text,
  bio                 text,
  notes               text,

  -- Stage & assignment
  current_stage       influencer_stage not null default '待接触',
  assigned_to         uuid references profiles(id) on delete set null,
  stage_entered_at    timestamptz not null default now(),   -- for staleness tracking
  last_contact_date   timestamptz,
  next_followup_date  date,

  -- Deal info
  deal_type           deal_type,
  quote_per_post      numeric(12, 2),
  contract_value      numeric(12, 2),
  contract_url        text,

  -- Content
  draft1_url          text,
  draft1_done         boolean not null default false,
  draft2_url          text,
  draft2_done         boolean not null default false,
  publish_date        date,
  post_url            text,

  -- Performance (manual)
  impressions         integer,
  engagement_rate     numeric(5, 2),  -- percentage, e.g. 3.45
  clicks              integer,

  -- Finance
  invoice_number      text,
  invoice_amount      numeric(12, 2),
  payment_status      payment_status not null default '未开票',
  payment_due_date    date,
  payment_date        date,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ============================================================
-- COMMUNICATION LOGS
-- ============================================================

create table communication_logs (
  id              uuid primary key default uuid_generate_v4(),
  influencer_id   uuid not null references influencers(id) on delete cascade,
  user_id         uuid references profiles(id) on delete set null,

  contacted_at    timestamptz not null default now(),
  method          contact_method not null default 'DM',
  summary         text not null,
  source          text not null default 'manual',  -- 'manual' | 'twitter_api'

  -- placeholder for future Twitter DM integration
  twitter_dm_id   text unique,

  created_at      timestamptz not null default now()
);

-- ============================================================
-- ACTIVITY LOGS (audit trail)
-- ============================================================

create table activity_logs (
  id              uuid primary key default uuid_generate_v4(),
  influencer_id   uuid not null references influencers(id) on delete cascade,
  user_id         uuid references profiles(id) on delete set null,

  action          text not null,       -- e.g. 'stage_changed', 'field_updated', 'created'
  field_name      text,                -- which field changed
  old_value       text,
  new_value       text,
  description     text,                -- human-readable summary

  created_at      timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index idx_influencers_stage        on influencers(current_stage);
create index idx_influencers_assigned_to  on influencers(assigned_to);
create index idx_influencers_followup     on influencers(next_followup_date);
create index idx_influencers_handle       on influencers(twitter_handle);
create index idx_comm_logs_influencer     on communication_logs(influencer_id);
create index idx_activity_logs_influencer on activity_logs(influencer_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger influencers_updated_at
  before update on influencers
  for each row execute function update_updated_at();

create trigger profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();

-- ============================================================
-- STAGE ENTERED AT TRIGGER
-- (reset timer when stage changes)
-- ============================================================

create or replace function reset_stage_timer()
returns trigger language plpgsql as $$
begin
  if new.current_stage <> old.current_stage then
    new.stage_entered_at = now();
  end if;
  return new;
end;
$$;

create trigger influencers_stage_timer
  before update on influencers
  for each row execute function reset_stage_timer();

-- ============================================================
-- RLS (Row Level Security)
-- All authenticated users have equal access (no admin role)
-- ============================================================

alter table profiles          enable row level security;
alter table influencers       enable row level security;
alter table communication_logs enable row level security;
alter table activity_logs     enable row level security;

-- Profiles: users can read all, update only their own
create policy "profiles_select" on profiles for select to authenticated using (true);
create policy "profiles_update" on profiles for update to authenticated using (auth.uid() = id);
create policy "profiles_insert" on profiles for insert to authenticated with check (auth.uid() = id);

-- Influencers: all authenticated users have full access
create policy "influencers_all" on influencers for all to authenticated using (true) with check (true);

-- Communication logs: all authenticated users have full access
create policy "comm_logs_all" on communication_logs for all to authenticated using (true) with check (true);

-- Activity logs: all authenticated users can read/insert (no update/delete)
create policy "activity_logs_select" on activity_logs for select to authenticated using (true);
create policy "activity_logs_insert" on activity_logs for insert to authenticated with check (true);

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================

create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
