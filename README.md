# Clipboard

A personal cloud clipboard and to-do list. Paste text, links, code or files on one device and they appear on your other devices straight away.

One Node service serves both the app and the API, so you only deploy one thing to Render.

## Features

- **Live sync.** Every open tab and device updates instantly (Server-Sent Events). No refresh.
- **Auto-delete.** Choose Keep, 5 min, 1 hour or 1 day when you save, or change it later from the clock button. A "fuse" bar on each entry burns down until it deletes itself.
- **Share links.** Share an entry, or a single file, as a public link that expires (5 min, 1 hour, 1 day or 7 days). No login needed to open it. You can revoke a link at any time.
- **Install as an app.** On Android, install it from Chrome, then use the system Share button in any app to send text, links, photos and files into Clipboard.
- **Smart entries.** Links show as link cards, code and shell commands get a monospace block with a Copy button, images get thumbnails and a preview, other files get download chips, and tasks get checkboxes.
- **Command bar.** Press Ctrl K (Cmd K on Mac) to search, copy an entry, switch views, change the default auto-delete or save what you typed. Ctrl Enter saves the text as a note.
- **Paste anywhere.** Ctrl V on the page saves text instantly. Pasted screenshots and dropped files upload as new entries, or attach to the entry you drop them on.
- **Pins.** Pin an entry to keep it on a shelf at the top. Pinning switches its auto-delete timer off, so a pinned entry is never removed by accident.
- **Trash.** Deleting an entry moves it to the Trash (with an Undo button). It can be restored for 30 days (`TRASH_DAYS`), then it is removed for good. Entries on an auto-delete timer skip the trash and are removed when the timer runs out.
- **Backup and restore.** The database icon in the top bar downloads everything (entries, files, pins, trash, share links, goals, plan, logbook) as one file, and restores it into any database, including a brand new one. Restoring twice does not duplicate anything, and a damaged or cut-off file is rejected without changing anything. A dot appears on the icon once the database is about 23 days old and has no recent backup.
- **Side panel.** On a wide screen a left panel holds a month calendar (dots show planned and written days), today's tasks with a quick add box, and your goals with progress. On a phone it opens from the menu button.
- **Plan.** Three views. *Day*: tick tasks, add new ones, see what is behind and move it. *Week* (Monday to Sunday): seven day cards, weekday and weekend progress bars, a focus line, "By Sunday I can...", a learning log of task notes, a weekly review, and the last eight weeks. *Goals*: a goal such as "Learn DevOps" has a length in days and topics, each lasting some number of study days. The plan lays them onto weekdays (or weekends too) and shows if they do not fit.
- **Moving work.** Any unfinished task can go to today, tomorrow, the weekend, next week or any day, one at a time, all of a day at once, or by dragging it onto another day. Re-lay a goal from today to slide the rest later. Tasks show how many times they were moved.
- **Logbook.** (called the diary in earlier versions) One entry per day for the whole year, saved as you type. Mood, tags, optional prompts (work, life, wins, struggles, tomorrow), a year grid coloured by mood, month list, search, "on this day" from earlier years, and a warning if another device changed the same day.
- **Themes.** The palette button in the top bar sets a *style* (Wood shelves, or Plain paper: flat, warm off-white, one accent) and a *mode* (Auto, Always light, Always dark). Auto is light from 06:00 to 19:00 and dark otherwise, following the clock on the device. Both choices are remembered per device.
- Phone layout, search across text and file names.

## Run locally

```bash
podman run -d --name clip-pg -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=clipboard -p 5433:5432 docker.io/library/postgres:16

npm install
export DATABASE_URL=postgres://postgres:dev@127.0.0.1:5433/clipboard
export APP_USER=me APP_PASSWORD=devpass SESSION_SECRET=$(openssl rand -hex 32)
node --watch server.js
```

Open http://localhost:3000. The database tables are created and upgraded automatically on start.

## Deploy on Render

1. Push this folder to GitHub.
2. In Render choose **New, then Blueprint**, and select the repo. It reads `render.yaml` and creates the web service and a Postgres database.
3. When asked, enter `APP_USER` and `APP_PASSWORD`. Use a long, unique password: the app is on the public internet.
4. Open the `.onrender.com` address and log in.

To update later, push to GitHub and Render redeploys. Existing data is kept.

## Install on your phone

Open your Render address in Chrome on Android, log in, then use the browser menu and choose **Install app** (or use the install button in the top bar). After that, Clipboard appears in the Android share sheet.

iPhone: Safari can add the page to the home screen, but iOS does not support share-to-web-app, so the share sheet feature is Android only.

Installing needs HTTPS, which Render provides.

## Settings

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `APP_USER`, `APP_PASSWORD` | Your login |
| `SESSION_SECRET` | Long random string that signs your login cookie |
| `MAX_FILE_MB` | Largest upload, default 10 |
| `TRASH_DAYS` | Days deleted entries stay in the trash, default 30 |

## When the free database expires

1. Open the app, click the database icon, then **Download backup**.
2. On Render, create a new Postgres database and put its connection string in `DATABASE_URL`. Redeploy so the tables are created.
3. Log in, click the database icon, choose the backup file and click **Restore**.

Files live in the backup too, so it can be large. Share links keep working as long as the app address stays the same.

## Notes

- Files live in the database, so large files use up database space quickly. Auto-delete helps.
- Free Render web services sleep when idle, so the first load can take about 30 seconds. Live sync reconnects by itself.
- Free Render Postgres has been time-limited (30 days, as far as I know). Check current terms, or point `DATABASE_URL` at a free Neon or Supabase Postgres.
- Share links are unguessable (144-bit random) and send `noindex`, but anyone who has the link can open it until it expires. Revoke it from the share dialog if you sent it by mistake.
- Fonts (Geist) are bundled in `public/fonts`, so nothing loads from third-party sites.


## v1.3: hours, habits, weekends, easier to learn

- **Plan by time.** Every task can have a time ("Gym 1h", "Read 30m", "half day"). Each day shows its load against a full day (8h by default, changeable). Goal parts take hours or days ("3h", "90m", "2 days").
- **Moving joins what is there.** A day can hold many things; goal parts fill a day up to its time per day and the next part joins the same day if it fits.
- **Habits tab.** Repeat things every day, weekdays, weekends or chosen days, with streaks and a 14-day strip. Created from the Add dialog ("More...") or the Habits tab.
- **Weekend tab.** Saturday and Sunday together, one tap to carry what is left to next weekend, drag onto other weekends. Goals can use "Weekends only".
- **Missed box.** Lists unfinished one-off and goal tasks; "Fit into free time" gives each the nearest day with room.
- **Easier to learn.** Visible Add / More buttons, hints on each tab, a "?" help dialog, starter examples, plainer words.
- Side panel no longer overflows with long titles.
- Upgrades existing data automatically (old topic days become full days; "weekends too" becomes every day). Backup format 3 still restores older backups.
- Feedback on tasks: leave a hidden note via the ... menu; it shows only as a small "feedback" chip until clicked (v1.3.1).
