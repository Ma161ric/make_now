/* DayFlow service worker: makes the app installable and opens it fast.
 * Pages: network first, last copy when offline. Built assets: cache first
 * (their file names change with every build). API and Firebase: never cached. */
const CACHE = 'dayflow-v3';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // never touch API calls or the Google sign-in pages (/__/auth/…)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/__/')) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
  }
});

// ---- reminders (push) ----
self.addEventListener('push', (event) => {
  let msg = { title: 'DayFlow', body: '', url: '/today', tag: undefined };
  try {
    msg = { ...msg, ...event.data.json() };
  } catch {
    /* empty push: show the default */
  }
  event.waitUntil(
    self.registration.showNotification(msg.title, {
      body: msg.body,
      tag: msg.tag,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: msg.url || '/today' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // only pages of DayFlow itself
  let url = new URL(event.notification.data?.url || '/today', self.location.origin);
  if (url.origin !== self.location.origin) url = new URL('/today', self.location.origin);
  url = url.href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.startsWith(self.location.origin) && 'focus' in c) {
          c.navigate?.(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
