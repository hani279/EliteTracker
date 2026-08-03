-- Private coach notes: a scratchpad about an agent that only the coach
-- who wrote it can ever see — deliberately no agent-facing RLS policy
-- at all, unlike coach_messages which the agent reads by design.
create table coach_notes (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references profiles(id) on delete cascade,
  agent_id    uuid not null references profiles(id) on delete cascade,
  note        text not null default '',
  updated_at  timestamptz not null default now(),
  unique (coach_id, agent_id)
);

alter table coach_notes enable row level security;

create policy "coach: full access to own notes"
  on coach_notes for all
  using (coach_id = auth.uid()) with check (coach_id = auth.uid());
