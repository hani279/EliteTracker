-- ============================================================
-- ELITE TRACKER — push notification subscriptions
-- Run once in the Supabase SQL editor, same as 0001/0002.
--
-- Stores each device's Web Push subscription so a coach's "Send
-- nudge" can actually deliver a notification even when the agent
-- doesn't have the app open. Sending itself happens server-side (the
-- supabase/functions/send-nudge Edge Function, holding the VAPID
-- private key) — this table is just where the client registers.
-- ============================================================

create table push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  endpoint    text not null,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now(),
  unique (profile_id, endpoint)
);

alter table push_subscriptions enable row level security;

create policy "own push subscriptions: full access"
  on push_subscriptions for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- No coach-read policy here on purpose — a coach never needs to read
-- an agent's subscription directly. send-nudge runs with the
-- service_role key (server-side only), which bypasses RLS entirely,
-- so it can look up and send to an agent's subscriptions regardless.
