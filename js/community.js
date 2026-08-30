/* ════════════════════════════════════════════
 * THE SMART GOLFER — community.js
 * Onglet COMMUNAUTÉ : Gamification (XP, niveaux, badges, séries)
 * + Fil d'activité type « Strava » (parties des membres de tes groupes).
 *
 * Gamification = 100 % local (fonctionne en démo ET en cloud, sans réseau).
 * Fil social = cloud uniquement (lit les parties des groupmates via la
 * policy RLS rounds_select_groupmate déjà en place côté Supabase).
 *
 * Dépend de : app.js (lsGet, showToast, currentUser), data.js (getAllCourses),
 *             auth.js (cloudActive), supabaseClient.js (window.sbClient).
 * ════════════════════════════════════════════ */

/* ─── Barème XP ─── */
var COMM_XP = { round: 50, birdie: 15, eagle: 40, par: 3, gir: 2 };

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
  // Jeudi de la semaine courante (norme ISO 8601)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  var week1 = new Date(d.getFullYear(), 0, 4);
  var weekNo = 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return d.getFullYear() + '-W' + (weekNo < 10 ? '0' + weekNo : weekNo);
}

/* Plus longue série de semaines consécutives jouées */
function commLongestWeekStreak(rounds) {
  var keys = {};
  rounds.forEach(function(r) {
    var k = commWeekKey(r.date);
    if (k) keys[k] = true;
  });
  var list = Object.keys(keys).sort();
  if (!list.length) return 0;
  // Convertir chaque clé en index de semaine absolu comparable
  function absWeek(k) {
    var parts = k.split('-W');
    return parseInt(parts[0], 10) * 53 + parseInt(parts[1], 10);
  }
  var best = 1, cur = 1;
  for (var i = 1; i < list.length; i++) {
    if (absWeek(list[i]) - absWeek(list[i - 1]) === 1) {
      cur++;
      if (cur > best) best = cur;
    } else {
      cur = 1;
    }
  }
  return best;
}

/* Statistiques agrégées à partir des parties locales */
function commComputeStats(rounds) {
  var s = {
    rounds: rounds.length, birdies: 0, eagles: 0, pars: 0, totalGir: 0,
    bestScore18: null, bestGir: 0, bestFir: 0, minPutts: null,
    streak: 0, xp: 0
  };

  rounds.forEach(function(r) {
    s.totalGir += (r.gir || 0);
    if ((r.gir || 0) > s.bestGir) s.bestGir = r.gir || 0;
    if ((r.fir || 0) > s.bestFir) s.bestFir = r.fir || 0;
    if (r.putts != null && (s.minPutts === null || r.putts < s.minPutts)) s.minPutts = r.putts;

    // Score 18 trous (parties complètes uniquement)
    var filled = Array.isArray(r.scores) ? r.scores.filter(function(x) { return x != null; }).length : 0;
    if (filled === 18 && r.score != null) {
      if (s.bestScore18 === null || r.score < s.bestScore18) s.bestScore18 = r.score;
    }

    // Birdies / eagles / pars par trou
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
  s.xp = s.rounds * COMM_XP.round + s.birdies * COMM_XP.birdie + s.eagles * COMM_XP.eagle
       + s.pars * COMM_XP.par + s.totalGir * COMM_XP.gir;
  return s;
}

/* Définition des badges (progression cur/target) */
function commBadges(s) {
  function b(icon, title, desc, cur, target) {
    var c = Math.min(cur, target);
    return { icon: icon, title: title, desc: desc, cur: c, target: target,
      done: cur >= target, pct: Math.round(Math.min(1, cur / target) * 100) };
  }
  // Score : plus c'est bas mieux c'est → on convertit en « atteint / pas atteint »
  function score(icon, title, desc, best, threshold) {
    var done = (best !== null && best < threshold);
    return { icon: icon, title: title, desc: desc, cur: done ? 1 : 0, target: 1,
      done: done, pct: done ? 100 : 0 };
  }
  return [
    b('🏌️', 'Première partie', 'Enregistre ta 1re partie', s.rounds, 1),
    b('📅', 'Habitué', '5 parties enregistrées', s.rounds, 5),
    b('🔥', 'Passionné', '15 parties enregistrées', s.rounds, 15),
    b('👑', 'Légende du club', '30 parties enregistrées', s.rounds, 30),
    b('🐦', 'Premier birdie', 'Réalise un birdie', s.birdies, 1),
    b('🦅', 'Aigle royal', 'Réalise un eagle', s.eagles, 1),
    b('🎯', 'Chasseur de birdies', '10 birdies au total', s.birdies, 10),
    b('🟢', 'GIR machine', '9 greens régulés dans une partie', s.bestGir, 9),
    b('💚', 'Sniper des greens', '14 greens régulés dans une partie', s.bestGir, 14),
    b('🛣️', 'Rouleau compresseur', '10 fairways touchés dans une partie', s.bestFir, 10),
    score('🧘', 'Putting zen', '30 putts ou moins sur une partie', s.minPutts, 31),
    score('🪄', 'Maître du putter', '27 putts ou moins sur une partie', s.minPutts, 28),
    score('💯', 'Sous les 100', 'Une carte 18 trous sous 100', s.bestScore18, 100),
    score('🎖️', 'Sous les 90', 'Une carte 18 trous sous 90', s.bestScore18, 90),
    score('🏆', 'Sous les 85', 'Une carte 18 trous sous 85', s.bestScore18, 85),
    score('💎', 'Sous les 80', 'Une carte 18 trous sous 80', s.bestScore18, 80),
    b('⚡', 'Série de 3', '3 semaines de golf d\'affilée', s.streak, 3),
    b('🌟', 'Série de 8', '8 semaines de golf d\'affilée', s.streak, 8)
  ];
}

/* ─── PAGE ─── */
function buildCommunityPage(container) {
  if (!container) return;
  while (container.firstChild) container.removeChild(container.firstChild);

  var rounds = (typeof lsGet === 'function' && lsGet('rounds')) || [];
  var s = commComputeStats(rounds);
  var lv = commLevelFromXp(s.xp);
  var badges = commBadges(s);
  var unlocked = badges.filter(function(x) { return x.done; }).length;
  var pctLevel = Math.round((lv.into / lv.need) * 100);

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

  // ── Stat pills ──
  var pills = ''
    + '<div class="comm-pills">'
    +   '<div class="comm-pill"><div class="comm-pill-v">' + s.rounds + '</div><div class="comm-pill-l">Parties</div></div>'
    +   '<div class="comm-pill"><div class="comm-pill-v">' + s.birdies + '</div><div class="comm-pill-l">Birdies</div></div>'
    +   '<div class="comm-pill"><div class="comm-pill-v">' + unlocked + '/' + badges.length + '</div><div class="comm-pill-l">Trophées</div></div>'
    +   '<div class="comm-pill"><div class="comm-pill-v">' + (s.bestScore18 !== null ? s.bestScore18 : '—') + '</div><div class="comm-pill-l">Meilleur 18</div></div>'
    + '</div>';

  // ── Grille de badges ──
  var cards = badges.map(function(bd) {
    var prog = (!bd.done && bd.target > 1)
      ? '<div class="comm-badge-prog"><div class="comm-badge-prog-fill" style="width:' + bd.pct + '%"></div></div><div class="comm-badge-progtxt">' + bd.cur + ' / ' + bd.target + '</div>'
      : '';
    return '<div class="comm-badge ' + (bd.done ? 'on' : 'off') + '">'
      + '<div class="comm-badge-ico">' + bd.icon + '</div>'
      + '<div class="comm-badge-title">' + commEsc(bd.title) + '</div>'
      + '<div class="comm-badge-desc">' + commEsc(bd.desc) + '</div>'
      + prog
      + (bd.done ? '<div class="comm-badge-check">✓ Débloqué</div>' : '')
      + '</div>';
  }).join('');

  var badgeSection = ''
    + '<div class="comm-section-head"><div class="comm-section-title">🏅 Mes trophées</div>'
    + '<div class="comm-section-sub">' + unlocked + ' débloqué' + (unlocked > 1 ? 's' : '') + ' sur ' + badges.length + '</div></div>'
    + '<div class="comm-badges-grid">' + cards + '</div>';

  container.innerHTML = ''
    + '<div class="dash-header"><div><div class="dash-greeting">Communauté</div>'
    + '<div class="dash-meta">Gagne de l\'XP, débloque des trophées et suis les performances de tes amis</div></div></div>'
    + hero + pills + badgeSection
    + '<div class="comm-section-head" style="margin-top:26px"><div class="comm-section-title">📣 Fil d\'activité</div>'
    + '<div class="comm-section-sub">Les dernières parties de ta communauté</div></div>'
    + '<div id="comm-feed"><div class="comm-feed-loading">Chargement…</div></div>';

  commRenderFeed();
}

/* ─── FIL D'ACTIVITÉ ─── */
function commRenderFeed() {
  var host = document.getElementById('comm-feed');
  if (!host) return;

  // Mode local / démo : pas de communauté → on montre le fil perso + une invitation
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

  // Mode cloud : parties des membres de mes groupes (+ les miennes)
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
