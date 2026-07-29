-- ============================================================
-- ELITE TRACKER — initial schema
-- Mirrors the shape of js/store.js's localStorage state, split
-- into real tables with row-level security. Run this once in the
-- Supabase SQL editor (or via `supabase db push`) on a fresh project.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- profiles: one row per authenticated user, agent or coach.
-- id matches auth.users.id (Supabase creates that row on signup;
-- we create the matching profile row right after, client-side).
-- ------------------------------------------------------------
create table profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  role             text not null check (role in ('agent','coach')),
  name             text not null default '',
  vertical         text check (vertical in ('realestate','sales')),
  brand            text not null default '',        -- coach only: business name
  coach_code       text unique,                      -- coach only: shareable code
  coach_id         uuid references profiles(id),     -- agent only: which coach they belong to
  onboarded        boolean not null default false,
  targets          jsonb not null default '{}'::jsonb,       -- metricKey -> daily target
  focus_template   jsonb not null default '[]'::jsonb,       -- recurring daily focus tasks
  build_framework  jsonb not null default '{}'::jsonb,       -- {goal, proof, steps}
  settings         jsonb not null default '{
    "remindersEnabled": false,
    "reminderTime": "08:00",
    "eodTime": "17:00",
    "assumeMinimums": true,
    "theme": "dark"
  }'::jsonb,
  created_at       timestamptz not null default now()
);

-- ------------------------------------------------------------
-- day_records: one row per agent per calendar day.
-- ------------------------------------------------------------
create table day_records (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references profiles(id) on delete cascade,
  day           date not null,
  focus         jsonb not null default '[]'::jsonb,
  numbers       jsonb not null default '{}'::jsonb,
  outcomes      jsonb not null default '{}'::jsonb,
  summary       jsonb not null default '{"did":"","learned":"","struggled":""}'::jsonb,
  reviewed_eod  boolean not null default false,
  logged        boolean not null default false,
  updated_at    timestamptz not null default now(),
  unique (profile_id, day)
);

-- ------------------------------------------------------------
-- voice_notes: metadata only — the audio blob itself lives in
-- Supabase Storage (bucket "voice-notes"), storage_path points to it.
-- ------------------------------------------------------------
create table voice_notes (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null references profiles(id) on delete cascade,
  day_record_id  uuid not null references day_records(id) on delete cascade,
  storage_path   text not null,
  duration_sec   int,
  transcript     text,
  ai_summary     text,
  created_at     timestamptz not null default now()
);

-- ------------------------------------------------------------
-- pipeline_items: vendors (real estate) / deals (sales)
-- ------------------------------------------------------------
create table pipeline_items (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null references profiles(id) on delete cascade,
  name           text not null,
  detail         text not null default '',
  stage          text not null,
  value          numeric not null default 0,
  selling_month  text not null default '',
  stalled        boolean not null default false,
  updated_at     timestamptz not null default now()
);

-- ------------------------------------------------------------
-- crm_contacts
-- ------------------------------------------------------------
create table crm_contacts (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references profiles(id) on delete cascade,
  name         text not null,
  contact      text not null default '',
  type         text not null default 'Warm' check (type in ('Hot','Warm','Cold')),
  next_action  text not null default '',
  next_date    date,
  notes        text not null default '',
  updated_at   timestamptz not null default now()
);

-- ------------------------------------------------------------
-- goals: life & business goals grid
-- ------------------------------------------------------------
create table goals (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  category    text not null,
  title       text not null,
  detail      text not null default ''
);

-- ------------------------------------------------------------
-- special_ops: time-boxed focus campaigns
-- ------------------------------------------------------------
create table special_ops (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references profiles(id) on delete cascade,
  title        text not null,
  description  text not null default '',
  active       boolean not null default true,
  items        jsonb not null default '[]'::jsonb   -- [{id, name, done}]
);

-- ------------------------------------------------------------
-- reports_log
-- ------------------------------------------------------------
create table reports_log (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references profiles(id) on delete cascade,
  type         text not null,
  range_label  text,
  score        int,
  created_at   timestamptz not null default now()
);

-- ============================================================
-- Row-level security
-- Rule of thumb: an agent has full access to their own rows.
-- A coach has read-only access to rows belonging to agents whose
-- profiles.coach_id points at them. Nobody else sees anything.
-- ============================================================

alter table profiles       enable row level security;
alter table day_records    enable row level security;
alter table voice_notes    enable row level security;
alter table pipeline_items enable row level security;
alter table crm_contacts   enable row level security;
alter table goals          enable row level security;
alter table special_ops    enable row level security;
alter table reports_log    enable row level security;

-- profiles: you can read/update your own row; a coach can read
-- (not write) the profiles of agents linked to them.
create policy "own profile: full access"
  on profiles for all
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "coach reads linked agent profiles"
  on profiles for select
  using (coach_id = auth.uid());

-- Reusable pattern for every agent-owned table below:
-- owner has full access; the owner's coach has read-only access.
create policy "own day_records: full access" on day_records for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "coach reads linked agent day_records" on day_records for select
  using (exists (select 1 from profiles where id = day_records.profile_id and coach_id = auth.uid()));

create policy "own voice_notes: full access" on voice_notes for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "coach reads linked agent voice_notes" on voice_notes for select
  using (exists (select 1 from profiles where id = voice_notes.profile_id and coach_id = auth.uid()));

create policy "own pipeline_items: full access" on pipeline_items for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "coach reads linked agent pipeline_items" on pipeline_items for select
  using (exists (select 1 from profiles where id = pipeline_items.profile_id and coach_id = auth.uid()));

create policy "own crm_contacts: full access" on crm_contacts for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "coach reads linked agent crm_contacts" on crm_contacts for select
  using (exists (select 1 from profiles where id = crm_contacts.profile_id and coach_id = auth.uid()));

create policy "own goals: full access" on goals for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "coach reads linked agent goals" on goals for select
  using (exists (select 1 from profiles where id = goals.profile_id and coach_id = auth.uid()));

create policy "own special_ops: full access" on special_ops for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "coach reads linked agent special_ops" on special_ops for select
  using (exists (select 1 from profiles where id = special_ops.profile_id and coach_id = auth.uid()));

create policy "own reports_log: full access" on reports_log for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "coach reads linked agent reports_log" on reports_log for select
  using (exists (select 1 from profiles where id = reports_log.profile_id and coach_id = auth.uid()));

-- ------------------------------------------------------------
-- Coach-code lookup needs to work for a brand-new agent who is
-- NOT yet linked (coach_id is still null) so they can find the
-- coach to link to during onboarding. Expose just enough via a
-- security-definer function rather than a broad SELECT policy —
-- this avoids letting anyone browse every coach's full profile.
-- ------------------------------------------------------------
create function public.find_coach_by_code(code text)
returns table (id uuid, name text, brand text)
language sql security definer set search_path = public
as $$
  select id, name, brand from profiles
  where role = 'coach' and coach_code = code;
$$;
