/* ════════════════════════════════════════════
 * THE SMART GOLFER — celebrate.js
 * Écran de célébration de fin de partie : bilan, temps forts, confettis.
 * Détecte automatiquement record personnel, birdies/eagles, seuils de score.
 * Appelé après l'enregistrement d'une partie (saveRound / saisie rapide).
 * Dépend de : app.js (lsGet, showToast), data.js (getAllCourses).
 * ════════════════════════════════════════════ */

function qsCelebrate(entry) {
  if (!entry) return;
  var facts = celBuildFacts(entry);
  var played = celPlayedInfo(entry);

  var ex = document.getElementById('cel-modal');
  if (ex) ex.remove();

  var m = document.createElement('div');
  m.id = 'cel-modal';
  m.className = 'cel-modal';

  var rel = entry.score - played.par;
  var relStr = 'PAR';
  if (rel > 0) relStr = '+' + rel;
  if (rel < 0) relStr = '' + rel;
  var holesNote = (played.holes && played.holes < 18) ? (' · ' + played.holes + ' trous') : '';

  var highlights = facts.highlights.map(function(h) {
    return '<div class="cel-hl"><span class="cel-hl-i">' + h.icon + '</span>'
      + '<div><div class="cel-hl-t">' + celEsc(h.title) + '</div>'
      + '<div class="cel-hl-d">' + celEsc(h.desc) + '</div></div></div>';
  }).join('');

  m.innerHTML = ''
    + '<canvas class="cel-canvas" id="cel-canvas"></canvas>'
    + '<div class="cel-card">'
    +   '<div class="cel-kicker">' + celEsc(facts.kicker) + '</div>'
    +   '<div class="cel-score"><span class="cel-score-v">' + entry.score + '</span>'
    +     '<span class="cel-score-r">' + relStr + '</span></div>'
    +   '<div class="cel-course">' + celEsc(entry.course) + holesNote + '</div>'
    +   '<div class="cel-stats">'
    +     '<div class="cel-stat"><div class="cel-stat-v">' + (entry.gir !== null && entry.gir !== undefined ? entry.gir : '—') + '</div><div class="cel-stat-l">Greens</div></div>'
    +     '<div class="cel-stat"><div class="cel-stat-v">' + (entry.fir !== null && entry.fir !== undefined ? entry.fir : '—') + '</div><div class="cel-stat-l">Fairways</div></div>'
    +     '<div class="cel-stat"><div class="cel-stat-v">' + (entry.putts ? entry.putts : '—') + '</div><div class="cel-stat-l">Putts</div></div>'
    +   '</div>'
    +   (highlights ? '<div class="cel-hls">' + highlights + '</div>' : '')
    +   '<div class="cel-actions">'
    +     '<button class="qs-btn-ghost" id="cel-close">Fermer</button>'
    +     '<button class="qs-btn-gold" id="cel-go">Voir mon analyse →</button>'
    +   '</div>'
    + '</div>';

  document.body.appendChild(m);

  function close() {
    if (m._raf) cancelAnimationFrame(m._raf);
    m.remove();
  }
  document.getElementById('cel-close').addEventListener('click', close);
  document.getElementById('cel-go').addEventListener('click', function() {
    close();
    if (typeof showPage === 'function') showPage('dashboard');
  });
  m.addEventListener('click', function(e) { if (e.target === m) close(); });

  if (facts.confetti) celConfetti(m);
}

/* Analyse de la partie → accroche + temps forts */
function celBuildFacts(entry) {
  var rounds = (typeof lsGet === 'function' && lsGet('rounds')) || [];
  var others = rounds.filter(function(r) { return r.id !== entry.id; });
  var highlights = [];
  var confetti = false;
  var kicker = 'Partie enregistrée';

  /* Record personnel (parties complètes uniquement) */
  var complete = Array.isArray(entry.scores) && entry.scores.filter(function(s) { return s !== null && s !== undefined; }).length === 18;
  // On ne compare que des cartes 18 trous entre elles
  var prevBest = null;
  others.forEach(function(r) {
    if (r.score === null || r.score === undefined) return;
    var full = Array.isArray(r.scores) && r.scores.filter(function(x) { return x !== null && x !== undefined; }).length === 18;
    if (!full) return;
    if (prevBest === null || r.score < prevBest) prevBest = r.score;
  });
  if (prevBest !== null && complete && entry.score < prevBest) {
    kicker = '🏆 Record personnel !';
    confetti = true;
    highlights.push({ icon: '🏆', title: 'Nouveau record', desc: 'Ton meilleur score à ce jour — l\'ancien était ' + prevBest + '.' });
  } else if (others.length === 0) {
    kicker = '🎉 Ta première partie !';
    confetti = true;
    highlights.push({ icon: '🌱', title: 'C\'est parti', desc: 'Ta première carte est enregistrée. Tout commence ici.' });
  }

  /* Birdies / eagles */
  var pars = celCoursePars(entry);
  if (pars && Array.isArray(entry.scores)) {
    var birdies = 0, eagles = 0, parsMade = 0;
    entry.scores.forEach(function(s, i) {
      if (s === null || s === undefined || pars[i] === null || pars[i] === undefined) return;
      var d = s - pars[i];
      if (d <= -2) eagles++;
      else if (d === -1) birdies++;
      else if (d === 0) parsMade++;
    });
    if (eagles > 0) {
      confetti = true;
      if (kicker === 'Partie enregistrée') kicker = '🦅 Eagle !';
      highlights.push({ icon: '🦅', title: eagles + ' eagle' + (eagles > 1 ? 's' : ''), desc: 'Le genre de coup dont on parle au clubhouse.' });
    }
    if (birdies > 0) {
      if (birdies >= 3) confetti = true;
      highlights.push({ icon: '🐦', title: birdies + ' birdie' + (birdies > 1 ? 's' : ''), desc: birdies >= 3 ? 'Une carte pleine d\'occasions converties.' : 'Chaque birdie compte.' });
    }
    if (parsMade >= 6) {
      highlights.push({ icon: '🎯', title: parsMade + ' pars', desc: 'De la régularité — c\'est ça qui fait baisser les scores.' });
    }
  }

  /* Seuils de score */
  if (complete) {
    var seuils = [80, 85, 90, 100];
    for (var i = 0; i < seuils.length; i++) {
      var s = seuils[i];
      if (entry.score < s) {
        var wasFirst = !others.some(function(r) {
          var full = Array.isArray(r.scores) && r.scores.filter(function(x) { return x !== null && x !== undefined; }).length === 18;
          return full && r.score < s;
        });
        if (wasFirst) {
          confetti = true;
          if (kicker === 'Partie enregistrée') kicker = '💥 Sous les ' + s + ' !';
          highlights.push({ icon: '💯', title: 'Première fois sous ' + s, desc: 'Un cap franchi. Il ne se refranchit jamais pour la première fois deux fois.' });
        }
        break;
      }
    }
  }

  /* Putting — seulement si les putts ont été saisis sur (quasi) tous les trous */
  var pl = celPlayedInfo(entry);
  var puttsCredible = entry.putts && entry.putts >= pl.holes;
  var puttsSeuil = Math.round(pl.holes * 1.7);   // ~30 putts sur 18 trous
  if (puttsCredible && entry.putts <= puttsSeuil) {
    highlights.push({ icon: '🧘', title: entry.putts + ' putt' + (entry.putts > 1 ? 's' : '') + ' seulement', desc: 'Un vrai travail sur les greens.' });
  }
  /* Greens */
  if (entry.gir >= 9) {
    highlights.push({ icon: '🟢', title: entry.gir + ' greens en régulation', desc: 'Tes fers t\'ont porté aujourd\'hui.' });
  }

  if (!highlights.length) {
    highlights.push({ icon: '📈', title: 'Une carte de plus', desc: 'Chaque partie enregistrée affine ton analyse et ton plan d\'entraînement.' });
  }
  if (kicker === 'Partie enregistrée') {
    var rel = entry.score - entry.par;
    if (rel <= 5) { kicker = '👏 Belle partie !'; }
  }

  return { kicker: kicker, highlights: highlights.slice(0, 4), confetti: confetti };
}

/* Trous réellement saisis + par cumulé sur ces trous */
function celPlayedInfo(entry) {
  var pars = celCoursePars(entry);
  var holes = 0, par = 0;
  if (Array.isArray(entry.scores)) {
    entry.scores.forEach(function(sc, i) {
      if (sc === null || sc === undefined) return;
      holes++;
      if (pars && pars[i] !== null && pars[i] !== undefined) par += pars[i];
    });
  }
  if (!holes || !par) return { holes: holes || 18, par: entry.par };
  return { holes: holes, par: par };
}

function celCoursePars(entry) {
  if (!entry || !entry.courseId) return null;
  var courses = (typeof getAllCourses === 'function') ? getAllCourses() : [];
  for (var i = 0; i < courses.length; i++) {
    if (courses[i].id === entry.courseId && courses[i].trous) {
      return courses[i].trous.map(function(t) { return t.par; });
    }
  }
  return null;
}

/* Confettis — canvas, respecte prefers-reduced-motion */
function celConfetti(host) {
  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  if (reduce) return;

  var cv = document.getElementById('cel-canvas');
  if (!cv) return;
  var ctx = cv.getContext('2d');
  var dpr = window.devicePixelRatio || 1;

  function size() {
    cv.width = cv.clientWidth * dpr;
    cv.height = cv.clientHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  size();

  var colors = ['#C9A84C', '#E8C96A', '#2E6B36', '#6FBF7A', '#FFFFFF', '#A8851E'];
  var parts = [];
  var W = cv.clientWidth, H = cv.clientHeight;
  for (var i = 0; i < 110; i++) {
    parts.push({
      x: Math.random() * W,
      y: -20 - Math.random() * H * 0.5,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      vy: 1.6 + Math.random() * 2.6,
      vx: -0.8 + Math.random() * 1.6,
      rot: Math.random() * Math.PI,
      vr: -0.09 + Math.random() * 0.18,
      c: colors[Math.floor(Math.random() * colors.length)]
    });
  }

  var t0 = Date.now();
  function frame() {
    ctx.clearRect(0, 0, W, H);
    var alive = false;
    parts.forEach(function(p) {
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      if (p.y < H + 30) alive = true;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.c;
      ctx.globalAlpha = 0.92;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    if (alive && Date.now() - t0 < 6000) {
      host._raf = requestAnimationFrame(frame);
    } else {
      ctx.clearRect(0, 0, W, H);
    }
  }
  host._raf = requestAnimationFrame(frame);
}

function celEsc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
