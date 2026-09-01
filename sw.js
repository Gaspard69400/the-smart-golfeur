/* ════════════════════════════════════════════
 * THE SMART GOLFER — Service Worker (PWA)
 * Stratégie : network-first (les utilisateurs en ligne ont TOUJOURS la
 * dernière version), avec repli sur le cache hors-ligne.
 * Depuis S30 : PRÉCACHE complet à l'installation → l'app est utilisable
 * hors-ligne dès la première visite (utile : beaucoup de parcours n'ont pas de réseau).
 * Ne touche JAMAIS aux requêtes cross-origin (Supabase, Google Fonts).
 * ⚠️ Bumper V à chaque session qui touche css/js (idem ?v= dans index.html).
 * ════════════════════════════════════════════ */
var V = '40';
var CACHE = 'tsg-cache-v' + V;

/* Tout ce qu'il faut pour démarrer l'app sans réseau */
var PRECACHE = [
  './',
  './index.html',
  './manifest.json?v=' + V,
  './css/style.css?v=' + V,
  './vendor/chart.umd.min.js?v=' + V,
  './vendor/supabase.min.js?v=' + V,
  './js/config.js?v=' + V,
  './js/supabaseClient.js?v=' + V,
  './js/data.js?v=' + V,
  './js/traininglib.js?v=' + V,
  './js/app.js?v=' + V,
  './js/strokesgained.js?v=' + V,
  './js/dashboard.js?v=' + V,
  './js/scorecard.js?v=' + V,
  './js/proscore.js?v=' + V,
  './js/quickscore.js?v=' + V,
  './js/celebrate.js?v=' + V,
  './js/sharecard.js?v=' + V,
  './js/radar.js?v=' + V,
  './js/analyse.js?v=' + V,
  './js/sharedcourses.js?v=' + V,
  './js/courses.js?v=' + V,
  './js/training.js?v=' + V,
  './js/coach.js?v=' + V,
  './js/groups.js?v=' + V,
  './js/community.js?v=' + V,
  './js/calendar.js?v=' + V,
  './js/chat.js?v=' + V,
  './js/auth.js?v=' + V,
  './js/landing.js?v=' + V,
  './js/boot.js?v=' + V
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // addAll échoue en bloc si UNE ressource manque : on les ajoute une à une
      return Promise.all(PRECACHE.map(function (url) {
        return c.add(url).catch(function (err) {
          console.warn('[TSG SW] précache ignoré:', url, err && err.message);
        });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
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
  // Laisser passer tout ce qui est cross-origin (Supabase, Google Fonts…)
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
        if (cached) return cached;
        // Navigation hors-ligne vers une URL non cachée → on sert l'app
        if (req.mode === 'navigate') {
          return caches.match('./index.html').then(function (idx) {
            return idx || caches.match('./');
          });
        }
        return Response.error();
      });
    })
  );
});
