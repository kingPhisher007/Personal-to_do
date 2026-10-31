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
    { id: 'tasks', label: 'Tasks', icon: 'tasks', test: (i) => i.is_task, empty: ['No tasks', 'Switch on Task in the box above, then save one.'] },
    { id: 'links', label: 'Links', icon: 'link', test: (i) => kindOf(i) === 'link', empty: ['No links', 'Paste a web address and it shows up here.'] },
    { id: 'code', label: 'Code', icon: 'code', test: (i) => kindOf(i) === 'code', empty: ['No code', 'Snippets and shell commands you paste land here.'] },
    { id: 'files', label: 'Files', icon: 'file', test: (i) => i.files.length > 0, empty: ['No files', 'Paste a screenshot or drop a file anywhere on the page.'] },
  ];

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
    const t = h('div', { class: 'toast' + (o.err ? ' err' : '') + (o.sticky ? ' sticky' : ''), role: o.err ? 'alert' : 'status' }, msg, prog);
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
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    return data;
  }

  function upload(path, fd, onProgress) {
    return new Promise((resolve, reject) => {
      const x = new XMLHttpRequest();
      x.open('POST', path);
      x.withCredentials = true;
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

  /* ================= data flow ================= */
  let refreshTimer = null;
  let refreshing = false;
  let again = false;

  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, 80);
  }

  async function refresh() {
    if (refreshing) { again = true; return; }
    refreshing = true;
    try {
      const d = await api('/api/items');
      S.offset = Date.parse(d.now) - Date.now();
      S.items = d.items;
      S.loaded = true;
      render();
      S.flash = true; // from now on, entries that arrive get the "new" highlight (not the first load)
      if (S.share) renderShare();
      if (S.light) renderLight();
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
    es.addEventListener('open', () => { setLive(true); scheduleRefresh(); });
    es.addEventListener('change', scheduleRefresh);
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

  async function deleteItem(id) {
    const prev = S.items;
    S.items = S.items.filter((x) => x.id !== id);
    render();
    try { await api(`/api/items/${id}`, { method: 'DELETE' }); scheduleRefresh(); }
    catch (e) { S.items = prev; render(); fail(e); }
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
    S.items = []; S.loaded = false; S.flash = false;
    known.clear();
    $('#feed').replaceChildren();
    $('#app').classList.add('hidden');
    $('#login').classList.remove('hidden');
    for (const d of document.querySelectorAll('dialog[open]')) d.close();
  }

  function enterApp() {
    $('#login').classList.add('hidden');
    $('#app').classList.remove('hidden');
    render();
    refresh();
    connectEvents();
  }

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
  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    store.set('theme', t);
    const m = $('meta[name="theme-color"]');
    if (m) m.content = t === 'light' ? '#f3f5f9' : '#0f1420';
    $('#themeBtn').replaceChildren(icon(t === 'light' ? 'moon' : 'sun'));
    $('#themeBtn').title = t === 'light' ? 'Switch to dark theme' : 'Switch to light theme';
  }
  const toggleTheme = () => applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  $('#themeBtn').addEventListener('click', toggleTheme);

  /* ================= rendering ================= */
  const visible = () => S.items.filter(VIEWS.find((v) => v.id === S.view).test);

  function setView(id) {
    S.view = id;
    store.set('view', id);
    render();
    window.scrollTo({ top: 0 });
  }

  let navKey = '';
  function renderNav() {
    const counts = VIEWS.map((v) => S.items.filter(v.test).length);
    const key = S.view + counts.join(',');
    if (key === navKey) return;
    navKey = key;
    $('#nav').replaceChildren(...VIEWS.map((v, i) =>
      h('button', { type: 'button', 'aria-current': String(S.view === v.id), onclick: () => setView(v.id) },
        icon(v.icon), h('span', { class: 'label' }, v.label), h('span', { class: 'count' }, counts[i]))));
  }

  const known = new Set();
  function signature(it) {
    return JSON.stringify([
      it.text, it.done, it.is_task, it.expires_at, it.ttl_seconds,
      it.files.map((f) => f.id + f.name), it.shares.map((s) => s.token),
      S.edit && S.edit.id === it.id ? 'edit' : '',
    ]);
  }

  function renderFeed(items) {
    const feed = $('#feed');
    const existing = new Map();
    for (const el of feed.children) existing.set(Number(el.dataset.id), el);
    let prev = null;
    for (const it of items) {
      let el = existing.get(it.id);
      const sig = signature(it);
      if (!el || el._sig !== sig) {
        const fresh = buildEntry(it);
        fresh._sig = sig;
        if (el) feed.replaceChild(fresh, el);
        else if (S.flash && !known.has(it.id)) fresh.classList.add('fresh');
        el = fresh;
      }
      existing.delete(it.id);
      const ref = prev ? prev.nextElementSibling : feed.firstElementChild;
      if (ref !== el) feed.insertBefore(el, ref);
      prev = el;
      known.add(it.id);
    }
    for (const el of existing.values()) el.remove();
  }

  function renderEmpty(count) {
    const e = $('#empty');
    if (count || !S.loaded) { e.classList.add('hidden'); return; }
    const v = VIEWS.find((x) => x.id === S.view);
    e.replaceChildren(icon(v.icon), h('h2', {}, v.empty[0]), h('p', {}, v.empty[1]));
    e.classList.remove('hidden');
  }

  function render() {
    const items = visible();
    renderNav();
    renderFeed(items);
    renderEmpty(items.length);
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

  function buildActions(it, kind) {
    const a = h('div', { class: 'actions' });
    const text = it.text.trim();
    const imgs = it.files.filter(isImage);
    const attach = () => { S.pickTarget = it.id; $('#picker').click(); };

    // Wide screens: individual buttons that appear on hover. Copy sits last so it never moves.
    a.append(
      arm(iconBtn('trash', 'Delete', () => {}, 'danger act-more'), () => deleteItem(it.id)),
      iconBtn('pencil', 'Edit', () => startEdit(it), 'act-more'),
      iconBtn('clip', 'Attach files', attach, 'act-more'),
      iconBtn('clock', 'Change auto-delete', (e) => openExpiryMenu(e.currentTarget, it), 'act-more' + (it.expires_at ? ' on' : '')),
      iconBtn('share', 'Share a link', () => openShare(it.id), 'act-more'),
    );

    // Phones and touch screens: one menu button instead.
    const more = iconBtn('more', 'More actions', () => openMenu(more, null, [
      { label: 'Share a link', icon: 'share', onSelect: () => openShare(it.id) },
      { label: 'Auto-delete…', icon: 'clock', onSelect: () => openExpiryMenu(more, it) },
      { label: 'Attach files', icon: 'clip', onSelect: attach },
      { label: 'Edit', icon: 'pencil', onSelect: () => startEdit(it) },
      { label: 'Delete…', icon: 'trash', onSelect: () => openMenu(more, 'Delete this entry?', [
        { label: 'Delete', icon: 'trash', onSelect: () => deleteItem(it.id) },
        { label: 'Keep it', icon: 'x', onSelect: () => {} },
      ]) },
    ]), 'act-menu');
    a.append(more);

    if (text) a.append(iconBtn('copy', kind === 'link' ? 'Copy link' : kind === 'code' ? 'Copy code' : 'Copy text', () => copyText(copyPayload(it))));
    else if (it.files.length === 1 && imgs.length === 1) a.append(iconBtn('copy', 'Copy image', () => copyImage(imgs[0])));
    return a;
  }

  function buildEntry(it) {
    const kind = kindOf(it);
    const editing = S.edit && S.edit.id === it.id;
    const root = h('article', { class: 'entry' + (it.is_task && it.done ? ' done' : ''), dataset: { id: it.id, kind } });
    if (it.expires_at) {
      const total = it.ttl_seconds ? it.ttl_seconds * 1000 : Date.parse(it.expires_at) - Date.parse(it.created_at);
      root.dataset.exp = Date.parse(it.expires_at);
      root.dataset.total = total;
      root.append(h('div', { class: 'fuse' }, h('i')));
    }
    const head = h('div', { class: 'e-head' },
      h('span', { class: 'lead' }, icon(KIND_ICON[kind])),
      h('span', { class: 'ago', dataset: { ts: it.created_at } }, fmtAgo(it.created_at)),
      it.expires_at ? h('span', { class: 'pill' }, icon('clock', 'sm'), h('span', { class: 'pill-t' })) : null,
      buildActions(it, kind));
    root.append(head);

    if (editing) root.append(buildEditor(it));
    else root.append(...buildBody(it, kind));
    if (it.files.length) root.append(...buildFiles(it));
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
      const check = h('button', {
        type: 'button', class: 'check', role: 'checkbox', 'aria-checked': String(it.done), 'aria-label': 'Mark done',
        onclick: () => { it.done = !it.done; render(); patchItem(it, { done: it.done }); },
      }, icon('check', 'sm'));
      return [h('div', { class: 'task-line' }, check, h('div', { class: 'e-text' }, text || '(empty task)'))];
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

  function buildFiles(it) {
    const out = [];
    const imgs = it.files.filter(isImage);
    const others = it.files.filter((f) => !isImage(f));
    if (imgs.length) {
      const grid = h('div', { class: 'thumbs' + (imgs.length === 1 ? ' one' : '') });
      imgs.forEach((f, idx) => {
        const x = arm(h('button', { type: 'button', class: 'x', 'aria-label': 'Remove image', title: 'Remove image' }, icon('x', 'sm')), () => removeFile(it, f), 'Remove?');
        grid.append(h('div', {
          class: 'thumb', role: 'button', tabindex: '0', 'aria-label': `Preview ${f.name}`,
          onclick: () => openLight(it.id, idx),
          onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLight(it.id, idx); } },
        }, h('img', { src: `/api/files/${f.id}`, alt: f.name, loading: 'lazy' }), x));
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
          iconBtn('share', 'Share this file', () => openShare(it.id, f.id)),
          arm(iconBtn('x', 'Remove file', () => {}, 'danger'), () => removeFile(it, f), 'Remove?'));
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
      const t = fmtAgo(el.dataset.ts);
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
    const it = S.light && S.items.find((x) => x.id === S.light.id);
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
    const imgs = (S.items.find((x) => x.id === S.light.id)?.files || []).filter(isImage);
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
      ...TTL_LONG.map(([v, label]) => ({
        group: 'New entries', icon: v === 'keep' ? 'infinity' : 'clock',
        label: v === 'keep' ? 'Keep new entries forever' : `Delete new entries after ${label}`,
        hint: S.ttl === v ? 'Current' : '', run: () => { S.ttl = v; store.set('ttl', v); renderFusePick(); toast('Updated'); },
      })),
      { group: 'App', icon: document.documentElement.dataset.theme === 'light' ? 'moon' : 'sun', label: 'Switch theme', run: toggleTheme },
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
  applyTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
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
