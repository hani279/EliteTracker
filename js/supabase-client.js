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

  global.Supa = { getClient, isConfigured };
})(window);
