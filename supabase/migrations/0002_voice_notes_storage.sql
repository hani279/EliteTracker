-- ============================================================
-- ELITE TRACKER — voice note cloud storage
-- Run once in the Supabase SQL editor, same as 0001_init.sql.
--
-- voice_notes originally linked to day_records.id, which meant every
-- upload needed a round-trip to look up that server-generated uuid
-- first. The rest of the app identifies a day by its 'YYYY-MM-DD'
-- key locally, so voice_notes is switched to the same (profile_id,
-- day) shape as day_records — no lookup needed, and it matches how
-- js/sync.js already pushes everything else.
-- ============================================================

alter table voice_notes drop column day_record_id;
alter table voice_notes add column day date not null default current_date;
alter table voice_notes alter column day drop default;

-- ------------------------------------------------------------
-- Storage bucket for the actual audio blobs. Private — every read
-- and write goes through the policies below, same owner-full /
-- coach-read-only shape as every other table.
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('voice-notes', 'voice-notes', false)
on conflict (id) do nothing;

-- Objects are stored at "<profile_id>/<voice_note_id>.<ext>" — the
-- first path segment is what these policies check against.
create policy "voice note audio: owner full access"
  on storage.objects for all
  using (bucket_id = 'voice-notes' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'voice-notes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "voice note audio: coach reads linked agent notes"
  on storage.objects for select
  using (
    bucket_id = 'voice-notes'
    and exists (
      select 1 from profiles
      where id = ((storage.foldername(name))[1])::uuid
      and coach_id = auth.uid()
    )
  );
