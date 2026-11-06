// ════════════════════════════════════════════════════════════════════════
// CoreForm Admin — Service Worker
//
// RELEASE RULE: whenever you deploy dashboard changes, bump the ?v= in
// dashboard.html AND the VERSION below. Changing VERSION is what makes open
// apps show "Versiune nouă disponibilă · Reîncarcă".
//
// Caching strategy:
//   • /dashboard, /login pages ........ network-first, cached shell offline
//   • dashboard css/js/icons + the exact CDN libs it uses + fonts
//                                       ... stale-while-revalidate (by full URL)
//   • everything else ................. NOT intercepted — Supabase API/auth
//     traffic and the public site's pages/assets are never touched.
// ════════════════════════════════════════════════════════════════════════

const VERSION = 'v8';
const SHELL_CACHE = `cf-shell-${VERSION}`;
const ASSET_CACHE = `cf-assets-${VERSION}`;

// Pages are stored under fixed keys so a production 301 (/dashboard.html →
// /dashboard) never ends up cached as a redirected response.
const PAGES = {
  dashboard: { url: 'dashboard.html', key: '/__shell/dashboard' },
  login:     { url: 'login.html',     key: '/__shell/login' }
};

const PRECACHE_ASSETS = [
  'css/dashboard.css?v=7',
  'js/admin/dashboard.js?v=7',
  'js/config.js?v=2',
  'js/admin/theme.js?v=1',
  'manifest.json',
  'img/logo-green-320.png',
  'img/icons/icon-192.png',
  'img/icons/apple-touch-icon.png',
  'img/favicon-32.png',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4'
];

// Only the dashboard's own files — the public site's assets are left alone.
const SHELL_ASSET = /^\/(css\/dashboard\.css|js\/admin\/(dashboard|theme)\.js|js\/config\.js|manifest\.json|img\/icons\/[\w.-]+\.png|img\/logo-green-320\.png|img\/favicon-32\.png)$/;
const CDN_ASSET = (url) =>
  (url.hostname === 'cdn.jsdelivr.net' && url.pathname.startsWith('/npm/@supabase/supabase-js@2.45.4')) ||
  (url.hostname === 'cdnjs.cloudflare.com' && url.pathname.startsWith('/ajax/libs/html2pdf.js/')) ||
  url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

// ── Install: precache the app shell ────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL_CACHE);
    await Promise.all(Object.values(PAGES).map(async ({ url, key }) => {
      const res = await fetch(url, { cache: 'reload' });
      if (res.ok) await shell.put(key, await cleanResponse(res));
    }));
    const assets = await caches.open(ASSET_CACHE);
    // One failing asset (e.g. CDN hiccup) must not block the install.
    await Promise.all(PRECACHE_ASSETS.map(url =>
      assets.add(new Request(url, { cache: 'reload' })).catch(() => {})));
  })());
  // No skipWaiting here: the page decides when to switch (update notice).
});

// ── Activate: drop caches from older versions ──────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = [SHELL_CACHE, ASSET_CACHE];
    const names = await caches.keys();
    await Promise.all(names.filter(n => n.startsWith('cf-') && !keep.includes(n)).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

// ── Fetch ──────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    const page = pageFor(url);
    if (page) event.respondWith(networkFirstPage(request, page));
    return; // public site pages: browser default
  }

  const sameOrigin = url.origin === self.location.origin;
  if ((sameOrigin && SHELL_ASSET.test(url.pathname)) || CDN_ASSET(url)) {
    event.respondWith(staleWhileRevalidate(request));
  }
  // Everything else (incl. *.supabase.co and the public site) is not intercepted.
});

function pageFor(url) {
  const path = url.pathname.replace(/\/+$/, '');
  if (path === '/dashboard' || path === '/dashboard.html') return PAGES.dashboard;
  if (path === '/login' || path === '/login.html') return PAGES.login;
  return null;
}

async function networkFirstPage(request, page) {
  try {
    const res = await fetch(request);
    if (res.ok && res.type === 'basic' && !res.redirected) {
      const shell = await caches.open(SHELL_CACHE);
      shell.put(page.key, await cleanResponse(res.clone()));
    }
    return res;
  } catch (err) {
    const cached = await caches.match(page.key);
    if (cached) return cached;
    throw err;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request).then(res => {
    if (res.ok || res.type === 'opaque') cache.put(request, res.clone());
    return res;
  }).catch(() => cached);
  return cached || network;
}

// Re-wrap so the stored response carries no "redirected" flag.
async function cleanResponse(res) {
  const body = await res.blob();
  return new Response(body, { status: 200, statusText: 'OK', headers: { 'Content-Type': res.headers.get('Content-Type') || 'text/html; charset=utf-8' } });
}
