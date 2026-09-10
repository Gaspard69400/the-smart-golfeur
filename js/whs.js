/* ════════════════════════════════════════════
 * THE SMART GOLFER — whs.js
 * INDEX OFFICIEL — World Handicap System.
 *
 * Remplace l'approximation maison (« moyenne des 40 % meilleures cartes »)
 * par le calcul normalisé. C'est important : cet index sert de référence
 * aux Strokes Gained ET au handicap de jeu du stableford. S'il est faux,
 * toute la chaîne l'est.
 *
 * Les 3 règles du WHS appliquées ici :
 *  1. Différentiel = (113 / Slope) × (Score Brut Ajusté − Rating)
 *  2. Score Brut Ajusté : chaque trou est plafonné au NET DOUBLE BOGEY
 *     (par + 2 + coups rendus sur ce trou)
 *  3. Index = moyenne des N meilleurs différentiels des 20 dernières cartes,
 *     N et l'ajustement dépendant du nombre de cartes (table officielle),
 *     puis plafonnement souple (au-delà de +3 sur l'index le plus bas de
 *     l'année, l'excédent est divisé par 2) et dur (+5 maximum).
 *
 * Limite assumée : seules les cartes 18 trous comptent. Le WHS sait combiner
 * deux cartes 9 trous, mais mal appliqué ça fausse tout — on préfère ne pas
 * compter une carte plutôt que de la compter de travers.
 *
 * Dépend de : app.js (lsGet), data.js (getAllCourses), formats.js (strokesOnHole).
 * ════════════════════════════════════════════ */

/* Table officielle : cartes disponibles → nb de différentiels retenus + ajustement */
var WHS_TABLE = [
  { n: 3,  take: 1, adj: -2.0 },
  { n: 4,  take: 1, adj: -1.0 },
  { n: 5,  take: 1, adj:  0   },
  { n: 6,  take: 2, adj: -1.0 },
  { n: 7,  take: 2, adj:  0   },
  { n: 8,  take: 2, adj:  0   },
  { n: 9,  take: 3, adj:  0   },
  { n: 10, take: 3, adj:  0   },
  { n: 11, take: 3, adj:  0   },
  { n: 12, take: 4, adj:  0   },
  { n: 13, take: 4, adj:  0   },
  { n: 14, take: 4, adj:  0   },
  { n: 15, take: 5, adj:  0   },
  { n: 16, take: 5, adj:  0   },
  { n: 17, take: 6, adj:  0   },
  { n: 18, take: 6, adj:  0   },
  { n: 19, take: 7, adj:  0   },
  { n: 20, take: 8, adj:  0   }
];

var WHS_MIN_ROUNDS = 3;
var WHS_MAX_INDEX  = 54.0;
var WHS_SOFT_CAP   = 3.0;   // au-delà, l'excédent est divisé par deux
var WHS_HARD_CAP   = 5.0;   // hausse maximale absolue

function whsTableFor(n) {
  if (n < WHS_MIN_ROUNDS) return null;
  if (n >= 20) return { take: 8, adj: 0 };
  for (var i = 0; i < WHS_TABLE.length; i++) {
    if (WHS_TABLE[i].n === n) return { take: WHS_TABLE[i].take, adj: WHS_TABLE[i].adj };
  }
  return { take: 8, adj: 0 };
}

/* Le parcours d'une partie (pour les pars et les index de difficulté) */
function whsCourseOf(round) {
  if (!round || !round.courseId) return null;
  var all = (typeof getAllCourses === 'function') ? getAllCourses() : [];
  for (var i = 0; i < all.length; i++) { if (all[i].id === round.courseId) return all[i]; }
  return null;
}

function whsIs18(round) {
  return Array.isArray(round.scores)
      && round.scores.filter(function(s) { return s !== null && s !== undefined; }).length === 18;
}

/* Score Brut Ajusté : chaque trou plafonné au net double bogey */
function whsAdjustedGross(round, index) {
  var course = whsCourseOf(round);
  if (!course || !Array.isArray(round.scores) || typeof strokesOnHole !== 'function') {
    return { asg: round.score, capped: 0, exact: false };
  }
  var rating = round.teeRating || course.rating;
  var slope  = round.teeSlope  || course.slope;
  var ch = (typeof courseHandicap === 'function')
    ? courseHandicap(index, slope, rating, course.par_total) : index;
  if (ch === null || ch === undefined || isNaN(ch)) ch = index || 0;

  var asg = 0, capped = 0;
  course.trous.forEach(function(h, i) {
    var g = round.scores[i];
    if (g === null || g === undefined) return;
    var max = h.par + 2 + strokesOnHole(ch, h.si);
    if (g > max) { asg += max; capped++; }
    else { asg += g; }
  });
  return { asg: asg, capped: capped, exact: true };
}

/* Différentiel d'une carte */
function whsDifferential(round, index) {
  if (!round || round.score === null || round.score === undefined) return null;
  var course = whsCourseOf(round);
  var rating = round.teeRating || (course && course.rating);
  var slope  = round.teeSlope  || (course && course.slope) || 113;
  if (!rating) return null;

  var adj = whsAdjustedGross(round, index);
  var diff = (113 / slope) * (adj.asg - rating);
  return {
    diff: Math.round(diff * 10) / 10,
    asg: adj.asg,
    gross: round.score,
    capped: adj.capped,
    exact: adj.exact,
    date: round.date,
    course: round.course,
    tee: round.teeName || null
  };
}

/* Index le plus bas des 365 derniers jours (base des plafonnements) */
function whsLowIndex() {
  var hist = lsGet('whsHistory') || [];
  var limit = Date.now() - 365 * 86400000;
  var low = null;
  hist.forEach(function(h) {
    var t = new Date(h.date).getTime();
    if (isNaN(t) || t < limit) return;
    if (low === null || h.index < low) low = h.index;
  });
  return low;
}

/* ── LE CALCUL COMPLET ──
   Renvoie { index, rounds, used, take, adj, differentials, capApplied } ou null. */
function whsCompute(rounds, seedIndex) {
  var all = (rounds || lsGet('rounds') || []).filter(whsIs18);
  if (all.length < WHS_MIN_ROUNDS) {
    return { index: null, rounds: all.length, need: WHS_MIN_ROUNDS - all.length };
  }

  // Les 20 dernières cartes (l'historique est déjà du plus récent au plus ancien)
  var recent = all.slice(0, 20);

  // Le plafond « net double bogey » dépend du handicap de jeu, donc de l'index.
  // On fait deux passes : une estimation, puis le calcul définitif.
  var seed = seedIndex;
  if (seed === null || seed === undefined || isNaN(seed)) {
    seed = (typeof currentUser !== 'undefined' && currentUser && currentUser.hcp != null) ? currentUser.hcp : 18;
  }

  function pass(idx) {
    var ds = [];
    recent.forEach(function(r) {
      var d = whsDifferential(r, idx);
      if (d && !isNaN(d.diff)) ds.push(d);
    });
    if (ds.length < WHS_MIN_ROUNDS) return null;
    var conf = whsTableFor(ds.length);
    if (!conf) return null;
    var sorted = ds.slice().sort(function(a, b) { return a.diff - b.diff; });
    var best = sorted.slice(0, conf.take);
    var avg = best.reduce(function(a, b) { return a + b.diff; }, 0) / best.length;
    return { raw: Math.round((avg + conf.adj) * 10) / 10, ds: ds, best: best, conf: conf };
  }

  var first = pass(seed);
  if (!first) return { index: null, rounds: all.length, need: 0 };
  var second = pass(first.raw) || first;

  var idx = second.raw;

  // Plafonnements souple et dur, par rapport à l'index le plus bas de l'année
  var low = whsLowIndex();
  var capApplied = null;
  if (low !== null && idx > low + WHS_SOFT_CAP) {
    var over = idx - low;
    var softened = low + WHS_SOFT_CAP + (over - WHS_SOFT_CAP) / 2;
    capApplied = 'souple';
    if (softened > low + WHS_HARD_CAP) { softened = low + WHS_HARD_CAP; capApplied = 'dur'; }
    idx = Math.round(softened * 10) / 10;
  }

  if (idx > WHS_MAX_INDEX) idx = WHS_MAX_INDEX;

  return {
    index: idx,
    rounds: all.length,
    used: second.ds.length,
    take: second.conf.take,
    adj: second.conf.adj,
    differentials: second.ds,
    best: second.best,
    lowIndex: low,
    capApplied: capApplied
  };
}

/* Mémorise l'index du jour (sert au calcul des plafonnements) */
function whsRecord(index) {
  if (index === null || index === undefined) return;
  var hist = lsGet('whsHistory') || [];
  var today = new Date().toISOString().slice(0, 10);
  if (hist.length && hist[hist.length - 1].date === today) {
    hist[hist.length - 1].index = index;
  } else {
    hist.push({ date: today, index: index });
  }
  // On ne garde que 2 ans
  var limit = Date.now() - 730 * 86400000;
  hist = hist.filter(function(h) {
    var t = new Date(h.date).getTime();
    return isNaN(t) || t >= limit;
  });
  lsSet('whsHistory', hist);
}

/* ════════════════════════════════════════════
   Détail du calcul — un index qu'on ne comprend pas n'inspire pas confiance.
   Ouvert en cliquant la pastille Hcp de la barre du haut.
════════════════════════════════════════════ */

function openWhsModal() {
  var ex = document.getElementById('whs-modal');
  if (ex) ex.remove();

  var res = whsCompute();
  var body;

  if (!res || res.index === null || res.index === undefined) {
    var need = (res && res.need) ? res.need : WHS_MIN_ROUNDS;
    body = '<div class="whs-empty">'
      + '<div class="whs-empty-ico">📋</div>'
      + '<div><strong>Pas encore assez de cartes</strong><br>'
      + 'L\'index officiel demande au minimum <strong>3 parties de 18 trous</strong>. '
      + 'Il t\'en manque <strong>' + need + '</strong>.</div></div>';
  } else {
    var bestIds = {};
    res.best.forEach(function(b) { bestIds[b.date + '|' + b.gross] = true; });

    var rows = res.differentials.map(function(d) {
      var kept = bestIds[d.date + '|' + d.gross];
      var when = d.date;
      try { when = new Date(d.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' }); } catch (e) {}
      var adjNote = (d.capped > 0)
        ? '<span class="whs-capped" title="' + d.capped + ' trou(x) ramené(s) au net double bogey">' + d.gross + ' → ' + d.asg + '</span>'
        : String(d.gross);
      return '<tr class="' + (kept ? 'whs-kept' : '') + '">'
        + '<td>' + whsEsc(when) + '</td>'
        + '<td class="whs-course">' + whsEsc(d.course || '') + (d.tee ? ' <span class="whs-tee">' + whsEsc(d.tee) + '</span>' : '') + '</td>'
        + '<td class="whs-num">' + adjNote + '</td>'
        + '<td class="whs-num whs-diff">' + d.diff.toFixed(1) + '</td>'
        + '<td class="whs-keep">' + (kept ? '✓' : '') + '</td>'
        + '</tr>';
    }).join('');

    var adjTxt = res.adj ? ('  puis <strong>' + res.adj.toFixed(1) + '</strong> d\'ajustement (barème officiel pour ' + res.used + ' cartes)') : '';
    var capTxt = '';
    if (res.capApplied) {
      capTxt = '<div class="whs-cap">⚠️ Plafonnement <strong>' + res.capApplied + '</strong> appliqué : '
        + 'ton index ne peut pas remonter trop vite au-dessus de ton meilleur index de l\'année ('
        + res.lowIndex.toFixed(1) + ').</div>';
    }

    body = ''
      + '<div class="whs-hero"><div class="whs-hero-v">' + res.index.toFixed(1) + '</div>'
      +   '<div class="whs-hero-l">Index WHS</div></div>'
      + '<div class="whs-formula">Moyenne des <strong>' + res.take + ' meilleurs</strong> différentiels '
      +   'sur tes <strong>' + res.used + '</strong> dernières cartes' + adjTxt + '.</div>'
      + capTxt
      + '<div class="whs-tablewrap"><table class="whs-table">'
      +   '<thead><tr><th>Date</th><th>Parcours</th><th class="whs-num">Score</th><th class="whs-num">Diff.</th><th></th></tr></thead>'
      +   '<tbody>' + rows + '</tbody>'
      + '</table></div>'
      + '<div class="whs-note">'
      +   '<strong>Comment se lit un différentiel :</strong> (113 ÷ slope) × (score ajusté − rating du départ). '
      +   'Un score en <span class="whs-capped">orange</span> a été ramené au <strong>net double bogey</strong> sur un ou plusieurs trous, comme le veut la règle. '
      +   'Seules les cartes de 18 trous comptent.'
      + '</div>';
  }

  var m = document.createElement('div');
  m.id = 'whs-modal';
  m.className = 'whs-modal';
  m.innerHTML = '<div class="whs-card">'
    + '<div class="whs-head"><div><div class="whs-tag">Handicap</div>'
    +   '<div class="whs-title">Ton index, en détail</div></div>'
    +   '<button class="whs-close" id="whs-close">×</button></div>'
    + '<div class="whs-body">' + body + '</div>'
    + '</div>';
  document.body.appendChild(m);

  function close() { m.remove(); }
  document.getElementById('whs-close').addEventListener('click', close);
  m.addEventListener('click', function(e) { if (e.target === m) close(); });
}

function whsEsc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
