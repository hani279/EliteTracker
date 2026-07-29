/* ============================================================
   ELITE TRACKER — data.js
   Vertical definitions, defaults, and sample-data seeding
   ============================================================ */
(function (global) {
  'use strict';
  const S = global.Store;

  // Metric definitions per vertical.
  // minutesEach = avg minutes per unit (used for predictive time planning)
  const VERTICALS = {
    realestate: {
      label: 'Real Estate',
      roleLabel: 'Real Estate Agent',
      activity: [
        { key: 'calls',        label: 'Calls',              short: 'Calls', target: 20, minutesEach: 4 },
        { key: 'conversations',label: 'Conversations',      short: 'Conv',  target: 8,  minutesEach: 6 },
        { key: 'doorknocks',   label: 'Door knocks',        short: 'Knock', target: 4,  minutesEach: 20 },
        { key: 'baps',         label: 'BAPs · booked appraisals', short: 'BAP', target: 1, minutesEach: 0 },
        { key: 'maps',         label: 'MAPs · market appraisals', short: 'MAP', target: 1, minutesEach: 45 },
        { key: 'laps',         label: 'LAPs · listing appraisals',short: 'LAP', target: 1, minutesEach: 45 },
      ],
      outcomes: [
        { key: 'listingsWon',  label: 'Listings won',      target: 1 },
        { key: 'propertySold', label: 'Property sold',      target: 1 },
        { key: 'addedPipeline',label: 'Added to pipeline',  target: 1 },
        { key: 'clientsLost',  label: 'Clients lost',       target: 0, bad: true },
      ],
      // funnel used for conversion + predictive suggestions
      funnel: ['calls', 'conversations', 'baps', 'maps', 'laps'],
      pipelineStages: ['To appraise', 'Appraised', 'Listing soon', 'Listed', 'Under offer', 'Sold'],
      pipelineNoun: 'vendor',
      valueLabel: 'GCI / commission',
    },
    sales: {
      label: 'Sales (Non-Real-Estate)',
      roleLabel: 'Sales Professional',
      activity: [
        { key: 'calls',        label: 'Calls',            short: 'Calls',  target: 20, minutesEach: 4 },
        { key: 'conversations',label: 'Conversations',    short: 'Conv',   target: 8,  minutesEach: 6 },
        { key: 'social',       label: 'LinkedIn / social',short: 'Social', target: 4,  minutesEach: 5 },
        { key: 'mtgsBooked',   label: '1st mtgs booked',  short: 'Bkd',    target: 1,  minutesEach: 0 },
        { key: 'mtgsSat',      label: '1st mtgs sat',     short: 'Sat',    target: 1,  minutesEach: 40 },
        { key: 'addedPipeline',label: 'Added to pipeline',short: 'Pipe',   target: 1,  minutesEach: 0 },
      ],
      outcomes: [
        { key: 'dealsWon',   label: 'Deals won',        target: 1 },
        { key: 'proposals',  label: 'Proposals sent',   target: 1 },
        { key: 'demos',      label: 'Demos delivered',  target: 1 },
        { key: 'churn',      label: 'Deals lost',       target: 0, bad: true },
      ],
      funnel: ['calls', 'conversations', 'mtgsBooked', 'mtgsSat', 'addedPipeline'],
      pipelineStages: ['Prospect', 'Qualified', 'Demo', 'Proposal', 'Negotiation', 'Won'],
      pipelineNoun: 'deal',
      valueLabel: 'Deal value',
    },
  };

  function vertical(s) { return VERTICALS[(s || S.get()).profile.vertical] || VERTICALS.realestate; }
  function activityDefs() { return vertical().activity; }
  function outcomeDefs() { return vertical().outcomes; }

  // seed targets from vertical defaults (only fills missing keys)
  function seedTargets() {
    const s = S.get();
    [...vertical(s).activity, ...vertical(s).outcomes].forEach((m) => {
      if (s.targets[m.key] == null) s.targets[m.key] = m.target;
    });
  }

  const DEFAULT_FOCUS = {
    realestate: [
      { text: 'Prospecting block — call list A', time: '9:30' },
      { text: 'Appraisal prep — CMA', time: '11:00' },
      { text: 'Door knock — target street', time: '14:00' },
      { text: 'Log numbers + voice note', time: '16:45' },
    ],
    sales: [
      { text: 'Power hour — outbound calls', time: '9:30' },
      { text: 'Follow up warm pipeline', time: '11:00' },
      { text: 'LinkedIn / social touches', time: '14:00' },
      { text: 'Log numbers + voice note', time: '16:45' },
    ],
  };

  const DEFAULT_GOALS = [
    { id: S.uid(), category: 'Revenue',   title: '$500K', detail: 'Annual income target' },
    { id: S.uid(), category: 'Family',    title: 'More weekends off', detail: 'Personal' },
    { id: S.uid(), category: 'Growth',    title: 'Top 3 in office', detail: 'Ranking' },
    { id: S.uid(), category: 'Health',    title: 'Run 3x / week', detail: 'Balance' },
  ];

  // ---- demo coach roster (for coach mode) ----
  const DEMO_ROSTER = [
    { name: 'Jordan Avery', type: 'Real Estate', status: 'On track', pace: 82, last: 'Today 8:12am', streak: 18 },
    { name: 'Sophie Lim',   type: 'Sales',       status: 'On track', pace: 95, last: 'Today 7:40am', streak: 24 },
    { name: 'Elena Ortiz',  type: 'Sales',       status: 'Watch',    pace: 59, last: 'Today 8:55am', streak: 9 },
    { name: 'Tom Byrne',    type: 'Sales',       status: 'At risk',  pace: 38, last: '3 days ago',   streak: 0 },
    { name: 'Raj Anand',    type: 'Real Estate', status: 'On track', pace: 78, last: 'Today 9:01am', streak: 12 },
    { name: 'Mia Kovac',    type: 'Real Estate', status: 'Watch',    pace: 64, last: 'Yesterday',    streak: 6 },
    { name: 'Dan Walsh',    type: 'Real Estate', status: 'At risk',  pace: 41, last: '2 days ago',   streak: 0 },
    { name: 'Nina Bauer',   type: 'Sales',       status: 'On track', pace: 88, last: 'Today 8:30am', streak: 15 },
  ];

  const DEMO_ALERTS = [
    { name: 'Tom Byrne',    kind: 'MISSED ENTRIES', tone: 'red',   text: 'No numbers logged for 3 days — auto-assumed minimums applied', when: '9:00am' },
    { name: 'Dan Walsh',    kind: 'AT RISK',        tone: 'red',   text: 'Calls at 41% of weekly target with 2 days left', when: '2h ago' },
    { name: 'Mia Kovac',    kind: 'WATCH',          tone: 'amber', text: 'Door-knock sessions down 40% on her 4-week average', when: 'Today' },
    { name: 'Elena Ortiz',  kind: 'WATCH',          tone: 'amber', text: 'First-meeting show-rate slipped below 60%', when: 'Today' },
    { name: 'Sophie Lim',   kind: 'MILESTONE',      tone: 'green', text: 'Hit a 24-day streak at 95% pace — send a well done', when: '8:00am' },
    { name: 'Jordan Avery', kind: 'CHECK-IN',       tone: 'green', text: 'Voice note in: booked the Whitlock appraisal for Saturday', when: '8:12am' },
  ];

  // ---- sample pipeline / crm / special ops per vertical ----
  function samplePipeline(v) {
    if (v === 'sales') return [
      { id: S.uid(), name: 'Acme Logistics', detail: 'Procurement · 45 seats', stage: 'Proposal', value: 82000, sellingMonth: 'Aug', stalled: false, updated: Date.now() },
      { id: S.uid(), name: 'Brightwave Pty', detail: 'Operations', stage: 'Qualified', value: 41000, sellingMonth: 'Jul', stalled: false, updated: Date.now() },
      { id: S.uid(), name: 'Coastal Health', detail: 'IT · enterprise', stage: 'Demo', value: 120000, sellingMonth: 'Sep', stalled: false, updated: Date.now() },
      { id: S.uid(), name: 'Delta Freight', detail: 'Finance', stage: 'Negotiation', value: 55000, sellingMonth: 'Jul', stalled: true, updated: Date.now() },
      { id: S.uid(), name: 'Evergreen Retail', detail: 'Marketing', stage: 'Prospect', value: 30000, sellingMonth: 'Oct', stalled: false, updated: Date.now() },
    ];
    return [
      { id: S.uid(), name: 'Sarah & Tom Whitlock', detail: '14 Marsh St, Brunswick', stage: 'Appraised', value: 45000, sellingMonth: 'Aug', stalled: false, updated: Date.now() },
      { id: S.uid(), name: 'Priya Patel', detail: '22 Lygon Tce, Carlton', stage: 'Listing soon', value: 38000, sellingMonth: 'Jul', stalled: false, updated: Date.now() },
      { id: S.uid(), name: 'The Ahmed Family', detail: '3 Reuben Pl, Northcote', stage: 'Appraised', value: 52000, sellingMonth: 'Oct', stalled: false, updated: Date.now() },
      { id: S.uid(), name: 'David Nguyen', detail: '8 Aspen Ct, Coburg', stage: 'To appraise', value: 40000, sellingMonth: 'Sep', stalled: true, updated: Date.now() },
      { id: S.uid(), name: 'Marco Rossi', detail: '51 Vale St, Fitzroy', stage: 'To appraise', value: 35000, sellingMonth: 'Nov', stalled: true, updated: Date.now() },
    ];
  }
  function sampleCRM(v) {
    const base = [
      { id: S.uid(), name: 'Sarah Whitlock', contact: '0412 555 190', type: 'Hot', nextAction: 'Send signed authority', nextDate: S.todayKey(), notes: 'Wants to list before spring.', updated: Date.now() },
      { id: S.uid(), name: 'Priya Patel', contact: 'priya@email.com', type: 'Warm', nextAction: 'Confirm photographer', nextDate: S.addDays(S.todayKey(), 2), notes: 'Styling booked.', updated: Date.now() },
      { id: S.uid(), name: 'David Nguyen', contact: '0400 221 884', type: 'Cold', nextAction: 'Follow-up call', nextDate: S.addDays(S.todayKey(), -1), notes: 'Considering spring.', updated: Date.now() },
    ];
    return base;
  }
  function sampleSpecialOps(v) {
    if (v === 'sales') return [
      { id: S.uid(), title: 'Win-back campaign', description: 'Re-engage 20 closed-lost deals from last year.', active: true, items: [
        { id: S.uid(), name: 'Northside Freight', done: false }, { id: S.uid(), name: 'Halo Media', done: false }, { id: S.uid(), name: 'Pact Group', done: true },
      ] },
    ];
    return [
      { id: S.uid(), title: 'Expired listings blitz', description: 'Contact every listing that expired in the last 90 days.', active: true, items: [
        { id: S.uid(), name: '12 Barkly St — expired 3wk', done: false }, { id: S.uid(), name: '7 Nicholson St — expired 6wk', done: false }, { id: S.uid(), name: '40 Union Rd — expired 2wk', done: true },
      ] },
    ];
  }

  // Seed a couple of weeks of realistic history so reports/charts are alive.
  function seedHistory() {
    const s = S.get();
    const v = s.profile.vertical;
    const defs = VERTICALS[v].activity;
    // 18 days back -> yesterday
    for (let i = 18; i >= 1; i--) {
      const key = S.addDays(S.todayKey(), -i);
      const rec = S.dayRecord(key);
      const weekday = S.parseKey(key).getDay();
      if (weekday === 0 || weekday === 6) { continue; } // weekends lighter/skip
      // simulate a couple of "missed" days to prove adaptive handling
      if (i === 5 || i === 11) { rec.logged = false; rec.numbers = {}; continue; }
      defs.forEach((m) => {
        const t = s.targets[m.key] ?? m.target;
        const jitter = 0.6 + Math.random() * 0.75; // 60%–135% of target
        rec.numbers[m.key] = Math.max(0, Math.round(t * jitter));
      });
      // outcomes sparse
      rec.outcomes = {};
      if (Math.random() > 0.7) rec.outcomes[VERTICALS[v].outcomes[0].key] = 1;
      rec.logged = true;
      rec.reviewedEOD = true;
      // mark focus mostly done
      rec.focus.forEach((f, idx) => { f.done = idx < rec.focus.length - 1; });
    }
    // today: partial
    const t = S.dayRecord(S.todayKey());
    defs.forEach((m, idx) => {
      const tar = s.targets[m.key] ?? m.target;
      if (idx < 2) t.numbers[m.key] = Math.round(tar * 0.7);
    });
    t.focus.forEach((f, idx) => { f.done = idx === 0; });
    S.save();
  }

  function seedAll(vertical) {
    const s = S.get();
    s.profile.vertical = vertical;
    s.profile.role = VERTICALS[vertical].roleLabel;
    seedTargets();
    if (!s.focusTemplate.length) s.focusTemplate = DEFAULT_FOCUS[vertical].map((x) => ({ ...x }));
    if (!s.goals.length) s.goals = DEFAULT_GOALS.map((g) => ({ ...g, id: S.uid() }));
    if (!s.pipeline.length) s.pipeline = samplePipeline(vertical);
    if (!s.crm.length) s.crm = sampleCRM(vertical);
    if (!s.specialOps.length) s.specialOps = sampleSpecialOps(vertical);
    if (!s.coachRoster.length) s.coachRoster = DEMO_ROSTER.map((r) => ({ ...r }));
    s.demoAlerts = DEMO_ALERTS;
    S.save();
  }

  // Coach accounts don't log their own numbers — no vertical, targets,
  // pipeline or goals to seed. Just the roster view they actually use.
  function seedCoach() {
    const s = S.get();
    if (!s.coachRoster.length) s.coachRoster = DEMO_ROSTER.map((r) => ({ ...r }));
    s.demoAlerts = DEMO_ALERTS;
    S.save();
  }

  global.Data = {
    VERTICALS, vertical, activityDefs, outcomeDefs, seedTargets, seedCoach,
    DEFAULT_FOCUS, DEFAULT_GOALS, DEMO_ROSTER, DEMO_ALERTS,
    samplePipeline, sampleCRM, sampleSpecialOps,
    seedHistory, seedAll,
  };
})(window);
