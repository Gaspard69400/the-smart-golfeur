/* ════════════════════════════════════════════
 * THE SMART GOLFER — weather.js
 * MÉTÉO & VENT DU JOUR sur le parcours, enregistrés avec la partie.
 *
 * Source : Open-Meteo (gratuit, sans clé, sans compte). On envoie la VILLE
 * du parcours (jamais la position du téléphone) : géocodage une seule fois
 * par parcours (mis en cache), puis météo actuelle mise en cache 20 min.
 * Désambiguïsation : code postal, puis département (« Saint-Cyr » existe
 * dans dix départements).
 *
 * Utilisations : pastille météo pendant la saisie express, réglage
 * automatique du champ « Conditions » (s'il n'a pas été touché), météo
 * enregistrée sur la partie (`round.weather`), carte « Toi et le vent »
 * dans Analyse.
 *
 * Dépend de : app.js (lsGet/lsSet). Hors-ligne : rien ne s'affiche.
 * ════════════════════════════════════════════ */

var WX_TTL_MS = 20 * 60 * 1000;
var _wxPending = {};

function wxCourseGeo(course) {
  var cache = lsGet('courseGeo') || {};
  return cache[course.id] || null;
}

function wxGeocode(course) {
  var ville = String(course.ville || '').trim();
  if (ville.length < 2) return Promise.resolve(null);
  var cached = wxCourseGeo(course);
  if (cached && cached.q === ville) return Promise.resolve(cached.ok ? cached : null);
  var url = 'https://geocoding-api.open-meteo.com/v1/search?count=10&language=fr&countryCode=FR&name=' + encodeURIComponent(ville);
  return fetch(url).then(function(r) { return r.json(); }).then(function(d) {
    var list = (d && d.results) || [];
    var norm = function(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, ''); };
    var pick = (course.cp && list.find(function(x) { return (x.postcodes || []).some(function(p) { return String(p).indexOf(String(course.cp)) === 0; }); }))
      || (course.departement && list.find(function(x) { return norm(x.admin2) === norm(course.departement); }))
      || list.find(function(x) { return norm(x.name) === norm(ville); })
      || list[0];
    var cache = lsGet('courseGeo') || {};
    cache[course.id] = pick ? { ok: true, q: ville, lat: pick.latitude, lon: pick.longitude, place: pick.name, approx: !course.cp && !course.departement && list.length > 1 }
                            : { ok: false, q: ville };
    lsSet('courseGeo', cache);
    return cache[course.id].ok ? cache[course.id] : null;
  });
}

/* Météo actuelle sur un parcours : { temp, wind, gust, dir, rain, code, at } ou null */
function wxFetch(course) {
  if (!course || !course.id) return Promise.resolve(null);
  var all = lsGet('weatherNow') || {}, c = all[course.id];
  if (c && Date.now() - c.fetched < WX_TTL_MS) return Promise.resolve(c);
  if (navigator.onLine === false) return Promise.resolve(c || null);
  if (_wxPending[course.id]) return _wxPending[course.id];
  var p = wxGeocode(course).then(function(geo) {
    if (!geo) return null;
    var url = 'https://api.open-meteo.com/v1/forecast?current=temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,weather_code'
      + '&wind_speed_unit=kmh&timezone=auto&latitude=' + geo.lat + '&longitude=' + geo.lon;
    return fetch(url).then(function(r) { return r.json(); }).then(function(d) {
      var cur = d && d.current;
      if (!cur) return null;
      var w = { temp: Math.round(cur.temperature_2m), wind: Math.round(cur.wind_speed_10m), gust: Math.round(cur.wind_gusts_10m),
                dir: Math.round(cur.wind_direction_10m), rain: cur.precipitation, code: cur.weather_code, at: cur.time,
                place: geo.place, fetched: Date.now() };
      var store = lsGet('weatherNow') || {};
      store[course.id] = w;
      lsSet('weatherNow', store);
      return w;
    });
  }).catch(function() { return c || null; });
  _wxPending[course.id] = p;
  p.then(function() { delete _wxPending[course.id]; }, function() { delete _wxPending[course.id]; });
  return p;
}

/* Dernière météo connue (sans réseau) pour enregistrer avec la partie */
function wxCached(course) {
  if (!course) return null;
  var c = (lsGet('weatherNow') || {})[course.id];
  if (!c || Date.now() - c.fetched > 6 * 3600 * 1000) return null;       // plus de 6 h : ce n'est plus la météo de la partie
  return { temp: c.temp, wind: c.wind, gust: c.gust, dir: c.dir, rain: c.rain, code: c.code, at: c.at };
}

var WX_DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
function wxDirLabel(deg) { return WX_DIRS[Math.round(((deg % 360) + 360) % 360 / 45) % 8]; }

function wxIcon(code) {
  if (code === 0) return '☀️';
  if (code <= 2) return '🌤️';
  if (code === 3) return '☁️';
  if (code === 45 || code === 48) return '🌫️';
  if (code >= 95) return '⛈️';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return '🌨️';
  if (code >= 51) return '🌧️';
  return '🌤️';
}

/* Catégorie de vent : même découpage que le champ « Conditions » */
function wxWindClass(w) {
  if (!w) return null;
  if (w.rain >= 0.3 || (w.code >= 61 && w.code <= 67) || (w.code >= 80 && w.code <= 82)) return 'pluie';
  if (w.wind >= 28 || w.gust >= 45) return 'vent-fort';
  if (w.wind >= 14 || w.gust >= 28) return 'vent-mod';
  return 'calme';
}

function wxChipHtml(w) {
  if (!w) return '';
  // La flèche montre vers où souffle le vent (la direction météo indique d'où il vient)
  return '<span class="wx-chip" title="Météo Open-Meteo' + (w.place ? ' · ' + w.place : '') + '">'
    + wxIcon(w.code) + ' ' + w.temp + '° · <span class="wx-arrow" style="transform:rotate(' + ((w.dir + 180) % 360) + 'deg)">↑</span> '
    + w.wind + ' km/h ' + wxDirLabel(w.dir) + (w.gust >= w.wind + 10 ? ' <em>raf. ' + w.gust + '</em>' : '') + '</span>';
}

/* Remplit la pastille et règle « Conditions » quand un parcours est choisi */
function wxOnCourseSelected(course) {
  var host = document.getElementById('wx-host');
  if (host) host.innerHTML = '';
  wxFetch(course).then(function(w) {
    if (!w || typeof selectedCourse === 'undefined' || !selectedCourse || selectedCourse.id !== course.id) return;
    var h = document.getElementById('wx-host');
    if (h) h.innerHTML = wxChipHtml(w);
    var cond = document.getElementById('f-cond');
    if (cond && !cond._userSet) {
      var cls = wxWindClass(w);
      if (cls) cond.value = cls;
    }
    if (document.getElementById('qs-overlay') && typeof qsRender === 'function') { try { qsRender(); } catch (e) {} }
  });
}

/* ─── Analyse : « Toi et le vent » ─── */
function wxAnalyseCard(rounds) {
  var buckets = { calme: [], 'vent-mod': [], 'vent-fort': [], pluie: [] };
  rounds.forEach(function(r) {
    if (r.diff === null || r.diff === undefined || isNaN(r.diff)) return;
    var full = Array.isArray(r.scores) && r.scores.filter(function(x) { return x !== null && x !== undefined; }).length >= 18;
    if (!full && !r.quickEntry) return;
    var k = r.weather ? wxWindClass(r.weather) : r.cond;
    if (buckets[k]) buckets[k].push(r.diff);
  });
  var labels = { calme: '🌤️ Calme', 'vent-mod': '🌬️ Vent modéré', 'vent-fort': '💨 Vent fort', pluie: '🌧️ Pluie' };
  var ref = buckets.calme.length >= 2 ? buckets.calme.reduce(function(a, b) { return a + b; }, 0) / buckets.calme.length : null;
  var rows = Object.keys(buckets).filter(function(k) { return buckets[k].length >= 2; }).map(function(k) {
    var avg = buckets[k].reduce(function(a, b) { return a + b; }, 0) / buckets[k].length;
    var delta = (ref !== null && k !== 'calme') ? avg - ref : null;
    return '<div class="wx-row"><span>' + labels[k] + '</span><span class="wx-n">' + buckets[k].length + ' cartes</span>'
      + '<strong>' + avg.toFixed(1).replace('.', ',') + '</strong>'
      + '<em class="' + (delta === null ? '' : (delta > 1 ? 'bad' : 'ok')) + '">' + (delta === null ? '' : (delta >= 0 ? '+' : '−') + Math.abs(delta).toFixed(1).replace('.', ',')) + '</em></div>';
  });
  if (rows.length < 2) return null;
  var card = document.createElement('div');
  card.className = 'an-card';
  var worst = null;
  Object.keys(buckets).forEach(function(k) {
    if (k === 'calme' || buckets[k].length < 2 || ref === null) return;
    var d = buckets[k].reduce(function(a, b) { return a + b; }, 0) / buckets[k].length - ref;
    if (!worst || d > worst.d) worst = { k: k, d: d };
  });
  card.innerHTML = '<div class="an-card-header"><div class="an-card-title">Toi et le vent</div>'
    + '<div class="an-card-sub">Différentiel moyen selon les conditions</div></div>'
    + '<div class="an-card-body">' + rows.join('')
    + (worst && worst.d > 1.5 ? '<div class="wx-tip">Par ' + labels[worst.k].replace(/^\S+ /, '').toLowerCase() + ', tu perds <strong>environ ' + worst.d.toFixed(1).replace('.', ',') + ' coups</strong> par rapport à un jour calme. Travaille les coups bas et prends un club de plus face au vent.</div>' : '')
    + '</div>';
  return card;
}
