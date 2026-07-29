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
  applyTheme(S.get().settings.theme || 'dark');
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
    if (!session || S.lastUid() === session.id) return;
    if (S.lastUid()) S.reset();
    S.setLastUid(session.id);
    try { await Sync.pull(); } catch (e) { console.warn('sync pull failed', e); }
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
    if (cmd === 'eod-review') return eodReview();

    // ---- number logging ----
    if (cmd === 'num') { stepNumber(a, b === '+' ? 1 : -1); return; }
    if (cmd === 'outcome') return outcomeSheet(a);

    // ---- summary / voice ----
    if (cmd === 'open-summary') return summarySheet();
    if (cmd === 'open-voice') return voiceSheet();
    if (cmd === 'rec-start') return startRecording();
    if (cmd === 'rec-stop') return stopRecording();
    if (cmd === 'vn-play') return playVoice(a);
    if (cmd === 'vn-del') return delVoice(a);

    // ---- track ----
    if (cmd === 'track-period') { UI.trackPeriod = a; rerender(); return; }

    // ---- pipeline ----
    if (cmd === 'pipe-tab') { UI.pipeTab = a; rerender(); return; }
    if (cmd === 'add-pipeline') return pipelineSheet(null);
    if (cmd === 'edit-pipeline') return pipelineSheet(a);
    if (cmd === 'add-specialop') return specialOpSheet();
    if (cmd === 'specialop-item') { toggleOpItem(a, b); return; }
    if (cmd === 'specialop-add') return opItemSheet(a);

    // ---- crm ----
    if (cmd === 'add-crm') return crmSheet(null);
    if (cmd === 'edit-crm') return crmSheet(a);
    if (cmd === 'crm-done') { e.stopPropagation(); return crmDone(a); }
    if (cmd === 'backup-export') return exportBackup();
    if (cmd === 'backup-import') return importBackup();

    // ---- reports ----
    if (cmd === 'report-type') { UI.reportType = a; rerender(); return; }
    if (cmd === 'send-report') return sendReport();
    if (cmd === 'copy-report') return copyReport();
    if (cmd === 'pdf-report') return pdfReport();

    // ---- goals / build ----
    if (cmd === 'edit-build') return buildSheet();
    if (cmd === 'add-goal') return goalSheet(null);
    if (cmd === 'edit-goal') return goalSheet(a);

    // ---- coach ----
    if (cmd === 'coach-client') return coachClientSheet(a);

    // ---- settings ----
    if (cmd === 'toggle-setting') return toggleSetting(a);
    if (cmd === 'save-settings') return saveSettings();
    if (cmd === 'enable-reminders') return enableReminders();
    if (cmd === 'export-ics') return exportICS();
    if (cmd === 'install-app') return doInstall();
    if (cmd === 'switch-vertical') return switchVertical();
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
    // local handlers for outnum
    $('sheet').querySelectorAll('[data-act^="outnum:"]').forEach((btn) => btn.addEventListener('click', () => {
      const [, k, sign] = btn.getAttribute('data-act').split(':');
      d.outcomes[k] = Math.max(0, (d.outcomes[k] || 0) + (sign === '+' ? 1 : -1));
      $('out-val').textContent = d.outcomes[k]; S.save();
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
    const p = id ? s.pipeline.find((x) => x.id === id) : { name: '', detail: '', stage: v.pipelineStages[0], value: 0, sellingMonth: '', stalled: false };
    UI.openSheet(`<h3>${id ? 'Edit' : 'Add'} ${UI.esc(v.pipelineNoun)}</h3>
      <div class="field"><label>Name</label><input class="input" id="p-name" value="${UI.esc(p.name)}" placeholder="${v.pipelineNoun === 'vendor' ? 'Owner name' : 'Company / contact'}"></div>
      <div class="field"><label>Detail</label><input class="input" id="p-detail" value="${UI.esc(p.detail)}" placeholder="${v.pipelineNoun === 'vendor' ? 'Address' : 'Dept / size'}"></div>
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
      const obj = { name: $('p-name').value.trim(), detail: $('p-detail').value.trim(), stage: $('p-stage').value, value: +$('p-value').value || 0, sellingMonth: $('p-month').value.trim(), stalled, updated: Date.now() };
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
  function crmSheet(id) {
    const s = S.get();
    const c = id ? s.crm.find((x) => x.id === id) : { name: '', contact: '', type: 'Warm', nextAction: '', nextDate: S.todayKey(), notes: '' };
    UI.openSheet(`<h3>${id ? 'Edit' : 'New'} contact</h3>
      <div class="field"><label>Name</label><input class="input" id="c-name" value="${UI.esc(c.name)}"></div>
      <div class="field"><label>Phone / email</label><input class="input" id="c-contact" value="${UI.esc(c.contact)}"></div>
      <div class="field"><label>Temperature</label><select class="input" id="c-type">${['Hot', 'Warm', 'Cold'].map((x) => `<option ${x === c.type ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
      <div class="field"><label>Next action</label><input class="input" id="c-action" value="${UI.esc(c.nextAction)}" placeholder="e.g. Follow-up call"></div>
      <div class="field"><label>Next action date</label><input class="input" id="c-date" type="date" value="${c.nextDate || ''}"></div>
      <div class="field"><label>Notes</label><textarea class="textarea" id="c-notes">${UI.esc(c.notes)}</textarea></div>
      <div class="btn-row">${id ? `<button class="btn danger" id="c-del">Delete</button>` : ''}<button class="btn gold" id="c-save">Save</button></div>`);
    $('c-save').addEventListener('click', () => {
      const obj = { name: $('c-name').value.trim(), contact: $('c-contact').value.trim(), type: $('c-type').value, nextAction: $('c-action').value.trim(), nextDate: $('c-date').value, notes: $('c-notes').value.trim(), updated: Date.now() };
      if (!obj.name) { UI.toast('Name required'); return; }
      if (id) Object.assign(c, obj); else s.crm.unshift({ id: S.uid(), ...obj });
      UI.closeSheet(); rerender(); UI.toast('Saved');
    });
    if (id) $('c-del').addEventListener('click', () => { s.crm = s.crm.filter((x) => x.id !== id); UI.closeSheet(); rerender(); UI.toast('Removed'); });
  }
  function crmDone(id) {
    const s = S.get(); const c = s.crm.find((x) => x.id === id); if (!c) return;
    UI.openSheet(`<h3>Log next action</h3><p class="subtle">Completed: <b>${UI.esc(c.nextAction || 'action')}</b> for ${UI.esc(c.name)}.</p>
      <div class="field" style="margin-top:12px"><label>What's the new next action?</label><input class="input" id="nd-action" placeholder="e.g. Send proposal"></div>
      <div class="field"><label>When?</label><input class="input" id="nd-date" type="date" value="${S.addDays(S.todayKey(), 3)}"></div>
      <button class="btn gold" id="nd-save">Update</button>`);
    $('nd-save').addEventListener('click', () => {
      c.nextAction = $('nd-action').value.trim() || 'Follow up'; c.nextDate = $('nd-date').value; c.updated = Date.now();
      UI.closeSheet(); rerender(); UI.toast('Next action set');
    });
  }

  /* ---------- backup ---------- */
  function exportBackup() {
    const data = JSON.stringify(S.get(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    downloadBlob(blob, `elite-tracker-backup-${S.todayKey()}.json`);
    UI.toast('Backup exported');
  }
  function importBackup() {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json';
    inp.onchange = () => {
      const file = inp.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try { const obj = JSON.parse(reader.result); S.replace(obj); UI.render(); UI.toast('Backup restored'); }
        catch (e) { UI.toast('Invalid backup file'); }
      };
      reader.readAsText(file);
    };
    inp.click();
  }
  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
  }

  /* ---------- reports send / copy ---------- */
  function currentReportText() { return Intel.reportToText(Intel.buildReport(UI.reportType)); }
  async function sendReport() {
    const r = Intel.buildReport(UI.reportType);
    const text = Intel.reportToText(r);
    S.get().reportsLog.unshift({ id: S.uid(), type: UI.reportType, rangeLabel: r.rangeLabel, date: Date.now(), score: r.score }); S.save();
    if (navigator.share) {
      try { await navigator.share({ title: r.title, text }); UI.toast('Shared to ' + r.coachName); return; } catch (e) {}
    }
    const subject = encodeURIComponent(`ELITE Tracker — ${r.title} — ${r.agentName}`);
    const body = encodeURIComponent(text);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    UI.toast('Opening email to ' + r.coachName);
  }
  async function copyReport() {
    try { await navigator.clipboard.writeText(currentReportText()); UI.toast('Report copied'); }
    catch (e) { UI.toast('Copy not supported'); }
  }
  function pdfReport() {
    // No PDF library needed — the browser's own print dialog offers
    // "Save as PDF" everywhere, and document.title becomes its default
    // filename. css/styles.css's @media print block strips the app chrome
    // down to just the report card content for this. window.print() blocks
    // until the dialog closes on some browsers but not others, so the
    // title is restored on 'afterprint' rather than right after the call.
    const r = Intel.buildReport(UI.reportType);
    const prevTitle = document.title;
    document.title = `ELITE Tracker — ${r.title} — ${r.agentName}`;
    window.addEventListener('afterprint', () => { document.title = prevTitle; }, { once: true });
    window.print();
  }

  /* ---------- build framework + goals ---------- */
  function buildSheet() {
    const bf = S.get().buildFramework;
    UI.openSheet(`<h3>Build the best agent</h3>
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
  function coachClientSheet(name) {
    const s = S.get(); const c = s.coachRoster.find((x) => x.name === name) || { name, type: '', pace: 0, streak: 0, status: '' };
    UI.openSheet(`<h3>${UI.esc(c.name)}</h3>
      <div class="kv"><span class="k">Type</span><span class="v">${UI.esc(c.type)}</span></div>
      <div class="kv"><span class="k">Status</span><span class="v">${UI.esc(c.status)}</span></div>
      <div class="kv"><span class="k">Week pace</span><span class="v">${c.pace}%</span></div>
      <div class="kv"><span class="k">Streak</span><span class="v">${c.streak} days</span></div>
      <div class="kv"><span class="k">Last check-in</span><span class="v">${UI.esc(c.last || '—')}</span></div>
      <div class="callout" style="margin-top:14px">${Icons.svg('target', { size: 15 })}<span>${coachClientTip(c)}</span></div>
      <div class="btn-row" style="margin-top:14px"><button class="btn outline" data-act="close-sheet">Close</button>
      <button class="btn gold" id="cc-msg">Send nudge</button></div>`);
    $('cc-msg').addEventListener('click', () => { UI.closeSheet(); UI.toast('Nudge sent to ' + c.name); });
  }
  function coachClientTip(c) {
    if (c.status === 'At risk') return `${c.name} is at ${c.pace}% and hasn't checked in recently. Call today — reset one keystone habit (the morning call block).`;
    if (c.status === 'Watch') return `${c.name} is slipping to ${c.pace}%. A short mid-week nudge usually pulls them back on pace.`;
    return `${c.name} is on track at ${c.pace}%. Reinforce the streak and stretch one metric 10%.`;
  }

  /* ---------- menu / settings ---------- */
  function openMenu() {
    const s = S.get();
    const session = Auth.getSession();
    UI.openSheet(`<h3>Menu</h3>
      ${session ? `<p class="subtle" style="margin:-8px 0 16px">Signed in as ${UI.esc(session.email)}${session.provider === 'google' ? ' · Google' : ''}</p>` : ''}
      <button class="choice icon-row" id="m-theme">${Icons.svg(s.settings.theme === 'light' ? 'sun' : 'moon', { size: 17 })}<span>Appearance — ${s.settings.theme === 'light' ? 'Light' : 'Dark'}</span></button>
      ${s.mode === 'coach' ? `<button class="choice icon-row" style="cursor:default"><span style="display:flex;align-items:center;color:var(--gold-ink)">${Icons.svg('target', { size: 17 })}</span><span>Your coach code — ${UI.esc(s.profile.coachCode || '—')}</span></button>` : ''}
      ${s.mode === 'agent' ? `<button class="choice icon-row" data-act="nav:goals">${Icons.svg('flag', { size: 17 })}<span>Goals & build framework</span></button>` : ''}
      <button class="choice icon-row" id="m-reminders">${Icons.svg('bell', { size: 17 })}<span>Reminders — ${s.settings.remindersEnabled ? 'On' : 'Off'} (${s.settings.reminderTime} / ${s.settings.eodTime})</span></button>
      ${s.mode === 'agent' ? `<button class="choice icon-row" id="m-minimums">${Icons.svg('settings', { size: 17 })}<span>Adapt to missing data — ${s.settings.assumeMinimums ? 'On (assume minimums)' : 'Off'}</span></button>` : ''}
      ${s.mode === 'agent' ? `<button class="choice icon-row" data-act="switch-vertical">${Icons.svg('swap', { size: 17 })}<span>Switch version — currently ${Data.vertical().label}</span></button>` : ''}
      <button class="choice icon-row" data-act="install-app">${Icons.svg('download', { size: 17 })}<span>Install app on this phone</span></button>
      <button class="choice icon-row" data-act="export-ics">${Icons.svg('calendar', { size: 17 })}<span>Add daily reminder to calendar</span></button>
      <button class="choice icon-row" data-act="backup-export">${Icons.svg('upload', { size: 17 })}<span>Export backup</span></button>
      <button class="choice icon-row" data-act="log-out">${Icons.svg('logout', { size: 17 })}<span>Log out</span></button>
      <button class="choice icon-row" data-act="reset-app" style="color:var(--clay)">${Icons.svg('reset', { size: 17 })}<span>Reset all data</span></button>`);
    $('m-theme').addEventListener('click', () => { toggleTheme(); openMenu(); });
    $('m-reminders').addEventListener('click', remindersSheet);
    if ($('m-minimums')) $('m-minimums').addEventListener('click', () => { s.settings.assumeMinimums = !s.settings.assumeMinimums; S.save(); UI.toast('Adaptive handling ' + (s.settings.assumeMinimums ? 'on' : 'off')); openMenu(); });
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
      scheduleReminders(); UI.closeSheet(); UI.toast('Reminders enabled');
    });
  }
  function switchVertical() {
    const s = S.get();
    const next = s.profile.vertical === 'realestate' ? 'sales' : 'realestate';
    UI.openSheet(`<h3>Switch version</h3>
      <p class="subtle">Switch to <b>${Data.VERTICALS[next].label}</b>? Your metrics, pipeline stages and reports adapt. Existing data is kept.</p>
      <div class="btn-row" style="margin-top:14px"><button class="btn outline" data-act="close-sheet">Cancel</button>
      <button class="btn gold" id="sv-go">Switch to ${Data.VERTICALS[next].label}</button></div>`);
    $('sv-go').addEventListener('click', () => {
      s.profile.vertical = next; s.profile.role = Data.VERTICALS[next].roleLabel;
      Data.seedTargets();
      if (!s.pipeline.length) s.pipeline = Data.samplePipeline(next);
      if (!s.specialOps.length) s.specialOps = Data.sampleSpecialOps(next);
      s.focusTemplate = Data.DEFAULT_FOCUS[next].map((x) => ({ ...x }));
      S.save(); UI.closeSheet(); UI.current = 'today'; UI.render(); UI.toast('Switched to ' + Data.VERTICALS[next].label);
    });
  }
  function resetApp() {
    UI.openSheet(`<h3 style="color:var(--clay)">Reset all data?</h3>
      <p class="subtle">This clears everything on this device and restarts onboarding. Export a backup first if unsure.</p>
      <div class="btn-row" style="margin-top:14px"><button class="btn outline" data-act="close-sheet">Cancel</button>
      <button class="btn danger" id="rs-go">Reset everything</button></div>`);
    $('rs-go').addEventListener('click', () => { S.reset(); UI.onbStep = 0; UI.closeSheet(); location.reload(); });
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
  function ev(uid, start, title, desc) {
    return ['BEGIN:VEVENT', `UID:${uid}@elitetracker`, `DTSTART:${start}`, `RRULE:FREQ=DAILY`, `SUMMARY:${title}`, `DESCRIPTION:${desc}`, 'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', `DESCRIPTION:${title}`, 'END:VALARM', 'END:VEVENT'].join('\r\n');
  }
  const pad = (n) => String(n).padStart(2, '0');

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
  function pipeSearch(value) {
    UI.pipeSearch = value;
    const active = document.activeElement;
    const id = active && active.id;
    const pos = active && active.selectionStart;
    UI.render();
    const el = id && $(id);
    if (el) { el.focus(); if (pos != null) el.setSelectionRange(pos, pos); }
  }

  // expose a few for debugging
  global.App = { rerender, scheduleReminders, pipeSearch };
})(window);
