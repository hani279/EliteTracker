/* ============================================================
   ELITE TRACKER — store.js
   State, persistence (localStorage) + audio blobs (IndexedDB)
   ============================================================ */
(function (global) {
  'use strict';

  const KEY = 'elite_tracker_v1';

  // -------- date helpers --------
  const pad = (n) => String(n).padStart(2, '0');
  function todayKey(d) {
    d = d || new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function parseKey(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); }
  function addDays(k, n) { const d = parseKey(k); d.setDate(d.getDate() + n); return todayKey(d); }
  function fmtDate(k, opt) {
    return parseKey(k).toLocaleDateString('en-AU', opt || { weekday: 'long', day: 'numeric', month: 'long' });
  }
  function fmtShort(k) { return parseKey(k).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }); }

  // -------- default state --------
  function defaultState() {
    return {
      version: 1,
      onboarded: false,
      mode: 'agent',            // 'agent' | 'coach'
      profile: { name: '', coachName: 'Harry', coachCode: '', brand: '', vertical: 'realestate', role: '' },
      buildFramework: { goal: '', proof: '', steps: [] }, // Goal / Proof / Steps — build best agent
      goals: [],                // life & business goals grid
      targets: {},              // metricKey -> daily target (per vertical, seeded)
      focusTemplate: [],        // recurring daily focus tasks
      days: {},                 // 'YYYY-MM-DD' -> day record
      pipeline: [],
      crm: [],
      specialOps: [],
      settings: {
        remindersEnabled: false,
        reminderTime: '08:00',
        eodTime: '17:00',
        assumeMinimums: true,   // adapt to missing data
        numbersDue: '17:00',
        theme: 'dark',          // 'dark' | 'light'
      },
      reportsLog: [],           // {id,type,rangeLabel,date,score}
      coachRoster: [],          // demo roster for coach view
      createdAt: Date.now(),
    };
  }

  // -------- load / save --------
  let state = null;
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      state = raw ? Object.assign(defaultState(), JSON.parse(raw)) : defaultState();
    } catch (e) { state = defaultState(); }
    return state;
  }
  const saveListeners = [];
  function onSave(fn) { saveListeners.push(fn); }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn('save failed', e); }
    saveListeners.forEach((fn) => { try { fn(state); } catch (e) { console.warn('save listener failed', e); } });
  }
  function get() { return state || load(); }
  function reset() { state = defaultState(); save(); }
  function replace(obj) { state = Object.assign(defaultState(), obj); save(); }

  // -------- day record helper --------
  function dayRecord(key) {
    const s = get();
    key = key || todayKey();
    if (!s.days[key]) {
      s.days[key] = {
        focus: (s.focusTemplate || []).map((t, i) => ({ id: 'f' + Date.now() + i, text: t.text, time: t.time, done: false })),
        numbers: {},
        outcomes: {},
        summary: { did: '', learned: '', struggled: '' },
        voiceNotes: [],
        reviewedEOD: false,
        logged: false,
      };
    }
    return s.days[key];
  }

  // Real UUIDs (not short random strings) so client-generated ids can be
  // used directly as Supabase `uuid` primary keys with no server round-trip
  // and no local-id-to-remote-id translation step.
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  }));

  // ============================================================
  //  IndexedDB for voice-note audio blobs
  // ============================================================
  const DB_NAME = 'elite_tracker_audio';
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => { req.result.createObjectStore('audio'); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbp;
  }
  async function putAudio(id, blob) {
    const d = await db();
    return new Promise((res, rej) => {
      const tx = d.transaction('audio', 'readwrite');
      tx.objectStore('audio').put(blob, id);
      tx.oncomplete = () => res(id);
      tx.onerror = () => rej(tx.error);
    });
  }
  async function getAudio(id) {
    const d = await db();
    return new Promise((res, rej) => {
      const tx = d.transaction('audio', 'readonly');
      const r = tx.objectStore('audio').get(id);
      r.onsuccess = () => res(r.result || null);
      r.onerror = () => rej(r.error);
    });
  }
  async function delAudio(id) {
    const d = await db();
    return new Promise((res) => {
      const tx = d.transaction('audio', 'readwrite');
      tx.objectStore('audio').delete(id);
      tx.oncomplete = () => res();
    });
  }

  global.Store = {
    KEY, load, save, get, reset, replace, defaultState, onSave,
    dayRecord, uid,
    todayKey, parseKey, addDays, fmtDate, fmtShort,
    putAudio, getAudio, delAudio,
  };
})(window);
