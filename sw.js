/* ════════════════════════════════════════════
 * THE SMART GOLFER — Service Worker (PWA)
 * Stratégie : network-first (les utilisateurs en ligne ont TOUJOURS la
 * dernière version), avec repli sur le cache hors-ligne.
 * Ne touche JAMAIS aux requêtes cross-origin (Supabase, CDN).
 * ════════════════════════════════════════════ */
var CACHE = 'tsg-cache-v34';

self.addEventListener('install', function (e) {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  // Laisser passer tout ce qui est cross-origin (Supabase, Google Fonts, CDN…)
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.status === 200 && res.type === 'basic') {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (cached) {
        return cached || caches.match('./index.html') || caches.match('./');
      });
    })
  );
});
