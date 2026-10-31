const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const { Pool } = require('pg');

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;
const APP_USER = process.env.APP_USER;
const APP_PASSWORD = process.env.APP_PASSWORD;
const SESSION_SECRET = process.env.SESSION_SECRET;
const MAX_FILE_MB = Number(process.env.MAX_FILE_MB || 10);
const IS_PROD = process.env.NODE_ENV === 'production' || !!process.env.RENDER;
const SESSION_DAYS = 30;
const MAX_TTL_SECONDS = 30 * 86400;

for (const [k, v] of Object.entries({ DATABASE_URL, APP_USER, APP_PASSWORD, SESSION_SECRET })) {
  if (!v) {
    console.error(`Missing required env var: ${k}`);
    process.exit(1);
  }
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: /render\.com|neon\.tech|supabase\.co/.test(DATABASE_URL) ? { rejectUnauthorized: false } : false,
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS items (
      id SERIAL PRIMARY KEY,
      text TEXT NOT NULL DEFAULT '',
      done BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE items ADD COLUMN IF NOT EXISTS is_task BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE items ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
    ALTER TABLE items ADD COLUMN IF NOT EXISTS ttl_seconds INTEGER;
    CREATE INDEX IF NOT EXISTS items_expires_idx ON items(expires_at) WHERE expires_at IS NOT NULL;

    CREATE TABLE IF NOT EXISTS files (
      id SERIAL PRIMARY KEY,
      item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      mime TEXT NOT NULL,
      size INTEGER NOT NULL,
      data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS files_item_idx ON files(item_id);

    CREATE TABLE IF NOT EXISTS shares (
      token TEXT PRIMARY KEY,
      item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      file_id INTEGER REFERENCES files(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS shares_item_idx ON shares(item_id);
  `);
}

/* ---------- live updates (Server-Sent Events) ---------- */

const clients = new Set();

function notify(type = 'change') {
  const msg = `event: change\ndata: ${JSON.stringify({ type, t: Date.now() })}\n\n`;
  for (const res of clients) {
    try { res.write(msg); } catch { clients.delete(res); }
  }
}

/* ---------- auth: HMAC-signed cookie, single user from env ---------- */

const safeEqual = (a, b) => {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
};

const sign = (payload) => crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');

function makeToken() {
  const payload = Buffer.from(JSON.stringify({ u: APP_USER, exp: Date.now() + SESSION_DAYS * 864e5 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token) {
  if (!token || !token.includes('.')) return false;
  const [payload, sig] = token.split('.');
  if (!safeEqual(sig, sign(payload))) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.u === APP_USER && data.exp > Date.now();
  } catch {
    return false;
  }
}

function getCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

const isAuthed = (req) => verifyToken(getCookie(req, 'session'));

const requireAuth = (req, res, next) => {
  if (isAuthed(req)) return next();
  res.status(401).json({ error: 'Not logged in' });
};

// very small in-memory login throttle: 10 failures / 15 min / IP
const attempts = new Map();
function throttled(ip) {
  const now = Date.now();
  const rec = (attempts.get(ip) || []).filter((t) => now - t < 15 * 60 * 1000);
  attempts.set(ip, rec);
  return rec.length >= 10;
}

/* ---------- helpers ---------- */

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtSize = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);
const INLINE_OK = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const ALIVE = '(i.expires_at IS NULL OR i.expires_at > NOW())';

// Expiry: null / undefined / '' / 0 / 'forever' => keep forever (returns null).
// A number of seconds => that many seconds. Anything else => false (invalid).
function parseTtl(v) {
  if (v === null || v === undefined || v === '' || v === 0 || v === '0' || v === 'forever') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1 || n > MAX_TTL_SECONDS) return false;
  return Math.floor(n);
}

const EXPIRES_SQL = (p) =>
  `CASE WHEN ${p}::float8 IS NULL THEN NULL ELSE NOW() + make_interval(secs => ${p}::float8) END`;

const ITEM_COLS = 'id, text, done, is_task, created_at, expires_at, ttl_seconds';

async function saveFiles(client, itemId, files) {
  const saved = [];
  for (const f of files || []) {
    // multer decodes names as latin1; restore utf8
    const name = Buffer.from(f.originalname, 'latin1').toString('utf8');
    const { rows } = await client.query(
      'INSERT INTO files (item_id, name, mime, size, data) VALUES ($1,$2,$3,$4,$5) RETURNING id, name, mime, size',
      [itemId, name, f.mimetype || 'application/octet-stream', f.size, f.buffer]
    );
    saved.push(rows[0]);
  }
  return saved;
}

/* ---------- app ---------- */

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  next();
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_MB * 1024 * 1024, files: 20 },
});

app.get('/healthz', (req, res) => res.send('ok'));

app.post('/api/login', (req, res) => {
  const ip = req.ip;
  if (throttled(ip)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  const { username, password } = req.body || {};
  const ok = safeEqual(username || '', APP_USER) && safeEqual(password || '', APP_PASSWORD);
  if (!ok) {
    attempts.get(ip).push(Date.now());
    return res.status(401).json({ error: 'Wrong username or password' });
  }
  res.cookie('session', makeToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PROD,
    maxAge: SESSION_DAYS * 864e5,
    path: '/',
  });
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('session', { path: '/' });
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  res.json({ loggedIn: isAuthed(req) });
});

/* ---------- public share pages (no login) ---------- */

function sharePageHead(title) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><meta name="referrer" content="no-referrer">
<title>${esc(title)}</title>
<link rel="icon" href="/icons/icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/tokens.css"><link rel="stylesheet" href="/share.css"></head><body>`;
}

function sendShareHtml(res, status, html) {
  res.status(status).set({
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex, nofollow',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy':
      "default-src 'none'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self'; script-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  }).send(html);
}

const BRAND = `<a class="brand" href="/"><svg viewBox="0 0 128 128" width="26" height="26" aria-hidden="true"><use href="/icons/icon.svg#m"/></svg><span>Clipboard</span></a>`;

function shareGone(res) {
  sendShareHtml(res, 404, `${sharePageHead('Link unavailable')}<main class="wrap">${BRAND}
<article class="card gone"><h1>This link has expired</h1>
<p>Shared links stop working after the time the sender chose. Ask them to send a new one.</p></article></main></body></html>`);
}

async function loadShare(token) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const { rows } = await pool.query(
    `SELECT s.token, s.file_id, s.expires_at, i.id AS item_id, i.text
       FROM shares s JOIN items i ON i.id = s.item_id
      WHERE s.token = $1 AND s.expires_at > NOW() AND ${ALIVE}`,
    [token]
  );
  if (!rows.length) return null;
  const s = rows[0];
  const params = [s.item_id];
  let sql = 'SELECT id, name, mime, size FROM files WHERE item_id = $1';
  if (s.file_id) { params.push(s.file_id); sql += ' AND id = $2'; }
  s.files = (await pool.query(sql + ' ORDER BY id', params)).rows;
  return s;
}

app.get('/s/:token', async (req, res, next) => {
  try {
    const s = await loadShare(req.params.token);
    if (!s) return shareGone(res);
    const text = s.file_id ? '' : (s.text || '').trim();
    const isUrl = /^https?:\/\/\S+$/.test(text);
    let body = '';
    if (text) {
      body += `<section class="block"><div class="block-head"><span>Text</span><button class="btn" id="copyBtn" type="button">Copy</button></div>`;
      body += isUrl
        ? `<a class="url" id="copySrc" href="${esc(text)}" target="_blank" rel="noopener noreferrer nofollow">${esc(text)}</a>`
        : `<pre class="txt" id="copySrc">${esc(text)}</pre>`;
      body += '</section>';
    }
    if (s.files.length) {
      body += '<section class="files">';
      for (const f of s.files) {
        const base = `/s/${s.token}/f/${f.id}`;
        const img = INLINE_OK.has(f.mime) ? `<a class="pic" href="${base}" target="_blank" rel="noopener"><img src="${base}" alt="${esc(f.name)}"></a>` : '';
        body += `<div class="file">${img}<div class="file-row"><div class="file-meta"><b>${esc(f.name)}</b><small>${fmtSize(f.size)}</small></div><a class="btn primary" href="${base}?download=1" download>Download</a></div></div>`;
      }
      body += '</section>';
    }
    if (!body) body = '<p class="muted">Nothing to show.</p>';
    sendShareHtml(res, 200, `${sharePageHead('Shared with you')}<main class="wrap">${BRAND}
<article class="card"><h1>Shared with you</h1>${body}</article>
<p class="expiry">This link expires <time id="exp" datetime="${new Date(s.expires_at).toISOString()}">${esc(new Date(s.expires_at).toUTCString())}</time></p>
</main><script src="/share.js"></script></body></html>`);
  } catch (e) { next(e); }
});

app.get('/s/:token/f/:fileId', async (req, res, next) => {
  try {
    const s = await loadShare(req.params.token);
    const fileId = Number(req.params.fileId);
    if (!s || !s.files.some((f) => f.id === fileId)) return res.status(404).type('text').send('Not found');
    const { rows } = await pool.query('SELECT name, mime, data FROM files WHERE id = $1', [fileId]);
    if (!rows.length) return res.status(404).type('text').send('Not found');
    const f = rows[0];
    const inline = INLINE_OK.has(f.mime) && req.query.download !== '1';
    res.set({
      'Content-Type': INLINE_OK.has(f.mime) ? f.mime : 'application/octet-stream',
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(f.name)}`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    });
    res.send(f.data);
  } catch (e) { next(e); }
});

/* ---------- capture: used by the Android share sheet and the "paste file" flow ---------- */

async function createCapture(req) {
  const b = req.body || {};
  const lines = [];
  const text = String(b.text || '').trim();
  const url = String(b.url || '').trim();
  const title = String(b.title || '').trim();
  if (text) lines.push(text);
  if (url && !text.includes(url)) lines.push(url);
  const files = req.files || [];
  if (!lines.length && title && !files.length) lines.push(title);

  const ttl = parseTtl(b.ttl);
  if (ttl === false) { const e = new Error('Bad expiry'); e.status = 400; throw e; }
  const isTask = b.is_task === true || b.is_task === 'true';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO items (text, is_task, ttl_seconds, expires_at)
       VALUES ($1, $2, $3::int, ${EXPIRES_SQL('$3')}) RETURNING ${ITEM_COLS}`,
      [lines.join('\n'), isTask, ttl]
    );
    const saved = await saveFiles(client, rows[0].id, files);
    await client.query('COMMIT');
    notify('capture');
    return { ...rows[0], files: saved, shares: [] };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

// Fallback for browsers that deliver the share POST straight to the server
// (the service worker normally handles it and calls /api/capture instead).
app.post('/share-target', upload.array('files', 20), async (req, res) => {
  if (!isAuthed(req)) return res.redirect(303, '/?shared=login');
  try {
    await createCapture(req);
    res.redirect(303, '/?shared=1');
  } catch (e) {
    console.error('share-target failed:', e.message);
    res.redirect(303, '/?shared=err');
  }
});

/* ---------- authenticated API ---------- */

app.use('/api', (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (origin) {
    let host = null;
    try { host = new URL(origin).host; } catch { /* "null" origin */ }
    if (host !== req.headers.host) return res.status(403).json({ error: 'Blocked cross-site request' });
  }
  next();
});

app.use('/api', requireAuth);

app.get('/api/events', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write('retry: 2000\n\n');
  clients.add(res);
  const heartbeat = setInterval(() => { try { res.write(': ping\n\n'); } catch { /* closed */ } }, 20000);
  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(res);
  });
});

app.get('/api/items', async (req, res, next) => {
  try {
    const [items, files, shares, now] = await Promise.all([
      pool.query(`SELECT ${ITEM_COLS} FROM items i WHERE ${ALIVE} ORDER BY created_at DESC, id DESC`),
      pool.query(`SELECT f.id, f.item_id, f.name, f.mime, f.size FROM files f JOIN items i ON i.id = f.item_id WHERE ${ALIVE} ORDER BY f.id`),
      pool.query('SELECT token, item_id, file_id, expires_at FROM shares WHERE expires_at > NOW() ORDER BY created_at'),
      pool.query('SELECT NOW() AS now'),
    ]);
    const filesBy = new Map();
    for (const f of files.rows) {
      if (!filesBy.has(f.item_id)) filesBy.set(f.item_id, []);
      filesBy.get(f.item_id).push({ id: f.id, name: f.name, mime: f.mime, size: f.size });
    }
    const sharesBy = new Map();
    for (const s of shares.rows) {
      if (!sharesBy.has(s.item_id)) sharesBy.set(s.item_id, []);
      sharesBy.get(s.item_id).push({ token: s.token, file_id: s.file_id, expires_at: s.expires_at });
    }
    res.json({
      now: now.rows[0].now,
      items: items.rows.map((i) => ({ ...i, files: filesBy.get(i.id) || [], shares: sharesBy.get(i.id) || [] })),
    });
  } catch (e) { next(e); }
});

app.post('/api/items', async (req, res, next) => {
  try {
    const b = req.body || {};
    const ttl = parseTtl(b.ttl);
    if (ttl === false) return res.status(400).json({ error: 'Bad expiry' });
    const { rows } = await pool.query(
      `INSERT INTO items (text, is_task, ttl_seconds, expires_at)
       VALUES ($1, $2, $3::int, ${EXPIRES_SQL('$3')}) RETURNING ${ITEM_COLS}`,
      [String(b.text || ''), b.is_task === true, ttl]
    );
    notify('create');
    res.status(201).json({ ...rows[0], files: [], shares: [] });
  } catch (e) { next(e); }
});

app.post('/api/capture', upload.array('files', 20), async (req, res, next) => {
  try {
    res.status(201).json(await createCapture(req));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
});

app.patch('/api/items/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const b = req.body || {};
    const sets = [];
    const vals = [id];
    const add = (sql, v) => { vals.push(v); sets.push(sql.replace('?', `$${vals.length}`)); };
    if (typeof b.text === 'string') add('text = ?', b.text);
    if (typeof b.done === 'boolean') add('done = ?', b.done);
    if (typeof b.is_task === 'boolean') add('is_task = ?', b.is_task);
    if ('ttl' in b) {
      const ttl = parseTtl(b.ttl);
      if (ttl === false) return res.status(400).json({ error: 'Bad expiry' });
      vals.push(ttl);
      const p = `$${vals.length}`;
      sets.push(`ttl_seconds = ${p}::int`, `expires_at = ${EXPIRES_SQL(p)}`);
    }
    const sql = sets.length
      ? `UPDATE items i SET ${sets.join(', ')} WHERE id = $1 AND ${ALIVE} RETURNING ${ITEM_COLS}`
      : `SELECT ${ITEM_COLS} FROM items i WHERE id = $1 AND ${ALIVE}`;
    const { rows } = await pool.query(sql, vals);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (sets.length) notify('update');
    res.json(rows[0]);
  } catch (e) { next(e); }
});

app.delete('/api/items/:id', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM items WHERE id = $1', [Number(req.params.id)]);
    notify('delete');
    res.json({ ok: true });
  } catch (e) { next(e); }
});

app.post('/api/items/:id/files', upload.array('files', 20), async (req, res, next) => {
  try {
    const itemId = Number(req.params.id);
    const exists = await pool.query(`SELECT 1 FROM items i WHERE id = $1 AND ${ALIVE}`, [itemId]);
    if (!exists.rowCount) return res.status(404).json({ error: 'That entry no longer exists' });
    const saved = await saveFiles(pool, itemId, req.files);
    notify('files');
    res.status(201).json(saved);
  } catch (e) { next(e); }
});

app.get('/api/files/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT f.name, f.mime, f.data FROM files f JOIN items i ON i.id = f.item_id WHERE f.id = $1 AND ${ALIVE}`,
      [Number(req.params.id)]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const f = rows[0];
    const inline = INLINE_OK.has(f.mime) && req.query.download !== '1';
    res.set({
      'Content-Type': INLINE_OK.has(f.mime) ? f.mime : 'application/octet-stream',
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(f.name)}`,
      'Cache-Control': 'private, max-age=3600',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    });
    res.send(f.data);
  } catch (e) { next(e); }
});

app.delete('/api/files/:id', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM files WHERE id = $1', [Number(req.params.id)]);
    notify('files');
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ---------- share links ---------- */

app.post('/api/items/:id/shares', async (req, res, next) => {
  try {
    const itemId = Number(req.params.id);
    const b = req.body || {};
    const ttl = parseTtl(b.ttl);
    if (ttl === false || ttl === null) return res.status(400).json({ error: 'Pick when the link should expire' });
    const exists = await pool.query(`SELECT 1 FROM items i WHERE id = $1 AND ${ALIVE}`, [itemId]);
    if (!exists.rowCount) return res.status(404).json({ error: 'That entry no longer exists' });
    let fileId = null;
    if (b.file_id) {
      fileId = Number(b.file_id);
      const f = await pool.query('SELECT 1 FROM files WHERE id = $1 AND item_id = $2', [fileId, itemId]);
      if (!f.rowCount) return res.status(404).json({ error: 'File not found on this entry' });
    }
    const token = crypto.randomBytes(18).toString('base64url');
    const { rows } = await pool.query(
      `INSERT INTO shares (token, item_id, file_id, expires_at)
       VALUES ($1, $2, $3, NOW() + make_interval(secs => $4::float8))
       RETURNING token, file_id, expires_at`,
      [token, itemId, fileId, ttl]
    );
    notify('share');
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

app.delete('/api/shares/:token', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM shares WHERE token = $1', [req.params.token]);
    notify('share');
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ---------- static app ---------- */

app.use(
  express.static(path.join(__dirname, 'public'), {
    setHeaders(res, file) {
      res.set(
        'Content-Security-Policy',
        "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
      );
      res.set('Referrer-Policy', 'same-origin');
      if (/sw\.js$/.test(file)) res.set('Cache-Control', 'no-cache');
    },
  })
);

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? `File too large (max ${MAX_FILE_MB} MB)` : err.message;
    return res.status(413).json({ error: msg });
  }
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

/* ---------- expiry sweeper ---------- */

async function purge() {
  try {
    const a = await pool.query('DELETE FROM items WHERE expires_at IS NOT NULL AND expires_at <= NOW()');
    const b = await pool.query('DELETE FROM shares WHERE expires_at <= NOW()');
    if (a.rowCount || b.rowCount) notify('purge');
  } catch (e) {
    console.error('purge failed:', e.message);
  }
}

initDb()
  .then(() => {
    setInterval(purge, 10000);
    app.listen(PORT, () => console.log(`Clipboard running on :${PORT}`));
  })
  .catch((e) => {
    console.error('Database init failed:', e);
    process.exit(1);
  });
