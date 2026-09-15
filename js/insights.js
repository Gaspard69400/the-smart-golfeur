/* ════════════════════════════════════════════
 * THE SMART GOLFER — insights.js
 * Deux cartes de l'onglet Analyse → Vue d'ensemble :
 *
 * 1. CARTE DE CHALEUR DES TROUS (remplace l'ancienne `renderHeatmap`)
 *    ⚠️ L'ancienne mélangeait tous les parcours (le trou 7 de Lyon moyenné
 *    avec le trou 7 d'un autre golf), ne connaissait que les parcours
 *    intégrés et comparait au par (tout rouge pour un débutant).
 *    Ici : UN parcours à la fois (le plus joué par défaut), 9 ou 18 trous,
 *    au choix « vs ton handicap » (coups perdus par rapport aux coups reçus,
 *    même mesure que le plan de jeu) ou « vs par ». Clic → plan de jeu.
 *
 * 2. SIMULATEUR « ET SI »
 *    Leviers : putts en moins, greens et fairways en plus, trous ratés
 *    (double bogey ou pire) ramenés au bogey. Valeur en coups = celle des
 *    Strokes Gained (SG_PER_GIR, SG_PER_FAIRWAY) ; les trous ratés sont
 *    mesurés sur TES cartes. Index estimé = index − coups × 113 / slope
 *    moyen (chaque différentiel baisse d'autant si le gain est régulier).
 *    « Objectif réaliste » : écarts avec les repères d'un joueur 5 points
 *    meilleur, ramenés à ≈ 5 points d'index (sinon double-compte).
 * ════════════════════════════════════════════ */

function insEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function insFmt(x, d) {
  var p = Math.pow(10, d == null ? 1 : d);
  var r = (x < 0 ? -1 : 1) * Math.round(Math.abs(x) * p) / p;
  return r.toFixed(d == null ? 1 : d).replace('.', ',');
}
function insNum(x) { return insFmt(x).replace(/,0$/, ''); }
function insSigned(x) { var t = insFmt(x).replace('-', '−'); return (x > 0.049 ? '+' : '') + t; }

/* ═══════════ 1. CARTE DE CHALEUR ═══════════ */
var _hh = { courseId: null, mode: null };

function hhRenderCard(rounds) {
  var courses = (typeof getAllCourses === 'function') ? getAllCourses() : [];
  var count = {};
  (rounds || []).forEach(function(r) {
    if (r.courseId && Array.isArray(r.scores) && r.scores.some(function(s) { return s != null; })) count[r.courseId] = (count[r.courseId] || 0) + 1;
  });
  var played = courses.filter(function(c) { return count[c.id] && Array.isArray(c.trous) && c.trous.length; })
    .sort(function(a, b) { return count[b.id] - count[a.id]; });

  var card = document.createElement('div');
  card.className = 'an-card hh-card';
  if (!played.length) {
    card.innerHTML = '<div class="an-card-header"><div class="an-card-title">Carte de chaleur des trous</div></div>'
      + '<div class="an-card-body"><div class="hh-empty">Saisis tes scores trou par trou (saisie express) pour voir, sur chaque parcours, les trous qui te coûtent le plus de coups.</div></div>';
    return card;
  }
  if (!played.some(function(c) { return c.id === _hh.courseId; })) _hh.courseId = played[0].id;
  var idx = (typeof calcHandicapFromRounds === 'function') ? calcHandicapFromRounds() : null;
  var hasIdx = idx != null && !isNaN(idx);
  if (!_hh.mode) _hh.mode = 'hcp';

  function render() {
    var course = played.filter(function(c) { return c.id === _hh.courseId; })[0];
    var courseRounds = rounds.filter(function(r) { return r.courseId === course.id && Array.isArray(r.scores); });
    var stats = gpCourseStats(course, courseRounds);
    var useHcp = _hh.mode === 'hcp';
    var n = courseRounds.length;

    function val(s) { return useHcp ? s.cost : s.overPar; }
    function cls(s) {
      if (!s.n) return 'hh-none';
      var v = val(s);
      if (useHcp) return v <= -0.3 ? 'hh-good' : v < 0.3 ? 'hh-ok' : v < 0.8 ? 'hh-warn' : 'hh-bad';
      return v <= -0.5 ? 'hh-good' : v < 0.5 ? 'hh-ok' : v < 1.5 ? 'hh-warn' : 'hh-bad';
    }
    function cell(s) {
      return '<button type="button" class="hh-cell ' + cls(s) + '" data-hh-hole="' + s.hole.num + '" title="Trou ' + s.hole.num + ' · par ' + s.hole.par
        + (s.n ? ' · moyenne ' + insFmt(s.avg) + (useHcp ? ' · ' + s.strokes + ' coup(s) reçu(s)' : '') : ' · pas de score') + '">'
        + '<span class="hh-n">' + s.hole.num + '</span>'
        + '<span class="hh-v">' + (s.n ? insSigned(val(s)) : '–') + '</span>'
        + '<span class="hh-p">par ' + s.hole.par + '</span></button>';
    }
    var rows = [];
    for (var i = 0; i < stats.length; i += 9) rows.push(stats.slice(i, i + 9));

    var ranked = stats.filter(function(s) { return s.n; }).sort(function(a, b) { return val(b) - val(a); });
    var worst = ranked[0], best = ranked[ranked.length - 1];
    var lost = ranked.reduce(function(a, s) { return a + Math.max(0, val(s)); }, 0);
    var summary = '';
    if (worst && val(worst) > 0.2) {
      summary = 'Trou le plus coûteux : <strong>le ' + worst.hole.num + '</strong> (' + insSigned(val(worst)) + ')';
      if (best && best !== worst && val(best) < 0) summary += ' · meilleur : <strong>le ' + best.hole.num + '</strong> (' + insSigned(val(best)) + ')';
      if (useHcp && lost >= 1) summary += '<br>Au-delà de ton handicap, tu laisses <strong>' + insFmt(lost) + ' coups</strong> par partie sur ce parcours.';
    } else if (ranked.length) {
      summary = useHcp ? 'Tu joues ton handicap ou mieux sur tous les trous de ce parcours 👏' : 'Tu tiens le par partout : bravo !';
    }

    var picker = played.length > 1
      ? (played.length <= 3
          ? '<div class="hh-courses">' + played.map(function(c) { return '<button type="button" class="filter-btn' + (c.id === course.id ? ' on' : '') + '" data-hh-course="' + insEsc(c.id) + '">' + insEsc(c.name) + ' <small>' + count[c.id] + '</small></button>'; }).join('') + '</div>'
          : '<select class="obj-input hh-select" data-hh-select>' + played.map(function(c) { return '<option value="' + insEsc(c.id) + '"' + (c.id === course.id ? ' selected' : '') + '>' + insEsc(c.name) + ' (' + count[c.id] + ')</option>'; }).join('') + '</select>')
      : '';

    card.innerHTML = '<div class="an-card-header"><div class="an-card-title">Carte de chaleur des trous</div>'
      + '<div class="an-card-sub">' + insEsc(course.name) + ' · ' + n + ' carte' + (n > 1 ? 's' : '') + '</div></div>'
      + '<div class="an-card-body">' + picker
      +   '<div class="hh-modes"><button type="button" class="filter-btn' + (useHcp ? ' on' : '') + '" data-hh-mode="hcp">Par rapport à ton handicap</button>'
      +     '<button type="button" class="filter-btn' + (!useHcp ? ' on' : '') + '" data-hh-mode="par">Par rapport au par</button></div>'
      +   '<div class="hh-help">' + (useHcp
            ? 'Coups perdus (+) ou gagnés (−) sur chaque trou <strong>une fois tes coups reçus déduits</strong>' + (hasIdx ? '' : ' (index estimé : enregistre 3 cartes 18 trous pour ton vrai index)') + '.'
            : 'Écart moyen au par sur chaque trou, sans tenir compte de ton niveau.') + '</div>'
      +   rows.map(function(r, k) { return '<div class="hh-row-label">' + (rows.length > 1 ? (k === 0 ? 'Aller' : 'Retour') : '') + '</div><div class="hh-row">' + r.map(cell).join('') + '</div>'; }).join('')
      +   '<div class="hh-legend">' + (useHcp
            ? '<span class="hh-good">Mieux que ton handicap</span><span class="hh-ok">Dans ton handicap</span><span class="hh-warn">Un peu cher</span><span class="hh-bad">Trou noir</span>'
            : '<span class="hh-good">Sous le par</span><span class="hh-ok">Autour du par</span><span class="hh-warn">Bogey</span><span class="hh-bad">Double ou pire</span>') + '</div>'
      +   (summary ? '<div class="hh-summary">' + summary + '</div>' : '')
      +   (typeof gpOpenCourse === 'function' ? '<button type="button" class="dash-btn dash-btn-outline hh-plan" data-hh-plan>🧭 Plan de jeu de ce parcours</button>' : '')
      + '</div>';
  }

  card.addEventListener('click', function(e) {
    var t = e.target.closest('[data-hh-course],[data-hh-mode],[data-hh-plan],[data-hh-hole]');
    if (!t) return;
    if (t.hasAttribute('data-hh-course')) { _hh.courseId = t.getAttribute('data-hh-course'); render(); }
    else if (t.hasAttribute('data-hh-mode')) { _hh.mode = t.getAttribute('data-hh-mode'); render(); }
    else {
      var c = played.filter(function(x) { return x.id === _hh.courseId; })[0];
      if (c && typeof gpOpenCourse === 'function') gpOpenCourse(c);
    }
  });
  card.addEventListener('change', function(e) {
    if (e.target.hasAttribute('data-hh-select')) { _hh.courseId = e.target.value; render(); }
  });
  render();
  return card;
}

/* ═══════════ 2. SIMULATEUR « ET SI » ═══════════ */
var WIF_LEVERS = [
  { key: 'putts', label: 'Putts en moins par tour',  ico: '⛳', max: 8 },
  { key: 'gir',   label: 'Greens touchés en plus',   ico: '🎯', max: 8 },
  { key: 'fir',   label: 'Fairways touchés en plus', ico: '🏌️', max: 8 },
  { key: 'blow',  label: 'Trous ratés ramenés au bogey', ico: '🧯', max: 8 }
];
var _wif = { putts: 0, gir: 0, fir: 0, blow: 0 };

/* Profil de jeu : 10 dernières cartes 18 trous (index, slope moyen, stats saisies) */
function wifProfile() {
  var all = (lsGet('rounds') || []).filter(function(r) { return typeof whsIs18 === 'function' ? whsIs18(r) : (Array.isArray(r.scores) && r.scores.length === 18); });
  var recent = all.slice(0, 10);
  if (recent.length < 3) return { enough: false, have: all.length };
  var courses = (typeof getAllCourses === 'function') ? getAllCourses() : [];
  function avgOf(list, f) { var v = list.map(f).filter(function(x) { return x != null && !isNaN(x); }); return v.length ? v.reduce(function(a, b) { return a + b; }, 0) / v.length : null; }

  var blowHoles = 0, blowExtra = 0;
  recent.forEach(function(r) {
    var c = courses.filter(function(x) { return x.id === r.courseId; })[0];
    if (!c || !c.trous) return;
    r.scores.forEach(function(s, i) {
      var h = c.trous[i];
      if (s == null || !h) return;
      if (s >= h.par + 2) { blowHoles++; blowExtra += s - (h.par + 1); }
    });
  });
  var idx = (typeof calcHandicapFromRounds === 'function') ? calcHandicapFromRounds() : null;
  if (idx == null || isNaN(idx)) idx = null;
  var slope = avgOf(recent, function(r) {
    if (r.teeSlope) return r.teeSlope;
    var c = courses.filter(function(x) { return x.id === r.courseId; })[0];
    return c && c.slope;
  }) || 113;
  return {
    enough: true, n: recent.length, index: idx, slope: slope,
    score: avgOf(recent, function(r) { return r.score; }),
    putts: avgOf(recent, function(r) { return (typeof r.putts === 'number' && r.putts >= 18) ? r.putts : null; }),
    gir: avgOf(recent, function(r) { return r.gir; }),
    fir: avgOf(recent, function(r) { return r.fir; }),
    firTotal: avgOf(recent, function(r) { return r.firTotal; }) || 14,
    blowPerRound: blowHoles / recent.length,
    blowCost: blowHoles ? blowExtra / blowHoles : 1
  };
}

function wifSaved(p, v) {
  var perGir = (typeof SG_PER_GIR !== 'undefined') ? SG_PER_GIR : 0.55;
  var perFir = (typeof SG_PER_FAIRWAY !== 'undefined') ? SG_PER_FAIRWAY : 0.28;
  return {
    putts: v.putts,
    gir: v.gir * perGir,
    fir: v.fir * perFir,
    blow: v.blow * p.blowCost
  };
}

/* Bornes : on ne gagne pas plus de putts qu'on n'en joue au-delà de 18, etc. */
function wifMax(p, key) {
  if (key === 'putts') return p.putts != null ? Math.max(0, Math.min(8, Math.floor(p.putts - 22))) : 6;
  if (key === 'gir') return p.gir != null ? Math.max(0, Math.min(8, Math.floor(18 - p.gir))) : 6;
  if (key === 'fir') return p.fir != null ? Math.max(0, Math.min(8, Math.floor(p.firTotal - p.fir))) : 6;
  return Math.max(0, Math.min(8, Math.round(p.blowPerRound)));
}

/* Objectif réaliste : les écarts avec les repères d'un joueur 5 points meilleur,
   ajustés pour valoir environ 5 points d'index (sinon on double-compte). */
function wifRealistic(p) {
  var ref = p.index != null ? p.index : 36;
  var b = (typeof sgBaseline === 'function') ? sgBaseline(Math.max(0, ref - 5)) : null;
  var v = { putts: 0, gir: 0, fir: 0, blow: 0 };
  if (b) {
    if (p.putts != null) v.putts = Math.max(0, Math.round(p.putts - b.putts));
    if (p.gir != null) v.gir = Math.max(0, Math.round(b.gir * 18 - p.gir));
    if (p.fir != null) v.fir = Math.max(0, Math.round(b.fir * p.firTotal - p.fir));
  }
  WIF_LEVERS.forEach(function(l) { v[l.key] = Math.min(v[l.key], wifMax(p, l.key)); });
  var target = Math.min(5, ref) * p.slope / 113;
  function total() { var s = wifSaved(p, v); return s.putts + s.gir + s.fir + s.blow; }
  var guard = 40;
  while (total() > target * 1.1 && guard--) {
    var s = wifSaved(p, v), top = null;
    ['putts', 'gir', 'fir'].forEach(function(k) { if (v[k] > 0 && (!top || s[k] > s[top])) top = k; });
    if (!top) break;
    v[top]--;
  }
  while (total() < target * 0.9 && v.blow < wifMax(p, 'blow') && guard--) v.blow++;
  return v;
}

function wifRenderCard() {
  var p = wifProfile();
  var card = document.createElement('div');
  card.className = 'an-card wif-card';
  if (!p.enough) {
    card.innerHTML = '<div class="an-card-header"><div class="an-card-title">🔮 Et si… ?</div></div>'
      + '<div class="an-card-body"><div class="hh-empty">Enregistre <strong>' + (3 - p.have) + ' carte' + (3 - p.have > 1 ? 's' : '') + ' 18 trous</strong> de plus pour simuler ce que vaudraient 2 putts de moins ou un green de plus sur ton score et ton index.</div></div>';
    return card;
  }
  WIF_LEVERS.forEach(function(l) { _wif[l.key] = Math.min(_wif[l.key], wifMax(p, l.key)); });

  function now(key) {
    if (key === 'putts') return p.putts != null ? 'Aujourd\'hui : ' + insNum(p.putts) + ' putts' : 'Putts non saisis';
    if (key === 'gir') return p.gir != null ? 'Aujourd\'hui : ' + insNum(p.gir) + ' sur 18' : 'Greens non saisis';
    if (key === 'fir') return p.fir != null ? 'Aujourd\'hui : ' + insNum(p.fir) + ' sur ' + Math.round(p.firTotal) : 'Fairways non saisis';
    return 'Aujourd\'hui : ' + insNum(p.blowPerRound) + ' par tour (double bogey ou pire)';
  }

  function render() {
    var s = wifSaved(p, _wif);
    var total = s.putts + s.gir + s.fir + s.blow;
    var newScore = p.score - total;
    var k = 113 / p.slope;
    var newIdx = p.index != null ? Math.max(-5, p.index - total * k) : null;
    var best = WIF_LEVERS.map(function(l) { return { l: l, v: s[l.key] }; }).sort(function(a, b) { return b.v - a.v; })[0];

    var rows = WIF_LEVERS.map(function(l) {
      var mx = wifMax(p, l.key);
      return '<div class="wif-row' + (mx ? '' : ' is-off') + '">'
        + '<div class="wif-l"><span class="wif-ico">' + l.ico + '</span><div><div class="wif-lt">' + l.label + '</div><div class="wif-ls">' + now(l.key) + '</div></div></div>'
        + '<div class="wif-step"><button type="button" data-wif="' + l.key + '" data-d="-1" aria-label="Moins"' + (_wif[l.key] <= 0 ? ' disabled' : '') + '>−</button>'
        +   '<span>' + _wif[l.key] + '</span>'
        +   '<button type="button" data-wif="' + l.key + '" data-d="1" aria-label="Plus"' + (_wif[l.key] >= mx ? ' disabled' : '') + '>+</button></div>'
        + '<div class="wif-gain">' + (s[l.key] ? '−' + insFmt(s[l.key]) : '') + '</div>'
        + '</div>';
    }).join('');

    var result;
    if (total < 0.05) {
      result = '<div class="wif-res wif-res-idle">Joue avec les leviers pour voir l\'effet sur ton score' + (p.index != null ? ' et ton index' : '') + '.</div>';
    } else {
      result = '<div class="wif-res"><div class="wif-big"><div><small>Score moyen</small><b>' + Math.round(p.score) + ' → ' + Math.round(newScore) + '</b></div>'
        + (newIdx != null ? '<div><small>Index</small><b>' + insFmt(p.index) + ' → ' + insFmt(newIdx) + '</b></div>' : '')
        + '<div><small>Gagné</small><b>' + insFmt(total) + ' coup' + (total >= 2 ? 's' : '') + '</b></div></div>'
        + (best && best.v > 0 && WIF_LEVERS.filter(function(l) { return _wif[l.key]; }).length > 1 ? '<div class="wif-best">Ce qui pèse le plus dans ta sélection : <strong>' + best.l.label.toLowerCase() + '</strong>.</div>' : '')
        + '</div>';
    }

    card.innerHTML = '<div class="an-card-header"><div class="an-card-title">🔮 Et si… ?</div>'
      + '<div class="an-card-sub">Ce que vaudraient quelques progrès sur tes ' + p.n + ' dernières cartes 18 trous</div></div>'
      + '<div class="an-card-body">' + rows + result
      +   '<div class="wif-actions"><button type="button" class="dash-btn dash-btn-gold" data-wif-real>🎯 Objectif réaliste</button>'
      +     '<button type="button" class="dash-btn dash-btn-outline" data-wif-reset>Remettre à zéro</button></div>'
      +   '<div class="wif-note">Estimation : un green en plus vaut en moyenne ' + insFmt((typeof SG_PER_GIR !== 'undefined') ? SG_PER_GIR : 0.55, 2) + ' coup, un fairway ' + insFmt((typeof SG_PER_FAIRWAY !== 'undefined') ? SG_PER_FAIRWAY : 0.28, 2)
      +     ', un trou raté te coûte ' + insFmt(p.blowCost) + ' coup' + (p.blowCost >= 2 ? 's' : '') + ' de plus qu\'un bogey sur tes cartes. L\'index suppose un progrès régulier sur toutes tes parties.'
      +     ' « Objectif réaliste » = environ 5 points d\'index de mieux, d\'après les repères d\'un joueur d\'index ' + insFmt(Math.max(0, (p.index != null ? p.index : 36) - 5)) + '.</div>'
      + '</div>';
  }

  card.addEventListener('click', function(e) {
    var b = e.target.closest('[data-wif],[data-wif-real],[data-wif-reset]');
    if (!b || b.disabled) return;
    if (b.hasAttribute('data-wif-real')) _wif = wifRealistic(p);
    else if (b.hasAttribute('data-wif-reset')) _wif = { putts: 0, gir: 0, fir: 0, blow: 0 };
    else {
      var key = b.getAttribute('data-wif');
      _wif[key] = Math.max(0, Math.min(wifMax(p, key), _wif[key] + parseInt(b.getAttribute('data-d'), 10)));
    }
    render();
  });
  render();
  return card;
}
