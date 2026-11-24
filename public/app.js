(() => {
  'use strict';

  /* ================= helpers ================= */
  const $ = (s, r = document) => r.querySelector(s);
  const NS = 'http://www.w3.org/2000/svg';

  const ICONS = {
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    clip: '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
    pencil: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
    image: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
    file: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/>',
    text: '<line x1="21" x2="3" y1="6" y2="6"/><line x1="15" x2="3" y1="12" y2="12"/><line x1="17" x2="3" y1="18" y2="18"/>',
    tasks: '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    plus: '<path d="M5 12h14M12 5v14"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
    external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/>',
    inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
    left: '<polyline points="15 18 9 12 15 6"/>',
    right: '<polyline points="9 18 15 12 9 6"/>',
    more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
    pin: '<line x1="12" x2="12" y1="17" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>',
    undo: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
    menu: '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
    calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    palette: '<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
    infinity: '<path d="M18.178 8c5.096 0 5.096 8 0 8-5.095 0-7.133-8-12.739-8-4.585 0-4.585 8 0 8 5.606 0 7.644-8 12.74-8z"/>',
  };

  function icon(name, cls = '') {
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '1.8');
    s.setAttribute('stroke-linecap', 'round');
    s.setAttribute('stroke-linejoin', 'round');
    s.setAttribute('class', ('ic ' + cls).trim());
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = ICONS[name] || '';
    return s;
  }

  function h(tag, props, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.assign(n.dataset, v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return n;
  }

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
  };

  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const MOD = isMac ? '⌘' : 'Ctrl';
  const coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;

  /* ================= state ================= */
  const TTL_SHORT = [['keep', 'Keep'], ['300', '5 min'], ['3600', '1 hour'], ['86400', '1 day']];
  const TTL_LONG = [['keep', 'Keep forever'], ['300', '5 minutes'], ['3600', '1 hour'], ['86400', '1 day']];
  const SHARE_TTL = [['300', '5 min'], ['3600', '1 hour'], ['86400', '1 day'], ['604800', '7 days']];

  const S = {
    items: [],
    trash: [],
    trashDays: 30,
    info: null,
    backup: null,
    offset: 0,
    loaded: false,
    view: store.get('view', 'all'),
    ttl: store.get('ttl', 'keep'),
    task: false,
    edit: null,
    es: null,
    share: null,
    light: null,
    pickTarget: null,
    installEvt: null,
  };
  if (!TTL_SHORT.some(([v]) => v === S.ttl)) S.ttl = 'keep';

  const nowMs = () => Date.now() + S.offset;
  const ttlValue = () => (S.ttl === 'keep' ? null : Number(S.ttl));

  /* ================= smart types ================= */
  const isImage = (f) => /^image\/(png|jpe?g|gif|webp)$/.test(f.mime);
  const isUrl = (t) => /^https?:\/\/[^\s]+$/i.test(t);

  function looksLikeCode(t) {
    if (/^```/.test(t)) return true;
    const lines = t.split('\n');
    const first = lines[0].trim();
    if (lines.length === 1) {
      if (t.length > 300) return false;
      return (
        /^(\$ |sudo |git |npm |npx |pip3? |curl |wget |ssh |scp |docker |podman |kubectl |cd |ls\b|cat |chmod |chown |nmap |python3? |node |dnf |apt |systemctl |echo |export )/.test(first) ||
        (/^(const|let|var|function|import|def|class|SELECT|INSERT|UPDATE|DELETE|#include)\b/.test(first) && /[;{}()=]/.test(first))
      );
    }
    let pts = 0;
    if (/^#!\//.test(first)) pts += 3;
    if (/(^|\n)\s*(function |const |let |var |def |class |import |from \S+ import|return |#include|public |private |SELECT |INSERT |CREATE TABLE|<\/?[a-z][\w-]*[^>]*>|if \(|for \(|while \()/.test(t)) pts += 2;
    const indented = lines.filter((l) => /^( {2,}|\t)\S/.test(l)).length;
    if (indented / lines.length > 0.25) pts += 1;
    const endy = lines.filter((l) => /[;{}]\s*$/.test(l)).length;
    if (endy / lines.length > 0.3) pts += 2;
    if ((t.match(/[{}[\]();=<>]/g) || []).length / t.length > 0.05) pts += 1;
    if (/=>|::|->|\$\(|\|\||&&/.test(t)) pts += 1;
    return pts >= 3;
  }

  function codeLang(t) {
    const m = /^```(\w+)/.exec(t);
    if (m) return m[1];
    if (/^#!.*sh|^\$ |^(sudo|dnf|apt|git|curl|ssh|nmap|chmod|systemctl|podman|docker|npm) /m.test(t)) return 'shell';
    if (/^\s*(def |import \w+|from \w+ import|print\()/m.test(t)) return 'python';
    if (/\b(const|let|var|function)\b|=>|console\./.test(t)) return 'javascript';
    if (/<\/?[a-z][^>]*>/i.test(t)) return 'html';
    if (/\b(SELECT|INSERT|UPDATE|CREATE TABLE)\b/i.test(t)) return 'sql';
    if (/#include|int main|printf\(/.test(t)) return 'c';
    return 'code';
  }

  function stripFence(t) {
    const m = /^```[^\n]*\n([\s\S]*?)\n?```\s*$/.exec(t.trim());
    return m ? m[1] : t;
  }

  function kindOf(it) {
    if (it.is_task) return 'task';
    const t = (it.text || '').trim();
    const imgs = it.files.filter(isImage).length;
    if (!t && it.files.length) return imgs === it.files.length ? 'image' : 'file';
    if (isUrl(t)) return 'link';
    if (t && looksLikeCode(t)) return 'code';
    if (it.files.length) return imgs ? 'image' : 'file';
    return 'text';
  }

  const KIND_ICON = { task: 'tasks', link: 'link', code: 'code', image: 'image', file: 'file', text: 'text' };

  const VIEWS = [
    { id: 'all', label: 'All', icon: 'inbox', test: () => true, empty: ['Nothing saved yet', `Paste text, drop a file, or press ${MOD} K to run a command.`] },
    { id: 'pinned', label: 'Pinned', icon: 'pin', test: (i) => !!i.pinned_at, empty: ['Nothing pinned', 'Pin an entry to keep it at the top. Pinned entries never auto-delete.'] },
    { id: 'tasks', label: 'Tasks', icon: 'tasks', test: (i) => i.is_task, empty: ['No tasks', 'Switch on Task in the box above, then save one.'] },
    { id: 'links', label: 'Links', icon: 'link', test: (i) => kindOf(i) === 'link', empty: ['No links', 'Paste a web address and it shows up here.'] },
    { id: 'code', label: 'Code', icon: 'code', test: (i) => kindOf(i) === 'code', empty: ['No code', 'Snippets and shell commands you paste land here.'] },
    { id: 'files', label: 'Files', icon: 'file', test: (i) => i.files.length > 0, empty: ['No files', 'Paste a screenshot or drop a file anywhere on the page.'] },
  ];

  const TRASH_VIEW = { id: 'trash', label: 'Trash', icon: 'trash', empty: ['Trash is empty', 'Entries you delete wait here, so you can get them back.'] };
  if (S.view !== 'trash' && !VIEWS.some((v) => v.id === S.view)) S.view = 'all';

  /* ================= formatting ================= */
  function fmtAgo(ts) {
    const s = Math.max(0, (nowMs() - Date.parse(ts)) / 1000);
    if (s < 45) return 'just now';
    if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    const d = new Date(ts);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
  }

  function fmtLeft(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    if (s < 3600) return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
    return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
  }

  const fmtSize = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);
  const trunc = (s, n = 60) => { s = String(s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

  /* ================= toast, menu ================= */
  function toast(msg, o = {}) {
    const prog = o.progress ? h('div', { class: 'prog' }, h('i')) : null;
    const act = o.action ? h('button', { type: 'button', onclick: () => { close(); o.action.run(); } }, o.action.label) : null;
    const t = h('div', { class: 'toast' + (o.err ? ' err' : '') + (o.sticky ? ' sticky' : ''), role: o.err ? 'alert' : 'status' }, msg, prog, act);
    for (const old of document.querySelectorAll('#toasts .toast:not(.sticky)')) old.remove(); // one message at a time
    $('#toasts').append(t);
    let timer = null;
    const close = () => { clearTimeout(timer); t.remove(); };
    if (!o.sticky) timer = setTimeout(close, o.ms || (o.err ? 4200 : 2000));
    return { close, progress: (p) => { if (prog) prog.firstChild.style.width = `${Math.round(p * 100)}%`; } };
  }

  let menuClose = null;
  function closeMenu() { if (menuClose) menuClose(); }
  function openMenu(anchor, head, options) {
    closeMenu();
    const m = h('div', { class: 'menu', role: 'menu' });
    if (head) m.append(h('div', { class: 'mhead' }, head));
    for (const o of options) {
      if (o.head) { m.append(h('div', { class: 'mhead' }, o.head)); continue; }
      m.append(h('button', {
        type: 'button', role: o.radio ? 'menuitemradio' : 'menuitem', 'aria-checked': o.radio ? String(!!o.checked) : null,
        onclick: () => { closeMenu(); o.onSelect(); },
      }, o.icon ? icon(o.icon) : null, o.label));
    }
    $('#menuHost').append(m);
    const r = anchor.getBoundingClientRect();
    const left = Math.min(Math.max(8, r.right - m.offsetWidth), innerWidth - m.offsetWidth - 8);
    let top = r.bottom + 6;
    if (top + m.offsetHeight > innerHeight - 8) top = Math.max(8, r.top - m.offsetHeight - 6);
    m.style.left = `${left}px`;
    m.style.top = `${top}px`;
    const off = (e) => { if (!m.contains(e.target)) closeMenu(); };
    const key = (e) => { if (e.key === 'Escape') { closeMenu(); anchor.focus(); } };
    document.addEventListener('pointerdown', off, true);
    document.addEventListener('keydown', key);
    window.addEventListener('scroll', closeMenu, { once: true, passive: true });
    menuClose = () => {
      m.remove();
      document.removeEventListener('pointerdown', off, true);
      document.removeEventListener('keydown', key);
      window.removeEventListener('scroll', closeMenu);
      menuClose = null;
    };
    const first = m.querySelector('[aria-checked="true"]') || m.querySelector('button');
    if (first) first.focus();
  }

  /* ================= network ================= */
  async function api(path, opts = {}) {
    const headers = {};
    let body = opts.body;
    if (body && !(body instanceof FormData)) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
    const res = await fetch(path, { credentials: 'same-origin', method: opts.method || 'GET', headers, body });
    if (res.status === 401 && !path.includes('/login')) { showLogin(); throw new Error('Logged out'); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const err = new Error(data.error || 'Something went wrong'); err.status = res.status; err.data = data; throw err; }
    return data;
  }

  function upload(path, fd, onProgress, contentType) {
    return new Promise((resolve, reject) => {
      const x = new XMLHttpRequest();
      x.open('POST', path);
      x.withCredentials = true;
      if (contentType) x.setRequestHeader('Content-Type', contentType);
      x.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
      x.onload = () => {
        let d = {};
        try { d = JSON.parse(x.responseText); } catch { /* not json */ }
        if (x.status === 401) { showLogin(); return reject(new Error('Logged out')); }
        if (x.status >= 200 && x.status < 300) resolve(d);
        else reject(new Error(d.error || 'Upload failed'));
      };
      x.onerror = () => reject(new Error('Upload failed. Check your connection.'));
      x.send(fd);
    });
  }

  const fail = (e) => { if (e.message !== 'Logged out') toast(e.message, { err: true }); };

  /* Bridge for the planner, diary and side panel (panel.js, plan.js, diary.js). They are separate files so this one stays small. */
  const CB = (window.CB = {
    $, h, icon, ICONS, store, api, toast, fail, openMenu, closeMenu, arm, iconBtn, S, MOD, trunc,
    cmds: [], mods: [], started: false,
    use(m) { this.mods.push(m); if (this.started && m.start) m.start(); },
    start() { this.started = true; for (const m of this.mods) if (m.start) m.start(); },
    stop() { this.started = false; for (const m of this.mods) if (m.stop) m.stop(); },
    reload: (t) => scheduleRefresh(t),
  });

  /* ================= data flow ================= */
  let refreshTimer = null;
  let refreshing = false;
  let again = false;

  let pendingTypes = new Set();
  function scheduleRefresh(type = '') {
    pendingTypes.add(type);
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, 80);
  }

  async function refresh() {
    if (refreshing) { again = true; return; }
    refreshing = true;
    const types = pendingTypes;
    pendingTypes = new Set();
    try {
      // planner and diary changes do not touch the clipboard entries, so skip that request for them
      const onlyWorkspace = types.size > 0 && [...types].every((t) => t === 'plan' || t === 'diary');
      if (!onlyWorkspace) {
        const d = await api('/api/items');
        S.offset = Date.parse(d.now) - Date.now();
        S.items = d.items;
        S.trash = d.trash || [];
        S.trashDays = d.trash_days || 30;
        S.loaded = true;
        render();
        S.flash = true; // from now on, entries that arrive get the "new" highlight (not the first load)
        if (S.share) renderShare();
        if (S.light) renderLight();
      }
      for (const m of CB.mods) if (m.refresh) m.refresh(types);
    } catch (e) {
      if (e.message !== 'Logged out') console.warn(e);
    } finally {
      refreshing = false;
      if (again) { again = false; refresh(); }
    }
  }

  function setLive(on) {
    const el = $('#live');
    el.className = 'live' + (on ? ' on' : '');
    el.lastChild.textContent = on ? 'Live' : 'Reconnecting';
  }

  function connectEvents() {
    if (S.es) S.es.close();
    const es = new EventSource('/api/events');
    S.es = es;
    es.addEventListener('open', () => { setLive(true); scheduleRefresh('open'); });
    es.addEventListener('change', (e) => {
      let type = '';
      try { type = JSON.parse(e.data).type || ''; } catch { /* plain change */ }
      scheduleRefresh(type);
    });
    es.addEventListener('error', async () => {
      setLive(false);
      if (es.readyState === EventSource.CLOSED) {
        // the browser gave up (for example the session ended): check, then retry
        try {
          const me = await api('/api/me');
          if (me.loggedIn) setTimeout(() => { if (S.es === es) connectEvents(); }, 3000);
          else showLogin();
        } catch { setTimeout(() => { if (S.es === es) connectEvents(); }, 5000); }
      }
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden || $('#app').classList.contains('hidden')) return;
    if (!S.es || S.es.readyState === EventSource.CLOSED) connectEvents();
    scheduleRefresh();
  });

  /* ================= actions ================= */
  async function createNote({ text, is_task = false }) {
    try {
      const it = await api('/api/items', { method: 'POST', body: { text, is_task, ttl: ttlValue() } });
      if (!S.items.some((x) => x.id === it.id)) S.items.unshift(it);
      if (S.view === 'trash') setView('all');
      render();
      scheduleRefresh();
      return it;
    } catch (e) { fail(e); }
  }

  const stamp = () => {
    const d = new Date(); const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  };

  function nameClipboardFile(f, i) {
    if (f.name && !/^image\.(png|jpe?g|gif|webp)$/i.test(f.name)) return f;
    const ext = ((f.type || '').split('/')[1] || 'bin').replace('jpeg', 'jpg').replace(/\+.*/, '');
    return new File([f], `pasted-${stamp()}${i ? `-${i}` : ''}.${ext}`, { type: f.type });
  }

  async function captureFiles(files) {
    files = files.map(nameClipboardFile);
    const ta = $('#newText');
    const text = ta.value.trim();
    const fd = new FormData();
    if (text) fd.append('text', text);
    if (S.ttl !== 'keep') fd.append('ttl', S.ttl);
    for (const f of files) fd.append('files', f, f.name);
    const t = toast(files.length === 1 ? `Uploading ${trunc(files[0].name, 28)}` : `Uploading ${files.length} files`, { sticky: true, progress: true });
    try {
      await upload('/api/capture', fd, t.progress);
      if (text) { ta.value = ''; autosize(); }
      t.close();
      toast('Saved');
      if (S.view === 'trash') setView('all');
      scheduleRefresh();
    } catch (e) { t.close(); fail(e); }
  }

  async function attachFiles(id, files) {
    files = files.map(nameClipboardFile);
    const fd = new FormData();
    for (const f of files) fd.append('files', f, f.name);
    const t = toast(`Attaching ${files.length === 1 ? trunc(files[0].name, 28) : files.length + ' files'}`, { sticky: true, progress: true });
    try {
      await upload(`/api/items/${id}/files`, fd, t.progress);
      t.close();
      toast('Attached');
      scheduleRefresh();
    } catch (e) { t.close(); fail(e); }
  }

  async function patchItem(it, body) {
    try {
      const row = await api(`/api/items/${it.id}`, { method: 'PATCH', body });
      Object.assign(it, row);
      render();
      scheduleRefresh();
    } catch (e) { fail(e); scheduleRefresh(); }
  }

  // Delete moves an entry to the trash (with Undo). Entries on an auto-delete timer still vanish for good when it runs out.
  async function trashItem(id) {
    const it = S.items.find((x) => x.id === id);
    if (!it) return;
    S.items = S.items.filter((x) => x.id !== id);
    S.trash.unshift({ ...it, trashed_at: new Date(nowMs()).toISOString(), expires_at: null, ttl_seconds: null, shares: [] });
    render();
    try {
      await api(`/api/items/${id}`, { method: 'DELETE' });
      toast('Moved to trash', { ms: 6000, action: { label: 'Undo', run: () => restoreItem(id) } });
      scheduleRefresh();
    } catch (e) { fail(e); scheduleRefresh(); }
  }

  async function restoreItem(id) {
    const it = S.trash.find((x) => x.id === id);
    if (it) {
      S.trash = S.trash.filter((x) => x.id !== id);
      S.items = [{ ...it, trashed_at: null }, ...S.items].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id);
      render();
    }
    try {
      await api(`/api/items/${id}/restore`, { method: 'POST' });
      toast('Restored');
      scheduleRefresh();
    } catch (e) { fail(e); scheduleRefresh(); }
  }

  async function deleteForever(id) {
    S.trash = S.trash.filter((x) => x.id !== id);
    render();
    try { await api(`/api/items/${id}/forever`, { method: 'DELETE' }); scheduleRefresh(); }
    catch (e) { fail(e); scheduleRefresh(); }
  }

  async function emptyTrash() {
    const prev = S.trash;
    S.trash = [];
    render();
    try { await api('/api/trash', { method: 'DELETE' }); toast('Trash emptied'); scheduleRefresh(); }
    catch (e) { S.trash = prev; render(); fail(e); }
  }

  // Pinning keeps an entry at the top and switches its auto-delete timer off.
  async function togglePin(it) {
    const pin = !it.pinned_at;
    const hadFuse = !!it.expires_at;
    if (pin) { it.pinned_at = new Date(nowMs()).toISOString(); it.expires_at = null; it.ttl_seconds = null; } else it.pinned_at = null;
    render();
    try {
      const row = await api(`/api/items/${it.id}`, { method: 'PATCH', body: { pinned: pin } });
      Object.assign(it, row);
      render();
      toast(pin ? (hadFuse ? 'Pinned. Auto-delete is off for this entry' : 'Pinned') : 'Unpinned');
      scheduleRefresh();
    } catch (e) { fail(e); scheduleRefresh(); }
  }

  async function removeFile(it, f) {
    const prev = it.files;
    it.files = it.files.filter((x) => x.id !== f.id);
    render();
    try { await api(`/api/files/${f.id}`, { method: 'DELETE' }); scheduleRefresh(); }
    catch (e) { it.files = prev; render(); fail(e); }
  }

  async function copyText(text, msg = 'Copied') {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = h('textarea', { style: 'position:fixed;opacity:0' });
      ta.value = text;
      document.body.append(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      ta.remove();
    }
    toast(msg);
  }

  async function toPng(blob) {
    if (blob.type === 'image/png') return blob;
    const bmp = await createImageBitmap(blob);
    const c = document.createElement('canvas');
    c.width = bmp.width; c.height = bmp.height;
    c.getContext('2d').drawImage(bmp, 0, 0);
    return new Promise((r) => c.toBlob(r, 'image/png'));
  }

  async function copyImage(f) {
    try {
      const blob = await (await fetch(`/api/files/${f.id}`, { credentials: 'same-origin' })).blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': await toPng(blob) })]);
      toast('Image copied');
    } catch { toast('This browser blocked copying the image. Use Download instead.', { err: true }); }
  }

  function copyPayload(it) {
    return kindOf(it) === 'code' ? stripFence(it.text.trim()) : it.text;
  }

  /* ================= auth views ================= */
  function showLogin() {
    if (S.es) { S.es.close(); S.es = null; }
    S.items = []; S.trash = []; S.info = null; S.loaded = false; S.flash = false;
    CB.stop();
    known.clear();
    $('#feed').replaceChildren();
    $('#shelf').replaceChildren();
    $('#app').classList.add('hidden');
    $('#login').classList.remove('hidden');
    for (const d of document.querySelectorAll('dialog[open]')) d.close();
  }

  function enterApp() {
    $('#login').classList.add('hidden');
    $('#app').classList.remove('hidden');
    render();
    CB.start();
    refresh();
    connectEvents();
    setTimeout(loadBackupInfo, 4000); // not needed to draw the page
  }
  setInterval(() => { if (!document.hidden && !$('#app').classList.contains('hidden')) loadBackupInfo(); }, 30 * 60 * 1000);

  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#loginErr').textContent = '';
    try {
      await api('/api/login', { method: 'POST', body: { username: $('#u').value, password: $('#p').value } });
      $('#p').value = '';
      enterApp();
    } catch (err) { $('#loginErr').textContent = err.message; }
  });

  $('#logoutBtn').addEventListener('click', async () => { try { await api('/api/logout', { method: 'POST' }); } catch { /* ignore */ } showLogin(); });

  /* ================= theme ================= */
  const Theme = window.Theme;
  const MODE_LABEL = { auto: 'Auto', light: 'Light', dark: 'Dark' };
  const STYLE_LABEL = { wood: 'Wood', paper: 'Paper' };
  function paintThemeBtn() {
    $('#themeBtn').replaceChildren(icon('palette'));
    $('#themeBtn').title = `Theme: ${STYLE_LABEL[Theme.style]}, ${MODE_LABEL[Theme.mode].toLowerCase()}${Theme.mode === 'auto' ? ` (${Theme.resolve()} now)` : ''}`;
  }
  const pickMode = (m) => { Theme.setMode(m); paintThemeBtn(); };
  const pickStyle = (st) => { Theme.setStyle(st); paintThemeBtn(); };
  const pickWall = (w) => { Theme.setWall(w); paintThemeBtn(); };
  function openThemeMenu() {
    const anchor = $('#themeBtn');
    openMenu(anchor, null, [
      { head: 'Style' },
      ...Object.entries(STYLE_LABEL).map(([v, label]) => ({ label: v === 'wood' ? 'Wood shelves' : 'Plain paper', radio: true, checked: Theme.style === v, onSelect: () => pickStyle(v) })),
      { head: 'Background picture' },
      { label: 'Show the picture', radio: true, checked: Theme.wall === 'on', onSelect: () => pickWall('on') },
      { label: 'Plain colour only', radio: true, checked: Theme.wall === 'off', onSelect: () => pickWall('off') },
      { head: 'Light or dark' },
      { label: 'Auto: light by day, dark from 7 pm', radio: true, checked: Theme.mode === 'auto', onSelect: () => pickMode('auto') },
      { label: 'Always light', radio: true, checked: Theme.mode === 'light', onSelect: () => pickMode('light') },
      { label: 'Always dark', radio: true, checked: Theme.mode === 'dark', onSelect: () => pickMode('dark') },
    ]);
  }
  $('#themeBtn').addEventListener('click', openThemeMenu);
  // auto mode follows the clock: check every minute and when the app comes back to the front
  function followClock() {
    if (Theme.mode !== 'auto') return;
    const before = document.documentElement.dataset.theme;
    if (Theme.apply() !== before) paintThemeBtn();
  }
  setInterval(followClock, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) followClock(); });

  /* ================= rendering ================= */
  /* ================= rendering ================= */
  const findItem = (id) => S.items.find((x) => x.id === id) || S.trash.find((x) => x.id === id);
  const inTrash = () => S.view === 'trash';
  const currentView = () => VIEWS.find((v) => v.id === S.view) || VIEWS[0];
  const byPinned = (a, b) => Date.parse(b.pinned_at) - Date.parse(a.pinned_at);

  function viewItems() {
    if (inTrash()) return S.trash;
    const list = S.items.filter(currentView().test);
    return S.view === 'pinned' ? list.sort(byPinned) : list;
  }
  const visible = viewItems;

  // Pinned entries sit on a shelf above the log. The Pinned tab and the Trash list the entries in full.
  function split() {
    const all = viewItems();
    if (inTrash() || S.view === 'pinned') return { pinned: [], rest: all };
    return { pinned: all.filter((i) => i.pinned_at).sort(byPinned), rest: all.filter((i) => !i.pinned_at) };
  }

  function setView(id) {
    if (CB.setSection && CB.section !== 'clip') CB.setSection('clip');
    S.view = id;
    store.set('view', id);
    render();
    window.scrollTo({ top: 0 });
  }

  let navKey = '';
  function renderNav() {
    const counts = VIEWS.map((v) => S.items.filter(v.test).length);
    const key = S.view + counts.join(',') + ':' + S.trash.length;
    if (key === navKey) return;
    navKey = key;
    const tab = (id, label, ic, count, cls) =>
      h('button', { type: 'button', class: cls, 'aria-current': String(S.view === id), onclick: () => setView(id) },
        icon(ic), h('span', { class: 'label' }, label), count ? h('span', { class: 'count' }, count) : null);
    $('#nav').replaceChildren(
      ...VIEWS.map((v, i) => tab(v.id, v.label, v.icon, counts[i])),
      tab('trash', 'Trash', 'trash', S.trash.length, 'tab-trash'));
  }

  let barKey = '';
  function renderViewbar() {
    const bar = $('#viewbar');
    if (!inTrash()) { bar.classList.add('hidden'); barKey = ''; return; }
    bar.classList.remove('hidden');
    const key = `${S.trash.length}:${S.trashDays}`;
    if (key === barKey) return;
    barKey = key;
    bar.replaceChildren(
      h('p', {}, `Deleted entries wait here for ${S.trashDays} days, then are removed for good. Entries on an auto-delete timer skip the trash.`),
      S.trash.length ? arm(h('button', { type: 'button', class: 'btn sm danger' }, 'Empty trash'), emptyTrash, 'Empty it now?') : null);
  }

  const known = new Set();
  function signature(it, mode) {
    return JSON.stringify([
      mode, it.text, it.done, it.done_lines, it.is_task, it.pinned_at, it.trashed_at, it.expires_at, it.ttl_seconds,
      it.files.map((f) => f.id + f.name), it.shares.map((s) => s.token),
      S.edit && S.edit.id === it.id ? 'edit' : '',
    ]);
  }

  function renderList(container, items, mode) {
    const existing = new Map();
    for (const el of container.children) existing.set(Number(el.dataset.id), el);
    let prev = null;
    for (const it of items) {
      let el = existing.get(it.id);
      const sig = signature(it, mode);
      if (!el || el._sig !== sig) {
        const fresh = buildEntry(it, mode);
        fresh._sig = sig;
        if (el) container.replaceChild(fresh, el);
        else if (S.flash && mode !== 'trash' && !known.has(it.id)) fresh.classList.add('fresh');
        el = fresh;
      }
      existing.delete(it.id);
      const ref = prev ? prev.nextElementSibling : container.firstElementChild;
      if (ref !== el) container.insertBefore(el, ref);
      prev = el;
      known.add(it.id);
    }
    for (const el of existing.values()) el.remove();
  }

  function renderEmpty(count) {
    const e = $('#empty');
    if (count || !S.loaded) { e.classList.add('hidden'); return; }
    const v = inTrash() ? TRASH_VIEW : currentView();
    e.replaceChildren(icon(v.icon), h('h2', {}, v.empty[0]), h('p', {}, v.empty[1]));
    e.classList.remove('hidden');
  }

  function render() {
    const { pinned, rest } = split();
    $('#main').classList.toggle('is-trash', inTrash());
    renderNav();
    renderViewbar();
    $('#shelfWrap').classList.toggle('hidden', !pinned.length);
    if (pinned.length) $('#shelfTitle').replaceChildren(icon('pin'), 'Pinned');
    renderList($('#shelf'), pinned, 'tile');
    $('#feedTitle').classList.toggle('hidden', !(pinned.length && rest.length));
    renderList($('#feed'), rest, inTrash() ? 'trash' : 'row');
    renderEmpty(pinned.length + rest.length);
  }

  function iconBtn(name, label, onclick, cls = '') {
    return h('button', { type: 'button', class: `icon-btn ${cls}`.trim(), 'aria-label': label, title: label, onclick }, icon(name));
  }

  // two-step confirm: first click turns the button red and asks, second click runs fn
  function arm(btn, fn, label = 'Delete?') {
    let timer = null;
    let orig = null;
    const reset = () => { btn.classList.remove('armed'); btn.replaceChildren(...orig); timer = null; };
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (timer === null) {
        orig = [...btn.childNodes];
        btn.classList.add('armed');
        btn.replaceChildren(label);
        timer = setTimeout(reset, 3000);
        return;
      }
      clearTimeout(timer);
      timer = null;
      fn();
    });
    return btn;
  }


  function buildActions(it, kind, mode) {
    if (mode === 'trash') {
      return h('div', { class: 'actions' },
        h('button', { type: 'button', class: 'btn sm', onclick: () => restoreItem(it.id) }, icon('undo', 'sm'), 'Restore'),
        arm(h('button', { type: 'button', class: 'btn sm danger' }, icon('trash', 'sm'), 'Delete forever'), () => deleteForever(it.id), 'Really delete?'));
    }
    const a = h('div', { class: 'actions' });
    const text = it.text.trim();
    const imgs = it.files.filter(isImage);
    const attach = () => { S.pickTarget = it.id; $('#picker').click(); };
    const pinned = !!it.pinned_at;

    // Wide screens: individual buttons that appear on hover. Copy sits last so it never moves.
    a.append(
      iconBtn('trash', 'Move to trash', () => trashItem(it.id), 'danger act-more'),
      iconBtn('pencil', 'Edit', () => startEdit(it), 'act-more'),
      iconBtn('clip', 'Attach files', attach, 'act-more'),
      iconBtn('clock', 'Change auto-delete', (e) => openExpiryMenu(e.currentTarget, it), 'act-more' + (it.expires_at ? ' on' : '')),
      iconBtn('share', 'Share a link', () => openShare(it.id), 'act-more'),
      iconBtn('pin', pinned ? 'Unpin' : 'Pin to top', () => togglePin(it), 'act-more' + (pinned ? ' pinned' : '')),
    );

    // Phones and touch screens: one menu button instead.
    const more = iconBtn('more', 'More actions', () => openMenu(more, null, [
      { label: pinned ? 'Unpin' : 'Pin to top', icon: 'pin', onSelect: () => togglePin(it) },
      { label: 'Share a link', icon: 'share', onSelect: () => openShare(it.id) },
      { label: 'Auto-delete…', icon: 'clock', onSelect: () => openExpiryMenu(more, it) },
      { label: 'Attach files', icon: 'clip', onSelect: attach },
      { label: 'Edit', icon: 'pencil', onSelect: () => startEdit(it) },
      { label: 'Move to trash', icon: 'trash', onSelect: () => trashItem(it.id) },
    ]), 'act-menu');
    a.append(more);

    if (text) a.append(iconBtn('copy', kind === 'link' ? 'Copy link' : kind === 'code' ? 'Copy code' : 'Copy text', () => copyText(copyPayload(it))));
    else if (it.files.length === 1 && imgs.length === 1) a.append(iconBtn('copy', 'Copy image', () => copyImage(imgs[0])));
    return a;
  }

  // mode: 'row' (the log), 'tile' (pinned shelf) or 'trash'
  function buildEntry(it, mode) {
    const kind = kindOf(it);
    const tile = mode === 'tile';
    const trash = mode === 'trash';
    const editing = !trash && S.edit && S.edit.id === it.id;
    const copyable = tile && !editing && ['text', 'code', 'link'].includes(kind) && !!it.text.trim();
    const root = h('article', {
      class: ['entry', tile && 'tile', trash && 'trashed', it.pinned_at && !trash && 'is-pinned', it.is_task && it.done && 'done', editing && 'editing', copyable && 'copyable'].filter(Boolean).join(' '),
      dataset: { id: it.id, kind },
    });
    if (it.expires_at) {
      const total = it.ttl_seconds ? it.ttl_seconds * 1000 : Date.parse(it.expires_at) - Date.parse(it.created_at);
      root.dataset.exp = Date.parse(it.expires_at);
      root.dataset.total = total;
      root.append(h('div', { class: 'fuse' }, h('i')));
    }

    let goneIn = null;
    if (trash && it.trashed_at) {
      const left = Date.parse(it.trashed_at) + S.trashDays * 864e5 - nowMs();
      goneIn = h('span', { class: 'pill' }, icon('clock', 'sm'), left > 864e5 ? `Gone in ${Math.ceil(left / 864e5)} days` : 'Gone within a day');
    }
    const time = h('div', { class: 'e-time' },
      h('span', { class: 'lead' }, icon(it.pinned_at && !trash ? 'pin' : KIND_ICON[kind])),
      h('span', { class: 'ago', dataset: { ts: trash ? it.trashed_at : it.created_at, pre: trash ? 'Deleted ' : '' } },
        (trash ? 'Deleted ' : '') + fmtAgo(trash ? it.trashed_at : it.created_at)),
      it.expires_at ? h('span', { class: 'pill' }, icon('clock', 'sm'), h('span', { class: 'pill-t' })) : null,
      goneIn);

    const main = h('div', { class: 'e-main' });
    if (editing) main.append(buildEditor(it));
    else main.append(...buildBody(it, kind));
    if (it.files.length) main.append(...buildFiles(it, trash));
    if (copyable) {
      main.title = 'Click to copy';
      main.addEventListener('click', (e) => {
        if (e.target.closest('a, button, textarea, input') || String(window.getSelection()).length) return;
        copyText(copyPayload(it));
      });
    }

    root.append(time, main, buildActions(it, kind, mode));
    if (it.expires_at) paintFuse(root, nowMs());
    return root;
  }

  function textBlock(text) {
    const t = text.trim();
    const long = t.length > 700 || t.split('\n').length > 12;
    const box = h('div', { class: 'e-text' + (long ? ' clamped' : '') }, text);
    if (!long) return [box];
    const more = h('button', { type: 'button', class: 'more' }, 'Show more');
    more.addEventListener('click', () => {
      const open = box.classList.toggle('clamped');
      more.textContent = open ? 'Show more' : 'Show less';
    });
    return [box, more];
  }

  function buildBody(it, kind) {
    const text = it.text;
    if (kind === 'task') {
      // one checkbox per non-empty line; done_lines remembers which lines are ticked
      const lines = text.split('\n');
      const real = lines.map((l) => l.trim()).filter(Boolean);
      if (!real.length) return [h('div', { class: 'e-text' }, '(empty task)')];
      const ticked = new Set(it.done && !(it.done_lines || []).length ? real : it.done_lines || []);
      const toggle = (line) => {
        if (ticked.has(line)) ticked.delete(line); else ticked.add(line);
        it.done_lines = [...ticked];
        it.done = real.every((l) => ticked.has(l));
        render();
        patchItem(it, { done_lines: it.done_lines });
      };
      return [h('div', { class: 'task-list' }, lines.map((raw) => {
        const line = raw.trim();
        if (!line) return h('div', { class: 'task-gap' });
        const on = ticked.has(line);
        return h('div', { class: 'task-line' + (on ? ' is-done' : '') },
          h('button', { type: 'button', class: 'check', role: 'checkbox', 'aria-checked': String(on), 'aria-label': `Mark done: ${line.slice(0, 60)}`, onclick: () => toggle(line) }, icon('check', 'sm')),
          h('div', { class: 'e-text' }, line));
      }))];
    }
    if (kind === 'link') {
      let host = text, rest = '';
      try { const u = new URL(text.trim()); host = u.hostname.replace(/^www\./, ''); rest = (u.pathname === '/' ? '' : u.pathname) + u.search + u.hash; } catch { /* keep raw */ }
      return [h('a', { class: 'e-link', href: text.trim(), target: '_blank', rel: 'noopener noreferrer' },
        h('b', {}, host), rest ? h('small', {}, trunc(rest, 120)) : null)];
    }
    if (kind === 'code') {
      const code = stripFence(text.trim());
      return [h('div', { class: 'codebox' },
        h('div', { class: 'codebar' }, h('span', {}, codeLang(text.trim())),
          iconBtn('copy', 'Copy code', () => copyText(code, 'Code copied'))),
        h('pre', {}, h('code', {}, code)))];
    }
    return text.trim() ? textBlock(text) : [];
  }

  function buildFiles(it, readonly) {
    const out = [];
    const imgs = it.files.filter(isImage);
    const others = it.files.filter((f) => !isImage(f));
    if (imgs.length) {
      const grid = h('div', { class: 'thumbs' + (imgs.length === 1 ? ' one' : '') });
      imgs.forEach((f, idx) => {
        const x = readonly ? null : arm(h('button', { type: 'button', class: 'x', 'aria-label': 'Remove image', title: 'Remove image' }, icon('x', 'sm')), () => removeFile(it, f), 'Remove?');
        grid.append(h('div', {
          class: 'thumb', role: 'button', tabindex: '0', 'aria-label': `Preview ${f.name}`,
          onclick: (e) => { e.stopPropagation(); openLight(it.id, idx); },
          onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLight(it.id, idx); } },
        }, h('img', { src: `/api/files/${f.id}`, alt: f.name, loading: 'lazy', decoding: 'async' }), x));
      });
      out.push(grid);
    }
    if (others.length) {
      out.push(h('div', { class: 'fchips' }, others.map((f) => {
        const ext = (f.name.includes('.') ? f.name.split('.').pop() : 'file').slice(0, 4).toUpperCase();
        return h('div', { class: 'fchip' },
          h('div', { class: 'ext' }, ext),
          h('div', { class: 'fname' }, h('b', { title: f.name }, f.name), h('small', {}, fmtSize(f.size))),
          h('a', { class: 'icon-btn', href: `/api/files/${f.id}?download=1`, download: f.name, 'aria-label': `Download ${f.name}`, title: 'Download' }, icon('download')),
          readonly ? null : iconBtn('share', 'Share this file', () => openShare(it.id, f.id)),
          readonly ? null : arm(iconBtn('x', 'Remove file', () => {}, 'danger'), () => removeFile(it, f), 'Remove?'));
      })));
    }
    return out;
  }

  /* ---------- editing ---------- */
  function startEdit(it) {
    S.edit = { id: it.id, draft: it.text, task: it.is_task };
    render();
    // render() rebuilt the entry; force a rebuild if signature matched an older edit state
  }

  function cancelEdit() { S.edit = null; render(); }

  async function saveEdit() {
    const e = S.edit;
    if (!e) return;
    const it = S.items.find((x) => x.id === e.id);
    S.edit = null;
    if (!it) return render();
    it.text = e.draft; it.is_task = e.task;
    render();
    patchItem(it, { text: e.draft, is_task: e.task });
  }

  function buildEditor(it) {
    const ta = h('textarea', { 'aria-label': 'Edit entry', spellcheck: 'false' });
    ta.value = S.edit.draft;
    ta.addEventListener('input', () => { S.edit.draft = ta.value; });
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveEdit(); }
    });
    const taskBtn = h('button', { type: 'button', class: 'chip-btn toggle', role: 'switch', 'aria-checked': String(S.edit.task) }, icon('tasks', 'sm'), 'Task');
    taskBtn.addEventListener('click', () => { S.edit.task = !S.edit.task; taskBtn.setAttribute('aria-checked', String(S.edit.task)); });
    requestAnimationFrame(() => {
      if (ta.isConnected && document.activeElement !== ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
    });
    return h('div', { class: 'editor' }, ta,
      h('div', { class: 'editor-row' }, taskBtn, h('span', { class: 'spacer' }),
        h('button', { type: 'button', class: 'btn sm', onclick: cancelEdit }, 'Cancel'),
        h('button', { type: 'button', class: 'btn sm primary', onclick: saveEdit }, 'Save')));
  }

  /* ---------- auto-delete ---------- */
  function openExpiryMenu(anchor, it) {
    const cur = it.ttl_seconds ? String(it.ttl_seconds) : 'keep';
    const head = it.expires_at ? `Deletes in ${fmtLeft(Date.parse(it.expires_at) - nowMs())}` : 'Kept until you delete it';
    openMenu(anchor, head, TTL_LONG.map(([v, label]) => ({
      label: v === 'keep' ? label : `Delete after ${label}`,
      icon: v === 'keep' ? 'infinity' : 'clock',
      radio: true,
      checked: it.expires_at ? v === cur : v === 'keep',
      onSelect: () => patchItem(it, { ttl: v === 'keep' ? null : Number(v) }),
    })));
  }

  /* ---------- fuse ticking ---------- */
  function paintFuse(root, now) {
    const exp = Number(root.dataset.exp);
    if (!exp) return;
    const total = Number(root.dataset.total) || 1;
    const left = exp - now;
    const frac = Math.max(0, Math.min(1, left / total));
    root.querySelector('.fuse i').style.width = `${(frac * 100).toFixed(2)}%`;
    root.classList.toggle('low', left < 60000 || frac < 0.15);
    root.classList.toggle('mid', !(left < 60000 || frac < 0.15) && frac < 0.5);
    const pt = root.querySelector('.pill-t');
    const label = `Deletes in ${fmtLeft(left)}`;
    if (pt && pt.textContent !== label) pt.textContent = label;
  }

  function tick() {
    const now = nowMs();
    if (S.items.some((it) => it.expires_at && Date.parse(it.expires_at) <= now)) {
      S.items = S.items.filter((it) => !it.expires_at || Date.parse(it.expires_at) > now);
      render();
      scheduleRefresh();
      return;
    }
    if (document.hidden) return;
    for (const el of document.querySelectorAll('.entry[data-exp]')) paintFuse(el, now);
    for (const el of document.querySelectorAll('.ago')) {
      const t = (el.dataset.pre || '') + fmtAgo(el.dataset.ts);
      if (el.textContent !== t) el.textContent = t;
    }
    for (const el of document.querySelectorAll('.exp-left')) {
      const t = fmtLeft(Number(el.dataset.exp) - now);
      if (el.textContent !== t) el.textContent = t;
    }
  }
  setInterval(tick, 1000);

  /* ================= composer ================= */
  const ta = $('#newText');
  function autosize() { ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight, 260)}px`; }
  ta.addEventListener('input', autosize);
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !coarse) { e.preventDefault(); submitComposer(); }
  });
  $('#composer').addEventListener('submit', (e) => { e.preventDefault(); submitComposer(); });

  async function submitComposer() {
    const text = ta.value.trim();
    if (!text) { ta.focus(); return; }
    ta.value = '';
    autosize();
    const it = await createNote({ text, is_task: S.task });
    if (!it) { ta.value = text; autosize(); return; }
    toast(S.ttl === 'keep' ? 'Saved' : `Saved. Deletes in ${TTL_SHORT.find(([v]) => v === S.ttl)[1]}`);
  }

  function renderFusePick() {
    const box = $('#fusePick');
    box.replaceChildren(
      h('span', { class: 'lead', title: 'Delete after', 'aria-hidden': 'true' }, icon('clock', 'sm')),
      ...TTL_SHORT.map(([v, label]) => h('button', {
        type: 'button', role: 'radio', 'aria-checked': String(S.ttl === v), dataset: { ttl: v },
        title: v === 'keep' ? 'Keep until you delete it' : `Delete after ${label}`,
        onclick: () => { S.ttl = v; store.set('ttl', v); renderFusePick(); },
      }, label)));
  }

  function renderTaskToggle() {
    const b = $('#taskBtn');
    b.setAttribute('aria-checked', String(S.task));
    b.replaceChildren(icon('tasks', 'sm'), 'Task');
  }
  $('#taskBtn').addEventListener('click', () => { S.task = !S.task; renderTaskToggle(); ta.focus(); });
  $('#attachBtn').append(icon('clip', 'sm'), 'Attach');
  $('#attachBtn').addEventListener('click', () => { S.pickTarget = null; $('#picker').click(); });
  $('#picker').addEventListener('change', (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    if (!files.length) return;
    if (S.pickTarget) attachFiles(S.pickTarget, files); else captureFiles(files);
    S.pickTarget = null;
  });

  /* ================= paste & drop ================= */
  const dialogOpen = () => !!document.querySelector('dialog[open]');
  const appVisible = () => !$('#app').classList.contains('hidden');
  const typing = (t) => t && t.closest && t.closest('input, textarea, [contenteditable="true"]');

  document.addEventListener('paste', (e) => {
    if (!appVisible() || dialogOpen()) return;
    const files = [...(e.clipboardData?.files || [])];
    if (files.length) { e.preventDefault(); captureFiles(files); return; }
    if (typing(e.target)) return;
    const text = e.clipboardData?.getData('text/plain') || '';
    if (!text.trim()) return;
    e.preventDefault();
    createNote({ text: text.replace(/\s+$/, '') }).then((it) => { if (it) toast('Pasted and saved'); });
  });

  let dragDepth = 0;
  const hasFiles = (e) => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
  const clearTargets = () => document.querySelectorAll('.drop-target').forEach((n) => n.classList.remove('drop-target'));
  document.addEventListener('dragenter', (e) => { if (appVisible() && hasFiles(e)) { dragDepth++; $('#veil').classList.remove('hidden'); } });
  document.addEventListener('dragleave', (e) => {
    if (hasFiles(e) && --dragDepth <= 0) { dragDepth = 0; $('#veil').classList.add('hidden'); clearTargets(); }
  });
  document.addEventListener('dragover', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    const entry = e.target.closest && e.target.closest('.entry');
    clearTargets();
    if (entry) entry.classList.add('drop-target');
  });
  document.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth = 0;
    $('#veil').classList.add('hidden');
    clearTargets();
    if (!appVisible()) return;
    const files = [...e.dataTransfer.files];
    if (!files.length) return;
    const entry = e.target.closest && e.target.closest('.entry');
    if (entry && entry.classList.contains('trashed')) { toast('Restore this entry first to add files', { err: true }); return; }
    if (entry) attachFiles(Number(entry.dataset.id), files); else captureFiles(files);
  });

  /* ================= share links ================= */
  const shareUrl = (token) => `${location.origin}/s/${token}`;

  function openShare(id, fileId) {
    S.share = { id, scope: fileId || 'item', ttl: S.share ? S.share.ttl : '3600', created: null };
    renderShare();
    const dlg = $('#dlgShare');
    if (!dlg.open) dlg.showModal();
  }

  function renderShare() {
    const dlg = $('#dlgShare');
    const st = S.share;
    const it = st && S.items.find((x) => x.id === st.id);
    if (!it) { if (dlg.open) dlg.close(); return; }
    const hasText = !!it.text.trim();
    const needScope = it.files.length > 0 && (hasText || it.files.length > 1);
    if (st.scope !== 'item' && !it.files.some((f) => f.id === st.scope)) st.scope = 'item';

    const body = h('div', { class: 's-body' },
      h('h2', {}, 'Share a link'),
      h('p', { class: 'sub' }, 'Anyone with the link can view it without logging in. The link stops working when it expires.'));

    if (needScope) {
      const scopes = [{ id: 'item', label: 'Everything in this entry', ic: 'inbox' }, ...it.files.map((f) => ({ id: f.id, label: f.name, ic: isImage(f) ? 'image' : 'file' }))];
      body.append(h('div', { class: 's-label' }, 'What to share'),
        h('div', { class: 's-scope', role: 'radiogroup' }, scopes.map((s) =>
          h('button', { type: 'button', role: 'radio', 'aria-checked': String(st.scope === s.id), onclick: () => { st.scope = s.id; st.created = null; renderShare(); } },
            icon(s.ic), h('span', { class: 't' }, s.label)))));
    }

    body.append(h('div', { class: 's-label' }, 'Link expires after'),
      h('div', { class: 's-ttl', role: 'radiogroup' }, SHARE_TTL.map(([v, label]) =>
        h('button', { type: 'button', role: 'radio', 'aria-checked': String(st.ttl === v), onclick: () => { st.ttl = v; renderShare(); } }, label))));

    if (st.created) {
      const url = shareUrl(st.created);
      const input = h('input', { type: 'text', readonly: true, value: url, 'aria-label': 'Share link' });
      input.addEventListener('focus', () => input.select());
      body.append(h('div', { class: 's-result' }, input,
        h('button', { type: 'button', class: 'btn primary', onclick: () => copyText(url, 'Link copied') }, icon('copy', 'sm'), 'Copy'),
        navigator.share ? h('button', { type: 'button', class: 'btn', onclick: () => navigator.share({ url }).catch(() => {}) }, 'Send') : null));
    }

    body.append(h('div', { class: 's-actions' },
      h('button', { type: 'button', class: 'btn', onclick: () => dlg.close() }, 'Done'),
      h('button', { type: 'button', class: 'btn primary', onclick: createShare }, st.created ? 'Create another link' : 'Create link')));

    if (it.shares.length) {
      body.append(h('div', { class: 's-active' },
        h('div', { class: 's-label' }, 'Active links'),
        it.shares.map((s) => {
          const f = s.file_id && it.files.find((x) => x.id === s.file_id);
          const left = Date.parse(s.expires_at) - nowMs();
          return h('div', { class: 's-row' },
            h('div', { class: 't' }, f ? trunc(f.name, 34) : 'Entry',
              h('small', {}, 'Expires in ', h('span', { class: 'exp-left', dataset: { exp: Date.parse(s.expires_at) } }, fmtLeft(left)))),
            iconBtn('copy', 'Copy link', () => copyText(shareUrl(s.token), 'Link copied')),
            arm(iconBtn('x', 'Revoke link', () => {}, 'danger'), () => revokeShare(s.token), 'Revoke?'));
        })));
    }
    dlg.replaceChildren(body);
  }

  async function createShare() {
    const st = S.share;
    try {
      const body = { ttl: Number(st.ttl) };
      if (st.scope !== 'item') body.file_id = st.scope;
      const r = await api(`/api/items/${st.id}/shares`, { method: 'POST', body });
      st.created = r.token;
      await copyText(shareUrl(r.token), 'Link created and copied');
      scheduleRefresh();
      renderShare();
    } catch (e) { fail(e); }
  }

  async function revokeShare(token) {
    try {
      await api(`/api/shares/${token}`, { method: 'DELETE' });
      if (S.share && S.share.created === token) S.share.created = null;
      toast('Link revoked');
      scheduleRefresh();
    } catch (e) { fail(e); }
  }

  $('#dlgShare').addEventListener('close', () => { S.share = null; });
  $('#dlgShare').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });

  /* ================= lightbox ================= */
  function openLight(id, idx) {
    S.light = { id, idx };
    renderLight();
    const dlg = $('#dlgLight');
    if (!dlg.open) dlg.showModal();
  }

  function renderLight() {
    const dlg = $('#dlgLight');
    const it = S.light && findItem(S.light.id);
    const imgs = it ? it.files.filter(isImage) : [];
    if (!imgs.length) { if (dlg.open) dlg.close(); return; }
    S.light.idx = Math.max(0, Math.min(S.light.idx, imgs.length - 1));
    const f = imgs[S.light.idx];
    const step = (d) => { S.light.idx = (S.light.idx + d + imgs.length) % imgs.length; renderLight(); };
    dlg.replaceChildren(
      h('div', { class: 'l-bar' },
        h('h2', {}, f.name),
        imgs.length > 1 ? [iconBtn('left', 'Previous image', () => step(-1)), iconBtn('right', 'Next image', () => step(1))] : null,
        iconBtn('copy', 'Copy image', () => copyImage(f)),
        h('a', { class: 'icon-btn', href: `/api/files/${f.id}?download=1`, download: f.name, 'aria-label': 'Download', title: 'Download' }, icon('download')),
        iconBtn('share', 'Share a link', () => { dlg.close(); openShare(it.id, f.id); }),
        iconBtn('x', 'Close', () => dlg.close())),
      h('div', { class: 'l-stage' }, h('img', { src: `/api/files/${f.id}`, alt: f.name })));
  }

  $('#dlgLight').addEventListener('close', () => { S.light = null; });
  $('#dlgLight').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });
  $('#dlgLight').addEventListener('keydown', (e) => {
    if (!S.light) return;
    const imgs = (findItem(S.light.id)?.files || []).filter(isImage);
    if (imgs.length < 2) return;
    if (e.key === 'ArrowRight') { S.light.idx = (S.light.idx + 1) % imgs.length; renderLight(); }
    if (e.key === 'ArrowLeft') { S.light.idx = (S.light.idx - 1 + imgs.length) % imgs.length; renderLight(); }
  });

  /* ================= command bar ================= */
  const P = { q: '', sel: 0, rows: [], built: false };

  function reveal(id) {
    if (!visible().some((i) => i.id === id)) setView('all');
    requestAnimationFrame(() => {
      const el = document.querySelector(`.entry[data-id="${id}"]`);
      if (!el) return;
      el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      el.classList.remove('fresh');
      void el.offsetWidth;
      el.classList.add('fresh');
    });
  }

  function paletteRows(q) {
    const ql = q.trim().toLowerCase();
    const rows = [];
    const matches = S.items.filter((it) => !ql || it.text.toLowerCase().includes(ql) || it.files.some((f) => f.name.toLowerCase().includes(ql)));
    const shown = matches.slice(0, ql ? 8 : 5);
    for (const it of shown) {
      const kind = kindOf(it);
      const label = it.text.trim() ? trunc(it.text, 70) : it.files.map((f) => f.name).join(', ');
      rows.push({
        group: ql ? 'Entries' : 'Recent', icon: KIND_ICON[kind], label,
        hint: it.text.trim() ? 'Copy' : 'Show',
        run: () => (it.text.trim() ? copyText(copyPayload(it)) : reveal(it.id)),
        show: () => reveal(it.id),
      });
    }
    if (q.trim()) {
      rows.push(
        { group: 'Save', icon: 'plus', label: `Save as note: ${trunc(q, 50)}`, hint: `${MOD} ↵`, run: () => createNote({ text: q.trim() }).then((it) => it && toast('Saved')) },
        { group: 'Save', icon: 'tasks', label: `Save as task: ${trunc(q, 50)}`, run: () => createNote({ text: q.trim(), is_task: true }).then((it) => it && toast('Task saved')) });
    }
    const cmds = [
      ...VIEWS.map((v) => ({ group: 'Go to', icon: v.icon, label: v.label, run: () => setView(v.id) })),
      { group: 'Go to', icon: 'trash', label: 'Trash', run: () => setView('trash') },
      ...TTL_LONG.map(([v, label]) => ({
        group: 'New entries', icon: v === 'keep' ? 'infinity' : 'clock',
        label: v === 'keep' ? 'Keep new entries forever' : `Delete new entries after ${label}`,
        hint: S.ttl === v ? 'Current' : '', run: () => { S.ttl = v; store.set('ttl', v); renderFusePick(); toast('Updated'); },
      })),
      ...CB.cmds.flatMap((f) => f()),
      { group: 'App', icon: 'download', label: 'Download backup', run: downloadBackup },
      { group: 'App', icon: 'upload', label: 'Restore from a backup file', run: openBackup },
      { group: 'Theme', icon: 'palette', label: 'Theme: wood shelves', hint: Theme.style === 'wood' ? 'Current' : '', run: () => pickStyle('wood') },
      { group: 'Theme', icon: 'palette', label: 'Theme: plain paper', hint: Theme.style === 'paper' ? 'Current' : '', run: () => pickStyle('paper') },
      { group: 'Theme', icon: 'palette', label: 'Theme: background picture on', hint: Theme.wall === 'on' ? 'Current' : '', run: () => pickWall('on') },
      { group: 'Theme', icon: 'palette', label: 'Theme: plain colour, no picture', hint: Theme.wall === 'off' ? 'Current' : '', run: () => pickWall('off') },
      { group: 'Theme', icon: 'sun', label: 'Theme: auto light and dark', hint: Theme.mode === 'auto' ? 'Current' : '', run: () => pickMode('auto') },
      { group: 'Theme', icon: 'sun', label: 'Theme: always light', hint: Theme.mode === 'light' ? 'Current' : '', run: () => pickMode('light') },
      { group: 'Theme', icon: 'moon', label: 'Theme: always dark', hint: Theme.mode === 'dark' ? 'Current' : '', run: () => pickMode('dark') },
      { group: 'App', icon: 'logout', label: 'Log out', run: () => $('#logoutBtn').click() },
    ];
    for (const c of cmds) if (!ql || c.label.toLowerCase().includes(ql) || c.group.toLowerCase().includes(ql)) rows.push(c);
    return rows;
  }

  function renderPalette() {
    const list = $('#dlgPalette .p-list');
    P.rows = paletteRows(P.q);
    P.sel = Math.min(P.sel, Math.max(0, P.rows.length - 1));
    if (!P.rows.length) { list.replaceChildren(h('div', { class: 'p-none' }, 'Nothing matches. Press Enter to save what you typed.')); return; }
    const nodes = [];
    let lastGroup = '';
    P.rows.forEach((r, i) => {
      if (r.group !== lastGroup) { nodes.push(h('div', { class: 'p-group' }, r.group)); lastGroup = r.group; }
      nodes.push(h('div', {
        class: 'p-item', role: 'option', id: `prow${i}`, 'aria-selected': String(i === P.sel), dataset: { i },
        onclick: () => runRow(i),
        onmousemove: () => { if (P.sel !== i) { P.sel = i; markSel(); } },
      }, icon(r.icon), h('span', { class: 't' }, r.label), r.hint ? h('span', { class: 'h' }, r.hint) : null));
    });
    list.replaceChildren(...nodes);
  }

  function markSel() {
    for (const n of document.querySelectorAll('#dlgPalette .p-item')) n.setAttribute('aria-selected', String(Number(n.dataset.i) === P.sel));
    const cur = $(`#prow${P.sel}`);
    if (cur) cur.scrollIntoView({ block: 'nearest' });
  }

  function runRow(i, alt) {
    const r = P.rows[i];
    if (!r) return;
    $('#dlgPalette').close();
    (alt && r.show ? r.show : r.run)();
  }

  function buildPalette() {
    const dlg = $('#dlgPalette');
    const input = h('input', { type: 'text', placeholder: 'Search entries, or type something to save', 'aria-label': 'Search or run a command', autocomplete: 'off', spellcheck: 'false', role: 'combobox', 'aria-expanded': 'true' });
    input.addEventListener('input', () => { P.q = input.value; P.sel = 0; renderPalette(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); P.sel = Math.min(P.rows.length - 1, P.sel + 1); markSel(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); P.sel = Math.max(0, P.sel - 1); markSel(); }
      else if (e.key === 'Enter' && !e.isComposing) {
        e.preventDefault();
        if ((e.ctrlKey || e.metaKey) && P.q.trim()) {
          dlg.close();
          createNote({ text: P.q.trim() }).then((it) => it && toast('Saved'));
        } else if (P.rows.length) runRow(P.sel, e.shiftKey);
        else if (P.q.trim()) { dlg.close(); createNote({ text: P.q.trim() }).then((it) => it && toast('Saved')); }
      }
    });
    dlg.replaceChildren(
      h('div', { class: 'p-input' }, icon('search'), input),
      h('div', { class: 'p-list', role: 'listbox' }),
      h('div', { class: 'p-foot' }, h('span', {}, '↑↓ move'), h('span', {}, '↵ run'), h('span', {}, '⇧↵ show entry'), h('span', {}, `${MOD} ↵ save as note`)));
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  }

  function openPalette() {
    const dlg = $('#dlgPalette');
    if (dlg.open) return;
    closeMenu();
    if (!P.built) { buildPalette(); P.built = true; }
    P.q = ''; P.sel = 0;
    dlg.querySelector('input').value = '';
    renderPalette();
    dlg.showModal();
    dlg.querySelector('input').focus();
  }

  $('#searchBtn').addEventListener('click', openPalette);
  $('#searchIc').append(icon('search'));
  $('#kbdHint').textContent = `${MOD} K`;

  document.addEventListener('keydown', (e) => {
    if (!appVisible()) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); return; }
    if (e.key === '/' && !typing(e.target) && !dialogOpen() && !e.ctrlKey && !e.metaKey) { e.preventDefault(); ta.focus(); }
  });

  /* ================= backup and restore ================= */
  const DAY = 864e5;
  const daysSince = (iso, now) => (Date.parse(now) - Date.parse(iso)) / DAY;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;
  const agoText = (d) => (d < 1 ? 'today' : d < 2 ? 'yesterday' : `${Math.floor(d)} days ago`);

  // free databases expire after about 30 days: nudge from day 23 unless a backup is recent
  function needsBackup(info) {
    if (!info || !info.db_created_at) return false;
    const age = daysSince(info.db_created_at, info.now);
    const since = info.last_backup_at ? daysSince(info.last_backup_at, info.now) : Infinity;
    return age >= 23 && since > 5;
  }

  function paintBackupDot() {
    const b = $('#backupBtn');
    const dot = b.querySelector('.dot');
    const want = needsBackup(S.info);
    if (want && !dot) b.append(h('i', { class: 'dot' }));
    if (!want && dot) dot.remove();
    b.title = want ? 'Backup and restore. A backup is due' : 'Backup and restore';
  }

  async function loadBackupInfo() {
    try { S.info = await api('/api/backup/info'); } catch { return; }
    paintBackupDot();
    if (S.backup) renderBackup();
  }

  function downloadBackup() {
    const a = h('a', { href: '/api/backup', download: true });
    document.body.append(a);
    a.click();
    a.remove();
    toast('Preparing your backup. The download starts in a moment');
    setTimeout(loadBackupInfo, 6000);
    setTimeout(loadBackupInfo, 20000);
  }

  function openBackup() {
    S.backup = { file: null, busy: false, progress: 0, result: null };
    renderBackup();
    const dlg = $('#dlgBackup');
    if (!dlg.open) dlg.showModal();
    loadBackupInfo();
  }

  function renderBackup() {
    const st = S.backup;
    if (!st) return;
    const info = S.info;
    const body = h('div', { class: 's-body' },
      h('h2', {}, 'Backup and restore'),
      h('p', { class: 'sub' }, 'Free Render databases expire after about 30 days. Download a backup first, set up the new database, then restore the file here.'));

    if (info) {
      const age = info.db_created_at ? daysSince(info.db_created_at, info.now) : null;
      const last = info.last_backup_at ? daysSince(info.last_backup_at, info.now) : null;
      if (needsBackup(info)) {
        body.append(h('div', { class: 'b-warn', role: 'status' }, icon('clock'),
          h('span', {}, `This database is ${plural(Math.floor(age), 'day')} old and ${last == null ? 'has never been backed up' : `was last backed up ${agoText(last)}`}. Download a backup now.`)));
      }
      body.append(
        h('div', { class: 'b-stats' },
          h('div', { class: 'b-stat' }, h('b', {}, info.items), h('span', {}, info.items === 1 ? 'entry' : 'entries')),
          h('div', { class: 'b-stat' }, h('b', {}, info.files), h('span', {}, info.files === 1 ? 'file' : 'files')),
          h('div', { class: 'b-stat' }, h('b', {}, fmtSize(info.bytes)), h('span', {}, 'file data'))),
        h('p', { class: 'b-note' },
          [age == null ? null : `Database set up ${agoText(age)}.`, last == null ? 'No backup downloaded yet.' : `Last backup ${agoText(last)}.`,
            info.trashed ? `${plural(info.trashed, 'entry', 'entries')} in the trash.` : null,
            info.goals ? `${plural(info.goals, 'goal')} with ${plural(info.plan_tasks, 'planned day')}.` : null,
            info.diary ? `${plural(info.diary, 'logbook entry', 'logbook entries')}.` : null].filter(Boolean).join(' ')));
    }

    body.append(h('div', { class: 'b-sec' },
      h('h3', {}, 'Download a backup'),
      h('p', {}, 'One file with every entry, file, pin, trashed entry and share link, plus your goals, plan and logbook. Keep it somewhere safe.'),
      h('button', { type: 'button', class: 'btn primary', onclick: downloadBackup }, icon('download', 'sm'), 'Download backup')));

    const f = st.file;
    body.append(h('div', { class: 'b-sec' },
      h('h3', {}, 'Restore from a backup'),
      h('p', {}, 'Restoring adds to what is already here. Entries that are already in this database are skipped, so it is safe to run twice.'),
      h('div', { class: 'b-row' },
        h('button', { type: 'button', class: 'btn', disabled: st.busy, onclick: () => $('#backupPicker').click() }, icon('upload', 'sm'), f ? 'Choose another file' : 'Choose backup file'),
        f ? h('span', { class: 'b-file', title: f.name }, `${f.name} (${fmtSize(f.size)})`) : h('span', { class: 'b-file' }, 'No file chosen'),
        h('button', { type: 'button', class: 'btn primary', disabled: !f || st.busy, onclick: restoreBackup }, st.busy ? (st.progress >= 1 ? 'Restoring…' : 'Uploading…') : 'Restore')),
      st.busy ? h('div', { class: 'b-prog' }, h('i', { style: `width:${Math.round(st.progress * 100)}%` })) : null,
      st.result ? h('p', { class: 'b-result' + (st.result.ok ? '' : ' err'), role: st.result.ok ? 'status' : 'alert' }, resultText(st.result)) : null));

    body.append(h('div', { class: 's-actions' }, h('button', { type: 'button', class: 'btn', onclick: () => $('#dlgBackup').close() }, 'Done')));
    $('#dlgBackup').replaceChildren(body);
  }

  function resultText(r) {
    if (!r.ok) return r.error;
    const a = r.added || {};
    const s = r.skipped || {};
    const wsAdded = (a.goals || 0) + (a.tasks || 0) + (a.diary || 0) + (a.weeks || 0);
    if (!a.items && !wsAdded) {
      const here = (s.items || 0) + (s.goals || 0) + (s.tasks || 0) + (s.diary || 0);
      return here ? 'Nothing new to restore. Everything in this backup is already here.' : 'This backup has nothing to restore.';
    }
    const parts = [];
    if (a.items || a.files) parts.push(`Restored ${plural(a.items, 'entry', 'entries')} and ${plural(a.files, 'file')}.`);
    if (a.goals || a.tasks) parts.push(`Restored ${plural(a.goals || 0, 'goal')} and ${plural(a.tasks || 0, 'planned day')}.`);
    if (a.diary) parts.push(`Restored ${plural(a.diary, 'logbook entry', 'logbook entries')}.`);
    if (s.items) parts.push(`${s.items} ${s.items === 1 ? 'was' : 'were'} already here.`);
    if (s.expired) parts.push(`${s.expired} had already auto-deleted.`);
    return parts.join(' ');
  }

  async function restoreBackup() {
    const st = S.backup;
    if (!st || !st.file || st.busy) return;
    st.busy = true; st.progress = 0; st.result = null;
    renderBackup();
    try {
      const r = await upload('/api/backup/import', st.file, (p) => {
        st.progress = p;
        const bar = document.querySelector('#dlgBackup .b-prog i');
        if (bar) bar.style.width = `${Math.round(p * 100)}%`;
        if (p >= 1) renderBackup();
      }, 'application/octet-stream');
      st.result = { ok: true, ...r };
      st.file = null;
      scheduleRefresh('import');
      loadBackupInfo();
    } catch (e) { st.result = { ok: false, error: e.message }; }
    st.busy = false;
    renderBackup();
  }

  $('#dlgBackup').addEventListener('close', () => { S.backup = null; });
  $('#dlgBackup').addEventListener('click', (e) => { if (e.target === e.currentTarget && !(S.backup && S.backup.busy)) e.currentTarget.close(); });
  $('#dlgBackup').addEventListener('cancel', (e) => { if (S.backup && S.backup.busy) e.preventDefault(); });
  {
    const bp = h('input', { type: 'file', id: 'backupPicker', class: 'hidden', accept: '.gz,.jsonl,.json,application/gzip' });
    bp.addEventListener('change', () => {
      const f = bp.files[0];
      bp.value = '';
      if (!f || !S.backup) return;
      S.backup.file = f;
      S.backup.result = null;
      renderBackup();
    });
    document.body.append(bp);
  }

  /* ================= install & service worker ================= */
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    S.installEvt = e;
    $('#installBtn').classList.remove('hidden');
  });
  window.addEventListener('appinstalled', () => { S.installEvt = null; $('#installBtn').classList.add('hidden'); toast('Installed. Share to Clipboard from any app.'); });
  $('#installBtn').append(icon('download'));
  $('#installBtn').addEventListener('click', async () => {
    if (!S.installEvt) return;
    S.installEvt.prompt();
    await S.installEvt.userChoice.catch(() => {});
    S.installEvt = null;
    $('#installBtn').classList.add('hidden');
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
  }

  /* ================= boot ================= */
  $('#logoutBtn').append(icon('logout'));
  $('#backupBtn').append(icon('database'));
  $('#backupBtn').addEventListener('click', openBackup);
  paintThemeBtn();
  renderFusePick();
  renderTaskToggle();
  autosize();

  async function boot() {
    const sp = new URLSearchParams(location.search);
    const shared = sp.get('shared');
    if (shared) history.replaceState(null, '', '/');
    try {
      const me = await api('/api/me');
      if (me.loggedIn) {
        enterApp();
        if (shared === '1') toast('Saved from your share sheet');
        if (shared === 'err') toast('Could not save what you shared. Try again.', { err: true });
      } else {
        showLogin();
        if (shared === 'login') $('#loginErr').textContent = 'Log in, then share again. Nothing was saved.';
      }
    } catch {
      toast('Cannot reach the server. Retrying…', { err: true });
      setTimeout(boot, 4000);
    }
  }
  boot();
})();
