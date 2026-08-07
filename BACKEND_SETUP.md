# Backend setup (Supabase)

The app's auth layer (`js/auth.js`) and profile sync are wired for real. Right
now it's running in **mock mode** — accounts live in this browser's
localStorage only — because there's no Supabase project connected yet.
Everything below is the one-time setup to switch it on. None of it touches
code; it's account creation and two values pasted into one file.

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up / log in (a free
   account is enough to start).
2. **New project** → pick an organization, name it (e.g. `elite-tracker`),
   set a database password (save it somewhere — you won't need it day-to-day,
   but you'll want it if you ever connect a non-browser tool directly to the
   database), pick a region close to Harry's clients, and create it.
3. Wait ~2 minutes for it to finish provisioning.

## 2. Run the schema

1. In the Supabase dashboard, open **SQL Editor** (left sidebar).
2. **New query**, then paste the entire contents of
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
   from this project.
3. Run it. This creates every table (profiles, day_records, pipeline_items,
   crm_contacts, goals, special_ops, reports_log, voice_notes), turns on Row
   Level Security, and adds the policies that keep an agent's data private
   and give a coach read-only visibility into their own linked agents only.
4. Double-check in **Table Editor** that the tables appear.

## 3. Get your project credentials

1. **Project Settings** (gear icon) → **API**.
2. Copy the **Project URL** and the **`anon` `public`** key.
   (Never copy the `service_role` key into this app — that key bypasses
   Row Level Security entirely and must never leave a real server.)
3. Open [`js/supabase-client.js`](js/supabase-client.js) and replace:
   ```js
   const SUPABASE_URL = 'YOUR_SUPABASE_PROJECT_URL';
   const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
   ```
   with the two values you just copied.
4. Reload the app. Signup/login now create real Supabase accounts instead of
   local mock ones — you can confirm this in **Authentication → Users** and
   **Table Editor → profiles** in the dashboard after signing up.

## 4. Turn on Google sign-in

Google sign-in is enabled per-project inside Supabase, not in this app's code.

1. In Google Cloud Console ([console.cloud.google.com](https://console.cloud.google.com)):
   - Create a project (or use an existing one).
   - **APIs & Services → OAuth consent screen** — set it up (External, app
     name "ELITE Tracker", your support email).
   - **APIs & Services → Credentials → Create Credentials → OAuth client ID**
     → type **Web application**.
   - Leave this tab open — the next step needs a redirect URI Supabase gives you.
2. In Supabase: **Authentication → Providers → Google** → toggle it on. It
   shows a **Callback URL (for OAuth)** — copy that.
3. Back in Google Cloud: paste that callback URL into **Authorized redirect
   URIs** on the OAuth client, save, then copy the generated **Client ID**
   and **Client Secret**.
4. Paste both into the Supabase Google provider screen and save.
5. While testing locally, also add `http://localhost:8420` (or whatever port
   you're running on) to **Authorized JavaScript origins** on the Google
   OAuth client. Add your real production domain there too once you have one.

## 5. Data sync (local-first, background)

Signing up, logging in, Google sign-in, and the coach-code link between an
agent and their coach all go through Supabase once the above is done. Daily
numbers, pipeline, CRM, goals, special ops, and reports also now sync —
`js/sync.js` pushes local changes to Supabase in the background a couple
seconds after you stop typing/tapping, and pulls your latest data down on
login for a returning user on any device. The app still writes to
localStorage first and instantly, same as always — nothing here makes the
app feel slower or requires being online to keep using it.

**Verified end-to-end against a real Supabase project (2026-07-28).** A live
coach signup, a live agent signup linked via coach code, push of pipeline and
day-record data, and a pull on a simulated fresh device (fresh localStorage,
same login) all confirmed correct — including that the RLS boundary actually
holds: the coach could read the linked agent's data but a write attempt
against it affected zero rows.

Voice note **audio** now uploads to Supabase Storage in the background too
(see step 6 below for the one-time setup this needs) — transcription and
AI summary are the next phase, not this one.

## 6. Voice note storage

Recording still saves to IndexedDB first and instantly, same as every other
local-first write in this app — the Storage upload happens after, in the
background, and only ever adds a device-only fallback to "notes cached on
this phone" if it's offline or fails.

1. In the Supabase **SQL Editor**, run
   [`supabase/migrations/0002_voice_notes_storage.sql`](supabase/migrations/0002_voice_notes_storage.sql).
   It reshapes the `voice_notes` table (drops the `day_record_id` link in
   favor of the same `day` key every other table uses) and creates a
   private `voice-notes` Storage bucket with the same owner-full /
   coach-read-only policies as everything else.
2. That's it — no new credentials, same client already handles Storage.

## 7. Push notifications (coach "Send nudge")

Everything else in this app runs entirely on the client talking to
Supabase's database/auth/storage — this is the first feature that needs
actual server-side code, because delivering a push notification requires
a private key that can never be exposed in the browser. That code lives in
`supabase/functions/send-nudge/` and runs as a Supabase Edge Function.

This step needs the [Supabase CLI](https://supabase.com/docs/guides/cli) —
`npx supabase <command>` works fine without a global install, no separate
signup, it uses the same Supabase account you already have.

1. **Link this project to your Supabase project** (one-time):
   ```
   npx supabase login
   npx supabase link --project-ref qvxorxlfmsgtazrfxsnj
   ```
2. **Run the migration** — same as before, paste
   [`supabase/migrations/0003_push_notifications.sql`](supabase/migrations/0003_push_notifications.sql)
   into the SQL Editor and run it. This creates `push_subscriptions` (where
   each device registers itself) with owner-only RLS.
3. **Set the function's secrets** (the VAPID keypair). The public half is
   already embedded in `js/supabase-client.js` (safe — that half is meant
   to be public, same idea as the anon key). The **private** half is a
   real secret and deliberately isn't written down anywhere in this repo
   — it was generated once and shared with you directly outside of any
   committed file. Grab it from there, or generate a fresh pair yourself
   (any VAPID generator works — `npx web-push generate-vapid-keys` is the
   simplest) and update `VAPID_PUBLIC_KEY` in `js/supabase-client.js` to
   match if you do:
   ```
   npx supabase secrets set VAPID_PUBLIC_KEY=<the public key in js/supabase-client.js>
   npx supabase secrets set VAPID_PRIVATE_KEY=<the private key — never commit this>
   npx supabase secrets set VAPID_SUBJECT=mailto:you@yourdomain.com
   ```
   (Swap the `mailto:` for a real address you control — push services use
   it to contact you if your server ever misbehaves.)
4. **Deploy the function**:
   ```
   npx supabase functions deploy send-nudge
   ```
5. Reload the app, log in as an agent, open the reminders sheet and enable
   reminders (this is what triggers the browser's notification-permission
   prompt and registers the device) — accept the permission prompt.
6. As the coach, open that agent from **Clients**, tap **Send nudge**. A
   real notification should arrive even if the agent's tab is closed
   (though not if the browser itself is fully quit — that's a platform
   limit, not this app's).

Scheduled reminders (morning focus / EOD log prompts) still only fire
while the app is open in a tab, same as before this step — turning those
into background push too would mean the function running on a timer
against every user's own local time zone, which is a bigger lift than
"coach taps a button right now." Worth doing later if it matters enough.

## 8. Automated daily coach summary emails

Once a day, every coach gets one email with a PDF covering all of their
agents' activity for the day — replacing one-off per-client sends. This
needs three things none of the earlier steps do: a transactional email
provider, a scheduled trigger (not a person clicking a button), and a
non-user secret (the function has no signed-in caller to check a JWT
against).

1. **Create a [Resend](https://resend.com) account** (free tier is plenty
   to start) and grab an API key from the dashboard. If you want the
   "from" address to be `reports@yourdomain.com` rather than Resend's
   shared test domain, verify that domain in Resend first (a few DNS
   records) — otherwise just use their default sender for now and switch
   later.
2. **Run the migration** — paste
   [`supabase/migrations/0008_daily_coach_summary_cron.sql`](supabase/migrations/0008_daily_coach_summary_cron.sql)
   into the SQL Editor. Read its comment block first: it needs two
   `vault.create_secret(...)` calls run *before* it (not part of the
   migration itself, since those values are secrets and this file is
   committed to git) — the function's URL and a random cron secret you
   generate yourself, e.g. `openssl rand -hex 24`.
3. **Set the function's secrets** — the cron secret must be the exact
   same value you just put in Vault:
   ```
   npx supabase secrets set CRON_SECRET=<same value as vault's daily_summary_cron_secret>
   npx supabase secrets set RESEND_API_KEY=<your Resend API key>
   npx supabase secrets set RESEND_FROM="ELITE Tracker <reports@yourdomain.com>"
   ```
4. **Deploy the function** — this one skips Supabase's usual JWT check
   since pg_cron has no user session to present:
   ```
   npx supabase functions deploy send-daily-coach-summaries --no-verify-jwt
   ```
5. **Test it without waiting for the schedule** — call it directly with
   the same secret header pg_cron will send:
   ```
   curl -X POST https://qvxorxlfmsgtazrfxsnj.supabase.co/functions/v1/send-daily-coach-summaries \
     -H "x-cron-secret: <your CRON_SECRET>"
   ```
   A coach with at least one linked agent should get an email within a
   few seconds. The response body lists what happened per coach (sent,
   skipped-no-agents, skipped-no-email, or an error) — useful for
   confirming without digging through logs.

By default this fires at 11:00 UTC (9pm AEST / 10pm AEDT — see the
migration's comment for the daylight-saving tradeoff and how to change
it). This whole feature is new and untested against a live send — the
`curl` step above is how to verify it actually works before trusting the
schedule.

## 9. Sanity check

1. Sign up as a coach → check **Table Editor → profiles** for a new row with
   `role = 'coach'` and a generated `coach_code`.
2. Sign up as an agent using that code in the "Coach access code" field →
   confirm their profile row has `coach_id` pointing at the coach's `id`.
3. Log out, log back in with the same email/password → should land back in
   the app without repeating onboarding.
4. As the agent, log a number or add a pipeline item, wait a couple seconds,
   then check **Table Editor → day_records** / **pipeline_items** — a
   matching row should appear without you doing anything else.
5. Open the app in a different browser (or an incognito window), log in as
   the same agent → their numbers and pipeline should already be there,
   pulled down from Supabase rather than starting empty.
6. If any of steps 4–5 don't show data: open the browser console — `sync.js`
   logs `sync push failed` / `sync pull failed` with the underlying Supabase
   error (most likely cause: an RLS policy mismatch, worth checking against
   `supabase/migrations/0001_init.sql` first).
