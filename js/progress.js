/* ════════════════════════════════════════════
 * THE SMART GOLFER — progress.js
 * PROGRESSION VISIBLE : « ton toi d'il y a 6 mois » + objectifs suivis.
 *
 * 1. Avant / après : tes cartes d'il y a ~6 mois (entre 5 et 7 mois) contre
 *    tes 5 dernières. Pas assez de recul ? On compare à tes débuts (si ton
 *    historique a au moins 6 semaines). Index, score, putts, greens, fairways
 *    et niveau par secteur.
 * 2. Objectifs : valeurs actuelles calculées honnêtement (cartes 18 trous,
 *    statistiques saisies seulement — avant, une carte 9 trous tirait le
 *    « score moyen » vers le bas et le handicap venait du profil, pas du WHS),
 *    date à laquelle chaque objectif est atteint, et alerte au moment où il l'est.
 *
 * Dépend de : whs.js, sectorlevels.js, dashboard.js (getObjectives), app.js.
 * ════════════════════════════════════════════ */

var PGS_NOW_N = 5;

function pgsIs18(r) {
  if (r.quickEntry) return true;
  return Array.isArray(r.scores) && r.scores.filter(function(x) { return x !== null && x !== undefined; }).length >= 18;
}

function pgsDaysAgo(dateStr) {
  var p = String(dateStr || '').split('-');
  if (p.length < 3) return null;
  var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
  var t = new Date(); t = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  return Math.round((t - d) / 86400000);
}

function pgsMean(list, fn) {
  var s = 0, n = 0;
  list.forEach(function(r) { var v = fn(r); if (v !== null && v !== undefined && !isNaN(v)) { s += v; n++; } });
  return n ? s / n : null;
}

/* Statistiques d'un lot de cartes 18 trous */
function pgsStats(list) {
  return {
    n: list.length,
    score: pgsMean(list, function(r) { return r.score; }),
    putts: pgsMean(list, function(r) { return (typeof r.putts === 'number' && r.putts >= 18) ? r.putts : null; }),
    gir: pgsMean(list, function(r) { return (r.gir === null || r.gir === undefined) ? null : r.gir / 18 * 100; }),
    fir: pgsMean(list, function(r) { return (r.fir === null || r.fir === undefined || !r.firTotal) ? null : r.fir / r.firTotal * 100; })
  };
}

/* Index WHS tel qu'il était à une date (cartes jouées jusque-là) */
function pgsIndexAt(rounds, dateStr) {
  if (typeof whsCompute !== 'function') return null;
  var before = rounds.filter(function(r) { return r.date && r.date <= dateStr; });
  var res = whsCompute(before);
  return res && res.index !== null && res.index !== undefined ? res.index : null;
}

/* Le lot « avant » : ~6 mois, sinon les débuts */
function pgsThenSet(rounds18) {
  var sixMonths = rounds18.filter(function(r) { var d = pgsDaysAgo(r.date); return d !== null && d >= 150 && d <= 210; });
  if (sixMonths.length >= 3) {
    sixMonths.sort(function(a, b) { return Math.abs(pgsDaysAgo(a.date) - 180) - Math.abs(pgsDaysAgo(b.date) - 180); });
    return { kind: 'six', list: sixMonths.slice(0, PGS_NOW_N) };
  }
  if (rounds18.length >= PGS_NOW_N + 3) {
    var oldest = rounds18.slice().sort(function(a, b) { return a.date < b.date ? -1 : 1; });
    if (pgsDaysAgo(oldest[0].date) >= 42) return { kind: 'start', list: oldest.slice(0, PGS_NOW_N) };
  }
  return null;
}

function pgsMonthLabel(dateStr) {
  var M = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var p = String(dateStr || '').split('-');
  return p.length < 2 ? '' : M[parseInt(p[1], 10) - 1] + ' ' + p[0];
}

function pgsNum(v, d) { return v === null || v === undefined ? '—' : (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d).replace('.', ','); }

/* Panneau du Dashboard */
function pgsRenderThenNow(wrap) {
  var rounds = (lsGet('rounds') || []).filter(function(r) { return r.date; });
  if (!rounds.length) return;
  var r18 = rounds.filter(pgsIs18).sort(function(a, b) { return a.date < b.date ? 1 : -1; });
  var then = pgsThenSet(r18);

  var panel = document.createElement('div');
  panel.className = 'panel pgs-panel';

  if (!then) {
    var first = rounds.slice().sort(function(a, b) { return a.date < b.date ? -1 : 1; })[0];
    var p = first.date.split('-');
    var unlock = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1 + 6, parseInt(p[2], 10));
    panel.innerHTML = '<div class="panel-header"><div class="panel-title">⏳ Ton toi d\'il y a 6 mois</div></div>'
      + '<div class="panel-body"><div class="pgs-wait">Continue à enregistrer tes parties : dès le <strong>'
      + unlock.getDate() + ' ' + pgsMonthLabel(unlock.getFullYear() + '-' + String(unlock.getMonth() + 1).padStart(2, '0')) + '</strong>'
      + ', tu verras côte à côte le golfeur que tu étais et celui que tu es devenu.</div></div>';
    wrap.appendChild(panel);
    return;
  }

  var now = r18.slice(0, PGS_NOW_N);
  var sThen = pgsStats(then.list), sNow = pgsStats(now);
  var thenEnd = then.list.reduce(function(a, r) { return r.date > a ? r.date : a; }, then.list[0].date);
  var iThen = pgsIndexAt(rounds, thenEnd);
  var iNow = (typeof calcHandicapFromRounds === 'function') ? calcHandicapFromRounds() : null;

  var rows = [
    { label: 'Index', phrase: 'ton index est passé', a: iThen, b: iNow, d: 1, lower: true, key: true },
    { label: 'Score moyen', phrase: 'ton score moyen est passé', a: sThen.score, b: sNow.score, d: 1, lower: true },
    { label: 'Putts / partie', phrase: 'tes putts par partie sont passés', a: sThen.putts, b: sNow.putts, d: 1, lower: true },
    { label: 'Greens en régulation', phrase: 'tes greens en régulation sont passés', a: sThen.gir, b: sNow.gir, d: 0, lower: false, unit: ' %', pts: true },
    { label: 'Fairways', phrase: 'tes fairways touchés sont passés', a: sThen.fir, b: sNow.fir, d: 0, lower: false, unit: ' %', pts: true }
  ].filter(function(r) { return r.a !== null && r.b !== null; });

  // Niveau par secteur, avant / maintenant
  if (typeof slvComputeSet === 'function' && typeof SLV_SECTORS !== 'undefined') {
    var lvThen = slvComputeSet(then.list), lvNow = slvComputeSet(now);
    SLV_SECTORS.forEach(function(s) {
      if (lvThen[s.key] && lvNow[s.key]) rows.push({ label: s.label, a: lvThen[s.key].h, b: lvNow[s.key].h, d: 1, lower: true, sector: true });
    });
  }

  var bestGain = null;
  var html = rows.map(function(r) {
    var diff = r.b - r.a;
    var gain = r.lower ? -diff : diff;
    var eps = r.d === 0 ? 0.5 : 0.05;
    var cls = Math.abs(diff) < eps ? 'same' : (gain > 0 ? 'up' : 'down');
    // Le progrès mis en avant : l'index s'il a baissé d'au moins un demi-point, sinon le plus grand progrès relatif
    var rel = r.key && gain >= 0.5 ? 99 : gain / Math.max(1, Math.abs(r.a));
    if (!r.sector && gain > eps && (!bestGain || rel > bestGain.rel)) bestGain = { row: r, rel: rel };
    var fmt = function(v) { return (r.label === 'Index' || r.sector) && v < 0 ? '+' + pgsNum(-v, r.d) : pgsNum(v, r.d) + (r.unit || ''); };
    var sub = (r.sector && !rows._subDone) ? (rows._subDone = true, '<div class="pgs-subhead">Niveau par secteur · joue comme un index</div>') : '';
    return sub + '<div class="pgs-row ' + cls + (r.sector ? ' sector' : '') + '"><span class="pgs-l">' + r.label + '</span>'
      + '<span class="pgs-a">' + fmt(r.a) + '</span><span class="pgs-arrow">→</span><span class="pgs-b">' + fmt(r.b) + '</span>'
      + '<span class="pgs-d">' + (cls === 'same' ? '=' : (diff > 0 ? '+' : '−') + pgsNum(Math.abs(diff), r.d) + (r.pts ? ' pts' : '')) + '</span></div>';
  }).join('');

  var title = then.kind === 'six' ? 'Ton toi d\'il y a 6 mois' : 'Toi à tes débuts';
  var when = then.kind === 'six' ? pgsMonthLabel(thenEnd) : 'tes ' + then.list.length + ' premières cartes (' + pgsMonthLabel(then.list[0].date) + ')';
  var lead;
  if (bestGain) {
    var b = bestGain.row;
    lead = 'Depuis ' + (then.kind === 'six' ? pgsMonthLabel(thenEnd) : 'tes débuts') + ', <strong>' + b.phrase + '</strong> de '
      + pgsNum(b.a, b.d) + (b.unit || '') + ' à <strong>' + pgsNum(b.b, b.d) + (b.unit || '') + '</strong>. Ça, c\'est du progrès mesuré.';
  } else {
    lead = 'Pas encore de progrès net par rapport à ' + (then.kind === 'six' ? pgsMonthLabel(thenEnd) : 'tes débuts') + '. Ton programme d\'entraînement vise ton secteur le plus faible : c\'est le chemin le plus court.';
  }

  panel.innerHTML = '<div class="panel-header"><div class="panel-title">⏳ ' + title + '</div>'
    + '<div class="pgs-sub">' + when + ' → tes ' + now.length + ' dernières cartes</div></div>'
    + '<div class="panel-body"><div class="pgs-lead">' + lead + '</div>'
    + '<div class="pgs-head"><span></span><span>Avant</span><span></span><span>Maintenant</span><span></span></div>'
    + html + '</div>';
  wrap.appendChild(panel);
}

/* ─────────────── OBJECTIFS SUIVIS ─────────────── */

/* Valeurs actuelles des objectifs : 10 dernières cartes 18 trous, stats saisies seulement */
function pgsGoalNow() {
  var r18 = (lsGet('rounds') || []).filter(pgsIs18).slice(0, 10);
  var s = pgsStats(r18);
  var idx = (typeof calcHandicapFromRounds === 'function') ? calcHandicapFromRounds() : null;
  if ((idx === null || idx === undefined) && typeof currentUser !== 'undefined' && currentUser) idx = currentUser.hcp;
  return { score: s.score, hcp: idx, gir: s.gir, fir: s.fir, putts: s.putts, n: r18.length };
}

var PGS_GOALS = [
  { key: 'score', label: 'Score moyen', lower: true,  d: 1, unit: '' },
  { key: 'hcp',   label: 'Index',        lower: true,  d: 1, unit: '' },
  { key: 'gir',   label: 'Greens (GIR)', lower: false, d: 0, unit: ' %' },
  { key: 'fir',   label: 'Fairways',     lower: false, d: 0, unit: ' %' },
  { key: 'putts', label: 'Putts / partie', lower: true, d: 1, unit: '' }
];

function pgsGoalReached(g, now, target) {
  if (now === null || now === undefined || target === null || target === undefined) return false;
  return g.lower ? now <= target : now >= target;
}

/* Enregistre les objectifs nouvellement atteints ; prévient si notify */
function pgsCheckGoals(notify) {
  if (typeof getObjectives !== 'function' || typeof currentUser === 'undefined' || !currentUser) return [];
  var obj = getObjectives(), now = pgsGoalNow();
  if (!now.n) return [];
  var all = lsGet('goalsReached') || {}, mine = all[currentUser.id] = all[currentUser.id] || {};
  var fresh = [];
  PGS_GOALS.forEach(function(g) {
    var id = g.key + '@' + obj[g.key];                  // changer la cible = nouvel objectif
    if (!mine[id] && pgsGoalReached(g, now[g.key], obj[g.key])) {
      mine[id] = new Date().toISOString().slice(0, 10);
      fresh.push(g);
    }
  });
  if (fresh.length) {
    lsSet('goalsReached', all);
    if (notify) {
      var g = fresh[0];
      showToast('🎯 Objectif atteint : ' + g.label.toLowerCase() + ' ' + pgsNum(now[g.key], g.d) + g.unit + ' (cible ' + obj[g.key] + g.unit + ')'
        + (fresh.length > 1 ? ' — et ' + (fresh.length - 1) + ' autre' + (fresh.length > 2 ? 's' : '') : ''));
    }
  }
  return fresh;
}

function pgsReachedOn(key, target) {
  var all = lsGet('goalsReached') || {};
  var mine = (currentUser && all[currentUser.id]) || {};
  return mine[key + '@' + target] || null;
}
