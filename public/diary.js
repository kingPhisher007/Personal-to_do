/* Year diary: one entry per day, autosaved. A year grid shows the days written and the mood of each. */
(() => {
  'use strict';
  const CB = window.CB;
  if (!CB || !CB.D) return;
  const { $, h, icon, api, toast, fail, arm, store, D } = CB;

  const MOODS = ['Rough', 'Low', 'Okay', 'Good', 'Great'];
  const SECTIONS = [['work', 'Work', 'What did you work on?'], ['life', 'Life', 'How is life going? Health, people, mood.'], ['wins', 'Wins', 'What went well?'],
    ['struggles', 'Struggles', 'What was hard?'], ['tomorrow', 'Tomorrow', 'What matters next?']];

  const Dy = (CB.Dy = {
    loaded: false, index: new Map(), years: new Set(), year: Number(D.today().slice(0, 4)), day: D.today(), listMonth: D.today().slice(0, 7),
    entry: null, draft: { body: '', sections: {}, mood: null, tags: [] }, earlier: [], base: null,
    dirty: false, status: 'saved', conflict: null, q: '', results: null, structure: store.get('dyStruct', '0') === '1', dayLoaded: null,
  });
  Dy.has = (day) => Dy.index.has(day);
  Dy.get = (day) => Dy.index.get(day);

  /* ================= index (days written) ================= */
  async function loadYear(y) {
    const d = await api(`/api/diary/index?from=${y}-01-01&to=${y}-12-31`);
    for (const k of [...Dy.index.keys()]) if (k.startsWith(`${y}-`)) Dy.index.delete(k);
    for (const e of d.entries) Dy.index.set(e.day, e);
    Dy.years.add(y);
  }
  async function loadIndex(force) {
    const now = Number(D.today().slice(0, 4));
    const want = new Set([now, now - 1, Dy.year]);
    for (const y of want) if (force || !Dy.years.has(y)) await loadYear(y);
    Dy.loaded = true;
    CB.emit('data');
  }

  function setIndex(day, entry) {
    if (!entry) { Dy.index.delete(day); return; }
    const parts = [entry.body, ...SECTIONS.map(([k]) => entry.sections[k])].map((s) => (s || '').trim()).filter(Boolean);
    const all = parts.join(' ').replace(/\s+/g, ' ');
    Dy.index.set(day, { day, mood: entry.mood, tags: entry.tags, snip: all.slice(0, 160), words: all ? all.split(' ').length : 0 });
  }

  /* ================= one day ================= */
  const emptyDraft = () => ({ body: '', sections: {}, mood: null, tags: [] });
  const payload = () => ({ body: Dy.draft.body, sections: Dy.draft.sections, mood: Dy.draft.mood, tags: Dy.draft.tags });

  function applyEntry(entry, earlier) {
    Dy.entry = entry;
    Dy.base = entry ? entry.updated_at : null;
    Dy.draft = entry ? { body: entry.body, sections: { ...entry.sections }, mood: entry.mood, tags: [...entry.tags] } : emptyDraft();
    if (earlier) Dy.earlier = earlier;
    Dy.dirty = false;
    Dy.conflict = null;
    Dy.status = 'saved';
    if (Object.keys(Dy.draft.sections).length) Dy.structure = true;
  }

  async function loadDay(day) {
    try {
      const d = await api(`/api/diary/day/${day}`);
      if (day !== Dy.day) return;
      applyEntry(d.entry, d.earlier);
      Dy.dayLoaded = day;
      paint();
    } catch (e) { fail(e); }
  }

  async function open(day) {
    if (day > D.today()) day = D.today();
    if (day !== Dy.day || Dy.dayLoaded !== day) {
      await flush();
      if (Dy.status === 'conflict') { toast('Sort out the conflict on this day first', { err: true }); return; }
    }
    Dy.day = day;
    CB.focusDay = day;
    Dy.listMonth = day.slice(0, 7);
    Dy.year = Number(day.slice(0, 4));
    Dy.dayLoaded = null;
    if (!Dy.years.has(Dy.year)) loadYear(Dy.year).then(() => { paintHead(); paintYear(); paintList(); CB.emit('data'); }).catch(() => {});
    paint();
    loadDay(day);
    CB.renderSide();
  }
  Dy.open = open;

  /* ================= saving ================= */
  let saveTimer = null;
  let saving = false;
  let saveAgain = false;
  const scheduleSave = () => { clearTimeout(saveTimer); saveTimer = setTimeout(save, 900); };

  function setStatus(s) {
    Dy.status = s;
    const el = $('#dyStatus');
    if (el) { el.textContent = { saved: 'Saved', saving: 'Saving…', unsaved: 'Unsaved', error: 'Not saved, will retry', conflict: 'Changed elsewhere' }[s] || ''; el.dataset.s = s; }
  }

  async function save() {
    clearTimeout(saveTimer);
    if (!Dy.dirty || Dy.status === 'conflict') return;
    if (saving) { saveAgain = true; return; }
    saving = true;
    setStatus('saving');
    const day = Dy.day;
    const body = { ...payload(), base: Dy.base };
    const snap = JSON.stringify(payload());
    try {
      const r = await api(`/api/diary/day/${day}`, { method: 'PUT', body });
      setIndex(day, r.entry);
      if (day === Dy.day) {
        Dy.entry = r.entry;
        Dy.base = r.entry ? r.entry.updated_at : null;
        if (JSON.stringify(payload()) === snap) Dy.dirty = false;
      }
      setStatus(Dy.dirty ? 'unsaved' : 'saved');
      paintHead(); paintYear(); paintList();
      CB.emit('data');
    } catch (e) {
      if (e.status === 409 && e.data && day === Dy.day) { Dy.conflict = e.data.entry; setStatus('conflict'); paintEditor(); }
      else { if (e.message !== 'Logged out') setStatus('error'); fail(e); saveAgain = false; clearTimeout(saveTimer); saveTimer = setTimeout(save, 6000); }
    } finally {
      saving = false;
      if (saveAgain || (Dy.dirty && Dy.status === 'unsaved')) { saveAgain = false; scheduleSave(); }
    }
  }

  async function flush() {
    clearTimeout(saveTimer);
    for (let i = 0; i < 40 && saving; i++) await new Promise((r) => setTimeout(r, 100));
    if (Dy.dirty) await save();
    for (let i = 0; i < 40 && saving; i++) await new Promise((r) => setTimeout(r, 100));
  }

  const edited = () => { Dy.dirty = true; setStatus('unsaved'); scheduleSave(); };

  // closing the tab or switching apps must not lose the last words
  function lastChance() {
    if (!Dy.dirty || saving || Dy.status === 'conflict' || !CB.started) return;
    try {
      fetch(`/api/diary/day/${Dy.day}`, { method: 'PUT', keepalive: true, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload(), base: Dy.base }) });
    } catch { /* nothing more to try */ }
  }
  window.addEventListener('pagehide', lastChance);
  document.addEventListener('visibilitychange', () => { if (document.hidden) lastChance(); });

  /* ================= numbers ================= */
  function yearStats() {
    let n = 0, sum = 0, moods = 0;
    for (const e of Dy.index.values()) if (e.day.startsWith(`${Dy.year}-`)) { n++; if (e.mood) { sum += e.mood; moods++; } }
    const today = D.today();
    let streak = 0;
    let d = Dy.has(today) ? today : D.add(today, -1);
    while (Dy.has(d) && streak < 4000) { streak++; d = D.add(d, -1); }
    return { n, streak, avg: moods ? sum / moods : null };
  }

  /* ================= painting ================= */
  const el = () => $('#diaryMain');
  const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;

  function paint() {
    const root = el();
    if (!root.firstChild || !$('#dyEditor')) {
      root.replaceChildren(h('div', { id: 'dyHead' }), h('div', { id: 'dyYear' }), h('div', { class: 'dy-cols' }, h('div', { id: 'dyEditor' }), h('div', { id: 'dyList' })));
    }
    paintHead(); paintYear(); paintEditor(); paintList();
  }

  function paintHead() {
    const host = $('#dyHead');
    if (!host) return;
    const st = yearStats();
    const thisYear = Number(D.today().slice(0, 4));
    host.replaceChildren(h('div', { class: 'nav-row' },
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Previous year', onclick: () => gotoYear(Dy.year - 1) }, icon('left')),
      h('div', { class: 'nav-label' }, h('h2', {}, `Diary ${Dy.year}`), h('span', {}, 'Work, life, and how it is going')),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Next year', disabled: Dy.year >= thisYear ? '' : null, onclick: () => gotoYear(Dy.year + 1) }, icon('right')),
      Dy.year !== thisYear ? h('button', { type: 'button', class: 'btn sm', onclick: () => gotoYear(thisYear) }, 'This year') : null,
      h('span', { class: 'spacer' }),
      h('span', { class: 'stat-chip' }, icon('book', 'sm'), `${plural(st.n, 'day')} written`),
      h('span', { class: 'stat-chip' }, icon('flame', 'sm'), `${st.streak} in a row`),
      st.avg ? h('span', { class: 'stat-chip', title: 'Average mood this year' }, h('i', { class: `mood-dot m${Math.round(st.avg)}` }), MOODS[Math.round(st.avg) - 1]) : null));
  }

  async function gotoYear(y) {
    Dy.year = y;
    if (!Dy.years.has(y)) { try { await loadYear(y); } catch (e) { fail(e); } }
    paintHead(); paintYear();
  }

  function paintYear() {
    const host = $('#dyYear');
    if (!host) return;
    const y = Dy.year;
    const jan1 = `${y}-01-01`;
    const lead = D.dow(jan1);
    const total = D.diff(jan1, `${y + 1}-01-01`);
    const cols = Math.ceil((lead + total) / 7);
    const today = D.today();
    const grid = h('div', { class: 'yg', style: `--cols:${cols}` });
    const months = h('div', { class: 'yg-months', style: `--cols:${cols}` });
    let lastMonth = -1;
    for (let i = 0; i < total; i++) {
      const day = D.add(jan1, i);
      const mo = Number(day.slice(5, 7)) - 1;
      const col = Math.floor((lead + i) / 7);
      if (mo !== lastMonth) { lastMonth = mo; months.append(h('span', { style: `--c:${col}` }, D.fmt(day, { month: 'short' }))); }
      const e = Dy.get(day);
      const future = day > today;
      const cls = 'yd' + (e ? (e.mood ? ` m${e.mood}` : ' w') : '') + (future ? ' future' : '') + (day === today ? ' today' : '') + (day === Dy.day ? ' sel' : '');
      const b = h('button', { type: 'button', class: cls, disabled: future ? '' : null, 'aria-label': `${D.long(day)}${e ? (e.mood ? `, ${MOODS[e.mood - 1]}` : ', written') : ''}`, title: `${D.long(day)}${e && e.mood ? ` · ${MOODS[e.mood - 1]}` : ''}`, onclick: () => open(day) });
      if (i === 0) b.style.gridRowStart = String(lead + 1);
      grid.append(b);
    }
    host.replaceChildren(h('section', { class: 'ws-card yearcard' },
      h('div', { class: 'yg-scroll' }, h('div', { class: 'yg-wrap' }, months, grid)),
      h('div', { class: 'yg-key' }, h('span', {}, 'Mood'), MOODS.map((m, i) => h('span', { class: 'k' }, h('i', { class: `yd m${i + 1}` }), m)), h('span', { class: 'k' }, h('i', { class: 'yd w' }), 'No mood'))));
    const sc = host.querySelector('.yg-scroll');
    if (sc && y === Number(today.slice(0, 4))) sc.scrollLeft = Math.max(0, (Math.floor((lead + D.diff(jan1, today)) / 7) - 8) * 16);
  }

  function grow(ta) { ta.style.height = 'auto'; ta.style.height = `${Math.max(ta.dataset.min ? Number(ta.dataset.min) : 0, ta.scrollHeight + 2)}px`; }

  function paintEditor() {
    const host = $('#dyEditor');
    if (!host) return;
    const keep = document.activeElement && host.contains(document.activeElement) ? document.activeElement : null;
    const day = Dy.day;
    const today = D.today();
    const out = [];

    const body = h('textarea', { class: 'dy-body', placeholder: day === today ? 'How was today? Write anything.' : 'Write about this day.', 'aria-label': 'Diary entry', 'data-min': '170' }, Dy.draft.body);
    body.addEventListener('input', () => { Dy.draft.body = body.value; grow(body); edited(); });
    body.addEventListener('blur', () => { if (Dy.dirty) save(); });

    const status = h('span', { id: 'dyStatus', class: 'dy-status', 'data-s': Dy.status, role: 'status' }, { saved: 'Saved', saving: 'Saving…', unsaved: 'Unsaved', error: 'Not saved, will retry', conflict: 'Changed elsewhere' }[Dy.status]);

    out.push(h('div', { class: 'nav-row tight' },
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Previous day', onclick: () => open(D.add(day, -1)) }, icon('left')),
      h('div', { class: 'nav-label' }, h('h2', {}, D.fmt(day, { weekday: 'long', day: 'numeric', month: 'long' })), h('span', {}, day === today ? 'Today' : D.fmt(day, { year: 'numeric' }))),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Next day', disabled: day >= today ? '' : null, onclick: () => open(D.add(day, 1)) }, icon('right')),
      day !== today ? h('button', { type: 'button', class: 'btn sm', onclick: () => open(today) }, 'Today') : null,
      h('span', { class: 'spacer' }), status));

    if (Dy.conflict) {
      out.push(h('div', { class: 'dy-conflict', role: 'alert' },
        h('p', {}, 'This day was changed on another device while you were writing.'),
        h('div', { class: 'wd-actions left' },
          h('button', { type: 'button', class: 'btn sm', onclick: () => { applyEntry(Dy.conflict, null); paintEditor(); paintList(); } }, 'Use the other version'),
          h('button', { type: 'button', class: 'btn sm primary', onclick: () => { Dy.base = Dy.conflict.updated_at; Dy.conflict = null; Dy.status = 'unsaved'; Dy.dirty = true; paintEditor(); save(); } }, 'Keep mine'))));
    }

    // what the plan said for this day
    const P = CB.P;
    const ts = P && P.loaded ? P.tasksOn(day) : [];
    if (ts.length) {
      const done = ts.filter((t) => t.done).length;
      out.push(h('button', { type: 'button', class: 'dy-plan', onclick: () => { P.day = day; P.tab = 'today'; CB.setSection('plan'); P.render(); } },
        icon('target', 'sm'), h('b', {}, `Plan: ${done} of ${ts.length} done`), h('span', {}, ts.slice(0, 3).map((t) => t.title).join(' · ') + (ts.length > 3 ? ' …' : '')), icon('arrow', 'sm')));
    }

    out.push(h('div', { class: 'moods', role: 'radiogroup', 'aria-label': 'Mood' },
      MOODS.map((m, i) => h('button', { type: 'button', role: 'radio', class: `mood-btn m${i + 1}`, 'aria-checked': String(Dy.draft.mood === i + 1),
        onclick: () => { Dy.draft.mood = Dy.draft.mood === i + 1 ? null : i + 1; edited(); paintEditor(); } }, h('i', { class: `mood-dot m${i + 1}` }), m))));

    out.push(body);

    const secWrap = h('div', { class: 'dy-secs' });
    if (Dy.structure) {
      for (const [k, label, ph] of SECTIONS) {
        const ta = h('textarea', { rows: '2', placeholder: ph, 'aria-label': label, 'data-min': '56' }, Dy.draft.sections[k] || '');
        ta.addEventListener('input', () => { if (ta.value.trim()) Dy.draft.sections[k] = ta.value; else delete Dy.draft.sections[k]; grow(ta); edited(); });
        ta.addEventListener('blur', () => { if (Dy.dirty) save(); });
        secWrap.append(h('label', { class: 'dy-sec' }, h('span', {}, label), ta));
        setTimeout(() => grow(ta), 0);
      }
    }
    out.push(h('button', { type: 'button', class: 'link-btn', onclick: () => { Dy.structure = !Dy.structure; store.set('dyStruct', Dy.structure ? '1' : '0'); paintEditor(); } }, Dy.structure ? 'Hide the prompts' : 'Add prompts: work, life, wins, struggles, tomorrow'));
    out.push(secWrap);

    // tags
    const tagRow = h('div', { class: 'tags' });
    for (const t of Dy.draft.tags) tagRow.append(h('span', { class: 'tag' }, `#${t}`, h('button', { type: 'button', 'aria-label': `Remove ${t}`, onclick: () => { Dy.draft.tags = Dy.draft.tags.filter((x) => x !== t); edited(); paintEditor(); } }, '×')));
    const known = [...new Set([...Dy.index.values()].flatMap((e) => e.tags || []))].sort();
    const tin = h('input', { type: 'text', class: 'tag-in', placeholder: 'Add a tag', maxlength: '30', list: 'dyTags', 'aria-label': 'Add a tag', autocomplete: 'off' });
    const addTag = () => {
      const v = tin.value.trim().replace(/^#/, '').toLowerCase().replace(/[,\s]+$/, '');
      tin.value = '';
      if (v && !Dy.draft.tags.includes(v) && Dy.draft.tags.length < 12) { Dy.draft.tags.push(v); edited(); paintEditor(); const n = $('#dyEditor .tag-in'); if (n) n.focus(); }
    };
    tin.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ',') && !e.isComposing) { e.preventDefault(); addTag(); } else if (e.key === 'Backspace' && !tin.value && Dy.draft.tags.length) { Dy.draft.tags.pop(); edited(); paintEditor(); } });
    tin.addEventListener('blur', addTag);
    tagRow.append(tin, h('datalist', { id: 'dyTags' }, known.map((t) => h('option', { value: t }))));
    out.push(tagRow);

    if (Dy.entry) {
      out.push(h('div', { class: 'card-foot' },
        arm(h('button', { type: 'button', class: 'btn sm danger' }, icon('trash', 'sm'), 'Delete this entry'), async () => {
          clearTimeout(saveTimer); Dy.dirty = false;
          try { await api(`/api/diary/day/${day}`, { method: 'DELETE' }); setIndex(day, null); applyEntry(null, Dy.earlier); paint(); CB.emit('data'); toast('Entry deleted'); } catch (e) { fail(e); }
        }, 'Delete it?')));
    }

    if (Dy.earlier.length) {
      out.push(h('div', { class: 'earlier' }, h('h4', {}, 'On this day, other years'),
        h('ul', {}, Dy.earlier.map((e) => h('li', {}, h('button', { type: 'button', onclick: () => open(e.day) },
          h('b', {}, D.fmt(e.day, { year: 'numeric' })), h('i', { class: `mood-dot m${e.mood || 0}` }), h('span', {}, CB.trunc(e.snip || '', 120))))))));
    }

    host.replaceChildren(h('section', { class: 'ws-card dy-card' }, ...out));
    grow(body);
    if (keep && keep.classList && keep.classList.contains('dy-body')) body.focus();
  }

  /* ================= entries list and search ================= */
  let searchTimer = null;
  function paintList() {
    const host = $('#dyList');
    if (!host) return;
    const keep = document.activeElement && host.contains(document.activeElement) && document.activeElement.classList.contains('dy-search');
    const q = Dy.q.trim();
    const search = h('input', { type: 'search', class: 'dy-search', placeholder: 'Search the diary', value: Dy.q, 'aria-label': 'Search the diary', autocomplete: 'off' });
    search.addEventListener('input', () => {
      Dy.q = search.value;
      clearTimeout(searchTimer);
      if (!Dy.q.trim()) { Dy.results = null; paintList(); return; }
      searchTimer = setTimeout(async () => {
        const asked = Dy.q.trim();
        try { const d = await api(`/api/diary/search?q=${encodeURIComponent(asked)}`); if (asked === Dy.q.trim()) { Dy.results = d.entries; paintList(); } } catch (e) { fail(e); }
      }, 250);
    });

    let items;
    let title;
    if (q && Dy.results) { items = Dy.results; title = items.length ? plural(items.length, 'match', 'matches') : 'No matches'; }
    else {
      const m = Dy.listMonth;
      items = [...Dy.index.values()].filter((e) => e.day.startsWith(m)).sort((a, b) => (a.day < b.day ? 1 : -1));
      title = D.month(m);
    }
    const shift = (n) => { const [y, mo] = Dy.listMonth.split('-').map(Number); const dt = new Date(y, mo - 1 + n, 1, 12); Dy.listMonth = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`; if (!Dy.years.has(dt.getFullYear())) loadYear(dt.getFullYear()).then(paintList).catch(() => {}); paintList(); };
    const head = q ? h('div', { class: 'list-head' }, h('b', {}, title)) :
      h('div', { class: 'list-head' }, h('button', { type: 'button', class: 'icon-btn sm', 'aria-label': 'Previous month', onclick: () => shift(-1) }, icon('left')), h('b', {}, title), h('button', { type: 'button', class: 'icon-btn sm', 'aria-label': 'Next month', onclick: () => shift(1) }, icon('right')));
    const list = h('ul', { class: 'dy-list' }, items.map((e) => h('li', {}, h('button', { type: 'button', class: e.day === Dy.day ? 'sel' : '', onclick: () => open(e.day) },
      h('span', { class: 'dl-d' }, h('b', {}, D.fmt(e.day, { day: 'numeric' })), h('small', {}, D.fmt(e.day, { weekday: 'short', ...(q ? { month: 'short', year: '2-digit' } : {}) }))),
      h('span', { class: 'dl-t' }, h('span', { class: 'dl-s' }, h('i', { class: `mood-dot m${e.mood || 0}` }), CB.trunc(e.snip || 'No text', 90)), (e.tags || []).length ? h('small', {}, e.tags.map((t) => `#${t}`).join(' ')) : null)))));
    host.replaceChildren(h('section', { class: 'ws-card dy-listcard' }, search, head, items.length ? list : h('p', { class: 'muted' }, q ? 'Nothing found.' : 'Nothing written this month yet.')));
    if (keep) { const s = host.querySelector('.dy-search'); s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
  }

  /* ================= wiring ================= */
  CB.cmds.push(() => [
    { group: 'Diary', icon: 'book', label: 'Diary: write today', run: () => { CB.setSection('diary'); open(D.today()); } },
    { group: 'Diary', icon: 'search', label: 'Diary: search', run: () => { CB.setSection('diary'); setTimeout(() => { const s = $('.dy-search'); if (s) s.focus(); }, 0); } },
  ]);

  CB.use({
    id: 'diary',
    start() {
      Dy.day = D.today(); Dy.year = Number(Dy.day.slice(0, 4)); Dy.listMonth = Dy.day.slice(0, 7); Dy.dayLoaded = null;
      loadIndex(true).catch(() => {});
    },
    stop() {
      clearTimeout(saveTimer);
      Object.assign(Dy, { loaded: false, index: new Map(), years: new Set(), entry: null, draft: emptyDraft(), earlier: [], dirty: false, conflict: null, dayLoaded: null, q: '', results: null, status: 'saved' });
      $('#diaryMain').replaceChildren();
    },
    show() { paint(); if (Dy.dayLoaded !== Dy.day) loadDay(Dy.day); },
    openDay(day) { open(day); },
    async refresh(types) {
      if (!(types.has('') || types.has('open') || types.has('import') || types.has('diary'))) return;
      try { await loadIndex(true); } catch { return; }
      if (CB.section !== 'diary') return;
      paintHead(); paintYear(); paintList();
      if (!Dy.dirty && !saving && Dy.status !== 'conflict') {
        try {
          const d = await api(`/api/diary/day/${Dy.day}`);
          const upd = d.entry ? d.entry.updated_at : null;
          if (upd !== Dy.base && !Dy.dirty) {
            const a = document.activeElement;
            const inEditor = a && $('#dyEditor') && $('#dyEditor').contains(a) && (a.tagName === 'TEXTAREA' || a.tagName === 'INPUT');
            // while a field is focused, leave it alone: the next save will notice the change and offer the choice
            if (!inEditor) { applyEntry(d.entry, d.earlier); paintEditor(); }
          }
        } catch { /* try again on the next change */ }
      }
    },
  });
  CB.on('newday', () => { if (CB.section === 'diary') { paintHead(); paintYear(); } });
})();
