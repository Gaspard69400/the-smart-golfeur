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
   SOUS-ONGLET 3 : PUTTING (placeholder Session 5)
──────────────────────────────────────── */
function renderPutting() {
  var page = document.getElementById('an-sub-putting');
  if (!page) return;
  page.innerHTML = '';

  var card = document.createElement('div');
  card.className = 'an-empty-card';
  card.innerHTML = ''
    + '<div class="an-empty-icon">\u25C9</div>'
    + '<div class="an-empty-title">Analyse Putting · Bientôt disponible</div>'
    + '<div class="an-empty-text">Cette section te montrera la moyenne de putts par green, les conversions de 1m/2m/3m, et les opportunités manquées. Elle sera disponible dans la prochaine mise à jour.</div>';
  page.appendChild(card);
}

/* ────────────────────────────────────────
   SOUS-ONGLET 4 : ÉVOLUTION (placeholder Session 5)
──────────────────────────────────────── */
function renderEvolution() {
  var page = document.getElementById('an-sub-evolution');
  if (!page) return;
  page.innerHTML = '';

  var card = document.createElement('div');
  card.className = 'an-empty-card';
  card.innerHTML = ''
    + '<div class="an-empty-icon">\u25B2</div>'
    + '<div class="an-empty-title">Analyse Évolution · Bientôt disponible</div>'
    + '<div class="an-empty-text">Cette section te montrera l\'évolution de tes statistiques dans le temps : courbe de progression, détection de plateaux, comparaison mensuelle. Disponible dans la prochaine mise à jour.</div>';
  page.appendChild(card);
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



