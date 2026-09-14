/* ════════════════════════════════════════════
 * THE SMART GOLFER — streaks.js
 * SÉRIE DE TRAVAIL (jours consécutifs, façon Duolingo) + TROPHÉES DU MOIS.
 *
 * Série : un jour compte s'il contient un exercice validé OU une partie.
 * Golf oblige, un jour de repos par semaine ne casse pas la série
 * (jamais deux jours d'affilée). Aujourd'hui pas encore travaillé ?
 * La série tient toujours, on t'invite à la prolonger.
 * Paliers 3, 7, 14, 30, 60, 100, 365 jours : de l'XP pour le niveau.
 *
 * Trophées du mois : 3 médailles qui repartent de zéro chaque mois
 * (régularité, travail, performance), bronze → argent → or. Les mois passés
 * restent dans la vitrine. Tout se recalcule depuis tes données : rien à
 * « tricher », rien à perdre.
 *
 * Dépend de : app.js (lsGet/lsSet/showToast), community.js (XP, médailles).
 * ════════════════════════════════════════════ */

var STK_MILESTONES = [
  { days: 3, xp: 30 }, { days: 7, xp: 70 }, { days: 14, xp: 120 }, { days: 30, xp: 250 },
  { days: 60, xp: 400 }, { days: 100, xp: 700 }, { days: 365, xp: 2000 }
];

function stkDateKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/* Jours travaillés (dates locales) : exercices + parties */
function stkActiveDays() {
  var set = {};
  (lsGet('trainingLog') || []).forEach(function(e) {
    var d = new Date(e.date);
    if (!isNaN(d.getTime())) set[stkDateKey(d)] = (set[stkDateKey(d)] || '') + 't';
  });
  (lsGet('rounds') || []).forEach(function(r) { if (r.date) set[r.date] = (set[r.date] || '') + 'r'; });
  return set;
}

function stkCompute(activeSet, today) {
  var set = activeSet || stkActiveDays();
  var day = today ? new Date(today) : new Date();
  day = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  var key = function(offset) { var d = new Date(day); d.setDate(day.getDate() - offset); return stkDateKey(d); };
  var todayDone = !!set[key(0)];
  var i = todayDone ? 0 : 1, streak = 0, lastRest = -99, rests = [];
  while (i < 4000) {
    if (set[key(i)]) streak++;
    else if (streak > 0 && i - lastRest >= 7 && set[key(i + 1)]) { lastRest = i; rests.push(key(i)); }   // jour de repos toléré
    else break;
    i++;
  }
  // Les 7 derniers jours pour l'affichage
  var week = [];
  for (var k = 6; k >= 0; k--) {
    var kk = key(k);
    week.push({ key: kk, active: !!set[kk], rest: rests.indexOf(kk) !== -1, today: k === 0 });
  }
  var restAvailable = !rests.some(function(r) { return (day - new Date(r)) / 86400000 < 7; });
  return { streak: streak, todayDone: todayDone, week: week, restAvailable: restAvailable };
}

/* Paliers franchis → XP (acquise pour toujours) ; record de série */
function stkCheck(notify) {
  var s = stkCompute();
  var best = lsGet('streakBest') || 0;
  if (s.streak > best) lsSet('streakBest', s.streak);
  var got = lsGet('streakMilestones') || {}, fresh = null;
  STK_MILESTONES.forEach(function(m) {
    if (s.streak >= m.days && !got[m.days]) { got[m.days] = m.xp; fresh = m; }
  });
  if (fresh) {
    lsSet('streakMilestones', got);
    if (notify) showToast('🔥 Série de ' + fresh.days + ' jours ✓ +' + fresh.xp + ' XP');
  }
  return s;
}

function stkTotalXp() {
  var got = lsGet('streakMilestones') || {};
  return Object.keys(got).reduce(function(a, k) { return a + (Number(got[k]) || 0); }, 0)
    + (typeof smTotalXp === 'function' ? smTotalXp() : 0);
}

/* Carte « Ta série » (page Entraînement) */
function stkRenderCard(host) {
  if (!host) return;
  var s = stkCheck(false), best = Math.max(lsGet('streakBest') || 0, s.streak);
  var next = STK_MILESTONES.find(function(m) { return m.days > s.streak; });
  var D = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
  var dots = s.week.map(function(d) {
    var dt = new Date(d.key + 'T12:00:00');
    var cls = d.active ? 'on' : (d.rest ? 'rest' : (d.today ? 'today' : ''));
    return '<div class="stk-day ' + cls + '"><span class="stk-dot">' + (d.active ? '✓' : (d.rest ? '–' : '')) + '</span><span class="stk-dl">' + D[dt.getDay()] + '</span></div>';
  }).join('');
  var msg;
  if (!s.streak && !s.todayDone) msg = 'Valide un exercice ou enregistre une partie aujourd\'hui pour lancer ta série.';
  else if (!s.todayDone) msg = 'Un exercice aujourd\'hui et ta série passe à <strong>' + (s.streak + 1) + ' jours</strong>.' + (s.restAvailable ? ' (Un jour de repos par semaine ne la casse pas.)' : ' Tu as déjà pris ton jour de repos cette semaine !');
  else msg = 'Journée validée ✓' + (next ? ' Encore ' + (next.days - s.streak) + ' jour' + (next.days - s.streak > 1 ? 's' : '') + ' pour le palier ' + next.days + ' (+' + next.xp + ' XP).' : '');
  host.innerHTML = '<div class="stk-card' + (s.todayDone ? ' done' : '') + '">'
    + '<div class="stk-main"><div class="stk-flame">🔥</div><div><div class="stk-n">' + s.streak + ' <small>jour' + (s.streak > 1 ? 's' : '') + '</small></div>'
    +   '<div class="stk-best">Série de travail · record ' + best + ' j</div></div></div>'
    + '<div class="stk-week">' + dots + '</div>'
    + '<div class="stk-msg">' + msg + '</div></div>';
}

/* ─────────────── TROPHÉES DU MOIS ─────────────── */

var SM_TROPHIES = [
  { key: 'regular', icon: '📅', label: 'Régularité', unit: 'partie', tiers: [2, 4, 6], help: 'Parties jouées ce mois-ci' },
  { key: 'worker',  icon: '💪', label: 'Travail',    unit: 'séance', tiers: [4, 8, 15], help: 'Exercices validés ce mois-ci' },
  { key: 'perf',    icon: '🎯', label: 'Performance', unit: '', tiers: [-2, 0, 2], help: 'Ta meilleure carte par rapport à ton index (index − différentiel)', signed: true }
];
var SM_MEDALS = [{ name: 'Bronze', xp: 40, c: '#B87333' }, { name: 'Argent', xp: 80, c: '#8A97A8' }, { name: 'Or', xp: 150, c: '#C9A84C' }];

function smMonthKey(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }

function smMonthValues(month) {
  var rounds = (lsGet('rounds') || []).filter(function(r) { return r.date && r.date.slice(0, 7) === month; });
  var log = (lsGet('trainingLog') || []).filter(function(e) { var d = new Date(e.date); return !isNaN(d.getTime()) && smMonthKey(d) === month; });
  var perf = null;
  rounds.forEach(function(r) {
    var full = r.quickEntry || (Array.isArray(r.scores) && r.scores.filter(function(x) { return x !== null && x !== undefined; }).length >= 18);
    if (!full || r.diff === null || r.diff === undefined || r.hcp === null || r.hcp === undefined || isNaN(r.hcp)) return;
    var v = Math.round((Number(r.hcp) - Number(r.diff)) * 10) / 10;
    if (perf === null || v > perf) perf = v;
  });
  return { regular: rounds.length, worker: log.length, perf: perf };
}

function smTier(t, v) {
  if (v === null || v === undefined) return -1;
  var tier = -1;
  t.tiers.forEach(function(th, i) { if (v >= th) tier = i; });
  return tier;
}

function smMonths() {
  var set = {};
  (lsGet('rounds') || []).forEach(function(r) { if (r.date) set[r.date.slice(0, 7)] = 1; });
  (lsGet('trainingLog') || []).forEach(function(e) { var d = new Date(e.date); if (!isNaN(d.getTime())) set[smMonthKey(d)] = 1; });
  set[smMonthKey(new Date())] = 1;
  return Object.keys(set).sort().reverse();
}

function smTotalXp() {
  return smMonths().reduce(function(a, m) {
    var v = smMonthValues(m);
    return a + SM_TROPHIES.reduce(function(b, t) { var i = smTier(t, v[t.key]); return b + (i >= 0 ? SM_MEDALS[i].xp : 0); }, 0);
  }, 0);
}

var SM_MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function smRenderPanel(host) {
  if (!host) return;
  var now = new Date(), month = smMonthKey(now), v = smMonthValues(month);
  var end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  var left = end.getDate() - now.getDate() + 1;

  var cards = SM_TROPHIES.map(function(t) {
    var tier = smTier(t, v[t.key]);
    var nextTh = t.tiers[tier + 1];
    var val = v[t.key];
    var shown = val === null ? '—' : (t.signed && val > 0 ? '+' : '') + String(val).replace('.', ',');
    var pct;
    if (tier === 2) pct = 100;
    else if (t.signed) pct = val === null ? 0 : Math.max(4, Math.min(100, Math.round((val - (t.tiers[0] - 4)) / (nextTh - (t.tiers[0] - 4)) * 100)));
    else pct = Math.max(4, Math.min(100, Math.round((val || 0) / nextTh * 100)));
    var goal = tier === 2 ? 'Or décroché 🎉'
      : (t.signed ? 'Prochaine médaille : une carte à ' + (nextTh > 0 ? '+' : '') + nextTh + ' ou mieux'
                  : 'Prochaine médaille : ' + nextTh + ' ' + t.unit + (nextTh > 1 ? 's' : ''));
    var medal = tier >= 0 ? SM_MEDALS[tier] : null;
    return '<div class="sm-card"' + (medal ? ' style="--medal:' + medal.c + '"' : '') + '>'
      + '<div class="sm-top"><span class="sm-ico">' + t.icon + '</span><span class="sm-label">' + t.label + '</span>'
      + (medal ? '<span class="sm-medal">' + medal.name + '</span>' : '<span class="sm-medal none">À gagner</span>') + '</div>'
      + '<div class="sm-val">' + shown + '</div><div class="sm-help">' + t.help + '</div>'
      + '<div class="sm-bar"><i style="width:' + pct + '%"></i></div><div class="sm-goal">' + goal + '</div></div>';
  }).join('');

  // Vitrine des mois passés
  var past = smMonths().filter(function(m) { return m !== month; }).slice(0, 6).map(function(m) {
    var pv = smMonthValues(m);
    var medals = SM_TROPHIES.map(function(t) {
      var i = smTier(t, pv[t.key]);
      return i >= 0 ? '<span class="sm-pm" style="background:' + SM_MEDALS[i].c + '" title="' + t.label + ' : ' + SM_MEDALS[i].name + '">' + t.icon + '</span>' : '<span class="sm-pm empty" title="' + t.label + '">·</span>';
    }).join('');
    var p = m.split('-');
    var ab = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'][parseInt(p[1], 10) - 1];
    return '<div class="sm-past"><span>' + ab + ' ' + p[0].slice(2) + '</span>' + medals + '</div>';
  }).join('');

  host.innerHTML = '<div class="comm-section-head" style="margin-top:22px"><div class="comm-section-title">🗓️ Trophées de ' + SM_MONTHS_FR[now.getMonth()] + '</div>'
    + '<div class="comm-section-sub">Tout repart à zéro le 1er · encore ' + left + ' jour' + (left > 1 ? 's' : '') + '</div></div>'
    + '<div class="sm-grid">' + cards + '</div>'
    + (past ? '<div class="sm-vitrine"><div class="sm-vit-t">Vitrine des mois passés</div>' + past + '</div>' : '');
}
