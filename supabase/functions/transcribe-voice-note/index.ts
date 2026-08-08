// ELITE TRACKER — transcribe-voice-note Edge Function
// -----------------------------------------------------------
// Transcribes a voice note (OpenAI Whisper) and writes a short
// coach-facing summary (OpenAI chat completion) back onto its
// voice_notes row. Triggered automatically right after a successful
// upload (see uploadVoiceNote() in app.js) — fire-and-forget, same
// pattern as the upload itself, so a transient failure just leaves
// transcript/ai_summary null rather than blocking anything. Also
// callable manually (coach's "Retry transcription") for exactly that
// case.
//
// Deploy: supabase functions deploy transcribe-voice-note
// Secrets (set once): supabase secrets set OPENAI_API_KEY=sk-...
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401, headers: cors });

    // Bound to the caller's own JWT, same as send-nudge — auth.getUser()
    // only ever resolves to whoever is really signed in.
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !user) return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401, headers: cors });

    const { voiceNoteId } = await req.json();
    if (!voiceNoteId) return new Response(JSON.stringify({ error: "voiceNoteId required" }), { status: 400, headers: cors });

    // service_role bypasses RLS — safe here only because we explicitly
    // check below that the caller is either the note's own owner or
    // the linked coach, mirroring the RLS policies rather than trusting
    // service_role's bypass to stand in for authorization.
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: note, error: noteErr } = await admin
      .from("voice_notes").select("id, profile_id, storage_path").eq("id", voiceNoteId).maybeSingle();
    if (noteErr || !note) return new Response(JSON.stringify({ error: "Voice note not found" }), { status: 404, headers: cors });

    let authorized = note.profile_id === user.id;
    if (!authorized) {
      const { data: owner } = await admin.from("profiles").select("coach_id").eq("id", note.profile_id).maybeSingle();
      authorized = !!owner && owner.coach_id === user.id;
    }
    if (!authorized) return new Response(JSON.stringify({ error: "Not your voice note" }), { status: 403, headers: cors });

    const { data: audioBlob, error: dlErr } = await admin.storage.from("voice-notes").download(note.storage_path);
    if (dlErr || !audioBlob) return new Response(JSON.stringify({ error: "Could not download audio" }), { status: 500, headers: cors });

    // ---- 1. Transcribe (Whisper) ----
    const ext = note.storage_path.split(".").pop() || "webm";
    const form = new FormData();
    form.append("file", audioBlob, `audio.${ext}`);
    form.append("model", "whisper-1");
    const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: form,
    });
    if (!whisperRes.ok) {
      const errText = await whisperRes.text();
      return new Response(JSON.stringify({ error: "Transcription failed: " + errText }), { status: 502, headers: cors });
    }
    const whisperJson = await whisperRes.json();
    const transcript: string = (whisperJson.text || "").trim();

    // ---- 2. Summarize (for a coach skimming a roster of updates) ----
    let summary = "";
    if (transcript) {
      const chatRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You summarize a sales consultant's voice check-in for their coach, who is skimming many of these. One or two short sentences, plain text, no preamble. Prioritize: numbers/results mentioned, blockers or struggles, anything needing the coach's attention. Skip filler.",
            },
            { role: "user", content: transcript },
          ],
          temperature: 0.3,
          max_tokens: 120,
        }),
      });
      if (chatRes.ok) {
        const chatJson = await chatRes.json();
        summary = (chatJson.choices?.[0]?.message?.content || "").trim();
      }
      // A failed summary isn't fatal — the transcript alone is still
      // useful, and this function can be re-run (coach's manual retry).
    }

    const { error: updateErr } = await admin.from("voice_notes")
      .update({ transcript, ai_summary: summary || null })
      .eq("id", voiceNoteId);
    if (updateErr) return new Response(JSON.stringify({ error: updateErr.message }), { status: 500, headers: cors });

    return new Response(JSON.stringify({ transcript, summary }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});
