'use strict';
/* Planner (goals, topics, day tasks, week notes) and year diary.
 * Dates are plain "YYYY-MM-DD" strings the whole way: the phone decides what "today" is, the server never guesses a time zone.
 */
const { types } = require('pg');

types.setTypeParser(1082, (v) => v); // DATE columns come back as 'YYYY-MM-DD' strings, not shifted Date objects

/* ---------- date helpers (UTC arithmetic on calendar days) ---------- */
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
function parseDay(s) {
  const m = DAY_RE.exec(String(s || ''));
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  const t = Date.UTC(y, mo - 1, d);
  const dt = new Date(t);
  if (y < 1970 || y > 2200 || dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return t;
}
const isDay = (s) => parseDay(s) !== null;
const fmtDay = (t) => new Date(t).toISOString().slice(0, 10);
const addDays = (s, n) => fmtDay(parseDay(s) + n * 864e5);
const isWeekend = (s) => { const d = new Date(parseDay(s)).getUTCDay(); return d === 0 || d === 6; };
const todayUtc = () => new Date().toISOString().slice(0, 10);

function httpError(status, msg, extra) { const e = new Error(msg); e.status = status; e.extra = extra; return e; }
const bad = (msg) => httpError(400, msg);

const text = (v, max, { required = false, name = 'Text' } = {}) => {
  const s = typeof v === 'string' ? v.trim() : '';
  if (required && !s) throw bad(`${name} cannot be empty`);
  if (s.length > max) throw bad(`${name} is too long`);
  return s;
};
const rawText = (v, max, name = 'Text') => {
  const s = typeof v === 'string' ? v.replace(/\r\n/g, '\n') : '';
  if (s.length > max) throw bad(`${name} is too long`);
  return s;
};
const intIn = (v, lo, hi, name) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < lo || n > hi) throw bad(`${name} must be a whole number from ${lo} to ${hi}`);
  return n;
};
const needDay = (v, name = 'Date') => { if (!isDay(v)) throw bad(`${name} is not a valid date`); return v; };

/* ---------- schema ---------- */
const UID = "TEXT NOT NULL UNIQUE DEFAULT md5(random()::text || clock_timestamp()::text)";

async function initSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS goals (
      id SERIAL PRIMARY KEY,
      uid ${UID},
      title TEXT NOT NULL,
      start_date DATE NOT NULL,
      days INTEGER NOT NULL,
      weekends BOOLEAN NOT NULL DEFAULT FALSE,
      notes TEXT NOT NULL DEFAULT '',
      archived BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS topics (
      id SERIAL PRIMARY KEY,
      uid ${UID},
      goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      days INTEGER NOT NULL DEFAULT 1,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS topics_goal_idx ON topics(goal_id);
    CREATE TABLE IF NOT EXISTS plan_tasks (
      id SERIAL PRIMARY KEY,
      uid ${UID},
      goal_id INTEGER REFERENCES goals(id) ON DELETE CASCADE,
      topic_id INTEGER REFERENCES topics(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      day DATE NOT NULL,
      done BOOLEAN NOT NULL DEFAULT FALSE,
      done_at TIMESTAMPTZ,
      seq INTEGER NOT NULL DEFAULT 0,
      manual BOOLEAN NOT NULL DEFAULT FALSE,
      moved INTEGER NOT NULL DEFAULT 0,
      orig_day DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS plan_tasks_day_idx ON plan_tasks(day);
    CREATE INDEX IF NOT EXISTS plan_tasks_goal_idx ON plan_tasks(goal_id);
    CREATE INDEX IF NOT EXISTS plan_tasks_topic_idx ON plan_tasks(topic_id);
    CREATE TABLE IF NOT EXISTS week_notes (
      week_start DATE PRIMARY KEY,
      focus TEXT NOT NULL DEFAULT '',
      outcome TEXT NOT NULL DEFAULT '',
      review TEXT NOT NULL DEFAULT '',
      rating INTEGER,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS diary (
      day DATE PRIMARY KEY,
      uid ${UID},
      body TEXT NOT NULL DEFAULT '',
      sections JSONB NOT NULL DEFAULT '{}'::jsonb,
      mood INTEGER,
      tags JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

/* ---------- planner logic ---------- */

// Lay a goal's unfinished topic days onto study days, in topic order, starting at `from`.
// Days that already hold a finished or hand-placed topic day of this goal are skipped, so one goal never doubles up on a day.
async function reflow(client, goalId, fromDay, countMoves) {
  const g = (await client.query('SELECT id, start_date, weekends FROM goals WHERE id = $1', [goalId])).rows[0];
  if (!g) return;
  let from = isDay(fromDay) ? fromDay : g.start_date;
  if (from < g.start_date) from = g.start_date;
  const { rows } = await client.query(
    `SELECT t.id, t.day, t.done, t.manual
       FROM plan_tasks t JOIN topics tp ON tp.id = t.topic_id
      WHERE t.goal_id = $1
      ORDER BY tp.position, tp.id, t.seq, t.id`, [goalId]);
  const occupied = new Set(rows.filter((t) => t.done || t.manual).map((t) => t.day));
  const ids = [];
  const days = [];
  let d = from;
  for (const t of rows) {
    if (t.done || t.manual) continue;
    let guard = 0;
    while (((!g.weekends && isWeekend(d)) || occupied.has(d)) && guard++ < 4000) d = addDays(d, 1);
    ids.push(t.id);
    days.push(d);
    d = addDays(d, 1);
  }
  if (!ids.length) return;
  await client.query(
    `UPDATE plan_tasks t
        SET day = v.day,
            moved = t.moved + CASE WHEN $3::boolean AND v.day > t.day THEN 1 ELSE 0 END,
            orig_day = CASE WHEN $3::boolean AND v.day <> t.day THEN COALESCE(t.orig_day, t.day) ELSE t.orig_day END
       FROM (SELECT unnest($1::int[]) AS id, unnest($2::date[]) AS day) v
      WHERE t.id = v.id`,
    [ids, days, !!countMoves]);
}

async function addTopicTasks(client, goalId, topicId, title, from, to, startDay) {
  for (let seq = from; seq <= to; seq++) {
    await client.query(
      'INSERT INTO plan_tasks (goal_id, topic_id, title, day, seq) VALUES ($1,$2,$3,$4,$5)',
      [goalId, topicId, title, startDay, seq]);
  }
}

async function renumberTopics(client, goalId) {
  await client.query(
    `UPDATE topics t SET position = r.n
       FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY position, id) AS n FROM topics WHERE goal_id = $1) r
      WHERE t.id = r.id`, [goalId]);
}

function parseTopics(list) {
  if (!Array.isArray(list)) return [];
  if (list.length > 80) throw bad('That is too many topics for one goal (80 at most)');
  return list.map((t) => ({
    title: text(t && t.title, 200, { required: true, name: 'A topic name' }),
    days: intIn(t && t.days === undefined ? 1 : t.days, 1, 120, 'Topic days'),
  }));
}

/* ---------- diary helpers ---------- */
const SECTION_KEYS = ['work', 'life', 'wins', 'struggles', 'tomorrow'];
const ALL_TEXT = `NULLIF(btrim(concat_ws(' ', body, sections->>'work', sections->>'life', sections->>'wins', sections->>'struggles', sections->>'tomorrow')), '')`;
const SNIP = `left(regexp_replace(COALESCE(${ALL_TEXT}, ''), '\\s+', ' ', 'g'), 160)`;
const WORDS = `COALESCE(cardinality(regexp_split_to_array(${ALL_TEXT}, '\\s+')), 0)`;
const DIARY_LIST_COLS = `to_char(day, 'YYYY-MM-DD') AS day, mood, tags, ${SNIP} AS snip, ${WORDS} AS words`;
const likeEscape = (s) => s.replace(/[\\%_]/g, (c) => '\\' + c);

function cleanTags(v) {
  if (!Array.isArray(v)) return [];
  const seen = new Set();
  const out = [];
  for (const t of v) {
    const s = String(t == null ? '' : t).trim().replace(/^#/, '').toLowerCase().slice(0, 30);
    if (s && !seen.has(s)) { seen.add(s); out.push(s); }
    if (out.length >= 12) break;
  }
  return out;
}

function cleanSections(v) {
  const o = {};
  const src = v && typeof v === 'object' ? v : {};
  for (const k of SECTION_KEYS) {
    const s = rawText(src[k], 20000, 'A diary section');
    if (s.trim()) o[k] = s;
  }
  return o;
}

const diaryRow = (r) => ({
  day: r.day, body: r.body, sections: r.sections || {}, mood: r.mood, tags: r.tags || [],
  created_at: r.created_at, updated_at: r.updated_at,
});

/* ---------- routes ---------- */
function mount(app, { pool, notify, getMeta, setMeta }) {
  const wrap = (fn) => async (req, res, next) => {
    try { await fn(req, res); } catch (e) {
      if (e.status) return res.status(e.status).json({ error: e.message, ...(e.extra || {}) });
      next(e);
    }
  };
  const tx = async (fn) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const out = await fn(client);
      await client.query('COMMIT');
      return out;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally { client.release(); }
  };
  const idOf = (req) => { const n = Number(req.params.id); if (!Number.isInteger(n) || n < 1) throw httpError(404, 'Not found'); return n; };

  const TASK_COLS = `id, goal_id, topic_id, title, note, day, done, done_at, seq, manual, moved, orig_day`;
  const GOAL_COLS = `id, title, start_date AS start, days, weekends, notes, archived, created_at`;

  /* ----- planner: read everything ----- */
  app.get('/api/plan', wrap(async (req, res) => {
    const [goals, topics, tasks, weeks, thr] = await Promise.all([
      pool.query(`SELECT ${GOAL_COLS} FROM goals ORDER BY archived, start_date DESC, id DESC`),
      pool.query('SELECT id, goal_id, title, days, position FROM topics ORDER BY goal_id, position, id'),
      pool.query(`SELECT ${TASK_COLS} FROM plan_tasks ORDER BY day, id LIMIT 20000`),
      pool.query('SELECT week_start AS start, focus, outcome, review, rating FROM week_notes ORDER BY week_start DESC LIMIT 400'),
      getMeta('plan_threshold'),
    ]);
    res.json({ goals: goals.rows, topics: topics.rows, tasks: tasks.rows, weeks: weeks.rows, threshold: thr ? Number(thr) : 70 });
  }));

  app.put('/api/plan/settings', wrap(async (req, res) => {
    const n = intIn(req.body && req.body.threshold, 10, 100, 'The streak target');
    await setMeta('plan_threshold', String(n));
    notify('plan');
    res.json({ ok: true, threshold: n });
  }));

  /* ----- goals ----- */
  app.post('/api/plan/goals', wrap(async (req, res) => {
    const b = req.body || {};
    const title = text(b.title, 200, { required: true, name: 'The goal name' });
    const start = needDay(b.start_date, 'The start date');
    const days = intIn(b.days, 1, 366, 'Goal length');
    const topics = parseTopics(b.topics);
    const id = await tx(async (c) => {
      const g = (await c.query('INSERT INTO goals (title, start_date, days, weekends, notes) VALUES ($1,$2,$3,$4,$5) RETURNING id',
        [title, start, days, b.weekends === true, rawText(b.notes, 4000)])).rows[0];
      let pos = 0;
      for (const t of topics) {
        const tp = (await c.query('INSERT INTO topics (goal_id, title, days, position) VALUES ($1,$2,$3,$4) RETURNING id', [g.id, t.title, t.days, ++pos])).rows[0];
        await addTopicTasks(c, g.id, tp.id, t.title, 1, t.days, start);
      }
      await reflow(c, g.id, start, false);
      return g.id;
    });
    notify('plan');
    res.status(201).json({ id });
  }));

  app.patch('/api/plan/goals/:id', wrap(async (req, res) => {
    const id = idOf(req);
    const b = req.body || {};
    const sets = [];
    const vals = [id];
    const add = (col, v) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };
    if (b.title !== undefined) add('title', text(b.title, 200, { required: true, name: 'The goal name' }));
    if (b.days !== undefined) add('days', intIn(b.days, 1, 366, 'Goal length'));
    if (b.notes !== undefined) add('notes', rawText(b.notes, 4000));
    if (typeof b.archived === 'boolean') add('archived', b.archived);
    const weekendsChanged = typeof b.weekends === 'boolean';
    if (weekendsChanged) add('weekends', b.weekends);
    if (!sets.length) return res.json({ ok: true });
    await tx(async (c) => {
      const r = await c.query(`UPDATE goals SET ${sets.join(', ')} WHERE id = $1`, vals);
      if (!r.rowCount) throw httpError(404, 'That goal no longer exists');
      if (weekendsChanged) await reflow(c, id, isDay(b.from) ? b.from : todayUtc(), false);
    });
    notify('plan');
    res.json({ ok: true });
  }));

  app.delete('/api/plan/goals/:id', wrap(async (req, res) => {
    await pool.query('DELETE FROM goals WHERE id = $1', [idOf(req)]);
    notify('plan');
    res.json({ ok: true });
  }));

  // "Re-lay": push every unfinished, unmoved topic day onto the next free study days from `from`.
  app.post('/api/plan/goals/:id/relay', wrap(async (req, res) => {
    const id = idOf(req);
    const from = needDay(req.body && req.body.from, 'The date');
    const clear = req.body && req.body.keep_manual === false;
    await tx(async (c) => {
      if (clear) await c.query('UPDATE plan_tasks SET manual = FALSE WHERE goal_id = $1 AND topic_id IS NOT NULL AND done = FALSE', [id]);
      await reflow(c, id, from, true);
    });
    notify('plan');
    res.json({ ok: true });
  }));

  /* ----- topics ----- */
  app.post('/api/plan/goals/:id/topics', wrap(async (req, res) => {
    const gid = idOf(req);
    const b = req.body || {};
    const title = text(b.title, 200, { required: true, name: 'The topic name' });
    const days = intIn(b.days === undefined ? 1 : b.days, 1, 120, 'Topic days');
    const from = isDay(b.from) ? b.from : todayUtc();
    await tx(async (c) => {
      const g = (await c.query('SELECT id, start_date FROM goals WHERE id = $1', [gid])).rows[0];
      if (!g) throw httpError(404, 'That goal no longer exists');
      const n = (await c.query('SELECT COUNT(*)::int AS n FROM topics WHERE goal_id = $1', [gid])).rows[0].n;
      if (n >= 80) throw bad('That is too many topics for one goal (80 at most)');
      const pos = (await c.query('SELECT COALESCE(MAX(position), 0) + 1 AS p FROM topics WHERE goal_id = $1', [gid])).rows[0].p;
      const tp = (await c.query('INSERT INTO topics (goal_id, title, days, position) VALUES ($1,$2,$3,$4) RETURNING id', [gid, title, days, pos])).rows[0];
      await addTopicTasks(c, gid, tp.id, title, 1, days, g.start_date);
      await reflow(c, gid, from, false);
    });
    notify('plan');
    res.status(201).json({ ok: true });
  }));

  app.patch('/api/plan/topics/:id', wrap(async (req, res) => {
    const id = idOf(req);
    const b = req.body || {};
    const from = isDay(b.from) ? b.from : todayUtc();
    await tx(async (c) => {
      const tp = (await c.query('SELECT id, goal_id, title, days, position FROM topics WHERE id = $1', [id])).rows[0];
      if (!tp) throw httpError(404, 'That topic no longer exists');
      let relay = false;
      if (b.title !== undefined) {
        const title = text(b.title, 200, { required: true, name: 'The topic name' });
        await c.query('UPDATE topics SET title = $2 WHERE id = $1', [id, title]);
        await c.query('UPDATE plan_tasks SET title = $2 WHERE topic_id = $1', [id, title]);
        tp.title = title;
      }
      if (b.days !== undefined) {
        const days = intIn(b.days, 1, 120, 'Topic days');
        const have = (await c.query('SELECT COALESCE(MAX(seq), 0) AS m, COUNT(*)::int AS n FROM plan_tasks WHERE topic_id = $1', [id])).rows[0];
        if (days > have.n) {
          const g = (await c.query('SELECT start_date FROM goals WHERE id = $1', [tp.goal_id])).rows[0];
          await addTopicTasks(c, tp.goal_id, id, tp.title, have.m + 1, have.m + (days - have.n), g.start_date);
        } else if (days < have.n) {
          // only unfinished days can be taken away, highest first
          const drop = have.n - days;
          const r = await c.query(
            `DELETE FROM plan_tasks WHERE id IN (SELECT id FROM plan_tasks WHERE topic_id = $1 AND done = FALSE ORDER BY seq DESC, id DESC LIMIT $2)`, [id, drop]);
          if (r.rowCount < drop) throw bad('Some of those days are already done, so they cannot be removed');
        }
        await c.query('UPDATE topics SET days = $2 WHERE id = $1', [id, days]);
        relay = true;
      }
      if (b.move === 'up' || b.move === 'down') {
        await renumberTopics(c, tp.goal_id);
        const cur = (await c.query('SELECT position FROM topics WHERE id = $1', [id])).rows[0].position;
        const want = b.move === 'up' ? cur - 1 : cur + 1;
        const other = (await c.query('SELECT id FROM topics WHERE goal_id = $1 AND position = $2', [tp.goal_id, want])).rows[0];
        if (other) {
          await c.query('UPDATE topics SET position = $2 WHERE id = $1', [other.id, cur]);
          await c.query('UPDATE topics SET position = $2 WHERE id = $1', [id, want]);
          relay = true;
        }
      }
      if (relay) await reflow(c, tp.goal_id, from, false);
    });
    notify('plan');
    res.json({ ok: true });
  }));

  app.delete('/api/plan/topics/:id', wrap(async (req, res) => {
    const id = idOf(req);
    const from = isDay(req.query.from) ? req.query.from : todayUtc();
    await tx(async (c) => {
      const tp = (await c.query('SELECT goal_id FROM topics WHERE id = $1', [id])).rows[0];
      if (!tp) return;
      await c.query('DELETE FROM topics WHERE id = $1', [id]); // its days go with it
      await renumberTopics(c, tp.goal_id);
      await reflow(c, tp.goal_id, from, false);
    });
    notify('plan');
    res.json({ ok: true });
  }));

  /* ----- day tasks ----- */
  app.post('/api/plan/tasks', wrap(async (req, res) => {
    const b = req.body || {};
    const title = text(b.title, 500, { required: true, name: 'The task' });
    const day = needDay(b.day, 'The day');
    let goalId = null;
    if (b.goal_id != null) {
      goalId = intIn(b.goal_id, 1, 2147483647, 'Goal');
      const ok = await pool.query('SELECT 1 FROM goals WHERE id = $1', [goalId]);
      if (!ok.rowCount) goalId = null;
    }
    const r = await pool.query(`INSERT INTO plan_tasks (goal_id, title, note, day) VALUES ($1,$2,$3,$4) RETURNING ${TASK_COLS}`, [goalId, title, rawText(b.note, 20000), day]);
    notify('plan');
    res.status(201).json(r.rows[0]);
  }));

  app.patch('/api/plan/tasks/:id', wrap(async (req, res) => {
    const id = idOf(req);
    const b = req.body || {};
    const sets = [];
    const vals = [id];
    const add = (sql, v) => { vals.push(v); sets.push(sql.replace('?', `$${vals.length}`)); };
    if (b.title !== undefined) add('title = ?', text(b.title, 500, { required: true, name: 'The task' }));
    if (b.note !== undefined) add('note = ?', rawText(b.note, 20000));
    if (typeof b.done === 'boolean') sets.push(b.done ? 'done = TRUE, done_at = COALESCE(done_at, NOW())' : 'done = FALSE, done_at = NULL');
    if (b.day !== undefined) {
      add('day = ?', needDay(b.day, 'The day'));
      sets.push('manual = TRUE', 'orig_day = COALESCE(orig_day, day)', 'moved = moved + CASE WHEN day <> $' + vals.length + '::date THEN 1 ELSE 0 END');
    }
    if (!sets.length) return res.json({ ok: true });
    const r = await pool.query(`UPDATE plan_tasks SET ${sets.join(', ')} WHERE id = $1 RETURNING ${TASK_COLS}`, vals);
    if (!r.rowCount) throw httpError(404, 'That task no longer exists');
    notify('plan');
    res.json(r.rows[0]);
  }));

  app.delete('/api/plan/tasks/:id', wrap(async (req, res) => {
    await pool.query('DELETE FROM plan_tasks WHERE id = $1', [idOf(req)]);
    notify('plan');
    res.json({ ok: true });
  }));

  // Move unfinished tasks: all to one day (`to`), or each by a number of days (`shift`).
  app.post('/api/plan/move', wrap(async (req, res) => {
    const b = req.body || {};
    const ids = Array.isArray(b.ids) ? [...new Set(b.ids.map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 2000) : [];
    if (!ids.length) return res.json({ moved: 0 });
    const to = b.to !== undefined ? needDay(b.to, 'The day') : null;
    const shift = b.shift !== undefined ? intIn(b.shift, -366, 366, 'The shift') : null;
    if (to === null && shift === null) throw bad('Say where to move them');
    const moved = await tx(async (c) => {
      const { rows } = await c.query('SELECT id, day FROM plan_tasks WHERE id = ANY($1::int[]) AND done = FALSE', [ids]);
      const newIds = [];
      const newDays = [];
      for (const t of rows) {
        const nd = to !== null ? to : addDays(t.day, shift);
        if (nd !== t.day) { newIds.push(t.id); newDays.push(nd); }
      }
      if (newIds.length) {
        await c.query(
          `UPDATE plan_tasks t SET day = v.day, manual = TRUE, moved = t.moved + 1, orig_day = COALESCE(t.orig_day, t.day)
             FROM (SELECT unnest($1::int[]) AS id, unnest($2::date[]) AS day) v WHERE t.id = v.id`, [newIds, newDays]);
      }
      return newIds.length;
    });
    if (moved) notify('plan');
    res.json({ moved });
  }));

  /* ----- weekly notes ----- */
  app.put('/api/plan/week/:start', wrap(async (req, res) => {
    const start = needDay(req.params.start, 'The week');
    const b = req.body || {};
    const rating = b.rating == null || b.rating === '' ? null : intIn(b.rating, 1, 5, 'The rating');
    await pool.query(
      `INSERT INTO week_notes (week_start, focus, outcome, review, rating) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (week_start) DO UPDATE SET focus = EXCLUDED.focus, outcome = EXCLUDED.outcome, review = EXCLUDED.review, rating = EXCLUDED.rating, updated_at = NOW()`,
      [start, text(b.focus, 400), text(b.outcome, 600), rawText(b.review, 20000), rating]);
    notify('plan');
    res.json({ ok: true });
  }));

  /* ----- diary ----- */
  app.get('/api/diary/index', wrap(async (req, res) => {
    const from = needDay(req.query.from, 'The start date');
    const to = needDay(req.query.to, 'The end date');
    if (parseDay(to) - parseDay(from) > 800 * 864e5) throw bad('That range is too long');
    const { rows } = await pool.query(`SELECT ${DIARY_LIST_COLS} FROM diary WHERE day BETWEEN $1 AND $2 ORDER BY day`, [from, to]);
    res.json({ entries: rows });
  }));

  app.get('/api/diary/search', wrap(async (req, res) => {
    const q = String(req.query.q || '').trim().slice(0, 100);
    if (!q) return res.json({ entries: [] });
    const like = `%${likeEscape(q)}%`;
    const { rows } = await pool.query(
      `SELECT ${DIARY_LIST_COLS} FROM diary
        WHERE body ILIKE $1 OR sections::text ILIKE $1 OR tags::text ILIKE $1
        ORDER BY day DESC LIMIT 60`, [like]);
    res.json({ entries: rows });
  }));

  app.get('/api/diary/day/:day', wrap(async (req, res) => {
    const day = needDay(req.params.day, 'The day');
    const r = await pool.query(`SELECT to_char(day, 'YYYY-MM-DD') AS day, body, sections, mood, tags, created_at, updated_at FROM diary WHERE day = $1`, [day]);
    const earlier = await pool.query(
      `SELECT ${DIARY_LIST_COLS} FROM diary WHERE to_char(day, 'MM-DD') = $1 AND day < $2 ORDER BY day DESC LIMIT 6`,
      [day.slice(5), day]);
    res.json({ entry: r.rows.length ? diaryRow(r.rows[0]) : null, earlier: earlier.rows });
  }));

  app.put('/api/diary/day/:day', wrap(async (req, res) => {
    const day = needDay(req.params.day, 'The day');
    const b = req.body || {};
    const body = rawText(b.body, 100000, 'The diary entry');
    const sections = cleanSections(b.sections);
    const tags = cleanTags(b.tags);
    const mood = b.mood == null || b.mood === '' ? null : intIn(b.mood, 1, 5, 'The mood');
    const result = await tx(async (c) => {
      const cur = (await c.query(`SELECT to_char(day, 'YYYY-MM-DD') AS day, body, sections, mood, tags, created_at, updated_at FROM diary WHERE day = $1 FOR UPDATE`, [day])).rows[0];
      if (cur && b.base && new Date(cur.updated_at).getTime() > new Date(b.base).getTime()) {
        throw httpError(409, 'This day was changed somewhere else', { entry: diaryRow(cur) });
      }
      const empty = !body.trim() && !Object.keys(sections).length && mood == null && !tags.length;
      if (empty) {
        if (cur) await c.query('DELETE FROM diary WHERE day = $1', [day]);
        return { entry: null };
      }
      const r = await c.query(
        `INSERT INTO diary (day, body, sections, mood, tags) VALUES ($1,$2,$3::jsonb,$4,$5::jsonb)
         ON CONFLICT (day) DO UPDATE SET body = EXCLUDED.body, sections = EXCLUDED.sections, mood = EXCLUDED.mood, tags = EXCLUDED.tags, updated_at = NOW()
         RETURNING to_char(day, 'YYYY-MM-DD') AS day, body, sections, mood, tags, created_at, updated_at`,
        [day, body, JSON.stringify(sections), mood, JSON.stringify(tags)]);
      return { entry: diaryRow(r.rows[0]) };
    });
    notify('diary');
    res.json(result);
  }));

  app.delete('/api/diary/day/:day', wrap(async (req, res) => {
    await pool.query('DELETE FROM diary WHERE day = $1', [needDay(req.params.day, 'The day')]);
    notify('diary');
    res.json({ ok: true });
  }));
}

/* ---------- backup and restore ---------- */
async function* exportLines(client) {
  const goals = await client.query('SELECT id, uid, title, start_date, days, weekends, notes, archived, created_at FROM goals ORDER BY id');
  const goalUid = new Map(goals.rows.map((g) => [g.id, g.uid]));
  for (const g of goals.rows) {
    yield { type: 'goal', uid: g.uid, title: g.title, start_date: g.start_date, days: g.days, weekends: g.weekends, notes: g.notes, archived: g.archived, created_at: g.created_at };
  }
  const topics = await client.query('SELECT id, uid, goal_id, title, days, position, created_at FROM topics ORDER BY goal_id, position, id');
  const topicUid = new Map(topics.rows.map((t) => [t.id, t.uid]));
  for (const t of topics.rows) {
    yield { type: 'topic', uid: t.uid, goal_uid: goalUid.get(t.goal_id), title: t.title, days: t.days, position: t.position, created_at: t.created_at };
  }
  const tasks = await client.query('SELECT uid, goal_id, topic_id, title, note, day, done, done_at, seq, manual, moved, orig_day, created_at FROM plan_tasks ORDER BY id');
  for (const t of tasks.rows) {
    yield {
      type: 'task', uid: t.uid, goal_uid: t.goal_id ? goalUid.get(t.goal_id) : null, topic_uid: t.topic_id ? topicUid.get(t.topic_id) : null,
      title: t.title, note: t.note, day: t.day, done: t.done, done_at: t.done_at, seq: t.seq, manual: t.manual, moved: t.moved, orig_day: t.orig_day, created_at: t.created_at,
    };
  }
  const weeks = await client.query('SELECT week_start, focus, outcome, review, rating FROM week_notes ORDER BY week_start');
  for (const w of weeks.rows) yield { type: 'week', ...w };
  const diary = await client.query('SELECT day, uid, body, sections, mood, tags, created_at, updated_at FROM diary ORDER BY day');
  for (const d of diary.rows) yield { type: 'diary', ...d };
  const thr = await client.query("SELECT value FROM app_meta WHERE key = 'plan_threshold'");
  if (thr.rows.length) yield { type: 'setting', key: 'plan_threshold', value: thr.rows[0].value };
}

async function exportCounts(client) {
  const q = async (sql) => (await client.query(sql)).rows[0].n;
  return {
    goals: await q('SELECT COUNT(*)::int AS n FROM goals'),
    topics: await q('SELECT COUNT(*)::int AS n FROM topics'),
    tasks: await q('SELECT COUNT(*)::int AS n FROM plan_tasks'),
    weeks: await q('SELECT COUNT(*)::int AS n FROM week_notes'),
    diary: await q('SELECT COUNT(*)::int AS n FROM diary'),
  };
}

const UID_OK = (s) => typeof s === 'string' && /^[\w-]{8,64}$/.test(s);
const asDate = (v) => { if (v == null) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; };
const dayOrNull = (v) => (isDay(v) ? v : null);

// Returns true when the line was one of ours. `ctx` carries id maps and counters for the whole restore.
async function importLine(client, o, ctx) {
  const add = (k) => { ctx.added[k] = (ctx.added[k] || 0) + 1; };
  const skip = (k) => { ctx.skipped[k] = (ctx.skipped[k] || 0) + 1; };
  switch (o.type) {
    case 'goal': {
      if (!UID_OK(o.uid) || !isDay(o.start_date)) return true;
      const r = await client.query(
        `INSERT INTO goals (uid, title, start_date, days, weekends, notes, archived, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8, NOW()))
         ON CONFLICT (uid) DO UPDATE SET uid = EXCLUDED.uid RETURNING id, (xmax = 0) AS fresh`,
        [o.uid, String(o.title || 'Goal').slice(0, 200), o.start_date, Math.min(366, Math.max(1, Number(o.days) || 1)), o.weekends === true, String(o.notes || '').slice(0, 4000), o.archived === true, asDate(o.created_at)]);
      ctx.goalIds.set(o.uid, r.rows[0].id);
      if (r.rows[0].fresh) add('goals'); else skip('goals');
      return true;
    }
    case 'topic': {
      const gid = ctx.goalIds.get(o.goal_uid);
      if (!UID_OK(o.uid) || !gid) return true;
      const r = await client.query(
        `INSERT INTO topics (uid, goal_id, title, days, position, created_at) VALUES ($1,$2,$3,$4,$5,COALESCE($6, NOW()))
         ON CONFLICT (uid) DO UPDATE SET uid = EXCLUDED.uid RETURNING id, (xmax = 0) AS fresh`,
        [o.uid, gid, String(o.title || 'Topic').slice(0, 200), Math.min(120, Math.max(1, Number(o.days) || 1)), Number(o.position) || 0, asDate(o.created_at)]);
      ctx.topicIds.set(o.uid, r.rows[0].id);
      if (r.rows[0].fresh) add('topics');
      return true;
    }
    case 'task': {
      if (!UID_OK(o.uid) || !isDay(o.day)) return true;
      const gid = o.goal_uid ? ctx.goalIds.get(o.goal_uid) : null;
      const tid = o.topic_uid ? ctx.topicIds.get(o.topic_uid) : null;
      if ((o.goal_uid && !gid) || (o.topic_uid && !tid)) return true;
      const r = await client.query(
        `INSERT INTO plan_tasks (uid, goal_id, topic_id, title, note, day, done, done_at, seq, manual, moved, orig_day, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,COALESCE($13, NOW())) ON CONFLICT (uid) DO NOTHING`,
        [o.uid, gid || null, tid || null, String(o.title || 'Task').slice(0, 500), String(o.note || '').slice(0, 20000), o.day, o.done === true, o.done === true ? asDate(o.done_at) : null,
          Number(o.seq) || 0, o.manual === true, Math.max(0, Number(o.moved) || 0), dayOrNull(o.orig_day), asDate(o.created_at)]);
      if (r.rowCount) add('tasks'); else skip('tasks');
      return true;
    }
    case 'week': {
      if (!isDay(o.week_start)) return true;
      const rating = Number.isInteger(o.rating) && o.rating >= 1 && o.rating <= 5 ? o.rating : null;
      const r = await client.query(
        `INSERT INTO week_notes (week_start, focus, outcome, review, rating) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (week_start) DO NOTHING`,
        [o.week_start, String(o.focus || '').slice(0, 400), String(o.outcome || '').slice(0, 600), String(o.review || '').slice(0, 20000), rating]);
      if (r.rowCount) add('weeks');
      return true;
    }
    case 'diary': {
      if (!isDay(o.day)) return true;
      const mood = Number.isInteger(o.mood) && o.mood >= 1 && o.mood <= 5 ? o.mood : null;
      const r = await client.query(
        `INSERT INTO diary (day, uid, body, sections, mood, tags, created_at, updated_at)
         VALUES ($1, COALESCE($2, md5(random()::text || clock_timestamp()::text)), $3, $4::jsonb, $5, $6::jsonb, COALESCE($7, NOW()), COALESCE($8, NOW()))
         ON CONFLICT DO NOTHING`,
        [o.day, UID_OK(o.uid) ? o.uid : null, String(o.body || '').slice(0, 100000), JSON.stringify(cleanSections(o.sections)), mood, JSON.stringify(cleanTags(o.tags)), asDate(o.created_at), asDate(o.updated_at)]);
      if (r.rowCount) add('diary'); else skip('diary');
      return true;
    }
    case 'setting': {
      if (o.key === 'plan_threshold') {
        await client.query("INSERT INTO app_meta (key, value) VALUES ('plan_threshold', $1) ON CONFLICT (key) DO NOTHING", [String(Math.min(100, Math.max(10, Number(o.value) || 70)))]);
      }
      return true;
    }
    default:
      return false;
  }
}

module.exports = { initSchema, mount, exportLines, exportCounts, importLine };
