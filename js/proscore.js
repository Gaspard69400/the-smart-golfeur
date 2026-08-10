/* ════════════════════════════════════════════
 * THE SMART GOLFER — proscore.js
 * Saisie de score IMMERSIVE (Mode Pro) — trou par trou, plein écran.
 * Visuel de trou stylisé + gros +/− pour score/putts, FIR/GIR.
 * Écrit dans les globals scores[]/putts[]/firState/girState puis appelle saveRound().
 * Dépend de : scorecard.js (selectedCourse, scores, putts, firState, girState, saveRound)
 * ════════════════════════════════════════════ */

var _immHole = 1;

function openImmersiveScoring() {
  if (typeof selectedCourse === 'undefined' || !selectedCourse) {
    if (typeof showToast === 'function') showToast('Choisis d\'abord un parcours');
    return;
  }
  // Repartir sur une carte vierge
  scores = new Array(18).fill(null);
  putts = new Array(18).fill(null);
  firState = {};
  girState = {};
  if (typeof roundStarted !== 'undefined') roundStarted = true;
  window.sc_proMode = false;
  _immHole = 1;

  var ex = document.getElementById('imm-overlay');
  if (ex) ex.remove();
  var ov = document.createElement('div');
  ov.id = 'imm-overlay';
  ov.className = 'imm-overlay';
  ov.innerHTML = '<div class="imm-stage" id="imm-stage"></div>';
  document.body.appendChild(ov);
  immRender();
}

function immClose(skipConfirm) {
  var ov = document.getElementById('imm-overlay');
  if (!ov) return;
  var hasData = scores.some(function(s) { return s !== null; });
  if (!skipConfirm && hasData && !confirm('Quitter la saisie ? Les scores non enregistrés seront perdus.')) return;
  ov.remove();
}

function immRender() {
  var stage = document.getElementById('imm-stage');
  if (!stage) return;
  var course = selectedCourse;
  var hole = course.trous[_immHole - 1];
  var idx = _immHole - 1;

  // Pré-remplir le score au par à la première visite
  if (scores[idx] === null) scores[idx] = hole.par;
  if (putts[idx] === null) putts[idx] = 2;
  immComputeGir(hole);

  var sc = scores[idx];
  var pt = putts[idx];
  var rel = sc - hole.par;
  var lbl = immScoreLabel(rel);
  var isPar3 = hole.par === 3;

  // Total courant
  var played = scores.filter(function(s) { return s !== null; });
  var totalRel = 0, cnt = 0;
  course.trous.forEach(function(h, i) { if (scores[i] !== null) { totalRel += scores[i] - h.par; cnt++; } });
  var totalStr = (totalRel > 0 ? '+' + totalRel : (totalRel === 0 ? 'PAR' : totalRel));

  var girHit = girState[hole.num] === 'hit';
  var firHtml = '';
  if (!isPar3) {
    firHtml = '<div class="imm-sub-item"><div class="imm-sub-lbl">Fairway</div>'
      + '<div class="imm-fir-toggle">'
      + '<button class="imm-fir ' + (firState[hole.num] === 'hit' ? 'on' : '') + '" data-a="fir-hit">Touché</button>'
      + '<button class="imm-fir ' + (firState[hole.num] === 'miss' ? 'on' : '') + '" data-a="fir-miss">Raté</button>'
      + '</div></div>';
  }
  var navRight = (_immHole < 18)
    ? '<button class="imm-nav-btn imm-next" id="imm-next">Trou ' + (_immHole + 1) + ' →</button>'
    : '<button class="imm-nav-btn imm-finish" id="imm-finish">Terminer &amp; enregistrer ✓</button>';

  stage.innerHTML =
    '<div class="imm-top">'
    + '<button class="imm-x" id="imm-x">×</button>'
    + '<div class="imm-top-c"><div class="imm-course">' + immEsc(course.name) + '</div>'
    + '<div class="imm-progress">Trou ' + _immHole + ' / 18 · Total ' + totalStr + ' (' + cnt + ' trou' + (cnt > 1 ? 's' : '') + ')</div></div>'
    + '<button class="imm-finish-top" id="imm-finish-top" title="Terminer et enregistrer">Terminer</button>'
    + '</div>'
    + '<div class="imm-hole">' + immHoleSVG(hole)
    + '<div class="imm-hole-badges">'
    + '<span class="imm-badge">Par ' + hole.par + '</span>'
    + '<span class="imm-badge">' + (hole.longueur || '—') + ' m</span>'
    + '<span class="imm-badge">SI ' + (hole.si || '—') + '</span>'
    + '</div>'
    + '</div>'
    + '<div class="imm-panel">'
    + '<div class="imm-score-block ' + lbl.cls + '">'
    + '<button class="imm-step imm-minus" data-a="s-">−</button>'
    + '<div class="imm-score-mid"><div class="imm-score-val">' + sc + '</div><div class="imm-score-lbl">' + lbl.txt + '</div></div>'
    + '<button class="imm-step imm-plus" data-a="s+">+</button>'
    + '</div>'
    + '<div class="imm-sub">'
    + '<div class="imm-sub-item"><div class="imm-sub-lbl">Putts</div>'
    + '<div class="imm-putts"><button class="imm-pstep" data-a="p-">−</button><span class="imm-putts-v">' + pt + '</span><button class="imm-pstep" data-a="p+">+</button></div></div>'
    + '<div class="imm-sub-item"><div class="imm-sub-lbl">Green régulation</div>'
    + '<div class="imm-gir ' + (girHit ? 'ok' : 'no') + '">' + (girHit ? '✓ GIR' : '✗') + '</div></div>'
    + firHtml
    + '</div>'
    + '</div>'
    + '<div class="imm-nav">'
    + '<button class="imm-nav-btn" id="imm-prev"' + (_immHole === 1 ? ' disabled' : '') + '>' + (_immHole === 1 ? '←' : '← Trou ' + (_immHole - 1)) + '</button>'
    + navRight
    + '</div>';

  // Listeners
  document.getElementById('imm-x').addEventListener('click', function() { immClose(); });
  var finTop = document.getElementById('imm-finish-top');
  if (finTop) finTop.addEventListener('click', immFinish);
  stage.querySelectorAll('[data-a]').forEach(function(btn) {
    btn.addEventListener('click', function() { immAction(btn.getAttribute('data-a')); });
  });
  var prev = document.getElementById('imm-prev'); if (prev) prev.addEventListener('click', function() { immNav(-1); });
  var next = document.getElementById('imm-next'); if (next) next.addEventListener('click', function() { immNav(1); });
  var fin = document.getElementById('imm-finish'); if (fin) fin.addEventListener('click', immFinish);
}

function immAction(a) {
  var idx = _immHole - 1;
  var hole = selectedCourse.trous[idx];
  if (a === 's+') scores[idx] = Math.min(15, (scores[idx] || hole.par) + 1);
  else if (a === 's-') scores[idx] = Math.max(1, (scores[idx] || hole.par) - 1);
  else if (a === 'p+') putts[idx] = Math.min(10, (putts[idx] || 0) + 1);
  else if (a === 'p-') putts[idx] = Math.max(0, (putts[idx] || 0) - 1);
  else if (a === 'fir-hit') firState[hole.num] = (firState[hole.num] === 'hit') ? undefined : 'hit';
  else if (a === 'fir-miss') firState[hole.num] = (firState[hole.num] === 'miss') ? undefined : 'miss';
  immComputeGir(hole);
  immRender();
}

function immComputeGir(hole) {
  var idx = hole.num - 1;
  if (scores[idx] === null || putts[idx] === null) return;
  var toGreen = scores[idx] - putts[idx];      // coups pour atteindre le green
  girState[hole.num] = (toGreen <= hole.par - 2) ? 'hit' : 'miss';
}

function immNav(dir) {
  _immHole = Math.max(1, Math.min(18, _immHole + dir));
  immRender();
}

function immFinish() {
  var filled = scores.filter(function(s) { return s !== null; }).length;
  if (filled < 9) { if (typeof showToast === 'function') showToast('Saisis au moins 9 trous avant d\'enregistrer.'); return; }
  window.sc_proMode = false;
  immClose(true);
  if (typeof saveRound === 'function') saveRound();
}

function immScoreLabel(rel) {
  if (rel <= -3) return { txt: 'Albatros', cls: 'sc-eagle' };
  if (rel === -2) return { txt: 'Eagle', cls: 'sc-eagle' };
  if (rel === -1) return { txt: 'Birdie', cls: 'sc-birdie' };
  if (rel === 0)  return { txt: 'Par', cls: 'sc-par' };
  if (rel === 1)  return { txt: 'Bogey', cls: 'sc-bogey' };
  if (rel === 2)  return { txt: 'Double bogey', cls: 'sc-double' };
  return { txt: '+' + rel, cls: 'sc-double' };
}

/* Visuel de trou stylisé (SVG) — longueur/forme selon le par */
function immHoleSVG(hole) {
  var par = hole.par;
  var W = 240, H = 300;
  // Points du couloir (tee en bas -> green en haut), léger dogleg pour par 5
  var teeX = 120, teeY = 276;
  var greenX = par === 5 ? 150 : (par === 3 ? 120 : 108);
  var greenY = par === 3 ? 96 : 52;
  var midX = par === 5 ? 78 : (par === 4 ? 138 : 120);
  var midY = 165;

  var fairway = 'M' + teeX + ',' + teeY + ' Q' + midX + ',' + midY + ' ' + greenX + ',' + greenY;

  var traj = '<path d="' + fairway + '" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="2.5" stroke-dasharray="1.5 7" stroke-linecap="round"/>';

  return ''
    + '<svg viewBox="0 0 ' + W + ' ' + H + '" class="imm-svg" preserveAspectRatio="xMidYMid slice">'
    + '<defs><linearGradient id="immRough" x1="0" y1="0" x2="0" y2="1">'
    +   '<stop offset="0" stop-color="#2f6b3a"/><stop offset="1" stop-color="#245a30"/></linearGradient>'
    + '<linearGradient id="immFw" x1="0" y1="0" x2="0" y2="1">'
    +   '<stop offset="0" stop-color="#5aa564"/><stop offset="1" stop-color="#4c9657"/></linearGradient></defs>'
    + '<rect width="' + W + '" height="' + H + '" fill="url(#immRough)"/>'
    // couloir large
    + '<path d="' + fairway + '" fill="none" stroke="url(#immFw)" stroke-width="66" stroke-linecap="round"/>'
    // bunkers déco
    + '<ellipse cx="' + (par === 5 ? 175 : 70) + '" cy="' + (par === 3 ? 150 : 200) + '" rx="20" ry="13" fill="#e8dcac"/>'
    + (par !== 3 ? '<ellipse cx="' + (greenX + 34) + '" cy="' + (greenY + 20) + '" rx="16" ry="11" fill="#e8dcac"/>' : '')
    // green
    + '<ellipse cx="' + greenX + '" cy="' + greenY + '" rx="34" ry="26" fill="#7dc98a"/>'
    + '<ellipse cx="' + greenX + '" cy="' + greenY + '" rx="34" ry="26" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/>'
    // trajectoire
    + traj
    // drapeau
    + '<line x1="' + greenX + '" y1="' + greenY + '" x2="' + greenX + '" y2="' + (greenY - 30) + '" stroke="#1A1209" stroke-width="2"/>'
    + '<path d="M' + greenX + ',' + (greenY - 30) + ' l16,5 -16,6 z" fill="#C9A84C"/>'
    // tee
    + '<circle cx="' + teeX + '" cy="' + teeY + '" r="6" fill="#fff"/>'
    + '<circle cx="' + teeX + '" cy="' + teeY + '" r="6" fill="none" stroke="#1A1209" stroke-width="1.5"/>'
    + '</svg>';
}

function immEsc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
