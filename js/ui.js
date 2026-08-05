/* ============================================================
   ELITE TRACKER — ui.js
   Rendering, router, onboarding, all screens, sheets, forms.
   ============================================================ */
(function (global) {
  'use strict';
  const S = global.Store, Data = global.Data, Intel = global.Intel;

  let current = 'today';       // agent view
  let coachView = 'dashboard'; // coach view
  let clientSearch = '';
  let clientStatusFilter = 'All';
  let clientSort = 'pace-desc';
  let onbStep = 0;
  let authMode = 'signup';     // 'signup' | 'login'
  let authError = '';
  let authInfo = '';           // neutral/positive notice, e.g. "check your email"
  const onbTmp = { role: null, vertical: null, name: '', coachName: '', coachId: '', coachLookupStatus: '', coachCode: '', brand: '', coachCodeGen: '' };

  // onbTmp otherwise lives only in memory — close the tab mid-onboarding
  // (phone locks, an accidental swipe-away, a background tab getting
  // reclaimed) and everything typed so far — name, goal, proof, steps —
  // is gone, with no account yet to have saved it to. Mirror it into
  // localStorage as the user types/steps through, and restore it before
  // the first render so onboarding resumes instead of restarting blank.
  const ONB_DRAFT_KEY = 'elite_tracker_onb_draft_v1';
  function saveOnbDraft() {
    try { localStorage.setItem(ONB_DRAFT_KEY, JSON.stringify({ onbTmp, onbStep })); } catch (e) { /* ignore */ }
  }
  function loadOnbDraft() {
    try {
      const raw = localStorage.getItem(ONB_DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft && draft.onbTmp) Object.assign(onbTmp, draft.onbTmp);
      if (draft && typeof draft.onbStep === 'number') onbStep = draft.onbStep;
    } catch (e) { /* ignore corrupt draft */ }
  }
  function clearOnbDraft() {
    try { localStorage.removeItem(ONB_DRAFT_KEY); } catch (e) { /* ignore */ }
  }
  loadOnbDraft();

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- primitives ----------
  function ring(pct, label, opt) {
    opt = opt || {}; const size = opt.size || 64;
    const r = (size - 8) / 2, c = 2 * Math.PI * r, off = c * (1 - Math.min(pct, 100) / 100);
    const track = 'var(--hairline)';
    const col = opt.color || 'var(--gold)';
    return `<div class="ringwrap" style="width:${size}px;height:${size}px">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${track}" stroke-width="6"/>
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${col}" stroke-width="6" stroke-linecap="round"
          stroke-dasharray="${c}" stroke-dashoffset="${off}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
      </svg><div class="rt"><div class="p" style="${opt.dark ? '' : ''}">${pct}%</div><div class="l">${label || ''}</div></div></div>`;
  }

  function initials(name) { return (name || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase(); }

  // ---------- toast ----------
  let toastT;
  function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200);
  }

  // ---------- sheet ----------
  function openSheet(html) {
    $('sheet').innerHTML = `<div class="grab"></div>` + html;
    $('sheet-backdrop').classList.add('open');
  }
  function closeSheet() { $('sheet-backdrop').classList.remove('open'); }

  /* ============================================================
     ONBOARDING
     ============================================================ */
  function renderOnboarding() {
    const wrap = $('onboarding');
    if (!Auth.getSession()) { wrap.innerHTML = renderAuthScreen(); return; }
    if (!onbTmp.role) { wrap.innerHTML = renderRoleScreen(); return; }
    const steps = onbTmp.role === 'coach' ? [stepCoachProfile, stepCoachCode] : [stepVertical, stepProfile, stepBuild];
    wrap.innerHTML = `<div class="onb">
      <div class="brand"><span class="dia"></span><span class="nm">ELITE</span><span class="tk">TRACKER</span></div>
      ${steps[onbStep]()}
      <div class="dots">${steps.map((_, i) => `<span class="d ${i === onbStep ? 'on' : ''}"></span>`).join('')}</div>
    </div>`;
    saveOnbDraft();
  }

  function renderRoleScreen() {
    return `<div class="onb">
      <div class="brand"><span class="dia"></span><span class="nm">ELITE</span><span class="tk">TRACKER</span></div>
      <h2>How will you use ELITE Tracker?</h2>
      <p class="lead">This decides what you see from here on — a daily tracker, or a coach's view across a roster.</p>
      <button class="choice" data-act="onb-role:agent">
        <div class="ct">I'm a Consultant</div>
        <div class="cs">Log daily numbers, get coached, track your own pipeline and goals.</div>
      </button>
      <button class="choice" data-act="onb-role:coach">
        <div class="ct">I'm a Coach</div>
        <div class="cs">See your roster's pace, get alerted when someone needs a nudge, review reports.</div>
      </button>
    </div>`;
  }

  /* ---------- auth (sign up / log in) ---------- */
  function googleMark() {
    return `<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.167 6.656 3.58 9 3.58z"/>
    </svg>`;
  }

  function renderAuthScreen() {
    const isSignup = authMode === 'signup';
    return `<div class="onb">
      <div class="brand"><span class="dia"></span><span class="nm">ELITE</span><span class="tk">TRACKER</span></div>
      <h2>${isSignup ? 'Create your account' : 'Welcome back'}</h2>
      <p class="lead">${isSignup ? 'Start today. Track your activity, hit your targets and keep your coach in the loop.' : 'Log in to pick up where you left off.'}</p>

      <button class="btn-google" data-act="auth-google">${googleMark()}<span>Continue with Google</span></button>
      <div class="divider"><span>or continue with email</span></div>

      ${authInfo ? `<div class="callout green" style="margin-bottom:16px">${Icons.svg('check', { size: 15 })}<span>${esc(authInfo)}</span></div>` : ''}
      <div class="card-light">
        ${authError ? `<div class="callout red" style="margin:0 0 14px">${Icons.svg('target', { size: 15 })}<span>${esc(authError)}</span></div>` : ''}
        ${isSignup ? `<div class="field"><label>Your name</label><input class="input" id="auth-name" placeholder="e.g. Jordan Avery"></div>` : ''}
        <div class="field"><label>Email</label><input class="input" id="auth-email" type="email" autocomplete="email" placeholder="you@email.com"></div>
        <div class="field" style="margin-bottom:0"><label>Password</label><input class="input" id="auth-password" type="password" autocomplete="${isSignup ? 'new-password' : 'current-password'}" placeholder="${isSignup ? 'At least 8 characters' : 'Your password'}"></div>
      </div>

      <div class="step-actions">
        <button class="btn gold" data-act="auth-submit" style="flex:1">${isSignup ? 'Create account' : 'Log in'}</button>
      </div>
      <p class="lead" style="margin-top:18px;font-size:13px">${isSignup ? 'Already have an account?' : 'New here?'}
        <a href="#" data-act="auth-mode:${isSignup ? 'login' : 'signup'}" style="color:var(--gold-ink);font-weight:600;text-decoration:none">${isSignup ? 'Log in' : 'Create one'}</a></p>
      ${!isSignup ? `<p class="lead" style="margin-top:6px;font-size:12px"><a href="#" data-act="auth-forgot" style="color:var(--bone-faint);text-decoration:none">Forgot password?</a></p>` : ''}
    </div>`;
  }

  function stepVertical() {
    return `<h2>Let's set you up</h2>
      <p class="lead">First — which world are you selling in? This tailors every metric, pipeline stage and report.</p>
      <button class="choice ${onbTmp.vertical === 'realestate' ? 'on' : ''}" data-act="onb-vert:realestate">
        <div class="ct">Real Estate</div>
        <div class="cs">Calls, door knocks, appraisals (BAP / MAP / LAP), listings & sales.</div>
      </button>
      <button class="choice ${onbTmp.vertical === 'sales' ? 'on' : ''}" data-act="onb-vert:sales">
        <div class="ct">Sales — Non-Real-Estate</div>
        <div class="cs">Calls, social touches, first meetings, deals & pipeline.</div>
      </button>
      <div class="step-actions">
        <button class="btn ghost" data-act="onb-back">Back</button>
        <button class="btn gold" data-act="onb-next" ${onbTmp.vertical ? '' : 'disabled style="opacity:.5"'}>Continue</button>
      </div>`;
  }

  function stepProfile() {
    const status = onbTmp.coachLookupStatus;
    const statusHtml = status === 'checking'
      ? `<div class="subtle" style="margin-top:6px">Looking up code…</div>`
      : status === 'found'
      ? `<div class="subtle" style="margin-top:6px;color:var(--green)">${Icons.svg('check', { size: 13 })} Coach found: ${esc(onbTmp.coachName)}</div>`
      : status === 'notfound'
      ? `<div class="subtle" style="margin-top:6px;color:var(--clay)">No coach found with that code — you can add it later in Settings.</div>`
      : '';
    return `<h2>Who's tracking?</h2>
      <p class="lead">So your coach sees who's putting in the work.</p>
      <div class="card-light">
        <div class="field"><label>Your name</label>
          <input class="input" id="onb-name" placeholder="e.g. Jordan Avery" value="${esc(onbTmp.name)}" oninput="UI.captureOnb()"></div>
        <div class="field" style="margin-bottom:0"><label>Coach access code (optional)</label>
          <input class="input" id="onb-code" style="letter-spacing:4px;font-family:var(--mono);text-align:center;max-width:120px" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="0000" value="${esc(onbTmp.coachCode)}" oninput="App.coachCodeInput(this.value)">
          ${statusHtml}
        </div>
      </div>
      <div class="step-actions">
        <button class="btn ghost" data-act="onb-back">Back</button>
        <button class="btn gold" data-act="onb-next">Continue</button>
      </div>`;
  }

  /* ---------- coach onboarding ---------- */
  // Fixed 4-digit code, not the old NAME-1234 format — short enough to
  // type as a single numeric field with no room for stray spaces or
  // casing mismatches. Old-format codes already shared by existing
  // coaches keep working (find_coach_by_code is a plain string match,
  // unaffected by what shape *new* codes take).
  function generateCoachCode() {
    return String(Math.floor(1000 + Math.random() * 9000));
  }

  function stepCoachProfile() {
    return `<h2>Set up your coaching profile</h2>
      <p class="lead">This is what your clients see on their nudges and reports.</p>
      <div class="card-light">
        <div class="field"><label>Your name</label>
          <input class="input" id="onb-coachname" placeholder="e.g. Harry Whitfield" value="${esc(onbTmp.name)}" oninput="UI.captureOnb()"></div>
        <div class="field" style="margin-bottom:0"><label>Business / brand name (optional)</label>
          <input class="input" id="onb-brand" placeholder="e.g. Whitfield Coaching" value="${esc(onbTmp.brand)}" oninput="UI.captureOnb()"></div>
      </div>
      <div class="step-actions">
        <button class="btn ghost" data-act="onb-back">Back</button>
        <button class="btn gold" data-act="onb-next">Continue</button>
      </div>`;
  }

  function stepCoachCode() {
    if (!onbTmp.coachCodeGen) onbTmp.coachCodeGen = generateCoachCode();
    return `<h2>You're set</h2>
      <p class="lead">Share this code with your clients — they'll enter it when they sign up so their numbers reach you.</p>
      <div class="card-light" style="text-align:center">
        <div class="section-title" style="margin-bottom:8px">Your coach code</div>
        <div style="font-family:var(--mono);font-size:26px;letter-spacing:2px;color:var(--gold-ink);font-weight:500">${esc(onbTmp.coachCodeGen)}</div>
      </div>
      <div class="step-actions">
        <button class="btn ghost" data-act="onb-back">Back</button>
        <button class="btn gold" data-act="onb-finish">Enter ELITE Tracker</button>
      </div>`;
  }

  function stepBuild() {
    return `<h2>What did you do?</h2>
      <p class="lead">Start-up reflection. Where are you now, and what are you building toward?</p>
      <div class="card-light">
        <div class="field" style="margin-bottom:0"><label>Recent wins / where you're at</label>
          <textarea class="textarea" id="onb-did" placeholder="What have you done well lately? What's your current level?" oninput="UI.captureOnb()">${esc(onbTmp.did || '')}</textarea></div>
      </div>
      <div class="step-actions">
        <button class="btn ghost" data-act="onb-back">Back</button>
        <button class="btn gold" data-act="onb-finish">Enter ELITE Tracker</button>
      </div>`;
  }

  function captureOnb() {
    if (onbTmp.role === 'coach') {
      if (onbStep === 0) { onbTmp.name = ($('onb-coachname') || {}).value || ''; onbTmp.brand = ($('onb-brand') || {}).value || ''; }
      saveOnbDraft();
      return;
    }
    if (onbStep === 1) {
      onbTmp.name = ($('onb-name') || {}).value || '';
      onbTmp.coachCode = ($('onb-code') || {}).value || '';
    }
    if (onbStep === 2) { onbTmp.did = ($('onb-did') || {}).value || ''; }
    saveOnbDraft();
  }

  function finishOnboarding() {
    captureOnb();
    const s = S.get();
    if (onbTmp.role === 'coach') {
      s.mode = 'coach';
      s.profile.name = onbTmp.name || 'Coach';
      s.profile.role = 'Head Coach';
      s.profile.brand = onbTmp.brand || '';
      s.profile.coachCode = onbTmp.coachCodeGen || '';
    } else {
      s.mode = 'agent';
      s.profile.name = onbTmp.name || 'Consultant';
      s.profile.coachName = onbTmp.coachName || 'your coach';
      s.profile.coachCode = onbTmp.coachCode || '';
      if (onbTmp.did) { const t = S.dayRecord(S.todayKey()); t.summary.did = onbTmp.did; }
      Data.seedAll(onbTmp.vertical);
    }
    s.onboarded = true;
    S.save();
    clearOnbDraft();
    $('onboarding').style.display = 'none';
    $('main').style.display = 'block';
    render();

    // Best-effort sync to the backend, if one is connected — local state
    // above is already the source of truth for this session either way.
    Auth.syncProfile({
      role: onbTmp.role,
      name: s.profile.name,
      vertical: onbTmp.role === 'coach' ? null : onbTmp.vertical,
      brand: s.profile.brand || '',
      coachCode: onbTmp.role === 'coach' ? onbTmp.coachCodeGen : '',
      coachAccessCode: onbTmp.role === 'agent' ? onbTmp.coachCode : '',
    }).then((r) => {
      if (r && r.error) { toast('Saved locally — backend sync failed: ' + r.error); return; }
      if (r && r.coachLinkResult) {
        if (r.coachLinkResult.ok) {
          const st = S.get();
          st.profile.coachId = r.coachLinkResult.coach.id;
          st.profile.coachName = r.coachLinkResult.coach.name;
          st.settings.coachName = r.coachLinkResult.coach.name;
          S.save(); render();
        } else if (r.coachLinkResult.error && onbTmp.coachCode) {
          toast("Coach code not found — you can add it later in Settings.");
        }
      }
    });
  }

  /* ============================================================
     TOP BAR + BOTTOM NAV
     ============================================================ */
  const AGENT_TITLES = { today: 'Dashboard', track: 'Tracker', pipeline: 'Pipeline', crm: 'CRM', reports: 'Reports', goals: 'Goals' };
  const COACH_TITLES = { dashboard: 'Coach Dashboard', clients: 'Clients', alerts: 'Alerts' };

  function renderTopbar() {
    const s = S.get();
    const title = s.mode === 'coach' ? COACH_TITLES[coachView] : AGENT_TITLES[current];
    const sub = s.mode === 'coach'
      ? esc(s.profile.name) + (s.profile.brand ? ' · ' + esc(s.profile.brand) : ' · Head Coach')
      : Data.vertical().label + ' · ' + esc(s.profile.name);
    $('topbar').innerHTML = `<div class="topbar">
      <div>
        <h1>${title}</h1>
        <div class="sub">${sub}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <button class="icon-btn" data-act="open-menu" aria-label="Menu">${Icons.svg('menu', { size: 18 })}</button>
      </div>
    </div>`;
  }

  function renderNav() {
    const s = S.get();
    const nav = $('bottomnav');
    if (s.mode === 'coach') {
      const items = [['dashboard', 'grid', 'Dashboard'], ['clients', 'users', 'Clients'], ['alerts', 'bell', 'Alerts']];
      const alertN = (s.demoAlerts || []).filter((a) => a.tone === 'red' || a.tone === 'amber').length;
      nav.innerHTML = items.map(([k, ic, l]) =>
        `<button class="${coachView === k ? 'on' : ''}" data-act="cnav:${k}"><span class="ic">${Icons.svg(ic)}</span>${l}${k === 'alerts' && alertN ? ` <span class="badge">${alertN}</span>` : ''}</button>`).join('');
    } else {
      const items = [['today', 'home', 'Today'], ['track', 'chart', 'Track'], ['pipeline', 'folder', 'Pipeline'], ['crm', 'user', 'CRM'], ['reports', 'file', 'Reports']];
      nav.innerHTML = items.map(([k, ic, l]) =>
        `<button class="${current === k ? 'on' : ''}" data-act="nav:${k}"><span class="ic">${Icons.svg(ic)}</span>${l}</button>`).join('');
    }
  }

  /* ============================================================
     MAIN RENDER / ROUTER
     ============================================================ */
  // Only jump to the top of the page when the visible screen actually
  // changes (a tab switch). render() itself gets called on every small
  // data mutation too (tapping a number stepper, ticking off a focus
  // item) — unconditionally scrolling to top on those made the page
  // snap out from under your thumb mid-tap, which read as a rubber-band
  // bounce even though it wasn't a real overscroll.
  let lastRenderedView = null;
  function render() {
    const s = S.get();
    if (!Auth.getSession() || !s.onboarded) { $('onboarding').style.display = 'block'; $('main').style.display = 'none'; renderOnboarding(); return; }
    $('onboarding').style.display = 'none'; $('main').style.display = 'block';
    renderTopbar(); renderNav();
    const host = $('views');
    if (s.mode === 'coach') host.innerHTML = coachScreen();
    else host.innerHTML = agentScreen();
    const viewKey = s.mode + ':' + (s.mode === 'coach' ? coachView : current);
    if (viewKey !== lastRenderedView) window.scrollTo({ top: 0 });
    lastRenderedView = viewKey;
  }

  function agentScreen() {
    switch (current) {
      case 'today': return viewToday();
      case 'track': return viewTrack();
      case 'pipeline': return viewPipeline();
      case 'crm': return viewCRM();
      case 'reports': return viewReports();
      case 'goals': return viewGoals();
      default: return viewToday();
    }
  }
  function coachScreen() {
    switch (coachView) {
      case 'dashboard': return coachDashboard();
      case 'clients': return coachClients();
      case 'alerts': return coachAlerts();
      default: return coachDashboard();
    }
  }

  /* ============================================================
     AGENT — TODAY (dashboard: focus, log, coach, summary, predict)
     ============================================================ */
  function viewToday() {
    const s = S.get(); const day = S.dayRecord(S.todayKey());
    const calls = Intel.callsToday(); const pace = Intel.todayPace(); const st = Intel.streak();
    const doneFocus = day.focus.filter((f) => f.done).length;
    const pred = Intel.predictive();

    return `
    <section class="screen active">
      <div class="hero">
        <h2>${greeting()}, ${esc(s.profile.name.split(' ')[0])}</h2>
        <div class="meta"><span>${S.fmtDate(S.todayKey())}</span><span>·</span><span class="streak">${st}-day streak</span><span>·</span><span>numbers due ${s.settings.numbersDue}</span></div>
        <div class="hero-stats">
          <div class="hero-stat"><div class="k">Today's calls</div><div class="v">${calls.done}/${calls.target}</div></div>
          <div class="hero-stat"><div class="k">Day pace</div><div class="v gold">${pace}%</div></div>
          <div class="ring">${ring(pace, 'FOCUS')}</div>
        </div>
      </div>

      ${twoWeekFocusCard()}

      <div class="card">
        <h3>Today's focus <span class="pill">${doneFocus}/${day.focus.length}</span>
          <button class="btn ghost sm" data-act="focus-to-calendar" title="Add today's timed focus blocks to your calendar">${Icons.svg('calendar', { size: 13 })}</button>
        </h3>
        ${day.focus.map((f) => `
          <div class="focus-item ${f.done ? 'done' : ''}" data-act="focus:${f.id}">
            <div class="check ${f.done ? 'done' : ''}">${f.done ? Icons.svg('check', { size: 12 }) : ''}</div>
            <div class="txt">${esc(f.text)}</div>
            <div class="time">${esc(f.time || '')}</div>
          </div>`).join('')}
        <div class="btn-row" style="margin-top:12px">
          <button class="btn ghost sm" data-act="add-focus">${Icons.svg('plus', { size: 14 })} Add task</button>
          <button class="btn ${day.reviewedEOD ? 'outline' : 'gold'} sm" data-act="eod-review">${day.reviewedEOD ? Icons.svg('check', { size: 14 }) + ' Day reviewed' : 'End-of-day review'}</button>
        </div>
      </div>

      ${salesFunnelCard()}

      <div class="card dark">
        <div class="coach-msg">
          <div class="avatar">${initials(s.profile.coachName)}</div>
          <div>
            <div class="who">${esc(s.profile.coachName)} · your coach</div>
            <div class="when">auto-nudge · ${nowTime()}</div>
            <div class="quote">"${coachNudge(pace, calls)}"</div>
          </div>
        </div>
      </div>

      <div class="card">
        <h3>Daily summary & voice note</h3>
        <p class="subtle" style="margin:0 0 10px">What did you do, what did you learn, where did you struggle? Captured for you and ${esc(s.profile.coachName)}.</p>
        <div class="btn-row">
          <button class="btn gold" data-act="open-voice">${Icons.svg('mic', { size: 15 })} Record voice note</button>
          <button class="btn outline" data-act="open-summary">${Icons.svg('edit', { size: 15 })} Write summary</button>
        </div>
        ${day.voiceNotes.length ? `<div class="subtle" style="margin-top:10px">${day.voiceNotes.length} voice note(s) saved today.</div>` : ''}
        ${(day.summary.did || day.summary.learned || day.summary.struggled) ? `<div class="callout" style="margin-top:10px">${esc(day.summary.did || day.summary.learned || day.summary.struggled)}</div>` : ''}
      </div>

      <div class="card">
        <h3>Predictive plan — tomorrow</h3>
        ${pred.plans.map((p, i) => `<div class="callout" style="margin-top:${i ? 8 : 0}px">${Icons.svg('target', { size: 15 })}<span>${esc(p.text)}</span></div>`).join('')}
      </div>

      <div class="card" data-act="nav:goals" style="cursor:pointer">
        <h3>Your goals <span class="pill">view all</span></h3>
        <p class="subtle" style="margin:0">${s.buildFramework.goal ? esc(s.buildFramework.goal) : 'Set what every call is ultimately for.'}</p>
      </div>
    </section>`;
  }

  function twoWeekFocusCard() {
    const s = S.get();
    const items = s.twoWeekFocus || [];
    const done = items.filter((f) => f.done).length;
    return `<div class="card">
      <h3>Two-Week Focus <span class="pill">${done}/${items.length}</span></h3>
      <p class="subtle" style="margin:0 0 10px">Your priorities for the next two weeks — not tied to any single day.</p>
      ${items.map((f) => `
        <div class="focus-item ${f.done ? 'done' : ''}" data-act="twfocus:${f.id}">
          <div class="check ${f.done ? 'done' : ''}">${f.done ? Icons.svg('check', { size: 12 }) : ''}</div>
          <div class="txt">${esc(f.text)}</div>
          <button class="icon-btn sm" data-act="twfocus-del:${f.id}" title="Remove" style="flex:0 0 auto">${Icons.svg('close', { size: 13 })}</button>
        </div>`).join('') || '<p class="subtle" style="margin:8px 0">No priorities set yet.</p>'}
      <button class="btn ghost sm" data-act="add-twfocus" style="margin-top:12px">${Icons.svg('plus', { size: 14 })} Add priority</button>
    </div>`;
  }

  function numberRow(m, day) {
    const s = S.get(); const val = day.numbers[m.key] || 0; const tgt = s.targets[m.key] ?? m.target;
    const pct = Math.min(100, tgt ? Math.round((val / tgt) * 100) : 0);
    const over = val >= tgt && tgt > 0;
    return `<div class="num-row">
      <div class="label"><div class="l">${esc(m.label)}</div>
        <div class="track"><div class="fill ${over ? 'over' : ''}" style="width:${pct}%"></div></div></div>
      <div class="stepper">
        <button class="minus" data-act="num:${m.key}:-">${Icons.svg('minus', { size: 13 })}</button>
        <div class="val">${val}<span class="t">/${tgt}</span></div>
        <button data-act="num:${m.key}:+">${Icons.svg('plus', { size: 13 })}</button>
      </div></div>`;
  }

  // ---- traffic-light pace color, used by the funnel below ----
  function paceColor(pct) { return pct >= 75 ? 'var(--pace-green)' : pct >= 45 ? 'var(--pace-amber)' : 'var(--pace-red)'; }

  // Small 4-point trend line (oldest -> newest week), colored by the
  // latest value so it reads at a glance alongside a status tag.
  function sparkline(values, opt) {
    opt = opt || {};
    const w = opt.width || 64, h = opt.height || 20;
    const vals = (values && values.length ? values : [0]);
    const max = Math.max(...vals, 100);
    const step = w / (vals.length - 1 || 1);
    const points = vals.map((v, i) => `${Math.round(i * step)},${Math.round(h - (Math.max(0, v) / max) * h)}`).join(' ');
    const color = paceColor(vals[vals.length - 1] || 0);
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block;flex:0 0 auto">
      <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  // Symmetric trapezoid clip-path for one funnel segment, given its own
  // top/bottom width as a % of the shape column — top width matches the
  // previous segment's bottom width so adjacent segments share an edge
  // and read as one continuous tapering silhouette, not stacked bars.
  function funnelClip(topPct, bottomPct) {
    const tl = (100 - topPct) / 2, tr = 100 - tl;
    const bl = (100 - bottomPct) / 2, br = 100 - bl;
    return `polygon(${tl}% 0%, ${tr}% 0%, ${br}% 100%, ${bl}% 100%)`;
  }

  function salesFunnelCard() {
    const agg = Intel.aggregate(Intel.rangeKeys('weekly'));
    const funnelKeys = Data.vertical().funnel;
    const stages = funnelKeys.map((key) => {
      const m = agg.metrics[key];
      return { key, label: m.label, actual: m.actual, target: m.target, pace: Intel.metricPace(m) };
    });
    const maxActual = Math.max(...stages.map((s) => s.actual), 1);
    const widths = stages.map((s) => Math.max(10, Math.round((s.actual / maxActual) * 100)));
    const tips = Intel.suggestions(agg);
    const topTip = tips.find((t) => t.tone === 'warn') || tips[0];

    return `<div class="card">
      <h3>Activity Funnel <span class="pill">This week</span></h3>
      <div class="funnel2">
        <div class="funnel2-shape">
          ${stages.map((s, i) => {
            const top = widths[i], bottom = i < stages.length - 1 ? widths[i + 1] : widths[i];
            return `<div class="funnel2-seg" style="background:${paceColor(s.pace)};clip-path:${funnelClip(top, bottom)}"></div>`;
          }).join('')}
        </div>
        <div class="funnel2-legend">
          ${stages.map((s) => `<div class="funnel2-row">
            <span class="funnel2-dot" style="background:${paceColor(s.pace)}"></span>
            <span class="funnel2-label">${esc(s.label)}</span>
            <span class="funnel2-count">${s.actual}</span>
            <span class="funnel2-pace" style="color:${paceColor(s.pace)}">${s.pace}%</span>
          </div>`).join('')}
        </div>
      </div>
      ${topTip ? `<div class="callout ${topTip.tone === 'good' ? 'green' : ''}" style="margin-top:14px">${Icons.svg(topTip.tone === 'good' ? 'check' : 'target', { size: 15 })}<span>${esc(topTip.text)}</span></div>` : ''}
    </div>`;
  }

  /* ============================================================
     AGENT — TRACK
     ============================================================ */
  let trackPeriod = 'weekly';
  function viewTrack() {
    const agg = Intel.aggregate(Intel.rangeKeys(trackPeriod));
    const defs = Data.activityDefs(); const outs = Data.outcomeDefs();
    const conv = Intel.conversions(agg);
    const day = S.dayRecord(S.todayKey());
    const tabs = [['daily', 'Daily'], ['weekly', 'Weekly'], ['month', 'Monthly']];
    return `<section class="screen active">
      <div class="card">
        <h3>Log today's numbers <span class="pill">${Data.vertical().label}</span></h3>
        ${defs.map((m) => numberRow(m, day)).join('')}
        <div class="hr"></div>
        <div class="section-title">Outcomes (tap to add)</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${Data.outcomeDefs().map((o) => `<button class="tag ${o.bad ? 'red' : 'gold'}" data-act="outcome:${o.key}">${esc(o.label)} · ${(day.outcomes[o.key] || 0)}</button>`).join('')}
        </div>
      </div>

      <div class="tabs">${tabs.map(([k, l]) => `<button class="${trackPeriod === k ? 'on' : ''}" data-act="track-period:${k}">${l}</button>`).join('')}</div>
      <div class="card" style="display:flex;align-items:center;gap:14px">
        ${ring(agg.pace, 'PACE', { light: true, color: agg.pace >= 85 ? 'var(--green)' : 'var(--gold)' })}
        <div><div style="font-weight:600;font-size:16px">${agg.pace >= 100 ? 'Ahead of pace' : agg.pace >= 85 ? 'On pace' : 'Behind pace'}</div>
        <div class="subtle">Hitting ${agg.pace}% of activity targets over ${Intel.rangeLabel(trackPeriod)}.</div></div>
      </div>

      <div class="card">
        <div class="section-title">Activity</div>
        ${defs.map((d) => { const m = agg.metrics[d.key]; const p = Intel.metricPace(m); const w = Math.min(100, p);
          return `<div class="num-row"><div class="label"><div class="l">${esc(m.label)}</div>
            <div class="track"><div class="fill ${p >= 100 ? 'over' : ''}" style="width:${w}%"></div></div></div>
            <div class="stepper"><div class="val">${m.actual}<span class="t">/${m.target}</span></div>
            <span class="tag ${p >= 100 ? 'green' : p < 70 ? 'red' : 'amber'}" style="min-width:44px;text-align:center">${p}%</span></div></div>`;
        }).join('')}
      </div>

      <div class="card">
        <div class="section-title">Conversion funnel</div>
        ${conv.map((c) => `<div class="kv"><span class="k">${esc(c.from)} → ${esc(c.to)}</span><span class="v">${Math.round(c.rate * 100)}%</span></div>`).join('') || '<p class="subtle">Log more to see conversions.</p>'}
      </div>

      <div class="card">
        <div class="section-title">Outcomes · this period</div>
        ${outs.map((o) => `<div class="kv"><span class="k">${esc(o.label)}</span><span class="v" style="color:${o.bad ? 'var(--clay)' : 'var(--green)'}">${agg.outcomes[o.key].actual}</span></div>`).join('')}
      </div>
    </section>`;
  }

  /* ============================================================
     AGENT — PIPELINE / DATABASE / SPECIAL OPS
     ============================================================ */
  let pipeTab = 'pipeline';
  let pipeSearch = '';
  function viewPipeline() {
    const s = S.get(); const v = Data.vertical();
    const tabs = [['pipeline', 'Pipeline'], ['database', 'Database'], ['special', 'Special Ops']];
    let body = '';
    if (pipeTab === 'pipeline') {
      const active = s.pipeline.filter((p) => !p.stalled).length;
      const stalled = s.pipeline.filter((p) => p.stalled).length;
      const val = s.pipeline.reduce((a, p) => a + (p.value || 0), 0);
      body = `<div class="stat3">
          <div class="s"><div class="v">${active}</div><div class="k">Active</div></div>
          <div class="s red"><div class="v">${stalled}</div><div class="k">Stalled</div></div>
          <div class="s gold"><div class="v">${money(val)}</div><div class="k">${esc(v.valueLabel)}</div></div>
        </div>
        <div class="card">${s.pipeline.map((p) => pipeRow(p)).join('') || emptyState('No ' + v.pipelineNoun + 's yet.')}</div>`;
    } else if (pipeTab === 'database') {
      const q = pipeSearch.trim().toLowerCase();
      const filtered = s.pipeline.filter((p) => !q || (p.name + ' ' + (p.detail || '')).toLowerCase().includes(q));
      body = `<div class="card">
        <p class="subtle" style="margin:0 0 10px">Every prospect you're working, searchable. Tap to update stage or add a note.</p>
        <div class="field-icon" style="margin-bottom:2px">
          ${Icons.svg('search', { size: 15 })}
          <input class="input" id="pipe-search" placeholder="Search by name or detail" value="${esc(pipeSearch)}" oninput="App.pipeSearch(this.value)">
        </div>
        ${filtered.concat([]).sort((a, b) => a.name.localeCompare(b.name)).map((p) => pipeRow(p, true)).join('') || emptyState(q ? 'No matches for "' + pipeSearch + '".' : 'Database is empty.')}
      </div>`;
    } else {
      body = `<div class="card"><p class="subtle" style="margin:0 0 6px">Time-boxed focus campaigns — e.g. expired listings, win-backs, a farm street.</p></div>
        ${s.specialOps.map((op) => specialOpCard(op)).join('') || emptyState('No special operations running.')}
        <button class="btn gold" data-act="add-specialop" style="margin-top:12px">${Icons.svg('plus', { size: 14 })} New special operation</button>`;
    }
    return `<section class="screen active">
      <div class="tabs">${tabs.map(([k, l]) => `<button class="${pipeTab === k ? 'on' : ''}" data-act="pipe-tab:${k}">${l}</button>`).join('')}</div>
      ${body}
      ${pipeTab !== 'special' ? `<button class="btn gold" data-act="add-pipeline" style="margin-top:12px">${Icons.svg('plus', { size: 14 })} Add ${esc(v.pipelineNoun)}</button>` : ''}
    </section>`;
  }

  function pipeRow(p, db) {
    const tone = p.stalled ? 'red' : (/(sold|won|listed|listing)/i.test(p.stage) ? 'green' : '');
    return `<div class="lrow" data-act="edit-pipeline:${p.id}">
      <div class="mono">${initials(p.name)}</div>
      <div class="main"><div class="t">${esc(p.name)}</div><div class="s">${esc(p.detail || '')}</div></div>
      <div class="right"><span class="tag ${tone}">${esc(p.stage)}</span>${p.stalled ? '<div class="subtle" style="font-size:10px;color:var(--clay);margin-top:3px">Stalled</div>' : `<div class="subtle" style="font-size:10px;margin-top:3px">${money(p.value)}</div>`}</div>
    </div>`;
  }

  function specialOpCard(op) {
    const done = op.items.filter((i) => i.done).length;
    return `<div class="card"><h3>${esc(op.title)} <span class="pill">${done}/${op.items.length}</span></h3>
      <p class="subtle" style="margin:0 0 10px">${esc(op.description)}</p>
      ${op.items.map((i) => `<div class="focus-item ${i.done ? 'done' : ''}" data-act="specialop-item:${op.id}:${i.id}">
        <div class="check ${i.done ? 'done' : ''}">${i.done ? Icons.svg('check', { size: 12 }) : ''}</div><div class="txt">${esc(i.name)}</div></div>`).join('')}
      <div class="btn-row" style="margin-top:10px"><button class="btn ghost sm" data-act="specialop-add:${op.id}">${Icons.svg('plus', { size: 14 })} Add target</button></div>
    </div>`;
  }

  /* ============================================================
     AGENT — CRM
     ============================================================ */
  // Disabled for now — the CRM is being rethought as a bigger project
  // than a simple contact list. The rest of the CRM code (data model,
  // sync, the add/edit sheet) is left in place underneath this so it's
  // a one-line flip to bring back, not a rebuild.
  function viewCRM() {
    return `<section class="screen active">
      <div class="card" style="text-align:center;padding:40px 20px">
        ${Icons.svg('user', { size: 28 })}
        <h3 style="margin:14px 0 6px">CRM — Launching soon</h3>
        <p class="subtle" style="margin:0">We're building something bigger than a simple contact list here. Check back soon.</p>
      </div>
    </section>`;
  }

  /* ============================================================
     AGENT — REPORTS
     ============================================================ */
  let reportType = 'weekly';
  function viewReports() {
    const s = S.get();
    const r = Intel.buildReport(reportType);
    const types = [['daily', 'Day'], ['weekly', 'Week'], ['fortnight', 'Fortnight'], ['month', 'Month'], ['quarter', 'QTR'], ['biyear', 'Bi-Year']];
    return `<section class="screen active">
      <div class="tabs">${types.map(([k, l]) => `<button class="${reportType === k ? 'on' : ''}" data-act="report-type:${k}">${l}</button>`).join('')}</div>
      <div class="card dark" style="display:flex;align-items:center;gap:14px">
        ${ring(r.score, '', { color: 'var(--gold)' })}
        <div><div style="font-family:var(--headline);font-size:22px;font-weight:480">${r.title}</div>
        <div class="subtle" style="color:var(--bone-muted)">${r.rangeLabel}</div>
        <div class="subtle" style="margin-top:2px">Auto-shared with ${esc(r.coachName)}</div></div>
      </div>

      <div class="card"><div class="section-title">Activity vs target</div>${weekBarsFor(r.agg)}</div>

      <div class="card"><div class="section-title">What's working</div>
        <ul class="list-plain">${r.working.map((w) => `<li><span class="mk">${Icons.svg('check', { size: 14 })}</span><span>${esc(w)}</span></li>`).join('') || '<li class="subtle">Keep logging to surface wins.</li>'}</ul>
      </div>
      <div class="card"><div class="section-title">Areas to improve</div>
        <ul class="list-plain">${r.improve.map((w) => `<li><span class="mk warn">${Icons.svg('target', { size: 14 })}</span><span>${esc(w)}</span></li>`).join('') || '<li class="subtle">Nothing flagged — strong period.</li>'}</ul>
      </div>

      <div class="btn-row" style="margin-top:14px">
        <button class="btn gold" data-act="send-report">Send to ${esc(r.coachName)}</button>
        <button class="btn outline" data-act="copy-report">Copy</button>
        <button class="btn outline" data-act="pdf-report">${Icons.svg('file', { size: 14 })} PDF</button>
      </div>
      <p class="subtle" style="text-align:center;margin-top:10px">Daily, weekly, fortnight, month, QTR & bi-year — generated from your logged inputs.</p>
    </section>`;
  }

  function weekBarsFor(agg) {
    const defs = Data.activityDefs();
    const max = Math.max(...defs.map((d) => Math.max(agg.metrics[d.key].actual, agg.metrics[d.key].target, 1)));
    return `<div class="bars">${defs.map((d) => {
      const m = agg.metrics[d.key]; const h = Math.round((m.actual / max) * 100);
      const cls = m.actual >= m.target ? 'over' : (m.actual < m.target * 0.7 ? 'under' : '');
      return `<div class="bar"><div class="n">${m.actual}</div><div class="col ${cls}" style="height:${Math.max(6, h)}%"></div><div class="lbl">${esc(d.short)}</div></div>`;
    }).join('')}</div>`;
  }

  /* ============================================================
     AGENT — GOALS
     ============================================================ */
  function viewGoals() {
    const s = S.get(); const bf = s.buildFramework;
    return `<section class="screen active">
      <div class="card"><h3>Build the best consultant</h3>
        <div class="kv"><span class="k">Goal</span><span class="v" style="text-align:right;max-width:60%">${esc(bf.goal || '—')}</span></div>
        <div class="kv"><span class="k">Proof</span><span class="v" style="text-align:right;max-width:60%">${esc(bf.proof || '—')}</span></div>
        <div class="section-title" style="margin-top:12px">Steps</div>
        <ul class="list-plain">${(bf.steps || []).map((st) => `<li><span class="mk">${Icons.svg('check', { size: 14 })}</span><span>${esc(st)}</span></li>`).join('') || '<li class="subtle">No steps yet.</li>'}</ul>
        <button class="btn outline sm" data-act="edit-build" style="margin-top:10px">Edit framework</button>
      </div>
      <div class="card"><h3>Your goals <button class="btn gold sm" data-act="add-goal">${Icons.svg('plus', { size: 14 })} Add</button></h3>
        <div class="grid2">${s.goals.map((g) => `<div class="goalcard" data-act="edit-goal:${g.id}">
          <div class="cat">${esc(g.category)}</div><div class="ti">${esc(g.title)}</div><div class="de">${esc(g.detail || '')}</div></div>`).join('')}</div>
      </div>
      <p class="subtle" style="text-align:center;margin-top:12px">What every call is ultimately for.</p>
    </section>`;
  }

  /* ============================================================
     COACH VIEWS
     ============================================================ */
  function coachDashboard() {
    const s = S.get(); const r = s.coachRoster;
    if (!r.length) return coachEmptyState();
    const onTrack = r.filter((c) => c.status === 'On track').length;
    const atRisk = r.filter((c) => c.status === 'At risk').length;
    const checkins = r.filter((c) => /Today/.test(c.last)).length;
    return `<section class="screen active">
      <div class="grid2">
        <div class="card" style="margin-top:0"><div class="section-title">Active clients</div><div style="font-size:26px;font-family:var(--mono);font-weight:500">${r.length}</div></div>
        <div class="card" style="margin-top:0"><div class="section-title">On track</div><div style="font-size:26px;font-family:var(--mono);font-weight:500;color:var(--green)">${onTrack}</div></div>
        <div class="card" style="margin-top:0"><div class="section-title">At risk</div><div style="font-size:26px;font-family:var(--mono);font-weight:500;color:var(--clay)">${atRisk}</div></div>
        <div class="card" style="margin-top:0"><div class="section-title">Check-ins today</div><div style="font-size:26px;font-family:var(--mono);font-weight:500">${checkins}/${r.length}</div></div>
      </div>
      <div class="btn-row" style="margin:14px 0">
        <button class="btn outline" data-act="sent-reports">${Icons.svg('file', { size: 14 })} Sent reports</button>
        <button class="btn gold" data-act="bulk-reports">${Icons.svg('bell', { size: 14 })} Send today's reports</button>
      </div>
      <div class="card"><h3>Your clients <span class="pill">tap to drill in</span></h3>
        ${r.map((c) => {
          const tone = c.status === 'On track' ? 'green' : c.status === 'At risk' ? 'red' : 'amber';
          return `<div class="lrow" data-act="coach-client:${esc(c.id)}">
            <div class="mono">${initials(c.name)}</div>
            <div class="main"><div class="t">${esc(c.name)}</div><div class="s">${esc(c.type)} · ${esc(c.last)} · ${c.streak}d</div></div>
            ${sparkline(c.paceTrend)}
            <div class="right"><span class="tag ${tone}">${esc(c.status)}</span><div class="subtle" style="font-size:11px;margin-top:3px">${c.pace}%</div></div>
          </div>`;
        }).join('')}
      </div>
    </section>`;
  }

  const CLIENT_SORTS = {
    'pace-desc': { label: 'Pace (high→low)', fn: (a, b) => b.pace - a.pace },
    'pace-asc': { label: 'Pace (low→high)', fn: (a, b) => a.pace - b.pace },
    'streak-desc': { label: 'Streak (longest)', fn: (a, b) => b.streak - a.streak },
    'name': { label: 'Name (A→Z)', fn: (a, b) => a.name.localeCompare(b.name) },
  };
  const CLIENT_STATUSES = ['All', 'On track', 'Watch', 'At risk'];

  function coachClients() {
    const s = S.get();
    if (!s.coachRoster.length) return coachEmptyState();
    const q = clientSearch.trim().toLowerCase();
    const filtered = s.coachRoster.filter((c) =>
      (!q || c.name.toLowerCase().includes(q)) &&
      (clientStatusFilter === 'All' || c.status === clientStatusFilter));
    const list = [...filtered].sort((CLIENT_SORTS[clientSort] || CLIENT_SORTS['pace-desc']).fn);
    return `<section class="screen active">
      <div class="card">
        <div class="field-icon" style="margin-bottom:10px">
          ${Icons.svg('search', { size: 15 })}
          <input class="input" id="client-search" placeholder="Search by name" value="${esc(clientSearch)}" oninput="App.clientSearch(this.value)">
        </div>
        <div class="tabs" style="margin-bottom:10px">${CLIENT_STATUSES.map((st) => `<button class="${clientStatusFilter === st ? 'on' : ''}" data-act="client-filter:${st}">${st}</button>`).join('')}</div>
        <select class="input" id="client-sort" onchange="App.clientSort(this.value)">${Object.keys(CLIENT_SORTS).map((k) => `<option value="${k}" ${k === clientSort ? 'selected' : ''}>${CLIENT_SORTS[k].label}</option>`).join('')}</select>
      </div>
      ${list.map((c) => `<div class="card" style="display:flex;align-items:center;gap:12px" data-act="coach-client:${esc(c.id)}">
        <div class="avatar lg">${initials(c.name)}</div>
        <div style="flex:1"><div style="font-weight:600">${esc(c.name)}</div><div class="subtle">${esc(c.type)} · ${c.pace}% pace · ${c.streak}-day streak</div></div>
        ${sparkline(c.paceTrend)}
        <span class="tag ${c.status === 'On track' ? 'green' : c.status === 'At risk' ? 'red' : 'amber'}">${esc(c.status)}</span>
      </div>`).join('') || emptyState('No clients match.')}
    </section>`;
  }

  function coachAlerts() {
    const s = S.get();
    if (!s.coachRoster.length) return coachEmptyState();
    return `<section class="screen active">
      <div class="card"><p class="subtle" style="margin:0">Flagged automatically from pace and check-ins.</p></div>
      ${(s.demoAlerts || []).length ? s.demoAlerts.map((a) => `<div class="card" style="display:flex;align-items:center;gap:10px">
        <span class="rec-dot" style="background:${a.tone === 'green' ? 'var(--green)' : a.tone === 'amber' ? 'var(--amber)' : 'var(--clay)'};animation:none"></span>
        <div style="flex:1"><div style="font-weight:600">${esc(a.name)} <span class="tag ${a.tone === 'green' ? 'green' : a.tone === 'amber' ? 'amber' : 'red'}" style="margin-left:4px">${esc(a.kind)}</span></div>
        <div class="subtle">${esc(a.text)}</div></div>
        <button class="btn outline sm" data-act="coach-client:${esc(a.id)}">Review</button>
      </div>`).join('') : emptyState('No alerts — everyone is on track.')}
    </section>`;
  }

  function coachEmptyState() {
    const s = S.get();
    return `<section class="screen active">
      <div class="card" style="text-align:center;padding:32px 20px">
        ${Icons.svg('users', { size: 28 })}
        <h3 style="margin:12px 0 6px">No consultants linked yet</h3>
        <p class="subtle" style="margin:0 0 14px">Share your coach code so consultants can join your roster.</p>
        <div class="kv" style="justify-content:center;gap:8px"><span class="tag gold" style="font-family:var(--mono);font-size:15px;padding:6px 14px">${esc(s.profile.coachCode || '—')}</span></div>
      </div>
    </section>`;
  }

  /* ============================================================
     helpers
     ============================================================ */
  function greeting() { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }
  function nowTime() { return new Date().toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }); }
  function money(n) { n = n || 0; if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'm'; if (n >= 1e3) return '$' + Math.round(n / 1e3) + 'k'; return '$' + n; }
  function emptyState(msg) { return `<div class="empty">${Icons.svg('inbox', { size: 26 })}${esc(msg)}</div>`; }
  function coachNudge(pace, calls) {
    const left = Math.max(0, calls.target - calls.done);
    if (pace >= 100) return `You're over target already — bank it, then get one more appraisal booked before you switch off.`;
    if (left > 0) return `You're at ${pace}% of today with ${left} calls to go. Two 25-minute blocks clears it — protect 2:00 and 4:00.`;
    return `Calls done. Now convert — follow up two warm ones before the day closes.`;
  }

  global.UI = {
    render, renderOnboarding, toast, openSheet, closeSheet,
    get current() { return current; }, set current(v) { current = v; },
    get coachView() { return coachView; }, set coachView(v) { coachView = v; },
    get onbStep() { return onbStep; }, set onbStep(v) { onbStep = v; },
    get authMode() { return authMode; }, set authMode(v) { authMode = v; },
    get authError() { return authError; }, set authError(v) { authError = v; },
    get authInfo() { return authInfo; }, set authInfo(v) { authInfo = v; },
    get pipeTab() { return pipeTab; }, set pipeTab(v) { pipeTab = v; },
    get pipeSearch() { return pipeSearch; }, set pipeSearch(v) { pipeSearch = v; },
    get trackPeriod() { return trackPeriod; }, set trackPeriod(v) { trackPeriod = v; },
    get clientSearch() { return clientSearch; }, set clientSearch(v) { clientSearch = v; },
    get clientStatusFilter() { return clientStatusFilter; }, set clientStatusFilter(v) { clientStatusFilter = v; },
    get clientSort() { return clientSort; }, set clientSort(v) { clientSort = v; },
    get reportType() { return reportType; }, set reportType(v) { reportType = v; },
    get onbTmp() { return onbTmp; },
    captureOnb, finishOnboarding, clearOnbDraft, initials, esc, money, ring, sparkline,
  };
})(window);
