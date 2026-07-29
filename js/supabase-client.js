/* ============================================================
   ELITE TRACKER — supabase-client.js
   -----------------------------------------------------------
   Thin wrapper around the Supabase JS client. auth.js (and later
   the rest of the data layer) talks to `Supa`, never to the raw
   library directly, so swapping backends only ever touches this
   one file plus whichever module owns that slice of data.

   TODO(launch): replace the two placeholders below with your real
   project values — Supabase dashboard > Project Settings > API.
   The anon key is safe to ship in client code; it only grants what
   the Row Level Security policies in supabase/migrations/0001_init.sql
   allow. Never put the service_role key here or anywhere client-side.
   ============================================================ */
(function (global) {
  'use strict';

  const SUPABASE_URL = 'https://qvxorxlfmsgtazrfxsnj.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_aeadjb0y0sHGjinC4MpNEg_QqmeWrU1';

  // Web Push's public VAPID key — like the anon key, this is meant to ship
  // client-side (it identifies the sender, it doesn't authorize anything).
  // Its private counterpart lives only in the send-nudge Edge Function's
  // secrets. See BACKEND_SETUP.md for how this pair was generated.
  const VAPID_PUBLIC_KEY = 'BNAZgRFt9BY_HGEcpCGfwIUhp85lY7gboO7fgXcmvGPNw9zmnf5vWg1j0xZss-bcwvF8ZRupP4wlqv0ok0KaR8k';

  function isConfigured() {
    return SUPABASE_URL.indexOf('YOUR_SUPABASE') !== 0 && SUPABASE_ANON_KEY.indexOf('YOUR_SUPABASE') !== 0;
  }

  let client = null;
  function getClient() {
    if (!isConfigured()) return null;
    if (!client) {
      if (!global.supabase || !global.supabase.createClient) return null; // library script not loaded
      client = global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return client;
  }

  global.Supa = { getClient, isConfigured, VAPID_PUBLIC_KEY };
})(window);
