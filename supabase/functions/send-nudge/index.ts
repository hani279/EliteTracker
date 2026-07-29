// ELITE TRACKER — send-nudge Edge Function
// -----------------------------------------------------------
// Delivers a real Web Push notification to an agent even when they
// don't have the app open. This is the only place the VAPID private
// key exists — everything client-side only ever handles the public
// half (see js/push.js, js/supabase-client.js).
//
// Deploy: supabase functions deploy send-nudge
// Secrets (set once): supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are
// injected automatically by the platform — no need to set those.

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:support@example.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401, headers: cors });

    // Bound to the caller's own JWT so auth.getUser() only ever resolves
    // to whoever is really signed in — never trust a client-supplied id.
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !user) return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401, headers: cors });

    const { agentId, title, body } = await req.json();
    if (!agentId) return new Response(JSON.stringify({ error: "agentId required" }), { status: 400, headers: cors });

    // service_role bypasses RLS — safe here only because we've already
    // confirmed the caller's real identity above, and we check the
    // coach/agent relationship explicitly before touching anything.
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: agent, error: agentErr } = await admin
      .from("profiles").select("id, coach_id, name").eq("id", agentId).maybeSingle();
    if (agentErr || !agent || agent.coach_id !== user.id) {
      return new Response(JSON.stringify({ error: "Not your agent" }), { status: 403, headers: cors });
    }

    const { data: subs } = await admin.from("push_subscriptions").select("*").eq("profile_id", agentId);
    if (!subs || !subs.length) {
      return new Response(JSON.stringify({ sent: 0, reason: "No registered devices" }), { status: 200, headers: cors });
    }

    const payload = JSON.stringify({
      title: title || "Nudge from your coach",
      body: body || "Check in on ELITE Tracker.",
    });

    let sent = 0;
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        sent++;
      } catch (e) {
        // 404/410 means the subscription is dead (uninstalled, expired) —
        // drop it so future nudges stop retrying it.
        const status = e && (e.statusCode || (e as { statusCode?: number }).statusCode);
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    }

    return new Response(JSON.stringify({ sent }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});
