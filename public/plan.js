/* Planner: Today, Week and Goals.
 * A goal has topics, each lasting some number of study days. The server lays them onto the calendar (weekdays by default);
 * every laid day is a task on that date. Free tasks can be added to any day. Unfinished work can be moved by day or by week. */
(() => {
  'use strict';
  const CB = window.CB;
  if (!CB || !CB.D) return;
  const { $, h, icon, api, toast, fail, openMenu, arm, store, D } = CB;

  const TABS = ['today', 'week', 'weekend', 'habits', 'goals'];
  const P = (CB.P = {
    loaded: false, goals: [], topics: [], tasks: [], habits: [], weeks: new Map(), threshold: 70, dayMins: 480,
    tab: store.get('planTab', 'today'), day: D.today(), week: D.weekStart(D.today()), wkend: D.add(D.weekStart(D.today()), 5),
    openGoal: null, showArchived: false, editing: null, editTopic: null, openNotes: new Set(), refocus: null, stale: false,
  });
  if (!TABS.includes(P.tab)) P.tab = 'today';

  /* ================= time: minutes in, words out ================= */
  const fmtMins = (m) => { if (m == null) return ''; if (m < 60) return `${m}m`; const hh = Math.floor(m / 60); const mm = m % 60; return mm ? `${hh}h ${mm}m` : `${hh}h`; };
  const fmtTask = (m) => (m === P.dayMins ? 'Whole day' : m === Math.round(P.dayMins / 2) ? 'Half day' : fmtMins(m));
  const fmtPart = (m, dm) => { if (m >= dm && m % dm === 0) { const n = m / dm; return n === 1 ? '1 day' : `${n} days`; } return fmtMins(m); };
  const minsOf = (t) => (t.mins == null ? 0 : t.mins);

  // "45m", "2h", "1h30", "1.5 hours", "half day", "whole day", "3 days" (when days are allowed), a bare "4" counts as days when `bare` is set
  function parseDuration(str, o = {}) {
    const dm = o.dm || P.dayMins;
    const s = String(str || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!s) return null;
    let m;
    if (/^(half|1\/2)( a)? day$/.test(s)) return Math.round(dm / 2);
    if (/^(whole|full|all)( a)? day$/.test(s)) return dm;
    if (o.days !== false && (m = /^(\d+(?:\.\d+)?) ?(?:days?|d)$/.exec(s))) return Math.round(Number(m[1]) * dm);
    if ((m = /^(\d+(?:\.\d+)?) ?(?:hours?|hrs?|h)(?: ?(\d+) ?(?:minutes?|mins?|m)?)?$/.exec(s))) return Math.round(Number(m[1]) * 60 + (m[2] ? Number(m[2]) : 0));
    if ((m = /^(\d+(?:\.\d+)?) ?(?:minutes?|mins?|m)$/.exec(s))) return Math.round(Number(m[1]));
    if (o.bare && /^\d+$/.test(s)) return Number(s) * dm;
    return null;
  }
  const DUR_TAIL = /(?:^|[\s\-–—:,(])((?:half|1\/2)(?: a)? day|(?:whole|full|all)(?: a)? day|\d+(?:\.\d+)? ?(?:days?|d)|\d+(?:\.\d+)? ?(?:hours?|hrs?|h)(?: ?\d+ ?(?:minutes?|mins?|m)?)?|\d+(?:\.\d+)? ?(?:minutes?|mins?|m)|\d+)\)?\s*$/i;
  // "Gym 1h" -> { title: 'Gym', mins: 60 }
  function splitDuration(line, o = {}) {
    const text = String(line || '').trim();
    const m = DUR_TAIL.exec(text);
    if (!m) return { title: text, mins: null };
    const mins = parseDuration(m[1], o);
    const title = text.slice(0, m.index).replace(/[\s\-–—:,(]+$/, '').trim();
    if (mins == null || !title) return { title: text, mins: null };
    return { title, mins };
  }
  const clampMins = (m, hi = 1440) => Math.min(hi, Math.max(5, Math.round(m)));

  const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const WEEKDAYS = 31; const WEEKENDS = 96; const EVERY = 127;
  const maskHas = (mask, day) => ((mask >> D.dow(day)) & 1) === 1;
  function maskLabel(mask) {
    if (mask === EVERY) return 'Every day';
    if (mask === WEEKDAYS) return 'Weekdays';
    if (mask === WEEKENDS) return 'Weekends only';
    return DOW.filter((_, i) => (mask >> i) & 1).join(', ');
  }

  // The same layout rule the server uses: a part that fits in a day stays whole and joins what is already there.
  function layout(parts, start, mask, cap) {
    const used = new Map();
    let d = start;
    let last = start;
    const ok = (day) => ((mask >> D.dow(day)) & 1) === 1;
    for (const p of parts) {
      let rem = p.mins;
      while (rem > 0) {
        const need = Math.min(rem, cap);
        let g = 0;
        while ((!ok(d) || cap - (used.get(d) || 0) < need) && g++ < 800) d = D.add(d, 1);
        while (!ok(d) || cap - (used.get(d) || 0) < 1) d = D.add(d, 1);
        const take = Math.max(1, Math.min(rem, cap - (used.get(d) || 0)));
        used.set(d, (used.get(d) || 0) + take);
        last = d;
        rem -= take;
        if (cap - (used.get(d) || 0) < 15) d = D.add(d, 1);
      }
    }
    return { end: last, usedDays: used.size };
  }

  /* ================= indexes and numbers ================= */
  let byDay = new Map();
  let goalById = new Map();
  let topicById = new Map();
  let topicsByGoal = new Map();
  let tasksByGoal = new Map();
  let partCount = new Map();
  let tasksByHabit = new Map();
  const push = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
  const byDayId = (a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.id - b.id);

  function reindex() {
    byDay = new Map(); topicsByGoal = new Map(); tasksByGoal = new Map(); partCount = new Map(); tasksByHabit = new Map();
    goalById = new Map(P.goals.map((g) => [g.id, g]));
    topicById = new Map(P.topics.map((t) => [t.id, t]));
    for (const t of P.topics) push(topicsByGoal, t.goal_id, t);
    for (const t of P.tasks) {
      push(byDay, t.day, t);
      if (t.goal_id) push(tasksByGoal, t.goal_id, t);
      if (t.topic_id) partCount.set(t.topic_id, (partCount.get(t.topic_id) || 0) + 1);
      if (t.habit_id) push(tasksByHabit, t.habit_id, t);
    }
  }

  P.tasksOn = (day) => byDay.get(day) || [];
  P.activeGoals = () => P.goals.filter((g) => !g.archived);
  // habits you skipped are not "missed" work to rescue; only one-off and goal tasks are
  P.overdue = () => { const t = D.today(); return P.tasks.filter((x) => !x.done && x.day < t && !x.habit_id); };
  P.dayStatus = (day) => {
    const ts = P.tasksOn(day);
    if (!ts.length) return 'none';
    const done = ts.filter((t) => t.done).length;
    if (done === ts.length) return 'full';
    if (day < D.today()) return 'late';
    return done ? 'part' : 'open';
  };
  P.dayLoad = (day) => P.tasksOn(day).reduce((n, t) => n + minsOf(t), 0);
  P.fmtMins = fmtMins;

  P.topicStats = (tp) => {
    const ts = (tasksByGoal.get(tp.goal_id) || []).filter((t) => t.topic_id === tp.id);
    const done = ts.filter((t) => t.done).length;
    return { done, total: ts.length, doneMins: ts.filter((t) => t.done).reduce((n, t) => n + minsOf(t), 0) };
  };

  P.goalStats = (g) => {
    const today = D.today();
    const ts = (tasksByGoal.get(g.id) || []).filter((t) => t.topic_id);
    const total = ts.length;
    const done = ts.filter((t) => t.done).length;
    const totalMins = ts.reduce((n, t) => n + minsOf(t), 0);
    const doneMins = ts.filter((t) => t.done).reduce((n, t) => n + minsOf(t), 0);
    const late = ts.filter((t) => !t.done && t.day < today).length;
    const end = D.add(g.start, g.days - 1);
    const lastDay = ts.length ? ts[ts.length - 1].day : g.start;
    const slip = lastDay > end ? D.diff(end, lastDay) : 0;
    const dayNo = Math.min(g.days, Math.max(0, D.diff(g.start, today) + 1));
    const pct = totalMins ? Math.round((doneMins / totalMins) * 100) : 0;
    let state = 'track';
    if (total && done === total) state = 'finished';
    else if (today < g.start) state = 'later';
    else if (late) state = 'behind';
    else if (slip) state = 'over';
    const sideLine = state === 'finished' ? 'Finished' : state === 'later' ? `Starts ${D.short(g.start)}` : `${fmtMins(doneMins)} of ${fmtMins(totalMins)}, ${late ? `${late} behind` : 'on track'}`;
    return { total, done, late, end, lastDay, slip, dayNo, pct, state, sideLine, totalMins, doneMins, needDays: Math.max(1, D.diff(g.start, lastDay) + 1) };
  };

  P.streak = () => {
    const today = D.today();
    if (!P.tasks.length) return 0;
    const earliest = P.tasks[0].day;
    let n = 0;
    let d = today;
    for (let i = 0; i < 800 && d >= earliest; i++, d = D.add(d, -1)) {
      const ts = byDay.get(d);
      if (!ts || !ts.length) continue; // a day with nothing planned neither extends nor breaks it
      const pct = (ts.filter((t) => t.done).length / ts.length) * 100;
      if (pct >= P.threshold) n++;
      else if (d === today) continue; // today is still in progress
      else break;
    }
    return n;
  };

  // a habit's run of days done in a row (today only counts once it is ticked), its best run, and the last two weeks
  function habitStats(hb) {
    const today = D.today();
    const ts = (tasksByHabit.get(hb.id) || []).filter((t) => t.day <= today).sort(byDayId);
    let cur = 0;
    for (let i = ts.length - 1; i >= 0; i--) {
      if (ts[i].done) cur++;
      else if (ts[i].day === today) continue;
      else break;
    }
    let best = 0; let run = 0;
    for (const t of ts) { if (t.done) { run++; best = Math.max(best, run); } else run = 0; }
    const strip = [];
    const byD = new Map((tasksByHabit.get(hb.id) || []).map((t) => [t.day, t]));
    for (let i = 13; i >= 0; i--) { const d = D.add(today, -i); const t = byD.get(d); strip.push({ day: d, t, st: !t ? (maskHas(hb.days_mask, d) ? 'off' : 'none') : t.done ? 'done' : d === today ? 'now' : 'miss' }); }
    const doneCount = ts.filter((t) => t.done).length;
    return { cur, best, strip, doneCount, today: (byDay.get(today) || []).find((t) => t.habit_id === hb.id) };
  }

  function weekNums(ws) {
    const r = { planned: 0, done: 0, wdPlanned: 0, wdDone: 0, wePlanned: 0, weDone: 0, late: 0, late_ids: [], undone_ids: [] };
    const today = D.today();
    for (let i = 0; i < 7; i++) {
      const day = D.add(ws, i);
      for (const t of P.tasksOn(day)) {
        const we = i >= 5;
        r.planned++; if (we) r.wePlanned++; else r.wdPlanned++;
        if (t.done) { r.done++; if (we) r.weDone++; else r.wdDone++; } else {
          r.undone_ids.push(t.id);
          if (day < today && !t.habit_id) { r.late++; r.late_ids.push(t.id); }
        }
      }
    }
    r.pct = r.planned ? Math.round((r.done / r.planned) * 100) : 0;
    return r;
  }

  /* ================= data ================= */
  let loadSeq = 0;
  let loading = false;
  let again = false;
  async function load() {
    if (loading) { again = true; return; }
    loading = true;
    const seq = ++loadSeq;
    try {
      const d = await api(`/api/plan?today=${D.today()}`);
      if (seq !== loadSeq) return;
      P.goals = d.goals; P.topics = d.topics; P.tasks = d.tasks; P.habits = d.habits || [];
      P.weeks = new Map(d.weeks.map((w) => [w.start, w]));
      P.threshold = d.threshold || 70;
      P.dayMins = d.day_mins || 480;
      P.loaded = true;
      reindex();
      safeRender();
    } catch (e) { if (e.message !== 'Logged out') console.warn(e); } finally {
      loading = false;
      if (again) { again = false; load(); }
    }
  }

  async function run(fn, { reload = true } = {}) {
    try { const r = await fn(); if (reload) load(); return r; } catch (e) { fail(e); load(); return null; }
  }

  P.toggle = (t) => {
    t.done = !t.done;
    render();
    run(() => api(`/api/plan/tasks/${t.id}`, { method: 'PATCH', body: { done: t.done } }), { reload: false });
  };

  // "Gym 1h" adds "Gym" for an hour; "Read 30m" for half an hour; "Study half day" for half a day
  async function addTask(day, raw, goalId = null, mins = null) {
    const sp = mins == null ? splitDuration(raw, { days: false }) : { title: raw, mins };
    try {
      const t = await api('/api/plan/tasks', { method: 'POST', body: { day, title: sp.title, mins: sp.mins == null ? null : clampMins(sp.mins), goal_id: goalId || null } });
      P.tasks.push(t);
      P.tasks.sort(byDayId);
      reindex();
      render();
    } catch (e) { fail(e); }
  }
  P.addTask = addTask;

  const patchTask = (t, body) => run(() => api(`/api/plan/tasks/${t.id}`, { method: 'PATCH', body }));
  const removeTask = (t) => run(() => api(`/api/plan/tasks/${t.id}`, { method: 'DELETE' }));

  async function moveTasks(ids, body, msg) {
    if (!ids.length) return;
    const r = await run(() => api('/api/plan/move', { method: 'POST', body: { ids, ...body } }));
    if (r) toast(msg || `Moved ${r.moved} ${r.moved === 1 ? 'task' : 'tasks'}`);
  }

  async function fitTasks(ids) {
    const r = await run(() => api('/api/plan/fit', { method: 'POST', body: { ids, from: D.today() } }));
    if (r) toast(r.moved ? `Placed ${r.moved} ${r.moved === 1 ? 'task' : 'tasks'} into free time` : 'Nothing needed to move');
  }

  function saveWeek(ws, patch) {
    const cur = P.weeks.get(ws) || { start: ws, focus: '', outcome: '', review: '', rating: null };
    const next = { ...cur, ...patch };
    P.weeks.set(ws, next);
    return run(() => api(`/api/plan/week/${ws}`, { method: 'PUT', body: { focus: next.focus, outcome: next.outcome, review: next.review, rating: next.rating } }), { reload: false });
  }

  /* ================= small building blocks ================= */
  function dialog(title, body) {
    const dlg = h('dialog', { class: 'dlg ws-dlg', 'aria-label': title });
    dlg.append(h('div', { class: 'wd-body' }, h('h2', {}, title), body));
    dlg.addEventListener('close', () => dlg.remove());
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    document.body.append(dlg);
    dlg.showModal();
    return dlg;
  }

  function pickDay(title, start, onPick) {
    const input = h('input', { type: 'date', value: start, required: true });
    const form = h('form', { class: 'wd-form', onsubmit: (e) => { e.preventDefault(); if (input.value) { dlg.close(); onPick(input.value); } } },
      h('label', { class: 'field' }, h('span', {}, 'Day'), input),
      h('div', { class: 'wd-actions' },
        h('button', { type: 'button', class: 'btn', onclick: () => dlg.close() }, 'Cancel'),
        h('button', { type: 'submit', class: 'btn primary' }, 'Move here')));
    const dlg = dialog(title, form);
    input.focus();
  }

  const bar = (done, total, cls = '') => h('div', { class: `bar ${cls}`.trim(), role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(total), 'aria-valuenow': String(done) },
    h('i', { style: `width:${total ? Math.round((done / total) * 100) : 0}%` }));

  const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;
  const weekendOf = (from) => { const d = from < D.today() ? D.today() : from; return D.dow(d) >= 5 ? d : D.add(D.weekStart(d), 5); };
  const nextWeekDay = (t) => (t.day >= D.today() ? D.add(t.day, 7) : D.add(D.weekStart(D.today()), 7 + D.dow(t.day)));
  const satOf = (day) => D.add(D.weekStart(day), 5);
  const thisSat = () => satOf(D.today());
  const wkendLabel = (sat) => `${D.short(sat)} – ${D.short(D.add(sat, 1))}`;

  function iconBtn(name, label, onclick, cls = '') {
    return h('button', { type: 'button', class: `icon-btn ${cls}`.trim(), 'aria-label': label, title: label, onclick }, icon(name));
  }

  // a short dismissible hint at the top of a tab
  function tip(id, ...content) {
    if (store.get(`tip:${id}`, false)) return null;
    return h('aside', { class: 'tip', role: 'note' }, icon('info', 'sm'), h('div', {}, ...content),
      h('button', { type: 'button', class: 'btn sm', onclick: () => { store.set(`tip:${id}`, true); render(); } }, 'Got it'));
  }

  /* ----- how long: quick chips plus a box for anything else ----- */
  function timeField({ value = null, days = false, dm = P.dayMins, label = 'How long' }) {
    const opts = [['15m', 15], ['30m', 30], ['1h', 60], ['2h', 120], ['4h', 240], ['Half day', Math.round(dm / 2)], ['Whole day', dm]];
    const input = h('input', { type: 'text', class: 'tf-in', placeholder: days ? 'Type any time: 90m, 1h20, 3h, 2 days' : 'Type any time: 20m, 1h20, 3h', 'aria-label': label, autocomplete: 'off' });
    const chips = h('div', { class: 'chips', role: 'group', 'aria-label': label });
    const val = () => { const v = input.value.trim(); return v ? parseDuration(v, { days, dm, bare: days }) : null; };
    const sync = () => { const m = val(); for (const b of chips.children) b.setAttribute('aria-pressed', String(m != null && Number(b.dataset.m) === m)); };
    input.addEventListener('input', sync);
    if (value) input.value = value % dm === 0 && value >= dm ? fmtPart(value, dm) : fmtMins(value);
    sync();
    return {
      el: h('div', { class: 'time-field' }, input), input,
      value: val, empty: () => !input.value.trim(), bad: () => !!input.value.trim() && val() == null,
      setDm(n) { dm = n; },
    };
  }

  /* ----- which days of the week ----- */
  function dayPicker(mask, onChange) {
    let cur = mask;
    const wrap = h('div', { class: 'dow-pick' });
    const presets = h('div', { class: 'chips' });
    const row = h('div', { class: 'dow', role: 'group', 'aria-label': 'Days of the week' });
    const draw = () => {
      for (const b of row.children) b.setAttribute('aria-pressed', String(((cur >> Number(b.dataset.i)) & 1) === 1));
      for (const b of presets.children) b.setAttribute('aria-pressed', String(Number(b.dataset.m) === cur));
    };
    const set = (m) => { cur = m; draw(); if (onChange) onChange(cur); };
    for (const [txt, m] of [['Every day', EVERY], ['Weekdays', WEEKDAYS], ['Weekends only', WEEKENDS]]) {
      presets.append(h('button', { type: 'button', class: 'chip-pick', dataset: { m }, 'aria-pressed': 'false', onclick: () => set(m) }, txt));
    }
    DOW.forEach((n, i) => row.append(h('button', { type: 'button', class: 'dow-btn' + (i >= 5 ? ' we' : ''), dataset: { i }, 'aria-pressed': 'false', onclick: () => { const next = cur ^ (1 << i); set(next || cur); } }, n)));
    wrap.append(presets, row);
    draw();
    return { el: wrap, get: () => cur, set };
  }

  /* ================= task rows ================= */
  function timeMenu(t) { askTime(t); }
  function askTime(t) {
    const f = timeField({ value: t.mins, label: 'How long' });
    const err = h('p', { class: 'form-err', role: 'alert' });
    const canClear = !t.topic_id;
    const form = h('form', { class: 'wd-form', onsubmit: (e) => { e.preventDefault(); if (f.empty() && canClear) { dlg.close(); t.mins = null; render(); patchTask(t, { mins: null }); return; } const m = f.value(); if (m == null || m < 5 || m > 1440) { err.textContent = 'Type any time you like, for example 45m, 2h, 1h20 or half day (up to 24 hours).'; return; } dlg.close(); patchTask(t, { mins: m }); } },
      f.el, canClear ? h('p', { class: 'muted tiny' }, 'Leave it empty for no time.') : null, err, h('div', { class: 'wd-actions' }, h('button', { type: 'button', class: 'btn', onclick: () => dlg.close() }, 'Cancel'), h('button', { type: 'submit', class: 'btn primary' }, 'Save')));
    const dlg = dialog('How long will it take?', form);
    f.input.focus();
  }

  function taskMenu(t, anchor) {
    const today = D.today();
    const tomorrow = D.add(today, 1);
    const opts = [];
    if (!t.done) {
      if (t.day !== today) opts.push({ label: 'Move to today', icon: 'arrow', onSelect: () => moveTasks([t.id], { to: today }, 'Moved to today') });
      if (t.day !== tomorrow) opts.push({ label: 'Move to tomorrow', icon: 'arrow', onSelect: () => moveTasks([t.id], { to: tomorrow }, 'Moved to tomorrow') });
      if (D.dow(t.day) < 5) { const we = weekendOf(t.day); if (we !== t.day) opts.push({ label: 'Move to this weekend', icon: 'arrow', onSelect: () => moveTasks([t.id], { to: we }, `Moved to ${D.wd(we)} ${D.short(we)}`) }); }
      const nw = D.dow(t.day) >= 5 ? D.add(t.day >= today ? t.day : weekendOf(today), 7) : D.add(weekendOf(t.day), 7);
      opts.push({ label: 'Move to next weekend', icon: 'arrow', onSelect: () => moveTasks([t.id], { to: nw }, `Moved to ${D.wd(nw)} ${D.short(nw)}`) });
      opts.push({ label: 'Move to next week', icon: 'arrow', onSelect: () => moveTasks([t.id], { to: nextWeekDay(t) }, `Moved to ${D.wd(nextWeekDay(t))} ${D.short(nextWeekDay(t))}`) });
      opts.push({ label: 'Move to a day…', icon: 'calendar', onSelect: () => pickDay('Move this task', t.day, (d) => moveTasks([t.id], { to: d }, `Moved to ${D.short(d)}`)) });
    }
    opts.push({ label: t.mins ? `Change time (${fmtTask(t.mins)})` : 'Set how long it takes', icon: 'clock', onSelect: () => timeMenu(t, anchor) });
    opts.push({ label: t.note ? 'View or edit feedback' : 'Leave feedback or a follow-up', icon: 'text', onSelect: () => { P.openNotes.add(t.id); P.refocus = `note:${t.id}`; render(); } });
    if (t.habit_id) opts.push({ label: 'Edit this habit…', icon: 'flame', onSelect: () => { const hb = P.habits.find((x) => x.id === t.habit_id); if (hb) habitDialog(hb); } });
    if (!t.topic_id) opts.push({ label: 'Rename', icon: 'pencil', onSelect: () => { P.editing = t.id; render(); } });
    opts.push({ label: t.habit_id ? 'Skip this day' : 'Delete', icon: 'trash', onSelect: () => removeTask(t) });
    openMenu(anchor, null, opts);
  }

  function taskRow(t, o = {}) {
    const today = D.today();
    const goal = t.goal_id ? goalById.get(t.goal_id) : null;
    const late = !t.done && t.day < today && !t.habit_id;
    const li = h('li', { class: 'pt' + (t.done ? ' done' : '') + (late ? ' late' : '') + (o.compact ? ' compact' : ''), dataset: { id: t.id } });
    if (!t.done && !o.noDrag) {
      li.draggable = true;
      li.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', String(t.id)); e.dataTransfer.effectAllowed = 'move'; li.classList.add('dragging'); });
      li.addEventListener('dragend', () => li.classList.remove('dragging'));
    }
    const check = h('button', { type: 'button', class: 'pt-check', role: 'checkbox', 'aria-checked': String(t.done), 'aria-label': `${t.title}, ${t.done ? 'done' : 'not done'}`, onclick: () => P.toggle(t) }, icon('check'));

    let title;
    if (P.editing === t.id) {
      const input = h('input', { type: 'text', class: 'pt-edit', value: t.title, maxlength: '300', 'aria-label': 'Task name', dataset: { edit: t.id } });
      const finish = (save) => { P.editing = null; const v = input.value.trim(); if (save && v && v !== t.title) { t.title = v; patchTask(t, { title: v }); } render(); };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) finish(true); else if (e.key === 'Escape') finish(false); });
      input.addEventListener('blur', () => { if (P.editing === t.id) finish(true); });
      title = input;
      P.refocus = `edit:${t.id}`;
    } else {
      title = h('span', { class: 'pt-title' }, t.title);
    }

    const meta = h('span', { class: 'pt-meta' });
    if (t.mins) meta.append(h('button', { type: 'button', class: 'chip time', title: 'Change how long it takes', onclick: (e) => timeMenu(t, e.currentTarget) }, icon('clock', 'sm'), fmtTask(t.mins)));
    if (t.habit_id) meta.append(h('span', { class: 'chip goal', title: 'A habit that repeats' }, icon('flame', 'sm'), 'habit'));
    if (t.topic_id && (partCount.get(t.topic_id) || 0) > 1) meta.append(h('span', { class: 'chip' }, `part ${t.seq} of ${partCount.get(t.topic_id)}`));
    if (goal && !o.noGoal) meta.append(h('span', { class: 'chip goal', title: goal.title }, CB.trunc(goal.title, 22)));
    if (o.showDay) meta.append(h('span', { class: 'chip late' }, `${D.wd(t.day)} ${D.short(t.day)}`));
    if (t.moved > 0) meta.append(h('span', { class: 'chip warn', title: `Moved ${t.moved} ${t.moved === 1 ? 'time' : 'times'}` }, `moved ${t.moved}×`));
    if (t.note && !P.openNotes.has(t.id)) meta.append(h('button', { type: 'button', class: 'chip time', title: 'Show the feedback you left', onclick: () => { P.openNotes.add(t.id); P.refocus = `note:${t.id}`; render(); } }, icon('text', 'sm'), 'feedback'));

    const more = iconBtn('more', 'More: move, set time, note, delete', () => taskMenu(t, more), 'pt-more');
    li.append(check, h('div', { class: 'pt-main' }, title, meta), more);

    if (P.openNotes.has(t.id)) {
      const ta = h('textarea', { class: 'pt-note', rows: '2', placeholder: 'Feedback or a follow-up for this task. It stays hidden until you open it.', 'aria-label': `Note for ${t.title}`, dataset: { note: t.id } }, t.note || '');
      const grow = () => { ta.style.height = 'auto'; ta.style.height = `${Math.min(300, ta.scrollHeight + 2)}px`; };
      ta.addEventListener('input', grow);
      ta.addEventListener('blur', () => {
        const v = ta.value.trim();
        if (v !== (t.note || '')) { t.note = v; patchTask(t, { note: v }); }
        P.openNotes.delete(t.id); // hide it again; the feedback chip brings it back
        setTimeout(render, 0);
      });
      li.append(h('div', { class: 'pt-note-wrap' }, ta));
      setTimeout(grow, 0);
    }
    return li;
  }

  // The one place a task is added: type it, press Enter or the Add button. "More…" opens every option.
  function addRow(day, placeholder = 'Add a task') {
    const input = h('input', { type: 'text', class: 'pt-add', placeholder, maxlength: '300', 'aria-label': `Add a task for ${D.long(day)}`, dataset: { add: day } });
    const submit = () => {
      const v = input.value.trim();
      if (!v) { input.focus(); return; }
      input.value = '';
      P.refocus = `add:${day}`;
      addTask(day, v);
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) submit(); });
    return h('div', { class: 'add-row' }, input,
      h('button', { type: 'button', class: 'btn sm primary', onclick: submit }, icon('plus', 'sm'), 'Add'),
      h('button', { type: 'button', class: 'btn sm', title: 'Choose how long, repeat it, or attach it to a goal', onclick: () => addDialog({ day, title: input.value.trim() }) }, 'More…'));
  }

  function dropTarget(el, day) {
    el.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; el.classList.add('drop'); });
    el.addEventListener('dragleave', (e) => { if (!el.contains(e.relatedTarget)) el.classList.remove('drop'); });
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('drop');
      const id = Number(e.dataTransfer.getData('text/plain'));
      const t = P.tasks.find((x) => x.id === id);
      const to = typeof day === 'function' ? day(t) : day;
      if (t && !t.done && t.day !== to) moveTasks([id], { to }, `Moved to ${D.wd(to)} ${D.short(to)}`);
    });
  }

  // "Move unfinished" for a list of task ids sitting on `day`
  function moveMenu(anchor, ids, day) {
    const today = D.today();
    const opts = [];
    if (day < today) opts.push({ label: 'Move to today', icon: 'arrow', onSelect: () => moveTasks(ids, { to: today }) });
    if (D.add(today, 1) !== day) opts.push({ label: 'Move to tomorrow', icon: 'arrow', onSelect: () => moveTasks(ids, { to: D.add(today, 1) }) });
    if (D.dow(day) < 5) { const we = weekendOf(day); if (we !== day) opts.push({ label: 'Move to this weekend', icon: 'arrow', onSelect: () => moveTasks(ids, { to: we }) }); }
    opts.push({ label: 'Move to next week (same days)', icon: 'arrow', onSelect: () => moveTasks(ids, { shift: 7 }, 'Moved to next week') });
    opts.push({ label: 'Move to a day…', icon: 'calendar', onSelect: () => pickDay('Move these tasks', D.add(today, 1), (d) => moveTasks(ids, { to: d })) });
    openMenu(anchor, `Move ${plural(ids.length, 'unfinished task')}`, opts);
  }

  /* ================= Add dialog: what, when, how long, repeat, goal ================= */
  function addDialog({ day = D.today(), title = '', repeat = 'once', mins = null, goalId = '' } = {}) {
    const what = h('input', { type: 'text', maxlength: '300', required: true, value: title, placeholder: 'e.g. 35 push-ups, Gym, Read a chapter', 'aria-label': 'What' });
    const when = h('input', { type: 'date', value: day, required: true, 'aria-label': 'Day' });
    const tf = timeField({ value: mins, label: 'How long' });
    const sel = h('select', { 'aria-label': 'Repeat' },
      [['once', 'Just once'], ['every', 'Every day'], ['weekdays', 'Weekdays (Mon to Fri)'], ['weekends', 'Weekends only'], ['pick', 'Choose days…']].map(([v, l]) => h('option', { value: v, selected: v === repeat ? '' : null }, l)));
    sel.value = repeat;
    const dp = dayPicker(WEEKDAYS);
    const dpBox = h('div', { class: 'hide' }, dp.el);
    const goals = P.activeGoals();
    const gsel = goals.length ? h('select', { 'aria-label': 'Goal' }, h('option', { value: '' }, 'No goal'), goals.map((g) => h('option', { value: g.id }, g.title))) : null;
    if (gsel) gsel.value = String(goalId || '');
    const goalField = gsel ? h('label', { class: 'field' }, h('span', {}, 'Part of a goal (optional)'), gsel) : null;
    const hint = h('p', { class: 'muted tiny' });
    const err = h('p', { class: 'form-err', role: 'alert' });
    const sync = () => {
      dpBox.classList.toggle('hide', sel.value !== 'pick');
      if (goalField) goalField.classList.toggle('hide', sel.value !== 'once');
      hint.textContent = sel.value === 'once' ? 'It goes on the day you pick.' : 'Repeating things are habits: they appear every time and you can follow your streak on the Habits tab.';
    };
    sel.addEventListener('change', sync);
    sync();
    const maskOf = () => ({ every: EVERY, weekdays: WEEKDAYS, weekends: WEEKENDS, pick: dp.get() }[sel.value]);

    const form = h('form', { class: 'wd-form', onsubmit: async (e) => {
      e.preventDefault();
      err.textContent = '';
      const sp = tf.empty() ? splitDuration(what.value, { days: false }) : { title: what.value.trim(), mins: null };
      const m = tf.empty() ? sp.mins : tf.value();
      if (tf.bad() || (m != null && (m < 5 || m > 1440))) { err.textContent = 'Use something like 45m, 2h or half day (up to 24 hours).'; return; }
      const name = sp.title;
      if (!name) { what.focus(); return; }
      try {
        if (sel.value === 'once') {
          const t = await api('/api/plan/tasks', { method: 'POST', body: { day: when.value, title: name, mins: m, goal_id: gsel && gsel.value ? Number(gsel.value) : null } });
          P.tasks.push(t); P.tasks.sort(byDayId); reindex();
          toast(`Added for ${D.wd(when.value)} ${D.short(when.value)}`);
        } else {
          await api('/api/plan/habits', { method: 'POST', body: { title: name, mins: m, days_mask: maskOf(), start_date: when.value, today: D.today() } });
          toast(`Habit started: ${maskLabel(maskOf()).toLowerCase()}`);
          await load();
        }
        dlg.close();
        render();
      } catch (ex) { err.textContent = ex.message; }
    } },
      h('label', { class: 'field' }, h('span', {}, 'What do you want to do?'), what),
      h('div', { class: 'wd-row' },
        h('label', { class: 'field' }, h('span', {}, 'Day (or first day)'), when),
        h('label', { class: 'field' }, h('span', {}, 'Repeat'), sel)),
      dpBox,
      h('div', { class: 'field' }, h('span', {}, 'How long? (optional)'), tf.el),
      goalField, hint, err,
      h('div', { class: 'wd-actions' }, h('button', { type: 'button', class: 'btn', onclick: () => dlg.close() }, 'Cancel'), h('button', { type: 'submit', class: 'btn primary' }, 'Add')));
    const dlg = dialog('Add something', form);
    what.focus();
  }
  P.addDialog = addDialog;

  /* ================= header ================= */
  function tabsNav() {
    const behind = P.overdue().length;
    const streak = P.streak();
    const tab = (id, label, ic, badge) => h('button', { type: 'button', 'aria-current': String(P.tab === id), onclick: () => setTab(id) },
      icon(ic), h('span', { class: 'label' }, label), badge ? h('span', { class: 'count' }, badge) : null);
    const chip = h('button', { type: 'button', class: 'streak', title: `Days in a row with at least ${P.threshold}% of tasks done. Tap to change the target.`, onclick: () => openMenu(chip, 'A good day means…', [50, 70, 80, 100].map((n) => ({
      label: `${n}% of the day's tasks done`, radio: true, checked: P.threshold === n,
      onSelect: () => { P.threshold = n; render(); run(() => api('/api/plan/settings', { method: 'PUT', body: { threshold: n } }), { reload: false }); },
    }))) }, icon('flame', 'sm'), `${streak} ${streak === 1 ? 'day' : 'days'}`);
    return h('nav', { class: 'tabs plan-tabs', 'aria-label': 'Plan views' },
      tab('today', 'Day', 'calendar', behind || null), tab('week', 'Week', 'tasks'), tab('weekend', 'Weekend', 'sun'), tab('habits', 'Habits', 'flame'), tab('goals', 'Goals', 'target'),
      chip, h('button', { type: 'button', class: 'icon-btn help-btn', 'aria-label': 'How this works', title: 'How this works', onclick: helpDialog }, icon('info')));
  }

  function setTab(id) {
    P.tab = id;
    store.set('planTab', id);
    render();
    window.scrollTo({ top: 0 });
  }

  function navRow(label, sub, onPrev, onNext, onNow, nowLabel, showNow, extra) {
    return h('div', { class: 'nav-row' },
      iconBtn('left', 'Previous', onPrev),
      h('div', { class: 'nav-label' }, h('h2', {}, label), sub ? h('span', {}, sub) : null),
      iconBtn('right', 'Next', onNext),
      showNow ? h('button', { type: 'button', class: 'btn sm', onclick: onNow }, nowLabel) : null, extra || null);
  }

  function helpDialog() {
    const item = (t, d) => h('li', {}, h('b', {}, t), ' ', d);
    const body = h('div', { class: 'help' },
      h('ul', {},
        item('Add a task.', 'Type it in the box and press Enter, or press Add. Put the time in the words: "Gym 1h", "Read 30m", "Build site half day".'),
        item('Something you repeat?', 'Press More…, choose Repeat, and it becomes a habit (35 push-ups every morning, the gym on Mon, Wed, Fri). Habits are on their own tab with your streak.'),
        item('Plan by hours or days.', 'Every task can have a time. Each day shows how much is planned against a full day (8h unless you change it).'),
        item('Moved something?', 'It joins what is already on that day, so a day can hold several things. Drag a task onto another day, or use its … menu.'),
        item('Missed something?', 'The Missed box on Day lists everything unfinished. “Fit into free time” gives each one the nearest day with room.'),
        item('Weekends.', 'The Weekend tab shows Saturday and Sunday together. Move what is left to next weekend in one tap.'),
        item('Goals.', 'A goal is a bigger plan, like “Learn DevOps” or “Get fit”. Give each part a time (3h, 2 days) and choose the days it may use.')),
      h('div', { class: 'wd-actions' }, h('button', { type: 'button', class: 'btn primary', onclick: () => dlg.close() }, 'Got it')));
    const dlg = dialog('How this works', body);
  }

  /* ================= load bar for a day ================= */
  function loadLine(day) {
    const m = P.dayLoad(day);
    if (!m) return null;
    const dm = P.dayMins;
    const over = m > dm;
    const btn = h('button', { type: 'button', class: 'link-btn', title: 'Change how long a full day is', onclick: (e) => dayLenMenu(e.currentTarget) }, fmtMins(dm));
    return h('div', { class: 'load' + (over ? ' over' : '') },
      h('div', { class: 'load-bar', 'aria-hidden': 'true' }, h('i', { style: `width:${Math.min(100, Math.round((m / dm) * 100))}%` })),
      h('span', {}, over ? `${fmtMins(m)} planned, ${fmtMins(m - dm)} over a full day (` : `${fmtMins(m)} planned of a full day (`, btn, ')'));
  }
  function dayLenMenu() {
    const f = timeField({ value: P.dayMins, label: 'A full day' });
    const err = h('p', { class: 'form-err', role: 'alert' });
    const form = h('form', { class: 'wd-form', onsubmit: (e) => {
      e.preventDefault();
      const m = f.value();
      if (m == null || m < 30 || m > 1440) { err.textContent = 'Type something like 6h or 7h30 (at least 30 minutes).'; return; }
      dlg.close(); P.dayMins = m; render(); run(() => api('/api/plan/settings', { method: 'PUT', body: { day_mins: m } }));
    } }, f.el, err, h('div', { class: 'wd-actions' }, h('button', { type: 'button', class: 'btn', onclick: () => dlg.close() }, 'Cancel'), h('button', { type: 'submit', class: 'btn primary' }, 'Save')));
    const dlg = dialog('How long is a full day for you?', form);
    f.input.focus();
  }

  /* ================= Day view ================= */
  function viewDay() {
    const today = D.today();
    const day = P.day;
    const tasks = P.tasksOn(day);
    const done = tasks.filter((t) => t.done).length;
    const undone = tasks.filter((t) => !t.done);
    const out = [];
    const sub = day === today ? 'Today' : day === D.add(today, 1) ? 'Tomorrow' : day === D.add(today, -1) ? 'Yesterday' : D.isWeekend(day) ? 'Weekend' : '';
    out.push(navRow(D.fmt(day, { weekday: 'long', day: 'numeric', month: 'long' }), sub,
      () => { P.day = D.add(day, -1); CB.focusDay = P.day; render(); CB.renderSide(); },
      () => { P.day = D.add(day, 1); CB.focusDay = P.day; render(); CB.renderSide(); },
      () => { P.day = today; CB.focusDay = today; render(); CB.renderSide(); }, 'Today', day !== today));

    out.push(tip('today', h('b', {}, 'Type a task and press Enter. '), 'Add a time in the words ("Gym 1h", "Read 30m"). Use ', h('b', {}, 'More…'), ' to repeat it every day or on chosen days.'));

    if (day === today) {
      const late = P.overdue().sort(byDayId);
      if (late.length) {
        const ids = late.map((t) => t.id);
        const more = h('button', { type: 'button', class: 'btn sm', onclick: () => moveMenu(more, ids, late[0].day) }, icon('arrow', 'sm'), 'Move all…');
        const lateMins = late.reduce((n, t) => n + minsOf(t), 0);
        out.push(h('section', { class: 'ws-card behind' },
          h('div', { class: 'card-head' }, h('h3', {}, icon('clock', 'sm'), `Missed (${late.length})`), h('span', { class: 'spacer' })),
          h('p', { class: 'muted tiny' }, `Unfinished from earlier days${lateMins ? `, about ${fmtMins(lateMins)} of work` : ''}. Let the app find room for them, or choose where they go.`),
          h('ul', { class: 'pt-list' }, late.map((t) => taskRow(t, { showDay: true }))),
          h('div', { class: 'card-foot' },
            h('button', { type: 'button', class: 'btn sm primary', onclick: () => fitTasks(ids) }, icon('target', 'sm'), 'Fit into free time'),
            h('button', { type: 'button', class: 'btn sm', onclick: () => moveTasks(ids, { to: today }, 'Moved to today') }, 'All to today'), more)));
      }
    }

    const list = h('ul', { class: 'pt-list' }, tasks.map((t) => taskRow(t)));
    const foot = h('div', { class: 'card-foot' });
    if (undone.length) {
      const mv = h('button', { type: 'button', class: 'btn sm', onclick: () => moveMenu(mv, undone.map((t) => t.id), day) }, icon('arrow', 'sm'), `Move ${undone.length} unfinished`);
      foot.append(mv);
    }
    foot.append(h('button', { type: 'button', class: 'btn sm', onclick: () => { CB.setSection('diary'); if (CB.Dy) CB.Dy.open(day); } }, icon('book', 'sm'), 'Logbook for this day'));

    const card = h('section', { class: 'ws-card' + (D.isWeekend(day) ? ' weekend' : '') },
      h('div', { class: 'card-head' }, h('h3', {}, tasks.length ? `${done} of ${tasks.length} done` : 'Nothing planned'),
        tasks.length ? h('span', { class: 'pct' }, `${Math.round((done / tasks.length) * 100)}%`) : null),
      tasks.length ? bar(done, tasks.length) : null, loadLine(day),
      tasks.length ? list : h('p', { class: 'muted empty-line' }, D.isWeekend(day) ? 'Nothing for the weekend yet. Add what you want to get done.' : 'Nothing here yet. Add your first task below.'),
      addRow(day, 'Add a task, e.g. Gym 1h'),
      foot);
    dropTarget(card, day);
    out.push(card);
    if (!P.goals.length && !P.habits.length) {
      out.push(h('section', { class: 'ws-card hint' }, h('h3', {}, 'Start with something you want to keep up'),
        h('p', { class: 'muted' }, 'A habit repeats by itself. A goal is a bigger plan split into parts. Pick one to try:'),
        h('div', { class: 'starters' },
          h('button', { type: 'button', class: 'btn', onclick: () => addDialog({ day: today, title: '35 push-ups', repeat: 'every', mins: 10 }) }, icon('flame', 'sm'), 'Daily push-ups'),
          h('button', { type: 'button', class: 'btn', onclick: () => addDialog({ day: today, title: 'Read', repeat: 'every', mins: 30 }) }, icon('book', 'sm'), 'Read 30 minutes'),
          h('button', { type: 'button', class: 'btn', onclick: () => { setTab('goals'); newGoal('study'); } }, icon('target', 'sm'), 'Learn something in a month'),
          h('button', { type: 'button', class: 'btn', onclick: () => { setTab('goals'); newGoal('workout'); } }, icon('target', 'sm'), 'A workout plan'))));
    }
    return out;
  }

  /* ================= Week view ================= */
  function viewWeek() {
    const today = D.today();
    const ws = P.week;
    const thisWeek = D.weekStart(today);
    const days = Array.from({ length: 7 }, (_, i) => D.add(ws, i));
    const n = weekNums(ws);
    const wk = P.weeks.get(ws) || { focus: '', outcome: '', review: '', rating: null };
    const out = [];
    const sub = ws === thisWeek ? 'This week' : ws === D.add(thisWeek, 7) ? 'Next week' : ws === D.add(thisWeek, -7) ? 'Last week' : '';
    out.push(navRow(`${D.short(ws)} to ${D.short(days[6])}`, sub, () => { P.week = D.add(ws, -7); render(); }, () => { P.week = D.add(ws, 7); render(); }, () => { P.week = thisWeek; render(); }, 'This week', ws !== thisWeek));
    out.push(tip('week', 'Seven days at a glance. Drag a task onto another day to move it, and it joins what is already there. Tap a day name to open it.'));

    const cover = new Map();
    for (const day of days) for (const t of P.tasksOn(day)) {
      if (!t.topic_id) continue;
      const tp = topicById.get(t.topic_id);
      if (tp) cover.set(tp.id, { tp, n: (cover.get(tp.id)?.n || 0) + 1 });
    }
    const weekMins = days.reduce((m, d) => m + P.dayLoad(d), 0);

    const focus = h('input', { type: 'text', class: 'wk-in', value: wk.focus, maxlength: '400', placeholder: 'e.g. Get comfortable with Docker', 'aria-label': 'Focus for this week' });
    focus.addEventListener('change', () => saveWeek(ws, { focus: focus.value.trim() }));
    const outcome = h('input', { type: 'text', class: 'wk-in', value: wk.outcome, maxlength: '600', placeholder: 'e.g. build and run my own image', 'aria-label': 'By the end of the week I can' });
    outcome.addEventListener('change', () => saveWeek(ws, { outcome: outcome.value.trim() }));

    out.push(h('section', { class: 'ws-card' },
      h('div', { class: 'wk-bars' },
        h('div', {}, h('div', { class: 'bar-label' }, h('span', {}, 'Weekdays'), h('b', {}, `${n.wdDone}/${n.wdPlanned}`)), bar(n.wdDone, n.wdPlanned)),
        h('div', {}, h('div', { class: 'bar-label' }, h('span', {}, 'Weekend'), h('b', {}, `${n.weDone}/${n.wePlanned}`)), bar(n.weDone, n.wePlanned, 'we'))),
      h('p', { class: 'wk-sum' }, n.planned ? `${n.done} of ${n.planned} done (${n.pct}%)${n.late ? `, ${n.late} behind` : ''}${weekMins ? `. ${fmtMins(weekMins)} planned.` : ''}` : 'Nothing planned this week yet.'),
      cover.size ? h('div', { class: 'cover' }, [...cover.values()].map(({ tp, n: c }) => h('span', { class: 'chip goal' }, `${tp.title} ×${c}`))) : null,
      h('label', { class: 'wk-field' }, h('span', {}, 'Focus this week'), focus),
      h('label', { class: 'wk-field' }, h('span', {}, 'By Sunday I can…'), outcome)));

    if (!n.wePlanned && ws >= thisWeek) {
      out.push(h('p', { class: 'weekend-nudge' }, icon('calendar', 'sm'), 'The weekend is empty.', h('button', { type: 'button', class: 'link-btn', onclick: () => { P.wkend = D.add(ws, 5); setTab('weekend'); } }, 'Plan the weekend')));
    }

    const grid = h('div', { class: 'wk-grid' });
    for (const day of days) {
      const ts = P.tasksOn(day);
      const dn = ts.filter((t) => t.done).length;
      const lm = P.dayLoad(day);
      const cls = 'wk-day' + (day === today ? ' today' : '') + (D.isWeekend(day) ? ' weekend' : '') + (day < today ? ' past' : '');
      const head = h('button', { type: 'button', class: 'wk-head', title: 'Open this day', onclick: () => { P.day = day; CB.focusDay = day; setTab('today'); CB.renderSide(); } },
        h('b', {}, D.wd(day)), h('span', {}, D.fmt(day, { day: 'numeric', month: 'short' })), D.isWeekend(day) ? h('em', {}, 'weekend') : null,
        h('span', { class: 'spacer' }), lm ? h('small', { class: lm > P.dayMins ? 'over' : '' }, fmtMins(lm)) : null, ts.length ? h('small', {}, `${dn}/${ts.length}`) : null);
      const card = h('div', { class: cls }, head, ts.length ? bar(dn, ts.length) : null,
        h('ul', { class: 'pt-list' }, ts.map((t) => taskRow(t, { compact: true, noGoal: true }))), addRow(day, '+ task'));
      dropTarget(card, day);
      grid.append(card);
    }
    out.push(grid);

    const noted = days.flatMap((d) => P.tasksOn(d).filter((t) => t.note));
    out.push(h('section', { class: 'ws-card' },
      h('div', { class: 'card-head' }, h('h3', {}, 'Learning log')),
      noted.length ? h('ul', { class: 'log' }, noted.map((t) => h('li', {}, h('b', {}, `${D.wd(t.day)} · ${t.title}`), h('p', {}, t.note))))
        : h('p', { class: 'muted' }, 'Open a task’s … menu and choose “Add a note” to write what you learned or what got in the way. Your notes collect here.')));

    const rating = wk.rating;
    const review = h('textarea', { class: 'wk-review', rows: '4', placeholder: 'What went well? What slipped? What will you do differently next week?', 'aria-label': 'Weekly review' }, wk.review);
    review.addEventListener('blur', () => { if (review.value !== wk.review) saveWeek(ws, { review: review.value }); });
    const rate = h('div', { class: 'rate', role: 'radiogroup', 'aria-label': 'How was this week' },
      [['Rough', 1], ['Slow', 2], ['Okay', 3], ['Good', 4], ['Great', 5]].map(([l, v]) =>
        h('button', { type: 'button', role: 'radio', 'aria-checked': String(rating === v), onclick: () => { saveWeek(ws, { rating: rating === v ? null : v }); render(); } }, l)));
    const carry = n.late_ids.length || (ws < thisWeek && n.undone_ids.length)
      ? (() => { const ids = ws < thisWeek ? n.undone_ids : n.late_ids; return h('button', { type: 'button', class: 'btn primary', onclick: () => moveTasks(ids, { shift: 7 }, 'Carried to next week') }, icon('arrow', 'sm'), `Carry ${plural(ids.length, 'unfinished task')} to next week`); })()
      : null;

    const diaryBits = [];
    const Dy = CB.Dy;
    if (Dy && Dy.loaded) for (const day of days) { const e = Dy.get(day); if (e && e.snip) diaryBits.push(h('li', {}, h('b', {}, `${D.wd(day)}`), h('span', { class: `mood-dot m${e.mood || 0}` }), h('span', {}, CB.trunc(e.snip, 110)))); }

    out.push(h('section', { class: 'ws-card review' },
      h('div', { class: 'card-head' }, h('h3', {}, 'Weekly review'), h('span', { class: 'spacer' }), rate),
      h('div', { class: 'review-stats' },
        h('div', {}, h('b', {}, n.planned), h('span', {}, 'planned')), h('div', {}, h('b', {}, n.done), h('span', {}, 'done')),
        h('div', {}, h('b', {}, n.undone_ids.length), h('span', {}, 'open')), h('div', {}, h('b', {}, `${n.pct}%`), h('span', {}, 'complete'))),
      review, carry ? h('div', { class: 'card-foot' }, carry) : null,
      diaryBits.length ? h('div', { class: 'diary-bits' }, h('h4', {}, 'From your logbook this week'), h('ul', {}, diaryBits)) : null));

    const hist = [];
    for (let i = 7; i >= 0; i--) {
      const w = D.add(thisWeek, -7 * i);
      const hn = weekNums(w);
      hist.push(h('button', { type: 'button', class: 'hist-col' + (w === ws ? ' sel' : ''), title: `Week of ${D.short(w)}: ${hn.done} of ${hn.planned} done`, onclick: () => { P.week = w; render(); window.scrollTo({ top: 0 }); } },
        h('span', { class: 'hist-bar' }, h('i', { style: `height:${hn.pct}%` })), h('small', {}, D.short(w)), h('b', {}, hn.planned ? `${hn.pct}%` : '–')));
    }
    out.push(h('section', { class: 'ws-card' }, h('div', { class: 'card-head' }, h('h3', {}, 'Last eight weeks')), h('div', { class: 'hist' }, hist)));
    return out;
  }

  /* ================= Weekend view: Saturday and Sunday together, easy to carry from one weekend to the next ================= */
  function viewWeekend() {
    const today = D.today();
    const sat = P.wkend;
    const sun = D.add(sat, 1);
    const cur = thisSat();
    const out = [];
    const ids = [...P.tasksOn(sat), ...P.tasksOn(sun)].filter((t) => !t.done).map((t) => t.id);
    const sub = sat === cur ? 'This weekend' : sat === D.add(cur, 7) ? 'Next weekend' : sat < cur ? 'Past weekend' : '';
    out.push(navRow(wkendLabel(sat), sub, () => { P.wkend = D.add(sat, -7); render(); }, () => { P.wkend = D.add(sat, 7); render(); },
      () => { P.wkend = cur; render(); }, 'This weekend', sat !== cur,
      sat !== D.add(cur, 7) ? h('button', { type: 'button', class: 'btn sm', onclick: () => { P.wkend = D.add(cur, 7); render(); } }, 'Next weekend') : null));
    out.push(tip('weekend', 'Plan Saturday and Sunday here. Anything you do not get to can go to next weekend in one tap. You can also drag a task onto another weekend below.'));

    // the coming weekends, each one a place to drop a task
    const strip = h('div', { class: 'wk-strip', role: 'group', 'aria-label': 'Weekends' });
    for (let i = -1; i < 7; i++) {
      const s = D.add(cur, 7 * i);
      const cnt = P.tasksOn(s).length + P.tasksOn(D.add(s, 1)).length;
      const b = h('button', { type: 'button', class: 'wk-chip' + (s === sat ? ' sel' : '') + (s < cur ? ' past' : ''), 'aria-pressed': String(s === sat), onclick: () => { P.wkend = s; render(); } },
        h('b', {}, s === cur ? 'This weekend' : s === D.add(cur, 7) ? 'Next weekend' : wkendLabel(s)), h('span', {}, s === cur || s === D.add(cur, 7) ? wkendLabel(s) : ''), h('small', {}, cnt ? plural(cnt, 'task') : 'free'));
      dropTarget(b, (t) => (t && D.dow(t.day) === 6 ? D.add(s, 1) : s));
      strip.append(b);
    }
    out.push(strip);

    const cards = h('div', { class: 'we-grid' });
    for (const day of [sat, sun]) {
      const ts = P.tasksOn(day);
      const dn = ts.filter((t) => t.done).length;
      const card = h('section', { class: 'ws-card weekend' + (day === today ? ' now' : '') },
        h('div', { class: 'card-head' }, h('h3', {}, D.fmt(day, { weekday: 'long', day: 'numeric', month: 'short' })), ts.length ? h('span', { class: 'pct' }, `${dn}/${ts.length}`) : null),
        ts.length ? bar(dn, ts.length, 'we') : null, loadLine(day),
        ts.length ? h('ul', { class: 'pt-list' }, ts.map((t) => taskRow(t))) : h('p', { class: 'muted empty-line' }, 'Nothing planned. Add something below.'),
        addRow(day, 'Add a task, e.g. Football 2h'));
      dropTarget(card, day);
      cards.append(card);
    }
    out.push(cards);

    if (ids.length) {
      const nextSat = D.add(sat, 7);
      const more = h('button', { type: 'button', class: 'btn sm', onclick: () => openMenu(more, 'Move what is left to…', [1, 2, 3, 4].map((k) => ({ label: `${wkendLabel(D.add(sat, 7 * k))}${k === 1 ? ' (next weekend)' : ''}`, icon: 'arrow', onSelect: () => moveTasks(ids, { shift: 7 * k }, `Moved to ${wkendLabel(D.add(sat, 7 * k))}`) }))) }, 'Another weekend…');
      out.push(h('section', { class: 'ws-card' },
        h('div', { class: 'card-head' }, h('h3', {}, `${plural(ids.length, 'task')} not done yet`)),
        h('div', { class: 'card-foot' },
          h('button', { type: 'button', class: 'btn primary', onclick: () => moveTasks(ids, { shift: 7 }, `Moved to ${wkendLabel(nextSat)}`) }, icon('arrow', 'sm'), `Move to next weekend (${wkendLabel(nextSat)})`), more)));
    }

    const wg = P.activeGoals().filter((g) => (g.days_mask & WEEKDAYS) === 0);
    if (wg.length) {
      out.push(h('section', { class: 'ws-card' }, h('div', { class: 'card-head' }, h('h3', {}, 'Weekend goals')),
        wg.map((g) => { const st = P.goalStats(g); return h('div', { class: 'wg' }, h('b', {}, g.title), bar(st.doneMins, st.totalMins), h('span', { class: 'muted tiny' }, st.sideLine)); })));
    } else {
      out.push(h('p', { class: 'muted tiny' }, 'Want a plan that only uses weekends? Make a goal and pick “Weekends only” for its days.'));
    }
    return out;
  }

  /* ================= Habits view ================= */
  function viewHabits() {
    const out = [];
    const today = D.today();
    out.push(h('div', { class: 'nav-row' }, h('div', { class: 'nav-label' }, h('h2', {}, 'Habits'), h('span', {}, 'Things you want to repeat, like exercise or reading')), h('span', { class: 'spacer' }),
      h('button', { type: 'button', class: 'btn primary', onclick: () => addDialog({ day: today, repeat: 'every' }) }, icon('plus', 'sm'), 'New habit')));
    out.push(tip('habits', 'A habit appears on every day you choose. Tick it when done and watch the run of days grow. Missing a day is fine: it never piles up as work you owe.'));
    if (!P.habits.length) {
      out.push(h('section', { class: 'ws-card hint' }, h('h3', {}, 'No habits yet'),
        h('p', { class: 'muted' }, 'Pick one to start, or make your own.'),
        h('div', { class: 'starters' },
          h('button', { type: 'button', class: 'btn', onclick: () => addDialog({ day: today, title: '35 push-ups', repeat: 'every', mins: 10 }) }, '35 push-ups, every day'),
          h('button', { type: 'button', class: 'btn', onclick: () => addDialog({ day: today, title: 'Gym', repeat: 'pick', mins: 60 }) }, 'Gym, 1 hour'),
          h('button', { type: 'button', class: 'btn', onclick: () => addDialog({ day: today, title: 'Read', repeat: 'every', mins: 30 }) }, 'Read 30 minutes'),
          h('button', { type: 'button', class: 'btn', onclick: () => addDialog({ day: today, repeat: 'every' }) }, 'My own…'))));
    }
    for (const hb of P.habits) {
      const st = habitStats(hb);
      const done = st.today && st.today.done;
      const card = h('section', { class: 'ws-card habit' + (hb.active ? '' : ' paused') },
        h('div', { class: 'hab-top' },
          st.today ? h('button', { type: 'button', class: 'pt-check', role: 'checkbox', 'aria-checked': String(!!done), 'aria-label': `${hb.title} today, ${done ? 'done' : 'not done'}`, onclick: () => P.toggle(st.today) }, icon('check')) : h('span', { class: 'pt-check off', 'aria-hidden': 'true' }),
          h('div', { class: 'hab-main' }, h('h3', {}, hb.title),
            h('span', { class: 'muted tiny' }, `${maskLabel(hb.days_mask)}${hb.mins ? ` · ${fmtTask(hb.mins)}` : ''}${hb.active ? '' : ' · paused'}${st.today ? '' : hb.active ? ' · not today' : ''}`)),
          h('div', { class: 'hab-n' }, h('b', {}, st.cur), h('span', {}, st.cur === 1 ? 'day in a row' : 'days in a row'))),
        h('div', { class: 'strip', role: 'img', 'aria-label': 'Last 14 days' }, st.strip.map((c) => h('i', { class: `sq ${c.st}`, title: `${D.wd(c.day)} ${D.short(c.day)}${c.st === 'done' ? ': done' : c.st === 'miss' ? ': missed' : ''}` }))),
        h('div', { class: 'hab-foot' }, h('span', { class: 'muted tiny' }, `Best run ${st.best} · ${plural(st.doneCount, 'day')} done in total`), h('span', { class: 'spacer' }),
          h('button', { type: 'button', class: 'btn sm', onclick: () => habitDialog(hb) }, icon('pencil', 'sm'), 'Edit'),
          h('button', { type: 'button', class: 'btn sm', onclick: () => run(() => api(`/api/plan/habits/${hb.id}`, { method: 'PATCH', body: { active: !hb.active, today } })) }, hb.active ? 'Pause' : 'Resume'),
          arm(h('button', { type: 'button', class: 'btn sm danger' }, icon('trash', 'sm'), 'Delete'), () => run(() => api(`/api/plan/habits/${hb.id}`, { method: 'DELETE' })), 'Delete habit?')));
      out.push(card);
    }
    return out;
  }

  function habitDialog(hb) {
    const what = h('input', { type: 'text', maxlength: '200', required: true, value: hb.title, 'aria-label': 'Habit' });
    const tf = timeField({ value: hb.mins, label: 'How long each time' });
    const dp = dayPicker(hb.days_mask);
    const err = h('p', { class: 'form-err', role: 'alert' });
    const form = h('form', { class: 'wd-form', onsubmit: async (e) => {
      e.preventDefault();
      const m = tf.value();
      if (tf.bad() || (m != null && (m < 5 || m > 1440))) { err.textContent = 'Use something like 45m, 2h or half day.'; return; }
      dlg.close();
      await run(() => api(`/api/plan/habits/${hb.id}`, { method: 'PATCH', body: { title: what.value.trim(), mins: m, days_mask: dp.get(), today: D.today() } }));
      toast('Habit updated from tomorrow on');
    } },
      h('label', { class: 'field' }, h('span', {}, 'Habit'), what),
      h('div', { class: 'field' }, h('span', {}, 'On which days'), dp.el),
      h('div', { class: 'field' }, h('span', {}, 'How long each time (optional)'), tf.el),
      h('p', { class: 'muted tiny' }, 'Days already done or in the past stay as they are.'), err,
      h('div', { class: 'wd-actions' }, h('button', { type: 'button', class: 'btn', onclick: () => dlg.close() }, 'Cancel'), h('button', { type: 'submit', class: 'btn primary' }, 'Save')));
    const dlg = dialog('Edit habit', form);
    what.focus();
  }

  /* ================= Goals view ================= */
  function viewGoals() {
    const out = [];
    const active = P.activeGoals();
    const archived = P.goals.filter((g) => g.archived);
    out.push(h('div', { class: 'nav-row' }, h('div', { class: 'nav-label' }, h('h2', {}, 'Goals'), h('span', {}, 'A bigger plan, split into parts that each take some time')), h('span', { class: 'spacer' }),
      h('button', { type: 'button', class: 'btn primary', onclick: () => newGoal() }, icon('plus', 'sm'), 'New goal')));
    out.push(tip('goals', 'A goal can be learning (“Learn DevOps”), training (“Get stronger”) or a project. List its parts with how long each takes, such as ', h('b', {}, '3h'), ', ', h('b', {}, '90m'), ' or ', h('b', {}, '2 days'), '. Choose which days it may use and it lays itself out.'));
    if (!active.length) {
      out.push(h('section', { class: 'ws-card hint' }, h('h3', {}, 'No goals yet'),
        h('p', { class: 'muted' }, 'Start from an example and change it, or build your own.'),
        h('div', { class: 'starters' },
          h('button', { type: 'button', class: 'btn primary', onclick: () => newGoal('study') }, 'Learn something in a month'),
          h('button', { type: 'button', class: 'btn', onclick: () => newGoal('workout') }, 'A workout plan'),
          h('button', { type: 'button', class: 'btn', onclick: () => newGoal() }, 'Start blank'))));
    }
    for (const g of active) out.push(goalCard(g));
    if (archived.length) {
      out.push(h('button', { type: 'button', class: 'link-btn', onclick: () => { P.showArchived = !P.showArchived; render(); } }, `${P.showArchived ? 'Hide' : 'Show'} ${archived.length} archived`));
      if (P.showArchived) for (const g of archived) out.push(goalCard(g));
    }
    return out;
  }

  const STATE_LABEL = { track: ['On track', 'ok'], behind: ['Behind', 'warn'], over: ['Running late', 'warn'], finished: ['Finished', 'ok'], later: ['Not started', ''] };

  function goalCard(g) {
    const st = P.goalStats(g);
    const open = P.openGoal === g.id;
    const today = D.today();
    const [stLabel, stCls] = STATE_LABEL[st.state];
    const cells = (tasksByGoal.get(g.id) || []).filter((t) => t.topic_id).map((t) => {
      const cls = 'cell' + (t.done ? ' done' : t.day < today ? ' late' : t.day === today ? ' now' : '');
      return h('i', { class: cls, title: `${t.title} (${fmtMins(t.mins)}), ${D.wd(t.day)} ${D.short(t.day)}` });
    });
    const card = h('section', { class: 'ws-card goal' + (g.archived ? ' archived' : '') + (open ? ' open' : '') });
    card.append(h('button', { type: 'button', class: 'goal-head', 'aria-expanded': String(open), onclick: () => { P.openGoal = open ? null : g.id; render(); } },
      h('div', { class: 'goal-title' }, h('h3', {}, g.title), h('span', { class: `chip ${stCls}` }, g.archived ? 'Archived' : stLabel)),
      h('div', { class: 'goal-sub' }, `${D.short(g.start)} to ${D.short(st.end)} · ${maskLabel(g.days_mask)} · ${fmtMins(g.day_mins)} a day`)));
    card.append(h('div', { class: 'goal-prog' }, bar(st.doneMins, st.totalMins), h('span', {}, st.totalMins ? `${fmtMins(st.doneMins)} of ${fmtMins(st.totalMins)} done` : 'No parts yet')));
    if (cells.length) card.append(h('div', { class: 'timeline', 'aria-hidden': 'true' }, cells));

    const notes = [];
    if (st.late) notes.push(h('p', { class: 'goal-note warn' }, icon('clock', 'sm'), `${plural(st.late, 'session')} behind. Open the goal and press “Reschedule the rest” to slide them later.`));
    if (st.slip) {
      notes.push(h('p', { class: 'goal-note warn' }, icon('target', 'sm'), `The plan now runs to ${D.wd(st.lastDay)} ${D.short(st.lastDay)}, ${plural(st.slip, 'day')} after the goal date.`,
        h('button', { type: 'button', class: 'link-btn', onclick: () => run(() => api(`/api/plan/goals/${g.id}`, { method: 'PATCH', body: { days: Math.min(366, st.needDays) } })) }, `Extend to ${st.needDays} days`)));
    }
    card.append(...notes);
    if (open) card.append(goalDetail(g, st));
    return card;
  }

  function goalDetail(g, st) {
    const today = D.today();
    const tps = topicsByGoal.get(g.id) || [];
    const box = h('div', { class: 'goal-detail' });
    const table = h('ol', { class: 'topics' });
    tps.forEach((tp, i) => {
      const ts = P.topicStats(tp);
      const from = D.today();
      const joined = tp.join_prev && i > 0;
      let name;
      if (P.editTopic === tp.id) {
        name = h('input', { type: 'text', class: 'tp-name', value: tp.title, maxlength: '200', 'aria-label': 'Part name' });
        const done = (save) => { P.editTopic = null; const v = name.value.trim(); if (save && v && v !== tp.title) run(() => api(`/api/plan/topics/${tp.id}`, { method: 'PATCH', body: { title: v, from } })); else render(); };
        name.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(true); else if (e.key === 'Escape') done(false); });
        name.addEventListener('blur', () => { if (P.editTopic === tp.id) done(true); });
        P.refocus = `topic:${tp.id}`;
        name.dataset.topic = tp.id;
      } else {
        name = h('button', { type: 'button', class: 'tp-title', title: 'Rename', onclick: () => { P.editTopic = tp.id; render(); } }, tp.title);
      }
      const time = h('input', { type: 'text', class: 'tp-time', value: fmtPart(tp.mins, g.day_mins), 'aria-label': `Time for ${tp.title}`, title: 'For example 3h, 90m or 2 days', autocomplete: 'off' });
      time.addEventListener('change', () => {
        const v = parseDuration(time.value, { days: true, dm: g.day_mins, bare: true });
        if (v == null || v < 5 || v > 100000) { time.value = fmtPart(tp.mins, g.day_mins); toast('Try 3h, 90m or 2 days'); return; }
        run(() => api(`/api/plan/topics/${tp.id}`, { method: 'PATCH', body: { mins: v, from } }));
      });
      table.append(h('li', { class: 'topic' + (ts.total && ts.done === ts.total ? ' done' : '') + (joined ? ' joined' : '') },
        h('span', { class: 'tp-n' }, i + 1), name,
        h('label', { class: 'tp-d' }, time),
        h('span', { class: 'tp-prog' }, `${fmtMins(ts.doneMins)}/${fmtMins(tp.mins)}`),
        h('span', { class: 'tp-act' },
          iconBtn('left', joined ? 'Already on the same day as the part above' : 'Join the part above: share its day', () => { if (!joined && i > 0) run(() => api(`/api/plan/topics/${tp.id}`, { method: 'PATCH', body: { join: true, from } })); }, 'rot-up' + (i === 0 || joined ? ' dim' : '')),
          iconBtn('right', joined ? 'Separate from the part above: its own day' : 'Not joined to the part above', () => { if (joined) run(() => api(`/api/plan/topics/${tp.id}`, { method: 'PATCH', body: { join: false, from } })); }, 'rot-down' + (joined ? '' : ' dim')),
          arm(h('button', { type: 'button', class: 'icon-btn danger', 'aria-label': `Delete ${tp.title}`, title: 'Delete this part' }, icon('trash')), () => run(() => api(`/api/plan/topics/${tp.id}?from=${from}`, { method: 'DELETE' })), 'Delete?'))));
    });
    box.append(tps.length ? table : h('p', { class: 'muted' }, 'No parts yet. Add the first one below.'));

    const tIn = h('input', { type: 'text', class: 'tp-new', placeholder: 'New part, e.g. Docker', maxlength: '200', 'aria-label': 'New part name' });
    const dIn = h('input', { type: 'text', class: 'tp-time', value: fmtPart(g.day_mins, g.day_mins), 'aria-label': 'Time for the new part', title: 'For example 3h, 90m or 2 days', autocomplete: 'off' });
    const addPart = () => {
      const title = tIn.value.trim();
      const m = parseDuration(dIn.value, { days: true, dm: g.day_mins, bare: true });
      if (!title) { tIn.focus(); return; }
      if (m == null || m < 5) { dIn.focus(); toast('Try 3h, 90m or 2 days'); return; }
      tIn.value = '';
      run(() => api(`/api/plan/goals/${g.id}/topics`, { method: 'POST', body: { title, mins: m, from: today } }));
      P.refocus = `newtopic:${g.id}`;
    };
    tIn.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) addPart(); });
    dIn.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) addPart(); });
    tIn.dataset.newtopic = g.id;
    box.append(h('div', { class: 'tp-add' }, tIn, h('label', { class: 'tp-d' }, dIn), h('button', { type: 'button', class: 'btn sm', onclick: addPart }, icon('plus', 'sm'), 'Add part')));

    // when and for how long
    const dp = dayPicker(g.days_mask, null);
    const apply = h('button', { type: 'button', class: 'btn sm', onclick: () => run(() => api(`/api/plan/goals/${g.id}`, { method: 'PATCH', body: { days_mask: dp.get(), from: today } })).then((r) => r && toast('Plan re-laid on those days')) }, 'Use these days');
    const perDay = h('input', { type: 'text', class: 'tp-time', value: fmtMins(g.day_mins), 'aria-label': 'Time per day', title: 'For example 3h, 90m or 1h20', autocomplete: 'off' });
    perDay.addEventListener('change', () => {
      const v = parseDuration(perDay.value, { days: false });
      if (v == null || v < 30 || v > 1440) { perDay.value = fmtMins(g.day_mins); toast('Try 3h, 90m or 1h20 (at least 30 minutes)'); return; }
      run(() => api(`/api/plan/goals/${g.id}`, { method: 'PATCH', body: { day_mins: v, from: today } }));
    });
    box.append(h('div', { class: 'goal-when' },
      h('div', { class: 'field' }, h('span', {}, 'Days it can use'), dp.el, apply),
      h('label', { class: 'field' }, h('span', {}, 'Time to give it each day'), perDay)));

    const relayBtn = h('button', { type: 'button', class: 'btn sm', onclick: () => {
      const go = (from, keep = true) => run(() => api(`/api/plan/goals/${g.id}/relay`, { method: 'POST', body: { from, keep_manual: keep } })).then((r) => r && toast(`Rescheduled from ${D.short(from)}`));
      openMenu(relayBtn, 'Put the unfinished parts back in order, starting…', [
        { label: 'Today', icon: 'arrow', onSelect: () => go(today) },
        { label: 'Tomorrow', icon: 'arrow', onSelect: () => go(D.add(today, 1)) },
        { label: 'Next Monday', icon: 'arrow', onSelect: () => go(D.add(D.weekStart(today), 7)) },
        { label: 'A day…', icon: 'calendar', onSelect: () => pickDay('Start from', today, (d) => go(d)) },
        { label: 'Today, and forget what I moved by hand', icon: 'undo', onSelect: () => go(today, false) },
      ]);
    } }, icon('undo', 'sm'), 'Reschedule the rest');

    const notes = h('textarea', { class: 'goal-notes', rows: '2', placeholder: 'What is this goal for? Resources, links, what “done” looks like.', 'aria-label': 'Goal notes' }, g.notes || '');
    notes.addEventListener('blur', () => { if (notes.value !== (g.notes || '')) { g.notes = notes.value; run(() => api(`/api/plan/goals/${g.id}`, { method: 'PATCH', body: { notes: notes.value } }), { reload: false }); } });

    const rename = h('button', { type: 'button', class: 'btn sm', onclick: () => {
      const input = h('input', { type: 'text', value: g.title, maxlength: '200', required: true });
      const form = h('form', { class: 'wd-form', onsubmit: (e) => { e.preventDefault(); const v = input.value.trim(); if (v) { dlg.close(); run(() => api(`/api/plan/goals/${g.id}`, { method: 'PATCH', body: { title: v } })); } } },
        h('label', { class: 'field' }, h('span', {}, 'Goal name'), input),
        h('div', { class: 'wd-actions' }, h('button', { type: 'button', class: 'btn', onclick: () => dlg.close() }, 'Cancel'), h('button', { type: 'submit', class: 'btn primary' }, 'Save')));
      const dlg = dialog('Rename goal', form);
      input.select();
    } }, icon('pencil', 'sm'), 'Rename');

    box.append(notes,
      h('div', { class: 'goal-actions' }, relayBtn, rename,
        h('button', { type: 'button', class: 'btn sm', onclick: () => run(() => api(`/api/plan/goals/${g.id}`, { method: 'PATCH', body: { archived: !g.archived } })) }, g.archived ? 'Restore' : 'Archive'),
        arm(h('button', { type: 'button', class: 'btn sm danger' }, icon('trash', 'sm'), 'Delete goal'), () => run(() => api(`/api/plan/goals/${g.id}`, { method: 'DELETE' })).then(() => { P.openGoal = null; }), 'Delete goal and its days?')),
      h('p', { class: 'muted tiny' }, 'Sessions you move by hand stay where you put them when the rest is rescheduled.'));
    return box;
  }

  /* ================= New goal dialog ================= */
  function parseParts(txt, dm) {
    return txt.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
      const sp = splitDuration(l, { days: true, dm, bare: true });
      return { title: sp.title.replace(/[-–—:,(\s]+$/, ''), mins: sp.mins == null ? dm : clampMins(sp.mins, 100000) };
    }).filter((t) => t.title);
  }

  const TEMPLATES = {
    study: () => ({ title: 'Learn DevOps', len: 30, mask: WEEKDAYS, per: P.dayMins, parts: 'Linux and shell 4 days\nGit and CI 4 days\nDocker 5 days\nKubernetes 8 days\nTerraform 5 days' }),
    workout: () => {
      const lines = [];
      for (let w = 1; w <= 4; w++) lines.push(`Week ${w}: legs 1h30`, `Week ${w}: chest and triceps 1h30`, `Week ${w}: back and biceps 1h30`);
      return { title: 'Get stronger', len: 28, mask: 1 | 4 | 16, per: 90, parts: lines.join('\n') };
    },
  };

  function newGoal(kind) {
    const today = D.today();
    const tpl = kind && TEMPLATES[kind] ? TEMPLATES[kind]() : { title: '', len: 30, mask: WEEKDAYS, per: P.dayMins, parts: '' };
    const title = h('input', { type: 'text', maxlength: '200', placeholder: 'e.g. Learn DevOps, or Get stronger', required: true, 'aria-label': 'Goal name', value: tpl.title });
    const start = h('input', { type: 'date', value: today, required: true, 'aria-label': 'Start date' });
    const len = h('input', { type: 'number', min: '1', max: '366', value: String(tpl.len), required: true, 'aria-label': 'Length in days' });
    const dp = dayPicker(tpl.mask, () => update());
    const tf = timeField({ value: tpl.per, label: 'Time per day' });
    const parts = h('textarea', { rows: '7', placeholder: 'One part per line, with how long it takes\nLinux and shell 4 days\nDocker 5 days\nLegs 1h30\nRead chapter 2 45m', 'aria-label': 'Parts', value: tpl.parts });
    parts.value = tpl.parts;
    const preview = h('div', { class: 'gp' });
    const err = h('p', { class: 'form-err', role: 'alert' });
    const perDay = () => { const v = tf.value(); return v && v >= 30 && v <= 1440 ? v : null; };

    function update() {
      const dm = perDay() || P.dayMins;
      tf.setDm(dm);
      const list = parseParts(parts.value, dm);
      const total = list.reduce((n, t) => n + t.mins, 0);
      const days = Math.max(1, Number(len.value) || 1);
      const s = start.value || today;
      const goalEnd = D.add(s, days - 1);
      const lay = list.length ? layout(list, s, dp.get(), dm) : null;
      const over = lay && lay.end > goalEnd;
      const need = lay ? Math.min(366, D.diff(s, lay.end) + 1) : days;
      preview.replaceChildren(
        list.length ? h('ul', {}, list.map((t) => h('li', {}, h('span', {}, t.title), h('b', {}, fmtPart(t.mins, dm))))) : h('p', { class: 'muted tiny' }, 'Add a part on each line. End the line with how long it takes: 3h, 90m or 2 days.'),
        lay ? h('p', { class: over ? 'gp-sum warn' : 'gp-sum' },
          `${fmtMins(total)} in all, using ${maskLabel(dp.get())}, ${fmtMins(dm)} a day. `,
          over ? h('span', {}, `It would run to ${D.wd(lay.end)} ${D.short(lay.end)}, past the end. `, h('button', { type: 'button', class: 'link-btn', onclick: () => { len.value = String(need); update(); } }, `Make it ${need} days`))
            : `Finishes ${D.wd(lay.end)} ${D.short(lay.end)}.`) : null);
    }
    for (const el of [parts, start, len, tf.input]) el.addEventListener('input', update);
    update();

    const form = h('form', { class: 'wd-form goal-form', onsubmit: async (e) => {
      e.preventDefault();
      err.textContent = '';
      if (tf.bad() || !perDay()) { err.textContent = 'Time per day: use something like 2h or whole day (at least 30 minutes).'; return; }
      const list = parseParts(parts.value, perDay());
      try {
        const r = await api('/api/plan/goals', { method: 'POST', body: { title: title.value, start_date: start.value, days: Number(len.value), day_mins: perDay(), days_mask: dp.get(), topics: list.map((t) => ({ title: t.title, mins: t.mins })) } });
        dlg.close();
        P.tab = 'goals'; P.openGoal = r.id;
        store.set('planTab', 'goals');
        CB.setSection('plan');
        await load();
        toast(list.length ? 'Goal planned' : 'Goal created. Add its parts next');
      } catch (ex) { err.textContent = ex.message; }
    } },
      h('div', { class: 'examples' }, h('span', { class: 'muted tiny' }, 'Start from an example:'),
        h('button', { type: 'button', class: 'chip-pick', onclick: () => { dlg.close(); newGoal('study'); } }, 'Learn something'),
        h('button', { type: 'button', class: 'chip-pick', onclick: () => { dlg.close(); newGoal('workout'); } }, 'Workout plan'),
        h('button', { type: 'button', class: 'chip-pick', title: 'Things you repeat each day are habits', onclick: () => { dlg.close(); addDialog({ day: today, repeat: 'every' }); } }, 'A daily habit instead')),
      h('label', { class: 'field' }, h('span', {}, 'Goal'), title),
      h('div', { class: 'wd-row' },
        h('label', { class: 'field' }, h('span', {}, 'Starts'), start),
        h('label', { class: 'field' }, h('span', {}, 'Runs for (days)'), len)),
      h('div', { class: 'field' }, h('span', {}, 'Days it can use'), dp.el),
      h('div', { class: 'field' }, h('span', {}, 'Time to give it each day'), tf.el),
      h('label', { class: 'field' }, h('span', {}, 'Parts, and how long each takes'), parts),
      preview, err,
      h('div', { class: 'wd-actions' }, h('button', { type: 'button', class: 'btn', onclick: () => dlg.close() }, 'Cancel'), h('button', { type: 'submit', class: 'btn primary' }, 'Plan it')));
    const dlg = dialog('New goal', form);
    title.focus();
  }
  P.newGoal = newGoal;

  /* ================= painting ================= */
  function paint() {
    const el = $('#planMain');
    if (!P.loaded) { el.replaceChildren(tabsNav(), h('p', { class: 'muted loading' }, 'Loading your plan…')); return; }
    const view = { week: viewWeek, weekend: viewWeekend, habits: viewHabits, goals: viewGoals }[P.tab] || viewDay;
    el.replaceChildren(tabsNav(), ...view().filter(Boolean));
    if (P.refocus) {
      const [kind, id] = P.refocus.split(/:(.*)/);
      P.refocus = null;
      const sel = { add: `[data-add="${id}"]`, note: `[data-note="${id}"]`, edit: `[data-edit="${id}"]`, topic: `[data-topic="${id}"]`, newtopic: `[data-newtopic="${id}"]` }[kind];
      const f = sel && el.querySelector(sel);
      if (f) { f.focus(); if (kind === 'edit' && f.select) f.select(); }
    }
  }

  function render() {
    CB.emit('data');
    if (CB.section === 'plan' && CB.started) paint();
  }
  P.render = render;

  // a refresh from another device must not wipe a note or task being typed
  function typing() {
    const el = $('#planMain');
    const a = document.activeElement;
    return !!(a && el.contains(a) && (a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && a.type !== 'checkbox' && a.type !== 'date')));
  }
  function safeRender() {
    if (CB.section === 'plan' && typing()) { P.stale = true; CB.emit('data'); return; }
    render();
  }
  $('#planMain').addEventListener('focusout', () => { if (P.stale) setTimeout(() => { if (!typing()) { P.stale = false; render(); } }, 0); });

  /* ================= wiring ================= */
  CB.on('newday', (t) => {
    if (P.day < t && D.diff(P.day, t) === 1) P.day = t;
    if (D.weekStart(t) === D.add(P.week, 7)) P.week = D.weekStart(t);
    if (D.add(D.weekStart(t), 5) === D.add(P.wkend, 7)) P.wkend = D.add(D.weekStart(t), 5);
    load(); // new days of habits appear
  });

  const goTab = (tab) => { P.tab = tab; store.set('planTab', tab); CB.setSection('plan'); render(); };
  CB.cmds.push(() => [
    { group: 'Plan', icon: 'calendar', label: 'Plan: today', run: () => { P.day = D.today(); CB.focusDay = P.day; goTab('today'); } },
    { group: 'Plan', icon: 'tasks', label: 'Plan: this week', run: () => { P.week = D.weekStart(D.today()); goTab('week'); } },
    { group: 'Plan', icon: 'sun', label: 'Plan: this weekend', run: () => { P.wkend = thisSat(); goTab('weekend'); } },
    { group: 'Plan', icon: 'flame', label: 'Plan: habits', run: () => goTab('habits') },
    { group: 'Plan', icon: 'target', label: 'Plan: goals', run: () => goTab('goals') },
    { group: 'Plan', icon: 'plus', label: 'Add a task or habit…', run: () => { goTab('today'); addDialog({ day: D.today() }); } },
    { group: 'Plan', icon: 'plus', label: 'New goal', run: () => { goTab('goals'); newGoal(); } },
  ]);

  CB.use({
    id: 'plan',
    start() { P.day = D.today(); P.week = D.weekStart(D.today()); P.wkend = thisSat(); load(); },
    stop() { Object.assign(P, { loaded: false, goals: [], topics: [], tasks: [], habits: [], weeks: new Map() }); reindex(); $('#planMain').replaceChildren(); },
    show() { if (!P.loaded) paint(); else render(); },
    openDay(day) { P.day = day; P.tab = 'today'; store.set('planTab', 'today'); render(); },
    refresh(types) { if (types.has('') || types.has('open') || types.has('plan') || types.has('import')) load(); },
  });
})();
