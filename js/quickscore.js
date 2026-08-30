/* ════════════════════════════════════════════
 * THE SMART GOLFER — quickscore.js
 * SAISIE EXPRESS : rentrer une carte en 1 tap par trou.
 *  · Gros boutons Birdie / Par / Bogey / Double → enregistre ET passe au trou suivant
 *  · Bandeau des 18 trous : tape un trou pour y revenir (correction facile)
 *  · Annuler le dernier coup
 *  · Sauvegarde automatique à chaque tap → reprise de partie après fermeture
 *  · Saisie a posteriori : juste le score total
 *
 * Écrit dans les globals scores[]/putts[]/firState/girState puis appelle saveRound().
 * Dépend de : scorecard.js (selectedCourse, scores, putts, firState, girState, saveRound),
 *             data.js (getAllCourses), app.js (lsGet/lsSet, showToast).
 * ⚠️ Pas de ternaire multi-ligne avec « + » en tête de ligne (SyntaxError) — cf CLAUDE.md.
 * ════════════════════════════════════════════ */

var QS_DRAFT_KEY = 'scdraft';
var _qsHole = 1;
var _qsUndo = [];

/* ─────────── BROUILLON (reprise de partie) ─────────── */

function qsSaveDraft() {
  if (!selectedCourse) return;
  lsSet(QS_DRAFT_KEY, {
    courseId: selectedCourse.id,
    courseName: selectedCourse.name,
    hole: _qsHole,
    scores: scores,
    putts: putts,
    fir: firState,
    gir: girState,
    updatedAt: new Date().toISOString()
  });
}

function qsGetDraft() {
  var d = lsGet(QS_DRAFT_KEY);
  if (!d || !d.scores) return null;
  var filled = d.scores.filter(function(s) { return s !== null && s !== undefined; }).length;
  if (!filled) return null;
  return d;
}

function qsClearDraft() {
  try { localStorage.removeItem('tsg_' + QS_DRAFT_KEY); } catch (e) {}
}

/* Bannière « Reprendre ta partie » — affichée en haut de la Scorecard */
function qsRenderResumeBanner() {
  var host = document.getElementById('qs-resume-host');
  if (!host) return;
  host.innerHTML = '';
  var d = qsGetDraft();
  if (!d) return;

  var filled = d.scores.filter(function(s) { return s !== null && s !== undefined; }).length;
  var when = '';
  try { when = new Date(d.updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }); } catch (e) {}

  var bar = document.createElement('div');
  bar.className = 'qs-resume';
  bar.innerHTML = ''
    + '<div class="qs-resume-ico">⛳</div>'
    + '<div class="qs-resume-txt">'
    +   '<div class="qs-resume-t">Partie en cours</div>'
    +   '<div class="qs-resume-d">' + qsEsc(d.courseName) + ' · trou ' + d.hole + ' · ' + filled + ' trou' + (filled > 1 ? 's' : '') + ' saisi' + (filled > 1 ? 's' : '') + (when ? ' · ' + when : '') + '</div>'
    + '</div>'
    + '<div class="qs-resume-act">'
    +   '<button class="qs-btn-ghost" id="qs-drop">Abandonner</button>'
    +   '<button class="qs-btn-gold" id="qs-resume-go">Reprendre →</button>'
    + '</div>';
  host.appendChild(bar);

  document.getElementById('qs-resume-go').addEventListener('click', function() { qsResume(); });
  document.getElementById('qs-drop').addEventListener('click', function() {
    if (!confirm('Abandonner cette partie ? Les scores saisis seront perdus.')) return;
    qsClearDraft();
    qsRenderResumeBanner();
    showToast('Partie abandonnée');
  });
}

function qsResume() {
  var d = qsGetDraft();
  if (!d) return;
  var courses = (typeof getAllCourses === 'function') ? getAllCourses() : [];
  var course = null;
  for (var i = 0; i < courses.length; i++) { if (courses[i].id === d.courseId) { course = courses[i]; break; } }
  if (!course) { showToast('Parcours introuvable — partie abandonnée'); qsClearDraft(); qsRenderResumeBanner(); return; }

  selectedCourse = course;
  scores = d.scores.slice();
  putts = d.putts ? d.putts.slice() : new Array(18).fill(null);
  firState = d.fir || {};
  girState = d.gir || {};
  _qsHole = d.hole || 1;
  _qsUndo = [];
  window.sc_proMode = false;
  if (typeof roundStarted !== 'undefined') roundStarted = true;
  qsOpenUI();
}

/* ─────────── OUVERTURE ─────────── */

function openQuickScore() {
  if (typeof selectedCourse === 'undefined' || !selectedCourse) {
    showToast('Choisis d\'abord un parcours');
    return;
  }
  var d = qsGetDraft();
  if (d && d.courseId === selectedCourse.id) {
    if (confirm('Une partie est déjà en cours sur ce parcours. La reprendre ?\n\nOK = reprendre · Annuler = repartir de zéro')) {
      qsResume();
      return;
    }
  }
  scores = new Array(18).fill(null);
  putts = new Array(18).fill(null);
  firState = {};
  girState = {};
  _qsHole = 1;
  _qsUndo = [];
  window.sc_proMode = false;
  if (typeof roundStarted !== 'undefined') roundStarted = true;
  qsClearDraft();
  qsOpenUI();
}

function qsOpenUI() {
  var ex = document.getElementById('qs-overlay');
  if (ex) ex.remove();
  var ov = document.createElement('div');
  ov.id = 'qs-overlay';
  ov.className = 'qs-overlay';
  ov.innerHTML = '<div class="qs-stage" id="qs-stage"></div>';
  document.body.appendChild(ov);
  qsRender();
}

function qsClose(skipConfirm) {
  var ov = document.getElementById('qs-overlay');
  if (!ov) return;
  var filled = scores.filter(function(s) { return s !== null; }).length;
  if (!skipConfirm && filled > 0) {
    qsSaveDraft();
    showToast('Partie sauvegardée — tu pourras la reprendre');
  }
  ov.remove();
  qsRenderResumeBanner();
}

/* ─────────── RENDU ─────────── */

function qsRender() {
  var stage = document.getElementById('qs-stage');
  if (!stage) return;
  var course = selectedCourse;
  var hole = course.trous[_qsHole - 1];
  var idx = _qsHole - 1;
  var par = hole.par;
  var sc = scores[idx];

  /* Bandeau des 18 trous */
  var strip = '';
  course.trous.forEach(function(h, i) {
    var v = scores[i];
    var cls = 'qs-cell';
    if (i + 1 === _qsHole) cls += ' cur';
    if (v !== null && v !== undefined) cls += ' ' + qsRelClass(v - h.par);
    var label = (v !== null && v !== undefined) ? v : (i + 1);
    strip += '<button class="' + cls + '" data-go="' + (i + 1) + '" title="Trou ' + (i + 1) + ' · par ' + h.par + '">' + label + '</button>';
  });

  /* Total courant */
  var rel = 0, cnt = 0;
  course.trous.forEach(function(h, i) {
    if (scores[i] !== null && scores[i] !== undefined) { rel += scores[i] - h.par; cnt++; }
  });
  var relStr = 'PAR';
  if (rel > 0) relStr = '+' + rel;
  if (rel < 0) relStr = '' + rel;

  /* Boutons rapides */
  var quick = [
    { d: -1, lbl: 'Birdie' },
    { d: 0,  lbl: 'Par' },
    { d: 1,  lbl: 'Bogey' },
    { d: 2,  lbl: 'Double' }
  ];
  var quickHtml = quick.map(function(q) {
    var val = par + q.d;
    var on = (sc === val) ? ' on' : '';
    return '<button class="qs-quick ' + qsRelClass(q.d) + on + '" data-set="' + val + '">'
      + '<span class="qs-quick-v">' + val + '</span>'
      + '<span class="qs-quick-l">' + q.lbl + '</span>'
      + '</button>';
  }).join('');

  /* Détail optionnel */
  var pt = putts[idx];
  var puttsStr = (pt === null || pt === undefined) ? '—' : pt;
  var firRow = '';
  if (par !== 3) {
    var fh = (firState[hole.num] === 'hit') ? ' on' : '';
    var fm = (firState[hole.num] === 'miss') ? ' on' : '';
    firRow = '<div class="qs-opt-row"><span class="qs-opt-l">Fairway</span>'
      + '<div class="qs-opt-btns">'
      + '<button class="qs-opt-b' + fh + '" data-fir="hit">Touché</button>'
      + '<button class="qs-opt-b' + fm + '" data-fir="miss">Raté</button>'
      + '</div></div>';
  }

  var undoDisabled = _qsUndo.length ? '' : ' disabled';
  var scoreBig = (sc === null || sc === undefined) ? '—' : sc;
  var scoreLbl = (sc === null || sc === undefined) ? 'Choisis ton score' : qsRelLabel(sc - par);
  var scoreCls = (sc === null || sc === undefined) ? '' : qsRelClass(sc - par);

  stage.innerHTML = ''
    /* En-tête */
    + '<div class="qs-top">'
    +   '<button class="qs-x" id="qs-x" title="Fermer (la partie est sauvegardée)">×</button>'
    +   '<div class="qs-top-c">'
    +     '<div class="qs-course">' + qsEsc(course.name) + '</div>'
    +     '<div class="qs-total">' + cnt + '/18 trous · <strong>' + relStr + '</strong></div>'
    +   '</div>'
    +   '<button class="qs-finish-top" id="qs-finish-top">Terminer</button>'
    + '</div>'

    /* Bandeau 18 trous */
    + '<div class="qs-strip">' + strip + '</div>'

    /* Trou courant */
    + '<div class="qs-hole">'
    +   '<div class="qs-hole-n">Trou ' + _qsHole + '</div>'
    +   '<div class="qs-hole-meta">Par ' + par + ' · ' + (hole.longueur || '—') + ' m · SI ' + (hole.si || '—') + '</div>'
    + '</div>'

    /* Score choisi */
    + '<div class="qs-score ' + scoreCls + '">'
    +   '<button class="qs-step" data-adj="-1" title="Un coup de moins">−</button>'
    +   '<div class="qs-score-mid"><div class="qs-score-v">' + scoreBig + '</div><div class="qs-score-l">' + scoreLbl + '</div></div>'
    +   '<button class="qs-step" data-adj="1" title="Un coup de plus">+</button>'
    + '</div>'

    /* Boutons 1 tap */
    + '<div class="qs-quicks">' + quickHtml + '</div>'
    + '<div class="qs-hint">Un tap enregistre le trou et passe au suivant.</div>'

    /* Détail optionnel */
    + '<details class="qs-opt"' + (pt !== null && pt !== undefined ? ' open' : '') + '>'
    +   '<summary>Détail (facultatif) · putts, fairway</summary>'
    +   '<div class="qs-opt-body">'
    +     '<div class="qs-opt-row"><span class="qs-opt-l">Putts</span>'
    +       '<div class="qs-opt-btns"><button class="qs-opt-b" data-putt="-1">−</button>'
    +       '<span class="qs-opt-v">' + puttsStr + '</span>'
    +       '<button class="qs-opt-b" data-putt="1">+</button></div></div>'
    +     firRow
    +   '</div>'
    + '</details>'

    /* Navigation */
    + '<div class="qs-nav">'
    +   '<button class="qs-nav-b" id="qs-undo"' + undoDisabled + '>↺ Annuler</button>'
    +   '<button class="qs-nav-b" id="qs-prev"' + (_qsHole === 1 ? ' disabled' : '') + '>← Trou ' + (_qsHole - 1) + '</button>'
    +   '<button class="qs-nav-b" id="qs-next"' + (_qsHole === 18 ? ' disabled' : '') + '>Trou ' + (_qsHole + 1) + ' →</button>'
    + '</div>';

  qsWire();
}

function qsWire() {
  var stage = document.getElementById('qs-stage');
  if (!stage) return;

  document.getElementById('qs-x').addEventListener('click', function() { qsClose(); });
  document.getElementById('qs-finish-top').addEventListener('click', qsFinish);

  stage.querySelectorAll('[data-go]').forEach(function(b) {
    b.addEventListener('click', function() {
      _qsHole = parseInt(b.getAttribute('data-go'), 10);
      qsSaveDraft();
      qsRender();
    });
  });
  stage.querySelectorAll('[data-set]').forEach(function(b) {
    b.addEventListener('click', function() {
      qsSet(parseInt(b.getAttribute('data-set'), 10), true);
    });
  });
  stage.querySelectorAll('[data-adj]').forEach(function(b) {
    b.addEventListener('click', function() {
      var idx = _qsHole - 1;
      var base = scores[idx];
      if (base === null || base === undefined) base = selectedCourse.trous[idx].par;
      qsSet(base + parseInt(b.getAttribute('data-adj'), 10), false);
    });
  });
  stage.querySelectorAll('[data-putt]').forEach(function(b) {
    b.addEventListener('click', function() {
      var idx = _qsHole - 1;
      var cur = putts[idx];
      if (cur === null || cur === undefined) cur = 2;
      putts[idx] = Math.max(0, Math.min(10, cur + parseInt(b.getAttribute('data-putt'), 10)));
      qsComputeGir();
      qsSaveDraft();
      qsRender();
    });
  });
  stage.querySelectorAll('[data-fir]').forEach(function(b) {
    b.addEventListener('click', function() {
      var num = selectedCourse.trous[_qsHole - 1].num;
      var v = b.getAttribute('data-fir');
      firState[num] = (firState[num] === v) ? undefined : v;
      qsSaveDraft();
      qsRender();
    });
  });

  var u = document.getElementById('qs-undo');
  if (u) u.addEventListener('click', qsUndo);
  var p = document.getElementById('qs-prev');
  if (p) p.addEventListener('click', function() { _qsHole = Math.max(1, _qsHole - 1); qsRender(); });
  var n = document.getElementById('qs-next');
  if (n) n.addEventListener('click', function() { _qsHole = Math.min(18, _qsHole + 1); qsRender(); });
}

/* ─────────── ACTIONS ─────────── */

function qsSet(val, advance) {
  var idx = _qsHole - 1;
  val = Math.max(1, Math.min(15, val));
  _qsUndo.push({ hole: _qsHole, prev: scores[idx] });
  if (_qsUndo.length > 30) _qsUndo.shift();
  scores[idx] = val;
  qsComputeGir();
  if (advance && _qsHole < 18) {
    _qsHole++;
  }
  qsSaveDraft();   // après l'avancement : à la reprise on repart du trou à jouer
  qsRender();
}

function qsUndo() {
  var last = _qsUndo.pop();
  if (!last) return;
  scores[last.hole - 1] = (last.prev === undefined) ? null : last.prev;
  _qsHole = last.hole;
  qsComputeGir();
  qsSaveDraft();
  qsRender();
}

/* GIR déduit : coups pour atteindre le green ≤ par − 2 */
function qsComputeGir() {
  selectedCourse.trous.forEach(function(h, i) {
    var s = scores[i], p = putts[i];
    if (s === null || s === undefined || p === null || p === undefined) return;
    girState[h.num] = ((s - p) <= (h.par - 2)) ? 'hit' : 'miss';
  });
}

function qsFinish() {
  var filled = scores.filter(function(s) { return s !== null && s !== undefined; }).length;
  if (filled < 9) { showToast('Saisis au moins 9 trous avant d\'enregistrer.'); return; }
  window.sc_proMode = false;
  qsClearDraft();
  var ov = document.getElementById('qs-overlay');
  if (ov) ov.remove();
  if (typeof saveRound === 'function') saveRound();
  qsRenderResumeBanner();
}

/* ─────────── SAISIE A POSTERIORI (score total) ─────────── */

function openQuickTotal() {
  var ex = document.getElementById('qt-modal');
  if (ex) ex.remove();

  var courses = (typeof getAllCourses === 'function') ? getAllCourses() : [];
  if (!courses.length) { showToast('Ajoute d\'abord un parcours'); return; }
  var opts = courses.map(function(c) {
    var selAttr = (selectedCourse && selectedCourse.id === c.id) ? ' selected' : '';
    return '<option value="' + qsEsc(c.id) + '"' + selAttr + '>' + qsEsc(c.name) + '</option>';
  }).join('');
  var today = new Date().toISOString().slice(0, 10);

  var m = document.createElement('div');
  m.id = 'qt-modal';
  m.className = 'qt-modal';
  m.innerHTML = ''
    + '<div class="qt-card">'
    +   '<div class="qt-head"><div><div class="qt-tag">Rapide</div>'
    +     '<div class="qt-title">Ajouter une partie</div></div>'
    +     '<button class="qt-close" id="qt-close">×</button></div>'
    +   '<div class="qt-body">'
    +     '<div class="qt-intro">Tu n\'as pas saisi trou par trou ? Renseigne juste l\'essentiel — c\'est toujours mieux qu\'une partie perdue.</div>'
    +     '<div class="qt-field"><label class="qt-l" for="qt-course">Parcours</label>'
    +       '<select class="qt-i" id="qt-course">' + opts + '</select></div>'
    +     '<div class="qt-grid">'
    +       '<div class="qt-field"><label class="qt-l" for="qt-date">Date</label>'
    +         '<input class="qt-i" type="date" id="qt-date" value="' + today + '"></div>'
    +       '<div class="qt-field"><label class="qt-l" for="qt-score">Score total *</label>'
    +         '<input class="qt-i" type="number" id="qt-score" min="30" max="200" placeholder="88"></div>'
    +     '</div>'
    +     '<div class="qt-sep">Facultatif — améliore ton analyse</div>'
    +     '<div class="qt-grid3">'
    +       '<div class="qt-field"><label class="qt-l" for="qt-putts">Putts</label>'
    +         '<input class="qt-i" type="number" id="qt-putts" min="10" max="60" placeholder="32"></div>'
    +       '<div class="qt-field"><label class="qt-l" for="qt-gir">Greens</label>'
    +         '<input class="qt-i" type="number" id="qt-gir" min="0" max="18" placeholder="7"></div>'
    +       '<div class="qt-field"><label class="qt-l" for="qt-fir">Fairways</label>'
    +         '<input class="qt-i" type="number" id="qt-fir" min="0" max="18" placeholder="8"></div>'
    +     '</div>'
    +   '</div>'
    +   '<div class="qt-actions">'
    +     '<button class="qs-btn-ghost" id="qt-cancel">Annuler</button>'
    +     '<button class="qs-btn-gold" id="qt-save">Enregistrer</button>'
    +   '</div>'
    + '</div>';
  document.body.appendChild(m);

  function close() { m.remove(); }
  document.getElementById('qt-close').addEventListener('click', close);
  document.getElementById('qt-cancel').addEventListener('click', close);
  m.addEventListener('click', function(e) { if (e.target === m) close(); });
  document.getElementById('qt-save').addEventListener('click', function() { qtSave(close); });
}

function qtSave(close) {
  var cid = document.getElementById('qt-course').value;
  var courses = (typeof getAllCourses === 'function') ? getAllCourses() : [];
  var course = null;
  for (var i = 0; i < courses.length; i++) { if (courses[i].id === cid) { course = courses[i]; break; } }
  if (!course) { showToast('Parcours introuvable'); return; }

  var total = parseInt(document.getElementById('qt-score').value, 10);
  if (!total || total < 30) { showToast('Renseigne ton score total'); return; }

  var date = document.getElementById('qt-date').value || new Date().toISOString().slice(0, 10);
  var vPutts = parseInt(document.getElementById('qt-putts').value, 10);
  var vGir = parseInt(document.getElementById('qt-gir').value, 10);
  var vFir = parseInt(document.getElementById('qt-fir').value, 10);

  var firTotal = course.trous.filter(function(h) { return h.par !== 3; }).length;
  var gir = isNaN(vGir) ? 0 : vGir;
  var fir = isNaN(vFir) ? 0 : vFir;
  var puttsTotal = isNaN(vPutts) ? null : vPutts;
  var diff = ((total - course.rating) * 113 / course.slope).toFixed(1);

  var entry = {
    id: Date.now(),
    date: date,
    course: course.name,
    courseId: course.id,
    score: total,
    par: course.par_total,
    diff: parseFloat(diff),
    fir: fir,
    firTotal: firTotal,
    gir: gir,
    putts: puttsTotal,
    cond: 'calme',
    format: 'stroke',
    hcp: (currentUser && currentUser.hcp) || null,
    notes: 'Saisie rapide (score total)',
    scores: new Array(18).fill(null),
    sg_tee: parseFloat((((fir / (firTotal || 14)) - 0.5) * 1.2).toFixed(2)),
    sg_app: parseFloat((((gir / 18) - 0.38) * 2.1).toFixed(2)),
    sg_arg: parseFloat(((gir / 18) >= 0.5 ? 0.1 : -0.1).toFixed(2)),
    sg_putt: parseFloat((puttsTotal ? ((32 - puttsTotal) * 0.15) : 0).toFixed(2)),
    quickEntry: true,
    detailMode: false,
    proMode: false,
    shots: {}, shotsOnGreen: {}, shotsPutts: {}, shotsFairway: {}, shotsFairwayMissSide: {},
    clubs: [], fairwayPos: [], distRemain: [], clubsApp: [], distFromTarget2: []
  };

  roundHistory.unshift(entry);
  if (roundHistory.length > 50) roundHistory.pop();
  lsSet('rounds', roundHistory);
  if (window.tsgSync) window.tsgSync.pushRound(entry);

  showToast('Partie enregistrée ✓ ' + course.name + ' · ' + total);
  if (typeof close === 'function') close();
  if (typeof renderHistory === 'function') { try { renderHistory(); } catch (e) {} }
  if (typeof qsCelebrate === 'function') qsCelebrate(entry);
  setTimeout(function() { if (typeof showPage === 'function') showPage('dashboard'); }, 900);
}

/* ─────────── UTILS ─────────── */

function qsRelClass(rel) {
  if (rel <= -2) return 'sc-eagle';
  if (rel === -1) return 'sc-birdie';
  if (rel === 0) return 'sc-par';
  if (rel === 1) return 'sc-bogey';
  return 'sc-double';
}

function qsRelLabel(rel) {
  if (rel <= -3) return 'Albatros !';
  if (rel === -2) return 'Eagle !';
  if (rel === -1) return 'Birdie';
  if (rel === 0) return 'Par';
  if (rel === 1) return 'Bogey';
  if (rel === 2) return 'Double bogey';
  return '+' + rel;
}

function qsEsc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
