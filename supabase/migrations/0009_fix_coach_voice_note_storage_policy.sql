-- ============================================================
-- Fixes coach playback of an agent's voice notes: "Could not load
-- audio" / "Cannot load audio" in the coach's client sheet.
--
-- Root cause, confirmed directly against the live database: the
-- voice_notes TABLE row is visible to the coach (that RLS policy
-- works — 0001_init.sql), and the audio object genuinely exists in
-- the "voice-notes" Storage bucket (the agent's own access lists and
-- signs it fine) — but the coach's storage.objects SELECT comes back
-- empty for that same path, with no error. That's RLS silently
-- filtering the row out, meaning the coach-read policy on
-- storage.objects from 0002_voice_notes_storage.sql either never
-- took effect in this project or isn't matching. The SQL there reads
-- correctly, so rather than guess why, this just re-asserts it
-- idempotently — safe to run regardless of the current state.
--
-- Run once in the Supabase SQL editor, same as the others.
-- ============================================================

drop policy if exists "voice note audio: coach reads linked agent notes" on storage.objects;

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
