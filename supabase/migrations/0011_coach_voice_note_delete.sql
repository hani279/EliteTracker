-- ============================================================
-- Lets a coach delete a linked agent's voice note — both the
-- metadata row and the audio object itself, so deleting doesn't
-- leave an orphaned file in Storage.
--
-- The storage policy explicitly qualifies storage.objects.name (not
-- bare `name`) — see 0010's comment for why: an unqualified `name`
-- inside a correlated subquery against `profiles` silently resolves
-- to profiles.name instead of the file path, since both tables have
-- a `name` column. Same mistake, same fix, applied from the start
-- this time.
--
-- Run once in the Supabase SQL editor, same as the others.
-- ============================================================

create policy "coach deletes linked agent voice_notes"
  on voice_notes for delete
  using (exists (select 1 from profiles where id = voice_notes.profile_id and coach_id = auth.uid()));

create policy "voice note audio: coach deletes linked agent notes"
  on storage.objects for delete
  using (
    bucket_id = 'voice-notes'
    and exists (
      select 1 from profiles
      where profiles.id = ((storage.foldername(storage.objects.name))[1])::uuid
      and profiles.coach_id = auth.uid()
    )
  );
