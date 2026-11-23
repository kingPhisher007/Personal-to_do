/* Side panel: section switching (Clipboard, Plan, Diary), month calendar, today's tasks and goal progress.
 * Also holds the small date helpers the planner and diary share. */
(() => {
  'use strict';
  const CB = window.CB;
  if (!CB) return;
  const { $, h, icon, store } = CB;

  /* ================= dates: plain "YYYY-MM-DD" strings, Monday first ================= */
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
  const D = {
    iso, parse,
    today: () => iso(new Date()),
    add: (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); },
    dow: (s) => (parse(s).getDay() + 6) % 7, // Monday = 0
    weekStart: (s) => D.add(s, -D.dow(s)),
    diff: (a, b) => Math.round((parse(b) - parse(a)) / 864e5),
    isWeekend: (s) => D.dow(s) >= 5,
    fmt: (s, o) => parse(s).toLocaleDateString(undefined, o),
    short: (s) => D.fmt(s, { day: 'numeric', month: 'short' }),
    long: (s) => D.fmt(s, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    wd: (s) => D.fmt(s, { weekday: 'short' }),
    month: (ym) => D.fmt(`${ym}-01`, { month: 'long', year: 'numeric' }),
    daysIn: (y, m) => new Date(y, m, 0).getDate(),
  };
  CB.D = D;

  /* ================= tiny event bus ================= */
  const L = {};
  CB.on = (e, f) => { (L[e] = L[e] || []).push(f); };
  CB.emit = (e, a) => { for (const f of L[e] || []) { try { f(a); } catch (err) { console.error(err); } } };

  /* ================= sections ================= */
  const SECTIONS = [['clip', 'Clipboard', 'inbox'], ['plan', 'Plan', 'target'], ['diary', 'Diary', 'book']];
  CB.section = store.get('section', 'clip');
  if (!SECTIONS.some(([id]) => id === CB.section)) CB.section = 'clip';
  CB.focusDay = D.today();

  function setSection(id) {
    if (!SECTIONS.some(([s]) => s === id)) id = 'clip';
    CB.section = id;
    store.set('section', id);
    $('#main').classList.toggle('hidden', id !== 'clip');
    $('#planMain').classList.toggle('hidden', id !== 'plan');
    $('#diaryMain').classList.toggle('hidden', id !== 'diary');
    closeDrawer();
    renderSide();
    const mod = CB.mods.find((m) => m.id === id);
    if (mod && mod.show) mod.show();
    window.scrollTo({ top: 0 });
  }
  CB.setSection = setSection;

  // A day picked anywhere (calendar, a link) opens in whichever of Plan or Diary is showing; Plan if neither is.
  CB.openDay = (day) => {
    CB.focusDay = day;
    const mod = CB.mods.find((m) => m.id === (CB.section === 'diary' ? 'diary' : 'plan'));
    if (CB.section === 'clip') setSection('plan');
    if (mod && mod.openDay) mod.openDay(day);
    renderSide();
  };

  /* ================= drawer (phones and narrow windows) ================= */
  const app = () => $('#app');
  function openDrawer() { app().classList.add('side-open'); $('#menuBtn').setAttribute('aria-expanded', 'true'); $('#scrim').classList.remove('hidden'); }
  function closeDrawer() { app().classList.remove('side-open'); $('#menuBtn').setAttribute('aria-expanded', 'false'); $('#scrim').classList.add('hidden'); }
  $('#menuBtn').append(icon('menu'));
  $('#menuBtn').addEventListener('click', () => (app().classList.contains('side-open') ? closeDrawer() : openDrawer()));
  $('#scrim').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && app().classList.contains('side-open')) closeDrawer(); });

  /* ================= side panel ================= */
  let calMonth = D.today().slice(0, 7);
  const side = () => $('#side');

  function sectionNav() {
    const P = CB.P;
    const behind = P && P.loaded ? P.overdue().length : 0;
    const Dy = CB.Dy;
    const unwritten = Dy && Dy.loaded && !Dy.has(D.today());
    return h('nav', { class: 'side-nav', 'aria-label': 'Sections' }, SECTIONS.map(([id, label, ic]) =>
      h('button', { type: 'button', class: 'side-tab', 'aria-current': String(CB.section === id), onclick: () => setSection(id) },
        icon(ic), h('span', {}, label),
        id === 'plan' && behind ? h('b', { class: 'badge warn', title: `${behind} behind` }, behind) : null,
        id === 'diary' && unwritten ? h('i', { class: 'badge-dot', title: 'Nothing written today yet' }) : null)));
  }

  function calendar() {
    const [y, m] = calMonth.split('-').map(Number);
    const first = `${calMonth}-01`;
    const lead = D.dow(first);
    const total = D.daysIn(y, m);
    const today = D.today();
    const P = CB.P, Dy = CB.Dy;
    const cells = [];
    for (const n of ['M', 'T', 'W', 'T', 'F', 'S', 'S']) cells.push(h('span', { class: 'cal-h' }, n));
    for (let i = 0; i < lead; i++) cells.push(h('span', { class: 'cal-x' }));
    for (let d = 1; d <= total; d++) {
      const day = `${calMonth}-${pad(d)}`;
      const st = P && P.loaded ? P.dayStatus(day) : 'none';
      const wrote = Dy && Dy.loaded && Dy.has(day);
      const cls = 'cal-d' + (day === today ? ' today' : '') + (day === CB.focusDay ? ' sel' : '') + (D.isWeekend(day) ? ' we' : '');
      cells.push(h('button', { type: 'button', class: cls, title: `${D.long(day)}${wrote ? '. Diary written' : ''}`, 'aria-label': D.long(day), onclick: () => CB.openDay(day) },
        h('span', {}, d), h('span', { class: 'dots' }, st !== 'none' ? h('i', { class: 'pd ' + st }) : null, wrote ? h('i', { class: 'dd' }) : null)));
    }
    const shift = (n) => { const dt = new Date(y, m - 1 + n, 1, 12); calMonth = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}`; renderSide(); };
    return h('section', { class: 'side-card cal' },
      h('div', { class: 'cal-top' },
        h('button', { type: 'button', class: 'icon-btn sm', 'aria-label': 'Previous month', onclick: () => shift(-1) }, icon('left')),
        h('button', { type: 'button', class: 'cal-title', title: 'Back to this month', onclick: () => { calMonth = today.slice(0, 7); renderSide(); } }, D.month(calMonth)),
        h('button', { type: 'button', class: 'icon-btn sm', 'aria-label': 'Next month', onclick: () => shift(1) }, icon('right'))),
      h('div', { class: 'cal-grid' }, cells),
      h('p', { class: 'cal-key' }, h('i', { class: 'pd full' }), 'plan done ', h('i', { class: 'pd part' }), 'partly ', h('i', { class: 'pd late' }), 'behind ', h('i', { class: 'dd' }), 'diary'));
  }

  function todayCard() {
    const P = CB.P;
    const today = D.today();
    const card = h('section', { class: 'side-card' }, h('h3', {}, 'Today ', h('span', {}, D.fmt(today, { weekday: 'long', day: 'numeric', month: 'short' }))));
    if (!P || !P.loaded) { card.append(h('p', { class: 'muted' }, 'Loading…')); return card; }
    const tasks = P.tasksOn(today);
    const done = tasks.filter((t) => t.done).length;
    const behind = P.overdue().length;
    if (tasks.length) {
      card.append(h('div', { class: 'bar' }, h('i', { style: `width:${Math.round((done / tasks.length) * 100)}%` })),
        h('p', { class: 'muted tiny' }, `${done} of ${tasks.length} done`));
      const list = h('ul', { class: 'mini-tasks' });
      for (const t of tasks.slice(0, 7)) list.append(h('li', { class: t.done ? 'done' : '' },
        h('button', { type: 'button', class: 'pt-check', role: 'checkbox', 'aria-checked': String(t.done), 'aria-label': t.title, onclick: () => P.toggle(t) }, icon('check')),
        h('button', { type: 'button', class: 'mt-title', onclick: () => CB.openDay(today) }, t.title)));
      card.append(list);
      if (tasks.length > 7) card.append(h('button', { type: 'button', class: 'link-btn', onclick: () => CB.openDay(today) }, `${tasks.length - 7} more`));
    } else card.append(h('p', { class: 'muted' }, 'Nothing planned for today.'));
    const input = h('input', { type: 'text', class: 'mini-add', placeholder: 'Add a task for today', maxlength: '300', 'aria-label': 'Add a task for today' });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.isComposing && input.value.trim()) { const v = input.value.trim(); input.value = ''; CB.sideRefocus = true; P.addTask(today, v); }
    });
    card.append(input);
    if (behind) card.append(h('button', { type: 'button', class: 'warn-line', onclick: () => { P.tab = 'today'; CB.openDay(today); } }, icon('clock', 'sm'), `${behind} ${behind === 1 ? 'task is' : 'tasks are'} behind`, icon('arrow', 'sm')));
    return card;
  }

  function goalsCard() {
    const P = CB.P;
    if (!P || !P.loaded) return null;
    const goals = P.activeGoals();
    const card = h('section', { class: 'side-card' }, h('h3', {}, 'Goals'));
    if (!goals.length) {
      card.append(h('p', { class: 'muted' }, 'No goals yet.'), h('button', { type: 'button', class: 'btn sm', onclick: () => { P.tab = 'goals'; setSection('plan'); P.newGoal(); } }, icon('plus', 'sm'), 'New goal'));
      return card;
    }
    for (const g of goals.slice(0, 4)) {
      const st = P.goalStats(g);
      card.append(h('button', { type: 'button', class: 'side-goal', onclick: () => { P.tab = 'goals'; P.openGoal = g.id; setSection('plan'); P.render(); } },
        h('b', {}, g.title),
        h('div', { class: 'bar' }, h('i', { style: `width:${st.pct}%` })),
        h('span', { class: 'muted tiny' }, st.sideLine)));
    }
    if (goals.length > 4) card.append(h('p', { class: 'muted tiny' }, `${goals.length - 4} more in Plan`));
    return card;
  }

  let busy = false;
  function renderSide() {
    const el = side();
    if (!el || $('#app').classList.contains('hidden')) return;
    const a = document.activeElement;
    if (a && el.contains(a) && a.tagName === 'INPUT' && a.value) { busy = true; return; } // do not wipe a task being typed
    busy = false;
    el.replaceChildren(sectionNav(), calendar(), todayCard(), goalsCard());
    if (CB.sideRefocus) { CB.sideRefocus = false; const f = el.querySelector('.mini-add'); if (f) f.focus(); }
  }
  side().addEventListener('focusout', () => { if (busy) setTimeout(renderSide, 0); });
  CB.renderSide = renderSide;
  CB.on('data', renderSide);

  /* ================= palette commands ================= */
  CB.cmds.push(() => [
    { group: 'Go to', icon: 'inbox', label: 'Clipboard', run: () => setSection('clip') },
    { group: 'Go to', icon: 'target', label: 'Plan', run: () => setSection('plan') },
    { group: 'Go to', icon: 'book', label: 'Diary', run: () => setSection('diary') },
  ]);

  /* ================= lifecycle ================= */
  let dayTimer = null;
  let lastDay = D.today();
  CB.use({
    id: 'panel',
    start() {
      lastDay = D.today();
      CB.focusDay = lastDay;
      calMonth = lastDay.slice(0, 7);
      setSection(CB.section);
      clearInterval(dayTimer);
      dayTimer = setInterval(() => { // midnight rolls the whole workspace over to the new day
        const t = D.today();
        if (t !== lastDay) { lastDay = t; CB.emit('newday', t); renderSide(); }
      }, 30000);
    },
    stop() { clearInterval(dayTimer); side().replaceChildren(); },
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && CB.started) { const t = D.today(); if (t !== lastDay) { lastDay = t; CB.emit('newday', t); } renderSide(); } });
})();
