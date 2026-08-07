# MVP simplification checklist

Source: Fathom meeting — "App Discussion: Hani / Harry", ELITE Sales Coaching PTY LTD, 7 August 2026.

Goal: strip the app down to a simple "tick, tick, tick" daily-tracking MVP. Cut anything that adds cognitive load without earning its place yet — Auto Nudge, Predictive Plan, AI-generated copy, CRM, the standalone Reports tab.

## Testing (not from the original meeting)

- [x] Superuser preview toggle — an allowlisted tester account can flip between the consultant and coach UI from one login, without changing its real role. See `Auth.isSuperuser` / `SUPERUSER_EMAILS` in `js/auth.js`. Account: `tester@captur.com.au` (credentials shared separately).

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
- [x] Central mic button now opens a choice (record a voice note / write a summary) instead of jumping straight to recording; fixed the icon not being centered in the circle
- [x] Removed em dashes from the Tracker page's visible copy

## Reports (moves into Tracker, no longer its own tab)

- [x] Remove the standalone Reports tab
- [ ] Add a **"Generate report"** button on the Tracker page
  - [ ] Pulls data for whatever time period is currently selected (e.g. "This Week")
  - [ ] Outputs a PDF
- [ ] Add graphs to the generated report
- [ ] Add **Detailed Reports** — a separate, hidden/advanced feature for coaches to pull a custom date range

## Automated daily coach summary

- [ ] Replace per-client, per-time report sends with **one compiled PDF covering all clients**
- [ ] Email it to the coach automatically, once a day, at a set time (~10–11pm)

## Pipeline page

- [x] Remove the Database section
- [x] Update "Add Client" to capture business name and other details — business name, phone, email added; **needs migration `0007_pipeline_business_details.sql` run in the Supabase SQL editor** before these fields sync to the cloud
- [x] Outcomes moved here from Tracker and linked to real pipeline actions instead of a disconnected manual counter — a new item counts as "added to pipeline", and moving a deal to a vertical's trigger stage (real estate: Listed/Sold/Lost, sales: Demo/Proposal/Won/Lost — added a "Lost" stage to both) writes the matching outcome automatically. Manual tap on a bar still works as a correction fallback.

## Voice Log / Recorder

- [ ] **Bug: recordings aren't saving** — root cause is a missing storage API
- [ ] Build a proper storage API for recordings
- [ ] Show recordings in the coach dashboard
- [ ] Priority: after the Tracker MVP ships, not before

## Menu / Settings

- [ ] Hide items not needed for MVP
- [ ] Keep: Goals, Messages, Calendar
- [ ] Add two-way calendar sync, with reconnect alerts if sync breaks
- [ ] Add two reminders (not just one)

## Notifications strategy

- [ ] Use both in-app push notifications and mandatory Google Calendar events
- [ ] Calendar events are the more reliable prompt — harder to silently disable than an app notification

## Business / rollout (non-dev)

- [ ] Quote Robert: $400 one-time CRM build + $100/4 weeks "Digital Care" package — *Humzeh*
- [ ] Roll out to Humzeh Sunday morning
- [ ] Humzeh tests Monday–Wednesday and sends voice logs
- [ ] Schedule Wednesday catch-up — Hani & Humzeh — *Harry*
- [ ] Ask John (Dragons) to bring a marketing person to Tuesday's studio session — *Humzeh*
