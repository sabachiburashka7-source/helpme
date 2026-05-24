-- Adds subscription / tier columns to the users table so the app can
-- enforce a monthly post quota (1/month free, 15/month pro).
--
-- Run this once in the Supabase SQL editor (Project -> SQL -> New query).
-- Safe to re-run.

alter table public.users
  add column if not exists tier text not null default 'free',
  add column if not exists subscription_expires_at timestamptz;

-- Helpful for the monthly-quota count: filters offers by phone and a
-- created_at range very quickly.
create index if not exists offers_phone_created_at_idx
  on public.offers (phone, created_at desc);

-- Promote a single user to Pro for testing (uncomment and edit phone):
-- update public.users
--   set tier = 'pro',
--       subscription_expires_at = now() + interval '30 days'
--   where phone = '+995555000000';
