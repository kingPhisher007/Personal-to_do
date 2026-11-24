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
    CREATE TABLE IF NOT EXISTS habits (
      id SERIAL PRIMARY KEY,
      uid ${UID},
      title TEXT NOT NULL,
      mins INTEGER,
      days_mask INTEGER NOT NULL DEFAULT 127,
      start_date DATE NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      active BOOLEAN NOT NULL DEFAULT TRUE,
      generated_to DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
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
    -- v1.3: time in minutes, chosen days of the week, habits
    ALTER TABLE goals ADD COLUMN IF NOT EXISTS day_mins INTEGER NOT NULL DEFAULT 480;
    ALTER TABLE goals ADD COLUMN IF NOT EXISTS days_mask INTEGER NOT NULL DEFAULT 31;
    ALTER TABLE topics ADD COLUMN IF NOT EXISTS mins INTEGER NOT NULL DEFAULT 480;
    ALTER TABLE plan_tasks ADD COLUMN IF NOT EXISTS mins INTEGER;
    ALTER TABLE plan_tasks ADD COLUMN IF NOT EXISTS habit_id INTEGER REFERENCES habits(id) ON DELETE SET NULL;
    ALTER TABLE plan_tasks ADD COLUMN IF NOT EXISTS occ_day DATE;
    CREATE UNIQUE INDEX IF NOT EXISTS plan_tasks_habit_occ ON plan_tasks(habit_id, occ_day) WHERE habit_id IS NOT NULL;
  `);
  // one-time upgrade of data made before v1.3: a topic day was a full day, "weekends too" meant all seven days
  const done = await pool.query("SELECT 1 FROM app_meta WHERE key = 'ws_v13'");
  if (!done.rowCount) {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query('UPDATE goals SET days_mask = CASE WHEN weekends THEN 127 ELSE 31 END');
      await c.query('UPDATE topics SET mins = days * 480');
      await c.query('UPDATE plan_tasks SET mins = 480 WHERE topic_id IS NOT NULL AND mins IS NULL');
      await c.query("INSERT INTO app_meta (key, value) VALUES ('ws_v13', '1') ON CONFLICT (key) DO NOTHING");
      await c.query('COMMIT');
    } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
  }
}

/* ---------- planner logic ---------- */
const DEFAULT_DAY_MINS = 480; // a "whole day"
const UNKNOWN_MINS = 30;      // what a task with no time counts as when filling days
const ALL_DAYS = 127;
const dowMon = (s) => (new Date(parseDay(s)).getUTCDay() + 6) % 7; // Monday = 0 ... Sunday = 6
const maskHas = (mask, s) => ((mask >> dowMon(s)) & 1) === 1;
const cleanMask = (v) => { const n = Number(v); return Number.isInteger(n) && n >= 1 && n <= 127 ? n : null; };
const minsOf = (m) => (m == null ? UNKNOWN_MINS : m);
const mapEntry = (m, k) => m.get(k) || [];

async function getDayMins(client) {
  const r = await client.query("SELECT value FROM app_meta WHERE key = 'plan_day_mins'");
  const n = r.rows[0] ? Number(r.rows[0].value) : 0;
  return Number.isInteger(n) && n >= 30 && n <= 1440 ? n : DEFAULT_DAY_MINS;
}

// Lay a goal's unfinished work onto its chosen days, by minutes, starting at `from`.
// A day holds as many parts as fit in the goal's time per day, so the next part joins the same day when there is room.
// Finished tasks and ones you placed by hand stay where they are and count against the day.
async function reflow(client, goalId, fromDay, countMoves) {
  const g = (await client.query('SELECT id, start_date, day_mins, days_mask FROM goals WHERE id = $1', [goalId])).rows[0];
  if (!g) return;
  let from = isDay(fromDay) ? fromDay : g.start_date;
  if (from < g.start_date) from = g.start_date;
  const mask = g.days_mask & ALL_DAYS || 31;
  const cap = Math.max(30, g.day_mins);
  const topics = (await client.query('SELECT id, title, mins FROM topics WHERE goal_id = $1 ORDER BY position, id', [goalId])).rows;
  const all = (await client.query(
    'SELECT id, topic_id, day, done, manual, mins FROM plan_tasks WHERE goal_id = $1 ORDER BY topic_id, seq, id', [goalId])).rows;
  const used = new Map();
  const use = (day, m) => used.set(day, (used.get(day) || 0) + m);
  const byTopic = new Map();
  for (const t of all) {
    if (t.topic_id && !t.done && !t.manual) { (byTopic.has(t.topic_id) ? byTopic.get(t.topic_id) : byTopic.set(t.topic_id, []).get(t.topic_id)).push(t); continue; }
    use(t.day, minsOf(t.mins));
  }
  const fixedMins = new Map();
  for (const t of all) if (t.topic_id && (t.done || t.manual)) fixedMins.set(t.topic_id, (fixedMins.get(t.topic_id) || 0) + minsOf(t.mins));

  const updates = []; // [id, day, mins, seq]
  const inserts = []; // [topic, day, mins, seq]
  const deletes = [];
  let d = from;
  for (const tp of topics) {
    const flow = mapEntry(byTopic, tp.id);
    const fixedCount = all.filter((t) => t.topic_id === tp.id && (t.done || t.manual)).length;
    let rem = Math.max(0, tp.mins - (fixedMins.get(tp.id) || 0));
    const chunks = [];
    while (rem > 0) {
      // a part that fits in one day is kept whole, so it moves to the next day with room instead of being cut in two;
      // a part longer than a day starts on a day with a full day free and runs on from there
      const need = Math.min(rem, cap);
      let guard = 0;
      while ((!maskHas(mask, d) || cap - (used.get(d) || 0) < need) && guard++ < 800) d = addDays(d, 1);
      while (!maskHas(mask, d) || cap - (used.get(d) || 0) < 1) d = addDays(d, 1); // crowded for a long way: take whatever room there is
      const free = cap - (used.get(d) || 0);
      const take = Math.max(1, Math.min(rem, free));
      chunks.push({ day: d, mins: take });
      use(d, take);
      rem -= take;
      if (cap - (used.get(d) || 0) < 15) d = addDays(d, 1); // a day with room left lets the next part join it
    }
    chunks.forEach((ch, i) => {
      const seq = fixedCount + i + 1;
      if (flow[i]) updates.push([flow[i].id, ch.day, ch.mins, seq, flow[i].day]);
      else inserts.push([tp, ch.day, ch.mins, seq]);
    });
    for (let i = chunks.length; i < flow.length; i++) deletes.push(flow[i].id);
  }
  if (deletes.length) await client.query('DELETE FROM plan_tasks WHERE id = ANY($1::int[])', [deletes]);
  if (updates.length) {
    await client.query(
      `UPDATE plan_tasks t
          SET day = v.day, mins = v.mins, seq = v.seq,
              moved = t.moved + CASE WHEN $5::boolean AND v.day > t.day THEN 1 ELSE 0 END,
              orig_day = CASE WHEN $5::boolean AND v.day <> t.day THEN COALESCE(t.orig_day, t.day) ELSE t.orig_day END
         FROM (SELECT unnest($1::int[]) AS id, unnest($2::date[]) AS day, unnest($3::int[]) AS mins, unnest($4::int[]) AS seq) v
        WHERE t.id = v.id`,
      [updates.map((u) => u[0]), updates.map((u) => u[1]), updates.map((u) => u[2]), updates.map((u) => u[3]), !!countMoves]);
  }
  for (const [tp, day, mins, seq] of inserts) {
    await client.query('INSERT INTO plan_tasks (goal_id, topic_id, title, day, mins, seq) VALUES ($1,$2,$3,$4,$5,$6)', [goalId, tp.id, tp.title, day, mins, seq]);
  }
}

async function renumberTopics(client, goalId) {
  await client.query(
    `UPDATE topics t SET position = r.n
       FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY position, id) AS n FROM topics WHERE goal_id = $1) r
      WHERE t.id = r.id`, [goalId]);
}

// A part is given in minutes ("mins") or, for older callers, in whole days of the goal's time per day ("days").
function partMins(t, dayMins) {
  if (t && t.mins !== undefined && t.mins !== null) return intIn(t.mins, 5, 100000, 'A part\'s time');
  if (t && t.days !== undefined && t.days !== null) return intIn(t.days, 1, 120, 'A part\'s days') * dayMins;
  return dayMins;
}
const daysFor = (mins, dayMins) => Math.max(1, Math.ceil(mins / dayMins));

function parseTopics(list, dayMins) {
  if (!Array.isArray(list)) return [];
  if (list.length > 80) throw bad('That is too many parts for one goal (80 at most)');
  return list.map((t) => ({
    title: text(t && t.title, 200, { required: true, name: 'A part name' }),
    mins: partMins(t, dayMins),
  }));
}

// Habits: make the repeating tasks for the next stretch of days. Safe to run any time and from two devices at once.
async function ensureHabits(client, today) {
  const horizon = addDays(today, 45);
  const floor = addDays(today, -30);
  const hs = (await client.query('SELECT id, title, mins, days_mask, start_date, generated_to FROM habits WHERE active AND (generated_to IS NULL OR generated_to < $1)', [horizon])).rows;
  for (const h of hs) {
    let from = h.generated_to ? addDays(h.generated_to, 1) : h.start_date;
    if (from < floor) from = floor;
    if (from < h.start_date) from = h.start_date;
    const days = [];
    for (let d = from; d <= horizon && days.length < 400; d = addDays(d, 1)) if (maskHas(h.days_mask, d)) days.push(d);
    if (days.length) {
      await client.query(
        `INSERT INTO plan_tasks (title, day, mins, habit_id, occ_day)
         SELECT $1, d, $2, $3, d FROM unnest($4::date[]) AS d
         ON CONFLICT (habit_id, occ_day) WHERE habit_id IS NOT NULL DO NOTHING`, [h.title, h.mins, h.id, days]);
    }
    await client.query('UPDATE habits SET generated_to = $2 WHERE id = $1', [h.id, horizon]);
  }
}

// Start a habit's future days over (after its schedule, time or name changed). Past days and ticked days are never touched.
async function resetHabitFuture(client, id, today) {
  await client.query('DELETE FROM plan_tasks WHERE habit_id = $1 AND done = FALSE AND manual = FALSE AND day > $2', [id, today]);
  await client.query('UPDATE habits SET generated_to = $2 WHERE id = $1', [id, today]);
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
    const s = rawText(src[k], 20000, 'A logbook section');
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

  const TASK_COLS = `id, goal_id, topic_id, title, note, day, done, done_at, seq, manual, moved, orig_day, mins, habit_id`;
  const GOAL_COLS = `id, title, start_date AS start, days, weekends, notes, archived, created_at, day_mins, days_mask`;
  const HABIT_COLS = `id, title, mins, days_mask, start_date AS start, note, active`;
  const todayOf = (v) => (isDay(v) ? v : todayUtc());
  const minsIn = (v, name = 'The time') => (v == null || v === '' ? null : intIn(v, 5, 1440, name));

  /* ----- planner: read everything ----- */
  app.get('/api/plan', wrap(async (req, res) => {
    await tx((c) => ensureHabits(c, todayOf(req.query.today)));
    const [goals, topics, tasks, weeks, thr, habits, dm] = await Promise.all([
      pool.query(`SELECT ${GOAL_COLS} FROM goals ORDER BY archived, start_date DESC, id DESC`),
      pool.query('SELECT id, goal_id, title, days, position, mins FROM topics ORDER BY goal_id, position, id'),
      pool.query(`SELECT ${TASK_COLS} FROM plan_tasks ORDER BY day, id LIMIT 20000`),
      pool.query('SELECT week_start AS start, focus, outcome, review, rating FROM week_notes ORDER BY week_start DESC LIMIT 400'),
      getMeta('plan_threshold'),
      pool.query(`SELECT ${HABIT_COLS} FROM habits ORDER BY active DESC, id`),
      getDayMins(pool),
    ]);
    res.json({ goals: goals.rows, topics: topics.rows, tasks: tasks.rows, weeks: weeks.rows, habits: habits.rows, threshold: thr ? Number(thr) : 70, day_mins: dm });
  }));

  app.put('/api/plan/settings', wrap(async (req, res) => {
    const b = req.body || {};
    if (b.threshold !== undefined) await setMeta('plan_threshold', String(intIn(b.threshold, 10, 100, 'The streak target')));
    if (b.day_mins !== undefined) await setMeta('plan_day_mins', String(intIn(b.day_mins, 30, 1440, 'The length of a full day')));
    notify('plan');
    res.json({ ok: true });
  }));

  /* ----- goals ----- */
  app.post('/api/plan/goals', wrap(async (req, res) => {
    const b = req.body || {};
    const title = text(b.title, 200, { required: true, name: 'The goal name' });
    const start = needDay(b.start_date, 'The start date');
    const days = intIn(b.days, 1, 366, 'Goal length');
    const dayMins = b.day_mins === undefined ? DEFAULT_DAY_MINS : intIn(b.day_mins, 30, 1440, 'Time per day');
    const mask = b.days_mask !== undefined ? cleanMask(b.days_mask) : (b.weekends === true ? ALL_DAYS : 31);
    if (!mask) throw bad('Pick at least one day of the week');
    const topics = parseTopics(b.topics, dayMins);
    const id = await tx(async (c) => {
      const g = (await c.query(
        'INSERT INTO goals (title, start_date, days, weekends, notes, day_mins, days_mask) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
        [title, start, days, (mask & 96) !== 0, rawText(b.notes, 4000), dayMins, mask])).rows[0];
      let pos = 0;
      for (const t of topics) {
        await c.query('INSERT INTO topics (goal_id, title, days, position, mins) VALUES ($1,$2,$3,$4,$5)', [g.id, t.title, daysFor(t.mins, dayMins), ++pos, t.mins]);
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
    let replan = false;
    let mask = null;
    if (b.days_mask !== undefined) { mask = cleanMask(b.days_mask); if (!mask) throw bad('Pick at least one day of the week'); }
    else if (typeof b.weekends === 'boolean') mask = b.weekends ? ALL_DAYS : 31;
    if (mask) { add('days_mask', mask); add('weekends', (mask & 96) !== 0); replan = true; }
    if (b.day_mins !== undefined) { add('day_mins', intIn(b.day_mins, 30, 1440, 'Time per day')); replan = true; }
    if (!sets.length) return res.json({ ok: true });
    await tx(async (c) => {
      const r = await c.query(`UPDATE goals SET ${sets.join(', ')} WHERE id = $1`, vals);
      if (!r.rowCount) throw httpError(404, 'That goal no longer exists');
      if (replan) await reflow(c, id, todayOf(b.from), false);
    });
    notify('plan');
    res.json({ ok: true });
  }));

  app.delete('/api/plan/goals/:id', wrap(async (req, res) => {
    await pool.query('DELETE FROM goals WHERE id = $1', [idOf(req)]);
    notify('plan');
    res.json({ ok: true });
  }));

  // "Reschedule the rest": put every unfinished, unplaced part onto the next days with room, from `from`.
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

  /* ----- parts of a goal (topics) ----- */
  app.post('/api/plan/goals/:id/topics', wrap(async (req, res) => {
    const gid = idOf(req);
    const b = req.body || {};
    const title = text(b.title, 200, { required: true, name: 'The part name' });
    await tx(async (c) => {
      const g = (await c.query('SELECT id, day_mins FROM goals WHERE id = $1', [gid])).rows[0];
      if (!g) throw httpError(404, 'That goal no longer exists');
      const mins = partMins(b, g.day_mins);
      const n = (await c.query('SELECT COUNT(*)::int AS n FROM topics WHERE goal_id = $1', [gid])).rows[0].n;
      if (n >= 80) throw bad('That is too many parts for one goal (80 at most)');
      const pos = (await c.query('SELECT COALESCE(MAX(position), 0) + 1 AS p FROM topics WHERE goal_id = $1', [gid])).rows[0].p;
      await c.query('INSERT INTO topics (goal_id, title, days, position, mins) VALUES ($1,$2,$3,$4,$5)', [gid, title, daysFor(mins, g.day_mins), pos, mins]);
      await reflow(c, gid, todayOf(b.from), false);
    });
    notify('plan');
    res.status(201).json({ ok: true });
  }));

  app.patch('/api/plan/topics/:id', wrap(async (req, res) => {
    const id = idOf(req);
    const b = req.body || {};
    const from = todayOf(b.from);
    await tx(async (c) => {
      const tp = (await c.query('SELECT t.id, t.goal_id, t.title, g.day_mins FROM topics t JOIN goals g ON g.id = t.goal_id WHERE t.id = $1', [id])).rows[0];
      if (!tp) throw httpError(404, 'That part no longer exists');
      let relay = false;
      if (b.title !== undefined) {
        const title = text(b.title, 200, { required: true, name: 'The part name' });
        await c.query('UPDATE topics SET title = $2 WHERE id = $1', [id, title]);
        await c.query('UPDATE plan_tasks SET title = $2 WHERE topic_id = $1', [id, title]);
      }
      if (b.mins !== undefined || b.days !== undefined) {
        const mins = partMins(b, tp.day_mins);
        await c.query('UPDATE topics SET mins = $2, days = $3 WHERE id = $1', [id, mins, daysFor(mins, tp.day_mins)]);
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
    const from = todayOf(req.query.from);
    await tx(async (c) => {
      const tp = (await c.query('SELECT goal_id FROM topics WHERE id = $1', [id])).rows[0];
      if (!tp) return;
      await c.query('DELETE FROM topics WHERE id = $1', [id]); // its tasks go with it
      await renumberTopics(c, tp.goal_id);
      await reflow(c, tp.goal_id, from, false);
    });
    notify('plan');
    res.json({ ok: true });
  }));

  /* ----- tasks ----- */
  app.post('/api/plan/tasks', wrap(async (req, res) => {
    const b = req.body || {};
    const title = text(b.title, 500, { required: true, name: 'The task' });
    const day = needDay(b.day, 'The day');
    const mins = minsIn(b.mins);
    let goalId = null;
    if (b.goal_id != null) {
      goalId = intIn(b.goal_id, 1, 2147483647, 'Goal');
      const ok = await pool.query('SELECT 1 FROM goals WHERE id = $1', [goalId]);
      if (!ok.rowCount) goalId = null;
    }
    const r = await pool.query(`INSERT INTO plan_tasks (goal_id, title, note, day, mins) VALUES ($1,$2,$3,$4,$5) RETURNING ${TASK_COLS}`, [goalId, title, rawText(b.note, 20000), day, mins]);
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
    if (b.mins !== undefined) add('mins = ?', minsIn(b.mins));
    if (typeof b.done === 'boolean') sets.push(b.done ? 'done = TRUE, done_at = COALESCE(done_at, NOW())' : 'done = FALSE, done_at = NULL');
    if (b.day !== undefined) {
      add('day = ?', needDay(b.day, 'The day'));
      sets.push('manual = TRUE', 'orig_day = COALESCE(orig_day, day)', 'moved = moved + CASE WHEN day <> $' + vals.length + '::date THEN 1 ELSE 0 END');
    }
    if (!sets.length) return res.json({ ok: true });
    const row = await tx(async (c) => {
      const before = (await c.query('SELECT topic_id, goal_id, mins FROM plan_tasks WHERE id = $1 FOR UPDATE', [id])).rows[0];
      if (!before) throw httpError(404, 'That task no longer exists');
      const r = await c.query(`UPDATE plan_tasks SET ${sets.join(', ')} WHERE id = $1 RETURNING ${TASK_COLS}`, vals);
      // changing the time of a task that belongs to a part changes the part's total
      if (b.mins !== undefined && before.topic_id) {
        const delta = minsOf(r.rows[0].mins) - minsOf(before.mins);
        if (delta) {
          const g = (await c.query('SELECT g.day_mins FROM goals g WHERE g.id = $1', [before.goal_id])).rows[0];
          const tp = (await c.query('UPDATE topics SET mins = GREATEST(5, mins + $2) WHERE id = $1 RETURNING mins', [before.topic_id, delta])).rows[0];
          if (tp && g) await c.query('UPDATE topics SET days = $2 WHERE id = $1', [before.topic_id, daysFor(tp.mins, g.day_mins)]);
        }
      }
      return r.rows[0];
    });
    notify('plan');
    res.json(row);
  }));

  app.delete('/api/plan/tasks/:id', wrap(async (req, res) => {
    const id = idOf(req);
    await tx(async (c) => {
      const t = (await c.query('DELETE FROM plan_tasks WHERE id = $1 RETURNING topic_id, goal_id, mins', [id])).rows[0];
      // a removed part-task takes its time off the part, so "Reschedule" does not bring it back
      if (t && t.topic_id) {
        const tp = (await c.query('UPDATE topics SET mins = mins - $2 WHERE id = $1 RETURNING mins, goal_id', [t.topic_id, minsOf(t.mins)])).rows[0];
        if (tp && tp.mins < 5) await c.query('DELETE FROM topics WHERE id = $1', [t.topic_id]);
      }
    });
    notify('plan');
    res.json({ ok: true });
  }));

  // Move unfinished tasks: all to one day (`to`), or each by a number of days (`shift`). They join whatever is already there.
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

  // "Fit into free time": give each missed task the earliest day that still has room for it.
  app.post('/api/plan/fit', wrap(async (req, res) => {
    const b = req.body || {};
    const ids = Array.isArray(b.ids) ? [...new Set(b.ids.map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 500) : [];
    const from = needDay(b.from, 'The date');
    if (!ids.length) return res.json({ moved: 0, placed: [] });
    const out = await tx(async (c) => {
      const cap = await getDayMins(c);
      const tasks = (await c.query(
        `SELECT t.id, t.day, t.mins, g.days_mask, g.archived FROM plan_tasks t LEFT JOIN goals g ON g.id = t.goal_id
          WHERE t.id = ANY($1::int[]) AND t.done = FALSE AND t.habit_id IS NULL ORDER BY t.day, t.id`, [ids])).rows;
      if (!tasks.length) return { moved: 0, placed: [] };
      const horizon = addDays(from, 150);
      const load = new Map();
      (await c.query('SELECT day, mins FROM plan_tasks WHERE day >= $1 AND day <= $2 AND done = FALSE AND NOT (id = ANY($3::int[]))', [from, horizon, ids]))
        .rows.forEach((r) => load.set(r.day, (load.get(r.day) || 0) + minsOf(r.mins)));
      const newIds = [], newDays = [];
      for (const t of tasks) {
        const need = minsOf(t.mins);
        const mask = t.days_mask || ALL_DAYS;
        let d = from, pick = null, firstOk = null;
        for (let i = 0; i < 150; i++, d = addDays(d, 1)) {
          if (!maskHas(mask, d)) continue;
          if (firstOk === null) firstOk = d;
          const l = load.get(d) || 0;
          if (l + need <= cap || (l === 0)) { pick = d; break; }
        }
        pick = pick || firstOk || from;
        load.set(pick, (load.get(pick) || 0) + need);
        if (pick !== t.day) { newIds.push(t.id); newDays.push(pick); }
      }
      if (newIds.length) {
        await c.query(
          `UPDATE plan_tasks t SET day = v.day, manual = TRUE, moved = t.moved + 1, orig_day = COALESCE(t.orig_day, t.day)
             FROM (SELECT unnest($1::int[]) AS id, unnest($2::date[]) AS day) v WHERE t.id = v.id`, [newIds, newDays]);
      }
      return { moved: newIds.length, placed: newIds.map((id, i) => ({ id, day: newDays[i] })) };
    });
    if (out.moved) notify('plan');
    res.json(out);
  }));

  /* ----- habits ----- */
  app.post('/api/plan/habits', wrap(async (req, res) => {
    const b = req.body || {};
    const title = text(b.title, 200, { required: true, name: 'The habit' });
    const mask = cleanMask(b.days_mask === undefined ? ALL_DAYS : b.days_mask);
    if (!mask) throw bad('Pick at least one day of the week');
    const today = todayOf(b.today);
    const start = b.start_date === undefined ? today : needDay(b.start_date, 'The start date');
    const id = await tx(async (c) => {
      const h = (await c.query('INSERT INTO habits (title, mins, days_mask, start_date, note) VALUES ($1,$2,$3,$4,$5) RETURNING id',
        [title, minsIn(b.mins), mask, start, rawText(b.note, 2000)])).rows[0];
      await ensureHabits(c, today);
      return h.id;
    });
    notify('plan');
    res.status(201).json({ id });
  }));

  app.patch('/api/plan/habits/:id', wrap(async (req, res) => {
    const id = idOf(req);
    const b = req.body || {};
    const today = todayOf(b.today);
    const sets = [];
    const vals = [id];
    const add = (col, v) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };
    let reset = false;
    if (b.title !== undefined) { add('title', text(b.title, 200, { required: true, name: 'The habit' })); reset = true; }
    if (b.mins !== undefined) { add('mins', minsIn(b.mins)); reset = true; }
    if (b.note !== undefined) add('note', rawText(b.note, 2000));
    if (b.days_mask !== undefined) { const m = cleanMask(b.days_mask); if (!m) throw bad('Pick at least one day of the week'); add('days_mask', m); reset = true; }
    if (typeof b.active === 'boolean') { add('active', b.active); reset = true; }
    if (!sets.length) return res.json({ ok: true });
    await tx(async (c) => {
      const r = await c.query(`UPDATE habits SET ${sets.join(', ')} WHERE id = $1 RETURNING title, mins, active`, vals);
      if (!r.rowCount) throw httpError(404, 'That habit no longer exists');
      if (reset) {
        await resetHabitFuture(c, id, today);
        // today's untouched one follows the new name and time
        await c.query('UPDATE plan_tasks SET title = $2, mins = $3 WHERE habit_id = $1 AND done = FALSE AND day = $4', [id, r.rows[0].title, r.rows[0].mins, today]);
        if (r.rows[0].active) await ensureHabits(c, today);
      }
    });
    notify('plan');
    res.json({ ok: true });
  }));

  app.delete('/api/plan/habits/:id', wrap(async (req, res) => {
    const id = idOf(req);
    await tx(async (c) => {
      // days you did stay in your history; everything still waiting goes
      await c.query('DELETE FROM plan_tasks WHERE habit_id = $1 AND done = FALSE', [id]);
      await c.query('DELETE FROM habits WHERE id = $1', [id]);
    });
    notify('plan');
    res.json({ ok: true });
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
    const body = rawText(b.body, 100000, 'The logbook entry');
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
  const goals = await client.query('SELECT id, uid, title, start_date, days, weekends, notes, archived, created_at, day_mins, days_mask FROM goals ORDER BY id');
  const goalUid = new Map(goals.rows.map((g) => [g.id, g.uid]));
  for (const g of goals.rows) {
    yield { type: 'goal', uid: g.uid, title: g.title, start_date: g.start_date, days: g.days, weekends: g.weekends, notes: g.notes, archived: g.archived, created_at: g.created_at, day_mins: g.day_mins, days_mask: g.days_mask };
  }
  const topics = await client.query('SELECT id, uid, goal_id, title, days, position, created_at, mins FROM topics ORDER BY goal_id, position, id');
  const topicUid = new Map(topics.rows.map((t) => [t.id, t.uid]));
  for (const t of topics.rows) {
    yield { type: 'topic', uid: t.uid, goal_uid: goalUid.get(t.goal_id), title: t.title, days: t.days, position: t.position, created_at: t.created_at, mins: t.mins };
  }
  const habits = await client.query('SELECT id, uid, title, mins, days_mask, start_date, note, active, generated_to, created_at FROM habits ORDER BY id');
  const habitUid = new Map(habits.rows.map((h) => [h.id, h.uid]));
  for (const h of habits.rows) yield { type: 'habit', uid: h.uid, title: h.title, mins: h.mins, days_mask: h.days_mask, start_date: h.start_date, note: h.note, active: h.active, generated_to: h.generated_to, created_at: h.created_at };
  const tasks = await client.query('SELECT uid, goal_id, topic_id, habit_id, occ_day, title, note, day, done, done_at, seq, manual, moved, orig_day, mins, created_at FROM plan_tasks ORDER BY id');
  for (const t of tasks.rows) {
    yield {
      type: 'task', uid: t.uid, goal_uid: t.goal_id ? goalUid.get(t.goal_id) : null, topic_uid: t.topic_id ? topicUid.get(t.topic_id) : null,
      habit_uid: t.habit_id ? habitUid.get(t.habit_id) : null, occ_day: t.occ_day, mins: t.mins,
      title: t.title, note: t.note, day: t.day, done: t.done, done_at: t.done_at, seq: t.seq, manual: t.manual, moved: t.moved, orig_day: t.orig_day, created_at: t.created_at,
    };
  }
  const weeks = await client.query('SELECT week_start, focus, outcome, review, rating FROM week_notes ORDER BY week_start');
  for (const w of weeks.rows) yield { type: 'week', ...w };
  const diary = await client.query('SELECT day, uid, body, sections, mood, tags, created_at, updated_at FROM diary ORDER BY day');
  for (const d of diary.rows) yield { type: 'diary', ...d };
  const meta = await client.query("SELECT key, value FROM app_meta WHERE key IN ('plan_threshold', 'plan_day_mins')");
  for (const m of meta.rows) yield { type: 'setting', key: m.key, value: m.value };
}

async function exportCounts(client) {
  const q = async (sql) => (await client.query(sql)).rows[0].n;
  return {
    goals: await q('SELECT COUNT(*)::int AS n FROM goals'),
    topics: await q('SELECT COUNT(*)::int AS n FROM topics'),
    tasks: await q('SELECT COUNT(*)::int AS n FROM plan_tasks'),
    habits: await q('SELECT COUNT(*)::int AS n FROM habits'),
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
        `INSERT INTO goals (uid, title, start_date, days, weekends, notes, archived, created_at, day_mins, days_mask)
         VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8, NOW()),$9,$10)
         ON CONFLICT (uid) DO UPDATE SET uid = EXCLUDED.uid RETURNING id, (xmax = 0) AS fresh`,
        [o.uid, String(o.title || 'Goal').slice(0, 200), o.start_date, Math.min(366, Math.max(1, Number(o.days) || 1)), o.weekends === true, String(o.notes || '').slice(0, 4000), o.archived === true, asDate(o.created_at),
          Number.isInteger(o.day_mins) && o.day_mins >= 30 && o.day_mins <= 1440 ? o.day_mins : DEFAULT_DAY_MINS, // older backups: a day was a full day
          cleanMask(o.days_mask) || (o.weekends === true ? ALL_DAYS : 31)]);
      ctx.goalIds.set(o.uid, r.rows[0].id);
      if (r.rows[0].fresh) add('goals'); else skip('goals');
      return true;
    }
    case 'topic': {
      const gid = ctx.goalIds.get(o.goal_uid);
      if (!UID_OK(o.uid) || !gid) return true;
      const r = await client.query(
        `INSERT INTO topics (uid, goal_id, title, days, position, created_at, mins) VALUES ($1,$2,$3,$4,$5,COALESCE($6, NOW()),$7)
         ON CONFLICT (uid) DO UPDATE SET uid = EXCLUDED.uid RETURNING id, (xmax = 0) AS fresh`,
        [o.uid, gid, String(o.title || 'Topic').slice(0, 200), Math.min(120, Math.max(1, Number(o.days) || 1)), Number(o.position) || 0, asDate(o.created_at),
          Number.isInteger(o.mins) && o.mins >= 5 ? Math.min(100000, o.mins) : Math.min(120, Math.max(1, Number(o.days) || 1)) * DEFAULT_DAY_MINS]);
      ctx.topicIds.set(o.uid, r.rows[0].id);
      if (r.rows[0].fresh) add('topics');
      return true;
    }
    case 'habit': {
      if (!UID_OK(o.uid) || !isDay(o.start_date)) return true;
      const r = await client.query(
        `INSERT INTO habits (uid, title, mins, days_mask, start_date, note, active, generated_to, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9, NOW()))
         ON CONFLICT (uid) DO UPDATE SET uid = EXCLUDED.uid RETURNING id, (xmax = 0) AS fresh`,
        [o.uid, String(o.title || 'Habit').slice(0, 200), Number.isInteger(o.mins) && o.mins >= 5 && o.mins <= 1440 ? o.mins : null, cleanMask(o.days_mask) || ALL_DAYS,
          o.start_date, String(o.note || '').slice(0, 2000), o.active !== false, dayOrNull(o.generated_to), asDate(o.created_at)]);
      ctx.habitIds = ctx.habitIds || new Map();
      ctx.habitIds.set(o.uid, r.rows[0].id);
      if (r.rows[0].fresh) add('habits'); else skip('habits');
      return true;
    }
    case 'task': {
      if (!UID_OK(o.uid) || !isDay(o.day)) return true;
      const hid = o.habit_uid && ctx.habitIds ? ctx.habitIds.get(o.habit_uid) || null : null;
      const gid = o.goal_uid ? ctx.goalIds.get(o.goal_uid) : null;
      const tid = o.topic_uid ? ctx.topicIds.get(o.topic_uid) : null;
      if ((o.goal_uid && !gid) || (o.topic_uid && !tid)) return true;
      const r = await client.query(
        `INSERT INTO plan_tasks (uid, goal_id, topic_id, title, note, day, done, done_at, seq, manual, moved, orig_day, created_at, mins, habit_id, occ_day)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,COALESCE($13, NOW()),$14,$15,$16) ON CONFLICT DO NOTHING`,
        [o.uid, gid || null, tid || null, String(o.title || 'Task').slice(0, 500), String(o.note || '').slice(0, 20000), o.day, o.done === true, o.done === true ? asDate(o.done_at) : null,
          Number(o.seq) || 0, o.manual === true, Math.max(0, Number(o.moved) || 0), dayOrNull(o.orig_day), asDate(o.created_at),
          Number.isInteger(o.mins) && o.mins >= 5 && o.mins <= 1440 ? o.mins : (tid && o.mins === undefined ? DEFAULT_DAY_MINS : null), // older backups: a part's day was a full day
          hid, hid ? dayOrNull(o.occ_day) : null]);
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
      } else if (o.key === 'plan_day_mins') {
        await client.query("INSERT INTO app_meta (key, value) VALUES ('plan_day_mins', $1) ON CONFLICT (key) DO NOTHING", [String(Math.min(1440, Math.max(30, Number(o.value) || DEFAULT_DAY_MINS)))]);
      }
      return true;
    }
    default:
      return false;
  }
}

module.exports = { initSchema, mount, exportLines, exportCounts, importLine };
