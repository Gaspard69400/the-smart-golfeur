/* ════════════════════════════════════════════
 * THE SMART GOLFER — gameplan.js
 * GAME PLAN PAR TROU — le vrai « Smart ».
 *
 * « Sur ce trou tu perds 1,2 coup de plus que ton handicap : joue la sécurité. »
 *
 * Données utilisées, et seulement celles-là : tes SCORES TROU PAR TROU sur ce
 * parcours. (Putts et fairways ne sont enregistrés qu'en total de partie : on
 * ne fabrique pas de statistique par trou qui n'existe pas.)
 *
 * Mesure clé — coût par rapport à ton niveau :
 *   coût = (score moyen − par) − coups que ton handicap te rend sur ce trou
 *   > 0 : le trou te coûte plus que ton handicap ne le prévoit (« trou noir »)
 *   < 0 : tu y joues mieux que ton handicap (« trou fort »)
 *
 * La stratégie s'appuie sur des principes de gestion de parcours éprouvés
 * (éviter les gros scores, viser le centre du green, jouer les par 5 en 3
 * quand ils coûtent cher) et sur ton secteur Strokes Gained le plus faible.
 *
 * Dépend de : formats.js (courseHandicap, strokesOnHole), tees.js (getCourseTees,
 *   teeRecall), strokesgained.js (sgRefHcp), traininglib.js (trnWeakSectors).
 * ════════════════════════════════════════════ */

var GP_MIN_ROUNDS = 2;

/* Handicap de jeu sur ce parcours, avec le départ habituellement joué */
function gpCourseHcp(course) {
  var idx = (typeof sgRefHcp === 'function') ? sgRefHcp() : 18;
  var tees = (typeof getCourseTees === 'function') ? getCourseTees(course) : [];
  var teeId = (typeof teeRecall === 'function') ? teeRecall(course.id) : null;
  var tee = null;
  for (var i = 0; i < tees.length; i++) { if (tees[i].id === teeId) tee = tees[i]; }
  if (!tee) tee = tees[0] || null;
  var rating = (tee && tee.rating) || course.rating;
  var slope  = (tee && tee.slope)  || course.slope;
  var ch = (typeof courseHandicap === 'function') ? courseHandicap(idx, slope, rating, course.par_total, (course.trous || []).length) : idx;
  return { index: idx, ch: ch, tee: tee };
}

/* Statistiques de chaque trou, depuis les parties jouées sur ce parcours
   (toutes, ou seulement `onlyRounds` : la carte de chaleur suit la période d'Analyse) */
function gpCourseStats(course, onlyRounds) {
  var rounds = (onlyRounds || lsGet('rounds') || []).filter(function(r) {
    return r.courseId === course.id && Array.isArray(r.scores);
  });
  var hc = gpCourseHcp(course);

  return course.trous.map(function(h, i) {
    var vals = [];
    rounds.forEach(function(r) {
      var v = r.scores[i];
      if (v !== null && v !== undefined && !isNaN(v)) vals.push(Number(v));
    });
    var n = vals.length;
    var strokes = (typeof strokesOnHole === 'function') ? strokesOnHole(hc.ch, h.si) : 0;
    if (!n) return { hole: h, n: 0, strokes: strokes };

    var sum = vals.reduce(function(a, b) { return a + b; }, 0);
    var avg = sum / n;
    var dist = { eagle: 0, birdie: 0, par: 0, bogey: 0, double: 0 };
    vals.forEach(function(v) {
      var d = v - h.par;
      if (d <= -2) dist.eagle++;
      else if (d === -1) dist.birdie++;
      else if (d === 0) dist.par++;
      else if (d === 1) dist.bogey++;
      else dist.double++;
    });
    return {
      hole: h, n: n, strokes: strokes,
      avg: Math.round(avg * 100) / 100,
      overPar: Math.round((avg - h.par) * 100) / 100,
      cost: Math.round((avg - h.par - strokes) * 100) / 100,
      dist: dist,
      blowRate: dist.double / n,
      goodRate: (dist.eagle + dist.birdie + dist.par) / n
    };
  });
}

/* ── Le conseil d'un trou : un constat personnel + une stratégie ── */
function gpAdvice(st, weakKey) {
  var h = st.hole;
  var personal = null, strategy = null, tone = 'neutral';

  if (st.n >= GP_MIN_ROUNDS) {
    if (st.cost >= 0.8) {
      tone = 'black';
      personal = 'Trou noir : tu y perds ' + gpFmt(st.cost) + ' coup' + (st.cost >= 2 ? 's' : '') + ' de plus que ton handicap.';
    } else if (st.cost <= -0.3) {
      tone = 'strong';
      personal = 'Ton trou fort : ' + gpFmt(-st.cost) + ' coup' + (-st.cost >= 2 ? 's' : '') + ' de mieux que ton handicap.';
    } else {
      personal = 'Dans ta moyenne sur ce trou.';
    }
  }

  var enoughData = st.n >= GP_MIN_ROUNDS;

  if (enoughData && st.blowRate >= 0.34) {
    strategy = 'Tes doubles bogeys viennent souvent d\'ici : joue la sécurité, vise le centre du green et accepte le bogey.';
    tone = 'black';
  } else if (h.par === 5 && enoughData && st.cost >= 0.5) {
    strategy = 'Joue-le en 3 coups : pose ta 2e à une distance de wedge que tu maîtrises plutôt que de forcer.';
  } else if (h.par === 5 && enoughData && st.cost <= 0) {
    strategy = 'Trou à birdie pour toi : c\'est ici qu\'il faut être agressif.';
    tone = 'strong';
  } else if (h.par === 3 && h.longueur >= 170) {
    strategy = 'Par 3 long : vise le côté le plus large du green, pas le drapeau. Le par est un très bon score.';
  } else if (h.par === 4 && h.longueur && h.longueur <= 320) {
    strategy = 'Par 4 court : le driver n\'est pas obligatoire — un fer ou un hybride te laisse un wedge plein, bien plus fiable.';
  } else if (h.par === 4 && h.longueur >= 400 && h.si <= 6) {
    strategy = 'L\'un des trous les plus durs du parcours : vise le green en 3 si besoin, un bogey propre vaut mieux qu\'un pari raté.';
  } else if (weakKey === 'Drive' && h.par >= 4) {
    strategy = 'Au départ, privilégie la précision : bois 3 ou hybride si le fairway est étroit.';
  } else if (weakKey === 'Putting') {
    strategy = 'Vise le centre du green : un putt de 6 m à plat vaut mieux qu\'un putt court en dévers.';
  } else if (weakKey === 'Approche') {
    strategy = 'Sur ton approche, vise le centre du green plutôt que le drapeau : c\'est là que se gagnent tes greens en régulation.';
  } else if (weakKey === 'Jeu court') {
    strategy = 'Si tu rates le green, rate-le du côté où il reste le plus de place pour ton chip.';
  } else {
    strategy = 'Joue ton coup habituel et vise le centre du green.';
  }

  return { tone: tone, personal: personal, strategy: strategy, data: enoughData };
}

/* Arrondi SYMÉTRIQUE à 1 décimale : Math.round(-17.5) = -17 mais Math.round(17.5) = 18,
   ce qui affichait −1,7 dans une pastille et 1,8 dans le texte pour la même valeur. */
function gpFmt(x) {
  var r = (x < 0 ? -1 : 1) * Math.round(Math.abs(x) * 10) / 10;
  return r.toFixed(1).replace('.', ',');
}

/* ── Vue « Mon plan de jeu » d'un parcours ── */
function gpOpenCourse(course) {
  if (!course) return;
  var ex = document.getElementById('gp-modal');
  if (ex) ex.remove();

  var stats = gpCourseStats(course);
  var hc = gpCourseHcp(course);
  var sectors = (typeof trnWeakSectors === 'function') ? trnWeakSectors() : null;
  var weak = sectors ? sectors[0].key : null;
  var maxN = stats.reduce(function(a, s) { return Math.max(a, s.n || 0); }, 0);
  var hasData = maxN >= GP_MIN_ROUNDS;

  // Synthèse : les 3 trous noirs et les 3 trous forts
  var ranked = stats.filter(function(s) { return s.n >= GP_MIN_ROUNDS; }).slice().sort(function(a, b) { return b.cost - a.cost; });
  var black = ranked.filter(function(s) { return s.cost >= 0.8; }).slice(0, 3);
  var strong = ranked.slice().reverse().filter(function(s) { return s.cost <= -0.3; }).slice(0, 3);
  var totalCost = ranked.reduce(function(a, s) { return a + Math.max(0, s.cost); }, 0);

  var summary;
  if (!hasData) {
    summary = '<div class="gp-nodata">📋 Joue au moins <strong>' + GP_MIN_ROUNDS + ' cartes complètes</strong> sur ce parcours pour débloquer ton plan personnel. '
      + 'En attendant, voici les conseils de stratégie trou par trou.</div>';
  } else {
    summary = '<div class="gp-summary">'
      + '<div class="gp-sum-block"><div class="gp-sum-t">⚫ Tes trous noirs</div>'
      +   (black.length ? black.map(function(s) { return '<span class="gp-pill black">Trou ' + s.hole.num + ' · +' + gpFmt(s.cost) + '</span>'; }).join('')
                        : '<span class="gp-none">Aucun — joli !</span>') + '</div>'
      + '<div class="gp-sum-block"><div class="gp-sum-t">🟢 Tes trous forts</div>'
      +   (strong.length ? strong.map(function(s) { return '<span class="gp-pill strong">Trou ' + s.hole.num + ' · ' + gpFmt(s.cost) + '</span>'; }).join('')
                         : '<span class="gp-none">Pas encore</span>') + '</div>'
      + '</div>'
      + (totalCost >= 1
          ? '<div class="gp-potential">💡 Sur les trous où tu dépasses ton handicap, tu perds <strong>' + gpFmt(totalCost) + ' coups</strong> par partie. C\'est ta marge de progression la plus directe sur ce parcours.</div>'
          : '');
  }

  var cards = stats.map(function(s, si) {
    var h = s.hole;
    var adv = gpAdvice(s, weak);
    var statLine = '';
    var bar = '';
    if (s.n) {
      statLine = '<div class="gp-h-stats"><span>Moyenne <strong>' + gpFmt(s.avg) + '</strong></span>'
        + '<span>' + (s.strokes ? (s.strokes > 0 ? '+' : '') + s.strokes + ' coup' + (Math.abs(s.strokes) > 1 ? 's' : '') + ' rendu' + (Math.abs(s.strokes) > 1 ? 's' : '') : '0 coup rendu') + '</span>'
        + '<span>' + s.n + ' carte' + (s.n > 1 ? 's' : '') + '</span></div>';
      var seg = function(k, cls) { var w = Math.round(100 * s.dist[k] / s.n); return w ? '<i class="' + cls + '" style="width:' + w + '%" title="' + k + ' : ' + s.dist[k] + '"></i>' : ''; };
      bar = '<div class="gp-dist">' + seg('eagle', 'd-eagle') + seg('birdie', 'd-birdie') + seg('par', 'd-par') + seg('bogey', 'd-bogey') + seg('double', 'd-double') + '</div>';
    }
    return '<div class="gp-hole tone-' + adv.tone + '">'
      + '<div class="gp-h-head"><div class="gp-h-num">' + h.num + '</div>'
      +   '<div class="gp-h-meta">Par ' + h.par + ' · ' + (h.longueur || '—') + ' m · SI ' + (h.si || '—') + '</div>'
      +   (s.n >= GP_MIN_ROUNDS ? '<div class="gp-h-cost">' + (s.cost > 0 ? '+' : '') + gpFmt(s.cost) + '</div>' : '')
      + '</div>'
      + statLine + bar
      + (adv.personal ? '<div class="gp-h-personal">' + gpEsc(adv.personal) + '</div>' : '')
      + '<div class="gp-h-strategy">' + gpEsc(adv.strategy) + '</div>'
      + ((typeof hnSlotHtml === 'function') ? hnSlotHtml(course, si, true) : '')
      + '</div>';
  }).join('');

  var m = document.createElement('div');
  m.id = 'gp-modal';
  m.className = 'gp-modal';
  m.innerHTML = '<div class="gp-card">'
    + '<div class="gp-head"><div><div class="gp-tag">Plan de jeu</div>'
    +   '<div class="gp-title">' + gpEsc(course.name) + '</div>'
    +   '<div class="gp-sub">Index ' + (hc.index !== null && hc.index !== undefined ? gpFmt(hc.index) : '—')
    +   ' · handicap de jeu ' + (hc.ch !== null && hc.ch !== undefined ? Math.round(hc.ch) : '—')
    +   (hc.tee ? ' · départ ' + gpEsc(hc.tee.name) : '')
    +   (hasData ? ' · d\'après tes ' + maxN + ' cartes' : '') + '</div></div>'
    +   '<button class="gp-close" id="gp-close">×</button></div>'
    + '<div class="gp-body">' + summary
    +   '<div class="gp-legend">Le chiffre à droite de chaque trou = coups perdus (+) ou gagnés (−) <strong>par rapport à ton handicap</strong>.</div>'
    +   '<div class="gp-grid">' + cards + '</div>'
    + '</div></div>';
  document.body.appendChild(m);

  function close() { m.remove(); }
  document.getElementById('gp-close').addEventListener('click', close);
  m.addEventListener('click', function(e) { if (e.target === m) close(); });
}

/* ── Conseil compact pour la saisie express (pendant la partie) ── */
function gpHoleTipHtml(course, idx) {
  if (!course || !course.trous || !course.trous[idx]) return '';
  var stats = gpCourseStats(course);
  var s = stats[idx];
  var sectors = (typeof trnWeakSectors === 'function') ? trnWeakSectors() : null;
  var adv = gpAdvice(s, sectors ? sectors[0].key : null);
  var ico = adv.tone === 'black' ? '⚫' : (adv.tone === 'strong' ? '🟢' : '🧭');
  return '<div class="gp-tip tone-' + adv.tone + '">'
    + '<span class="gp-tip-ico">' + ico + '</span>'
    + '<div class="gp-tip-txt">' + (adv.personal ? '<strong>' + gpEsc(adv.personal) + '</strong> ' : '') + gpEsc(adv.strategy) + '</div>'
    + '</div>';
}

function gpEsc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
