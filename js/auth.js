/* ============================================================
   ELITE TRACKER — auth.js
   -----------------------------------------------------------
   Two modes, same external interface (ui.js/app.js never know
   which one is live):

   1. MOCK (default, until js/supabase-client.js has real
      credentials): accounts and sessions live in localStorage on
      this device only, password stored in plaintext. It exists so
      the login/signup UI is fully click-through-able with zero
      setup. Not secure. Never syncs across devices.

   2. SUPABASE (once Supa.isConfigured() is true): real accounts,
      real sessions, real Google OAuth — see supabase-client.js and
      supabase/migrations/0001_init.sql for the schema + RLS this
      relies on.

   Every exported function is async so callers work unchanged
   whichever mode is live.
   ============================================================ */
(function (global) {
  'use strict';

  const USERS_KEY = 'elite_tracker_users_v1';
  const SESSION_KEY = 'elite_tracker_session_v1';
  const uid = () => Math.random().toString(36).slice(2, 10);

  let cachedSession = null;
  const listeners = [];
  function notify() { listeners.forEach((fn) => { try { fn(cachedSession); } catch (e) { /* listener's problem */ } }); }
  function onChange(fn) { listeners.push(fn); }

  function client() { return global.Supa && global.Supa.getClient(); }

  /* ---------- mock mode (localStorage) ---------- */
  function loadUsers() { try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; } catch (e) { return []; } }
  function saveUsers(users) { localStorage.setItem(USERS_KEY, JSON.stringify(users)); }
  function mockLoadSession() { try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) { return null; } }
  function mockSetSession(session) { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); cachedSession = session; }
  function mockClearSession() { localStorage.removeItem(SESSION_KEY); cachedSession = null; }

  function mockSignUpEmail(name, email, password) {
    email = String(email || '').trim().toLowerCase();
    if (!name || !name.trim()) return { error: 'Enter your name.' };
    if (!/^\S+@\S+\.\S+$/.test(email)) return { error: 'Enter a valid email.' };
    if (!password || password.length < 8) return { error: 'Password must be at least 8 characters.' };
    const users = loadUsers();
    if (users.some((u) => u.email === email)) return { error: 'An account with that email already exists — log in instead.' };
    const user = { id: uid(), name: name.trim(), email, password, provider: 'email', createdAt: Date.now() };
    users.push(user); saveUsers(users);
    mockSetSession({ id: user.id, name: user.name, email: user.email, provider: 'email' });
    return { user: cachedSession };
  }
  function mockSignInEmail(email, password) {
    email = String(email || '').trim().toLowerCase();
    const users = loadUsers();
    const user = users.find((u) => u.email === email && u.provider === 'email');
    if (!user || user.password !== password) return { error: 'Incorrect email or password.' };
    mockSetSession({ id: user.id, name: user.name, email: user.email, provider: 'email' });
    return { user: cachedSession };
  }

  /* ---------- Supabase mode ---------- */
  function mapSupaSession(session) {
    if (!session || !session.user) return null;
    const u = session.user;
    return {
      id: u.id,
      email: u.email,
      name: (u.user_metadata && u.user_metadata.name) || (u.user_metadata && u.user_metadata.full_name) || u.email,
      provider: (u.app_metadata && u.app_metadata.provider) || 'email',
    };
  }
  function friendlySupaError(error) {
    const msg = (error && error.message) || '';
    if (/already registered|already exists/i.test(msg)) return 'An account with that email already exists — log in instead.';
    if (/invalid login credentials/i.test(msg)) return 'Incorrect email or password.';
    if (/email not confirmed/i.test(msg)) return 'Confirm your email first — check your inbox for the link we sent.';
    if (/password/i.test(msg) && /least|short/i.test(msg)) return 'Password must be at least 8 characters.';
    return msg || 'Something went wrong — try again.';
  }

  /* ---------- init: call once at boot, before the first render ---------- */
  async function init() {
    const c = client();
    if (!c) { cachedSession = mockLoadSession(); return; }
    try {
      const { data } = await c.auth.getSession();
      cachedSession = mapSupaSession(data && data.session);
    } catch (e) { cachedSession = null; }
    c.auth.onAuthStateChange((_event, session) => {
      cachedSession = mapSupaSession(session);
      notify();
    });
  }

  function getSession() { return cachedSession; }

  // Testers who can flip between the consultant and coach UI on their own
  // account (ui.js's effectiveMode) without that being a real role change.
  // Hardcoded rather than a DB flag — nobody outside this list should ever
  // see the toggle, and it's a one-line edit to add or remove a tester.
  const SUPERUSER_EMAILS = ['tester@captur.com.au'];
  function isSuperuser() {
    const session = cachedSession;
    return !!(session && session.email && SUPERUSER_EMAILS.includes(session.email.toLowerCase()));
  }

  async function signUpEmail(name, email, password) {
    const c = client();
    if (!c) { const r = mockSignUpEmail(name, email, password); notify(); return r; }
    email = String(email || '').trim().toLowerCase();
    if (!name || !name.trim()) return { error: 'Enter your name.' };
    if (!/^\S+@\S+\.\S+$/.test(email)) return { error: 'Enter a valid email.' };
    if (!password || password.length < 8) return { error: 'Password must be at least 8 characters.' };
    const { data, error } = await c.auth.signUp({ email, password, options: { data: { name: name.trim() } } });
    if (error) return { error: friendlySupaError(error) };
    // Projects with "Confirm email" on (Supabase's default) create the user
    // but withhold a session until the confirmation link is clicked. Signal
    // this distinctly — treating it as a normal success would silently drop
    // the user into onboarding with no real session behind them.
    if (!data.session) return { needsConfirmation: true, email };
    cachedSession = mapSupaSession(data.session);
    notify();
    return { user: cachedSession };
  }

  async function signInEmail(email, password) {
    const c = client();
    if (!c) { const r = mockSignInEmail(email, password); notify(); return r; }
    const { data, error } = await c.auth.signInWithPassword({ email: String(email || '').trim().toLowerCase(), password });
    if (error) return { error: friendlySupaError(error) };
    cachedSession = mapSupaSession(data.session);
    notify();
    return { user: cachedSession };
  }

  function isGoogleConfigured() {
    // Google is enabled per-project in the Supabase dashboard (Authentication >
    // Providers), not configured here — once the backend is connected, this
    // just reflects whether that backend exists at all.
    return !!(global.Supa && global.Supa.isConfigured());
  }

  async function signInGoogle() {
    const c = client();
    if (!c) return { error: 'Google sign-in needs the backend connected first — see js/supabase-client.js.' };
    const { error } = await c.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
    // On success the browser navigates to Google and back; there is no local
    // result to return. The onAuthStateChange listener registered in init()
    // picks up the new session after redirect and notifies subscribers.
    if (error) return { error: 'Could not start Google sign-in — try again.' };
    return {};
  }

  async function signOut() {
    const c = client();
    if (!c) { mockClearSession(); notify(); return; }
    await c.auth.signOut();
    cachedSession = null;
    notify();
  }

  /* ---------- coach-code lookup / linking ----------
     Coach codes are generated uppercase (see generateCoachCode in ui.js),
     but nothing enforced that on entry — a code typed in lowercase, or
     pasted with stray whitespace, would never match the stored value
     since find_coach_by_code does a plain exact-match. Normalizing here
     (rather than an ilike change in the RPC) fixes it without a schema
     migration. Split into a read-only lookup (safe to call before this
     user's own profiles row exists, e.g. live during onboarding) and a
     linking step that requires it. */
  function normalizeCoachCode(code) { return String(code || '').trim().toUpperCase(); }

  async function findCoachByCode(code) {
    const c = client();
    const norm = normalizeCoachCode(code);
    if (!norm) return { error: 'Enter a code.' };
    if (!c) return { error: 'Coach linking needs the backend connected first.' };
    const { data, error } = await c.rpc('find_coach_by_code', { code: norm });
    if (error) return { error: error.message };
    if (!data || !data[0]) return { error: 'No coach found with that code — check with your coach.' };
    return { coach: data[0] };
  }

  async function linkCoach(code) {
    if (!cachedSession) return { error: 'Not signed in.' };
    const c = client();
    if (!c) return { error: 'Coach linking needs the backend connected first.' };
    const found = await findCoachByCode(code);
    if (found.error) return found;
    const { error } = await c.from('profiles').update({ coach_id: found.coach.id }).eq('id', cachedSession.id);
    if (error) return { error: error.message };
    return { ok: true, coach: found.coach };
  }

  /* ---------- profile creation (fires after onboarding finishes) ----------
     Local app state (js/store.js) remains the source of truth for now —
     this call is fire-and-forget best-effort sync to the backend so a
     coach's roster and an agent's coach-link start existing server-side.
     The rest of the day-to-day data (numbers, pipeline, CRM, goals) still
     lives in localStorage only; migrating that is the next phase. */
  async function syncProfile(profile) {
    const c = client();
    if (!c || !cachedSession) return { ok: true };
    const row = {
      id: cachedSession.id,
      role: profile.role,
      name: profile.name || '',
      vertical: profile.vertical || null,
      brand: profile.brand || '',
      coach_code: profile.coachCode || null,
      onboarded: true,
    };
    const { error } = await c.from('profiles').upsert(row);
    if (error) return { error: error.message };
    let coachLinkResult = null;
    if (profile.role === 'agent' && profile.coachAccessCode) {
      coachLinkResult = await linkCoach(profile.coachAccessCode);
    }
    return { ok: true, coachLinkResult };
  }

  global.Auth = {
    init, getSession, onChange,
    signUpEmail, signInEmail, signInGoogle, signOut,
    isGoogleConfigured, syncProfile, findCoachByCode, linkCoach, isSuperuser,
  };
})(window);
