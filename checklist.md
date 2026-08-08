# MVP simplification checklist

Source: Fathom meeting — "App Discussion: Hani / Harry", ELITE Sales Coaching PTY LTD, 7 August 2026.

Goal: strip the app down to a simple "tick, tick, tick" daily-tracking MVP. Cut anything that adds cognitive load without earning its place yet — Auto Nudge, Predictive Plan, AI-generated copy, CRM, the standalone Reports tab.

## Testing (not from the original meeting)

- [x] Superuser preview toggle — an allowlisted tester account can flip between the consultant and coach UI from one login, without changing its real role. See `Auth.isSuperuser` / `SUPERUSER_EMAILS` in `js/auth.js`. Account: `tester@captur.com.au` (credentials shared separately).

## Special Ops (user-directed, not from the original meeting)

- [x] Add a way to delete a special op — there was previously no control for this at all (only individual checklist items could be toggled). Added an × button on each op's card, next to the title, deleting immediately with no confirmation (same convention as Pipeline's delete).

## Navigation

- [x] Consolidate bottom nav to three tabs: **Tracker**, **Pipeline**, **Voice Log**
- [x] Voice Log is a central, prominent button (not a plain nav item) — encourage usage
- [x] Remove the CRM tab entirely
- [x] Fold "Today" dashboard into the Tracker page (no separate dashboard)
- [x] Fold Special Ops into the Tracker section
- [x] Remove the "Sales (non-real estate)" vertical header

## Tracker page (Today + Reports merged in)

- [x] "Log today's numbers" as a clear header/section
- [x] Color-coded progress bar per metric — Red / Orange / Green
- [x] Replace current activity view with the Activity Funnel
- [ ] ~~Funnel views: Weekly / Monthly / Quarterly (+ YTD)~~ — unified with the system-wide filter below instead of a separate set; flag if Quarterly specifically is still wanted alongside it
- [x] System-wide time filters standardized to: **Today, Week to Date, Month to Date, Year to Date**
- [ ] ~~Small Goals section at the bottom of the page~~ — added, then removed at the user's request; Goals is still reachable from the menu, just not previewed on the Tracker page anymore
- [x] Remove AI-generated copy (e.g. "Calls are your biggest gap…") — that's the coach's job, not the app's
- [x] Disable Auto Nudge (no AI API key — avoid the added complexity)
- [x] Disable Predictive Plan
- [x] Remove Copy and PDF actions from the old Reports card (superseded by "Generate report," below)
- [x] Remove "Areas to improve" section

## Tracker page refinements (user-directed, not from the original meeting)

Follow-up polish requested directly after the initial Tracker rebuild — recorded here so this file stays the accurate single source of truth for the page's current state.

- [x] Removed the "Your goals" preview card from the Tracker page (see note above — Goals still lives in the menu)
- [x] Moved Today's focus to directly under the Activity Funnel
- [x] Activity Funnel's title is now dynamic per selected period: Daily / Weekly / Monthly / Yearly Funnel
- [x] ~~Outcomes is its own bar-chart widget, not a plain list~~ — superseded below: it moved off the Tracker page entirely, onto Pipeline
- [x] Outcomes bars are themselves the "tap to add" control (removed the separate tag row from the numbers card) — now a manual-correction fallback; see Pipeline link below
- [x] ~~Conversion funnel is now an actual funnel visual~~ — tried, but it read as a confusing duplicate of the Activity Funnel; replaced with plain R/O/G progress-bar rows (same style as "Log today's numbers"), same cumulative-retention data, no funnel shape
- [x] More spacing between "Log today's numbers" and the period tabs below it
- [x] ~~Central mic button now opens a choice (record a voice note / write a summary) instead of jumping straight to recording~~ — superseded below: the choice-of-two-sheets pattern was replaced by one expandable sheet
- [x] Removed em dashes from the Tracker page's visible copy
- [x] Removed the "Daily summary" card from the Tracker page and folded it into the mic button's sheet (see below) — the Tracker page no longer previews captured-but-uneditable copies of it
- [x] Mic button's "Daily log" sheet is now a single expandable sheet, not a menu of two separate sheets: collapsed shows only "Record a voice note"; "More" expands in place to reveal the write-a-summary form and today's recorded voice notes, without closing/reopening the sheet

## Reports (moves into Tracker, no longer its own tab)

- [x] Remove the standalone Reports tab
- [x] Add a **"Generate report"** button on the Tracker page
  - [x] Pulls data for whatever time period is currently selected (Today/WTD/MTD/YTD, matches the Tracker page's own period tabs)
  - [x] Outputs a PDF — via the browser's native print dialog ("Save as PDF"), not a PDF library; a `@media print` stylesheet (already scaffolded in styles.css) hides app chrome and prints only the report
- [x] Add graphs to the generated report — reuses the same Activity Funnel visual as the Tracker page
- [x] Add **Detailed Reports** — a separate, hidden/advanced feature for coaches to pull a custom date range. Deliberately buried (Clients → an agent → ghost "Detailed report (custom date range)" button, not a nav tab) and deliberately simple — raw activity/outcome totals over any From/To range, no target/pace math (a target is a daily figure; turning it into a fair total over an arbitrary range would mean re-deriving workdays-in-range like intelligence.js's aggregate() does, out of scope for what's meant to stay a raw pull). New `Sync.fetchAgentVertical` / `Sync.fetchAgentDayRecords`, relying on the existing coach-read RLS on `day_records` and `profiles` — no migration needed. Verified end-to-end against the live database: logged real numbers as an agent, confirmed the coach's report aggregated them correctly (including outcomes) through the real UI, and confirmed the invalid-range guard (From after To) doesn't crash or corrupt the display.

## Automated daily coach summary

- [x] Replace per-client, per-time report sends with **one compiled PDF covering all clients** — new `send-daily-coach-summaries` Edge Function, one PDF per coach covering every linked agent
- [x] Email it to the coach automatically, once a day, at a set time (~10–11pm) — via Resend, triggered by `pg_cron`; see `supabase/migrations/0008_daily_coach_summary_cron.sql` and BACKEND_SETUP.md §8 for the (several) manual setup steps this needs — a Resend account/API key, a Vault secret, and a `supabase functions deploy`
  - Written but **not yet deployed or sent a real test email** — needs the setup steps above run by hand before it does anything

## Pipeline page

- [x] Remove the Database section
- [x] Update "Add Client" to capture business name and other details — business name, phone, email added; **needs migration `0007_pipeline_business_details.sql` run in the Supabase SQL editor** before these fields sync to the cloud
- [x] Outcomes moved here from Tracker and linked to real pipeline actions instead of a disconnected manual counter — a new item counts as "added to pipeline", and moving a deal to a vertical's trigger stage (real estate: Listed/Sold/Lost, sales: Demo/Proposal/Won/Lost — added a "Lost" stage to both) writes the matching outcome automatically. Manual tap on a bar still works as a correction fallback.

## Voice Log / Recorder

- [x] **Bug: recordings aren't saving** — root cause was `supabase/migrations/0002_voice_notes_storage.sql` never having been run against the live project (bucket + schema change both missing). Migration run 2026-08-07; re-verified directly against the live database afterward — schema has the `day` column, the `voice-notes` bucket exists, a real upload/download/row-insert/cleanup round-trip succeeded, and a locally-pending note picked up by the app's own retry path actually got its `storagePath` set. Fully working end to end now.
- [x] Build a proper storage API for recordings — the API itself already existed (`uploadVoiceNote` in app.js, `voice-notes` bucket + RLS in the migration); what was actually missing was resilience. Added: automatic retry for any voice note that finished recording but never made it to storage (runs at boot/login and on regaining connectivity, not just once at record-time), and a "Not backed up yet" tag in the voice notes list so a stuck upload is visible instead of silently swallowed.
- [x] Show recordings in the coach dashboard — root cause was a column-ambiguity bug in the coach-read storage policy (see `0010_fix_coach_voice_note_column_ambiguity.sql`'s comment for the full explanation). Migration run 2026-08-08; re-verified directly against the live database afterward — coach can now list the object, generate a signed URL, and download real bytes, and confirmed through the actual coach UI (Clients → agent → Voice notes → play) with no "Could not load audio" error. Fully working end to end now.
- [x] Priority: after the Tracker MVP ships, not before — the Tracker MVP has shipped; this was picked up next as requested

## Menu / Settings

- [x] Hide items not needed for MVP — split into two levels: the main Menu sheet now shows only Goals, Messages, Calendar (+ Preview for superusers), and everything else (Appearance, Reminders, Coach link, Install app, Privacy, Log out, Reset data) moved into a new Settings tile/screen one tap away
- [x] Keep: Goals, Messages, Calendar
- [ ] Add two-way calendar sync, with reconnect alerts if sync breaks — scoping needed, see note below; current "Calendar" tile is still the one-way .ics export, not real sync
- [x] Add two reminders (not just one) — already existed (morning + end-of-day), just relocated into Settings

Fixed in passing: the menu was reading the account's real role (`s.mode`) instead of the superuser preview override (`UI.effectiveMode`), so a tester previewing as Consultant was seeing the Coach's menu items. Now uses the same helper as the rest of the app.

## Notifications strategy

- [ ] Use both in-app push notifications and mandatory Google Calendar events
- [ ] Calendar events are the more reliable prompt — harder to silently disable than an app notification

## Business / rollout (non-dev)

- [ ] Quote Robert: $400 one-time CRM build + $100/4 weeks "Digital Care" package — *Humzeh*
- [ ] Roll out to Humzeh Sunday morning
- [ ] Humzeh tests Monday–Wednesday and sends voice logs
- [ ] Schedule Wednesday catch-up — Hani & Humzeh — *Harry*
- [ ] Ask John (Dragons) to bring a marketing person to Tuesday's studio session — *Humzeh*
