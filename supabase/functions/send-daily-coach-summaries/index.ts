// ELITE TRACKER — send-daily-coach-summaries Edge Function
// -----------------------------------------------------------
// Runs once a day, triggered by pg_cron (see
// supabase/migrations/0008_daily_coach_summary_cron.sql), and emails
// every coach one compiled PDF covering all of their agents' activity
// for the day — replacing the old idea of per-client, per-time sends.
//
// Unlike send-nudge, this has no signed-in caller: pg_cron calls it
// directly via pg_net, so it's authenticated with a shared secret
// (CRON_SECRET) instead of a user JWT.
//
// Deploy: supabase functions deploy send-daily-coach-summaries --no-verify-jwt
// Secrets (set once):
//   supabase secrets set CRON_SECRET=$(openssl rand -hex 24)
//   supabase secrets set RESEND_API_KEY=re_...
//   supabase secrets set RESEND_FROM="ELITE Tracker <reports@yourdomain.com>"
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.
//
// The vertical activity/outcome labels below are a deliberate,
// deno-side duplicate of js/data.js's VERTICALS (that file is a
// browser UMD module referencing `window`, so it can't be imported
// here as-is). Keep the two in sync if a vertical's metrics change.

import { createClient } from "npm:@supabase/supabase-js@2";
import PDFDocument from "npm:pdfkit@0.15";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const RESEND_FROM = Deno.env.get("RESEND_FROM") || "ELITE Tracker <onboarding@resend.dev>";

// The coach's evening send time (~10-11pm) is a wall-clock concept,
// not a UTC one — this only affects which calendar day's numbers get
// pulled, computed in this fixed timezone regardless of the server's.
// Change this (and the cron schedule's UTC hour, in the migration) if
// coaches aren't in Sydney.
const REPORT_TIMEZONE = "Australia/Sydney";

type MetricDef = { key: string; label: string };
const VERTICALS: Record<string, { activity: MetricDef[]; outcomes: MetricDef[] }> = {
  realestate: {
    activity: [
      { key: "calls", label: "Calls" },
      { key: "conversations", label: "Conversations" },
      { key: "doorknocks", label: "Door knocks" },
      { key: "baps", label: "BAPs · booked appraisals" },
      { key: "maps", label: "MAPs · market appraisals" },
      { key: "laps", label: "LAPs · listing appraisals" },
    ],
    outcomes: [
      { key: "listingsWon", label: "Listings won" },
      { key: "propertySold", label: "Property sold" },
      { key: "addedPipeline", label: "Added to pipeline" },
      { key: "clientsLost", label: "Clients lost" },
    ],
  },
  sales: {
    activity: [
      { key: "calls", label: "Calls" },
      { key: "conversations", label: "Conversations" },
      { key: "social", label: "LinkedIn / social" },
      { key: "mtgsBooked", label: "1st mtgs booked" },
      { key: "mtgsSat", label: "1st mtgs sat" },
      { key: "addedPipeline", label: "Added to pipeline" },
    ],
    outcomes: [
      { key: "dealsWon", label: "Deals won" },
      { key: "proposals", label: "Proposals sent" },
      { key: "demos", label: "Demos delivered" },
      { key: "churn", label: "Deals lost" },
    ],
  },
};

function todayInTimezone(): string {
  // en-CA gives YYYY-MM-DD directly, matching Postgres' `date` text form.
  return new Intl.DateTimeFormat("en-CA", { timeZone: REPORT_TIMEZONE }).format(new Date());
}

type AgentProfile = { id: string; name: string; vertical: string | null };
type DayRecord = { numbers: Record<string, number>; outcomes: Record<string, number>; summary: { did?: string; learned?: string; struggled?: string }; logged: boolean } | null;

function buildPdf(coachName: string, dateLabel: string, sections: { agent: AgentProfile; day: DayRecord }[]): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48 });
    const chunks: Uint8Array[] = [];
    doc.on("data", (c: Uint8Array) => chunks.push(c));
    doc.on("end", () => {
      const total = chunks.reduce((n, c) => n + c.length, 0);
      const out = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) { out.set(c, offset); offset += c.length; }
      resolve(out);
    });
    doc.on("error", reject);

    doc.fontSize(20).text("ELITE Tracker — Daily Summary", { align: "left" });
    doc.fontSize(11).fillColor("#666").text(`${coachName} · ${dateLabel}`);
    doc.moveDown(1.2);

    if (!sections.length) {
      doc.fillColor("#000").fontSize(12).text("No agents linked yet.");
    }

    for (const { agent, day } of sections) {
      const v = VERTICALS[agent.vertical || "realestate"] || VERTICALS.realestate;
      doc.fillColor("#000").fontSize(14).text(agent.name || "Unnamed agent", { continued: false });

      if (!day || !day.logged) {
        doc.fontSize(11).fillColor("#a24a2e").text("No activity logged today.");
        doc.moveDown(1);
        continue;
      }

      doc.fontSize(10).fillColor("#444").text("Activity");
      v.activity.forEach((m) => {
        const val = (day.numbers && day.numbers[m.key]) || 0;
        doc.fontSize(10).fillColor("#000").text(`  ${m.label}: ${val}`);
      });

      const outcomeLines = v.outcomes
        .map((o) => ({ label: o.label, val: (day.outcomes && day.outcomes[o.key]) || 0 }))
        .filter((o) => o.val > 0);
      if (outcomeLines.length) {
        doc.moveDown(0.3);
        doc.fontSize(10).fillColor("#444").text("Outcomes");
        outcomeLines.forEach((o) => doc.fontSize(10).fillColor("#000").text(`  ${o.label}: ${o.val}`));
      }

      const summaryText = day.summary && (day.summary.did || day.summary.learned || day.summary.struggled);
      if (summaryText) {
        doc.moveDown(0.3);
        doc.fontSize(10).fillColor("#444").text("Notes");
        if (day.summary.did) doc.fontSize(10).fillColor("#000").text(`  Did: ${day.summary.did}`);
        if (day.summary.learned) doc.fontSize(10).fillColor("#000").text(`  Learned: ${day.summary.learned}`);
        if (day.summary.struggled) doc.fontSize(10).fillColor("#000").text(`  Struggled: ${day.summary.struggled}`);
      }
      doc.moveDown(1);
    }

    doc.end();
  });
}

// btoa(String.fromCharCode(...bytes)) blows the call stack on any PDF
// of real size (spreads the whole array as call arguments) — encode in
// fixed-size chunks instead.
function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function buildHtmlBody(coachName: string, dateLabel: string, agentCount: number, loggedCount: number): string {
  return `<div style="font-family:sans-serif;color:#182238">
    <h2 style="margin:0 0 4px">Daily Summary — ${dateLabel}</h2>
    <p style="color:#5c6478;margin:0 0 16px">${coachName}, ${loggedCount} of ${agentCount} agents logged activity today. Full breakdown attached as a PDF.</p>
  </div>`;
}

Deno.serve(async (req) => {
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, x-cron-secret" };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  if (req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const today = todayInTimezone();
  const dateLabel = new Date(today + "T00:00:00").toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });

  const { data: coaches, error: coachErr } = await admin
    .from("profiles").select("id, name, brand").eq("role", "coach").eq("onboarded", true);
  if (coachErr) return new Response(JSON.stringify({ error: coachErr.message }), { status: 500, headers: cors });

  const results: Record<string, unknown>[] = [];

  for (const coach of coaches || []) {
    try {
      // Coaches don't have a mailing address in `profiles` — this reads
      // it off their auth user record (service_role can see any user).
      const { data: authUser } = await admin.auth.admin.getUserById(coach.id);
      const coachEmail = authUser?.user?.email;
      if (!coachEmail) { results.push({ coach: coach.id, skipped: "no email" }); continue; }

      const { data: agents } = await admin
        .from("profiles").select("id, name, vertical").eq("role", "agent").eq("coach_id", coach.id);
      if (!agents || !agents.length) { results.push({ coach: coach.id, skipped: "no agents" }); continue; }

      const agentIds = agents.map((a) => a.id);
      const { data: days } = await admin
        .from("day_records").select("profile_id, numbers, outcomes, summary, logged")
        .eq("day", today).in("profile_id", agentIds);
      const dayByAgent = new Map((days || []).map((d) => [d.profile_id, d]));

      const sections = agents.map((agent) => ({ agent, day: (dayByAgent.get(agent.id) as DayRecord) || null }));
      const loggedCount = sections.filter((s) => s.day && s.day.logged).length;

      const pdfBytes = await buildPdf(coach.name || "Coach", dateLabel, sections);
      const pdfBase64 = bytesToBase64(pdfBytes);

      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: RESEND_FROM,
          to: [coachEmail],
          subject: `Daily Summary — ${coach.brand || coach.name || "Your team"} — ${dateLabel}`,
          html: buildHtmlBody(coach.name || "Coach", dateLabel, agents.length, loggedCount),
          attachments: [{ filename: `daily-summary-${today}.pdf`, content: pdfBase64 }],
        }),
      });
      if (!emailRes.ok) { results.push({ coach: coach.id, error: await emailRes.text() }); continue; }
      results.push({ coach: coach.id, sent: true, agents: agents.length, logged: loggedCount });
    } catch (e) {
      results.push({ coach: coach.id, error: String(e) });
    }
  }

  return new Response(JSON.stringify({ date: today, results }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
});
