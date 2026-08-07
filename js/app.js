/* ============================================================
   ELITE TRACKER — app.js
   Init, event delegation, forms, voice notes, backup, reminders.
   ============================================================ */
(function (global) {
  'use strict';
  const S = global.Store, Data = global.Data, Intel = global.Intel, UI = global.UI;
  const $ = (id) => document.getElementById(id);

  /* ---------- PWA ---------- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
  let installPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; });

  /* ---------- theme ---------- */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f2f3f6' : '#0b1426');
  }
  function toggleTheme() {
    const s = S.get();
    s.settings.theme = s.settings.theme === 'light' ? 'dark' : 'light';
    S.save(); applyTheme(s.settings.theme); rerender();
  }

  /* ---------- init ---------- */
  S.load();
  applyTheme(S.get().settings.theme || 'light');
  document.addEventListener('DOMContentLoaded', boot);
  if (document.readyState !== 'loading') boot();
  let booted = false;
  async function boot() {
    if (booted) return; booted = true;
    await Auth.init();
    Auth.onChange(async () => { await syncForSession(); UI.render(); });
    await syncForSession();
    UI.render();
    scheduleReminders();
    if ('Notification' in window && Notification.permission === 'granted' && global.Push) Push.subscribe();
  }

  /* Local storage isn't scoped per-user — it's one shared cache for
     whichever account is currently signed in on this browser. Two
     things have to happen whenever the signed-in uid changes:
       1. if a DIFFERENT account's data is sitting in that cache,
          wipe it first, or the new session renders with the old
          user's onboarding state / roster / numbers still attached.
       2. pull that account's real rows down from Supabase — a login
          (as opposed to a fresh page load, which boot() already
          covered) never fetched them otherwise, so a returning user
          logging in on a new device would fall through to onboarding
          despite already having a real, onboarded account.
     Idempotent by design (keyed off Store.lastUid()) so it's safe to
     call from both boot() and the post-login/OAuth-redirect path
     without double-pulling. */
  async function syncForSession() {
    const session = Auth.getSession();
    if (!session) return;
    if (S.lastUid() !== session.id) {
      if (S.lastUid()) { S.reset(); UI.clearOnbDraft(); }
      S.setLastUid(session.id);
      try { await Sync.pull(); } catch (e) { console.warn('sync pull failed', e); }
      return;
    }
    // Same session as last boot — pull() above already covered a fresh
    // login, but a coach's roster can change at any time from an agent's
    // side (a new agent links, or an existing one hasn't been re-fetched
    // in a while) with nothing local to signal that. Refresh it every
    // boot; see Sync.refreshRoster for why this is safe to do eagerly.
    await Sync.refreshRoster();
  }

  /* ---------- event delegation ---------- */
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const act = t.getAttribute('data-act');
    if (t.hasAttribute('disabled')) return;
    handle(act, t, e);
  });

  // backdrop closes sheet
  document.getElementById('sheet-backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'sheet-backdrop') UI.closeSheet();
  });

  function rerender() { S.save(); UI.render(); }

  function handle(act, el, e) {
    const [cmd, a, b] = act.split(':');

    // ---- auth ----
    if (cmd === 'auth-mode') { UI.authMode = a; UI.authError = ''; UI.authInfo = ''; UI.renderOnboarding(); return; }
    if (cmd === 'auth-forgot') { UI.toast('Password reset needs a backend — coming soon.'); return; }
    if (cmd === 'auth-google') return authGoogle(el);
    if (cmd === 'auth-submit') return authSubmit(el);
    if (cmd === 'log-out') return logOut();

    // ---- onboarding ----
    if (cmd === 'onb-role') { UI.onbTmp.role = a; UI.onbStep = 0; UI.renderOnboarding(); return; }
    if (cmd === 'onb-vert') { UI.onbTmp.vertical = a; UI.renderOnboarding(); return; }
    if (cmd === 'onb-next') { UI.captureOnb(); UI.onbStep = UI.onbStep + 1; UI.renderOnboarding(); return; }
    if (cmd === 'onb-back') {
      UI.captureOnb();
      if (UI.onbStep === 0) UI.onbTmp.role = null; else UI.onbStep = UI.onbStep - 1;
      UI.renderOnboarding(); return;
    }
    if (cmd === 'onb-finish') { UI.finishOnboarding(); return; }

    // ---- navigation ----
    if (cmd === 'nav') { UI.current = a; rerender(); return; }
    if (cmd === 'cnav') { UI.coachView = a; rerender(); return; }
    if (cmd === 'toggle-theme') return toggleTheme();

    // ---- menu ----
    if (cmd === 'open-menu') return openMenu();
    if (cmd === 'close-sheet') return UI.closeSheet();

    // ---- focus / to-do ----
    if (cmd === 'focus') { const d = S.dayRecord(); const f = d.focus.find((x) => x.id === a); if (f) f.done = !f.done; rerender(); return; }
    if (cmd === 'add-focus') return addFocusSheet();

    // ---- two-week focus ----
    if (cmd === 'twfocus') { const s = S.get(); const f = (s.twoWeekFocus || []).find((x) => x.id === a); if (f) f.done = !f.done; rerender(); return; }
    if (cmd === 'twfocus-del') { e.stopPropagation(); const s = S.get(); s.twoWeekFocus = (s.twoWeekFocus || []).filter((x) => x.id !== a); rerender(); return; }
    if (cmd === 'add-twfocus') return addTwoWeekFocusSheet();
    if (cmd === 'eod-review') return eodReview();

    // ---- number logging ----
    if (cmd === 'num') { stepNumber(a, b === '+' ? 1 : -1); return; }
    if (cmd === 'outcome') return outcomeSheet(a);

    // ---- summary / voice ----
    if (cmd === 'daily-log') return dailyLogSheet();
    if (cmd === 'open-summary') return summarySheet();
    if (cmd === 'open-voice') return voiceSheet();
    if (cmd === 'rec-start') return startRecording();
    if (cmd === 'rec-stop') return stopRecording();
    if (cmd === 'vn-play') return playVoice(a);
    if (cmd === 'vn-del') return delVoice(a);

    // ---- tracker ----
    if (cmd === 'tracker-period') { UI.trackerPeriod = a; rerender(); return; }

    // ---- pipeline ----
    if (cmd === 'add-pipeline') return pipelineSheet(null);
    if (cmd === 'edit-pipeline') return pipelineSheet(a);
    if (cmd === 'add-specialop') return specialOpSheet();
    if (cmd === 'specialop-item') { toggleOpItem(a, b); return; }
    if (cmd === 'specialop-add') return opItemSheet(a);

    // ---- crm ----
    // No UI currently calls these — the CRM tab was removed from nav (it's
    // being rethought as a bigger project than a simple contact list). The
    // data model, sync, and this add/edit sheet are left in place so bringing
    // it back is a routing change, not a rebuild.
    if (cmd === 'add-crm') return crmSheet(null);
    if (cmd === 'edit-crm') return crmSheet(a);
    if (cmd === 'crm-done') { e.stopPropagation(); return crmDone(a); }

    // ---- goals / build ----
    if (cmd === 'edit-build') return buildSheet();
    if (cmd === 'add-goal') return goalSheet(null);
    if (cmd === 'edit-goal') return goalSheet(a);

    // ---- coach ----
    if (cmd === 'coach-client') return coachClientSheet(a);
    if (cmd === 'client-filter') { UI.clientStatusFilter = a; rerender(); return; }
    if (cmd === 'sent-reports') return sentReportsSheet();
    if (cmd === 'bulk-reports') return bulkReportsSheet();

    // ---- settings ----
    if (cmd === 'toggle-setting') return toggleSetting(a);
    if (cmd === 'save-settings') return saveSettings();
    if (cmd === 'enable-reminders') return enableReminders();
    if (cmd === 'export-ics') return exportICS();
    if (cmd === 'focus-to-calendar') return exportFocusICS();
    if (cmd === 'install-app') return doInstall();
    if (cmd === 'reset-app') return resetApp();
  }

  /* ---------- auth ---------- */
  async function authSubmit(btn) {
    const isSignup = UI.authMode === 'signup';
    const email = ($('auth-email') || {}).value || '';
    const password = ($('auth-password') || {}).value || '';
    if (btn) { btn.setAttribute('disabled', ''); btn.style.opacity = '.6'; btn.textContent = isSignup ? 'Creating account…' : 'Logging in…'; }
    const result = isSignup
      ? await Auth.signUpEmail(($('auth-name') || {}).value || '', email, password)
      : await Auth.signInEmail(email, password);
    if (result.error) {
      UI.authError = result.error; UI.renderOnboarding(); return;
    }
    if (result.needsConfirmation) {
      UI.authError = '';
      UI.authMode = 'login';
      UI.authInfo = `Check ${result.email} for a link to confirm your account, then log in here.`;
      UI.renderOnboarding();
      return;
    }
    UI.authError = ''; UI.authInfo = '';
    if (isSignup && !UI.onbTmp.name) UI.onbTmp.name = result.user.name;
    await syncForSession();
    UI.render();
  }
  async function authGoogle(btn) {
    if (btn) { btn.setAttribute('disabled', ''); btn.style.opacity = '.6'; }
    const result = await Auth.signInGoogle();
    if (result && result.error) {
      if (btn) { btn.removeAttribute('disabled'); btn.style.opacity = ''; }
      UI.authError = result.error; UI.renderOnboarding(); return;
    }
    // Success means the browser is already navigating to Google — nothing
    // else to do here; onAuthStateChange picks up the session on return.
  }
  async function logOut() {
    UI.closeSheet();
    await Auth.signOut();
    UI.authMode = 'login';
    UI.authError = '';
    UI.clearOnbDraft();
    UI.render();
    UI.toast('Logged out');
  }

  /* ---------- number stepper ---------- */
  function stepNumber(key, delta) {
    const d = S.dayRecord();
    d.numbers[key] = Math.max(0, (d.numbers[key] || 0) + delta);
    d.logged = true;
    S.save();
    // light re-render of today only
    UI.render();
  }

  function outcomeSheet(key) {
    const def = Data.outcomeDefs().find((o) => o.key === key);
    const d = S.dayRecord();
    UI.openSheet(`<h3>${UI.esc(def.label)}</h3>
      <p class="subtle">How many today?</p>
      <div class="stepper" style="justify-content:center;gap:16px;margin:16px 0">
        <button class="minus" data-act="outnum:${key}:-">${Icons.svg('minus', { size: 14 })}</button>
        <div class="val" id="out-val" style="font-size:26px">${d.outcomes[key] || 0}</div>
        <button data-act="outnum:${key}:+">${Icons.svg('plus', { size: 14 })}</button>
      </div>
      <button class="btn gold" data-act="close-sheet">Done</button>`);
    // local handlers for outnum — also rerender the screen behind the sheet
    // (not just the sheet's own counter), otherwise the outcome tag's count
    // stays stale until some unrelated action happens to trigger a render.
    $('sheet').querySelectorAll('[data-act^="outnum:"]').forEach((btn) => btn.addEventListener('click', () => {
      const [, k, sign] = btn.getAttribute('data-act').split(':');
      d.outcomes[k] = Math.max(0, (d.outcomes[k] || 0) + (sign === '+' ? 1 : -1));
      $('out-val').textContent = d.outcomes[k]; rerender();
    }));
  }

  /* ---------- focus add + EOD ---------- */
  function addFocusSheet() {
    UI.openSheet(`<h3>Add a focus task</h3>
      <div class="field"><label>Task</label><input class="input" id="ft-text" placeholder="e.g. Call expired listings"></div>
      <div class="field"><label>Time (optional)</label><input class="input" id="ft-time" placeholder="e.g. 10:00"></div>
      <div class="btn-row"><button class="btn outline" data-act="close-sheet">Cancel</button>
      <button class="btn gold" id="ft-save">Add task</button></div>`);
    $('ft-save').addEventListener('click', () => {
      const text = $('ft-text').value.trim(); if (!text) return;
      S.dayRecord().focus.push({ id: 'f' + S.uid(), text, time: $('ft-time').value.trim(), done: false });
      UI.closeSheet(); rerender(); UI.toast('Task added');
    });
  }

  function addTwoWeekFocusSheet() {
    UI.openSheet(`<h3>Add a priority</h3>
      <p class="subtle">A goal for the next two weeks — not a daily task.</p>
      <div class="field" style="margin-top:12px"><label>Priority</label><input class="input" id="twf-text" placeholder="e.g. Close the Marsh St listing"></div>
      <div class="btn-row"><button class="btn outline" data-act="close-sheet">Cancel</button>
      <button class="btn gold" id="twf-save">Add</button></div>`);
    $('twf-save').addEventListener('click', () => {
      const text = $('twf-text').value.trim(); if (!text) return;
      const s = S.get();
      s.twoWeekFocus = s.twoWeekFocus || [];
      s.twoWeekFocus.push({ id: 'twf' + S.uid(), text, done: false });
      UI.closeSheet(); rerender(); UI.toast('Priority added');
    });
  }

  function eodReview() {
    const d = S.dayRecord(); const pace = Intel.todayPace();
    const done = d.focus.filter((f) => f.done).length;
    UI.openSheet(`<h3>End-of-day review</h3>
      <div class="callout">${Icons.svg('target', { size: 15 })}<span>You hit <b>${pace}%</b> of today's numbers and completed <b>${done}/${d.focus.length}</b> focus tasks.</span></div>
      <div class="field" style="margin-top:14px"><label>What did you do well?</label><textarea class="textarea" id="eod-did">${UI.esc(d.summary.did)}</textarea></div>
      <div class="field"><label>What did you learn?</label><textarea class="textarea" id="eod-learned">${UI.esc(d.summary.learned)}</textarea></div>
      <div class="field"><label>Where did you struggle?</label><textarea class="textarea" id="eod-struggled">${UI.esc(d.summary.struggled)}</textarea></div>
      <button class="btn gold" id="eod-save">Complete review & send to coach</button>`);
    $('eod-save').addEventListener('click', () => {
      d.summary = { did: $('eod-did').value, learned: $('eod-learned').value, struggled: $('eod-struggled').value };
      d.reviewedEOD = true; S.save();
      // build & log a daily report
      const r = Intel.buildReport('daily');
      S.get().reportsLog.unshift({ id: S.uid(), type: 'daily', rangeLabel: r.rangeLabel, date: Date.now(), score: r.score });
      S.save();
      UI.closeSheet(); UI.render(); UI.toast('Day reviewed · daily report sent to ' + S.get().profile.coachName);
    });
  }

  /* ---------- daily log entry point (central mic button) ---------- */
  function dailyLogSheet() {
    UI.openSheet(`<h3>Daily log</h3>
      <p class="subtle">Capture today in whichever way's fastest right now.</p>
      <button class="choice icon-row" data-act="open-voice">${Icons.svg('mic', { size: 17 })}<span>Record a voice note</span></button>
      <button class="choice icon-row" data-act="open-summary">${Icons.svg('edit', { size: 17 })}<span>Write a summary</span></button>`);
  }

  /* ---------- summary ---------- */
  function summarySheet() {
    const d = S.dayRecord();
    UI.openSheet(`<h3>Daily summary</h3>
      <div class="field"><label>What did we do?</label><textarea class="textarea" id="sm-did">${UI.esc(d.summary.did)}</textarea></div>
      <div class="field"><label>What did we learn?</label><textarea class="textarea" id="sm-learned">${UI.esc(d.summary.learned)}</textarea></div>
      <div class="field"><label>Where did we struggle?</label><textarea class="textarea" id="sm-struggled">${UI.esc(d.summary.struggled)}</textarea></div>
      <button class="btn gold" id="sm-save">Save summary</button>`);
    $('sm-save').addEventListener('click', () => {
      d.summary = { did: $('sm-did').value, learned: $('sm-learned').value, struggled: $('sm-struggled').value };
      S.save(); UI.closeSheet(); UI.render(); UI.toast('Summary saved');
    });
  }

  /* ---------- voice notes ---------- */
  let mediaRecorder = null, chunks = [], recTimer = null, recSecs = 0;
  function voiceSheet() {
    const d = S.dayRecord();
    UI.openSheet(`<h3>Voice notes</h3>
      <p class="subtle">One quick note — what did you do, learn, struggle with. Syncs to your coach in the background; transcription & auto-summary are next.</p>
      <div id="rec-ui" style="text-align:center;margin:18px 0">
        <button class="btn gold" id="rec-btn" data-act="rec-start">${Icons.svg('mic', { size: 15 })} Start recording</button>
        <div id="rec-time" class="subtle" style="margin-top:8px"></div>
      </div>
      <div class="section-title">Today's notes</div>
      <div id="vn-list">${voiceListHtml(d)}</div>`);
    wireVoiceList();
  }
  function voiceListHtml(d) {
    if (!d.voiceNotes.length) return '<p class="subtle">No voice notes yet.</p>';
    return d.voiceNotes.map((v) => `<div class="vn">
      <div class="play" data-act="vn-play:${v.id}">${Icons.svg('play', { size: 13 })}</div>
      <div style="flex:1"><div style="font-weight:600;font-size:13px">Voice note</div>
      <div class="subtle" style="font-size:11px">${new Date(v.ts).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })} · ${v.durationSec || 0}s</div></div>
      <button class="tag red" data-act="vn-del:${v.id}">Delete</button></div>`).join('');
  }
  function wireVoiceList() {
    // handled by global delegation (vn-play / vn-del / rec-start)
  }
  async function startRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { UI.toast('Recording not supported on this browser'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream); chunks = [];
      mediaRecorder.ondataavailable = (ev) => chunks.push(ev.data);
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' });
        const id = S.uid(); await S.putAudio(id, blob);
        const d = S.dayRecord(); d.voiceNotes.push({ id, ts: Date.now(), durationSec: recSecs, storagePath: null }); S.save();
        stream.getTracks().forEach((tr) => tr.stop());
        const list = $('vn-list'); if (list) list.innerHTML = voiceListHtml(d);
        UI.toast('Voice note saved');
        uploadVoiceNote(id, blob);
      };
      mediaRecorder.start(); recSecs = 0;
      const btn = $('rec-btn'); if (btn) { btn.innerHTML = Icons.svg('stop', { size: 15 }) + ' Stop recording'; btn.setAttribute('data-act', 'rec-stop'); }
      recTimer = setInterval(() => { recSecs++; const t = $('rec-time'); if (t) t.innerHTML = `<span class="rec-dot"></span> Recording ${recSecs}s`; }, 1000);
    } catch (err) { UI.toast('Mic permission denied'); }
  }
  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    clearInterval(recTimer);
    const btn = $('rec-btn'); if (btn) { btn.innerHTML = Icons.svg('mic', { size: 15 }) + ' Start recording'; btn.setAttribute('data-act', 'rec-start'); }
    const t = $('rec-time'); if (t) t.textContent = '';
  }
  // Fire-and-forget, same pattern as sync.js's push(): the recording is
  // already safe locally (IndexedDB) either way, so a failed upload just
  // means it stays device-only until the next successful attempt — there's
  // no local mutation here to retry from, so on failure it's dropped rather
  // than left half-set (a storagePath must mean the object really exists,
  // since sync.js's push() takes its presence as "safe to upsert into
  // voice_notes").
  async function uploadVoiceNote(id, blob) {
    const c = global.Supa && Supa.getClient(); const session = global.Auth && Auth.getSession();
    if (!c || !session) return;
    const ext = (blob.type.split('/')[1] || 'webm').split(';')[0];
    const path = `${session.id}/${id}.${ext}`;
    const { error } = await c.storage.from('voice-notes').upload(path, blob, { contentType: blob.type });
    if (error) { console.warn('voice note upload failed', error); return; }
    const d = S.dayRecord(); const v = (d.voiceNotes || []).find((x) => x.id === id);
    if (v) { v.storagePath = path; S.save(); }
  }
  async function playVoice(id) {
    let blob = await S.getAudio(id);
    if (!blob) {
      const d = S.dayRecord(); const v = (d.voiceNotes || []).find((x) => x.id === id);
      const c = global.Supa && Supa.getClient();
      if (v && v.storagePath && c) {
        const { data, error } = await c.storage.from('voice-notes').download(v.storagePath);
        if (!error && data) { blob = data; S.putAudio(id, blob); }
      }
    }
    if (!blob) { UI.toast('Audio not found'); return; }
    const url = URL.createObjectURL(blob); const audio = new Audio(url); audio.play();
    audio.onended = () => URL.revokeObjectURL(url);
  }
  async function delVoice(id) {
    const d = S.dayRecord(); const v = (d.voiceNotes || []).find((x) => x.id === id);
    await S.delAudio(id);
    const c = global.Supa && Supa.getClient();
    if (v && v.storagePath && c) {
      c.storage.from('voice-notes').remove([v.storagePath]).catch(() => {});
      c.from('voice_notes').delete().eq('id', id).catch(() => {});
    }
    d.voiceNotes = d.voiceNotes.filter((x) => x.id !== id); S.save();
    const list = $('vn-list'); if (list) list.innerHTML = voiceListHtml(d); UI.toast('Deleted');
  }

  /* ---------- pipeline forms ---------- */
  function pipelineSheet(id) {
    const s = S.get(); const v = Data.vertical();
    const p = id ? s.pipeline.find((x) => x.id === id) : { name: '', businessName: '', phone: '', email: '', detail: '', stage: v.pipelineStages[0], value: 0, sellingMonth: '', stalled: false };
    UI.openSheet(`<h3>${id ? 'Edit' : 'Add'} ${UI.esc(v.pipelineNoun)}</h3>
      <div class="field"><label>Business name (optional)</label><input class="input" id="p-business" value="${UI.esc(p.businessName || '')}" placeholder="e.g. Whitfield Realty"></div>
      <div class="field"><label>Name</label><input class="input" id="p-name" value="${UI.esc(p.name)}" placeholder="${v.pipelineNoun === 'vendor' ? 'Owner name' : 'Company / contact'}"></div>
      <div class="field"><label>Detail</label><input class="input" id="p-detail" value="${UI.esc(p.detail)}" placeholder="${v.pipelineNoun === 'vendor' ? 'Address' : 'Dept / size'}"></div>
      <div class="grid2">
        <div class="field"><label>Phone</label><input class="input" id="p-phone" type="tel" value="${UI.esc(p.phone || '')}" placeholder="04xx xxx xxx"></div>
        <div class="field"><label>Email</label><input class="input" id="p-email" type="email" value="${UI.esc(p.email || '')}" placeholder="name@email.com"></div>
      </div>
      <div class="field"><label>Stage</label><select class="input" id="p-stage">${v.pipelineStages.map((st) => `<option ${st === p.stage ? 'selected' : ''}>${st}</option>`).join('')}</select></div>
      <div class="grid2">
        <div class="field"><label>${UI.esc(v.valueLabel)} ($)</label><input class="input" id="p-value" type="number" inputmode="numeric" value="${p.value || 0}"></div>
        <div class="field"><label>Target month</label><input class="input" id="p-month" value="${UI.esc(p.sellingMonth)}" placeholder="e.g. Aug"></div>
      </div>
      <label class="switch" style="margin-bottom:14px"><span class="toggle ${p.stalled ? 'on' : ''}" id="p-stalled"><span class="knob"></span></span> Mark as stalled</label>
      <div class="btn-row">${id ? `<button class="btn danger" id="p-del">Delete</button>` : ''}<button class="btn gold" id="p-save">Save</button></div>`);
    let stalled = p.stalled;
    $('p-stalled').addEventListener('click', function () { stalled = !stalled; this.classList.toggle('on'); });
    $('p-save').addEventListener('click', () => {
      const obj = {
        name: $('p-name').value.trim(), businessName: $('p-business').value.trim(),
        phone: $('p-phone').value.trim(), email: $('p-email').value.trim(),
        detail: $('p-detail').value.trim(), stage: $('p-stage').value,
        value: +$('p-value').value || 0, sellingMonth: $('p-month').value.trim(), stalled, updated: Date.now(),
      };
      if (!obj.name) { UI.toast('Name required'); return; }
      if (id) Object.assign(p, obj); else s.pipeline.unshift({ id: S.uid(), ...obj });
      UI.closeSheet(); rerender(); UI.toast('Saved');
    });
    if (id) $('p-del').addEventListener('click', () => { s.pipeline = s.pipeline.filter((x) => x.id !== id); UI.closeSheet(); rerender(); UI.toast('Removed'); });
  }

  /* ---------- special ops ---------- */
  function specialOpSheet() {
    const s = S.get();
    UI.openSheet(`<h3>New special operation</h3>
      <p class="subtle">A focused campaign — expired listings, a farm street, a win-back push.</p>
      <div class="field"><label>Title</label><input class="input" id="op-title" placeholder="e.g. Expired listings blitz"></div>
      <div class="field"><label>Description</label><textarea class="textarea" id="op-desc" placeholder="What's the focus and why?"></textarea></div>
      <button class="btn gold" id="op-save">Create</button>`);
    $('op-save').addEventListener('click', () => {
      const title = $('op-title').value.trim(); if (!title) return;
      s.specialOps.unshift({ id: S.uid(), title, description: $('op-desc').value.trim(), active: true, items: [] });
      UI.closeSheet(); rerender(); UI.toast('Operation created');
    });
  }
  function opItemSheet(opId) {
    const s = S.get(); const op = s.specialOps.find((o) => o.id === opId);
    UI.openSheet(`<h3>Add target — ${UI.esc(op.title)}</h3>
      <div class="field"><label>Target / prospect</label><input class="input" id="oi-name" placeholder="e.g. 12 Barkly St — expired 3wk"></div>
      <button class="btn gold" id="oi-save">Add</button>`);
    $('oi-save').addEventListener('click', () => {
      const name = $('oi-name').value.trim(); if (!name) return;
      op.items.push({ id: S.uid(), name, done: false }); UI.closeSheet(); rerender();
    });
  }
  function toggleOpItem(opId, itemId) {
    const s = S.get(); const op = s.specialOps.find((o) => o.id === opId); if (!op) return;
    const it = op.items.find((i) => i.id === itemId); if (it) it.done = !it.done; rerender();
  }

  /* ---------- CRM ---------- */
  const CRM_STAGES = ['New', 'Contacted', 'Qualified', 'Negotiating', 'Won', 'Lost'];
  const CRM_NEXT_ACTIONS = ['Call', 'Text', 'Email', 'Follow up', 'Send proposal', 'Book meeting', 'Send info', 'Check in'];

  function nextActionField(current) {
    const isCustom = current && !CRM_NEXT_ACTIONS.includes(current);
    return `<div class="field"><label>Next action</label>
      <select class="input" id="c-action-select">
        ${CRM_NEXT_ACTIONS.map((a) => `<option value="${a}" ${a === current ? 'selected' : ''}>${a}</option>`).join('')}
        <option value="__custom__" ${isCustom ? 'selected' : ''}>Custom…</option>
      </select>
      <input class="input" id="c-action-custom" placeholder="Describe the action" value="${UI.esc(isCustom ? current : '')}" style="margin-top:8px${isCustom ? '' : ';display:none'}"></div>`;
  }

  function crmSheet(id) {
    const s = S.get();
    const c = id ? s.crm.find((x) => x.id === id) : { name: '', phone: '', email: '', stage: 'New', nextAction: '', nextDate: S.todayKey(), notes: '' };
    const canImport = !!(navigator.contacts && navigator.contacts.select);
    UI.openSheet(`<h3>${id ? 'Edit' : 'New'} contact</h3>
      ${canImport ? `<button class="btn outline" id="c-import" style="margin-bottom:14px">${Icons.svg('download', { size: 15 })} Import from contacts</button>` : ''}
      <div class="field"><label>Name</label><input class="input" id="c-name" value="${UI.esc(c.name)}"></div>
      <div class="field"><label>Phone</label><input class="input" id="c-phone" type="tel" value="${UI.esc(c.phone || '')}"></div>
      <div class="field"><label>Email</label><input class="input" id="c-email" type="email" value="${UI.esc(c.email || '')}"></div>
      <div class="field"><label>Lead stage</label><select class="input" id="c-stage">${CRM_STAGES.map((x) => `<option ${x === c.stage ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
      ${nextActionField(c.nextAction)}
      <div class="field"><label>Next action date</label><input class="input" id="c-date" type="date" value="${c.nextDate || ''}"></div>
      <div class="field"><label>Notes</label><textarea class="textarea" id="c-notes">${UI.esc(c.notes)}</textarea></div>
      <div class="btn-row">${id ? `<button class="btn danger" id="c-del">Delete</button>` : ''}<button class="btn gold" id="c-save">Save</button></div>`);
    $('c-action-select').addEventListener('change', function () {
      $('c-action-custom').style.display = this.value === '__custom__' ? '' : 'none';
    });
    if (canImport) $('c-import').addEventListener('click', importCrmContact);
    $('c-save').addEventListener('click', () => {
      const actionSel = $('c-action-select').value;
      const nextAction = actionSel === '__custom__' ? $('c-action-custom').value.trim() : actionSel;
      const obj = {
        name: $('c-name').value.trim(), phone: $('c-phone').value.trim(), email: $('c-email').value.trim(),
        stage: $('c-stage').value, nextAction, nextDate: $('c-date').value, notes: $('c-notes').value.trim(), updated: Date.now(),
      };
      if (!obj.name) { UI.toast('Name required'); return; }
      if (id) Object.assign(c, obj); else s.crm.unshift({ id: S.uid(), ...obj });
      UI.closeSheet(); rerender(); UI.toast('Saved');
    });
    if (id) $('c-del').addEventListener('click', () => { s.crm = s.crm.filter((x) => x.id !== id); UI.closeSheet(); rerender(); UI.toast('Removed'); });
  }
  // Contact Picker API — Android Chrome only (feature-detected above), no
  // equivalent exists on iOS Safari or desktop browsers as of writing.
  async function importCrmContact() {
    try {
      const props = ['name', 'tel', 'email'];
      const [picked] = await navigator.contacts.select(props, { multiple: false });
      if (!picked) return;
      if (picked.name && picked.name[0]) $('c-name').value = picked.name[0];
      if (picked.tel && picked.tel[0]) $('c-phone').value = picked.tel[0];
      if (picked.email && picked.email[0]) $('c-email').value = picked.email[0];
    } catch (e) { /* user cancelled the picker */ }
  }
  function crmDone(id) {
    const s = S.get(); const c = s.crm.find((x) => x.id === id); if (!c) return;
    UI.openSheet(`<h3>Log next action</h3><p class="subtle">Completed: <b>${UI.esc(c.nextAction || 'action')}</b> for ${UI.esc(c.name)}.</p>
      ${nextActionField('')}
      <div class="field"><label>When?</label><input class="input" id="nd-date" type="date" value="${S.addDays(S.todayKey(), 3)}"></div>
      <button class="btn gold" id="nd-save">Update</button>`);
    $('c-action-select').addEventListener('change', function () {
      $('c-action-custom').style.display = this.value === '__custom__' ? '' : 'none';
    });
    $('nd-save').addEventListener('click', () => {
      const actionSel = $('c-action-select').value;
      c.nextAction = (actionSel === '__custom__' ? $('c-action-custom').value.trim() : actionSel) || 'Follow up';
      c.nextDate = $('nd-date').value; c.updated = Date.now();
      UI.closeSheet(); rerender(); UI.toast('Next action set');
    });
  }

  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
  }

  /* ---------- build framework + goals ---------- */
  function buildSheet() {
    const bf = S.get().buildFramework;
    UI.openSheet(`<h3>Build the best consultant</h3>
      <div class="field"><label>Goal</label><input class="input" id="b-goal" value="${UI.esc(bf.goal)}"></div>
      <div class="field"><label>Proof</label><input class="input" id="b-proof" value="${UI.esc(bf.proof)}"></div>
      <div class="field"><label>Steps (one per line)</label><textarea class="textarea" id="b-steps">${UI.esc((bf.steps || []).join('\n'))}</textarea></div>
      <button class="btn gold" id="b-save">Save framework</button>`);
    $('b-save').addEventListener('click', () => {
      S.get().buildFramework = { goal: $('b-goal').value.trim(), proof: $('b-proof').value.trim(), steps: $('b-steps').value.split('\n').map((x) => x.trim()).filter(Boolean) };
      UI.closeSheet(); rerender(); UI.toast('Saved');
    });
  }
  function goalSheet(id) {
    const s = S.get(); const g = id ? s.goals.find((x) => x.id === id) : { category: '', title: '', detail: '' };
    UI.openSheet(`<h3>${id ? 'Edit' : 'Add'} goal</h3>
      <div class="field"><label>Category</label><input class="input" id="g-cat" value="${UI.esc(g.category)}" placeholder="e.g. Revenue, Family, Travel"></div>
      <div class="field"><label>Goal</label><input class="input" id="g-title" value="${UI.esc(g.title)}" placeholder="e.g. $500K"></div>
      <div class="field"><label>Detail</label><input class="input" id="g-detail" value="${UI.esc(g.detail)}" placeholder="e.g. Annual income target"></div>
      <div class="btn-row">${id ? `<button class="btn danger" id="g-del">Delete</button>` : ''}<button class="btn gold" id="g-save">Save</button></div>`);
    $('g-save').addEventListener('click', () => {
      const obj = { category: $('g-cat').value.trim() || 'Goal', title: $('g-title').value.trim(), detail: $('g-detail').value.trim() };
      if (!obj.title) { UI.toast('Goal required'); return; }
      if (id) Object.assign(g, obj); else s.goals.push({ id: S.uid(), ...obj });
      UI.closeSheet(); rerender(); UI.toast('Saved');
    });
    if (id) $('g-del').addEventListener('click', () => { s.goals = s.goals.filter((x) => x.id !== id); UI.closeSheet(); rerender(); });
  }

  /* ---------- coach client drill-in ---------- */
  function coachClientSheet(id) {
    const s = S.get(); const c = s.coachRoster.find((x) => x.id === id) || { id, name: 'Consultant', type: '', pace: 0, streak: 0, status: '' };
    UI.openSheet(`<h3>${UI.esc(c.name)}</h3>
      <div class="kv"><span class="k">Type</span><span class="v">${UI.esc(c.type)}</span></div>
      <div class="kv"><span class="k">Status</span><span class="v">${UI.esc(c.status)}</span></div>
      <div class="kv"><span class="k">Week pace</span><span class="v">${c.pace}%</span></div>
      <div class="kv"><span class="k">4-week trend</span><span class="v">${UI.sparkline(c.paceTrend, { width: 90, height: 26 })}</span></div>
      <div class="kv"><span class="k">Streak</span><span class="v">${c.streak} days</span></div>
      <div class="kv"><span class="k">Last check-in</span><span class="v">${UI.esc(c.last || '—')}</span></div>
      <div class="kv"><span class="k">Last report sent</span><span class="v" id="cc-last-report">Loading…</span></div>
      <div class="callout" style="margin-top:14px">${Icons.svg('target', { size: 15 })}<span>${coachClientTip(c)}</span></div>
      <div class="btn-row" style="margin-top:14px"><button class="btn outline" data-act="close-sheet">Close</button>
      <button class="btn gold" id="cc-msg">Send nudge</button></div>
      <button class="btn outline" id="cc-report" style="margin-top:10px;width:100%">${Icons.svg('file', { size: 15 })} Send daily report</button>
      <div class="field" style="margin-top:16px;margin-bottom:0"><label>Private notes — only you see this</label>
        <textarea class="textarea" id="cc-note" placeholder="Loading…" style="min-height:80px"></textarea></div>
      <button class="btn outline sm" id="cc-note-save" style="margin-top:8px">Save note</button>`);
    $('cc-msg').addEventListener('click', () => sendNudge(c));
    $('cc-report').addEventListener('click', () => dailyReportSheet(c));
    Sync.fetchSentReports(id).then((reports) => {
      const el = $('cc-last-report'); // sheet may have closed already — guard
      if (!el) return;
      el.textContent = reports.length
        ? new Date(reports[0].created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) + ' · ' + reports.length + ' total'
        : 'Never';
    });
    Sync.fetchCoachNote(id).then((note) => {
      const el = $('cc-note'); // sheet may have closed already — guard
      if (!el) return;
      el.value = note; el.placeholder = 'e.g. Flagged low energy on last call — check in Thursday.';
    });
    $('cc-note-save').addEventListener('click', async () => {
      const btn = $('cc-note-save'); btn.setAttribute('disabled', ''); btn.textContent = 'Saving…';
      const r = await Sync.saveCoachNote(id, $('cc-note').value.trim());
      btn.removeAttribute('disabled'); btn.textContent = 'Save note';
      UI.toast(r.error ? 'Could not save — ' + r.error : 'Note saved');
    });
  }
  function buildDailyReportDraft(c) {
    return `Hi ${c.name.split(' ')[0]} — here's your daily rundown.\n\n`
      + `Pace this week: ${c.pace}% · Streak: ${c.streak} day${c.streak === 1 ? '' : 's'} · Status: ${c.status}\n`
      + `Last check-in: ${c.last || '—'}\n\n${coachClientTip(c)}`;
  }
  function dailyReportSheet(c) {
    UI.openSheet(`<h3>Daily report — ${UI.esc(c.name)}</h3>
      <p class="subtle">Auto-drafted from ${UI.esc(c.name)}'s pace data. Edit before sending — it lands in their app as an in-app message, not a push notification.</p>
      <div class="field" style="margin-top:12px;margin-bottom:0"><label>Message</label>
        <textarea class="textarea" id="dr-body" style="min-height:160px">${UI.esc(buildDailyReportDraft(c))}</textarea></div>
      <div class="btn-row" style="margin-top:14px"><button class="btn outline" data-act="close-sheet">Cancel</button>
      <button class="btn gold" id="dr-send">Send report</button></div>`);
    $('dr-send').addEventListener('click', async () => {
      const body = $('dr-body').value.trim();
      if (!body) { UI.toast('Write something first'); return; }
      const btn = $('dr-send'); btn.setAttribute('disabled', ''); btn.textContent = 'Sending…';
      const r = await Sync.sendCoachMessage(c.id, 'Daily report', body);
      if (r.error) { UI.toast('Could not send — ' + r.error); btn.removeAttribute('disabled'); btn.textContent = 'Send report'; return; }
      UI.closeSheet(); UI.toast('Report sent to ' + c.name);
    });
  }
  async function sendNudge(c) {
    UI.closeSheet();
    const cSupa = global.Supa && Supa.getClient();
    if (!cSupa) { UI.toast('Nudge sent to ' + c.name); return; }
    try {
      const { data, error } = await cSupa.functions.invoke('send-nudge', {
        body: { agentId: c.id, title: 'Nudge from your coach', body: coachClientTip(c) },
      });
      if (error) throw error;
      UI.toast(data && data.sent ? 'Nudge sent to ' + c.name : c.name + " isn't set up for notifications yet");
    } catch (e) {
      console.warn('send-nudge failed', e);
      UI.toast('Could not send nudge — try again');
    }
  }
  function coachClientTip(c) {
    if (c.status === 'At risk') return `${c.name} is at ${c.pace}% and hasn't checked in recently. Call today — reset one keystone habit (the morning call block).`;
    if (c.status === 'Watch') return `${c.name} is slipping to ${c.pace}%. A short mid-week nudge usually pulls them back on pace.`;
    return `${c.name} is on track at ${c.pace}%. Reinforce the streak and stretch one metric 10%.`;
  }

  async function sentReportsSheet() {
    UI.openSheet(`<h3>Sent reports</h3><p class="subtle">Loading…</p>`);
    const s = S.get();
    const reports = await Sync.fetchSentReports();
    if (!reports.length) {
      UI.openSheet(`<h3>Sent reports</h3><div class="empty">${Icons.svg('inbox', { size: 26 })}No reports sent yet.</div>
        <button class="btn outline" data-act="close-sheet" style="margin-top:10px;width:100%">Close</button>`);
      return;
    }
    const nameFor = (id) => (s.coachRoster.find((c) => c.id === id) || {}).name || 'Unknown';
    UI.openSheet(`<h3>Sent reports</h3>
      ${reports.map((r) => `<div class="card" style="margin:0 0 10px">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px">
          <div style="font-weight:600">${UI.esc(nameFor(r.agent_id))}</div>
          <div class="subtle" style="font-size:11px">${new Date(r.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</div>
        </div>
        <p class="subtle" style="margin:0;white-space:pre-wrap;color:var(--bone)">${UI.esc(r.body)}</p>
      </div>`).join('')}
      <button class="btn outline" data-act="close-sheet" style="width:100%">Close</button>`);
  }

  function bulkReportsSheet() {
    const s = S.get();
    const targets = s.coachRoster.filter((c) => c.status === 'Watch' || c.status === 'At risk');
    if (!targets.length) {
      UI.openSheet(`<h3>Send today's reports</h3><div class="empty">${Icons.svg('check', { size: 26 })}Nobody needs a nudge today — everyone's on track.</div>
        <button class="btn outline" data-act="close-sheet" style="margin-top:10px;width:100%">Close</button>`);
      return;
    }
    UI.openSheet(`<h3>Send today's reports</h3>
      <p class="subtle">Auto-drafted for everyone who's Watch or At risk. Edit before sending — send or skip each one individually.</p>
      ${targets.map((c) => `<div class="card" style="margin:12px 0 0">
        <div style="font-weight:600;margin-bottom:6px">${UI.esc(c.name)} <span class="tag ${c.status === 'At risk' ? 'red' : 'amber'}" style="margin-left:4px">${UI.esc(c.status)}</span></div>
        <textarea class="textarea" id="br-body-${c.id}" style="min-height:110px">${UI.esc(buildDailyReportDraft(c))}</textarea>
        <button class="btn gold sm" id="br-send-${c.id}" style="margin-top:8px">Send</button>
      </div>`).join('')}
      <button class="btn outline" data-act="close-sheet" style="width:100%;margin-top:16px">Done</button>`);
    targets.forEach((c) => {
      $(`br-send-${c.id}`).addEventListener('click', async () => {
        const btn = $(`br-send-${c.id}`);
        const body = $(`br-body-${c.id}`).value.trim();
        if (!body) return;
        btn.setAttribute('disabled', ''); btn.textContent = 'Sending…';
        const r = await Sync.sendCoachMessage(c.id, 'Daily report', body);
        if (r.error) { UI.toast('Could not send to ' + c.name); btn.removeAttribute('disabled'); btn.textContent = 'Send'; return; }
        btn.textContent = 'Sent ✓'; btn.classList.remove('gold'); btn.classList.add('outline');
        UI.toast('Sent to ' + c.name);
      });
    });
  }

  /* ---------- menu / settings ---------- */
  function tile(opt) {
    const tag = opt.href ? 'a' : 'button';
    const isStatic = !opt.href && !opt.act && !opt.id;
    const attrs = opt.href ? `href="${opt.href}" target="_blank" rel="noopener"` : (opt.act ? `data-act="${opt.act}"` : '');
    return `<${tag} class="tile${isStatic ? ' static' : ''}" id="${opt.id || ''}" ${attrs} ${opt.color ? `style="color:${opt.color}"` : ''}>
      ${Icons.svg(opt.icon, { size: 20 })}
      <span class="tl">${opt.label}</span>
      ${opt.sub ? `<span class="ts2">${opt.sub}</span>` : ''}
    </${tag}>`;
  }
  function openMenu() {
    const s = S.get();
    const session = Auth.getSession();
    UI.openSheet(`<h3>Menu</h3>
      ${session ? `<p class="subtle" style="margin:-8px 0 16px">Signed in as ${UI.esc(session.email)}${session.provider === 'google' ? ' · Google' : ''}</p>` : ''}
      <div class="tile-grid">
        ${tile({ id: 'm-theme', icon: s.settings.theme === 'light' ? 'sun' : 'moon', label: 'Appearance', sub: s.settings.theme === 'light' ? 'Light' : 'Dark' })}
        ${s.mode === 'agent' ? tile({ act: 'nav:goals', icon: 'flag', label: 'Goals' }) : ''}
        ${s.mode === 'agent' ? tile({ id: 'm-inbox', icon: 'inbox', label: 'Messages' }) : ''}
        ${tile({ id: 'm-reminders', icon: 'bell', label: 'Reminders', sub: s.settings.remindersEnabled ? 'On' : 'Off' })}
        ${s.mode === 'agent' ? tile({ id: 'm-coachcode', icon: 'target', label: 'Coach', sub: s.profile.coachId ? UI.esc(s.profile.coachName) : 'Not linked' }) : ''}
        ${s.mode === 'coach' ? tile({ icon: 'target', label: 'Coach code', sub: UI.esc(s.profile.coachCode || '—') }) : ''}
        ${tile({ act: 'install-app', icon: 'download', label: 'Install app' })}
        ${tile({ act: 'export-ics', icon: 'calendar', label: 'Calendar' })}
        ${tile({ href: 'privacy.html', icon: 'file', label: 'Privacy' })}
      </div>
      <div class="tile-grid" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--hairline-soft)">
        ${tile({ act: 'log-out', icon: 'logout', label: 'Log out' })}
        ${tile({ act: 'reset-app', icon: 'reset', label: 'Reset data', color: 'var(--clay)' })}
      </div>`);
    $('m-theme').addEventListener('click', () => { toggleTheme(); openMenu(); });
    $('m-reminders').addEventListener('click', remindersSheet);
    if ($('m-coachcode')) $('m-coachcode').addEventListener('click', linkCoachSheet);
    if ($('m-inbox')) $('m-inbox').addEventListener('click', inboxSheet);
  }
  function linkCoachSheet() {
    const s = S.get();
    UI.openSheet(`<h3>${s.profile.coachId ? 'Your coach' : 'Link your coach'}</h3>
      <p class="subtle">${s.profile.coachId ? `You're linked to ${UI.esc(s.profile.coachName)}. Enter a new code to switch.` : "Enter the code your coach shared with you."}</p>
      <div class="field" style="margin-bottom:0"><label>Coach access code</label>
        <input class="input" id="lc-code" style="letter-spacing:4px;font-family:var(--mono);text-align:center;max-width:120px" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="0000" value="${UI.esc(s.profile.coachCode || '')}"></div>
      <div id="lc-status" class="subtle" style="margin-top:8px"></div>
      <div class="btn-row" style="margin-top:14px"><button class="btn outline" data-act="close-sheet">Cancel</button>
      <button class="btn gold" id="lc-save">Link coach</button></div>`);
    $('lc-code').addEventListener('input', function () { this.value = this.value.replace(/\D/g, '').slice(0, 4); });
    $('lc-save').addEventListener('click', async () => {
      const code = $('lc-code').value.trim();
      if (!code) { UI.toast('Enter a code'); return; }
      const btn = $('lc-save'); btn.setAttribute('disabled', ''); btn.textContent = 'Checking…';
      const r = await Auth.linkCoach(code);
      if (r.error) {
        $('lc-status').textContent = r.error; $('lc-status').style.color = 'var(--clay)';
        btn.removeAttribute('disabled'); btn.textContent = 'Link coach';
        return;
      }
      s.profile.coachId = r.coach.id;
      s.profile.coachName = r.coach.name;
      s.profile.coachCode = code;
      s.settings.coachName = r.coach.name;
      S.save(); UI.closeSheet(); UI.render(); UI.toast('Linked to ' + r.coach.name);
    });
  }
  async function inboxSheet() {
    UI.openSheet(`<h3>Messages from your coach</h3><p class="subtle">Loading…</p>`);
    const messages = await Sync.fetchInbox();
    if (!messages.length) {
      UI.openSheet(`<h3>Messages from your coach</h3>
        <div class="empty">${Icons.svg('inbox', { size: 26 })}No messages yet.</div>
        <button class="btn outline" data-act="close-sheet" style="margin-top:10px;width:100%">Close</button>`);
      return;
    }
    UI.openSheet(`<h3>Messages from your coach</h3>
      ${messages.map((m) => `<div class="card" style="margin:0 0 10px${m.read ? '' : ';border-color:var(--gold-dim)'}">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px">
          <div style="font-weight:600">${UI.esc(m.title)}${m.read ? '' : ' <span class=\"pill\">new</span>'}</div>
          <div class="subtle" style="font-size:11px">${new Date(m.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</div>
        </div>
        <p class="subtle" style="margin:0;white-space:pre-wrap;color:var(--bone)">${UI.esc(m.body)}</p>
      </div>`).join('')}
      <button class="btn outline" data-act="close-sheet" style="width:100%">Close</button>`);
    messages.filter((m) => !m.read).forEach((m) => Sync.markMessageRead(m.id));
  }
  function remindersSheet() {
    const s = S.get();
    UI.openSheet(`<h3>Daily reminders</h3>
      <p class="subtle">A morning nudge to set your focus, and an end-of-day nudge to log numbers + voice note. Works while the app is installed and open; add to your calendar for guaranteed alerts.</p>
      <div class="field" style="margin-top:12px"><label>Morning reminder</label><input class="input" id="r-morning" type="time" value="${s.settings.reminderTime}"></div>
      <div class="field"><label>End-of-day reminder</label><input class="input" id="r-eod" type="time" value="${s.settings.eodTime}"></div>
      <div class="btn-row"><button class="btn outline" data-act="export-ics">${Icons.svg('calendar', { size: 15 })} Add to calendar</button>
      <button class="btn gold" id="r-save">Enable reminders</button></div>`);
    $('r-save').addEventListener('click', async () => {
      s.settings.reminderTime = $('r-morning').value || '08:00';
      s.settings.eodTime = $('r-eod').value || '17:00';
      s.settings.remindersEnabled = true; S.save();
      if ('Notification' in window && Notification.permission !== 'granted') { try { await Notification.requestPermission(); } catch (e) {} }
      if (global.Push) Push.subscribe();
      scheduleReminders(); UI.closeSheet(); UI.toast('Reminders enabled');
    });
  }
  function resetApp() {
    UI.openSheet(`<h3 style="color:var(--clay)">Reset all data?</h3>
      <p class="subtle">This clears everything on this device and restarts onboarding.</p>
      <div class="btn-row" style="margin-top:14px"><button class="btn outline" data-act="close-sheet">Cancel</button>
      <button class="btn danger" id="rs-go">Reset everything</button></div>`);
    // Clearing lastUid alongside the local state forces syncForSession() to
    // treat the next boot like a fresh login and re-pull from Supabase,
    // instead of seeing the same uid still cached and skipping the pull —
    // otherwise a signed-in user would land back in onboarding with their
    // real cloud data never coming back down.
    $('rs-go').addEventListener('click', () => { S.reset(); S.setLastUid(null); UI.onbStep = 0; UI.closeSheet(); location.reload(); });
  }
  function doInstall() {
    if (installPrompt) { installPrompt.prompt(); installPrompt = null; UI.closeSheet(); }
    else UI.openSheet(`<h3>Install ELITE Tracker</h3>
      <p class="subtle" style="line-height:1.6"><b>iPhone (Safari):</b> tap the Share icon → “Add to Home Screen”.<br><br><b>Android (Chrome):</b> tap ⋮ menu → “Install app” / “Add to Home screen”.<br><br>It then opens fullscreen like a native app and works offline.</p>
      <button class="btn gold" data-act="close-sheet" style="margin-top:8px">Got it</button>`);
  }

  /* ---------- .ics calendar reminder ---------- */
  function exportICS() {
    const s = S.get();
    const [mh, mm] = (s.settings.reminderTime || '08:00').split(':');
    const [eh, em] = (s.settings.eodTime || '17:00').split(':');
    const dt = (h, m) => { const d = new Date(); d.setDate(d.getDate() + 1); return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(h)}${pad(m)}00`; };
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ELITE Tracker//EN',
      ev('elite-am', dt(mh, mm), 'ELITE Tracker — set your focus', 'Open ELITE Tracker and set today\'s focus.'),
      ev('elite-pm', dt(eh, em), 'ELITE Tracker — log numbers + voice note', 'Log today\'s numbers and record your daily voice note for your coach.'),
      'END:VCALENDAR'].join('\r\n');
    downloadBlob(new Blob([ics], { type: 'text/calendar' }), 'elite-tracker-reminders.ics');
    UI.toast('Calendar reminders downloaded');
  }
  function ev(uid, start, title, desc, repeatDaily) {
    return ['BEGIN:VEVENT', `UID:${uid}@elitetracker`, `DTSTART:${start}`,
      repeatDaily === false ? null : 'RRULE:FREQ=DAILY',
      `SUMMARY:${title}`, `DESCRIPTION:${desc}`, 'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', `DESCRIPTION:${title}`, 'END:VALARM', 'END:VEVENT']
      .filter(Boolean).join('\r\n');
  }
  const pad = (n) => String(n).padStart(2, '0');

  // Same download-an-.ics approach as the recurring reminders above, but
  // for today's actual planned focus blocks (real times, one-off events)
  // rather than a generic daily nudge — works with Google Calendar, Apple
  // Calendar, Outlook, anything that reads .ics, without needing OAuth
  // scopes or a live API integration.
  function exportFocusICS() {
    const d = S.dayRecord();
    const items = (d.focus || []).filter((f) => f.time && f.text);
    if (!items.length) { UI.toast('No timed focus tasks today'); return; }
    const today = new Date();
    const events = items.map((f, idx) => {
      const [h, m] = (f.time || '09:00').split(':').map(Number);
      const stamp = `${today.getFullYear()}${pad(today.getMonth() + 1)}${pad(today.getDate())}T${pad(h)}${pad(m)}00`;
      return ev(`elite-focus-${S.todayKey()}-${idx}`, stamp, f.text, "From today's ELITE Tracker focus list.", false);
    });
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ELITE Tracker//EN', ...events, 'END:VCALENDAR'].join('\r\n');
    downloadBlob(new Blob([ics], { type: 'text/calendar' }), `elite-tracker-focus-${S.todayKey()}.ics`);
    UI.toast("Today's focus added to calendar");
  }

  /* ---------- in-app reminder scheduling ---------- */
  let reminderCheck = null;
  function scheduleReminders() {
    const s = S.get(); if (!s.settings.remindersEnabled) return;
    if (reminderCheck) clearInterval(reminderCheck);
    let lastFired = '';
    reminderCheck = setInterval(() => {
      const now = new Date(); const hm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
      const key = S.todayKey() + hm;
      if (hm === s.settings.reminderTime && lastFired !== key) { lastFired = key; notify('Set your focus', 'What\'s your focus today? Open ELITE Tracker.'); }
      if (hm === s.settings.eodTime && lastFired !== key) { lastFired = key; notify('Log your numbers', 'Time to log today\'s numbers and record a voice note.'); }
    }, 30000);
  }
  function notify(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
      try { new Notification(title, { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' }); return; } catch (e) {}
    }
    UI.toast(title + ' — ' + body);
  }

  /* ---------- live-filter inputs (re-render without losing focus/cursor) ---------- */
  function clientSearch(value) {
    UI.clientSearch = value;
    const active = document.activeElement;
    const id = active && active.id;
    const pos = active && active.selectionStart;
    UI.render();
    const el = id && $(id);
    if (el) { el.focus(); if (pos != null) el.setSelectionRange(pos, pos); }
  }
  function clientSort(value) { UI.clientSort = value; rerender(); }

  // Live coach-code validation during onboarding — debounced so it doesn't
  // fire a lookup on every keystroke, and only re-renders (which would
  // otherwise steal focus mid-type) once the debounced result lands.
  let coachLookupTimer = null;
  function coachCodeInput(value) {
    // Fixed 4-digit field — strip anything that isn't a digit (no room
    // for the stray-space typos this was meant to prevent) and cap at 4
    // characters, writing the sanitized value straight back into the
    // field so what's shown always matches what's actually stored.
    const digits = value.replace(/\D/g, '').slice(0, 4);
    const el = document.getElementById('onb-code');
    if (el && el.value !== digits) el.value = digits;
    UI.onbTmp.coachCode = digits;
    UI.captureOnb();
    clearTimeout(coachLookupTimer);
    if (digits.length < 4) { UI.onbTmp.coachName = ''; UI.onbTmp.coachId = ''; UI.onbTmp.coachLookupStatus = ''; return; }
    coachLookupTimer = setTimeout(async () => {
      const r = await Auth.findCoachByCode(digits);
      if ((UI.onbTmp.coachCode || '') !== digits) return; // stale — field changed since
      if (r.error) { UI.onbTmp.coachName = ''; UI.onbTmp.coachId = ''; UI.onbTmp.coachLookupStatus = 'notfound'; }
      else { UI.onbTmp.coachName = r.coach.name; UI.onbTmp.coachId = r.coach.id; UI.onbTmp.coachLookupStatus = 'found'; }
      const active = document.activeElement; const id = active && active.id; const pos = active && active.selectionStart;
      UI.render();
      const elAfter = id && $(id); if (elAfter) { elAfter.focus(); if (pos != null) elAfter.setSelectionRange(pos, pos); }
    }, 400);
  }

  // expose a few for debugging
  global.App = { rerender, scheduleReminders, coachCodeInput, clientSearch, clientSort };
})(window);
