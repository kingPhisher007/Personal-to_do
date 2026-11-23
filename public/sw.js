/* Service worker: keeps the app shell available offline and handles the Android share sheet. */
const CACHE = 'clipboard-shell-v5';
const SHELL = [
  '/', '/tokens.css', '/styles.css', '/workspace.css', '/paper.css', '/theme.js', '/app.js', '/panel.js', '/plan.js', '/diary.js', '/manifest.webmanifest',
  '/icons/icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Share sheet: forward the shared text/files to the API with the login cookie, then open the app.
  if (req.method === 'POST' && url.pathname === '/share-target') {
    e.respondWith((async () => {
      const go = (q) => Response.redirect(new URL('/?shared=' + q, self.location.origin).href, 303);
      try {
        const fd = await req.formData();
        const r = await fetch('/api/capture', { method: 'POST', body: fd, credentials: 'same-origin' });
        if (r.status === 401) return go('login');
        return go(r.ok ? '1' : 'err');
      } catch (err) {
        return go('err');
      }
    })());
    return;
  }

  // Everything dynamic goes straight to the network.
  if (req.method !== 'GET' || url.pathname.startsWith('/api/') || url.pathname.startsWith('/s/') || url.pathname === '/healthz') return;

  // App shell: network first so updates show immediately, cache as the offline fallback.
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('/')))
  );
});
