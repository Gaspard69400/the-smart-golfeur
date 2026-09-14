/* ════════════════════════════════════════════
 * THE SMART GOLFER — challenges.js
 * DÉFIS HEBDOMADAIRES — ce qui transforme les trophées en habitude.
 *
 * Chaque semaine (ISO, lundi → dimanche), 3 défis :
 *   1. un défi d'ACTIVITÉ   (jouer 1 ou 2 parties, selon ton rythme habituel)
 *   2. un défi d'ENTRAÎNEMENT sur ton secteur le plus faible
 *   3. un défi de PERFORMANCE lié à ce même secteur, calibré sur ton niveau
 *
 * La sélection est FIGÉE en début de semaine (tsg_challenges) : sinon les
 * défis changeraient en cours de semaine dès qu'une partie modifie ton
 * secteur faible. Chaque défi relevé rapporte de l'XP, conservée pour
 * toujours (tsg_challengesDone), qui compte dans ton niveau.
 *
 * Dépend de : app.js (lsGet/lsSet, showToast), data.js (getAllCourses),
 *   traininglib.js (trnWeakSectors), strokesgained.js (sgBaseline, sgRefHcp).
 * ════════════════════════════════════════════ */

/* Semaine ISO « 2026-W38 » */
function chWeekKey(d) {
  var dt = d ? new Date(d) : new Date();
  if (isNaN(dt.getTime())) return null;
  dt = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
  var day = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - day);
  var y0 = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  var wk = Math.ceil((((dt - y0) / 86400000) + 1) / 7);
  return dt.getUTCFullYear() + '-W' + (wk < 10 ? '0' + wk : wk);
}

/* Jours restants avant lundi prochain */
function chDaysLeft() {
  var day = new Date().getDay();          // 0 = dimanche
  return day === 0 ? 1 : (8 - day);
}

/* ── Génération de la sélection de la semaine ── */
function chBuildWeek() {
  var rounds = lsGet('rounds') || [];

  // 1. Activité : ton rythme des 4 dernières semaines
  var monthAgo = Date.now() - 28 * 86400000;
  var recentCount = rounds.filter(function(r) {
    var t = new Date(r.date).getTime();
    return !isNaN(t) && t >= monthAgo;
  }).length;
  var activity = (recentCount >= 6)
    ? { id: 'rounds2', kind: 'rounds', target: 2, xp: 80, icon: '🏌️', title: 'Deux cartes', desc: 'Enregistre 2 parties cette semaine' }
    : { id: 'rounds1', kind: 'rounds', target: 1, xp: 50, icon: '🏌️', title: 'Une carte', desc: 'Enregistre au moins 1 partie cette semaine' };

  // 2 & 3. Secteur le plus faible (repli : putting, le plus universel)
  var sectors = (typeof trnWeakSectors === 'function') ? trnWeakSectors() : null;
  var weak = (sectors && sectors[0]) ? sectors[0].key : 'Putting';
  var sectorName = { 'Drive': 'le driving', 'Approche': 'les approches', 'Jeu court': 'le petit jeu', 'Putting': 'le putting' }[weak] || weak;

  var training = {
    id: 'train-' + weak, kind: 'trainingSector', sector: weak, target: 2, xp: 70, icon: '🎯',
    title: 'Travail ciblé', desc: '2 exercices « ' + weak + ' » — ton secteur prioritaire'
  };

  // Objectifs de performance calibrés sur ton niveau (un cran au-dessus de ton barème)
  var hcp = (typeof sgRefHcp === 'function') ? sgRefHcp() : 18;
  var base = (typeof sgBaseline === 'function') ? sgBaseline(hcp) : { gir: 0.3, fir: 0.45, putts: 33 };
  var perf;
  if (weak === 'Putting') {
    var tp = Math.max(26, Math.round(base.putts) - 1);
    perf = { id: 'putts' + tp, kind: 'maxPutts', target: tp, xp: 100, icon: '🧘', title: 'Économie de putts', desc: tp + ' putts ou moins sur une partie de 18 trous' };
  } else if (weak === 'Approche') {
    var tg = Math.min(14, Math.round(base.gir * 18) + 1);
    perf = { id: 'gir' + tg, kind: 'bestGir', target: tg, xp: 100, icon: '🟢', title: 'Greens en régulation', desc: 'Touche ' + tg + ' greens sur une même partie' };
  } else if (weak === 'Drive') {
    var tf = Math.min(12, Math.round(base.fir * 14) + 1);
    perf = { id: 'fir' + tf, kind: 'bestFir', target: tf, xp: 100, icon: '🛣️', title: 'Fairways touchés', desc: 'Touche ' + tf + ' fairways sur une même partie' };
  } else {
    perf = { id: 'birdies1', kind: 'birdies', target: 1, xp: 100, icon: '🐦', title: 'Chasse au birdie', desc: 'Réussis au moins 1 birdie cette semaine' };
  }

  return { week: chWeekKey(), weak: weak, weakLabel: sectorName, list: [activity, training, perf] };
}

/* Sélection de la semaine courante (figée) */
function chGetWeek() {
  var cur = lsGet('challenges');
  var wk = chWeekKey();
  if (!cur || cur.week !== wk || !Array.isArray(cur.list)) {
    cur = chBuildWeek();
    lsSet('challenges', cur);
  }
  return cur;
}

/* ── Journal d'entraînement (la carte « training_done » ne garde que la dernière date) ── */
function chLogTraining(trainingId, result) {
  var log = lsGet('trainingLog') || [];
  var cat = null;
  try {
    var all = (typeof getAllExercises === 'function') ? getAllExercises() : [];
    for (var i = 0; i < all.length; i++) { if (all[i].id === trainingId) { cat = all[i].category; break; } }
  } catch (e) {}
  var entry = { id: trainingId, category: cat, date: new Date().toISOString() };
  if (result && result.score !== null && result.score !== undefined && !isNaN(result.score)) {
    entry.score = Number(result.score);
    if (result.max) entry.max = Number(result.max);
  }
  log.push(entry);
  if (log.length > 500) log = log.slice(-500);
  lsSet('trainingLog', log);
}

/* ── Évaluation d'un défi ── */
function chRoundsThisWeek() {
  var wk = chWeekKey();
  return (lsGet('rounds') || []).filter(function(r) { return chWeekKey(r.date) === wk; });
}

function chIs18(r) {
  return Array.isArray(r.scores) && r.scores.filter(function(s) { return s !== null && s !== undefined; }).length === 18;
}

function chProgress(c) {
  var wk = chWeekKey();
  var rs = chRoundsThisWeek();
  var cur = 0, done = false;

  if (c.kind === 'rounds') {
    cur = rs.length; done = cur >= c.target;
  } else if (c.kind === 'trainingSector' || c.kind === 'training') {
    cur = (lsGet('trainingLog') || []).filter(function(l) {
      return chWeekKey(l.date) === wk && (c.kind === 'training' || l.category === c.sector);
    }).length;
    done = cur >= c.target;
  } else if (c.kind === 'bestGir') {
    rs.forEach(function(r) { if ((r.gir || 0) > cur) cur = r.gir || 0; });
    done = cur >= c.target;
  } else if (c.kind === 'bestFir') {
    rs.forEach(function(r) { if ((r.fir || 0) > cur) cur = r.fir || 0; });
    done = cur >= c.target;
  } else if (c.kind === 'maxPutts') {
    // Plus bas = mieux ; seules les cartes 18 trous avec des putts crédibles comptent
    var best = null;
    rs.forEach(function(r) {
      if (!chIs18(r) || !r.putts || r.putts < 18) return;
      if (best === null || r.putts < best) best = r.putts;
    });
    cur = best; done = (best !== null && best <= c.target);
  } else if (c.kind === 'birdies') {
    var courses = (typeof getAllCourses === 'function') ? getAllCourses() : [];
    rs.forEach(function(r) {
      var crs = null;
      for (var i = 0; i < courses.length; i++) { if (courses[i].id === r.courseId) { crs = courses[i]; break; } }
      if (!crs || !Array.isArray(r.scores)) return;
      r.scores.forEach(function(s, i) {
        if (s !== null && s !== undefined && crs.trous[i] && s - crs.trous[i].par === -1) cur++;
        if (s !== null && s !== undefined && crs.trous[i] && s - crs.trous[i].par <= -2) cur++;
      });
    });
    done = cur >= c.target;
  }
  var pct;
  if (c.kind === 'maxPutts') pct = done ? 100 : (cur === null ? 0 : Math.max(8, Math.round(100 * c.target / cur)));
  else pct = Math.min(100, Math.round(100 * (cur || 0) / c.target));
  return { cur: cur, done: done, pct: pct };
}

/* ── XP gagnée (cumulée sur toutes les semaines) ── */
function chTotalXp() {
  var done = lsGet('challengesDone') || {};
  var xp = 0;
  Object.keys(done).forEach(function(wk) {
    Object.keys(done[wk]).forEach(function(id) { xp += Number(done[wk][id]) || 0; });
  });
  return xp;
}

/* Vérifie la semaine, enregistre les défis nouvellement relevés, prévient le joueur */
function chCheck(notify) {
  var week = chGetWeek();
  var done = lsGet('challengesDone') || {};
  if (!done[week.week]) done[week.week] = {};
  var fresh = [];
  week.list.forEach(function(c) {
    if (done[week.week][c.id]) return;
    if (chProgress(c).done) {
      done[week.week][c.id] = c.xp;
      fresh.push(c);
    }
  });
  if (fresh.length) {
    lsSet('challengesDone', done);
    if (notify !== false && typeof showToast === 'function') {
      var f = fresh[0];
      showToast('🎯 Défi relevé : ' + f.title + ' · +' + f.xp + ' XP' + (fresh.length > 1 ? ' (et ' + (fresh.length - 1) + ' autre)' : ''));
    }
    if (typeof updateNavUI === 'function') { try { updateNavUI(); } catch (e) {} }
  }
  // Objectifs de saison atteints (progress.js) : même moment, même notification
  if (typeof pgsCheckGoals === 'function') { try { pgsCheckGoals(notify); } catch (e) {} }
  // Série de travail : paliers de jours consécutifs (streaks.js)
  if (typeof stkCheck === 'function') {
    try {
      stkCheck(notify);
      var stkHost = document.getElementById('stk-host');
      if (stkHost && typeof stkRenderCard === 'function') stkRenderCard(stkHost);
    } catch (e) {}
  }
  return fresh;
}

/* ── Panneau des défis ── */
function chRenderPanel(host, compact) {
  if (!host) return;
  chCheck(false);
  var week = chGetWeek();
  var done = (lsGet('challengesDone') || {})[week.week] || {};
  var nDone = 0;

  var cards = week.list.map(function(c) {
    var p = chProgress(c);
    var isDone = !!done[c.id] || p.done;
    if (isDone) nDone++;
    var count;
    if (c.kind === 'maxPutts') count = (p.cur === null) ? 'Aucune carte' : ('Meilleur : ' + p.cur);
    else count = Math.min(p.cur || 0, c.target) + ' / ' + c.target;
    return '<div class="ch-card' + (isDone ? ' is-done' : '') + '">'
      + '<div class="ch-ico">' + c.icon + '</div>'
      + '<div class="ch-main">'
      +   '<div class="ch-top"><span class="ch-title">' + chEsc(c.title) + '</span>'
      +     '<span class="ch-xp">' + (isDone ? '✓ +' : '+') + c.xp + ' XP</span></div>'
      +   '<div class="ch-desc">' + chEsc(c.desc) + '</div>'
      +   '<div class="ch-bar"><div class="ch-bar-fill" style="width:' + (isDone ? 100 : p.pct) + '%"></div></div>'
      +   '<div class="ch-count">' + (isDone ? 'Relevé !' : chEsc(count)) + '</div>'
      + '</div></div>';
  }).join('');

  var left = chDaysLeft();
  var panel = document.createElement('div');
  panel.className = 'panel ch-panel' + (compact ? ' ch-compact' : '');
  panel.innerHTML = '<div class="panel-header">'
    + '<div><div class="panel-title">🎯 Défis de la semaine</div>'
    + '<div class="panel-sub">' + nDone + '/' + week.list.length + ' relevés · nouveaux défis dans ' + left + ' jour' + (left > 1 ? 's' : '') + '</div></div>'
    + '</div>'
    + '<div class="panel-body"><div class="ch-grid">' + cards + '</div></div>';
  host.appendChild(panel);
}

function chEsc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
