/* ════════════════════════════════════════════
 * THE SMART GOLFER — program.js
 * PROGRAMME D'ENTRAÎNEMENT SUR 4 SEMAINES.
 *
 * Passer de l'exercice isolé au vrai plan qui se déroule. Le programme est
 * généré depuis tes Strokes Gained : ton secteur le plus faible est le fil
 * rouge, le deuxième vient en appui. 3 séances par semaine, de difficulté
 * croissante, calée sur ton niveau. La semaine 4 refait les exercices
 * mesurés de la semaine 1 : le bilan compare tes résultats.
 *
 * Dépend de : traininglib.js (getLibrary, trnWeakSectors, trnPlayerLevel),
 *             training.js (openTrainingDetail, trnMarkDone), app.js (lsGet/lsSet).
 * ════════════════════════════════════════════ */

var PRG_WEEKS = [
  { n: 1, theme: 'Les bases',       desc: 'Poser les bons repères sur ton secteur prioritaire.', shift: -0.5 },
  { n: 2, theme: 'La précision',    desc: 'Mesurer, puis resserrer tes écarts.',                 shift: 0 },
  { n: 3, theme: 'Sous pression',   desc: 'Rendre le geste fiable quand ça compte.',             shift: 0.5 },
  { n: 4, theme: 'Le test',         desc: 'Refaire tes exercices mesurés et comparer à la semaine 1.', shift: 0.8 }
];
var PRG_LEVEL_RANK = { 'Débutant': 0, 'Intermédiaire': 1, 'Avancé': 2, 'Expert': 3 };
var PRG_SECTOR_LABEL = { 'Drive': 'le driving', 'Approche': 'les approches', 'Jeu court': 'le petit jeu', 'Putting': 'le putting' };

/* Lundi de la semaine en cours, AAAA-MM-JJ */
function prgMonday(d) {
  var x = d ? new Date(d) : new Date();
  var day = x.getDay() || 7;
  x.setDate(x.getDate() - day + 1);
  // Construit en date LOCALE (toISOString passerait en UTC et pourrait décaler d'un jour)
  var m = x.getMonth() + 1, dd = x.getDate();
  return x.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (dd < 10 ? '0' + dd : dd);
}

/* Minuit local d'une date AAAA-MM-JJ (ou de maintenant) */
function prgMidnight(ymd) {
  var x = ymd ? new Date(ymd + 'T00:00:00') : new Date();
  x.setHours(0, 0, 0, 0);
  return x;
}

/* Choisit `count` exercices d'un secteur, au bon niveau, en variant d'une semaine à l'autre */
function prgPick(sector, count, targetRank, offset) {
  var lib = getLibrary().filter(function(e) { return e.category === sector; });
  if (!lib.length) return [];
  lib.sort(function(a, b) {
    var da = Math.abs((PRG_LEVEL_RANK[a.level] || 1) - targetRank) + (a.measure ? 0 : 0.35);
    var db = Math.abs((PRG_LEVEL_RANK[b.level] || 1) - targetRank) + (b.measure ? 0 : 0.35);
    return (da - db) || (a.id < b.id ? -1 : 1);
  });
  var pool = lib.slice(0, Math.min(lib.length, 3));      // les plus adaptés
  var out = [];
  for (var i = 0; i < count && i < pool.length; i++) out.push(pool[(offset + i) % pool.length].id);
  return out;
}

/* ── Génération ── */
function prgGenerate() {
  var sectors = (typeof trnWeakSectors === 'function') ? trnWeakSectors() : null;
  var order = sectors ? sectors.map(function(s) { return s.key; }) : ['Putting', 'Approche', 'Jeu court', 'Drive'];
  var primary = order[0], secondary = order[1];
  var baseRank = PRG_LEVEL_RANK[(typeof trnPlayerLevel === 'function') ? trnPlayerLevel() : 'Intermédiaire'];
  if (baseRank === undefined) baseRank = 1;

  var weeks = PRG_WEEKS.map(function(w) {
    var rank = Math.max(0, Math.min(3, baseRank + w.shift));
    var o = w.n - 1;
    var sessions = [
      { key: 'w' + w.n + 's1', title: 'Séance 1', focus: primary,
        exercises: prgPick(primary, 2, rank, o) },
      { key: 'w' + w.n + 's2', title: 'Séance 2', focus: primary + ' + ' + secondary,
        exercises: prgPick(primary, 1, rank, o + 2).concat(prgPick(secondary, 1, rank, o)) },
      { key: 'w' + w.n + 's3', title: 'Séance 3', focus: secondary,
        exercises: prgPick(secondary, 2, rank, o + 1) }
    ];
    return { n: w.n, theme: w.theme, desc: w.desc, sessions: sessions };
  });

  // Semaine 4, séance 3 : on refait les exercices MESURÉS de la semaine 1 pour comparer
  var measured = [];
  weeks[0].sessions.forEach(function(s) {
    s.exercises.forEach(function(id) {
      var ex = prgEx(id);
      if (ex && ex.measure && measured.indexOf(id) < 0) measured.push(id);
    });
  });
  if (measured.length) {
    weeks[3].sessions[2] = { key: 'w4s3', title: 'Séance test', focus: 'Comparaison avec la semaine 1',
      exercises: measured.slice(0, 3), isTest: true };
  }

  return {
    id: 'prg-' + Date.now(),
    createdAt: new Date().toISOString(),
    startDate: prgMonday(),
    primary: primary,
    secondary: secondary,
    basedOnData: !!sectors,
    weeks: weeks,
    progress: {}
  };
}

function prgEx(id) {
  var lib = getLibrary();
  for (var i = 0; i < lib.length; i++) { if (lib[i].id === id) return lib[i]; }
  return null;
}

function prgGet() { return lsGet('program'); }
function prgSave(p) { lsSet('program', p); }

/* Semaine courante (1 à 4), ou 5 = programme terminé */
function prgCurrentWeek(p) {
  // Jours CALENDAIRES écoulés (arrondi : absorbe les changements d'heure).
  // Avant : départ ancré à midi → chaque lundi matin affichait encore la semaine précédente.
  var days = Math.round((prgMidnight().getTime() - prgMidnight(p.startDate).getTime()) / 86400000);
  return Math.max(1, Math.min(5, Math.floor(days / 7) + 1));
}

function prgSessionDone(p, s) {
  var pr = p.progress[s.key] || {};
  return s.exercises.length > 0 && s.exercises.every(function(id) { return !!pr[id]; });
}

function prgStats(p) {
  var total = 0, done = 0;
  p.weeks.forEach(function(w) { w.sessions.forEach(function(s) { total++; if (prgSessionDone(p, s)) done++; }); });
  return { total: total, done: done, pct: total ? Math.round(100 * done / total) : 0 };
}

/* Bilan : premier résultat depuis le début du programme vs le plus récent */
function prgReport(p) {
  var since = new Date(p.startDate + 'T00:00:00').getTime();
  var ids = {};
  p.weeks.forEach(function(w) { w.sessions.forEach(function(s) { s.exercises.forEach(function(id) { ids[id] = true; }); }); });
  var out = [];
  Object.keys(ids).forEach(function(id) {
    var ex = prgEx(id);
    if (!ex || !ex.measure) return;
    var res = (lsGet('trainingLog') || []).filter(function(l) {
      return l.id === id && l.score !== undefined && l.score !== null && new Date(l.date).getTime() >= since;
    });
    if (res.length < 2) return;
    var first = res[0].score, last = res[res.length - 1].score;
    var better = ex.measure.lower ? last < first : last > first;
    out.push({ ex: ex, first: first, last: last, n: res.length, better: better, same: last === first });
  });
  return out;
}

/* ── Panneau dans l'onglet Entraînement ── */
var _prgViewWeek = null;

function prgRenderPanel(host) {
  if (!host) return;
  host.innerHTML = '';
  var p = prgGet();
  var panel = document.createElement('div');
  panel.className = 'panel prg-panel';

  if (!p) {
    var sectors = (typeof trnWeakSectors === 'function') ? trnWeakSectors() : null;
    var why = sectors
      ? 'Construit sur <strong>' + PRG_SECTOR_LABEL[sectors[0].key] + '</strong> (ton secteur le plus faible) et <strong>' + PRG_SECTOR_LABEL[sectors[1].key] + '</strong>.'
      : 'Enregistre quelques parties pour un programme sur mesure — en attendant, il couvre les secteurs clés.';
    panel.innerHTML = '<div class="prg-cta">'
      + '<div class="prg-cta-ico">🗓️</div>'
      + '<div class="prg-cta-txt"><div class="prg-cta-t">Passe au programme de 4 semaines</div>'
      + '<div class="prg-cta-d">3 séances par semaine, de difficulté croissante. ' + why
      + ' La dernière semaine, tu refais tes exercices mesurés pour voir le chemin parcouru.</div></div>'
      + '<button class="dash-btn dash-btn-gold prg-start" id="prg-start">Créer mon programme</button>'
      + '</div>';
    host.appendChild(panel);
    // (référence directe : au lancement, la page n'est pas encore dans le document)
    panel.querySelector('#prg-start').addEventListener('click', function() {
      prgSave(prgGenerate());
      _prgViewWeek = null;
      if (typeof showToast === 'function') showToast('Programme créé — c\'est parti pour la semaine 1 ✓');
      prgRenderPanel(host);
    });
    return;
  }

  var cur = prgCurrentWeek(p);
  var finished = cur >= 5;
  var view = _prgViewWeek || Math.min(cur, 4);
  var wk = p.weeks[view - 1];
  var st = prgStats(p);

  var tabs = p.weeks.map(function(w) {
    var wDone = w.sessions.filter(function(s) { return prgSessionDone(p, s); }).length;
    var cls = 'prg-tab' + (w.n === view ? ' on' : '') + (w.n === cur ? ' cur' : '') + (w.n < cur && !finished ? ' past' : '');
    return '<button class="' + cls + '" data-week="' + w.n + '">'
      + '<span class="prg-tab-n">S' + w.n + '</span>'
      + '<span class="prg-tab-d">' + wDone + '/' + w.sessions.length + '</span></button>';
  }).join('');

  var sessions = wk.sessions.map(function(s) {
    var pr = p.progress[s.key] || {};
    var nDone = s.exercises.filter(function(id) { return !!pr[id]; }).length;
    var isDone = prgSessionDone(p, s);
    var names = s.exercises.map(function(id) {
      var ex = prgEx(id);
      return '<li class="' + (pr[id] ? 'is-done' : '') + '">' + prgEsc(ex ? ex.title : id) + '</li>';
    }).join('');
    var minutes = s.exercises.reduce(function(a, id) { var ex = prgEx(id); return a + ((ex && ex.duration) || 0); }, 0);
    return '<div class="prg-session' + (isDone ? ' is-done' : '') + (s.isTest ? ' is-test' : '') + '">'
      + '<div class="prg-s-head"><div><div class="prg-s-title">' + prgEsc(s.title) + (s.isTest ? ' 📏' : '') + '</div>'
      +   '<div class="prg-s-focus">' + prgEsc(s.focus) + ' · ' + minutes + ' min</div></div>'
      +   '<div class="prg-s-count">' + (isDone ? '✓ Faite' : nDone + '/' + s.exercises.length) + '</div></div>'
      + '<ul class="prg-s-list">' + names + '</ul>'
      + '<button class="dash-btn ' + (isDone ? 'dash-btn-outline' : 'dash-btn-gold') + ' prg-open" data-session="' + s.key + '">'
      +   (isDone ? 'Revoir' : (nDone ? 'Continuer' : 'Commencer')) + '</button>'
      + '</div>';
  }).join('');

  var report = prgReport(p);
  var reportHtml = '';
  if (report.length && (view === 4 || finished)) {
    reportHtml = '<div class="prg-report"><div class="prg-report-t">📈 Ton bilan depuis le début du programme</div>'
      + report.map(function(r) {
        var unit = r.ex.measure.unit ? ' ' + r.ex.measure.unit : (r.ex.measure.max ? '/' + r.ex.measure.max : '');
        var sign = r.same ? '→' : (r.better ? '↗' : '↘');
        return '<div class="prg-report-row ' + (r.same ? 'flat' : (r.better ? 'up' : 'down')) + '">'
          + '<span>' + prgEsc(r.ex.title) + '</span>'
          + '<strong>' + r.first + ' ' + sign + ' ' + r.last + unit + '</strong></div>';
      }).join('') + '</div>';
  }

  var headTitle = finished ? 'Programme terminé 🎉' : ('Semaine ' + cur + ' sur 4 — ' + p.weeks[cur - 1].theme);
  panel.innerHTML = '<div class="panel-header prg-head">'
    + '<div><div class="panel-title">🗓️ Mon programme</div>'
    + '<div class="panel-sub">' + prgEsc(headTitle) + ' · axé sur ' + prgEsc(PRG_SECTOR_LABEL[p.primary] || p.primary) + '</div></div>'
    + '<button class="prg-reset" id="prg-reset" title="Générer un nouveau programme">↻ Nouveau</button>'
    + '</div>'
    + '<div class="panel-body">'
    +   '<div class="prg-progress"><div class="prg-progress-bar"><div class="prg-progress-fill" style="width:' + st.pct + '%"></div></div>'
    +   '<span>' + st.done + '/' + st.total + ' séances</span></div>'
    +   '<div class="prg-tabs">' + tabs + '</div>'
    +   '<div class="prg-week-desc"><strong>' + prgEsc(wk.theme) + '</strong> — ' + prgEsc(wk.desc) + '</div>'
    +   '<div class="prg-sessions">' + sessions + '</div>'
    +   reportHtml
    + '</div>';
  host.appendChild(panel);

  panel.querySelectorAll('[data-week]').forEach(function(b) {
    b.addEventListener('click', function() { _prgViewWeek = parseInt(b.getAttribute('data-week'), 10); prgRenderPanel(host); });
  });
  panel.querySelectorAll('.prg-open').forEach(function(b) {
    b.addEventListener('click', function() { prgOpenSession(b.getAttribute('data-session'), host); });
  });
  document.getElementById('prg-reset').addEventListener('click', function() {
    if (!confirm('Générer un nouveau programme ? Ta progression sur celui-ci sera remise à zéro (tes résultats d\'exercices, eux, sont conservés).')) return;
    prgSave(prgGenerate());
    _prgViewWeek = null;
    prgRenderPanel(host);
  });
}

/* ── Une séance : la liste de ses exercices, à faire un par un ── */
function prgOpenSession(key, host) {
  var p = prgGet();
  if (!p) return;
  var sess = null;
  p.weeks.forEach(function(w) { w.sessions.forEach(function(s) { if (s.key === key) sess = s; }); });
  if (!sess) return;

  var ex = document.getElementById('prg-modal');
  if (ex) ex.remove();
  var pr = p.progress[key] || {};

  var rows = sess.exercises.map(function(id) {
    var e = prgEx(id);
    if (!e) return '';
    var done = !!pr[id];
    return '<div class="prg-m-row' + (done ? ' is-done' : '') + '">'
      + '<div class="prg-m-check">' + (done ? '✓' : '') + '</div>'
      + '<div class="prg-m-info"><div class="prg-m-title">' + prgEsc(e.title) + '</div>'
      +   '<div class="prg-m-meta">⏱ ' + (e.duration || '—') + ' min'
      +   (e.measure ? ' · 📏 ' + prgEsc(e.measure.label) : '') + '</div></div>'
      + '<button class="dash-btn ' + (done ? 'dash-btn-outline' : 'dash-btn-gold') + '" data-ex="' + id + '">' + (done ? 'Refaire' : 'Faire') + '</button>'
      + '</div>';
  }).join('');

  var m = document.createElement('div');
  m.id = 'prg-modal';
  m.className = 'trn-modal';
  m.innerHTML = '<div class="trn-modal-card">'
    + '<div class="trn-modal-head"><div><div class="trn-modal-tag">' + prgEsc(key.replace(/^w(\d)s(\d)$/, 'Semaine $1')) + '</div>'
    +   '<div class="trn-modal-title">' + prgEsc(sess.title) + '</div></div>'
    +   '<button class="trn-modal-close" id="prg-m-close">×</button></div>'
    + '<div class="trn-modal-body">'
    +   (sess.isTest ? '<div class="prg-m-test">📏 Séance test : note bien tes résultats, ils seront comparés à ceux de la semaine 1.</div>' : '')
    +   '<div class="prg-m-list">' + rows + '</div>'
    + '</div></div>';
  document.body.appendChild(m);

  function close() { m.remove(); }
  document.getElementById('prg-m-close').addEventListener('click', close);
  m.addEventListener('click', function(e) { if (e.target === m) close(); });

  m.querySelectorAll('[data-ex]').forEach(function(b) {
    b.addEventListener('click', function() {
      var id = b.getAttribute('data-ex');
      var e = prgEx(id);
      close();
      openTrainingDetail(e, { onDone: function() {
        var p2 = prgGet();
        if (!p2) return;
        if (!p2.progress[key]) p2.progress[key] = {};
        var wasDone = prgSessionDone(p2, sess);
        p2.progress[key][id] = new Date().toISOString();
        prgSave(p2);
        if (!wasDone && prgSessionDone(p2, sess) && typeof showToast === 'function') {
          showToast('🗓️ ' + sess.title + ' terminée — beau travail !');
        }
        var h = host || document.getElementById('trn-program');
        if (h) prgRenderPanel(h);
        prgOpenSession(key, h);
      }});
    });
  });
}

function prgEsc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
