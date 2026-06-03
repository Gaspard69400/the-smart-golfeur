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
  var hcp       = u.hcp !== null && u.hcp !== undefined ? u.hcp : 14.2;

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
  var meta = document.createElement('div');
  meta.className = 'dash-meta';
  meta.textContent = 'Saison ' + new Date().getFullYear() + ' \u00b7 ' + n + ' parties ' + (hasReal ? 'enregistr\u00e9es' : 'de d\u00e9mo');
  headerLeft.appendChild(greeting);
  headerLeft.appendChild(meta);

  var headerRight = document.createElement('div');
  headerRight.style.display = 'flex';
  headerRight.style.gap = '8px';

  var btnScorecard = document.createElement('button');
  btnScorecard.className = 'dash-btn dash-btn-outline';
  btnScorecard.textContent = '+ Nouvelle partie';
  btnScorecard.addEventListener('click', function() { showPage('scorecard'); });

  var btnAnalyse = document.createElement('button');
  btnAnalyse.className = 'dash-btn dash-btn-gold';
  btnAnalyse.textContent = 'Voir l\'analyse \u2192';
  btnAnalyse.addEventListener('click', function() { showPage('analyse'); });

  headerRight.appendChild(btnScorecard);
  headerRight.appendChild(btnAnalyse);

  header.appendChild(headerLeft);
  header.appendChild(headerRight);
  wrap.appendChild(header);

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
  sgSub.textContent = 'Vert = mieux que ton niveau · Rouge = à travailler';
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
    var pct = Math.min(100, Math.max(0, (s.val + 1) * 50));
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

  sgPanel.appendChild(sgBody);
  wrap.appendChild(sgPanel);

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

  /* ── 6. MESSAGES + OBJECTIFS (côte à côte) ── */
  var bottomRow = document.createElement('div');
  bottomRow.className = 'dash-g21';

  /* Messages */
  var msgPanel = document.createElement('div');
  msgPanel.className = 'panel';
  var msgPH = document.createElement('div');
  msgPH.className = 'panel-header';
  var msgPT = document.createElement('div');
  msgPT.className = 'panel-title';
  msgPT.textContent = 'Messages';
  var msgUnreadCount = MESSAGES.filter(function(m) { return m.unread; }).length;
  var msgBadge = document.createElement('div');
  msgBadge.style.cssText = 'display:flex;align-items:center;gap:8px';
  if (msgUnreadCount > 0) {
    var badge = document.createElement('span');
    badge.style.cssText = 'background:var(--gold);color:var(--bg);border-radius:10px;padding:1px 7px;font-size:8px;font-weight:500';
    badge.textContent = msgUnreadCount + ' non lu' + (msgUnreadCount > 1 ? 's' : '');
    msgBadge.appendChild(badge);
  }
  var msgLink = document.createElement('span');
  msgLink.style.cssText = 'font-size:8px;color:var(--gold-d);text-transform:uppercase;letter-spacing:.1em;cursor:pointer';
  msgLink.textContent = 'Voir tout \u2192';
  msgLink.addEventListener('click', function() { showPage('coach'); });
  msgBadge.appendChild(msgLink);
  msgPH.appendChild(msgPT); msgPH.appendChild(msgBadge);
  msgPanel.appendChild(msgPH);

  var msgBody = document.createElement('div');
  msgBody.className = 'panel-body';

  MESSAGES.forEach(function(m) {
    var item = document.createElement('div');
    item.className = 'msg-preview-item';
    item.addEventListener('click', function() { showPage('coach'); });

    /* Icône ou avatar */
    if (m.type === 'private') {
      var av = document.createElement('div');
      av.className = 'msg-av';
      av.style.background = m.bg || 'var(--bg2)';
      av.style.color = m.color || 'var(--tx2)';
      av.textContent = m.av || '?';
      item.appendChild(av);
    } else {
      var ico = document.createElement('div');
      ico.className = 'msg-channel-icon';
      ico.textContent = m.icon;
      item.appendChild(ico);
    }

    var content = document.createElement('div');
    content.className = 'msg-content';

    var from = document.createElement('div');
    from.className = 'msg-from';
    var fromSpan = document.createElement('span');
    var cLabel = m.type === 'private' ? m.from : (m.type === 'public' ? 'Equipe : ' + m.channel : 'Groupe : ' + m.channel);
    fromSpan.textContent = cLabel;
    var timeSpan = document.createElement('span');
    timeSpan.className = 'msg-time';
    timeSpan.textContent = m.time;
    from.appendChild(fromSpan); from.appendChild(timeSpan);

    var text = document.createElement('div');
    text.className = 'msg-text';
    text.textContent = (m.type === 'private' ? m.from + ': ' : '') + m.text;

    content.appendChild(from);
    content.appendChild(text);
    item.appendChild(content);

    if (m.unread) {
      var dot = document.createElement('div');
      dot.className = 'msg-unread';
      item.appendChild(dot);
    }

    msgBody.appendChild(item);
  });

  msgPanel.appendChild(msgBody);
  bottomRow.appendChild(msgPanel);

  /* Objectifs */
  var goalsPanel = document.createElement('div');
  goalsPanel.className = 'panel';
  var goalsPH = document.createElement('div');
  goalsPH.className = 'panel-header';
  var goalsPT = document.createElement('div');
  goalsPT.className = 'panel-title';
  goalsPT.textContent = 'Objectifs saison';
  goalsPH.appendChild(goalsPT);
  goalsPanel.appendChild(goalsPH);

  var goalsBody = document.createElement('div');
  goalsBody.className = 'panel-body';

  var goalsData = [
    { name: 'Score moyen', now: avgScore, target: '80',  delta: (parseFloat(avgScore)-80).toFixed(1), good: parseFloat(avgScore) <= 80 },
    { name: 'Handicap',    now: hcp,      target: '11',  delta: (parseFloat(hcp)-11).toFixed(1),      good: parseFloat(hcp) <= 11 },
    { name: 'GIR',         now: avgGIR+'%', target: '50%', delta: (parseInt(avgGIR)-50)+'%',          good: parseInt(avgGIR) >= 50 },
    { name: 'FIR',         now: avgFIR+'%', target: '60%', delta: (parseInt(avgFIR)-60)+'%',          good: parseInt(avgFIR) >= 60 }
  ];

  goalsData.forEach(function(g) {
    var row = document.createElement('div');
    row.className = 'goal-row';

    var nm = document.createElement('div');
    nm.className = 'goal-name';
    nm.textContent = g.name;

    var vals = document.createElement('div');
    vals.className = 'goal-vals';

    var nowEl = document.createElement('div');
    nowEl.className = 'goal-now';
    nowEl.textContent = g.now;

    var arrow = document.createElement('div');
    arrow.className = 'goal-arrow';
    arrow.textContent = '\u2192';

    var tgt = document.createElement('div');
    tgt.className = 'goal-tgt';
    tgt.textContent = g.target;

    vals.appendChild(nowEl); vals.appendChild(arrow); vals.appendChild(tgt);

    var delta = document.createElement('div');
    delta.className = 'goal-delta';
    delta.style.color = g.good ? 'var(--ok2)' : 'var(--ng2)';
    delta.textContent = (parseFloat(g.delta) > 0 ? '+' : '') + g.delta;

    row.appendChild(nm); row.appendChild(vals); row.appendChild(delta);
    goalsBody.appendChild(row);
  });

  goalsPanel.appendChild(goalsBody);
  bottomRow.appendChild(goalsPanel);

  wrap.appendChild(bottomRow);

  /* ── 7. ROADMAP ── */
  var roadPanel = document.createElement('div');
  roadPanel.className = 'panel';
  var roadPH = document.createElement('div');
  roadPH.className = 'panel-header';
  var roadPT = document.createElement('div');
  roadPT.className = 'panel-title';
  roadPT.textContent = 'Roadmap de progression';
  var roadPSub = document.createElement('div');
  roadPSub.className = 'panel-sub';
  roadPSub.textContent = 'Phase actuelle : Structurer';
  var roadInfo = document.createElement('button');
  roadInfo.style.cssText = 'background:var(--gold-dim);border:1px solid rgba(201,168,76,0.3);border-radius:50%;width:20px;height:20px;font-size:11px;font-weight:700;color:var(--gold-d);cursor:pointer;flex-shrink:0;line-height:1';
  roadInfo.textContent = '?';
  roadInfo.addEventListener('click', function() {
    var ex = document.getElementById('roadmap-modal');
    if (ex) { ex.remove(); return; }
    var ov = document.createElement('div');
    ov.id = 'roadmap-modal';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(26,18,9,0.4);z-index:499;display:flex;align-items:center;justify-content:center';
    var box = document.createElement('div');
    box.style.cssText = 'background:var(--white);border:1px solid var(--bd-card);border-radius:14px;padding:24px 28px;max-width:440px;width:90%;box-shadow:0 8px 32px rgba(26,18,9,0.15)';
    box.innerHTML = [
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">',
        '<div style="font-size:17px;font-weight:700;color:var(--tx);letter-spacing:-0.3px">Roadmap de progression</div>',
        '<button id="cls-rdm" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--tx3);line-height:1">&times;</button>',
      '</div>',
      '<p style="font-size:12px;color:var(--tx2);line-height:1.7;margin-bottom:14px">La roadmap vous guide à travers <strong style="color:var(--gold-d)">4 phases</strong> de progression. Chaque phase correspond à un niveau de maîtrise de votre jeu.</p>',
      '<div style="display:flex;flex-direction:column;gap:12px">',
        '<div style="display:flex;gap:12px;align-items:flex-start"><div style="width:12px;height:12px;min-width:12px;background:var(--ok2);border-radius:3px;margin-top:2px"></div><div><div style="font-size:12px;font-weight:700;color:var(--tx);margin-bottom:3px">Phase 1 — Comprendre</div><div style="font-size:11px;color:var(--tx3);line-height:1.5">Identifier vos stats clés (GIR, FIR, putts, score). Comprendre où vous perdez vos coups.</div></div></div>',
        '<div style="display:flex;gap:12px;align-items:flex-start"><div style="width:12px;height:12px;min-width:12px;background:var(--gold);border-radius:3px;margin-top:2px"></div><div><div style="font-size:12px;font-weight:700;color:var(--tx);margin-bottom:3px">Phase 2 — Structurer</div><div style="font-size:11px;color:var(--tx3);line-height:1.5">Fixer des objectifs, organiser l’entraînement par priorités, analyser votre dispersion par club.</div></div></div>',
        '<div style="display:flex;gap:12px;align-items:flex-start"><div style="width:12px;height:12px;min-width:12px;background:var(--tx3);border-radius:3px;margin-top:2px"></div><div><div style="font-size:12px;font-weight:700;color:var(--tx2);margin-bottom:3px">Phase 3 — Performer</div><div style="font-size:11px;color:var(--tx3);line-height:1.5">Course management basé sur vos données. Meilleures décisions trou par trou sur le terrain.</div></div></div>',
        '<div style="display:flex;gap:12px;align-items:flex-start"><div style="width:12px;height:12px;min-width:12px;background:var(--tx4);border-radius:3px;margin-top:2px"></div><div><div style="font-size:12px;font-weight:700;color:var(--tx2);margin-bottom:3px">Phase 4 — Écosystème</div><div style="font-size:11px;color:var(--tx3);line-height:1.5">Communauté, IA personnalisée, synchronisation coach, mode compétition temps réel.</div></div></div>',
      '</div>',
    ].join('');
    ov.appendChild(box);
    document.body.appendChild(ov);
    document.getElementById('cls-rdm').onclick = function() { ov.remove(); };
    ov.addEventListener('click', function(ev) { if (ev.target === ov) ov.remove(); });
  });
  var roadRight = document.createElement('div');
  roadRight.style.cssText = 'display:flex;gap:8px;align-items:center';
  roadRight.appendChild(roadPSub);
  roadRight.appendChild(roadInfo);
  roadPH.appendChild(roadPT); roadPH.appendChild(roadRight);
  roadPanel.appendChild(roadPH);

  var roadBody = document.createElement('div');
  roadBody.className = 'panel-body';
  var roadGrid = document.createElement('div');
  roadGrid.className = 'roadmap-grid';

  var phases = [
    { num: 'Phase 1 \u00b7 Compl\u00e9t\u00e9e', name: 'Comprendre', tags: [['ok','Stats de base'],['ok','Patterns']], pct: 100, cls: 'done' },
    { num: 'Phase 2 \u00b7 En cours', name: 'Structurer', tags: [['gold','Objectifs'],['gold','Dispersion']], pct: 55, cls: 'active' },
    { num: 'Phase 3 \u00b7 \u00c0 venir', name: 'Performer', tags: [['dim','Course mgmt'],['dim','D\u00e9cisions']], pct: 0, cls: 'upcoming' },
    { num: 'Phase 4 \u00b7 Vision', name: '\u00c9cosyst\u00e8me', tags: [['dim','Communaut\u00e9'],['dim','IA']], pct: 0, cls: 'upcoming' }
  ];

  phases.forEach(function(ph) {
    var phDiv = document.createElement('div');
    phDiv.className = 'road-phase ' + ph.cls;

    var num = document.createElement('div');
    num.className = 'road-phase-num';
    num.textContent = ph.num;

    var name = document.createElement('div');
    name.className = 'road-phase-name';
    name.textContent = ph.name;

    var tags = document.createElement('div');
    tags.className = 'road-tags';
    ph.tags.forEach(function(t) {
      var tag = document.createElement('span');
      tag.className = 'rtag rtag-' + t[0];
      tag.textContent = t[1];
      tags.appendChild(tag);
    });

    var progTrack = document.createElement('div');
    progTrack.className = 'road-progress';
    var progFill = document.createElement('div');
    progFill.className = 'road-progress-fill';
    progFill.style.width = ph.pct + '%';
    progFill.style.background = ph.cls === 'done' ? 'var(--ok2)' : ph.cls === 'active' ? 'var(--gold)' : 'var(--s5, #444)';
    progTrack.appendChild(progFill);

    phDiv.appendChild(num); phDiv.appendChild(name); phDiv.appendChild(tags); phDiv.appendChild(progTrack);

    if (ph.cls === 'active') {
      var pctLabel = document.createElement('div');
      pctLabel.style.cssText = 'font-size:8px;color:var(--gold);margin-top:4px;text-align:right';
      pctLabel.textContent = ph.pct + '%';
      phDiv.appendChild(pctLabel);
    }

    roadGrid.appendChild(phDiv);
  });

  roadBody.appendChild(roadGrid);
  roadPanel.appendChild(roadBody);
  wrap.appendChild(roadPanel);

  /* ── Ajouter dans le container ── */
  container.appendChild(wrap);

  /* ── 8. GRAPHIQUES Chart.js (après rendu DOM) ── */
  setTimeout(function() {
    if (typeof Chart === 'undefined') return;

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
  else if (key === 'gir') values = data20.map(function(r) { return Math.round(r.gir / 18 * 100); });
  else if (key === 'fir') values = data20.map(function(r) { return Math.round(r.fir / (r.firTotal || 14) * 100); });
  else if (key === 'putts') values = data20.map(function(r) { return r.putts; });
  else if (key === 'diff') values = data20.map(function(r) { return r.diff; });

  // Calculer trend
  var first = values[0];
  var last = values[values.length - 1];
  var delta = (last - first).toFixed(1);
  var deltaText = (delta > 0 ? '+' : '') + delta;
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
    +   '<div style="margin-left:auto"><div style="font-size:9px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.08em">Parties</div><div style="font-size:18px;font-weight:700;color:var(--gold-d)">' + values.length + '</div></div>'
    + '</div>'
    + '<div style="height:280px"><canvas id="kpi-modal-chart"></canvas></div>';

  modal.appendChild(inner);
  document.body.appendChild(modal);

  document.getElementById('kpi-modal-close').addEventListener('click', function() {
    modal.remove();
  });

  // Créer le graphique
  setTimeout(function() {
    if (typeof Chart === 'undefined') return;
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



