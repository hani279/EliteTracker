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

  // New accounts start genuinely empty — no placeholder goals, pipeline,
  // CRM contacts, special ops, roster or history. Only real config
  // (targets, the recurring daily focus template) gets defaulted.
  function seedAll(vertical) {
    const s = S.get();
    s.profile.vertical = vertical;
    s.profile.role = VERTICALS[vertical].roleLabel;
    seedTargets();
    if (!s.focusTemplate.length) s.focusTemplate = DEFAULT_FOCUS[vertical].map((x) => ({ ...x }));
    S.save();
  }

  global.Data = {
    VERTICALS, vertical, activityDefs, outcomeDefs, seedTargets,
    DEFAULT_FOCUS, seedAll,
  };
})(window);
