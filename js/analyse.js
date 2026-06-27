/* ════════════════════════════════════════════
 * THE SMART GOLFER — analyse.js
 * Page Analyse : Vue d'ensemble, Précision (+ placeholders Putting, Évolution)
 * Dépend de : data.js (COURSES), app.js (lsGet)
 * ════════════════════════════════════════════ */

/* ════════════════════════════════════════════
   ANALYSE — SESSION 4
════════════════════════════════════════════ */

var _analysePeriod = 10;  // 5, 10, 20, ou 'all'
var _analyseSubtab = 'overview';  // overview, precision, putting, evolution

function initAnalysePage() {
  var pg = document.getElementById('page-analyse');
  if (!pg) return;

  pg.innerHTML = '';

  var wrap = document.createElement('div');
  wrap.className = 'an-wrap';

  /* ── Header avec titre + sélecteur période ── */
  var header = document.createElement('div');
  header.className = 'an-header';
  header.innerHTML = ''
    + '<div class="an-title-block">'
    +   '<div class="an-title">Analyse de performance</div>'
    +   '<div class="an-subtitle" id="an-period-label">Sur les 10 dernières parties</div>'
    + '</div>'
    + '<div class="an-period-selector">'
    +   '<button class="an-period-btn" data-period="5">5</button>'
    +   '<button class="an-period-btn active" data-period="10">10</button>'
    +   '<button class="an-period-btn" data-period="20">20</button>'
    +   '<button class="an-period-btn" data-period="all">Toutes</button>'
    + '</div>';
  wrap.appendChild(header);

  /* ── Sous-onglets ── */
  var subtabs = document.createElement('div');
  subtabs.className = 'an-subtabs';
  var subtabsConfig = [
    { id: 'overview',  label: 'Vue d\'ensemble', icon: '\u25C7' },
    { id: 'precision', label: 'Précision',       icon: '\u25CE' },
    { id: 'putting',   label: 'Putting',         icon: '\u25C9' },
    { id: 'evolution', label: 'Évolution',       icon: '\u25B2' }
  ];
  subtabsConfig.forEach(function(t) {
    var btn = document.createElement('button');
    btn.className = 'an-subtab' + (t.id === 'overview' ? ' active' : '');
    btn.setAttribute('data-subtab', t.id);
    btn.innerHTML = '<span class="an-subtab-icon">' + t.icon + '</span>' + t.label;
    btn.addEventListener('click', function() {
      switchAnalyseSubtab(t.id);
    });
    subtabs.appendChild(btn);
  });
  wrap.appendChild(subtabs);

  /* ── Conteneurs de sous-pages ── */
  ['overview','precision','putting','evolution'].forEach(function(id) {
    var sub = document.createElement('div');
    sub.className = 'an-subpage' + (id === 'overview' ? ' active' : '');
    sub.id = 'an-sub-' + id;
    wrap.appendChild(sub);
  });

  pg.appendChild(wrap);

  /* ── Listeners période ── */
  var periodBtns = pg.querySelectorAll('.an-period-btn');
  periodBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      periodBtns.forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var p = btn.getAttribute('data-period');
      _analysePeriod = p === 'all' ? 'all' : parseInt(p);
      updatePeriodLabel();
      renderCurrentAnalyseSubtab();
    });
  });

  /* ── Rendre le sous-onglet par défaut ── */
  renderCurrentAnalyseSubtab();
}

function updatePeriodLabel() {
  var lbl = document.getElementById('an-period-label');
  if (!lbl) return;
  if (_analysePeriod === 'all') {
    lbl.textContent = 'Sur toutes les parties enregistrées';
  } else {
    lbl.textContent = 'Sur les ' + _analysePeriod + ' dernières parties';
  }
}

function switchAnalyseSubtab(id) {
  _analyseSubtab = id;
  // Tabs
  document.querySelectorAll('.an-subtab').forEach(function(t) {
    t.classList.toggle('active', t.getAttribute('data-subtab') === id);
  });
  // Pages
  document.querySelectorAll('.an-subpage').forEach(function(p) {
    p.classList.toggle('active', p.id === 'an-sub-' + id);
  });
  renderCurrentAnalyseSubtab();
}

function renderCurrentAnalyseSubtab() {
  if (_analyseSubtab === 'overview')  renderOverview();
  else if (_analyseSubtab === 'precision') renderPrecision();
  else if (_analyseSubtab === 'putting')   renderPutting();
  else if (_analyseSubtab === 'evolution') renderEvolution();
}

function getAnalyseRounds() {
  var rounds = lsGet('rounds') || [];
  if (!rounds.length) return [];
  if (_analysePeriod === 'all') return rounds.slice();
  return rounds.slice(0, _analysePeriod);
}

/* ────────────────────────────────────────
   SOUS-ONGLET 1 : VUE D'ENSEMBLE
──────────────────────────────────────── */
function renderOverview() {
  var page = document.getElementById('an-sub-overview');
  if (!page) return;
  page.innerHTML = '';

  var rounds = getAnalyseRounds();

  if (rounds.length === 0) {
    page.appendChild(makeEmptyCard('overview'));
    return;
  }

  // ── Calculs ──
  var avgScore = (rounds.reduce(function(a,r) { return a + r.score; }, 0) / rounds.length).toFixed(1);
  var avgDiff  = (rounds.reduce(function(a,r) { return a + (r.diff||0); }, 0) / rounds.length).toFixed(1);
  var avgGir   = Math.round(rounds.reduce(function(a,r) { return a + r.gir; }, 0) / rounds.length / 18 * 100);
  var avgFir   = Math.round(rounds.reduce(function(a,r) { var t = r.firTotal||14; return a + r.fir/t; }, 0) / rounds.length * 100);
  var sgTee    = (rounds.reduce(function(a,r) { return a + (r.sg_tee||0); }, 0) / rounds.length).toFixed(2);
  var sgApp    = (rounds.reduce(function(a,r) { return a + (r.sg_app||0); }, 0) / rounds.length).toFixed(2);
  var sgArg    = (rounds.reduce(function(a,r) { return a + (r.sg_arg||0); }, 0) / rounds.length).toFixed(2);
  var sgPutt   = (rounds.reduce(function(a,r) { return a + (r.sg_putt||0); }, 0) / rounds.length).toFixed(2);
  var sgTotal  = (parseFloat(sgTee) + parseFloat(sgApp) + parseFloat(sgArg) + parseFloat(sgPutt)).toFixed(2);

  // ── Carte synthèse ──
  var synth = document.createElement('div');
  synth.className = 'an-card';
  synth.innerHTML = ''
    + '<div class="an-card-header">'
    +   '<div class="an-card-title">Synthèse · ' + rounds.length + ' partie' + (rounds.length>1?'s':'') + '</div>'
    +   '<div class="an-card-sub">Score moyen ' + avgScore + ' · Diff. moyen ' + avgDiff + '</div>'
    + '</div>'
    + '<div class="an-card-body">'
    +   '<div class="an-g3">'
    +     '<div style="text-align:center"><div style="font-size:28px;font-weight:700;color:var(--tx);letter-spacing:-1px">' + avgScore + '</div><div style="font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.08em;margin-top:4px">Score moyen</div></div>'
    +     '<div style="text-align:center"><div style="font-size:28px;font-weight:700;color:var(--ok2);letter-spacing:-1px">' + avgGir + '%</div><div style="font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.08em;margin-top:4px">GIR moyen</div></div>'
    +     '<div style="text-align:center"><div style="font-size:28px;font-weight:700;color:var(--gold-d);letter-spacing:-1px">' + avgFir + '%</div><div style="font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.08em;margin-top:4px">FIR moyen</div></div>'
    +   '</div>'
    + '</div>';
  page.appendChild(synth);

  // ── Strokes Gained détaillés ──
  var sgCard = document.createElement('div');
  sgCard.className = 'an-card';

  var sgBilan, sgBilanColor;
  if (sgTotal >= 0.5) { sgBilan = 'Tu joues globalement mieux que ton niveau ✓'; sgBilanColor = 'var(--ok2)'; }
  else if (sgTotal >= -0.5) { sgBilan = 'Tu joues globalement à ton niveau'; sgBilanColor = 'var(--gold-d)'; }
  else { sgBilan = 'Tu joues sous ton niveau — du potentiel à débloquer'; sgBilanColor = 'var(--ng2)'; }

  var sgRows = [
    { lbl: 'Drive', val: parseFloat(sgTee), desc: 'Driver & bois' },
    { lbl: 'Approche', val: parseFloat(sgApp), desc: 'Fers depuis le fairway' },
    { lbl: 'Jeu court', val: parseFloat(sgArg), desc: 'Chip, pitch, sortie de bunker' },
    { lbl: 'Putting', val: parseFloat(sgPutt), desc: 'Sur le green' }
  ];

  var sgRowsHtml = sgRows.map(function(r) {
    var color = r.val > 0.1 ? 'var(--ok2)' : (r.val < -0.1 ? 'var(--ng2)' : 'var(--tx3)');
    var sign = r.val >= 0 ? '+' : '';
    var pct = Math.min(100, Math.abs(r.val) * 50);
    return ''
      + '<div class="an-stat-row">'
      +   '<div class="an-stat-label">' + r.lbl + '<div style="font-size:9px;font-weight:500;color:var(--tx3);margin-top:2px">' + r.desc + '</div></div>'
      +   '<div class="an-stat-bar-wrap">'
      +     '<div class="an-stat-bar-track"><div class="an-stat-bar-fill" style="width:' + pct + '%;background:' + color + '"></div></div>'
      +   '</div>'
      +   '<div class="an-stat-value" style="color:' + color + '">' + sign + r.val.toFixed(2) + '</div>'
      + '</div>';
  }).join('');

  sgCard.innerHTML = ''
    + '<div class="an-card-header">'
    +   '<div class="an-card-title">Strokes Gained détaillés <span class="info-tip" title="Le Strokes Gained mesure combien de coups tu gagnes ou perds vs un joueur de ton niveau dans chaque catégorie. Positif = tu joues mieux. Négatif = à travailler.">?</span></div>'
    +   '<div class="an-card-sub" style="color:' + sgBilanColor + '">' + sgBilan + '</div>'
    + '</div>'
    + '<div class="an-card-body">'
    +   sgRowsHtml
    +   '<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--bd3);display:flex;justify-content:space-between;align-items:center">'
    +     '<div style="font-size:11px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.08em">Total Strokes Gained</div>'
    +     '<div style="font-size:22px;font-weight:700;color:' + (sgTotal>=0?'var(--ok2)':'var(--ng2)') + ';letter-spacing:-0.5px">' + (sgTotal>=0?'+':'') + sgTotal + ' coups/tour</div>'
    +   '</div>'
    + '</div>';
  page.appendChild(sgCard);

  // ── Heatmap Stableford ──
  page.appendChild(renderHeatmap(rounds));

  // ── Recommandations actionnables ──
  page.appendChild(renderRecommendations(rounds, sgRows));

  // ── Encart progressif ──
  if (rounds.length < 5) {
    var unlock = document.createElement('div');
    unlock.className = 'an-unlock-card';
    unlock.innerHTML = ''
      + '<div class="an-unlock-icon">\u25C8</div>'
      + '<div class="an-unlock-text">Avec <strong>' + (5 - rounds.length) + ' partie' + (5-rounds.length>1?'s':'') + ' supplémentaire' + (5-rounds.length>1?'s':'') + '</strong>, tu débloqueras la détection de tendances et des recommandations plus précises.</div>';
    page.appendChild(unlock);
  }
}

/* ────────────────────────────────────────
   Heatmap Stableford
──────────────────────────────────────── */
function renderHeatmap(rounds) {
  var card = document.createElement('div');
  card.className = 'an-card';

  // Construire la matrice : pour chaque (partie, trou) → score relatif au par
  // Si pas de données détaillées scores[], afficher juste les moyennes par trou
  var heatmapCells = '';

  // Calculer le score moyen par trou
  var avgByHole = new Array(18).fill(null);
  var courseRef = null;
  rounds.forEach(function(r) {
    if (r.scores && r.scores.length === 18) {
      r.scores.forEach(function(s, i) {
        if (s !== null) {
          if (avgByHole[i] === null) avgByHole[i] = { sum: 0, count: 0 };
          avgByHole[i].sum += s;
          avgByHole[i].count += 1;
        }
      });
    }
    // Récupérer le par du parcours le plus récent
    if (!courseRef) {
      var crs = (typeof COURSES !== 'undefined') ? COURSES.find(function(c) { return c.id === r.courseId; }) : null;
      if (crs) courseRef = crs;
    }
  });

  // Header
  heatmapCells += '<div class="an-heat-label"></div>';
  for (var i = 1; i <= 18; i++) {
    heatmapCells += '<div class="an-heat-header">' + i + '</div>';
  }

  // Ligne PAR
  heatmapCells += '<div class="an-heat-label">Par</div>';
  for (var j = 0; j < 18; j++) {
    var p = courseRef && courseRef.trous && courseRef.trous[j] ? courseRef.trous[j].par : '-';
    heatmapCells += '<div class="an-heat-cell" style="background:var(--bg2);color:var(--tx2)">' + p + '</div>';
  }

  // Ligne MOY
  heatmapCells += '<div class="an-heat-label">Moy</div>';
  for (var k = 0; k < 18; k++) {
    var avg = avgByHole[k];
    if (!avg || !courseRef) {
      heatmapCells += '<div class="an-heat-cell h-empty">-</div>';
      continue;
    }
    var avgScore = avg.sum / avg.count;
    var par = courseRef.trous[k] ? courseRef.trous[k].par : 4;
    var rel = avgScore - par;
    var cls = 'h-par';
    if (rel <= -1.5) cls = 'h-eagle';
    else if (rel <= -0.5) cls = 'h-birdie';
    else if (rel < 0.5) cls = 'h-par';
    else if (rel < 1.5) cls = 'h-bogey';
    else cls = 'h-double';
    heatmapCells += '<div class="an-heat-cell ' + cls + '" title="Trou ' + (k+1) + ' · Moyenne ' + avgScore.toFixed(1) + ' (par ' + par + ')">' + avgScore.toFixed(1) + '</div>';
  }

  card.innerHTML = ''
    + '<div class="an-card-header">'
    +   '<div class="an-card-title">Carte de chaleur par trou <span class="info-tip" title="Visualise tes performances trou par trou. Vert = sous le par (birdie/eagle). Or pâle = au par. Orange/rouge = au-dessus du par. Te montre où tu marques et où tu perds.">?</span></div>'
    +   '<div class="an-card-sub">Score moyen vs par par trou</div>'
    + '</div>'
    + '<div class="an-card-body">'
    +   '<div class="an-heatmap">' + heatmapCells + '</div>'
    +   '<div style="display:flex;gap:14px;margin-top:14px;font-size:10px;color:var(--tx3);font-weight:500;flex-wrap:wrap">'
    +     '<span><span style="display:inline-block;width:10px;height:10px;background:rgba(45,125,58,0.25);border-radius:2px;vertical-align:middle;margin-right:4px"></span>Birdie+</span>'
    +     '<span><span style="display:inline-block;width:10px;height:10px;background:rgba(168,133,30,0.10);border-radius:2px;vertical-align:middle;margin-right:4px"></span>Par</span>'
    +     '<span><span style="display:inline-block;width:10px;height:10px;background:rgba(196,94,10,0.18);border-radius:2px;vertical-align:middle;margin-right:4px"></span>Bogey</span>'
    +     '<span><span style="display:inline-block;width:10px;height:10px;background:rgba(192,57,43,0.22);border-radius:2px;vertical-align:middle;margin-right:4px"></span>Double+</span>'
    +   '</div>'
    + '</div>';
  return card;
}

/* ────────────────────────────────────────
   Recommandations actionnables (format 2 - détaillé pédagogique)
──────────────────────────────────────── */
function renderRecommendations(rounds, sgRows) {
  var card = document.createElement('div');
  card.className = 'an-card';

  // Trier sgRows : pire en premier
  var sorted = sgRows.slice().sort(function(a, b) { return a.val - b.val; });

  // Calculs supplémentaires pour les recommandations
  var avgGir = Math.round(rounds.reduce(function(a,r) { return a + r.gir; }, 0) / rounds.length / 18 * 100);
  var avgFir = Math.round(rounds.reduce(function(a,r) { var t = r.firTotal||14; return a + r.fir/t; }, 0) / rounds.length * 100);
  var avgPutts = rounds.filter(function(r) { return r.putts; }).reduce(function(a,r) { return a + r.putts; }, 0) / Math.max(1, rounds.filter(function(r) { return r.putts; }).length);

  var recos = [];

  // Priorité 1 : pire SG
  var worst = sorted[0];
  if (worst.val < -0.2) {
    var data1 = '', action1 = '';
    if (worst.lbl === 'Drive') {
      data1 = 'Ton FIR moyen est de <strong>' + avgFir + '%</strong> sur ' + rounds.length + ' parties. Tu perds en moyenne <strong>' + worst.val.toFixed(2) + ' coups/tour</strong> au départ par rapport à un joueur de ton niveau.';
      action1 = '<strong>Recommandation :</strong> Travaille la régularité du driver au practice. 30 min, 2x par semaine, avec un objectif de précision plutôt que de distance. Considère utiliser un bois 3 sur les trous étroits.';
    } else if (worst.lbl === 'Approche') {
      data1 = 'Ton GIR moyen est de <strong>' + avgGir + '%</strong> sur ' + rounds.length + ' parties. Les approches au green te coûtent <strong>' + Math.abs(worst.val).toFixed(2) + ' coups/tour</strong>.';
      action1 = '<strong>Recommandation :</strong> Focus sur les fers du milieu (6-7-8). Travaille au practice la distance par club. Objectif : connaître précisément ta distance moyenne pour chaque fer.';
    } else if (worst.lbl === 'Jeu court') {
      data1 = 'Ton jeu court (chip, wedge, bunker) te coûte <strong>' + Math.abs(worst.val).toFixed(2) + ' coups/tour</strong>. C\'est ta plus grosse marge de progression.';
      action1 = '<strong>Recommandation :</strong> 70% du practice devrait être consacré au jeu court d\'ici les prochaines parties. Focus sur les sorties de bunker et les chips de 5-20m. C\'est le plus rentable pour faire baisser ton score.';
    } else {
      data1 = 'Tu utilises en moyenne <strong>' + avgPutts.toFixed(1) + ' putts/tour</strong>. Les putts te coûtent <strong>' + Math.abs(worst.val).toFixed(2) + ' coups/tour</strong>.';
      action1 = '<strong>Recommandation :</strong> Travaille les putts de 1 à 3m. Drill : 10 putts d\'affilée à 1m, puis à 2m, puis à 3m. Objectif : convertir 90% des putts courts.';
    }
    recos.push({ priority: 'urgent', title: 'PRIORITÉ N°1 — Travailler en priorité : ' + worst.lbl, data: data1, action: action1 });
  }

  // Priorité 2 : deuxième pire si différent
  if (sorted[1] && sorted[1].val < -0.1) {
    var second = sorted[1];
    var data2 = 'Tu perds <strong>' + Math.abs(second.val).toFixed(2) + ' coups/tour</strong> sur la catégorie ' + second.lbl + '. C\'est ta deuxième priorité.';
    var action2 = '<strong>Recommandation :</strong> Une fois ' + worst.lbl + ' amélioré, focus sur ce point. Idéalement, 1 séance practice par semaine dédiée à ' + second.lbl + '.';
    recos.push({ priority: 'normal', title: 'PRIORITÉ N°2 — ' + second.lbl, data: data2, action: action2 });
  }

  // Point fort à conserver
  var best = sorted[sorted.length - 1];
  if (best.val > 0.1) {
    var data3 = 'Tu es <strong>+' + best.val.toFixed(2) + ' coups/tour</strong> sur ' + best.lbl + '. C\'est ton point fort.';
    var action3 = '<strong>Garde ce niveau :</strong> Continue de pratiquer cette catégorie 1x par semaine pour maintenir ton avantage. Ne sacrifie pas ton point fort pour travailler tes faiblesses.';
    recos.push({ priority: 'positive', title: 'POINT FORT — ' + best.lbl, data: data3, action: action3 });
  }

  if (recos.length === 0) {
    recos.push({
      priority: 'positive',
      title: 'Performance équilibrée',
      data: 'Tu n\'as pas de point faible majeur identifié sur les ' + rounds.length + ' dernières parties. Ton jeu est globalement équilibré.',
      action: '<strong>Continue ainsi :</strong> Maintiens un entraînement régulier sur tous les compartiments du jeu pour préserver cet équilibre.'
    });
  }

  var recosHtml = recos.map(function(r) {
    return ''
      + '<div class="an-reco ' + r.priority + '" style="margin-bottom:10px">'
      +   '<div class="an-reco-priority">' + r.title.split(' — ')[0] + '</div>'
      +   '<div class="an-reco-content">'
      +     '<div class="an-reco-title">' + (r.title.split(' — ')[1] || r.title) + '</div>'
      +     '<div class="an-reco-data">' + r.data + '</div>'
      +     '<div class="an-reco-action">' + r.action + '</div>'
      +   '</div>'
      + '</div>';
  }).join('');

  card.innerHTML = ''
    + '<div class="an-card-header">'
    +   '<div class="an-card-title">Tes priorités de travail</div>'
    +   '<div class="an-card-sub">Recommandations basées sur tes données</div>'
    + '</div>'
    + '<div class="an-card-body" style="padding:14px 18px">'
    +   recosHtml
    + '</div>';
  return card;
}

/* ────────────────────────────────────────
   SOUS-ONGLET 2 : PRÉCISION
──────────────────────────────────────── */
function renderPrecision() {
  var page = document.getElementById('an-sub-precision');
  if (!page) return;
  page.innerHTML = '';

  var rounds = getAnalyseRounds();
  if (rounds.length === 0) { page.appendChild(makeEmptyCard('precision')); return; }

  // ── Dispersion drive (gauche/centre/droite) ──
  // Si données détaillées : utiliser fairwayPos, sinon estimer depuis FIR
  var dispCard = document.createElement('div');
  dispCard.className = 'an-card';

  var firTotal = 0, firHit = 0, leftMiss = 0, rightMiss = 0, otherMiss = 0;
  var hasDetail = false;
  rounds.forEach(function(r) {
    if (r.fairwayPos && Array.isArray(r.fairwayPos)) {
      hasDetail = true;
      r.fairwayPos.forEach(function(pos) {
        if (!pos) return;
        firTotal++;
        if (pos === 'fairway') firHit++;
        else if (pos === 'rough-l' || pos === 'bunker-l') leftMiss++;
        else if (pos === 'rough-r' || pos === 'bunker-r') rightMiss++;
        else otherMiss++;
      });
    } else {
      firTotal += (r.firTotal || 14);
      firHit += r.fir;
    }
  });

  if (!hasDetail) {
    // Estimation : répartir les misses équitablement
    var misses = firTotal - firHit;
    leftMiss = Math.floor(misses / 2);
    rightMiss = misses - leftMiss;
  }

  var leftPct = firTotal > 0 ? Math.round(leftMiss / firTotal * 100) : 0;
  var centerPct = firTotal > 0 ? Math.round(firHit / firTotal * 100) : 0;
  var rightPct = firTotal > 0 ? Math.round(rightMiss / firTotal * 100) : 0;

  dispCard.innerHTML = ''
    + '<div class="an-card-header">'
    +   '<div class="an-card-title">Dispersion au départ <span class="info-tip" title="Où finit ta balle après le drive. Plus la zone centrale est grande, plus tu es précis. Une forte tendance vers la gauche ou la droite signale un défaut de swing à corriger.">?</span></div>'
    +   '<div class="an-card-sub">' + firTotal + ' départs analysés' + (hasDetail ? '' : ' · données estimées') + '</div>'
    + '</div>'
    + '<div class="an-card-body">'
    +   '<div class="an-dispersion">'
    +     '<div class="an-disp-zone"><div class="an-disp-value">' + leftPct + '%</div><div class="an-disp-label">Gauche</div></div>'
    +     '<div class="an-disp-zone center"><div class="an-disp-value">' + centerPct + '%</div><div class="an-disp-label">Fairway</div></div>'
    +     '<div class="an-disp-zone"><div class="an-disp-value">' + rightPct + '%</div><div class="an-disp-label">Droite</div></div>'
    +   '</div>'
    +   (hasDetail ? '' : '<div style="margin-top:12px;padding:10px 14px;background:var(--gold-dim2);border-radius:8px;font-size:11px;color:var(--tx2);line-height:1.5"><strong style="color:var(--gold-d)">Astuce :</strong> Active la <strong>saisie détaillée</strong> dans la Scorecard pour avoir la vraie dispersion (gauche/centre/droite) au lieu d\'une estimation.</div>')
    + '</div>';
  page.appendChild(dispCard);

  // ── Précision GIR par catégorie de par ──
  var girCard = document.createElement('div');
  girCard.className = 'an-card';

  var girPar3 = { hit: 0, total: 0 }, girPar4 = { hit: 0, total: 0 }, girPar5 = { hit: 0, total: 0 };
  rounds.forEach(function(r) {
    var crs = (typeof COURSES !== 'undefined') ? COURSES.find(function(c) { return c.id === r.courseId; }) : null;
    if (!crs || !crs.trous) return;
    if (r.scores && r.scores.length === 18) {
      r.scores.forEach(function(s, i) {
        if (s === null) return;
        var par = crs.trous[i] ? crs.trous[i].par : 4;
        var hit = (s - par) <= 0;  // approximation : score <= par signifie probablement GIR
        if (par === 3) { girPar3.total++; if (hit) girPar3.hit++; }
        else if (par === 4) { girPar4.total++; if (hit) girPar4.hit++; }
        else if (par === 5) { girPar5.total++; if (hit) girPar5.hit++; }
      });
    }
  });

  function pctRow(name, obj, color) {
    var pct = obj.total > 0 ? Math.round(obj.hit / obj.total * 100) : 0;
    return ''
      + '<div class="an-stat-row">'
      +   '<div class="an-stat-label">' + name + '</div>'
      +   '<div class="an-stat-bar-wrap">'
      +     '<div class="an-stat-bar-track"><div class="an-stat-bar-fill" style="width:' + pct + '%;background:' + color + '"></div></div>'
      +   '</div>'
      +   '<div class="an-stat-value">' + pct + '%</div>'
      +   '<div class="an-stat-trend" style="color:var(--tx3)">' + obj.hit + '/' + obj.total + '</div>'
      + '</div>';
  }

  girCard.innerHTML = ''
    + '<div class="an-card-header">'
    +   '<div class="an-card-title">Greens par type de trou <span class="info-tip" title="Approximation basée sur le score. Si tu fais le par ou mieux, on considère que tu as touché le green en régulation. Pour la vraie donnée GIR, active la saisie détaillée.">?</span></div>'
    +   '<div class="an-card-sub">Pourcentage de greens atteints en régulation</div>'
    + '</div>'
    + '<div class="an-card-body">'
    +   pctRow('Par 3', girPar3, 'var(--ok2)')
    +   pctRow('Par 4', girPar4, 'var(--gold)')
    +   pctRow('Par 5', girPar5, 'var(--ng2)')
    + '</div>';
  page.appendChild(girCard);

  // Encart "Active saisie détaillée"
  // ── Carte Session 12 : Répartition des miss au drive ──
  var missCounts = { left: 0, right: 0, long: 0, short: 0 };
  var totalMiss = 0;
  var totalDriveAttempts = 0;

  rounds.forEach(function(r) {
    var missMap = r.shotsFairwayMissSide || {};
    var fairwayMap = r.shotsFairway || {};
    // On regarde chaque trou par 4 ou par 5 qui a une donnée FIR enregistrée
    Object.keys(fairwayMap).forEach(function(holeKey) {
      var state = fairwayMap[holeKey];
      if (state === 'yes' || state === 'no') {
        totalDriveAttempts++;
      }
      if (state === 'no') {
        var side = missMap[holeKey];
        if (side && missCounts.hasOwnProperty(side)) {
          missCounts[side]++;
          totalMiss++;
        }
      }
    });
  });

  if (totalMiss > 0) {
    var missCard = document.createElement('div');
    missCard.className = 'an-card';

    function missRow(label, count, total, color) {
      var pct = total > 0 ? Math.round(count / total * 100) : 0;
      return ''
        + '<div class="an-stat-row">'
        +   '<div class="an-stat-label">' + label + '</div>'
        +   '<div class="an-stat-bar-wrap">'
        +     '<div class="an-stat-bar-track"><div class="an-stat-bar-fill" style="width:' + pct + '%;background:' + color + '"></div></div>'
        +   '</div>'
        +   '<div class="an-stat-value">' + pct + '%</div>'
        +   '<div class="an-stat-trend" style="color:var(--tx3)">' + count + '/' + total + '</div>'
        + '</div>';
    }

    // Verdict
    var dominantSide = '';
    var dominantPct = 0;
    ['left', 'right', 'long', 'short'].forEach(function(s) {
      var p = totalMiss > 0 ? (missCounts[s] / totalMiss * 100) : 0;
      if (p > dominantPct) { dominantPct = p; dominantSide = s; }
    });
    var sideLabel = { left: 'gauche', right: 'droite', long: 'longue', short: 'courte' }[dominantSide] || '';
    var verdict = '';
    if (dominantPct >= 60) {
      verdict = 'Tendance marqu\u00e9e \u00e0 manquer \u00e0 ' + sideLabel + ' (' + Math.round(dominantPct) + '% des miss). \u00c0 travailler en priorit\u00e9 au practice.';
    } else if (dominantPct >= 45) {
      verdict = 'L\u00e9g\u00e8re tendance \u00e0 ' + sideLabel + ' (' + Math.round(dominantPct) + '%). Surveille ton alignement et ta routine.';
    } else {
      verdict = 'Tes miss sont r\u00e9partis assez \u00e9quitablement. Pas de tendance directionnelle marqu\u00e9e.';
    }

    missCard.innerHTML = ''
      + '<div class="an-card-header">'
      +   '<div class="an-card-title">R\u00e9partition des miss au drive <span class="info-tip" title="Sur les drives qui n\'ont pas atteint le fairway, de quel c\u00f4t\u00e9 la balle a-t-elle fini ?">?</span></div>'
      +   '<div class="an-card-sub">' + verdict + '</div>'
      + '</div>'
      + '<div class="an-card-body">'
      +   missRow('\u2b05\ufe0f Gauche', missCounts.left, totalMiss, 'var(--ng)')
      +   missRow('\u27a1\ufe0f Droite', missCounts.right, totalMiss, 'var(--gold-d)')
      +   missRow('\ud83d\udd3c Long', missCounts.long, totalMiss, 'var(--wn)')
      +   missRow('\ud83d\udd3d Court', missCounts.short, totalMiss, 'var(--ok2)')
      +   '<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--bd3);font-size:11px;color:var(--tx3);text-align:center">'
      +     'Sur ' + totalDriveAttempts + ' drives analys\u00e9s : ' + (totalDriveAttempts - totalMiss) + ' sur le fairway, ' + totalMiss + ' avec c\u00f4t\u00e9 du miss renseign\u00e9'
      +   '</div>'
      + '</div>';
    page.appendChild(missCard);
  }

  if (!hasDetail) {
    var unlock = document.createElement('div');
    unlock.className = 'an-unlock-card';
    unlock.innerHTML = ''
      + '<div class="an-unlock-icon">\u25C8</div>'
      + '<div class="an-unlock-text"><strong>Débloque la dispersion club par club</strong> en activant la saisie détaillée dans la Scorecard. Tu pourras voir exactement où va ta balle avec chaque club (driver, fers, wedges).</div>';
    page.appendChild(unlock);
  }
}

/* ────────────────────────────────────────
   SOUS-ONGLET 3 : PUTTING (Session 9)
──────────────────────────────────────── */
function renderPutting() {
  var page = document.getElementById('an-sub-putting');
  if (!page) return;
  page.innerHTML = '';

  var rounds = getAnalyseRounds();
  if (rounds.length === 0) { page.appendChild(makeEmptyCard('putting')); return; }

  // ── Calculs des statistiques putting ──

  // 1. Moyenne de putts par green (par trou)
  var totalPutts = 0;
  var totalHoles = 0;
  rounds.forEach(function(r) {
    if (r.putts && Array.isArray(r.putts)) {
      r.putts.forEach(function(p) {
        if (p !== null && p !== undefined) {
          totalPutts += p;
          totalHoles++;
        }
      });
    }
  });
  var avgPuttsPerHole = totalHoles > 0 ? (totalPutts / totalHoles) : 0;

  // 2. Distribution 1 putt / 2 putts / 3+ putts
  // Pour les rounds Pro avec shots, on peut détecter précisément
  // Pour les rounds Rapide, on utilise putts[i] directement
  var dist = { 0: 0, 1: 0, 2: 0, 3: 0, '4plus': 0 };
  var distTotal = 0;
  rounds.forEach(function(r) {
    if (r.putts && Array.isArray(r.putts)) {
      r.putts.forEach(function(p) {
        if (p === null || p === undefined) return;
        if (p === 0) dist[0]++;
        else if (p === 1) dist[1]++;
        else if (p === 2) dist[2]++;
        else if (p === 3) dist[3]++;
        else dist['4plus']++;
        distTotal++;
      });
    }
  });

  // 3. Moyenne par catégorie de par (par 3 / par 4 / par 5)
  var puttsByPar = { 3: { sum: 0, count: 0 }, 4: { sum: 0, count: 0 }, 5: { sum: 0, count: 0 } };
  rounds.forEach(function(r) {
    var crs = (typeof COURSES !== 'undefined') ? (typeof getAllCourses === 'function' ? getAllCourses() : COURSES).find(function(c) { return c.id === r.courseId; }) : null;
    if (!crs || !crs.trous || !r.putts) return;
    r.putts.forEach(function(p, i) {
      if (p === null || p === undefined) return;
      var par = crs.trous[i] ? crs.trous[i].par : 4;
      if (puttsByPar[par]) {
        puttsByPar[par].sum += p;
        puttsByPar[par].count++;
      }
    });
  });

  // ── Carte 1 : Synthèse ──
  var synthCard = document.createElement('div');
  synthCard.className = 'an-card';

  // Verdict moyenne putts
  var avgVerdict, avgVerdictColor;
  if (avgPuttsPerHole < 1.8) { avgVerdict = 'Excellent niveau au putting'; avgVerdictColor = 'var(--ok2)'; }
  else if (avgPuttsPerHole < 2.0) { avgVerdict = 'Bon niveau au putting'; avgVerdictColor = 'var(--ok2)'; }
  else if (avgPuttsPerHole < 2.3) { avgVerdict = 'Niveau moyen au putting'; avgVerdictColor = 'var(--gold-d)'; }
  else { avgVerdict = 'Niveau à travailler au putting'; avgVerdictColor = 'var(--ng2)'; }

  var puttsPerRound = rounds.length > 0 ? (totalPutts / rounds.length).toFixed(1) : '—';

  synthCard.innerHTML = ''
    + '<div class="an-card-header">'
    +   '<div class="an-card-title">Synthèse Putting <span class="info-tip" title="Au-dessous de 1.8 putts/green = excellent. Entre 1.8 et 2.0 = bon niveau. Au-dessus de 2.3 = à travailler en priorité.">?</span></div>'
    +   '<div class="an-card-sub" style="color:' + avgVerdictColor + '">' + avgVerdict + '</div>'
    + '</div>'
    + '<div class="an-card-body">'
    +   '<div class="an-g3">'
    +     '<div style="text-align:center"><div style="font-size:28px;font-weight:700;color:var(--tx);letter-spacing:-1px">' + avgPuttsPerHole.toFixed(2) + '</div><div style="font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.08em;margin-top:4px">Putts / green</div></div>'
    +     '<div style="text-align:center"><div style="font-size:28px;font-weight:700;color:var(--gold-d);letter-spacing:-1px">' + puttsPerRound + '</div><div style="font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.08em;margin-top:4px">Putts / partie</div></div>'
    +     '<div style="text-align:center"><div style="font-size:28px;font-weight:700;color:var(--ok2);letter-spacing:-1px">' + totalHoles + '</div><div style="font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.08em;margin-top:4px">Greens analysés</div></div>'
    +   '</div>'
    + '</div>';
  page.appendChild(synthCard);

  // ── Carte 2 : Distribution 1/2/3 putts ──
  var distCard = document.createElement('div');
  distCard.className = 'an-card';

  function pctRow(label, count, total, color) {
    var pct = total > 0 ? Math.round(count / total * 100) : 0;
    return ''
      + '<div class="an-stat-row">'
      +   '<div class="an-stat-label">' + label + '</div>'
      +   '<div class="an-stat-bar-wrap">'
      +     '<div class="an-stat-bar-track"><div class="an-stat-bar-fill" style="width:' + pct + '%;background:' + color + '"></div></div>'
      +   '</div>'
      +   '<div class="an-stat-value">' + pct + '%</div>'
      +   '<div class="an-stat-trend" style="color:var(--tx3)">' + count + '/' + total + '</div>'
      + '</div>';
  }

  var threePuttPct = distTotal > 0 ? Math.round((dist[3] + dist['4plus']) / distTotal * 100) : 0;
  var threePuttColor = threePuttPct <= 5 ? 'var(--ok2)' : threePuttPct <= 12 ? 'var(--gold-d)' : 'var(--ng2)';

  distCard.innerHTML = ''
    + '<div class="an-card-header">'
    +   '<div class="an-card-title">Distribution des putts par trou</div>'
    +   '<div class="an-card-sub">' + threePuttPct + '% de 3-putts (ou +) — ' + (threePuttPct <= 5 ? 'excellent' : threePuttPct <= 12 ? 'normal' : 'à travailler en priorité') + '</div>'
    + '</div>'
    + '<div class="an-card-body">'
    +   pctRow('1 putt 🎯', dist[1], distTotal, 'var(--ok2)')
    +   pctRow('2 putts', dist[2], distTotal, 'var(--gold)')
    +   pctRow('3 putts ⚠', dist[3], distTotal, 'var(--ng)')
    +   (dist['4plus'] > 0 ? pctRow('4+ putts', dist['4plus'], distTotal, 'var(--ng2)') : '')
    + '</div>';
  page.appendChild(distCard);

  // ── Carte 3 : Putts par catégorie de trou ──
  var byParCard = document.createElement('div');
  byParCard.className = 'an-card';

  function parRow(label, obj, color) {
    var avg = obj.count > 0 ? (obj.sum / obj.count).toFixed(2) : '—';
    var pct = obj.count > 0 ? Math.min(100, (obj.sum / obj.count) / 3 * 100) : 0;
    return ''
      + '<div class="an-stat-row">'
      +   '<div class="an-stat-label">' + label + '</div>'
      +   '<div class="an-stat-bar-wrap">'
      +     '<div class="an-stat-bar-track"><div class="an-stat-bar-fill" style="width:' + pct + '%;background:' + color + '"></div></div>'
      +   '</div>'
      +   '<div class="an-stat-value">' + avg + '</div>'
      +   '<div class="an-stat-trend" style="color:var(--tx3)">' + obj.count + ' trous</div>'
      + '</div>';
  }

  byParCard.innerHTML = ''
    + '<div class="an-card-header">'
    +   '<div class="an-card-title">Moyenne par type de trou</div>'
    +   '<div class="an-card-sub">Putts moyens selon le par du trou</div>'
    + '</div>'
    + '<div class="an-card-body">'
    +   parRow('Par 3', puttsByPar[3], 'var(--ok2)')
    +   parRow('Par 4', puttsByPar[4], 'var(--gold)')
    +   parRow('Par 5', puttsByPar[5], 'var(--gold-d)')
    + '</div>';
  page.appendChild(byParCard);

  // ── Carte 4 : Recommandations actionnables ──
  var recoCard = document.createElement('div');
  recoCard.className = 'an-card';

  var recos = [];
  if (threePuttPct > 12) {
    recos.push({
      priority: 'urgent',
      title: 'PRIORITÉ — Réduire les 3-putts',
      data: 'Tu fais <strong>' + (dist[3] + dist['4plus']) + ' trois-putts</strong> sur ' + distTotal + ' greens (' + threePuttPct + '%). Chacun te coûte 1 coup directement.',
      action: '<strong>Recommandation :</strong> Travaille les putts longs (>5m) au practice. Drill : 10 putts depuis 8m, focus sur la distance plutôt que la ligne. Objectif : descendre à <10% de 3-putts.'
    });
  } else if (threePuttPct > 5) {
    recos.push({
      priority: 'normal',
      title: 'MARGE DE PROGRESSION — Putts longs',
      data: 'Tu fais <strong>' + threePuttPct + '% de 3-putts</strong>. Niveau correct mais améliorable.',
      action: '<strong>Recommandation :</strong> 15 min de putts longs (>5m) à chaque séance practice. Focus sur le contrôle de distance.'
    });
  }

  if (dist[1] / distTotal > 0.25) {
    recos.push({
      priority: 'positive',
      title: 'POINT FORT — Conversion 1-putt',
      data: '<strong>' + Math.round(dist[1] / distTotal * 100) + '% de tes greens en 1 putt</strong> — c\'est très bon, signe d\'un bon putting court.',
      action: '<strong>Garde ce niveau :</strong> Continue tes drills de putts courts (<3m) régulièrement pour maintenir cette qualité.'
    });
  }

  if (puttsByPar[5].count > 0 && (puttsByPar[5].sum / puttsByPar[5].count) > 2.1) {
    recos.push({
      priority: 'normal',
      title: 'PRIORITÉ — Putts sur les Par 5',
      data: 'Sur les <strong>Par 5</strong>, tu fais en moyenne <strong>' + (puttsByPar[5].sum / puttsByPar[5].count).toFixed(2) + ' putts</strong>. Les Par 5 te donnent souvent des opportunités de birdie.',
      action: '<strong>Recommandation :</strong> Quand tu es sur un Par 5 en régulation, prends le temps de lire le green. Une opportunité de birdie ne se rate pas.'
    });
  }

  if (recos.length === 0) {
    recos.push({
      priority: 'positive',
      title: 'Putting solide',
      data: 'Tes statistiques de putting sont saines sur les <strong>' + rounds.length + ' parties</strong> analysées. Pas de point faible identifié.',
      action: '<strong>Garde le rythme :</strong> Maintenir 10-15 min de putting à chaque session pour préserver ce niveau.'
    });
  }

  var recosHtml = recos.map(function(r) {
    return ''
      + '<div class="an-reco ' + r.priority + '" style="margin-bottom:10px">'
      +   '<div class="an-reco-priority">' + r.title.split(' — ')[0] + '</div>'
      +   '<div class="an-reco-content">'
      +     '<div class="an-reco-title">' + (r.title.split(' — ')[1] || r.title) + '</div>'
      +     '<div class="an-reco-data">' + r.data + '</div>'
      +     '<div class="an-reco-action">' + r.action + '</div>'
      +   '</div>'
      + '</div>';
  }).join('');

  recoCard.innerHTML = ''
    + '<div class="an-card-header">'
    +   '<div class="an-card-title">Recommandations Putting</div>'
    +   '<div class="an-card-sub">Basé sur tes données réelles</div>'
    + '</div>'
    + '<div class="an-card-body" style="padding:14px 18px">'
    +   recosHtml
    + '</div>';
  page.appendChild(recoCard);

  // ── Carte progressive si peu de parties ──
  if (rounds.length < 5) {
    var unlock = document.createElement('div');
    unlock.className = 'an-unlock-card';
    unlock.innerHTML = ''
      + '<div class="an-unlock-icon">\u25C9</div>'
      + '<div class="an-unlock-text">Avec <strong>' + (5 - rounds.length) + ' partie' + (5 - rounds.length > 1 ? 's' : '') + ' supplémentaire' + (5 - rounds.length > 1 ? 's' : '') + '</strong>, tu débloqueras des analyses plus précises sur ton putting (détection de tendances, comparaisons mensuelles).</div>';
    page.appendChild(unlock);
  }
}

/* ────────────────────────────────────────
   SOUS-ONGLET 4 : ÉVOLUTION (Session 9)
──────────────────────────────────────── */

// Registry pour détruire les charts évolution avant rebuild
var _evolutionCharts = {};

function _destroyEvolutionCharts() {
  if (typeof Chart !== 'undefined') {
    ['evo-hcp-chart', 'evo-sg-chart', 'evo-score-chart'].forEach(function(id) {
      if (Chart.getChart) {
        var existing = Chart.getChart(id);
        if (existing) { try { existing.destroy(); } catch(e) {} }
      }
    });
  }
  Object.keys(_evolutionCharts).forEach(function(k) { delete _evolutionCharts[k]; });
}

function renderEvolution() {
  var page = document.getElementById('an-sub-evolution');
  if (!page) return;

  // Détruire les anciens charts avant de rebuild
  _destroyEvolutionCharts();

  page.innerHTML = '';

  var rounds = getAnalyseRounds();
  if (rounds.length === 0) { page.appendChild(makeEmptyCard('evolution')); return; }

  // Cas particulier : 1 seule partie = pas d'évolution possible
  if (rounds.length < 2) {
    var info = document.createElement('div');
    info.className = 'an-empty-card';
    info.innerHTML = ''
      + '<div class="an-empty-icon">\u25B2</div>'
      + '<div class="an-empty-title">Évolution disponible à partir de 2 parties</div>'
      + '<div class="an-empty-text">Tu as actuellement <strong>' + rounds.length + ' partie' + (rounds.length > 1 ? 's' : '') + ' enregistrée' + (rounds.length > 1 ? 's' : '') + '</strong>. Saisis au moins une partie de plus pour voir ton évolution dans le temps.</div>';
    page.appendChild(info);
    return;
  }

  // rounds est dans l'ordre récent → ancien. On inverse pour avoir chronologique.
  var chrono = rounds.slice().reverse();

  // Calculer first vs last pour KPIs
  var firstScore = chrono[0].score;
  var lastScore = chrono[chrono.length - 1].score;
  var deltaScore = lastScore - firstScore;

  var firstDiff = chrono[0].diff || 0;
  var lastDiff = chrono[chrono.length - 1].diff || 0;
  var deltaDiff = (lastDiff - firstDiff).toFixed(1);

  // SG total premier vs dernier
  function sgTotal(r) {
    return (r.sg_tee || 0) + (r.sg_app || 0) + (r.sg_arg || 0) + (r.sg_putt || 0);
  }
  var firstSg = sgTotal(chrono[0]);
  var lastSg = sgTotal(chrono[chrono.length - 1]);
  var deltaSg = (lastSg - firstSg).toFixed(2);

  // ── Carte 1 : Synthèse de la progression ──
  var synthCard = document.createElement('div');
  synthCard.className = 'an-card';

  function trendIcon(delta, lowerIsBetter) {
    var n = parseFloat(delta);
    if (Math.abs(n) < 0.1) return { icon: '→', color: 'var(--tx3)', label: 'Stable' };
    var positive = lowerIsBetter ? n < 0 : n > 0;
    return positive
      ? { icon: '↗', color: 'var(--ok2)', label: 'Amélioration' }
      : { icon: '↘', color: 'var(--ng2)', label: 'Recul' };
  }

  var scoreTrend = trendIcon(deltaScore, true);
  var diffTrend = trendIcon(deltaDiff, true);
  var sgTrend = trendIcon(deltaSg, false);

  synthCard.innerHTML = ''
    + '<div class="an-card-header">'
    +   '<div class="an-card-title">Synthèse de ta progression</div>'
    +   '<div class="an-card-sub">Comparaison première partie vs dernière partie analysée</div>'
    + '</div>'
    + '<div class="an-card-body">'
    +   '<div class="an-g3">'
    +     '<div style="text-align:center;padding:10px"><div style="font-size:11px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">Score</div>'
    +       '<div style="font-size:24px;font-weight:700;color:' + scoreTrend.color + ';letter-spacing:-0.5px">' + scoreTrend.icon + ' ' + (deltaScore > 0 ? '+' : '') + deltaScore + '</div>'
    +       '<div style="font-size:10px;color:var(--tx3);margin-top:4px">' + firstScore + ' → ' + lastScore + '</div></div>'
    +     '<div style="text-align:center;padding:10px"><div style="font-size:11px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">Différentiel</div>'
    +       '<div style="font-size:24px;font-weight:700;color:' + diffTrend.color + ';letter-spacing:-0.5px">' + diffTrend.icon + ' ' + (deltaDiff > 0 ? '+' : '') + deltaDiff + '</div>'
    +       '<div style="font-size:10px;color:var(--tx3);margin-top:4px">' + firstDiff.toFixed(1) + ' → ' + lastDiff.toFixed(1) + '</div></div>'
    +     '<div style="text-align:center;padding:10px"><div style="font-size:11px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">Strokes Gained</div>'
    +       '<div style="font-size:24px;font-weight:700;color:' + sgTrend.color + ';letter-spacing:-0.5px">' + sgTrend.icon + ' ' + (deltaSg > 0 ? '+' : '') + deltaSg + '</div>'
    +       '<div style="font-size:10px;color:var(--tx3);margin-top:4px">' + firstSg.toFixed(2) + ' → ' + lastSg.toFixed(2) + '</div></div>'
    +   '</div>'
    + '</div>';
  page.appendChild(synthCard);

  // ── Carte 2 : Graphique évolution du Différentiel ──
  var diffChartCard = document.createElement('div');
  diffChartCard.className = 'an-card';
  diffChartCard.innerHTML = ''
    + '<div class="an-card-header">'
    +   '<div class="an-card-title">Évolution du différentiel <span class="info-tip" title="Le différentiel est le score net (score - SSS) corrigé par le slope. C\'est la base du calcul du handicap. Plus il baisse, mieux tu joues.">?</span></div>'
    +   '<div class="an-card-sub">Courbe sur les ' + chrono.length + ' parties analysées</div>'
    + '</div>'
    + '<div class="an-card-body" style="padding:14px 18px"><div style="height:240px;position:relative"><canvas id="evo-hcp-chart"></canvas></div></div>';
  page.appendChild(diffChartCard);

  // ── Carte 3 : Graphique évolution Strokes Gained par catégorie ──
  var sgChartCard = document.createElement('div');
  sgChartCard.className = 'an-card';
  sgChartCard.innerHTML = ''
    + '<div class="an-card-header">'
    +   '<div class="an-card-title">Évolution des Strokes Gained</div>'
    +   '<div class="an-card-sub">4 catégories suivies dans le temps</div>'
    + '</div>'
    + '<div class="an-card-body" style="padding:14px 18px"><div style="height:280px;position:relative"><canvas id="evo-sg-chart"></canvas></div></div>';
  page.appendChild(sgChartCard);

  // ── Carte 4 : Détection de tendances et plateaux ──
  var trendsCard = document.createElement('div');
  trendsCard.className = 'an-card';

  // Logique de détection simple
  var insights = [];

  // Tendance globale du score sur les dernières parties
  if (chrono.length >= 5) {
    var lastFive = chrono.slice(-5);
    var firstFive = chrono.slice(0, 5);
    var avgLast = lastFive.reduce(function(a, r) { return a + r.score; }, 0) / 5;
    var avgFirst = firstFive.reduce(function(a, r) { return a + r.score; }, 0) / 5;
    var trend = avgLast - avgFirst;

    if (trend < -2) {
      insights.push({ icon: '\u2197', color: 'var(--ok2)', title: 'Belle progression', text: 'Tes 5 dernières parties sont en moyenne <strong>' + Math.abs(trend).toFixed(1) + ' coups meilleures</strong> que tes 5 premières. Continue sur cette lancée !' });
    } else if (trend > 2) {
      insights.push({ icon: '\u2198', color: 'var(--ng2)', title: 'Période plus difficile', text: 'Tes 5 dernières parties sont en moyenne <strong>+' + trend.toFixed(1) + ' coups</strong> par rapport à tes 5 premières. Analyse les raisons (forme, parcours, météo).' });
    } else {
      insights.push({ icon: '\u2192', color: 'var(--gold-d)', title: 'Période stable', text: 'Ton score moyen est stable (' + (trend > 0 ? '+' : '') + trend.toFixed(1) + ' coups). C\'est le moment de cibler un point précis à améliorer pour franchir un palier.' });
    }
  }

  // Détecter la meilleure et la pire période
  if (chrono.length >= 3) {
    var bestRound = chrono.reduce(function(b, r) { return r.score < b.score ? r : b; }, chrono[0]);
    var worstRound = chrono.reduce(function(w, r) { return r.score > w.score ? r : w; }, chrono[0]);
    insights.push({ icon: '\u2605', color: 'var(--gold-d)', title: 'Meilleure partie analysée', text: 'Score de <strong>' + bestRound.score + '</strong> le ' + (bestRound.date || '—') + (bestRound.course ? ' à ' + bestRound.course : '') + '. À reproduire en analysant ce qui a marché ce jour-là.' });
  }

  // Tendance du putting si données disponibles
  var puttsByRound = chrono.map(function(r) {
    if (!r.putts || !Array.isArray(r.putts)) return null;
    var total = 0, count = 0;
    r.putts.forEach(function(p) { if (p !== null && p !== undefined) { total += p; count++; } });
    return count > 0 ? total : null;
  }).filter(function(v) { return v !== null; });
  if (puttsByRound.length >= 4) {
    var firstHalf = puttsByRound.slice(0, Math.floor(puttsByRound.length / 2));
    var secondHalf = puttsByRound.slice(Math.floor(puttsByRound.length / 2));
    var avgFirstP = firstHalf.reduce(function(a, b) { return a + b; }, 0) / firstHalf.length;
    var avgSecondP = secondHalf.reduce(function(a, b) { return a + b; }, 0) / secondHalf.length;
    var puttsTrend = avgSecondP - avgFirstP;
    if (puttsTrend < -1) {
      insights.push({ icon: '\u25C9', color: 'var(--ok2)', title: 'Putting en progression', text: 'Tu fais en moyenne <strong>' + Math.abs(puttsTrend).toFixed(1) + ' putts de moins</strong> par partie sur la 2e moitié de la période. Bon travail au putting !' });
    } else if (puttsTrend > 1) {
      insights.push({ icon: '\u25C9', color: 'var(--ng2)', title: 'Putting à reprendre', text: 'Tu fais en moyenne <strong>+' + puttsTrend.toFixed(1) + ' putts</strong> par partie récemment. Reprends des séances de putting au practice.' });
    }
  }

  if (insights.length === 0) {
    insights.push({ icon: '\u25B2', color: 'var(--gold-d)', title: 'Pas encore assez de données', text: 'Continue à saisir tes parties pour débloquer la détection automatique de tendances et de plateaux.' });
  }

  var insightsHtml = insights.map(function(i) {
    return ''
      + '<div style="display:flex;gap:12px;padding:12px 14px;background:var(--bg2);border-radius:10px;margin-bottom:8px">'
      +   '<div style="font-size:22px;color:' + i.color + ';flex-shrink:0;line-height:1">' + i.icon + '</div>'
      +   '<div style="flex:1">'
      +     '<div style="font-size:13px;font-weight:700;color:var(--tx);margin-bottom:3px">' + i.title + '</div>'
      +     '<div style="font-size:11px;color:var(--tx2);line-height:1.5">' + i.text + '</div>'
      +   '</div>'
      + '</div>';
  }).join('');

  trendsCard.innerHTML = ''
    + '<div class="an-card-header">'
    +   '<div class="an-card-title">Tendances détectées</div>'
    +   '<div class="an-card-sub">Analyse automatique des évolutions</div>'
    + '</div>'
    + '<div class="an-card-body" style="padding:14px 18px">' + insightsHtml + '</div>';
  page.appendChild(trendsCard);

  // ── Carte progressive si peu de parties ──
  if (chrono.length < 5) {
    var unlock = document.createElement('div');
    unlock.className = 'an-unlock-card';
    unlock.innerHTML = ''
      + '<div class="an-unlock-icon">\u25B2</div>'
      + '<div class="an-unlock-text">Avec <strong>' + (5 - chrono.length) + ' partie' + (5 - chrono.length > 1 ? 's' : '') + ' supplémentaire' + (5 - chrono.length > 1 ? 's' : '') + '</strong>, tu débloqueras la détection avancée de tendances et la comparaison de périodes.</div>';
    page.appendChild(unlock);
  }

  // ── Tracer les graphiques après que le DOM soit en place ──
  setTimeout(function() {
    if (typeof Chart === 'undefined') return;

    var labels = chrono.map(function(r, i) { return 'P' + (i + 1); });
    var sharedOpts = {
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
    };

    // Graphique différentiel
    var diffCanvas = document.getElementById('evo-hcp-chart');
    if (diffCanvas) {
      if (Chart.getChart) {
        var ex = Chart.getChart(diffCanvas);
        if (ex) { try { ex.destroy(); } catch(e) {} }
      }
      _evolutionCharts['diff'] = new Chart(diffCanvas, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            data: chrono.map(function(r) { return r.diff || 0; }),
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
        options: sharedOpts
      });
    }

    // Graphique SG (4 courbes superposées)
    var sgCanvas = document.getElementById('evo-sg-chart');
    if (sgCanvas) {
      if (Chart.getChart) {
        var ex2 = Chart.getChart(sgCanvas);
        if (ex2) { try { ex2.destroy(); } catch(e) {} }
      }
      var sgOpts = JSON.parse(JSON.stringify(sharedOpts));
      sgOpts.plugins.legend = { display: true, position: 'top', labels: { color: '#6A5030', font: { size: 11 }, usePointStyle: true } };
      _evolutionCharts['sg'] = new Chart(sgCanvas, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            { label: 'Drive',     data: chrono.map(function(r) { return r.sg_tee || 0; }),  borderColor: '#C9A84C', backgroundColor: 'transparent', tension: 0.3, borderWidth: 2, pointRadius: 3 },
            { label: 'Approche',  data: chrono.map(function(r) { return r.sg_app || 0; }),  borderColor: '#2D7D3A', backgroundColor: 'transparent', tension: 0.3, borderWidth: 2, pointRadius: 3 },
            { label: 'Jeu court', data: chrono.map(function(r) { return r.sg_arg || 0; }),  borderColor: '#C45E0A', backgroundColor: 'transparent', tension: 0.3, borderWidth: 2, pointRadius: 3 },
            { label: 'Putting',   data: chrono.map(function(r) { return r.sg_putt || 0; }), borderColor: '#7A6448', backgroundColor: 'transparent', tension: 0.3, borderWidth: 2, pointRadius: 3 }
          ]
        },
        options: sgOpts
      });
    }
  }, 80);
}

/* ────────────────────────────────────────
   Carte "Pas assez de données"
──────────────────────────────────────── */
function makeEmptyCard(subtab) {
  var card = document.createElement('div');
  card.className = 'an-empty-card';
  card.innerHTML = ''
    + '<div class="an-empty-icon">\u25C7</div>'
    + '<div class="an-empty-title">Aucune partie enregistrée</div>'
    + '<div class="an-empty-text">Saisis ta première partie dans la Scorecard pour commencer à voir tes analyses. Plus tu enregistres de parties, plus les insights deviendront précis.</div>'
    + '<button class="an-empty-cta" onclick="showPage(\'scorecard\')">Aller à la Scorecard →</button>';
  return card;
}



