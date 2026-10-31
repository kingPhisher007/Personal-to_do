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
- Light and dark themes, phone layout, search across text and file names.

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

Open your Render address in Chrome on Android, log in, then use the browser menu and choose **Install app** (or use the install button in the sidebar). After that, Clipboard appears in the Android share sheet.

iPhone: Safari can add the page to the home screen, but iOS does not support share-to-web-app, so the share sheet feature is Android only.

Installing needs HTTPS, which Render provides.

## Settings

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `APP_USER`, `APP_PASSWORD` | Your login |
| `SESSION_SECRET` | Long random string that signs your login cookie |
| `MAX_FILE_MB` | Largest upload, default 10 |

## Notes

- Files live in the database, so large files use up database space quickly. Auto-delete helps.
- Free Render web services sleep when idle, so the first load can take about 30 seconds. Live sync reconnects by itself.
- Free Render Postgres has been time-limited (30 days, as far as I know). Check current terms, or point `DATABASE_URL` at a free Neon or Supabase Postgres.
- Share links are unguessable (144-bit random) and send `noindex`, but anyone who has the link can open it until it expires. Revoke it from the share dialog if you sent it by mistake.
- Fonts (Geist) are bundled in `public/fonts`, so nothing loads from third-party sites.
