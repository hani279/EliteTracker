# MVP simplification checklist

Source: Fathom meeting — "App Discussion: Hani / Harry", ELITE Sales Coaching PTY LTD, 7 August 2026.

Goal: strip the app down to a simple "tick, tick, tick" daily-tracking MVP. Cut anything that adds cognitive load without earning its place yet — Auto Nudge, Predictive Plan, AI-generated copy, CRM, the standalone Reports tab.

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
- [x] Small Goals section at the bottom of the page
- [x] Remove AI-generated copy (e.g. "Calls are your biggest gap…") — that's the coach's job, not the app's
- [x] Disable Auto Nudge (no AI API key — avoid the added complexity)
- [x] Disable Predictive Plan
- [x] Remove Copy and PDF actions from the old Reports card (superseded by "Generate report," below)
- [x] Remove "Areas to improve" section

## Reports (moves into Tracker, no longer its own tab)

- [ ] Remove the standalone Reports tab
- [ ] Add a **"Generate report"** button on the Tracker page
  - [ ] Pulls data for whatever time period is currently selected (e.g. "This Week")
  - [ ] Outputs a PDF
- [ ] Add graphs to the generated report
- [ ] Add **Detailed Reports** — a separate, hidden/advanced feature for coaches to pull a custom date range

## Automated daily coach summary

- [ ] Replace per-client, per-time report sends with **one compiled PDF covering all clients**
- [ ] Email it to the coach automatically, once a day, at a set time (~10–11pm)

## Pipeline page

- [ ] Remove the Database section
- [ ] Update "Add Client" to capture business name and other details

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
