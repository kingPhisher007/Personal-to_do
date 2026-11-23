/* Planner: Today, Week and Goals.
 * A goal has topics, each lasting some number of study days. The server lays them onto the calendar (weekdays by default);
 * every laid day is a task on that date. Free tasks can be added to any day. Unfinished work can be moved by day or by week. */
(() => {
  'use strict';
  const CB = window.CB;
  if (!CB || !CB.D) return;
  const { $, h, icon, api, toast, fail, openMenu, arm, store, D } = CB;

  const P = (CB.P = {
    loaded: false, goals: [], topics: [], tasks: [], weeks: new Map(), threshold: 70,
    tab: store.get('planTab', 'today'), day: D.today(), week: D.weekStart(D.today()),
    openGoal: null, showArchived: false, editing: null, editTopic: null, openNotes: new Set(), refocus: null, stale: false, addGoal: '',
  });
  if (!['today', 'week', 'goals'].includes(P.tab)) P.tab = 'today';

  /* ================= indexes and numbers ================= */
  let byDay = new Map();
  let goalById = new Map();
  let topicById = new Map();
  let topicsByGoal = new Map();
  let tasksByGoal = new Map();
  const push = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
  const byDayId = (a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.id - b.id);

  function reindex() {
    byDay = new Map(); topicsByGoal = new Map(); tasksByGoal = new Map();
    goalById = new Map(P.goals.map((g) => [g.id, g]));
    topicById = new Map(P.topics.map((t) => [t.id, t]));
    for (const t of P.topics) push(topicsByGoal, t.goal_id, t);
    for (const t of P.tasks) { push(byDay, t.day, t); if (t.goal_id) push(tasksByGoal, t.goal_id, t); }
  }

  P.tasksOn = (day) => byDay.get(day) || [];
  P.activeGoals = () => P.goals.filter((g) => !g.archived);
  P.overdue = () => { const t = D.today(); return P.tasks.filter((x) => !x.done && x.day < t); };
  P.dayStatus = (day) => {
    const ts = P.tasksOn(day);
    if (!ts.length) return 'none';
    const done = ts.filter((t) => t.done).length;
    if (done === ts.length) return 'full';
    if (day < D.today()) return 'late';
    return done ? 'part' : 'open';
  };

  const studyDay = (day, weekends) => weekends || !D.isWeekend(day);
  function capacity(start, days, weekends) {
    let n = 0;
    for (let i = 0; i < days; i++) if (studyDay(D.add(start, i), weekends)) n++;
    return n;
  }
  function nthStudyDay(start, n, weekends) {
    let d = start;
    let left = n;
    for (let i = 0; i < 4000; i++, d = D.add(d, 1)) { if (studyDay(d, weekends) && --left === 0) return d; }
    return d;
  }
  function daysNeeded(start, planned, weekends) {
    return Math.max(1, D.diff(start, nthStudyDay(start, Math.max(1, planned), weekends)) + 1);
  }

  P.topicStats = (tp) => {
    const ts = (tasksByGoal.get(tp.goal_id) || []).filter((t) => t.topic_id === tp.id);
    const done = ts.filter((t) => t.done).length;
    return { done, total: ts.length };
  };

  P.goalStats = (g) => {
    const today = D.today();
    const ts = (tasksByGoal.get(g.id) || []).filter((t) => t.topic_id);
    const total = ts.length;
    const done = ts.filter((t) => t.done).length;
    const late = ts.filter((t) => !t.done && t.day < today).length;
    const end = D.add(g.start, g.days - 1);
    const lastDay = ts.length ? ts[ts.length - 1].day : g.start;
    const planned = (topicsByGoal.get(g.id) || []).reduce((n, t) => n + t.days, 0);
    const cap = capacity(g.start, g.days, g.weekends);
    const over = Math.max(0, planned - cap);
    const slip = lastDay > end ? D.diff(end, lastDay) : 0;
    const dayNo = Math.min(g.days, Math.max(0, D.diff(g.start, today) + 1));
    const pct = total ? Math.round((done / total) * 100) : 0;
    let state = 'track';
    if (total && done === total) state = 'finished';
    else if (today < g.start) state = 'later';
    else if (late) state = 'behind';
    else if (over || slip) state = 'over';
    const sideLine = state === 'finished' ? 'Finished' : state === 'later' ? `Starts ${D.short(g.start)}` : `Day ${dayNo} of ${g.days}, ${late ? `${late} behind` : 'on track'}`;
    return { total, done, late, end, lastDay, planned, cap, over, slip, dayNo, pct, state, sideLine };
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
          if (day < today) { r.late++; r.late_ids.push(t.id); }
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
      const d = await api('/api/plan');
      if (seq !== loadSeq) return;
      P.goals = d.goals; P.topics = d.topics; P.tasks = d.tasks;
      P.weeks = new Map(d.weeks.map((w) => [w.start, w]));
      P.threshold = d.threshold || 70;
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

  async function addTask(day, title, goalId = null) {
    try {
      const t = await api('/api/plan/tasks', { method: 'POST', body: { day, title, goal_id: goalId || null } });
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

  function iconBtn(name, label, onclick, cls = '') {
    return h('button', { type: 'button', class: `icon-btn ${cls}`.trim(), 'aria-label': label, title: label, onclick }, icon(name));
  }

  /* ================= task rows ================= */
  function taskMenu(t, anchor) {
    const today = D.today();
    const tomorrow = D.add(today, 1);
    const opts = [];
    if (!t.done) {
      if (t.day !== today) opts.push({ label: 'Move to today', icon: 'arrow', onSelect: () => moveTasks([t.id], { to: today }, 'Moved to today') });
      if (t.day !== tomorrow) opts.push({ label: 'Move to tomorrow', icon: 'arrow', onSelect: () => moveTasks([t.id], { to: tomorrow }, 'Moved to tomorrow') });
      if (D.dow(t.day) < 5) { const we = weekendOf(t.day); if (we !== t.day) opts.push({ label: 'Move to the weekend', icon: 'arrow', onSelect: () => moveTasks([t.id], { to: we }, `Moved to ${D.wd(we)} ${D.short(we)}`) }); }
      opts.push({ label: 'Move to next week', icon: 'arrow', onSelect: () => moveTasks([t.id], { to: nextWeekDay(t) }, `Moved to ${D.wd(nextWeekDay(t))} ${D.short(nextWeekDay(t))}`) });
      opts.push({ label: 'Move to a day…', icon: 'calendar', onSelect: () => pickDay('Move this task', t.day, (d) => moveTasks([t.id], { to: d }, `Moved to ${D.short(d)}`)) });
    }
    opts.push({ label: t.note ? 'Edit note' : 'Add a note', icon: 'text', onSelect: () => { P.openNotes.add(t.id); P.refocus = `note:${t.id}`; render(); } });
    if (!t.topic_id) opts.push({ label: 'Rename', icon: 'pencil', onSelect: () => { P.editing = t.id; render(); } });
    opts.push({ label: 'Delete', icon: 'trash', onSelect: () => removeTask(t) });
    openMenu(anchor, null, opts);
  }

  function taskRow(t, o = {}) {
    const today = D.today();
    const goal = t.goal_id ? goalById.get(t.goal_id) : null;
    const topic = t.topic_id ? topicById.get(t.topic_id) : null;
    const late = !t.done && t.day < today;
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
    if (topic) meta.append(h('span', { class: 'chip' }, `day ${t.seq} of ${topic.days}`));
    if (goal && !o.noGoal) meta.append(h('span', { class: 'chip goal', title: goal.title }, CB.trunc(goal.title, 22)));
    if (o.showDay) meta.append(h('span', { class: 'chip late' }, `${D.wd(t.day)} ${D.short(t.day)}`));
    if (t.moved > 0) meta.append(h('span', { class: 'chip warn', title: `Moved ${t.moved} ${t.moved === 1 ? 'time' : 'times'}` }, `moved ${t.moved}×`));
    if (t.note && !P.openNotes.has(t.id)) meta.append(h('span', { class: 'chip', title: 'Has a note' }, icon('text', 'sm')));

    const more = iconBtn('more', 'Task actions', () => taskMenu(t, more), 'pt-more');
    li.append(check, h('div', { class: 'pt-main' }, title, meta), more);

    if (P.openNotes.has(t.id)) {
      const ta = h('textarea', { class: 'pt-note', rows: '2', placeholder: 'What did you learn? What got in the way?', 'aria-label': `Note for ${t.title}`, dataset: { note: t.id } }, t.note || '');
      const grow = () => { ta.style.height = 'auto'; ta.style.height = `${Math.min(300, ta.scrollHeight + 2)}px`; };
      ta.addEventListener('input', grow);
      ta.addEventListener('blur', () => {
        const v = ta.value.trim();
        if (v !== (t.note || '')) { t.note = v; patchTask(t, { note: v }); }
        if (!v) P.openNotes.delete(t.id);
        setTimeout(render, 0);
      });
      li.append(h('div', { class: 'pt-note-wrap' }, ta));
      setTimeout(grow, 0);
    }
    return li;
  }

  function addInput(day, placeholder = 'Add a task') {
    const input = h('input', { type: 'text', class: 'pt-add', placeholder, maxlength: '300', 'aria-label': `Add a task for ${D.long(day)}`, dataset: { add: day } });
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.isComposing) return;
      const v = input.value.trim();
      if (!v) return;
      input.value = '';
      P.refocus = `add:${day}`;
      addTask(day, v, day === P.day && P.tab === 'today' && P.addGoal ? Number(P.addGoal) : null);
    });
    return input;
  }

  function dropTarget(el, day) {
    el.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; el.classList.add('drop'); });
    el.addEventListener('dragleave', (e) => { if (!el.contains(e.relatedTarget)) el.classList.remove('drop'); });
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('drop');
      const id = Number(e.dataTransfer.getData('text/plain'));
      const t = P.tasks.find((x) => x.id === id);
      if (t && !t.done && t.day !== day) moveTasks([id], { to: day }, `Moved to ${D.wd(day)} ${D.short(day)}`);
    });
  }

  // "Move unfinished" for a list of task ids sitting on `day`
  function moveMenu(anchor, ids, day) {
    const today = D.today();
    const opts = [];
    if (day < today) opts.push({ label: 'Move to today', icon: 'arrow', onSelect: () => moveTasks(ids, { to: today }) });
    if (D.add(today, 1) !== day) opts.push({ label: 'Move to tomorrow', icon: 'arrow', onSelect: () => moveTasks(ids, { to: D.add(today, 1) }) });
    if (D.dow(day) < 5) { const we = weekendOf(day); if (we !== day) opts.push({ label: 'Move to the weekend', icon: 'arrow', onSelect: () => moveTasks(ids, { to: we }) }); }
    opts.push({ label: 'Move to next week (same days)', icon: 'arrow', onSelect: () => moveTasks(ids, { shift: 7 }, 'Moved to next week') });
    opts.push({ label: 'Move to a day…', icon: 'calendar', onSelect: () => pickDay('Move these tasks', D.add(today, 1), (d) => moveTasks(ids, { to: d })) });
    openMenu(anchor, `Move ${plural(ids.length, 'unfinished task')}`, opts);
  }

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
      tab('today', 'Day', 'calendar', behind || null), tab('week', 'Week', 'tasks'), tab('goals', 'Goals', 'target'), chip);
  }

  function setTab(id) {
    P.tab = id;
    store.set('planTab', id);
    render();
    window.scrollTo({ top: 0 });
  }

  function navRow(label, sub, onPrev, onNext, onNow, nowLabel, showNow) {
    return h('div', { class: 'nav-row' },
      iconBtn('left', 'Previous', onPrev),
      h('div', { class: 'nav-label' }, h('h2', {}, label), sub ? h('span', {}, sub) : null),
      iconBtn('right', 'Next', onNext),
      showNow ? h('button', { type: 'button', class: 'btn sm', onclick: onNow }, nowLabel) : null);
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

    if (day === today) {
      const late = P.overdue().sort(byDayId);
      if (late.length) {
        const ids = late.map((t) => t.id);
        const more = h('button', { type: 'button', class: 'btn sm', onclick: () => moveMenu(more, ids, late[0].day) }, icon('arrow', 'sm'), 'Move all…');
        out.push(h('section', { class: 'ws-card behind' },
          h('div', { class: 'card-head' }, h('h3', {}, icon('clock', 'sm'), `Behind (${late.length})`), h('span', { class: 'spacer' }),
            h('button', { type: 'button', class: 'btn sm', onclick: () => moveTasks(ids, { to: today }, 'Moved to today') }, 'All to today'), more),
          h('p', { class: 'muted tiny' }, 'Unfinished from earlier days. Do them, move them, or drop them.'),
          h('ul', { class: 'pt-list' }, late.map((t) => taskRow(t, { showDay: true })))));
      }
    }

    const list = h('ul', { class: 'pt-list' }, tasks.map((t) => taskRow(t)));
    const goals = P.activeGoals();
    const goalPick = goals.length ? h('select', { class: 'goal-pick', 'aria-label': 'Attach new tasks to a goal', onchange: (e) => { P.addGoal = e.target.value; } },
      h('option', { value: '' }, 'No goal'), goals.map((g) => h('option', { value: g.id, selected: String(g.id) === String(P.addGoal) ? '' : null }, g.title))) : null;

    const foot = h('div', { class: 'card-foot' });
    if (undone.length) {
      const mv = h('button', { type: 'button', class: 'btn sm', onclick: () => moveMenu(mv, undone.map((t) => t.id), day) }, icon('arrow', 'sm'), `Move ${undone.length} unfinished`);
      foot.append(mv);
    }
    foot.append(h('button', { type: 'button', class: 'btn sm', onclick: () => { CB.setSection('diary'); if (CB.Dy) CB.Dy.open(day); } }, icon('book', 'sm'), 'Diary for this day'));

    const card = h('section', { class: 'ws-card' + (D.isWeekend(day) ? ' weekend' : '') },
      h('div', { class: 'card-head' }, h('h3', {}, tasks.length ? `${done} of ${tasks.length} done` : 'Nothing planned'),
        tasks.length ? h('span', { class: 'pct' }, `${Math.round((done / tasks.length) * 100)}%`) : null),
      tasks.length ? bar(done, tasks.length) : null,
      tasks.length ? list : h('p', { class: 'muted empty-line' }, D.isWeekend(day) ? 'Nothing for the weekend yet. Add what you want to get done.' : 'Add what you want to get done, or start a goal and let it fill your days.'),
      h('div', { class: 'add-row' }, addInput(day, 'Add a task and press Enter'), goalPick),
      foot);
    dropTarget(card, day);
    out.push(card);
    if (!goals.length && !P.goals.length) {
      out.push(h('section', { class: 'ws-card hint' }, h('h3', {}, 'Plan a month of learning'),
        h('p', { class: 'muted' }, 'Create a goal such as "Learn DevOps", list the topics and how many days each needs, and every day fills itself in.'),
        h('button', { type: 'button', class: 'btn primary', onclick: () => { setTab('goals'); newGoal(); } }, icon('plus', 'sm'), 'New goal')));
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

    // topics this week covers
    const cover = new Map();
    for (const day of days) for (const t of P.tasksOn(day)) {
      if (!t.topic_id) continue;
      const tp = topicById.get(t.topic_id);
      if (tp) cover.set(tp.id, { tp, n: (cover.get(tp.id)?.n || 0) + 1 });
    }

    const focus = h('input', { type: 'text', class: 'wk-in', value: wk.focus, maxlength: '400', placeholder: 'e.g. Get comfortable with Docker', 'aria-label': 'Focus for this week' });
    focus.addEventListener('change', () => saveWeek(ws, { focus: focus.value.trim() }));
    const outcome = h('input', { type: 'text', class: 'wk-in', value: wk.outcome, maxlength: '600', placeholder: 'e.g. build and run my own image', 'aria-label': 'By the end of the week I can' });
    outcome.addEventListener('change', () => saveWeek(ws, { outcome: outcome.value.trim() }));

    out.push(h('section', { class: 'ws-card' },
      h('div', { class: 'wk-bars' },
        h('div', {}, h('div', { class: 'bar-label' }, h('span', {}, 'Weekdays'), h('b', {}, `${n.wdDone}/${n.wdPlanned}`)), bar(n.wdDone, n.wdPlanned)),
        h('div', {}, h('div', { class: 'bar-label' }, h('span', {}, 'Weekend'), h('b', {}, `${n.weDone}/${n.wePlanned}`)), bar(n.weDone, n.wePlanned, 'we'))),
      h('p', { class: 'wk-sum' }, n.planned ? `${n.done} of ${n.planned} done (${n.pct}%)${n.late ? `, ${n.late} behind` : ''}` : 'Nothing planned this week yet.'),
      cover.size ? h('div', { class: 'cover' }, [...cover.values()].map(({ tp, n: c }) => h('span', { class: 'chip goal' }, `${tp.title} ×${c}`))) : null,
      h('label', { class: 'wk-field' }, h('span', {}, 'Focus this week'), focus),
      h('label', { class: 'wk-field' }, h('span', {}, 'By Sunday I can…'), outcome)));

    if (!n.wePlanned && ws >= thisWeek) {
      out.push(h('p', { class: 'weekend-nudge' }, icon('calendar', 'sm'), 'The weekend is empty. Add what you want to get done on Saturday and Sunday.'));
    }

    const grid = h('div', { class: 'wk-grid' });
    for (const day of days) {
      const ts = P.tasksOn(day);
      const dn = ts.filter((t) => t.done).length;
      const cls = 'wk-day' + (day === today ? ' today' : '') + (D.isWeekend(day) ? ' weekend' : '') + (day < today ? ' past' : '');
      const head = h('button', { type: 'button', class: 'wk-head', title: 'Open this day', onclick: () => { P.day = day; CB.focusDay = day; setTab('today'); CB.renderSide(); } },
        h('b', {}, D.wd(day)), h('span', {}, D.fmt(day, { day: 'numeric', month: 'short' })), D.isWeekend(day) ? h('em', {}, 'weekend') : null,
        h('span', { class: 'spacer' }), ts.length ? h('small', {}, `${dn}/${ts.length}`) : null);
      const card = h('div', { class: cls }, head, ts.length ? bar(dn, ts.length) : null,
        h('ul', { class: 'pt-list' }, ts.map((t) => taskRow(t, { compact: true, noGoal: true }))), addInput(day, '+ task'));
      dropTarget(card, day);
      grid.append(card);
    }
    out.push(grid);

    // learning log: every note written on this week's tasks
    const noted = days.flatMap((d) => P.tasksOn(d).filter((t) => t.note));
    out.push(h('section', { class: 'ws-card' },
      h('div', { class: 'card-head' }, h('h3', {}, 'Learning log')),
      noted.length ? h('ul', { class: 'log' }, noted.map((t) => h('li', {}, h('b', {}, `${D.wd(t.day)} · ${t.title}`), h('p', {}, t.note))))
        : h('p', { class: 'muted' }, 'Open a task’s menu and choose “Add a note” to write what you learned or what got in the way. Your notes collect here.')));

    // review
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
      diaryBits.length ? h('div', { class: 'diary-bits' }, h('h4', {}, 'From your diary this week'), h('ul', {}, diaryBits)) : null));

    // eight weeks at a glance
    const hist = [];
    for (let i = 7; i >= 0; i--) {
      const w = D.add(thisWeek, -7 * i);
      const hn = weekNums(w);
      hist.push(h('button', { type: 'button', class: 'hist-col' + (w === ws ? ' sel' : ''), title: `Week of ${D.short(w)}: ${hn.done} of ${hn.planned} done`, onclick: () => { P.week = w; render(); window.scrollTo({ top: 0 }); } },
        h('span', { class: 'hist-bar' }, h('i', { style: `height:${hn.pct}%` })), h('small', {}, D.short(w).replace(' ', ' ')), h('b', {}, hn.planned ? `${hn.pct}%` : '–')));
    }
    out.push(h('section', { class: 'ws-card' }, h('div', { class: 'card-head' }, h('h3', {}, 'Last eight weeks')), h('div', { class: 'hist' }, hist)));
    return out;
  }

  /* ================= Goals view ================= */
  function viewGoals() {
    const out = [];
    const active = P.activeGoals();
    const archived = P.goals.filter((g) => g.archived);
    out.push(h('div', { class: 'nav-row' }, h('div', { class: 'nav-label' }, h('h2', {}, 'Goals'), h('span', {}, 'A goal is a stretch of days, split into topics')), h('span', { class: 'spacer' }),
      h('button', { type: 'button', class: 'btn primary', onclick: newGoal }, icon('plus', 'sm'), 'New goal')));
    if (!active.length) {
      out.push(h('section', { class: 'ws-card hint' }, h('h3', {}, 'No goals yet'),
        h('p', { class: 'muted' }, 'Try “Learn DevOps” for 30 days. List the topics with how many days each should take, and the plan fills in your weekdays.'),
        h('button', { type: 'button', class: 'btn primary', onclick: newGoal }, icon('plus', 'sm'), 'New goal')));
    }
    for (const g of active) out.push(goalCard(g));
    if (archived.length) {
      out.push(h('button', { type: 'button', class: 'link-btn', onclick: () => { P.showArchived = !P.showArchived; render(); } }, `${P.showArchived ? 'Hide' : 'Show'} ${archived.length} archived`));
      if (P.showArchived) for (const g of archived) out.push(goalCard(g));
    }
    return out;
  }

  const STATE_LABEL = { track: ['On track', 'ok'], behind: ['Behind', 'warn'], over: ['Over plan', 'warn'], finished: ['Finished', 'ok'], later: ['Not started', ''] };

  function goalCard(g) {
    const st = P.goalStats(g);
    const open = P.openGoal === g.id;
    const today = D.today();
    const [stLabel, stCls] = STATE_LABEL[st.state];
    const cells = (tasksByGoal.get(g.id) || []).filter((t) => t.topic_id).map((t) => {
      const cls = 'cell' + (t.done ? ' done' : t.day < today ? ' late' : t.day === today ? ' now' : '');
      return h('i', { class: cls, title: `${t.title}, ${D.wd(t.day)} ${D.short(t.day)}` });
    });
    const card = h('section', { class: 'ws-card goal' + (g.archived ? ' archived' : '') + (open ? ' open' : '') });
    card.append(h('button', { type: 'button', class: 'goal-head', 'aria-expanded': String(open), onclick: () => { P.openGoal = open ? null : g.id; render(); } },
      h('div', { class: 'goal-title' }, h('h3', {}, g.title), h('span', { class: `chip ${stCls}` }, g.archived ? 'Archived' : stLabel)),
      h('div', { class: 'goal-sub' }, `${D.short(g.start)} to ${D.short(st.end)} · ${g.days} days${g.weekends ? ' · weekends count' : ''}`)));
    card.append(h('div', { class: 'goal-prog' }, bar(st.done, st.total), h('span', {}, st.total ? `${st.done} of ${st.total} study days` : 'No topics yet')));
    if (cells.length) card.append(h('div', { class: 'timeline', 'aria-hidden': 'true' }, cells));

    const notes = [];
    if (st.late) notes.push(h('p', { class: 'goal-note warn' }, icon('clock', 'sm'), `${plural(st.late, 'study day')} behind. Re-lay the plan from today to slide the rest later.`));
    if (st.over) {
      const need = daysNeeded(g.start, st.planned, g.weekends);
      notes.push(h('p', { class: 'goal-note warn' }, icon('target', 'sm'), `${st.planned} study days planned, but only ${st.cap} fit in ${g.days} days.`,
        h('button', { type: 'button', class: 'link-btn', onclick: () => run(() => api(`/api/plan/goals/${g.id}`, { method: 'PATCH', body: { days: Math.min(366, need) } })) }, `Extend to ${need} days`)));
    } else if (st.slip) {
      notes.push(h('p', { class: 'goal-note warn' }, icon('clock', 'sm'), `The last topic now lands on ${D.wd(st.lastDay)} ${D.short(st.lastDay)}, ${plural(st.slip, 'day')} after the goal date.`));
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
      let name;
      if (P.editTopic === tp.id) {
        name = h('input', { type: 'text', class: 'tp-name', value: tp.title, maxlength: '200', 'aria-label': 'Topic name' });
        const done = (save) => { P.editTopic = null; const v = name.value.trim(); if (save && v && v !== tp.title) run(() => api(`/api/plan/topics/${tp.id}`, { method: 'PATCH', body: { title: v, from } })); else render(); };
        name.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(true); else if (e.key === 'Escape') done(false); });
        name.addEventListener('blur', () => { if (P.editTopic === tp.id) done(true); });
        P.refocus = `topic:${tp.id}`;
        name.dataset.topic = tp.id;
      } else {
        name = h('button', { type: 'button', class: 'tp-title', title: 'Rename', onclick: () => { P.editTopic = tp.id; render(); } }, tp.title);
      }
      const days = h('input', { type: 'number', class: 'tp-days', min: '1', max: '120', value: String(tp.days), 'aria-label': `Days for ${tp.title}` });
      days.addEventListener('change', () => {
        const v = Number(days.value);
        if (!Number.isInteger(v) || v < 1 || v > 120) { days.value = String(tp.days); return; }
        run(() => api(`/api/plan/topics/${tp.id}`, { method: 'PATCH', body: { days: v, from } }));
      });
      table.append(h('li', { class: 'topic' + (ts.total && ts.done === ts.total ? ' done' : '') },
        h('span', { class: 'tp-n' }, i + 1), name,
        h('label', { class: 'tp-d' }, days, h('span', {}, 'days')),
        h('span', { class: 'tp-prog' }, `${ts.done}/${ts.total}`),
        h('span', { class: 'tp-act' },
          iconBtn('left', 'Move up', () => run(() => api(`/api/plan/topics/${tp.id}`, { method: 'PATCH', body: { move: 'up', from } })), 'rot-up' + (i === 0 ? ' dim' : '')),
          iconBtn('right', 'Move down', () => run(() => api(`/api/plan/topics/${tp.id}`, { method: 'PATCH', body: { move: 'down', from } })), 'rot-down' + (i === tps.length - 1 ? ' dim' : '')),
          arm(h('button', { type: 'button', class: 'icon-btn danger', 'aria-label': `Delete ${tp.title}`, title: 'Delete topic' }, icon('trash')), () => run(() => api(`/api/plan/topics/${tp.id}?from=${from}`, { method: 'DELETE' })), 'Delete?'))));
    });
    box.append(tps.length ? table : h('p', { class: 'muted' }, 'No topics yet. Add the first one below.'));

    const tIn = h('input', { type: 'text', class: 'tp-new', placeholder: 'New topic', maxlength: '200', 'aria-label': 'New topic name' });
    const dIn = h('input', { type: 'number', class: 'tp-days', min: '1', max: '120', value: '2', 'aria-label': 'Days for the new topic' });
    const addTopic = () => {
      const title = tIn.value.trim();
      const d = Number(dIn.value);
      if (!title) { tIn.focus(); return; }
      if (!Number.isInteger(d) || d < 1 || d > 120) { dIn.focus(); return; }
      tIn.value = '';
      run(() => api(`/api/plan/goals/${g.id}/topics`, { method: 'POST', body: { title, days: d, from: today } }));
      P.refocus = `newtopic:${g.id}`;
    };
    tIn.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) addTopic(); });
    tIn.dataset.newtopic = g.id;
    box.append(h('div', { class: 'tp-add' }, tIn, h('label', { class: 'tp-d' }, dIn, h('span', {}, 'days')), h('button', { type: 'button', class: 'btn sm', onclick: addTopic }, icon('plus', 'sm'), 'Add')));

    const relayBtn = h('button', { type: 'button', class: 'btn sm', onclick: () => {
      const go = (from, keep = true) => run(() => api(`/api/plan/goals/${g.id}/relay`, { method: 'POST', body: { from, keep_manual: keep } })).then((r) => r && toast(`Re-laid from ${D.short(from)}`));
      openMenu(relayBtn, 'Re-lay unfinished days from…', [
        { label: 'Today', icon: 'arrow', onSelect: () => go(today) },
        { label: 'Tomorrow', icon: 'arrow', onSelect: () => go(D.add(today, 1)) },
        { label: 'Next Monday', icon: 'arrow', onSelect: () => go(D.add(D.weekStart(today), 7)) },
        { label: 'A day…', icon: 'calendar', onSelect: () => pickDay('Re-lay from', today, (d) => go(d)) },
        { label: 'Today, and forget days I placed by hand', icon: 'undo', onSelect: () => go(today, false) },
      ]);
    } }, icon('undo', 'sm'), 'Re-lay remaining days');

    const wk = h('label', { class: 'check-line' }, h('input', { type: 'checkbox', checked: g.weekends ? '' : null, onchange: (e) => run(() => api(`/api/plan/goals/${g.id}`, { method: 'PATCH', body: { weekends: e.target.checked, from: today } })) }), 'Study on weekends too');
    wk.firstChild.checked = !!g.weekends;

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

    box.append(wk, notes,
      h('div', { class: 'goal-actions' }, relayBtn, rename,
        h('button', { type: 'button', class: 'btn sm', onclick: () => run(() => api(`/api/plan/goals/${g.id}`, { method: 'PATCH', body: { archived: !g.archived } })) }, g.archived ? 'Restore' : 'Archive'),
        arm(h('button', { type: 'button', class: 'btn sm danger' }, icon('trash', 'sm'), 'Delete goal'), () => run(() => api(`/api/plan/goals/${g.id}`, { method: 'DELETE' })).then(() => { P.openGoal = null; }), 'Delete goal and its days?')),
      h('p', { class: 'muted tiny' }, 'Days you move by hand stay where you put them when the plan is re-laid.'));
    return box;
  }

  /* ================= New goal dialog ================= */
  function parseTopicLines(txt) {
    return txt.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
      const m = /^(.*?)(?:\s*[-–—:,(]\s*|\s+)(\d{1,3})\s*(?:d|day|days)?\s*\)?$/i.exec(l);
      if (m && m[1].trim()) return { title: m[1].trim().replace(/[-–—:,(\s]+$/, ''), days: Math.min(120, Math.max(1, Number(m[2]))) };
      return { title: l.replace(/[-–—:,(\s]+$/, ''), days: 1 };
    }).filter((t) => t.title);
  }

  function newGoal() {
    const today = D.today();
    const title = h('input', { type: 'text', maxlength: '200', placeholder: 'e.g. Learn DevOps', required: true, 'aria-label': 'Goal name' });
    const start = h('input', { type: 'date', value: today, required: true, 'aria-label': 'Start date' });
    const len = h('input', { type: 'number', min: '1', max: '366', value: '30', required: true, 'aria-label': 'Length in days' });
    const we = h('input', { type: 'checkbox' });
    const topics = h('textarea', { rows: '7', placeholder: 'One topic per line, with its days\nLinux and shell 4\nGit and CI 4\nDocker 5\nKubernetes 8\nTerraform 5', 'aria-label': 'Topics' });
    const preview = h('div', { class: 'gp' });
    const err = h('p', { class: 'form-err', role: 'alert' });

    const update = () => {
      const list = parseTopicLines(topics.value);
      const planned = list.reduce((n, t) => n + t.days, 0);
      const days = Math.max(1, Number(len.value) || 1);
      const cap = capacity(start.value || today, days, we.checked);
      const rows = list.map((t) => h('li', {}, h('span', {}, t.title), h('b', {}, plural(t.days, 'day'))));
      const over = planned - cap;
      preview.replaceChildren(
        list.length ? h('ul', {}, rows) : h('p', { class: 'muted tiny' }, 'Add a topic on each line. End the line with its number of days.'),
        list.length ? h('p', { class: over > 0 ? 'gp-sum warn' : 'gp-sum' },
          `${plural(planned, 'study day')} planned. ${plural(cap, 'study day')} fit in ${plural(days, 'day')}. `,
          over > 0 ? h('span', {}, `Over by ${over}. `, h('button', { type: 'button', class: 'link-btn', onclick: () => { len.value = String(Math.min(366, daysNeeded(start.value || today, planned, we.checked))); update(); } }, `Make it ${daysNeeded(start.value || today, planned, we.checked)} days`))
            : `Finishes ${D.wd(nthStudyDay(start.value || today, Math.max(1, planned), we.checked))} ${D.short(nthStudyDay(start.value || today, Math.max(1, planned), we.checked))}.`) : null);
    };
    for (const el of [topics, start, len, we]) el.addEventListener('input', update);
    update();

    const form = h('form', { class: 'wd-form goal-form', onsubmit: async (e) => {
      e.preventDefault();
      err.textContent = '';
      const list = parseTopicLines(topics.value);
      try {
        const r = await api('/api/plan/goals', { method: 'POST', body: { title: title.value, start_date: start.value, days: Number(len.value), weekends: we.checked, topics: list } });
        dlg.close();
        P.tab = 'goals'; P.openGoal = r.id;
        store.set('planTab', 'goals');
        CB.setSection('plan');
        await load();
        toast(list.length ? 'Goal planned' : 'Goal created. Add its topics next');
      } catch (ex) { err.textContent = ex.message; }
    } },
      h('label', { class: 'field' }, h('span', {}, 'Goal'), title),
      h('div', { class: 'wd-row' },
        h('label', { class: 'field' }, h('span', {}, 'Starts'), start),
        h('label', { class: 'field' }, h('span', {}, 'Length in days'), len)),
      h('label', { class: 'check-line' }, we, 'Study on weekends too (otherwise topics use Monday to Friday)'),
      h('label', { class: 'field' }, h('span', {}, 'Topics and how many days each needs'), topics),
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
    const view = P.tab === 'week' ? viewWeek() : P.tab === 'goals' ? viewGoals() : viewDay();
    el.replaceChildren(tabsNav(), ...view);
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
    render();
  });

  CB.cmds.push(() => [
    { group: 'Plan', icon: 'calendar', label: 'Plan: today', run: () => { P.day = D.today(); CB.focusDay = P.day; P.tab = 'today'; CB.setSection('plan'); render(); } },
    { group: 'Plan', icon: 'tasks', label: 'Plan: this week', run: () => { P.week = D.weekStart(D.today()); P.tab = 'week'; CB.setSection('plan'); render(); } },
    { group: 'Plan', icon: 'target', label: 'Plan: goals', run: () => { P.tab = 'goals'; CB.setSection('plan'); render(); } },
    { group: 'Plan', icon: 'plus', label: 'New goal', run: () => { P.tab = 'goals'; CB.setSection('plan'); render(); newGoal(); } },
  ]);

  CB.use({
    id: 'plan',
    start() { P.day = D.today(); P.week = D.weekStart(D.today()); load(); },
    stop() { Object.assign(P, { loaded: false, goals: [], topics: [], tasks: [], weeks: new Map() }); reindex(); $('#planMain').replaceChildren(); },
    show() { if (!P.loaded) paint(); else render(); },
    openDay(day) { P.day = day; P.tab = 'today'; store.set('planTab', 'today'); render(); },
    refresh(types) { if (types.has('') || types.has('open') || types.has('plan') || types.has('import')) load(); },
  });
})();
