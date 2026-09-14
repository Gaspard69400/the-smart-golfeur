/* ════════════════════════════════════════════
 * THE SMART GOLFER — puttingstats.js
 * DÉTAIL PUTTING + SAUVETAGES (up & down), à partir des putts TROU PAR TROU.
 *
 * ⚠️ L'ancien onglet Analyse → Putting lisait `round.putts` comme un tableau,
 * alors que la partie n'enregistrait que le TOTAL (un nombre) : il affichait
 * « 0.00 putt par green — Excellent niveau » quelles que soient les données.
 * Depuis S42 la partie garde `puttsByHole` ; les anciennes parties n'ont que
 * le total, on le dit clairement au lieu d'inventer un détail.
 *
 * Sauvetage (« scrambling ») = green manqué en régulation ET par ou mieux.
 * C'est la mesure standard de l'up & down : on la calcule sans avoir besoin
 * de savoir d'où part le chip. Les sorties de bunker ne sont pas saisies :
 * pas de statistique bunker.
 *
 * Dépend de : data.js (getAllCourses), strokesgained.js (sgRefHcp, sgBaseline).
 * ════════════════════════════════════════════ */

/* Repères amateurs indicatifs par index (moyennes publiées de joueurs amateurs
   suivis par capteurs), sur un trou : taux de 3-putts, sauvetages, putts par green touché */
var PTS_BENCH = [
  { hcp: 0,  three: 0.055, scr: 0.44, pgir: 1.85 },
  { hcp: 5,  three: 0.072, scr: 0.33, pgir: 1.89 },
  { hcp: 10, three: 0.094, scr: 0.25, pgir: 1.93 },
  { hcp: 15, three: 0.117, scr: 0.18, pgir: 1.97 },
  { hcp: 20, three: 0.144, scr: 0.13, pgir: 2.02 },
  { hcp: 25, three: 0.167, scr: 0.09, pgir: 2.06 },
  { hcp: 30, three: 0.189, scr: 0.06, pgir: 2.10 },
  { hcp: 36, three: 0.217, scr: 0.04, pgir: 2.14 }
];

function ptsBench(hcp) {
  var h = (hcp === null || hcp === undefined || isNaN(hcp)) ? 18 : hcp, t = PTS_BENCH;
  if (h <= t[0].hcp) return t[0];
  if (h >= t[t.length - 1].hcp) return t[t.length - 1];
  for (var i = 1; i < t.length; i++) {
    if (h <= t[i].hcp) {
      var a = t[i - 1], b = t[i], k = (h - a.hcp) / (b.hcp - a.hcp);
      var out = { hcp: h };
      ['three', 'scr', 'pgir'].forEach(function(key) { out[key] = a[key] + (b[key] - a[key]) * k; });
      // 1-putt cohérent avec le barème de putts des Strokes Gained :
      // moyenne/trou ≈ 2 − taux 1-putt + taux 3-putts
      var perHole = (typeof sgBaseline === 'function') ? sgBaseline(h).putts / 18 : 1.8;
      out.one = Math.max(0.05, 2 - perHole + out.three);
      return out;
    }
  }
  return t[0];
}

/* Putts d'un trou : saisie trou par trou (S42), sinon saisie immersive d'avant (shotsPutts par n° de trou) */
function ptsHolePutts(round, i, holeNum) {
  if (Array.isArray(round.puttsByHole)) {
    var p = round.puttsByHole[i];
    return (p === null || p === undefined) ? null : p;
  }
  if (round.proMode && round.shotsPutts && round.shotsPutts[holeNum] !== undefined && round.shotsPutts[holeNum] !== null) {
    return round.shotsPutts[holeNum];
  }
  return null;
}

function ptsCompute(rounds) {
  var courses = (typeof getAllCourses === 'function') ? getAllCourses() : [];
  var st = {
    rounds: 0, roundsDetailed: 0, roundsTotalOnly: 0,
    holes: 0, putts: 0, dist: [0, 0, 0, 0, 0],       // 0, 1, 2, 3, 4+
    girHoles: 0, girPutts: 0,
    missHoles: 0, saves: 0,
    byPar: { 3: { s: 0, n: 0 }, 4: { s: 0, n: 0 }, 5: { s: 0, n: 0 } },
    totals: []                                        // putts par partie 18 trous (toutes saisies)
  };
  rounds.forEach(function(r) {
    st.rounds++;
    var filled = Array.isArray(r.scores) ? r.scores.filter(function(x) { return x !== null && x !== undefined; }).length : 0;
    if (typeof r.putts === 'number' && r.putts >= 18 && filled >= 18) st.totals.push(r.putts);

    var course = courses.find(function(c) { return c.id === r.courseId; });
    var n = 0;
    if (course && course.trous && Array.isArray(r.scores)) {
      course.trous.forEach(function(h, i) {
        var sc = r.scores[i], p = ptsHolePutts(r, i, h.num);
        if (sc === null || sc === undefined || p === null || p > sc) return;
        n++;
        st.holes++; st.putts += p;
        st.dist[Math.min(4, p)]++;
        if (st.byPar[h.par]) { st.byPar[h.par].s += p; st.byPar[h.par].n++; }
        var gir = (sc - p) <= (h.par - 2);
        if (gir) { st.girHoles++; st.girPutts += p; }
        else { st.missHoles++; if (sc <= h.par) st.saves++; }
      });
    }
    if (n >= 9) st.roundsDetailed++;
    else if (typeof r.putts === 'number') st.roundsTotalOnly++;
  });
  st.perHole    = st.holes ? st.putts / st.holes : null;
  st.threeRate  = st.holes ? (st.dist[3] + st.dist[4]) / st.holes : null;
  st.oneRate    = st.holes ? st.dist[1] / st.holes : null;
  st.puttsPerGir = st.girHoles ? st.girPutts / st.girHoles : null;
  st.scrRate    = st.missHoles ? st.saves / st.missHoles : null;
  st.perRound   = st.totals.length ? st.totals.reduce(function(a, b) { return a + b; }, 0) / st.totals.length : null;
  return st;
}

function ptsPct(v) { return v === null ? '—' : Math.round(v * 100) + ' %'; }
function ptsNum(v, d) { return v === null ? '—' : v.toFixed(d).replace('.', ','); }

/* Pastille « mieux / dans la moyenne / moins bien » que la référence */
function ptsVerdict(val, ref, lowerIsBetter, tol) {
  if (val === null || ref === null) return '';
  var diff = lowerIsBetter ? ref - val : val - ref;
  if (Math.abs(diff) <= tol) return '<span class="pts-chip pts-mid">Dans la moyenne</span>';
  return diff > 0 ? '<span class="pts-chip pts-good">Mieux que ta référence</span>'
                  : '<span class="pts-chip pts-bad">À travailler</span>';
}

function ptsRender(page, rounds) {
  var ref = (typeof sgRefHcp === 'function') ? sgRefHcp() : 18;
  var b = ptsBench(ref);
  var st = ptsCompute(rounds);
  var refLbl = (typeof sgReferenceLabel === 'function') ? sgReferenceLabel(ref) : 'ton index';
  var MIN_HOLES = 18;

  /* ── Carte 1 : synthèse ── */
  var synth = document.createElement('div');
  synth.className = 'an-card';
  var perRoundRef = (typeof sgBaseline === 'function') ? sgBaseline(ref).putts : null;
  synth.innerHTML = ''
    + '<div class="an-card-header"><div class="an-card-title">Synthèse putting</div>'
    +   '<div class="an-card-sub">Comparé à ' + refLbl + '</div></div>'
    + '<div class="an-card-body"><div class="pts-kpis">'
    +   ptsKpi('Putts / partie', ptsNum(st.perRound, 1), perRoundRef !== null ? 'Réf. ' + ptsNum(perRoundRef, 1) : '',
               ptsVerdict(st.perRound, perRoundRef, true, 0.8), st.totals.length + ' carte' + (st.totals.length > 1 ? 's' : '') + ' 18 trous')
    +   ptsKpi('3-putts', st.holes >= MIN_HOLES ? ptsPct(st.threeRate) : '—', 'Réf. ' + ptsPct(b.three),
               st.holes >= MIN_HOLES ? ptsVerdict(st.threeRate, b.three, true, 0.02) : '',
               st.holes >= MIN_HOLES ? 'soit ' + ptsNum(st.threeRate * 18, 1) + ' par partie' : 'Putts trou par trou requis')
    +   ptsKpi('1-putt', st.holes >= MIN_HOLES ? ptsPct(st.oneRate) : '—', 'Réf. ' + ptsPct(b.one),
               st.holes >= MIN_HOLES ? ptsVerdict(st.oneRate, b.one, false, 0.03) : '', st.holes + (st.holes > 1 ? ' trous analysés' : ' trou analysé'))
    + '</div></div>';
  page.appendChild(synth);

  /* ── Pas encore de putts trou par trou : expliquer comment débloquer ── */
  if (st.holes < MIN_HOLES) {
    var unlock = document.createElement('div');
    unlock.className = 'an-card pts-unlock';
    unlock.innerHTML = '<div class="an-card-body">'
      + '<div class="pts-unlock-t">Débloque tes 3-putts et tes sauvetages</div>'
      + '<div class="pts-unlock-d">' + (st.roundsTotalOnly
          ? 'Tes ' + st.roundsTotalOnly + ' partie' + (st.roundsTotalOnly > 1 ? 's' : '') + ' n\'ont que le <strong>total</strong> de putts : impossible de savoir sur quels trous tu en as fait 3. '
          : '')
      + 'Pendant la <strong>saisie express</strong>, ouvre « Détail » et touche le nombre de putts (0 à 4) <strong>avant</strong> le score. Une partie suffit pour les premiers chiffres.</div>'
      + '<button class="dash-btn dash-btn-gold" type="button" id="pts-go-score">Saisir une partie →</button>'
      + '</div>';
    page.appendChild(unlock);
    var go = unlock.querySelector('#pts-go-score');
    if (go) go.addEventListener('click', function() { if (typeof showPage === 'function') showPage('scorecard'); });
    return;
  }

  /* ── Carte 2 : sauvetages & greens touchés ── */
  var save = document.createElement('div');
  save.className = 'an-card';
  save.innerHTML = ''
    + '<div class="an-card-header"><div class="an-card-title">Up &amp; down · sauvetages <span class="gloss-link" data-gloss="updown">?</span></div>'
    +   '<div class="an-card-sub">Green manqué en régulation, puis par ou mieux</div></div>'
    + '<div class="an-card-body"><div class="pts-kpis">'
    +   ptsKpi('Sauvetages', ptsPct(st.scrRate), 'Réf. ' + ptsPct(b.scr),
               st.missHoles >= 5 ? ptsVerdict(st.scrRate, b.scr, false, 0.04) : '',
               st.saves + ' sur ' + st.missHoles + ' greens manqués')
    +   ptsKpi('Putts / green touché', ptsNum(st.puttsPerGir, 2), 'Réf. ' + ptsNum(b.pgir, 2),
               st.girHoles >= 5 ? ptsVerdict(st.puttsPerGir, b.pgir, true, 0.05) : '',
               st.girHoles + ' green' + (st.girHoles > 1 ? 's' : '') + ' en régulation')
    + '</div>'
    + '<div class="pts-note">Les greens en régulation sont déduits du score et des putts (coups pour atteindre le green ≤ par − 2). '
    +   'Les sorties de bunker ne sont pas saisies : pas de statistique bunker.</div>'
    + '</div>';
  page.appendChild(save);

  /* ── Carte 3 : distribution ── */
  var dist = document.createElement('div');
  dist.className = 'an-card';
  var rows = [['Chip-in (0 putt)', 0, 'var(--ok)'], ['1 putt', 1, 'var(--ok2)'], ['2 putts', 2, 'var(--gold)'],
              ['3 putts', 3, 'var(--ng)'], ['4 putts ou +', 4, 'var(--ng2)']];
  dist.innerHTML = ''
    + '<div class="an-card-header"><div class="an-card-title">Putts par trou</div>'
    +   '<div class="an-card-sub">' + ptsNum(st.perHole, 2) + ' putt' + (st.perHole >= 2 ? 's' : '') + ' en moyenne sur ' + st.holes + ' trous</div></div>'
    + '<div class="an-card-body">'
    +   rows.filter(function(rw) { return rw[1] > 0 && rw[1] < 4 || st.dist[rw[1]] > 0; }).map(function(rw) {
          var c = st.dist[rw[1]], pct = Math.round(c / st.holes * 100);
          return '<div class="an-stat-row"><div class="an-stat-label">' + rw[0] + '</div>'
            + '<div class="an-stat-bar-wrap"><div class="an-stat-bar-track"><div class="an-stat-bar-fill" style="width:' + pct + '%;background:' + rw[2] + '"></div></div></div>'
            + '<div class="an-stat-value">' + pct + '%</div><div class="an-stat-trend" style="color:var(--tx3)">' + c + '</div></div>';
        }).join('')
    +   ['3', '4', '5'].map(function(p) {
          var o = st.byPar[p];
          if (!o.n) return '';
          return '<div class="pts-par"><span>Par ' + p + '</span><strong>' + ptsNum(o.s / o.n, 2) + '</strong><em>' + o.n + ' trous</em></div>';
        }).join('')
    + '</div>';
  page.appendChild(dist);

  /* ── Carte 4 : où agir ── */
  var recos = [];
  var lost3 = (st.threeRate - b.three) * 18;
  if (lost3 >= 0.4) recos.push({ p: 'urgent', t: 'PRIORITÉ — Les 3-putts',
    d: 'Tu fais <strong>' + ptsNum(st.threeRate * 18, 1) + ' trois-putts par partie</strong>, contre ' + ptsNum(b.three * 18, 1) + ' pour ' + refLbl + ' : environ <strong>' + ptsNum(lost3, 1) + ' coup' + (lost3 >= 2 ? 's' : '') + ' perdu' + (lost3 >= 2 ? 's' : '') + '</strong> par partie.',
    a: '<strong>À faire :</strong> le contrôle de distance sur les putts longs (échelle 6-9-12 m, finir dans un cercle d\'un mètre). Le premier putt décide du 3-putt.' });
  var lostScr = st.missHoles >= 5 ? (b.scr - st.scrRate) * (st.missHoles / Math.max(1, st.roundsDetailed)) : 0;
  if (lostScr >= 0.4) recos.push({ p: 'urgent', t: 'PRIORITÉ — Les sauvetages',
    d: 'Tu sauves le par sur <strong>' + ptsPct(st.scrRate) + '</strong> de tes greens manqués (réf. ' + ptsPct(b.scr) + ') : environ <strong>' + ptsNum(lostScr, 1) + ' coup' + (lostScr >= 2 ? 's' : '') + '</strong> par partie.',
    a: '<strong>À faire :</strong> chips et pitchs vers une zone de 2 m, puis le putt qui suit. Un sauvetage = un chip près ET un putt rentré.' });
  if (st.puttsPerGir !== null && st.girHoles >= 5 && st.puttsPerGir - b.pgir >= 0.1) recos.push({ p: 'normal', t: 'MARGE — Convertir les greens touchés',
    d: '<strong>' + ptsNum(st.puttsPerGir, 2) + ' putts</strong> par green en régulation (réf. ' + ptsNum(b.pgir, 2) + ').',
    a: '<strong>À faire :</strong> putts de 2 à 4 m en série — ce sont eux qui transforment un green touché en par assuré ou en birdie.' });
  if (!recos.length) recos.push({ p: 'positive', t: 'POINT FORT — Autour et sur le green',
    d: 'Sur ' + st.holes + ' trous analysés, ton putting et tes sauvetages sont au niveau de ' + refLbl + ' ou mieux.',
    a: '<strong>Garde le rythme :</strong> tes coups à gagner sont sans doute ailleurs — regarde tes Strokes Gained sur le Dashboard.' });

  var reco = document.createElement('div');
  reco.className = 'an-card';
  reco.innerHTML = '<div class="an-card-header"><div class="an-card-title">Où agir</div>'
    + '<div class="an-card-sub">Repères indicatifs issus de moyennes amateurs publiées</div></div>'
    + '<div class="an-card-body" style="padding:14px 18px">'
    + recos.map(function(r) {
        return '<div class="an-reco ' + r.p + '" style="margin-bottom:10px">'
          + '<div class="an-reco-priority">' + r.t.split(' — ')[0] + '</div>'
          + '<div class="an-reco-content"><div class="an-reco-title">' + r.t.split(' — ')[1] + '</div>'
          + '<div class="an-reco-data">' + r.d + '</div><div class="an-reco-action">' + r.a + '</div></div></div>';
      }).join('')
    + '</div>';
  page.appendChild(reco);
}

function ptsKpi(label, value, ref, verdict, foot) {
  return '<div class="pts-kpi"><div class="pts-kpi-l">' + label + '</div>'
    + '<div class="pts-kpi-v">' + value + '</div>'
    + '<div class="pts-kpi-ref">' + ref + '</div>'
    + (verdict || '')
    + '<div class="pts-kpi-foot">' + (foot || '') + '</div></div>';
}
