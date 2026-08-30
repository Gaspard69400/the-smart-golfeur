/* ════════════════════════════════════════════
 * THE SMART GOLFER — community.js
 * Onglet COMMUNAUTÉ : Gamification à PALIERS (XP, niveaux, séries,
 * trophées multi-paliers Bronze→Légende) + Fil d'activité type « Strava ».
 *
 * Gamification = 100 % local (fonctionne en démo ET en cloud, sans réseau).
 * Fil social = cloud uniquement (lit les parties des groupmates via la
 * policy RLS rounds_select_groupmate déjà en place côté Supabase).
 *
 * Dépend de : app.js (lsGet, lsSet, showToast, currentUser), data.js (getAllCourses),
 *             auth.js (cloudActive), supabaseClient.js (window.sbClient).
 * ════════════════════════════════════════════ */

/* ─── Barème XP de base ─── */
var COMM_XP = { round: 50, birdie: 15, eagle: 40, par: 3, gir: 2 };

/* ─── Médailles de palier (index 0 = 1er palier) ─── */
var COMM_MEDALS = [
  { name: 'Bronze',  c: '#B87333', bg: 'rgba(184,115,51,0.14)' },
  { name: 'Argent',  c: '#8A97A8', bg: 'rgba(138,151,168,0.18)' },
  { name: 'Or',      c: '#C9A84C', bg: 'rgba(201,168,76,0.18)' },
  { name: 'Platine', c: '#2FA39C', bg: 'rgba(47,163,156,0.16)' },
  { name: 'Diamant', c: '#5B8DEF', bg: 'rgba(91,141,239,0.16)' },
  { name: 'Légende', c: '#9B5DE5', bg: 'rgba(155,93,229,0.16)' }
];

/* ─── Titres de niveau ─── */
function commLevelTitle(level) {
  if (level >= 20) return 'Légende';
  if (level >= 15) return 'Champion';
  if (level >= 11) return 'Élite';
  if (level >= 8)  return 'Expert';
  if (level >= 5)  return 'Confirmé';
  if (level >= 3)  return 'Amateur';
  return 'Débutant';
}

/* XP cumulée -> niveau + progression dans le niveau courant */
function commLevelFromXp(xp) {
  var lvl = 1, acc = 0, need = 400;
  while (xp >= acc + need) {
    acc += need;
    lvl++;
    need = 400 + (lvl - 1) * 250;
  }
  return { level: lvl, into: xp - acc, need: need, title: commLevelTitle(lvl) };
}

function commClamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

/* Pars par trou d'une partie (via son parcours), ou null si introuvable */
function commCoursePars(round) {
  if (!round || !round.courseId) return null;
  var courses = (typeof getAllCourses === 'function') ? getAllCourses() : [];
  for (var i = 0; i < courses.length; i++) {
    if (courses[i].id === round.courseId && courses[i].trous) {
      return courses[i].trous.map(function(t) { return t.par; });
    }
  }
  return null;
}

/* Clé ISO année-semaine d'une date (ex: "2026-W35") */
function commWeekKey(dateStr) {
  var d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  var week1 = new Date(d.getFullYear(), 0, 4);
  var weekNo = 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return d.getFullYear() + '-W' + (weekNo < 10 ? '0' + weekNo : weekNo);
}

/* Plus longue série de semaines consécutives jouées */
function commLongestWeekStreak(rounds) {
  var keys = {};
  rounds.forEach(function(r) { var k = commWeekKey(r.date); if (k) keys[k] = true; });
  var list = Object.keys(keys).sort();
  if (!list.length) return 0;
  function absWeek(k) { var p = k.split('-W'); return parseInt(p[0], 10) * 53 + parseInt(p[1], 10); }
  var best = 1, cur = 1;
  for (var i = 1; i < list.length; i++) {
    if (absWeek(list[i]) - absWeek(list[i - 1]) === 1) { cur++; if (cur > best) best = cur; }
    else { cur = 1; }
  }
  return best;
}

/* Statistiques agrégées à partir des parties locales */
function commComputeStats(rounds) {
  var s = {
    rounds: rounds.length, birdies: 0, eagles: 0, pars: 0, totalGir: 0, totalFir: 0,
    bestScore18: null, bestGir: 0, bestFir: 0, minPutts: null, streak: 0, baseXp: 0, xp: 0
  };

  rounds.forEach(function(r) {
    s.totalGir += (r.gir || 0);
    s.totalFir += (r.fir || 0);
    if ((r.gir || 0) > s.bestGir) s.bestGir = r.gir || 0;
    if ((r.fir || 0) > s.bestFir) s.bestFir = r.fir || 0;
    if (r.putts != null && (s.minPutts === null || r.putts < s.minPutts)) s.minPutts = r.putts;

    var filled = Array.isArray(r.scores) ? r.scores.filter(function(x) { return x != null; }).length : 0;
    if (filled === 18 && r.score != null) {
      if (s.bestScore18 === null || r.score < s.bestScore18) s.bestScore18 = r.score;
    }

    var pars = commCoursePars(r);
    if (pars && Array.isArray(r.scores)) {
      r.scores.forEach(function(sc, i) {
        if (sc == null || pars[i] == null) return;
        var rel = sc - pars[i];
        if (rel <= -2) s.eagles++;
        else if (rel === -1) s.birdies++;
        else if (rel === 0) s.pars++;
      });
    }
  });

  s.streak = commLongestWeekStreak(rounds);
  s.baseXp = s.rounds * COMM_XP.round + s.birdies * COMM_XP.birdie + s.eagles * COMM_XP.eagle
           + s.pars * COMM_XP.par + s.totalGir * COMM_XP.gir;
  return s;
}

/* ─── Trophées à PALIERS ─── */
function commAchievements(s) {
  var defs = [
    { icon: '🏌️', title: 'Parties jouées',       unit: 'parties',  val: s.rounds,      tiers: [1, 5, 10, 25, 50, 100] },
    { icon: '🐦', title: 'Birdies',              unit: 'birdies',  val: s.birdies,     tiers: [1, 5, 10, 25, 100, 1000] },
    { icon: '🦅', title: 'Eagles',               unit: 'eagles',   val: s.eagles,      tiers: [1, 3, 5, 10, 25] },
    { icon: '🎯', title: 'Pars réalisés',        unit: 'pars',     val: s.pars,        tiers: [10, 50, 100, 250, 500, 1000] },
    { icon: '🟢', title: 'Greens en régulation', unit: 'GIR',      val: s.totalGir,    tiers: [10, 50, 100, 250, 500] },
    { icon: '🛣️', title: 'Fairways touchés',     unit: 'fairways', val: s.totalFir,    tiers: [10, 50, 100, 250, 500] },
    { icon: '🔥', title: 'Série de semaines',     unit: 'sem.',     val: s.streak,      tiers: [2, 3, 5, 8, 12, 20] },
    { icon: '🏆', title: 'Meilleure carte 18',   unit: '',         val: s.bestScore18, inverse: true, tiers: [100, 95, 90, 85, 80, 75] },
    { icon: '🧘', title: 'Économie de putts',    unit: 'putts',    val: s.minPutts,    inverse: true, tiers: [34, 32, 30, 28, 26] }
  ];
  return defs.map(commComputeAch);
}

function commComputeAch(d) {
  var tiers = d.tiers, val = d.val, n = tiers.length, ti = 0, i;
  if (d.inverse) {
    if (val != null) { for (i = 0; i < n; i++) { if (val <= tiers[i]) ti = i + 1; } }
  } else {
    for (i = 0; i < n; i++) { if ((val || 0) >= tiers[i]) ti = i + 1; }
  }
  var maxed = ti >= n;
  var nextV = maxed ? null : tiers[ti];
  var prevV = ti > 0 ? tiers[ti - 1] : (d.inverse ? null : 0);

  var pct = 0;
  if (maxed) {
    pct = 100;
  } else if (d.inverse) {
    if (val != null) {
      var hi = (ti > 0) ? tiers[ti - 1] : (tiers[0] + Math.max(2, tiers[0] - tiers[1]));
      pct = Math.round(commClamp((hi - val) / (hi - nextV), 0, 1) * 100);
    }
  } else {
    pct = Math.round(commClamp(((val || 0) - prevV) / (nextV - prevV), 0, 1) * 100);
  }

  var bonusXp = 0;
  for (var t = 1; t <= ti; t++) bonusXp += t * 30;

  return {
    icon: d.icon, title: d.title, unit: d.unit, inverse: !!d.inverse, val: val,
    tiers: tiers, tierIndex: ti, maxed: maxed, nextV: nextV, pct: pct, bonusXp: bonusXp,
    medal: ti > 0 ? COMM_MEDALS[Math.min(ti - 1, COMM_MEDALS.length - 1)] : null
  };
}

/* ─── PAGE ─── */
function buildCommunityPage(container) {
  if (!container) return;
  while (container.firstChild) container.removeChild(container.firstChild);

  var rounds = (typeof lsGet === 'function' && lsGet('rounds')) || [];
  var s = commComputeStats(rounds);
  var achs = commAchievements(s);

  var tierXp = achs.reduce(function(a, x) { return a + x.bonusXp; }, 0);
  s.xp = s.baseXp + tierXp;
  var lv = commLevelFromXp(s.xp);
  var pctLevel = Math.round((lv.into / lv.need) * 100);

  var paliersDone = achs.reduce(function(a, x) { return a + x.tierIndex; }, 0);
  var paliersTot = achs.reduce(function(a, x) { return a + x.tiers.length; }, 0);

  // ── Héros : niveau + XP ──
  var hero = ''
    + '<div class="comm-hero">'
    + '<div class="comm-hero-top">'
    +   '<div class="comm-level-badge"><span class="comm-level-num">' + lv.level + '</span></div>'
    +   '<div class="comm-hero-info">'
    +     '<div class="comm-hero-title">' + commEsc(lv.title) + '</div>'
    +     '<div class="comm-hero-sub">Niveau ' + lv.level + ' · ' + s.xp + ' XP</div>'
    +   '</div>'
    +   '<div class="comm-hero-streak"><div class="comm-streak-val">' + s.streak + '</div><div class="comm-streak-lbl">🔥 série (sem.)</div></div>'
    + '</div>'
    + '<div class="comm-xp-bar"><div class="comm-xp-fill" style="width:' + pctLevel + '%"></div></div>'
    + '<div class="comm-xp-text">' + lv.into + ' / ' + lv.need + ' XP vers le niveau ' + (lv.level + 1) + '</div>'
    + '</div>';

  // ── Pills stats ──
  var pills = ''
    + '<div class="comm-pills">'
    +   '<div class="comm-pill"><div class="comm-pill-v">' + s.rounds + '</div><div class="comm-pill-l">Parties</div></div>'
    +   '<div class="comm-pill"><div class="comm-pill-v">' + s.birdies + '</div><div class="comm-pill-l">Birdies</div></div>'
    +   '<div class="comm-pill"><div class="comm-pill-v">' + paliersDone + '/' + paliersTot + '</div><div class="comm-pill-l">Paliers</div></div>'
    +   '<div class="comm-pill"><div class="comm-pill-v">' + (s.bestScore18 !== null ? s.bestScore18 : '—') + '</div><div class="comm-pill-l">Meilleur 18</div></div>'
    + '</div>';

  // ── Trophées à paliers ──
  var cards = achs.map(commAchCard).join('');
  var badgeSection = ''
    + '<div class="comm-section-head"><div class="comm-section-title">🏅 Mes trophées</div>'
    + '<div class="comm-section-sub">' + paliersDone + ' palier' + (paliersDone > 1 ? 's' : '') + ' débloqué' + (paliersDone > 1 ? 's' : '') + ' sur ' + paliersTot + '</div></div>'
    + '<div class="comm-ach-grid">' + cards + '</div>';

  container.innerHTML = ''
    + '<div class="dash-header"><div><div class="dash-greeting">Communauté</div>'
    + '<div class="dash-meta">Franchis les paliers, débloque tes médailles et suis les performances de tes amis</div></div></div>'
    + hero + pills + badgeSection
    + '<div class="comm-section-head" style="margin-top:26px"><div class="comm-section-title">📣 Fil d\'activité</div>'
    + '<div class="comm-section-sub">Les dernières parties de ta communauté</div></div>'
    + '<div id="comm-feed"><div class="comm-feed-loading">Chargement…</div></div>';

  commRenderFeed();
}

/* Une carte de trophée (paliers) */
function commAchCard(a) {
  var pips = '';
  for (var i = 0; i < a.tiers.length; i++) {
    pips += '<span class="comm-pip' + (i < a.tierIndex ? ' on' : '') + '"'
      + (i < a.tierIndex && a.medal ? ' style="background:' + a.medal.c + '"' : '') + '></span>';
  }
  var tierLabel = a.tierIndex > 0 ? ('Palier ' + a.tierIndex + '/' + a.tiers.length + ' · ' + a.medal.name) : 'À débloquer';
  var medalStyle = a.medal ? ('border-color:' + a.medal.c + ';color:' + a.medal.c + ';background:' + a.medal.bg) : '';

  var nextLine;
  if (a.maxed) {
    nextLine = '<div class="comm-ach-next done">🏅 Palier maximum atteint !</div>';
  } else if (a.inverse) {
    var sym = (a.unit === 'putts') ? '≤ ' : 'sous ';
    nextLine = '<div class="comm-ach-next">Prochain : ' + sym + a.nextV + (a.unit ? ' ' + a.unit : '') + '</div>';
  } else {
    nextLine = '<div class="comm-ach-next">Prochain : ' + a.nextV + ' ' + a.unit + '</div>';
  }

  var showBar = (!a.inverse || a.val != null);
  var bar = showBar
    ? '<div class="comm-ach-bar"><div class="comm-ach-bar-fill" style="width:' + a.pct + '%' + (a.medal ? ';background:' + a.medal.c : '') + '"></div></div>'
    : '';

  var count = '';
  if (!a.maxed) {
    count = a.inverse
      ? '<div class="comm-ach-count">' + (a.val != null ? 'Meilleur : ' + a.val : 'Pas encore de donnée') + '</div>'
      : '<div class="comm-ach-count">' + (a.val || 0) + ' / ' + a.nextV + '</div>';
  }

  var tierNum = a.tierIndex > 0 ? '<span class="comm-ach-tiernum" style="background:' + a.medal.c + '">' + a.tierIndex + '</span>' : '';

  return '<div class="comm-ach ' + (a.tierIndex > 0 ? 'on' : 'off') + '">'
    + '<div class="comm-ach-top">'
    +   '<div class="comm-ach-medal" style="' + medalStyle + '">' + a.icon + tierNum + '</div>'
    +   '<div class="comm-ach-head"><div class="comm-ach-title">' + commEsc(a.title) + '</div>'
    +     '<div class="comm-ach-tier"' + (a.medal ? ' style="color:' + a.medal.c + '"' : '') + '>' + commEsc(tierLabel) + '</div></div>'
    + '</div>'
    + '<div class="comm-pips">' + pips + '</div>'
    + nextLine + bar + count
    + '</div>';
}

/* ─── FIL D'ACTIVITÉ ─── */
function commRenderFeed() {
  var host = document.getElementById('comm-feed');
  if (!host) return;

  if (typeof cloudActive !== 'function' || !cloudActive()) {
    var mine = (lsGet('rounds') || []).slice(0, 10);
    var cta = '<div class="comm-cta">'
      + '<div class="comm-cta-ico">👥</div>'
      + '<div class="comm-cta-txt"><strong>Rejoins la communauté</strong><br>'
      + 'Crée un compte et rejoins un groupe pour voir les parties de tes amis et te comparer à eux.</div>'
      + '</div>';
    if (!mine.length) { host.innerHTML = cta; return; }
    var meCards = mine.map(function(r) { return commFeedCard(currentUser, r, true); }).join('');
    host.innerHTML = cta + '<div class="comm-feed-list">' + meCards + '</div>';
    commWireKudos(host);
    return;
  }

  var sb = window.sbClient, uid = currentUser.id;
  sb.from('group_members').select('group_id').eq('user_id', uid).then(function(res) {
    var gids = (res.data || []).map(function(r) { return r.group_id; });
    if (!gids.length) {
      var mine2 = (lsGet('rounds') || []).slice(0, 10);
      var cta2 = '<div class="comm-cta"><div class="comm-cta-ico">🎯</div>'
        + '<div class="comm-cta-txt"><strong>Tu n\'es dans aucun groupe</strong><br>'
        + 'Va dans l\'onglet Groupes, crée une équipe et invite tes amis pour activer le fil communautaire.</div></div>';
      host.innerHTML = cta2 + '<div class="comm-feed-list">'
        + mine2.map(function(r) { return commFeedCard(currentUser, r, true); }).join('') + '</div>';
      commWireKudos(host);
      return;
    }
    sb.from('group_members').select('user_id').in('group_id', gids).then(function(mres) {
      var uids = {}; (mres.data || []).forEach(function(m) { uids[m.user_id] = 1; });
      var idList = Object.keys(uids);
      Promise.all([
        sb.from('profiles').select('id, name, initials, color, bg, hcp').in('id', idList),
        sb.from('rounds').select('id, user_id, score, par, gir, fir, fir_total, putts, course, played_on')
          .in('user_id', idList).order('played_on', { ascending: false }).limit(30)
      ]).then(function(r2) {
        var byId = {}; (r2[0].data || []).forEach(function(p) { byId[p.id] = p; });
        var list = (r2[1].data || []);
        if (!list.length) {
          host.innerHTML = '<div class="comm-feed-empty">Aucune partie enregistrée dans ta communauté pour l\'instant. Sois le premier ! ⛳</div>';
          return;
        }
        var cards = list.map(function(row) {
          var prof = byId[row.user_id] || { name: 'Joueur', initials: '?', color: '#C9A84C', bg: 'rgba(201,168,76,0.2)' };
          var r = { id: row.id, course: row.course, score: row.score, par: row.par, gir: row.gir,
            fir: row.fir, firTotal: row.fir_total, putts: row.putts, date: row.played_on };
          return commFeedCard(prof, r, row.user_id === uid);
        }).join('');
        host.innerHTML = '<div class="comm-feed-list">' + cards + '</div>';
        commWireKudos(host);
      }, function(e) {
        host.innerHTML = '<div class="comm-feed-empty">Impossible de charger le fil (' + commEsc(e.message || '') + ').</div>';
      });
    });
  }, function() {
    host.innerHTML = '<div class="comm-feed-empty">Connexion requise pour le fil communautaire.</div>';
  });
}

/* Une carte du fil */
function commFeedCard(prof, r, isMe) {
  var rel = (r.score != null && r.par != null) ? (r.score - r.par) : null;
  var relStr = rel === null ? '' : (rel > 0 ? '+' + rel : (rel === 0 ? 'PAR' : '' + rel));
  var relCls = rel === null ? '' : (rel < 0 ? 'good' : (rel === 0 ? 'par' : 'over'));
  var av = '<div class="comm-av" style="background:' + (prof.bg || 'rgba(201,168,76,0.2)') + ';color:' + (prof.color || '#C9A84C') + '">' + commEsc(prof.initials || '?') + '</div>';
  var chips = '';
  if (r.gir != null) chips += '<span class="comm-chip">🟢 ' + r.gir + ' GIR</span>';
  if (r.firTotal) chips += '<span class="comm-chip">🛣️ ' + (r.fir || 0) + '/' + r.firTotal + '</span>';
  if (r.putts != null) chips += '<span class="comm-chip">🏌️ ' + r.putts + ' putts</span>';

  var kudos = commKudosCount(r.id);
  var mineKudo = commIHaveKudoed(r.id) ? ' on' : '';

  return '<div class="comm-card">'
    + '<div class="comm-card-head">' + av
    + '<div class="comm-card-who"><div class="comm-card-name">' + commEsc(prof.name || 'Joueur') + (isMe ? ' <span class="comm-me">toi</span>' : '') + '</div>'
    + '<div class="comm-card-when">' + commEsc(commRelDate(r.date)) + (r.course ? ' · ' + commEsc(r.course) : '') + '</div></div>'
    + (relStr ? '<div class="comm-card-score ' + relCls + '"><div class="comm-card-score-v">' + (r.score != null ? r.score : '—') + '</div><div class="comm-card-score-r">' + relStr + '</div></div>' : '')
    + '</div>'
    + (chips ? '<div class="comm-card-chips">' + chips + '</div>' : '')
    + '<div class="comm-card-foot"><button class="comm-kudos' + mineKudo + '" data-rid="' + commEsc('' + r.id) + '">👏 <span class="comm-kudos-n">' + kudos + '</span></button></div>'
    + '</div>';
}

/* ─── KUDOS (local, par appareil) ─── */
function commKudosStore() { return (lsGet('kudos') || {}); }
function commKudosCount(rid) { var k = commKudosStore()[rid]; return k ? (k.base || 0) + (k.me ? 1 : 0) : 0; }
function commIHaveKudoed(rid) { var k = commKudosStore()[rid]; return !!(k && k.me); }
function commWireKudos(host) {
  host.querySelectorAll('.comm-kudos').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var rid = btn.getAttribute('data-rid');
      var store = commKudosStore();
      var k = store[rid] || { base: 0, me: false };
      k.me = !k.me;
      store[rid] = k;
      lsSet('kudos', store);
      btn.classList.toggle('on', k.me);
      var n = btn.querySelector('.comm-kudos-n');
      if (n) n.textContent = (k.base || 0) + (k.me ? 1 : 0);
      if (k.me) { btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop'); }
    });
  });
}

/* Date relative « il y a … » */
function commRelDate(dateStr) {
  if (!dateStr) return 'récemment';
  var d = new Date(dateStr);
  if (isNaN(d.getTime())) return commEsc(dateStr);
  var days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return 'aujourd\'hui';
  if (days === 1) return 'hier';
  if (days < 7) return 'il y a ' + days + ' jours';
  if (days < 14) return 'la semaine dernière';
  if (days < 31) return 'il y a ' + Math.floor(days / 7) + ' semaines';
  if (days < 365) return 'il y a ' + Math.floor(days / 30) + ' mois';
  return 'il y a longtemps';
}

function commEsc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
