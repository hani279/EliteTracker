/* ============================================================
   ELITE TRACKER — intelligence.js
   Aggregation, adaptive missing-data handling, suggestions,
   predictive time management, report building.
   ============================================================ */
(function (global) {
  'use strict';
  const S = global.Store, Data = global.Data;

  const isWeekend = (k) => [0, 6].includes(S.parseKey(k).getDay());
  const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

  // ---- date ranges ----
  function rangeKeys(type, ref) {
    ref = ref || S.todayKey();
    const out = [];
    if (type === 'daily') return [ref];
    let n = 7;
    if (type === 'weekly') n = 7;
    else if (type === 'fortnight') n = 14;
    else if (type === 'month') n = 30;
    else if (type === 'quarter') n = 91;
    else if (type === 'biyear') n = 182;
    for (let i = n - 1; i >= 0; i--) out.push(S.addDays(ref, -i));
    return out;
  }
  function rangeLabel(type, ref) {
    ref = ref || S.todayKey();
    const keys = rangeKeys(type, ref);
    if (type === 'daily') return S.fmtDate(ref);
    return `${S.fmtShort(keys[0])} – ${S.fmtShort(keys[keys.length - 1])}`;
  }

  function weekdaysLeftInWeek() {
    const d = new Date(); let count = 0;
    for (let i = d.getDay(); i <= 5; i++) if (i >= 1) count++;
    return Math.max(1, count);
  }

  // ---- core aggregation ----
  function aggregate(keys) {
    const s = S.get();
    const defs = Data.activityDefs();
    const outs = Data.outcomeDefs();
    const metrics = {};
    defs.forEach((m) => metrics[m.key] = {
      key: m.key, label: m.label, short: m.short, minutesEach: m.minutesEach,
      actual: 0, target: 0,
    });
    const outcomes = {};
    outs.forEach((o) => outcomes[o.key] = { key: o.key, label: o.label, actual: 0, bad: !!o.bad });

    let loggedDays = 0, missedDays = 0, workdays = 0;
    const today = startOfToday();

    keys.forEach((k) => {
      const rec = s.days[k];
      const isPast = S.parseKey(k) <= today;
      const weekend = isWeekend(k);
      if (!weekend && isPast) workdays++;
      const logged = rec && rec.logged && Object.keys(rec.numbers || {}).length > 0;
      if (logged) loggedDays++;
      else if (!weekend && isPast) missedDays++;

      defs.forEach((m) => {
        const tgt = s.targets[m.key] ?? m.target;
        if (!weekend && isPast) metrics[m.key].target += tgt;
        if (logged) metrics[m.key].actual += (rec.numbers[m.key] || 0);
      });
      if (rec && rec.outcomes) outs.forEach((o) => { outcomes[o.key].actual += (rec.outcomes[o.key] || 0); });
    });

    let totalActual = 0, totalTarget = 0;
    defs.forEach((m) => { totalActual += metrics[m.key].actual; totalTarget += metrics[m.key].target; });
    const pace = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;

    return { metrics, outcomes, defs, outs, totalActual, totalTarget, pace, loggedDays, missedDays, workdays, keys };
  }

  function metricPace(m) { return m.target > 0 ? Math.round((m.actual / m.target) * 100) : 100; }

  // ---- conversion ratios along the funnel ----
  function conversions(agg) {
    const funnel = Data.vertical().funnel;
    const rows = [];
    for (let i = 1; i < funnel.length; i++) {
      const from = agg.metrics[funnel[i - 1]], to = agg.metrics[funnel[i]];
      if (!from || !to) continue;
      const rate = from.actual > 0 ? (to.actual / from.actual) : 0;
      rows.push({ fromKey: funnel[i - 1], toKey: funnel[i], from: from.label, to: to.label, rate });
    }
    return rows;
  }

  // ---- today's pace ----
  function todayPace() {
    const agg = aggregate([S.todayKey()]);
    // for a single day, target is full daily target
    const s = S.get(); const defs = Data.activityDefs();
    let a = 0, t = 0;
    defs.forEach((m) => { a += (s.days[S.todayKey()]?.numbers?.[m.key] || 0); t += (s.targets[m.key] ?? m.target); });
    return t > 0 ? Math.round((a / t) * 100) : 0;
  }
  function callsToday() {
    const s = S.get(); const t = s.days[S.todayKey()];
    return { done: t?.numbers?.calls || 0, target: s.targets.calls ?? 20 };
  }

  // ---- streak (consecutive logged workdays incl gaps forgiven on weekends) ----
  function streak() {
    const s = S.get(); let count = 0; let k = S.todayKey();
    // if today logged include it, else start yesterday
    for (let i = 0; i < 400; i++) {
      const rec = s.days[k];
      if (isWeekend(k)) { k = S.addDays(k, -1); continue; }
      const logged = rec && rec.logged && Object.keys(rec.numbers || {}).length > 0;
      if (i === 0 && !logged) { k = S.addDays(k, -1); continue; } // today not yet logged: don't break
      if (logged) { count++; k = S.addDays(k, -1); }
      else break;
    }
    return count;
  }

  // ---- improvement suggestions ----
  function suggestions(agg) {
    const tips = [];
    const conv = conversions(agg);

    // 1) biggest activity gap
    const gaps = agg.defs.map((d) => ({ ...agg.metrics[d.key], p: metricPace(agg.metrics[d.key]) }))
      .filter((m) => m.target > 0).sort((a, b) => a.p - b.p);
    if (gaps.length && gaps[0].p < 90) {
      tips.push({ tone: 'warn', text: `${gaps[0].label} are your biggest gap at ${gaps[0].p}% of target. Everything downstream depends on it — protect a fixed block for it tomorrow.` });
    }

    // 2) weakest conversion step
    if (conv.length) {
      const weak = [...conv].sort((a, b) => a.rate - b.rate)[0];
      if (weak && weak.rate > 0 && weak.rate < 0.35) {
        tips.push({ tone: 'warn', text: `Your ${weak.from} → ${weak.to} conversion is ${Math.round(weak.rate * 100)}%. Tighten the ask at this step — a small lift here beats more volume.` });
      }
      const strong = [...conv].sort((a, b) => b.rate - a.rate)[0];
      if (strong && strong.rate >= 0.5) {
        tips.push({ tone: 'good', text: `Leverage: your ${strong.from} → ${strong.to} conversion is elite at ${Math.round(strong.rate * 100)}%. Get more at-bats upstream — the back end already converts.` });
      }
    }

    // 3) missed logging
    if (agg.missedDays > 0) {
      tips.push({ tone: 'warn', text: `You missed logging ${agg.missedDays} day${agg.missedDays > 1 ? 's' : ''}. Log daily — your coach reports and predictions are only as good as your inputs.` });
    }

    // 4) consistency praise
    const st = streak();
    if (st >= 5) tips.push({ tone: 'good', text: `${st}-day logging streak. Consistency is the whole game — keep the chain alive.` });

    // 5) overall pace
    if (agg.pace >= 100) tips.push({ tone: 'good', text: `You're over target at ${agg.pace}% for this period. Bank the momentum — add one extra prospecting block to stretch the lead.` });
    else if (agg.pace >= 85) tips.push({ tone: 'good', text: `On pace at ${agg.pace}%. Close the small gaps and you finish the period on target.` });

    if (!tips.length) tips.push({ tone: 'good', text: 'Solid, balanced week. Pick one metric to push 10% higher and everything downstream follows.' });
    return tips;
  }

  // ---- predictive time management for tomorrow ----
  function predictive() {
    const s = S.get();
    const wk = aggregate(rangeKeys('weekly'));
    const defs = Data.activityDefs();
    const daysLeft = weekdaysLeftInWeek();
    const plans = [];

    // headline: calls to hit the weekly call target
    const calls = wk.metrics.calls;
    if (calls) {
      const remaining = Math.max(0, calls.target - calls.actual);
      const perDay = Math.ceil(remaining / daysLeft);
      const mins = perDay * (defs.find((d) => d.key === 'calls')?.minutesEach || 4);
      const hrs = Math.max(0.5, Math.round((mins / 60) * 2) / 2);
      if (remaining > 0) {
        plans.push({
          headline: true,
          text: `Tomorrow, do ~${hrs} hr${hrs === 1 ? '' : 's'} of calls (about ${perDay} dials) to stay on pace for your weekly target. Best window: 9–11am before admin creeps in.`,
        });
      } else {
        plans.push({ headline: true, text: `You're ahead on calls this week. Tomorrow, shift 45 min into converting warm pipeline instead of raw dialing.` });
      }
    }

    // second lever: lowest-pace activity that has minutes
    const timed = defs.filter((d) => d.minutesEach > 0 && d.key !== 'calls');
    const gap = timed.map((d) => ({ d, m: wk.metrics[d.key], p: metricPace(wk.metrics[d.key]) }))
      .sort((a, b) => a.p - b.p)[0];
    if (gap && gap.p < 100) {
      const remaining = Math.max(1, gap.m.target - gap.m.actual);
      const perDay = Math.ceil(remaining / daysLeft);
      const mins = perDay * gap.d.minutesEach;
      plans.push({ text: `${gap.d.label} is behind at ${gap.p}%. Block ~${Math.round(mins)} min tomorrow (${perDay} session${perDay > 1 ? 's' : ''}) to recover it.` });
    }

    // market focus hint using best converting funnel step
    const conv = conversions(wk);
    const strong = [...conv].sort((a, b) => b.rate - a.rate)[0];
    if (strong && strong.rate > 0) {
      plans.push({ text: `Your ${strong.from}→${strong.to} step converts best — point tomorrow's calls at the market/segment that feeds it.` });
    }
    return { daysLeft, plans };
  }

  // ---- full report object ----
  function buildReport(type, ref) {
    const s = S.get();
    const agg = aggregate(rangeKeys(type, ref));
    const conv = conversions(agg);
    const tips = suggestions(agg);
    const working = [];
    const improve = [];
    // what's working: metrics >= 100%
    agg.defs.forEach((d) => { const m = agg.metrics[d.key]; if (metricPace(m) >= 100 && m.target > 0) working.push(`${m.label} at ${metricPace(m)}% of target`); });
    Object.values(agg.outcomes).forEach((o) => { if (!o.bad && o.actual > 0) working.push(`${o.actual} × ${o.label}`); });
    // improve: metrics < 85%
    agg.defs.forEach((d) => { const m = agg.metrics[d.key]; if (metricPace(m) < 85 && m.target > 0) improve.push(`${m.label} running ${metricPace(m)}% of target`); });
    if (agg.missedDays) improve.push(`${agg.missedDays} day(s) not logged`);

    return {
      type, ref: ref || S.todayKey(),
      title: ({ daily: 'Daily', weekly: 'Weekly', fortnight: 'Fortnightly', month: 'Monthly', quarter: 'Quarterly', biyear: 'Bi-Yearly' })[type] + ' Report',
      rangeLabel: rangeLabel(type, ref),
      score: agg.pace, agg, conv,
      working: working.slice(0, 6),
      improve: improve.slice(0, 6),
      suggestions: tips,
      predictive: predictive(),
      generatedAt: Date.now(),
      coachName: s.profile.coachName || 'your coach',
      agentName: s.profile.name || 'Agent',
    };
  }

  // ---- plain-text export (for share / email to coach) ----
  function reportToText(r) {
    const L = [];
    L.push(`ELITE TRACKER — ${r.title}`);
    L.push(`${r.agentName}  ·  ${r.rangeLabel}`);
    L.push(`Overall pace: ${r.score}%`);
    L.push('');
    L.push('ACTIVITY vs TARGET');
    r.agg.defs.forEach((d) => { const m = r.agg.metrics[d.key]; L.push(`  ${m.label}: ${m.actual}/${m.target} (${metricPace(m)}%)`); });
    L.push('');
    if (r.working.length) { L.push("WHAT'S WORKING"); r.working.forEach((w) => L.push('  + ' + w)); L.push(''); }
    if (r.improve.length) { L.push('AREAS TO IMPROVE'); r.improve.forEach((w) => L.push('  ! ' + w)); L.push(''); }
    L.push('COACH SUGGESTIONS');
    r.suggestions.forEach((t) => L.push('  • ' + t.text));
    L.push('');
    L.push('PREDICTIVE — TOMORROW');
    r.predictive.plans.forEach((p) => L.push('  → ' + p.text));
    L.push('');
    L.push(`Prepared for ${r.coachName}. Sent from ELITE Tracker.`);
    return L.join('\n');
  }

  global.Intel = {
    rangeKeys, rangeLabel, aggregate, metricPace, conversions,
    todayPace, callsToday, streak, suggestions, predictive,
    buildReport, reportToText, weekdaysLeftInWeek,
  };
})(window);
