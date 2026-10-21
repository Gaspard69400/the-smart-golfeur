/* ════════════════════════════════════════════
 * THE SMART GOLFER — dashboard.js
 * Page Dashboard : KPIs, graphiques, modale d'évolution
 * Dépend de : data.js, app.js
 * ════════════════════════════════════════════ */

/* ─── PAGE DASHBOARD (placeholder jusqu'à la Session 2) ─── */



/* Chart registry */
var _dashCharts = {};
function _destroyDashCharts() {
  // Méthode la plus robuste : détruire TOUTES les instances Chart.js existantes
  // (peu importe à quel canvas elles sont attachées)
  if (typeof Chart !== 'undefined') {
    // Chart.js v4 garde les instances dans Chart.instances (objet)
    if (Chart.instances) {
      Object.keys(Chart.instances).forEach(function(key) {
        try { Chart.instances[key].destroy(); } catch(ex) {}
      });
    }
    // Fallback : itérer les canvas connus et détruire via getChart
    if (Chart.getChart) {
      ['dash-score-chart', 'dash-hcp-chart'].forEach(function(id) {
        var canvas = document.getElementById(id);
        if (canvas) {
          var existing = Chart.getChart(canvas);
          if (existing) { try { existing.destroy(); } catch(e) {} }
        }
      });
    }
  }
  // Vider notre registry locale
  Object.keys(_dashCharts).forEach(function(k) { delete _dashCharts[k]; });
}
function initDashboard() {
  var pg = document.getElementById('page-dashboard');
  if (!pg) return;
  _destroyDashCharts();
  pg.innerHTML = '';
  try { buildDashboard(pg); } catch(ex) { console.warn('Dashboard:', ex.message); }
}

/* ════════════════════════════════════════════
   OBJECTIFS DE SAISON — modifiables à tout moment (par utilisateur)
════════════════════════════════════════════ */
var DEFAULT_OBJECTIVES = { score: 80, hcp: 11, gir: 50, fir: 60, putts: 32 };   // repli seulement (aucun index connu)

/* Objectifs PROPOSÉS selon le niveau (S83). Avant, tout le monde avait 80 / 11 / 50 % / 60 % / 32,
   quel que soit son niveau : un joueur à −0,7 voyait « Handicap −0,7 → 11 : atteint ». Désormais
   la cible = le niveau juste au-dessus du sien (index − 1 à − 5 selon le niveau), et les stats
   visées = celles d'un joueur de cet index (barèmes SG_BENCHMARKS, prolongés sous le scratch). */
function objIndexNow() {
  var idx = null;
  try { if (typeof calcHandicapFromRounds === 'function') idx = calcHandicapFromRounds(); } catch (e) {}
  if ((idx === null || idx === undefined) && currentUser && currentUser.hcp != null) idx = Number(currentUser.hcp);
  if ((idx === null || idx === undefined || isNaN(idx)) && typeof bgnDefaultIndex === 'function') { try { idx = bgnDefaultIndex(); } catch (e) {} }
  return (idx === null || idx === undefined || isNaN(idx)) ? null : Number(idx);
}

function objBaseline(h) {
  if (typeof sgBaseline !== 'function') return null;
  if (h >= 0) return sgBaseline(h);
  // Sous le scratch : on prolonge la tendance 0 → 5 (un point d'index ≈ 1 coup, +1 % de fairways, +2,8 % de greens, −0,2 putt)
  var a = sgBaseline(0), b = sgBaseline(5), k = h / 5;
  return { score: a.score + (b.score - a.score) * k, fir: a.fir + (b.fir - a.fir) * k, gir: a.gir + (b.gir - a.gir) * k, putts: a.putts + (b.putts - a.putts) * k };
}

function suggestedObjectives() {
  var idx = objIndexNow();
  if (idx === null) return { score: DEFAULT_OBJECTIVES.score, hcp: DEFAULT_OBJECTIVES.hcp, gir: DEFAULT_OBJECTIVES.gir, fir: DEFAULT_OBJECTIVES.fir, putts: DEFAULT_OBJECTIVES.putts };
  var step = idx <= 5 ? 1 : (idx <= 15 ? 2 : (idx <= 30 ? 3 : 5));
  var target = Math.max(-6, Math.round((idx - step) * 10) / 10);
  var b = objBaseline(target);
  if (!b) return { score: DEFAULT_OBJECTIVES.score, hcp: target, gir: DEFAULT_OBJECTIVES.gir, fir: DEFAULT_OBJECTIVES.fir, putts: DEFAULT_OBJECTIVES.putts };
  return {
    // Score MOYEN visé sur un par 72 : l'index ne garde que les meilleures cartes, une carte
    // moyenne est ≈ 2,5 coups au-dessus (−1,7 → 72,8 ; 8 → 82,5 ; 27 → 101,5)
    score: Math.round((72 + target + 2.5) * 10) / 10,
    hcp:   target,
    gir:   Math.min(95, Math.round(b.gir * 100)),
    fir:   Math.min(95, Math.round(b.fir * 100)),
    putts: Math.round(b.putts * 10) / 10
  };
}

/* true si le joueur n'a jamais fixé ses objectifs (on affiche alors les objectifs proposés) */
function objectivesAreSuggested() {
  var all = lsGet('objectives') || {};
  var uid = (currentUser && currentUser.id) || 'default';
  var o = all[uid];
  return !o || ['score', 'hcp', 'gir', 'fir', 'putts'].every(function(k) { return o[k] == null; });
}

function getObjectives() {
  var all = lsGet('objectives') || {};
  var uid = (currentUser && currentUser.id) || 'default';
  var o = all[uid] || {};
  var d = suggestedObjectives();
  return {
    score: (o.score != null ? o.score : d.score),
    hcp:   (o.hcp   != null ? o.hcp   : d.hcp),
    gir:   (o.gir   != null ? o.gir   : d.gir),
    fir:   (o.fir   != null ? o.fir   : d.fir),
    putts: (o.putts != null ? o.putts : d.putts)
  };
}

function saveObjectives(obj) {
  var all = lsGet('objectives') || {};
  var uid = (currentUser && currentUser.id) || 'default';
  all[uid] = obj;
  lsSet('objectives', all);
  if (window.tsgSync) window.tsgSync.pushObjectives(obj);
}

function openObjectivesModal() {
  var existing = document.getElementById('obj-modal');
  if (existing) existing.remove();

  var o = getObjectives();
  var fields = [
    { key: 'score', label: 'Score moyen visé',   step: '0.1', hint: 'plus bas = mieux' },
    { key: 'hcp',   label: 'Handicap visé',       step: '0.1', hint: 'plus bas = mieux' },
    { key: 'gir',   label: 'GIR visé (%)',        step: '1',   hint: 'plus haut = mieux' },
    { key: 'fir',   label: 'FIR visé (%)',        step: '1',   hint: 'plus haut = mieux' },
    { key: 'putts', label: 'Putts / tour visés',  step: '0.1', hint: 'plus bas = mieux' }
  ];

  var modal = document.createElement('div');
  modal.id = 'obj-modal';
  modal.className = 'obj-modal';

  var rows = fields.map(function(f) {
    return '<div class="obj-field">'
      + '<label class="obj-label">' + f.label + ' <span class="obj-hint">· ' + f.hint + '</span></label>'
      + '<input type="number" step="' + f.step + '" class="obj-input" data-obj="' + f.key + '" value="' + o[f.key] + '">'
      + '</div>';
  }).join('');

  modal.innerHTML = ''
    + '<div class="obj-card">'
    +   '<div class="obj-header">'
    +     '<div>'
    +       '<div class="obj-title-tag">Saison ' + new Date().getFullYear() + '</div>'
    +       '<div class="obj-title">Mes objectifs</div>'
    +     '</div>'
    +     '<button class="obj-close" id="obj-close-btn">×</button>'
    +   '</div>'
    +   '<div class="obj-body">'
    +     '<div class="obj-intro">Fixe tes cibles. Tu peux les modifier à tout moment — les jauges du dashboard s\'adaptent automatiquement. « Proposer pour mon niveau » remet des cibles calculées pour l\'index juste au-dessus du tien.</div>'
    +     rows
    +   '</div>'
    +   '<div class="obj-actions">'
    +     '<button class="dash-btn dash-btn-outline" id="obj-reset-btn">Proposer pour mon niveau</button>'
    +     '<button class="dash-btn dash-btn-gold" id="obj-save-btn">Enregistrer</button>'
    +   '</div>'
    + '</div>';

  document.body.appendChild(modal);

  function close() { modal.remove(); }
  document.getElementById('obj-close-btn').addEventListener('click', close);
  modal.addEventListener('click', function(ev) { if (ev.target === modal) close(); });

  document.getElementById('obj-reset-btn').addEventListener('click', function() {
    var sug = suggestedObjectives();
    modal.querySelectorAll('.obj-input').forEach(function(inp) {
      inp.value = sug[inp.getAttribute('data-obj')];
    });
  });

  document.getElementById('obj-save-btn').addEventListener('click', function() {
    var newObj = {};
    modal.querySelectorAll('.obj-input').forEach(function(inp) {
      var k = inp.getAttribute('data-obj');
      var v = parseFloat(inp.value);
      newObj[k] = isNaN(v) ? suggestedObjectives()[k] : v;
    });
    saveObjectives(newObj);
    close();
    if (typeof showToast === 'function') showToast('Objectifs mis à jour ✓');
    initDashboard();
  });
}

/* ── Tuiles d'accueil (S73) ──
   Reprend la maquette validée : grande tuile verte de l'index (courbe des
   derniers différentiels), puis 4 tuiles — dernière partie, greens en
   régulation, priorité (secteur Strokes Gained le plus faible) et amis. */
function dashHeroTiles(o) {
  function esc(x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function(c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fr(n, d) { return (n === null || n === undefined || isNaN(n)) ? '—' : Number(n).toFixed(d).replace('.', ','); }

  // Index + courbe (différentiels, plus bas = mieux → la courbe descend quand on progresse)
  var idx = parseFloat(o.hcp);
  var diffs = o.data.map(function(r) { return (r.diff !== undefined && r.diff !== null) ? +r.diff : null; }).filter(function(v) { return v !== null && !isNaN(v); });
  var spark = '';
  if (diffs.length >= 3) {
    var mn = Math.min.apply(null, diffs), mx = Math.max.apply(null, diffs), rg = (mx - mn) || 1;
    var pts = diffs.map(function(v, i) { return (2 + i * (116 / (diffs.length - 1))).toFixed(1) + ',' + (40 - (v - mn) / rg * 34).toFixed(1); });
    var last = pts[pts.length - 1].split(',');
    spark = '<svg class="dh-spark" viewBox="0 0 120 46" aria-hidden="true"><polyline points="' + pts.join(' ') + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="' + last[0] + '" cy="' + last[1] + '" r="3.5" fill="currentColor"/></svg>';
  }
  var trendTxt = '';
  if (diffs.length >= 6) {
    var a = diffs.slice(-3).reduce(function(x, y) { return x + y; }, 0) / 3;
    var b = diffs.slice(-6, -3).reduce(function(x, y) { return x + y; }, 0) / 3;
    var d = a - b;
    trendTxt = Math.abs(d) < 0.3 ? 'Stable sur tes dernières cartes' : (d < 0 ? 'En progrès : ' + fr(-d, 1) + ' de mieux' : 'En recul : ' + fr(d, 1) + ' de plus');
  } else trendTxt = o.hasReal ? 'Joue quelques cartes pour voir ta courbe' : 'Exemple de démonstration';

  // Dernière partie
  var lastR = o.hasReal ? o.rounds[0] : o.data[o.data.length - 1];
  var lastScore = lastR && lastR.score ? lastR.score : '—';
  var lastSub = o.hasReal ? esc((lastR.course || lastR.courseName || 'Parcours').toString().slice(0, 26)) : 'Exemple';

  // Greens en régulation (anneau)
  var gir = Math.max(0, Math.min(100, parseInt(o.avgGIR, 10) || 0));
  var circ = 2 * Math.PI * 26;
  var ring = '<svg class="dh-ring" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="26" class="dh-ring-bg"/><circle cx="32" cy="32" r="26" class="dh-ring-fg" stroke-dasharray="' + (circ * gir / 100).toFixed(1) + ' ' + circ.toFixed(1) + '" transform="rotate(-90 32 32)"/></svg>';

  // Priorité = secteur le plus faible
  var NAMES = { sg_tee: 'Mise en jeu', sg_app: 'Approches', sg_arg: 'Petit jeu', sg_putt: 'Putting' };
  var weak = null;
  Object.keys(NAMES).forEach(function(k) { if (!isNaN(o.sg[k]) && (weak === null || o.sg[k] < o.sg[weak])) weak = k; });
  var prioT = weak ? NAMES[weak] : 'Ton programme';
  var prioS = weak && o.sg[weak] < 0 ? fr(-o.sg[weak], 1) + ' coup perdu par partie' : 'Exercices du jour';

  var cloud = typeof frdCloud === 'function' && frdCloud();

  var el = document.createElement('div');
  el.className = 'dh-grid';
  el.innerHTML = ''
    + '<button type="button" class="dh-tile dh-index" data-dh="whs">'
    +   '<span class="dh-index-l"><span class="dh-cap">Ton index</span><span class="dh-big">' + fr(idx, 1) + '</span></span>'
    +   '<span class="dh-index-r">' + spark + '<span class="dh-trend">' + trendTxt + '</span></span>'
    + '</button>'
    + '<button type="button" class="dh-tile" data-dh="last"><span class="dh-cap2">Dernière partie</span><span class="dh-mid">' + esc(lastScore) + '</span><span class="dh-sub">' + lastSub + '</span></button>'
    + '<button type="button" class="dh-tile dh-row" data-dh="stats"><span class="dh-ring-w">' + ring + '<span class="dh-ring-v">' + gir + '%</span></span><span class="dh-col"><span class="dh-cap2">Greens</span><span class="dh-sub">en régulation</span></span></button>'
    + '<button type="button" class="dh-tile dh-gold" data-dh="train">'
    +   '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg>'
    +   '<span class="dh-prio">' + prioT + '</span><span class="dh-sub">Ta priorité · ' + prioS + '</span></button>'
    + '<button type="button" class="dh-tile" data-dh="friends"><span class="dh-cap2">Tes amis</span>'
    +   '<span class="dh-mid" data-dh-friends>' + (cloud ? '…' : '+') + '</span><span class="dh-sub">' + (cloud ? 'Voir le fil' : 'Invite tes amis') + '</span></button>';

  el.addEventListener('click', function(e) {
    var b = e.target.closest('[data-dh]');
    if (!b) return;
    var k = b.getAttribute('data-dh');
    if (k === 'whs' && typeof openWhsModal === 'function') openWhsModal();
    else if (k === 'last' || k === 'stats') showPage('analyse');
    else if (k === 'train') showPage('training');
    else if (k === 'friends') {
      if (cloud) showPage('community');
      else if (typeof insShareApp === 'function') insShareApp();
    }
  });

  if (cloud && typeof frdLoad === 'function') {
    var fEl = el.querySelector('[data-dh-friends]');
    frdLoad(function(list) {
      if (fEl) fEl.textContent = (list || []).filter(function(f) { return f.status === 'friends'; }).length;
    });
  }
  return el;
}

function buildDashboard(container) {
  // CRITIQUE : détruire les anciens graphiques Chart.js avant d'en créer de nouveaux
  // Sinon Chart.js refuse de réutiliser le canvas → graphiques absents
  if (typeof _destroyDashCharts === 'function') _destroyDashCharts();

  var u = currentUser || {};
  var firstName = u.name ? u.name.split(' ')[0] : 'Golfeur';

  /* ── Données : vraies parties ou démo ── */
  var rounds = lsGet('rounds') || [];
  var hasReal = rounds.length > 0;

  /* Données de démo si aucune partie saisie */
  var DEMO = [
    {score:88,gir:4,fir:7,putts:36,sg_tee:-0.4,sg_app:-0.2,sg_arg:-0.1,sg_putt:-0.3,diff:14.8},
    {score:86,gir:5,fir:8,putts:35,sg_tee:-0.3,sg_app:-0.1,sg_arg: 0.1,sg_putt:-0.2,diff:13.9},
    {score:85,gir:6,fir:9,putts:34,sg_tee:-0.2,sg_app: 0.1,sg_arg: 0.2,sg_putt:-0.1,diff:13.2},
    {score:84,gir:6,fir:9,putts:34,sg_tee:-0.1,sg_app: 0.2,sg_arg: 0.1,sg_putt: 0.0,diff:12.8},
    {score:87,gir:5,fir:8,putts:35,sg_tee:-0.3,sg_app:-0.1,sg_arg:-0.1,sg_putt:-0.2,diff:13.6},
    {score:83,gir:7,fir:10,putts:33,sg_tee: 0.1,sg_app: 0.3,sg_arg: 0.2,sg_putt: 0.1,diff:12.1},
    {score:82,gir:7,fir:10,putts:33,sg_tee: 0.2,sg_app: 0.4,sg_arg: 0.2,sg_putt: 0.1,diff:11.8},
    {score:84,gir:6,fir:9, putts:34,sg_tee: 0.0,sg_app: 0.2,sg_arg: 0.1,sg_putt: 0.0,diff:12.5},
    {score:81,gir:8,fir:11,putts:32,sg_tee: 0.3,sg_app: 0.5,sg_arg: 0.3,sg_putt: 0.2,diff:11.2},
    {score:80,gir:8,fir:11,putts:32,sg_tee: 0.4,sg_app: 0.5,sg_arg: 0.3,sg_putt: 0.2,diff:10.9},
    {score:82,gir:7,fir:10,putts:33,sg_tee: 0.2,sg_app: 0.3,sg_arg: 0.2,sg_putt: 0.1,diff:11.6},
    {score:79,gir:9,fir:12,putts:31,sg_tee: 0.5,sg_app: 0.6,sg_arg: 0.4,sg_putt: 0.3,diff:10.4}
  ];

  // rounds est trié du plus récent au plus ancien (unshift dans saveRound)
  // On prend les 12 premiers et on inverse pour avoir chronologique
  var data = hasReal ? rounds.slice(0, 12).reverse() : DEMO;
  var n = data.length;

  /* ── Calculs KPIs ── */
  function avg(arr, key) {
    var sum = 0, cnt = 0;
    arr.forEach(function(r) { if (r[key] !== undefined && r[key] !== null) { sum += r[key]; cnt++; } });
    return cnt ? sum / cnt : 0;
  }

  var avgScore  = avg(data, 'score').toFixed(1);
  var avgGIR    = (avg(data, 'gir') / 18 * 100).toFixed(0);
  var avgFIR    = (avg(data, 'fir') / 14 * 100).toFixed(0);
  var avgPutts  = avg(data, 'putts').toFixed(1);
  var hcp       = (typeof bgnDefaultIndex === 'function') ? bgnDefaultIndex() : (u.hcp !== null && u.hcp !== undefined ? u.hcp : 36);

  /* Strokes Gained */
  var sg_tee  = avg(data, 'sg_tee').toFixed(2);
  var sg_app  = avg(data, 'sg_app').toFixed(2);
  var sg_arg  = avg(data, 'sg_arg').toFixed(2);
  var sg_putt = avg(data, 'sg_putt').toFixed(2);

  /* Tendances (3 dernières vs 3 précédentes) */
  function trend(key) {
    if (data.length < 6) return 0;
    var last3 = data.slice(-3); var prev3 = data.slice(-6, -3);
    return avg(last3, key) - avg(prev3, key);
  }

  var tScore = trend('score');
  var tGIR   = trend('gir');

  /* Graphiques data */
  var scoreHistory = data.map(function(r) { return r.score; });
  var hcpHistory   = data.map(function(r, i) {
    return r.diff !== undefined ? r.diff : (parseFloat(hcp) + (n - i - 1) * 0.2).toFixed(1);
  });

  /* ── Démo messages ── */
  var MESSAGES = [
    { type:'public', channel:'Equipe', icon:'#', from:'Martin Dubois', text:'Super partie hier Thomas ! Continue comme ça.', time:'Il y a 2h', unread:true },
    { type:'private', channel:'Coach', icon:null, from:'Martin Dubois', av:'MD', color:'#EF9F27', bg:'rgba(239,159,39,0.15)', text:'Ton analyse de la semaine est prête. Regarde le secteur approche.', time:'Il y a 5h', unread:true },
    { type:'group', channel:'Comp. Régionale', icon:'@', from:'Sophie Laurent', text:'Rappel : départ samedi à 9h00, trou 1.', time:'Hier', unread:false }
  ];

  /* ══════════════════════════════════════
     CONSTRUCTION HTML avec createElement
     (pas de strings innerHTML cliquables)
  ══════════════════════════════════════ */
  var wrap = document.createElement('div');
  wrap.className = 'dash-wrap';

  /* ── 1. HEADER ── */
  var header = document.createElement('div');
  header.className = 'dash-header';

  var headerLeft = document.createElement('div');
  var greeting = document.createElement('div');
  greeting.className = 'dash-greeting';
  greeting.textContent = 'Bonjour, ' + firstName;
  // Titre de niveau à côté du prénom (visible aussi sur mobile, où la nav le masque)
  if (typeof commCurrentLevel === 'function' && (u.role === 'player' || u.role === 'captain' || !u.role)) {
    try {
      var cl = commCurrentLevel();
      var chipT = document.createElement('span');
      chipT.className = 'dash-title-chip';
      chipT.textContent = cl.level.title + ' \u00b7 Niv. ' + cl.level.level;
      chipT.title = cl.xp + ' XP';
      greeting.appendChild(chipT);
      if (typeof stkCompute === 'function') {
        var stkNow = stkCompute();
        if (stkNow.streak >= 2) {
          var chipS = document.createElement('span');
          chipS.className = 'dash-title-chip dash-streak-chip';
          chipS.textContent = '\ud83d\udd25 ' + stkNow.streak + ' j';
          chipS.title = 'Série de travail : ' + stkNow.streak + ' jours';
          greeting.appendChild(chipS);
        }
      }
    } catch (e) {}
  }
  var meta = document.createElement('div');
  meta.className = 'dash-meta';
  meta.textContent = 'Saison ' + new Date().getFullYear() + ' \u00b7 ' + n + (n > 1 ? ' parties ' : ' partie ') + (hasReal ? (n > 1 ? 'enregistr\u00e9es' : 'enregistr\u00e9e') : 'de d\u00e9mo');
  headerLeft.appendChild(greeting);
  headerLeft.appendChild(meta);

  var headerRight = document.createElement('div');
  headerRight.style.display = 'flex';
  headerRight.style.gap = '8px';

  var btnScorecard = document.createElement('button');
  btnScorecard.className = 'dash-btn dash-btn-outline';
  btnScorecard.textContent = '+ Nouvelle partie';
  btnScorecard.addEventListener('click', function() { if (typeof ecOpen === 'function') ecOpen(); else showPage('scorecard'); });

  var btnAnalyse = document.createElement('button');
  btnAnalyse.className = 'dash-btn dash-btn-gold';
  btnAnalyse.textContent = 'Voir l\'analyse \u2192';
  btnAnalyse.addEventListener('click', function() { showPage('analyse'); });

  headerRight.appendChild(btnScorecard);
  headerRight.appendChild(btnAnalyse);

  header.appendChild(headerLeft);
  header.appendChild(headerRight);
  wrap.appendChild(header);

  // Tuiles d'accueil (S73, maquette « Mix 1 ») : index, dernière partie, greens, priorité, amis
  // — juste sous l'en-tête, avant les bandeaux (installation, démo)
  var dhEl = null;
  try {
    wrap.insertBefore(dhEl = dashHeroTiles({
      hasReal: hasReal, rounds: rounds, data: data, hcp: hcp, avgGIR: avgGIR,
      sg: { sg_tee: +sg_tee, sg_app: +sg_app, sg_arg: +sg_arg, sg_putt: +sg_putt }
    }), header.nextSibling);
  } catch (e) { console.warn('[TSG] tuiles accueil:', e.message); }

  // Installer l'app sur le téléphone (install.js)
  if (typeof insRenderBanner === 'function') { try { insRenderBanner(wrap); } catch (e) {} }
  // Le bandeau d'installation se glisse sous l'en-tête : les tuiles restent au-dessus
  if (dhEl && header.nextSibling !== dhEl) wrap.insertBefore(dhEl, header.nextSibling);

  /* ── 2. BANNIÈRE DÉMO (si pas de vraies données) ── */
  if (!hasReal) {
    var banner = document.createElement('div');
    banner.className = 'demo-banner';
    banner.innerHTML = '<span class="demo-banner-icon">\u2139\uFE0F</span><span><strong>Donn\u00e9es de d\u00e9mo</strong> \u2014 Jouez une partie et saisissez-la dans la Scorecard pour voir vos vraies statistiques appara\u00eetre ici.</span>';
    wrap.appendChild(banner);
  }

  /* ── 3. KPIs PRINCIPAUX (5 cards) ── */
  var kpiData = [
    { label: 'Score moyen',       value: avgScore,        trend: tScore, worse: true,  key: 'score',  title: 'Évolution du score (20 dernières parties)' },
    { label: 'GIR',               value: avgGIR + '%',    trend: tGIR,   worse: false, key: 'gir',    title: 'Évolution du GIR % (20 dernières parties)' },
    { label: 'FIR',               value: avgFIR + '%',    trend: 0,      worse: false, key: 'fir',    title: 'Évolution du FIR % (20 dernières parties)' },
    { label: 'Putts / tour',      value: avgPutts,        trend: 0,      worse: true,  key: 'putts',  title: 'Évolution des putts/tour (20 dernières parties)' },
    { label: 'Handicap actuel',   value: hcp,             trend: 0,      worse: true,  key: 'diff',   title: 'Évolution du handicap (20 dernières parties)' }
  ];

  var kpiGrid = document.createElement('div');
  kpiGrid.className = 'dash-g5';

  kpiData.forEach(function(k) {
    var card = document.createElement('div');
    card.className = 'kpi-card kpi-clickable';
    card.style.cursor = 'pointer';
    card.title = 'Cliquez pour voir l\'évolution';
    card.addEventListener('click', function() {
      openKpiModal(k.key, k.label, k.title);
    });

    var lbl = document.createElement('div');
    lbl.className = 'kpi-label';
    lbl.textContent = k.label;

    var val = document.createElement('div');
    val.className = 'kpi-value';
    val.textContent = k.value;

    var trnd = document.createElement('div');
    trnd.className = 'kpi-trend';
    if (k.trend !== 0) {
      var good = k.worse ? k.trend < 0 : k.trend > 0;
      trnd.className += good ? ' trend-up' : ' trend-down';
      var arrow = k.trend > 0 ? '\u25b2 +' : '\u25bc ';
      trnd.textContent = arrow + Math.abs(k.trend).toFixed(1) + ' vs 3 parties préc.';
    } else {
      trnd.className += ' trend-flat';
      trnd.textContent = '\u2192 Stable';
    }

    card.appendChild(lbl);
    card.appendChild(val);
    card.appendChild(trnd);
    kpiGrid.appendChild(card);
  });

  wrap.appendChild(kpiGrid);

  /* ── 4. STROKES GAINED ── */
  var sgPanel = document.createElement('div');
  sgPanel.className = 'panel';

  var sgHeader = document.createElement('div');
  sgHeader.className = 'panel-header';
  var sgTitleWrap = document.createElement('div');
  sgTitleWrap.style.cssText = 'display:flex;align-items:center;gap:10px';
  var sgTitle = document.createElement('div');
  sgTitle.className = 'panel-title';
  sgTitle.textContent = 'Comparaison à ton niveau';
  var sgInfo = document.createElement('span');
  sgInfo.className = 'info-tip';
  sgInfo.textContent = '?';
  sgInfo.title = 'Le Strokes Gained (SG) compare ta performance à un joueur de ton niveau (handicap similaire). '
    + 'Une valeur POSITIVE (verte) signifie que tu joues MIEUX que ton niveau dans cette catégorie. '
    + 'Une valeur NEGATIVE (rouge) signifie que tu joues MOINS BIEN. '
    + 'Off the Tee : tes drives et bois. '
    + 'Approach : tes fers et approches. '
    + 'Around Green : ton chipping et wedge. '
    + 'Putting : tes putts sur le green. '
    + 'Cible donc en priorité la catégorie la plus négative pour progresser le plus vite.';
  sgTitleWrap.appendChild(sgTitle);
  sgTitleWrap.appendChild(sgInfo);
  var sgSub = document.createElement('div');
  sgSub.className = 'panel-sub';
  var sgRefTxt = 'ton niveau';
  try {
    if (hasReal && typeof sgRefHcp === 'function' && typeof sgReferenceLabel === 'function') {
      sgRefTxt = sgReferenceLabel(sgRefHcp());
    }
  } catch (e) {}
  sgSub.textContent = 'Comparé à ' + sgRefTxt + ' · vert = mieux · rouge = à travailler';
  sgHeader.appendChild(sgTitleWrap);
  sgHeader.appendChild(sgSub);
  sgPanel.appendChild(sgHeader);

  var sgBody = document.createElement('div');
  sgBody.className = 'panel-body';
  var sgGrid = document.createElement('div');
  sgGrid.className = 'dash-g4';

  var sgData = [
    { label: 'Drive',     val: parseFloat(sg_tee),  desc: 'Driver & bois' },
    { label: 'Approche',  val: parseFloat(sg_app),  desc: 'Fers du fairway' },
    { label: 'Jeu court', val: parseFloat(sg_arg),  desc: 'Chip & wedge' },
    { label: 'Putting',   val: parseFloat(sg_putt), desc: 'Sur le green' }
  ];

  sgData.forEach(function(s) {
    var card = document.createElement('div');
    card.className = 'sg-card';

    var lbl = document.createElement('div');
    lbl.className = 'sg-label';
    lbl.textContent = s.label;

    var val = document.createElement('div');
    var isPos = s.val > 0.05;
    var isNeg = s.val < -0.05;
    val.className = 'sg-value ' + (isPos ? 'sg-pos' : isNeg ? 'sg-neg' : 'sg-neu');
    val.textContent = (s.val >= 0 ? '+' : '') + s.val.toFixed(2);

    var desc = document.createElement('div');
    desc.style.cssText = 'font-size:8px;color:var(--tx3);margin-top:2px';
    desc.textContent = s.desc;

    /* Barre visuelle */
    var barTrack = document.createElement('div');
    barTrack.className = 'sg-bar-track';
    var barFill = document.createElement('div');
    barFill.className = 'sg-bar-fill';
    // Échelle ±3 coups/tour : les Strokes Gained réels sortent largement de ±1
    var pct = Math.min(100, Math.max(0, (s.val / 3 + 1) * 50));
    barFill.style.width = pct + '%';
    barFill.style.background = isPos ? 'var(--ok2)' : isNeg ? 'var(--ng2)' : 'var(--tx3)';
    barTrack.appendChild(barFill);

    card.appendChild(lbl);
    card.appendChild(val);
    card.appendChild(desc);
    card.appendChild(barTrack);
    sgGrid.appendChild(card);
  });

  sgBody.appendChild(sgGrid);

  /* Total SG */
  var sgTotal = parseFloat(sg_tee) + parseFloat(sg_app) + parseFloat(sg_arg) + parseFloat(sg_putt);
  var sgVerdict;
  var sgVerdictColor;
  if (sgTotal >= 0.5) { sgVerdict = 'Tu joues mieux que ton niveau \u2713'; sgVerdictColor = 'var(--ok2)'; }
  else if (sgTotal >= -0.5) { sgVerdict = 'Tu joues \u00e0 ton niveau'; sgVerdictColor = 'var(--gold-d)'; }
  else { sgVerdict = 'Tu joues sous ton niveau \u2014 il y a de la marge !'; sgVerdictColor = 'var(--ng2)'; }
  var sgTotalDiv = document.createElement('div');
  sgTotalDiv.style.cssText = 'margin-top:12px;padding-top:10px;border-top:1px solid var(--bd-card);display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap';
  sgTotalDiv.innerHTML = ''
    + '<div>'
    +   '<div style="font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px">Bilan</div>'
    +   '<div style="font-size:13px;font-weight:600;color:' + sgVerdictColor + '">' + sgVerdict + '</div>'
    + '</div>'
    + '<div style="font-size:22px;font-weight:700;color:' + (sgTotal >= 0 ? 'var(--ok2)' : 'var(--ng2)') + ';letter-spacing:-0.5px">'
    +   (sgTotal >= 0 ? '+' : '') + sgTotal.toFixed(2) + ' coups/tour'
    + '</div>';
  sgBody.appendChild(sgTotalDiv);

  /* Note de méthode — l'utilisateur doit savoir d'où sortent ces chiffres */
  if (hasReal) {
    var sgNote = document.createElement('div');
    sgNote.style.cssText = 'margin-top:10px;font-size:10.5px;line-height:1.5;color:var(--tx3)';
    sgNote.innerHTML = 'Calcul&nbsp;: ton score, tes fairways, tes greens et tes putts sont compar\u00e9s aux '
      + 'moyennes publi\u00e9es pour ' + sgRefTxt + ', ajust\u00e9es au rating et au slope du parcours. '
      + 'Le putting est exact (un putt = un coup)&nbsp;; le petit jeu est le reste de l\'\u00e9cart. '
      + 'Saisis tes putts pour d\u00e9bloquer les 4 secteurs.';
    if (rounds.length < 5) {
      sgNote.innerHTML += ' <strong>Avec seulement ' + rounds.length + ' partie'
        + (rounds.length > 1 ? 's' : '') + ', la r\u00e9f\u00e9rence reste approximative</strong> \u2014 '
        + 'elle s\'affinera au fil de tes cartes.';
    }
    sgBody.appendChild(sgNote);
  }

  sgPanel.appendChild(sgBody);
  wrap.appendChild(sgPanel);

  // Niveau par secteur (« ton putting joue comme un index 6 »)
  if (typeof slvRenderPanel === 'function') {
    try { slvRenderPanel(wrap); } catch (e) { console.warn('[TSG] niveau par secteur:', e.message); }
  }

  // Ton toi d'il y a 6 mois (progress.js)
  if (typeof pgsRenderThenNow === 'function') {
    try { pgsRenderThenNow(wrap); } catch (e) { console.warn('[TSG] avant/après:', e.message); }
  }

  /* ── Plan d'entraînement intelligent (généré depuis les Strokes Gained) ── */
  // Défis de la semaine, version compacte
  if (typeof chRenderPanel === 'function') {
    try { chRenderPanel(wrap, true); } catch (e) { console.warn('[TSG] défis:', e.message); }
  }

  try { buildTrainingPlan(wrap, sg_tee, sg_app, sg_arg, sg_putt); }
  catch (ex) { console.warn('[TSG] Plan entraînement:', ex.message); }

  /* ── 5. GRAPHIQUES (Évolution score + Handicap) ── */
  var chartsRow = document.createElement('div');
  chartsRow.className = 'dash-g2';

  /* Graphique Score */
  var scorePanel = document.createElement('div');
  scorePanel.className = 'panel';
  var scorePH = document.createElement('div');
  scorePH.className = 'panel-header';
  var scorePT = document.createElement('div');
  scorePT.className = 'panel-title';
  scorePT.textContent = '\u00c9volution du score';
  var scorePSub = document.createElement('div');
  scorePSub.className = 'panel-sub';
  scorePSub.textContent = n + ' derni\u00e8res parties';
  scorePH.appendChild(scorePT); scorePH.appendChild(scorePSub);
  scorePanel.appendChild(scorePH);
  var scorePB = document.createElement('div');
  scorePB.className = 'panel-body';
  var scoreWrap = document.createElement('div');
  scoreWrap.className = 'chart-wrap';
  scoreWrap.style.height = '180px';
  var scoreCanvas = document.createElement('canvas');
  scoreCanvas.id = 'dash-score-chart';
  scoreWrap.appendChild(scoreCanvas);
  scorePB.appendChild(scoreWrap);
  scorePanel.appendChild(scorePB);
  chartsRow.appendChild(scorePanel);

  /* Graphique Handicap */
  var hcpPanel = document.createElement('div');
  hcpPanel.className = 'panel';
  var hcpPH = document.createElement('div');
  hcpPH.className = 'panel-header';
  var hcpPT = document.createElement('div');
  hcpPT.className = 'panel-title';
  hcpPT.textContent = '\u00c9volution du handicap';
  var hcpPSub = document.createElement('div');
  hcpPSub.className = 'panel-sub';
  hcpPSub.textContent = 'Diff\u00e9rentiels saison';
  hcpPH.appendChild(hcpPT); hcpPH.appendChild(hcpPSub);
  hcpPanel.appendChild(hcpPH);
  var hcpPB = document.createElement('div');
  hcpPB.className = 'panel-body';
  var hcpWrap = document.createElement('div');
  hcpWrap.className = 'chart-wrap';
  hcpWrap.style.height = '180px';
  var hcpCanvas = document.createElement('canvas');
  hcpCanvas.id = 'dash-hcp-chart';
  hcpWrap.appendChild(hcpCanvas);
  hcpPB.appendChild(hcpWrap);
  hcpPanel.appendChild(hcpPB);
  chartsRow.appendChild(hcpPanel);

  wrap.appendChild(chartsRow);

  /* ── 6. OBJECTIFS DE SAISON ── */
  var bottomRow = document.createElement('div');
  bottomRow.className = 'dash-obj-row';

  /* Objectifs (modifiables \u00e0 tout moment) */
  var obj = getObjectives();
  var goalsPanel = document.createElement('div');
  goalsPanel.className = 'panel';
  var goalsPH = document.createElement('div');
  goalsPH.className = 'panel-header';
  var goalsPT = document.createElement('div');
  goalsPT.className = 'panel-title';
  goalsPT.textContent = 'Objectifs saison';
  goalsPH.appendChild(goalsPT);
  var goalsEdit = document.createElement('button');
  goalsEdit.className = 'goal-edit-btn';
  goalsEdit.title = 'Modifier mes objectifs';
  goalsEdit.innerHTML = '\u270e Modifier';
  goalsEdit.addEventListener('click', function() { openObjectivesModal(); });
  goalsPH.appendChild(goalsEdit);
  goalsPanel.appendChild(goalsPH);

  var goalsBody = document.createElement('div');
  goalsBody.className = 'panel-body';
  if (objectivesAreSuggested()) {
    var sugNote = document.createElement('div');
    sugNote.className = 'goal-suggest';
    sugNote.innerHTML = 'Objectifs <strong>proposés pour ton niveau</strong> : ceux d\'un joueur d\'index ' + String(obj.hcp).replace('.', ',') + '. Touche « Modifier » pour fixer les tiens.';
    goalsBody.appendChild(sugNote);
  }

  // Valeurs réelles (progress.js) : cartes 18 trous, stats saisies, index WHS
  var gNow = (hasReal && typeof pgsGoalNow === 'function') ? pgsGoalNow() : null;
  if (gNow && typeof pgsCheckGoals === 'function') { try { pgsCheckGoals(false); } catch (e) {} }
  var goalsData = [
    { key: 'score', name: 'Score moyen',  now: gNow ? gNow.score : parseFloat(avgScore), target: obj.score, lower: true,  suffix: '' },
    { key: 'hcp',   name: 'Handicap',     now: gNow ? gNow.hcp : parseFloat(hcp),        target: obj.hcp,   lower: true,  suffix: '' },
    { key: 'gir',   name: 'GIR',          now: gNow ? (gNow.gir === null ? null : Math.round(gNow.gir)) : parseInt(avgGIR, 10), target: obj.gir, lower: false, suffix: '%' },
    { key: 'fir',   name: 'FIR',          now: gNow ? (gNow.fir === null ? null : Math.round(gNow.fir)) : parseInt(avgFIR, 10), target: obj.fir, lower: false, suffix: '%' },
    { key: 'putts', name: 'Putts / tour', now: gNow ? gNow.putts : parseFloat(avgPutts), target: obj.putts, lower: true,  suffix: '' }
  ];

  goalsData.forEach(function(g) {
    var known = !(g.now === null || g.now === undefined || isNaN(g.now));
    var now = known ? Math.round(g.now * 10) / 10 : 0;
    var target = g.target;
    var good = known && (g.lower ? (now <= target) : (now >= target));
    var delta = (now - target);
    var pct;
    if (g.lower) {
      pct = now <= 0 ? 100 : Math.min(100, Math.round(target / now * 100));
    } else {
      pct = target <= 0 ? 100 : Math.min(100, Math.round(now / target * 100));
    }
    pct = Math.max(3, pct);

    var row = document.createElement('div');
    row.className = 'goal-row';

    var topLine = document.createElement('div');
    topLine.className = 'goal-topline';

    var nm = document.createElement('div');
    nm.className = 'goal-name';
    nm.textContent = g.name;

    var vals = document.createElement('div');
    vals.className = 'goal-vals';
    var nowEl = document.createElement('div');
    nowEl.className = 'goal-now';
    nowEl.textContent = known ? (g.lower ? now.toFixed(1) : now) + g.suffix : '—';
    var arrow = document.createElement('div');
    arrow.className = 'goal-arrow';
    arrow.textContent = '\u2192';
    var tgt = document.createElement('div');
    tgt.className = 'goal-tgt';
    tgt.textContent = target + g.suffix;
    vals.appendChild(nowEl); vals.appendChild(arrow); vals.appendChild(tgt);

    topLine.appendChild(nm);
    topLine.appendChild(vals);
    row.appendChild(topLine);

    // Barre de progression
    var barWrap = document.createElement('div');
    barWrap.className = 'goal-bar-wrap';
    var track = document.createElement('div');
    track.className = 'goal-bar-track';
    var fill = document.createElement('div');
    fill.className = 'goal-bar-fill' + (good ? ' reached' : '');
    fill.style.width = pct + '%';
    track.appendChild(fill);
    barWrap.appendChild(track);

    var deltaEl = document.createElement('div');
    deltaEl.className = 'goal-delta';
    deltaEl.style.color = good ? 'var(--ok2)' : 'var(--ng2)';
    var reachedOn = (typeof pgsReachedOn === 'function') ? pgsReachedOn(g.key, target) : null;
    if (!known) {
      deltaEl.style.color = 'var(--tx4)';
      deltaEl.textContent = 'pas de donnée';
      fill.style.width = '3%';
    } else if (good) {
      deltaEl.textContent = '\u2713 atteint' + (reachedOn ? ' le ' + reachedOn.slice(8, 10) + '/' + reachedOn.slice(5, 7) : '');
    } else {
      var d = Math.abs(delta);
      deltaEl.textContent = (g.lower ? '+' + (g.suffix === '%' ? Math.round(d) : d.toFixed(1)) : '-' + (g.suffix === '%' ? Math.round(d) : d.toFixed(1))) + g.suffix;
    }
    barWrap.appendChild(deltaEl);
    row.appendChild(barWrap);

    goalsBody.appendChild(row);
  });

  goalsPanel.appendChild(goalsBody);
  bottomRow.appendChild(goalsPanel);

  wrap.appendChild(bottomRow);

  /* ── Ajouter dans le container ── */
  container.appendChild(wrap);

  /* ── 8. GRAPHIQUES Chart.js (après rendu DOM) ── */
  setTimeout(function tsgDrawCharts1() {
    if (typeof Chart === 'undefined') { if (typeof tsgLoadChart === 'function') tsgLoadChart(tsgDrawCharts1); return; }

    var chartOpts = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1A1A1A',
          borderColor: 'rgba(201,168,76,0.3)',
          borderWidth: 1,
          titleColor: '#9A9590',
          bodyColor: '#E8E4DC',
          padding: 8
        }
      }
    };

    /* Score */
    var sc = document.getElementById('dash-score-chart');
    if (sc) {
      // Chercher chart par ID string (trouve même si canvas DOM a changé)
      if (Chart.getChart) {
        var ex1 = Chart.getChart('dash-score-chart');
        if (ex1) { try { ex1.destroy(); } catch(e) {} }
        var ex2 = Chart.getChart(sc);
        if (ex2) { try { ex2.destroy(); } catch(e) {} }
      }
      _dashCharts['score'] = new Chart(sc, {
        type: 'line',
        data: {
          labels: scoreHistory.map(function(_, i) { return 'P' + (i + 1); }),
          datasets: [
            {
              data: scoreHistory,
              borderColor: '#C9A84C',
              backgroundColor: 'rgba(201,168,76,0.07)',
              pointBackgroundColor: '#C9A84C',
              pointBorderColor: '#111',
              pointRadius: 3,
              tension: 0.35,
              fill: true,
              borderWidth: 2
            },
            {
              data: new Array(scoreHistory.length).fill(72),
              borderColor: 'rgba(255,255,255,0.06)',
              borderDash: [4, 4],
              borderWidth: 1,
              pointRadius: 0,
              fill: false
            }
          ]
        },
        options: Object.assign({}, chartOpts, {
          scales: {
            x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#5A5550', font: { size: 8 }, maxTicksLimit: 6 } },
            y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#5A5550', font: { size: 8 } }, min: 72, max: 94 }
          }
        })
      });
    }

    /* Handicap */
    var hc = document.getElementById('dash-hcp-chart');
    if (hc) {
      // Chercher chart par ID string (trouve même si canvas DOM a changé)
      if (Chart.getChart) {
        var ex3 = Chart.getChart('dash-hcp-chart');
        if (ex3) { try { ex3.destroy(); } catch(e) {} }
        var ex4 = Chart.getChart(hc);
        if (ex4) { try { ex4.destroy(); } catch(e) {} }
      }
      _dashCharts['hcp'] = new Chart(hc, {
        type: 'line',
        data: {
          labels: hcpHistory.map(function(_, i) { return 'P' + (i + 1); }),
          datasets: [{
            data: hcpHistory,
            borderColor: '#3D8A65',
            backgroundColor: 'rgba(61,138,101,0.07)',
            pointBackgroundColor: '#3D8A65',
            pointBorderColor: '#111',
            pointRadius: 3,
            tension: 0.35,
            fill: true,
            borderWidth: 2
          }]
        },
        options: Object.assign({}, chartOpts, {
          scales: {
            x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#5A5550', font: { size: 8 }, maxTicksLimit: 6 } },
            y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#5A5550', font: { size: 8 } }, reverse: false }
          }
        })
      });
    }
  }, 200);
}

/* ─── KPI MODAL (mini-graph progression) ─── */
function openKpiModal(key, label, title) {
  var rounds = lsGet('rounds') || [];
  if (rounds.length < 2) {
    showToast('Pas assez de parties enregistrées pour afficher l\'évolution');
    return;
  }

  // Créer/réutiliser la modale
  var modal = document.getElementById('kpi-modal');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'kpi-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(26,18,9,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.addEventListener('click', function(ev) {
    if (ev.target === modal) modal.remove();
  });

  // Préparer les données (20 dernières, chronologique)
  var data20 = rounds.slice(0, 20).reverse();
  var values;
  if (key === 'score') values = data20.map(function(r) { return r.score; });
  else if (key === 'gir') values = data20.map(function(r) { return (r.gir === null || r.gir === undefined) ? null : Math.round(r.gir / 18 * 100); });
  else if (key === 'fir') values = data20.map(function(r) { return (r.fir === null || r.fir === undefined) ? null : Math.round(r.fir / (r.firTotal || 14) * 100); });
  else if (key === 'putts') values = data20.map(function(r) { return r.putts; });
  else if (key === 'diff') values = data20.map(function(r) { return r.diff; });

  // Calculer trend
  // Les parties où la stat n'a pas été saisie (null) ne comptent ni en premier ni en dernier
  var known = values.filter(function(v) { return v !== null && v !== undefined; });
  var first = known.length ? known[0] : '—';
  var last = known.length ? known[known.length - 1] : '—';
  var delta = known.length > 1 ? (last - first).toFixed(1) : 0;
  var deltaText = known.length > 1 ? (delta > 0 ? '+' : '') + delta : '—';
  var deltaColor = (key === 'score' || key === 'putts' || key === 'diff') ?
    (delta < 0 ? 'var(--ok2)' : 'var(--ng2)') :
    (delta > 0 ? 'var(--ok2)' : 'var(--ng2)');

  var inner = document.createElement('div');
  inner.style.cssText = 'background:var(--white);border:1px solid var(--bd-card);border-radius:16px;padding:24px 28px;max-width:600px;width:100%;box-shadow:var(--shadow-md)';
  inner.innerHTML = ''
    + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px">'
    +   '<div>'
    +     '<div style="font-size:11px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px">' + label + '</div>'
    +     '<div style="font-size:22px;font-weight:700;color:var(--tx);letter-spacing:-0.5px">' + title + '</div>'
    +   '</div>'
    +   '<button id="kpi-modal-close" style="background:none;border:none;font-size:22px;color:var(--tx3);cursor:pointer;padding:0 8px;font-weight:300">×</button>'
    + '</div>'
    + '<div style="display:flex;gap:14px;margin-bottom:16px;padding:12px 14px;background:var(--bg);border-radius:10px">'
    +   '<div><div style="font-size:9px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.08em">Première</div><div style="font-size:18px;font-weight:700;color:var(--tx2)">' + first + '</div></div>'
    +   '<div><div style="font-size:9px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.08em">Dernière</div><div style="font-size:18px;font-weight:700;color:var(--tx)">' + last + '</div></div>'
    +   '<div><div style="font-size:9px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.08em">Évolution</div><div style="font-size:18px;font-weight:700;color:' + deltaColor + '">' + deltaText + '</div></div>'
    +   '<div style="margin-left:auto"><div style="font-size:9px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.08em">Parties</div><div style="font-size:18px;font-weight:700;color:var(--gold-d)">' + known.length + '</div></div>'
    + '</div>'
    + '<div style="height:280px"><canvas id="kpi-modal-chart"></canvas></div>';

  modal.appendChild(inner);
  document.body.appendChild(modal);

  document.getElementById('kpi-modal-close').addEventListener('click', function() {
    modal.remove();
  });

  // Créer le graphique
  setTimeout(function tsgDrawCharts2() {
    if (typeof Chart === 'undefined') { if (typeof tsgLoadChart === 'function') tsgLoadChart(tsgDrawCharts2); return; }
    var canvas = document.getElementById('kpi-modal-chart');
    if (!canvas) return;
    var existing = Chart.getChart ? Chart.getChart(canvas) : null;
    if (existing) { try { existing.destroy(); } catch(e) {} }
    new Chart(canvas, {
      type: 'line',
      data: {
        labels: values.map(function(_, i) { return 'P' + (i + 1); }),
        datasets: [{
          data: values,
          borderColor: '#C9A84C',
          backgroundColor: 'rgba(201,168,76,0.10)',
          pointBackgroundColor: '#C9A84C',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 4,
          tension: 0.35,
          fill: true,
          borderWidth: 2.5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1A1209',
            borderColor: '#C9A84C',
            borderWidth: 1,
            padding: 10,
            titleColor: '#E8DFC8',
            bodyColor: '#fff'
          }
        },
        scales: {
          x: { grid: { color: 'rgba(168,133,30,0.08)' }, ticks: { color: '#7A6448', font: { size: 10 } } },
          y: { grid: { color: 'rgba(168,133,30,0.08)' }, ticks: { color: '#7A6448', font: { size: 10 } } }
        }
      }
    });
  }, 50);
}




/* ════════════════════════════════════════════
   PLAN D'ENTRAÎNEMENT INTELLIGENT (S20)
   Détecte le secteur le plus faible (Strokes Gained) et propose
   quoi travailler + les exercices adaptés de la bibliothèque.
════════════════════════════════════════════ */
function buildTrainingPlan(wrap, sg_tee, sg_app, sg_arg, sg_putt) {
  var sectors = [
    { key: 'Drive',     val: parseFloat(sg_tee),  label: 'le driving',   phrase: 'ta mise en jeu' },
    { key: 'Approche',  val: parseFloat(sg_app),  label: 'les approches', phrase: 'tes fers / approches' },
    { key: 'Jeu court', val: parseFloat(sg_arg),  label: 'le petit jeu',  phrase: 'ton petit jeu' },
    { key: 'Putting',   val: parseFloat(sg_putt), label: 'le putting',    phrase: 'ton putting' }
  ].filter(function(s) { return !isNaN(s.val); });
  if (!sectors.length) return;

  // Trier du plus faible (val la plus négative) au plus fort
  sectors.sort(function(a, b) { return a.val - b.val; });
  var weak = sectors[0];
  var second = sectors[1];

  var panel = document.createElement('div');
  panel.className = 'panel plan-panel';

  var header = document.createElement('div');
  header.className = 'panel-header';
  header.innerHTML = '<div class="panel-title">🧠 Ton plan d\'entraînement</div>'
    + '<div class="panel-sub">généré depuis tes données</div>';
  panel.appendChild(header);

  var body = document.createElement('div');
  body.className = 'panel-body';

  // Bloc priorité
  var lossTxt;
  if (weak.val < 0) {
    lossTxt = 'Tu perds en moyenne <strong>' + Math.abs(weak.val).toFixed(2) + ' coup/tour</strong> sur ' + weak.phrase
      + '. C\'est ton <strong>plus gros levier</strong> de progression.';
  } else {
    lossTxt = 'Tu joues au-dessus de ton niveau partout — beau travail ! Continue à consolider ton secteur le plus juste : <strong>' + weak.label + '</strong>.';
  }

  var prio = document.createElement('div');
  prio.className = 'plan-prio';
  prio.innerHTML = '<div class="plan-prio-tag">Priorité cette semaine</div>'
    + '<div class="plan-prio-title">Travaille ' + weak.label + '</div>'
    + '<div class="plan-prio-txt">' + lossTxt + '</div>';
  body.appendChild(prio);

  // Exercices adaptés
  var all = (typeof getAllExercises === 'function') ? getAllExercises()
    : ((typeof getTrainings === 'function') ? getTrainings() : []);
  var matches = all.filter(function(t) { return t.category === weak.key; }).slice(0, 3);

  var exWrap = document.createElement('div');
  exWrap.className = 'plan-ex';
  if (matches.length) {
    var lbl = document.createElement('div');
    lbl.className = 'plan-ex-label';
    lbl.textContent = 'Exercices recommandés pour toi';
    exWrap.appendChild(lbl);
    matches.forEach(function(t) {
      var row = document.createElement('div');
      row.className = 'plan-ex-item';
      row.innerHTML = '<div class="plan-ex-info"><div class="plan-ex-title">' + planEsc(t.title) + '</div>'
        + '<div class="plan-ex-sub">' + planEsc(t.category) + (t.duration ? ' · ' + t.duration + ' min' : '') + '</div></div>'
        + '<span class="plan-ex-go">Faire →</span>';
      row.addEventListener('click', function() {
        if (typeof openTrainingDetail === 'function') openTrainingDetail(t);
      });
      exWrap.appendChild(row);
    });
  } else {
    var none = document.createElement('div');
    none.className = 'plan-ex-none';
    none.textContent = 'Aucun exercice dans ce secteur pour l\'instant. Demande à ton coach, ou crée-en un dans l\'onglet Entraînement.';
    exWrap.appendChild(none);
  }
  body.appendChild(exWrap);

  // Bouton + priorité secondaire
  var footer = document.createElement('div');
  footer.className = 'plan-footer';
  var btn = document.createElement('button');
  btn.className = 'dash-btn dash-btn-gold';
  btn.textContent = 'Voir les exercices ' + weak.label + ' →';
  btn.addEventListener('click', function() { planGoToTraining(weak.key); });
  footer.appendChild(btn);
  if (second) {
    var next = document.createElement('div');
    next.className = 'plan-next';
    next.innerHTML = 'Ensuite : <strong>' + second.label + '</strong>';
    footer.appendChild(next);
  }
  body.appendChild(footer);

  panel.appendChild(body);
  wrap.appendChild(panel);
}

function planGoToTraining(category) {
  try {
    var all = (typeof getTrainings === 'function') ? getTrainings() : [];
    window.trn_filter = all.some(function(t) { return t.category === category; }) ? category : 'all';
  } catch (e) {}
  if (typeof showPage === 'function') showPage('training');
}

function planEsc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
