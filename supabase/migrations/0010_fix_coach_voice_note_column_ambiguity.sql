-- ============================================================
-- Real fix for coach voice note playback (0009 did not fix it —
-- see below for why).
--
-- Confirmed by inspecting pg_policies directly: the coach-read
-- policy's stored USING clause was
--
--   exists (select 1 from profiles
--           where profiles.id = ((storage.foldername(profiles.name))[1])::uuid
--           and profiles.coach_id = auth.uid())
--
-- storage.foldername(profiles.name) — it's operating on the AGENT'S
-- DISPLAY NAME ("Debug Agent"), not the storage object's file path.
-- Inside a correlated subquery, an unqualified `name` resolves to
-- the closest table in scope (profiles, joined right there), not
-- the outer storage.objects row the policy is actually about. Both
-- tables have a `name` column, so Postgres silently picked the
-- wrong one — no error, just an always-false comparison, which is
-- why 0002's policy (and 0009's byte-identical "fix") both denied
-- every coach read.
--
-- Fixed by explicitly qualifying storage.objects.name so it can't
-- be shadowed by profiles.name.
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
      where profiles.id = ((storage.foldername(storage.objects.name))[1])::uuid
      and profiles.coach_id = auth.uid()
    )
  );
