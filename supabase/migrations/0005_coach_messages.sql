-- Coach engagement: a coach reviews an auto-generated draft (built from
-- the same pace/status data already driving their roster) and sends it
-- to a specific agent as an in-app message — the "personalized summary
-- and suggestions" workflow, deliberately review-before-send rather
-- than fully automatic.
create table coach_messages (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references profiles(id) on delete cascade,
  agent_id    uuid not null references profiles(id) on delete cascade,
  title       text not null default 'Daily report',
  body        text not null default '',
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index coach_messages_agent_idx on coach_messages (agent_id, created_at desc);

alter table coach_messages enable row level security;

create policy "coach: full access to messages they sent"
  on coach_messages for all
  using (coach_id = auth.uid()) with check (coach_id = auth.uid());

create policy "agent: read own received messages"
  on coach_messages for select
  using (agent_id = auth.uid());

-- Agents only ever flip `read`; RLS can't restrict to a single column,
-- but the with-check still stops them reassigning a row to themselves
-- or editing a coach's title/body.
create policy "agent: mark own messages read"
  on coach_messages for update
  using (agent_id = auth.uid()) with check (agent_id = auth.uid());
