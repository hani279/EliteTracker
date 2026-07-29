/* ============================================================
   ELITE TRACKER — sync.js
   -----------------------------------------------------------
   Local-first background sync between js/store.js's localStorage
   state and Supabase. Deliberately NOT a rewrite of every screen
   into async queries — ui.js keeps reading Store synchronously,
   exactly as before, so the app stays instant and fully usable
   offline. This module only does two things:

     pull() — on boot, for a returning user with a real session,
              fetch their rows from Supabase and merge them into
              the local Store before the first render.

     push() — after every local save (via Store.onSave), debounce
              briefly then upsert the changed slices of local state
              to their matching tables. Fire-and-forget: a failed
              push is logged, not surfaced, since the local copy is
              already safely saved either way.

   No-ops entirely in mock mode (Supa.getClient() returns null) —
   nothing here changes behavior until a real backend is connected.

   Verified 2026-07-28 against a live project: coach signup, agent
   signup with coach-code linking (coach_id resolves correctly via
   find_coach_by_code), push of pipeline/day_records, pull on a
   simulated fresh device, and the RLS boundary itself — a coach can
   read a linked agent's rows but a write attempt against them
   affects zero rows. See BACKEND_SETUP.md for the full test log.
   ============================================================ */
(function (global) {
  'use strict';

  const S = global.Store;
  function client() { return global.Supa && global.Supa.getClient(); }

  let pushTimer = null;
  let suppressNextPush = false; // set true right before a pull-triggered save

  function scheduleSync() {
    if (suppressNextPush) { suppressNextPush = false; return; }
    const c = client();
    if (!c || !(global.Auth && Auth.getSession())) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => { push().catch((e) => console.warn('sync push failed', e)); }, 1200);
  }

  /* ---------- push: local -> remote ---------- */
  async function push() {
    const c = client(); const session = global.Auth && Auth.getSession();
    if (!c || !session) return;
    const s = S.get();
    const pid = session.id;

    await c.from('profiles').update({
      onboarded: s.onboarded,
      targets: s.targets,
      focus_template: s.focusTemplate,
      build_framework: s.buildFramework,
      settings: s.settings,
    }).eq('id', pid);

    const days = Object.keys(s.days || {}).map((key) => {
      const d = s.days[key];
      return {
        profile_id: pid, day: key,
        focus: d.focus || [], numbers: d.numbers || {}, outcomes: d.outcomes || {},
        summary: d.summary || { did: '', learned: '', struggled: '' },
        reviewed_eod: !!d.reviewedEOD, logged: !!d.logged,
      };
    });
    if (days.length) await c.from('day_records').upsert(days, { onConflict: 'profile_id,day' });

    if ((s.pipeline || []).length) {
      await c.from('pipeline_items').upsert(s.pipeline.map((p) => ({
        id: p.id, profile_id: pid, name: p.name, detail: p.detail || '', stage: p.stage,
        value: p.value || 0, selling_month: p.sellingMonth || '', stalled: !!p.stalled,
      })));
    }
    if ((s.crm || []).length) {
      await c.from('crm_contacts').upsert(s.crm.map((x) => ({
        id: x.id, profile_id: pid, name: x.name, contact: x.contact || '', type: x.type || 'Warm',
        next_action: x.nextAction || '', next_date: x.nextDate || null, notes: x.notes || '',
      })));
    }
    if ((s.goals || []).length) {
      await c.from('goals').upsert(s.goals.map((g) => ({
        id: g.id, profile_id: pid, category: g.category, title: g.title, detail: g.detail || '',
      })));
    }
    if ((s.specialOps || []).length) {
      await c.from('special_ops').upsert(s.specialOps.map((o) => ({
        id: o.id, profile_id: pid, title: o.title, description: o.description || '', active: !!o.active, items: o.items || [],
      })));
    }
    if ((s.reportsLog || []).length) {
      await c.from('reports_log').upsert(s.reportsLog.map((r) => ({
        id: r.id, profile_id: pid, type: r.type, range_label: r.rangeLabel, score: r.score,
      })));
    }
  }

  /* ---------- pull: remote -> local (boot only, returning users) ---------- */
  async function pull() {
    const c = client(); const session = global.Auth && Auth.getSession();
    if (!c || !session) return;
    const pid = session.id;
    const s = S.get();

    const { data: profileRow } = await c.from('profiles').select('*').eq('id', pid).maybeSingle();
    if (profileRow) {
      s.onboarded = !!profileRow.onboarded;
      if (profileRow.role === 'coach' || profileRow.role === 'agent') s.mode = profileRow.role;
      s.profile.name = profileRow.name || s.profile.name;
      s.profile.vertical = profileRow.vertical || s.profile.vertical;
      s.profile.brand = profileRow.brand || '';
      s.profile.coachCode = profileRow.coach_code || s.profile.coachCode || '';
      s.profile.role = profileRow.role === 'coach' ? 'Head Coach' : s.profile.role;
      if (profileRow.targets && Object.keys(profileRow.targets).length) s.targets = profileRow.targets;
      if (profileRow.focus_template && profileRow.focus_template.length) s.focusTemplate = profileRow.focus_template;
      if (profileRow.build_framework) s.buildFramework = profileRow.build_framework;
      if (profileRow.settings) s.settings = Object.assign({}, s.settings, profileRow.settings);
    }

    const { data: days } = await c.from('day_records').select('*').eq('profile_id', pid);
    if (days) days.forEach((d) => {
      const existing = s.days[d.day];
      s.days[d.day] = {
        focus: d.focus || [], numbers: d.numbers || {}, outcomes: d.outcomes || {},
        summary: d.summary || { did: '', learned: '', struggled: '' },
        reviewedEOD: !!d.reviewed_eod, logged: !!d.logged,
        voiceNotes: (existing && existing.voiceNotes) || [],
      };
    });

    const { data: pipeline } = await c.from('pipeline_items').select('*').eq('profile_id', pid);
    if (pipeline && pipeline.length) s.pipeline = pipeline.map((p) => ({
      id: p.id, name: p.name, detail: p.detail, stage: p.stage, value: p.value,
      sellingMonth: p.selling_month, stalled: p.stalled, updated: Date.parse(p.updated_at) || Date.now(),
    }));

    const { data: crm } = await c.from('crm_contacts').select('*').eq('profile_id', pid);
    if (crm && crm.length) s.crm = crm.map((x) => ({
      id: x.id, name: x.name, contact: x.contact, type: x.type, nextAction: x.next_action,
      nextDate: x.next_date, notes: x.notes, updated: Date.parse(x.updated_at) || Date.now(),
    }));

    const { data: goals } = await c.from('goals').select('*').eq('profile_id', pid);
    if (goals && goals.length) s.goals = goals.map((g) => ({ id: g.id, category: g.category, title: g.title, detail: g.detail }));

    const { data: ops } = await c.from('special_ops').select('*').eq('profile_id', pid);
    if (ops && ops.length) s.specialOps = ops.map((o) => ({ id: o.id, title: o.title, description: o.description, active: o.active, items: o.items || [] }));

    const { data: reports } = await c.from('reports_log').select('*').eq('profile_id', pid).order('created_at', { ascending: false });
    if (reports && reports.length) s.reportsLog = reports.map((r) => ({ id: r.id, type: r.type, rangeLabel: r.range_label, score: r.score, date: Date.parse(r.created_at) || Date.now() }));

    if (profileRow && profileRow.role === 'coach') await pullRoster(c, pid, s);

    suppressNextPush = true;
    S.save();
  }

  /* ---------- coach roster: derived from linked agents' own data ----------
     A coach's roster isn't its own table — it's read straight off the
     agents' profiles + day_records (the RLS "coach reads linked agent
     X" policies are what make this safe: the query below only ever
     returns rows for agents whose coach_id is this coach). Pace/streak
     use the same math as intelligence.js's aggregate()/streak(), just
     evaluated against a fetched profile_id -> day map instead of the
     local Store, since coaches don't have their agents' data locally. */
  async function pullRoster(c, pid, s) {
    const { data: agents } = await c.from('profiles').select('id,name,vertical,targets,settings').eq('coach_id', pid);
    if (!agents || !agents.length) { s.coachRoster = []; s.demoAlerts = []; return; }

    const ids = agents.map((a) => a.id);
    const since = S.addDays(S.todayKey(), -60);
    const { data: records } = await c.from('day_records').select('profile_id,day,numbers,logged,updated_at').in('profile_id', ids).gte('day', since);
    const byAgent = {};
    ids.forEach((id) => { byAgent[id] = {}; });
    (records || []).forEach((r) => { byAgent[r.profile_id][r.day] = r; });

    s.coachRoster = agents.map((a) => rosterEntry(a, byAgent[a.id] || {}));
    s.demoAlerts = buildAlerts(s.coachRoster);
  }

  function rosterEntry(agent, dayMap) {
    const Data = global.Data;
    const vKey = agent.vertical === 'sales' ? 'sales' : 'realestate';
    const defs = (Data && Data.VERTICALS[vKey].activity) || [];
    const targets = agent.targets || {};
    const settings = agent.settings || {};
    const assumeMin = settings.assumeMinimums !== false;
    const today = S.todayKey();
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    const isWeekend = (k) => [0, 6].includes(S.parseKey(k).getDay());

    // 7-day pace, same adaptive-minimum logic as intelligence.js's aggregate()
    let totalActual = 0, totalTarget = 0;
    for (let i = 6; i >= 0; i--) {
      const k = S.addDays(today, -i);
      const rec = dayMap[k];
      const isPast = S.parseKey(k) <= startOfToday;
      const weekend = isWeekend(k);
      const logged = rec && rec.logged && Object.keys(rec.numbers || {}).length > 0;
      defs.forEach((m) => {
        const tgt = targets[m.key] ?? m.target;
        if (!weekend && isPast) totalTarget += tgt;
        if (logged) totalActual += (rec.numbers[m.key] || 0);
        else if (!weekend && isPast && assumeMin) totalActual += Math.round(tgt * 0.5);
      });
    }
    const pace = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;

    // consecutive logged workdays, walking back from today
    let streakCount = 0, k = today;
    for (let i = 0; i < 60; i++) {
      const rec = dayMap[k];
      if (isWeekend(k)) { k = S.addDays(k, -1); continue; }
      const logged = rec && rec.logged && Object.keys(rec.numbers || {}).length > 0;
      if (i === 0 && !logged) { k = S.addDays(k, -1); continue; }
      if (logged) { streakCount++; k = S.addDays(k, -1); } else break;
    }

    // most recent logged day, for "last check-in" + at-risk detection
    let lastKey = null, lastRow = null;
    Object.keys(dayMap).sort().reverse().some((dk) => {
      const rec = dayMap[dk];
      if (rec && rec.logged && Object.keys(rec.numbers || {}).length > 0) { lastKey = dk; lastRow = rec; return true; }
      return false;
    });
    const daysSince = lastKey ? Math.round((S.parseKey(today) - S.parseKey(lastKey)) / 86400000) : Infinity;

    let status;
    if (daysSince >= 3) status = 'At risk';
    else if (pace >= 75) status = 'On track';
    else if (pace >= 45) status = 'Watch';
    else status = 'At risk';

    return {
      name: agent.name || 'Unnamed', type: vKey === 'sales' ? 'Sales' : 'Real Estate',
      status, pace, streak: streakCount, last: fmtLastCheckin(lastKey, lastRow && lastRow.updated_at),
    };
  }

  function fmtLastCheckin(lastKey, updatedAt) {
    if (!lastKey) return 'No check-ins yet';
    const today = S.todayKey();
    if (lastKey === today) {
      const d = new Date(updatedAt || Date.now());
      return 'Today ' + d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
    }
    if (lastKey === S.addDays(today, -1)) return 'Yesterday';
    const days = Math.round((S.parseKey(today) - S.parseKey(lastKey)) / 86400000);
    return `${days} days ago`;
  }

  function buildAlerts(roster) {
    return roster.filter((c) => c.status !== 'On track').map((c) => ({
      name: c.name,
      kind: c.status === 'At risk' ? 'AT RISK' : 'WATCH',
      tone: c.status === 'At risk' ? 'red' : 'amber',
      text: c.status === 'At risk'
        ? `Pace at ${c.pace}% of target — last check-in ${c.last.toLowerCase()}.`
        : `Pace slipping to ${c.pace}% this week — worth a nudge.`,
      when: c.last,
    }));
  }

  S.onSave(scheduleSync);

  global.Sync = { push, pull };
})(window);
