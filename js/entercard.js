/* ════════════════════════════════════════════
 * THE SMART GOLFER — entercard.js
 * « ENTRER MA CARTE » (S85) — UN seul chemin guidé pour entrer une partie.
 *
 * Avant : la page Jouer proposait 6 boutons (plan de jeu, saisie express,
 * partie à plusieurs, saisie immersive, tableau complet, score seul) après
 * une liste de parcours et 6 réglages. La moitié des comptes n'avait jamais
 * entré de carte. Ici : 1. le parcours → 2. date, départ, formule →
 * 3. trou par trou OU score total (OU à plusieurs). Le reste reste
 * accessible dans « Options avancées ».
 *
 * Réutilise les écrans existants : saisie express (openQuickScore), score
 * seul (openQuickTotal), carte partagée (sgmOpenHub). On règle d'abord la
 * page Jouer (selectCourse, #f-date, #f-tee, #f-format) puis on les ouvre.
 *
 * Dépend de : data.js (getAllCourses), scorecard.js (selectCourse, roundHistory),
 * tees.js, quickscore.js, sharedcourses.js (shcFetch, shcImport), sharedgame.js.
 * ════════════════════════════════════════════ */

var _ec = null;   // { step, course, date, tee, format, search }

function ecEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function ecDay(offset) {
  var d = new Date(); d.setDate(d.getDate() + (offset || 0));
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/* Parcours dans l'ordre utile : le dernier joué, puis les plus joués, puis les autres */
function ecCourses() {
  var all = (typeof getAllCourses === 'function') ? getAllCourses() : [];
  var rounds = (typeof roundHistory !== 'undefined' && roundHistory && roundHistory.length) ? roundHistory : (lsGet('rounds') || []);
  var count = {}, last = null;
  rounds.forEach(function(r) {
    var k = r.courseId || r.course;
    count[k] = (count[k] || 0) + 1;
  });
  if (rounds.length) last = rounds[0].courseId || rounds[0].course;
  function score(c) { return (c.id === last || c.name === last ? 1000 : 0) + (count[c.id] || count[c.name] || 0); }
  return all.slice().sort(function(a, b) { return score(b) - score(a) || String(a.name).localeCompare(String(b.name)); });
}

function ecOpen() {
  _ec = { step: 1, course: null, date: ecDay(0), tee: null, format: 'stroke', search: '' };
  var old = document.getElementById('ec-modal');
  if (old) old.remove();
  var m = document.createElement('div');
  m.id = 'ec-modal';
  m.className = 'ec-modal';
  m.setAttribute('role', 'dialog');
  m.setAttribute('aria-modal', 'true');
  m.setAttribute('aria-labelledby', 'ec-title');
  m.innerHTML = '<div class="ec-sheet"><div class="ec-head">'
    + '<button type="button" class="ec-back" aria-label="Étape précédente">'
    +   '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button>'
    + '<div class="ec-head-t"><div class="ec-steps"><span></span><span></span><span></span></div><div class="ec-title" id="ec-title"></div></div>'
    + '<button type="button" class="ec-close trn-modal-close" aria-label="Fermer">×</button></div>'
    + '<div class="ec-body"></div></div>';
  document.body.appendChild(m);
  m.querySelector('.ec-close').addEventListener('click', ecClose);
  m.querySelector('.ec-back').addEventListener('click', function() { if (_ec.step > 1) { _ec.step--; ecRender(); } else ecClose(); });
  m.addEventListener('click', function(e) { if (e.target === m) ecClose(); });
  ecRender();
}

function ecClose() {
  var m = document.getElementById('ec-modal');
  if (m) m.remove();
}

function ecRender() {
  var m = document.getElementById('ec-modal');
  if (!m) return;
  var body = m.querySelector('.ec-body');
  var titles = { 1: 'Où as-tu joué ?', 2: 'Ta partie', 3: 'Comment la saisir ?' };
  m.querySelector('.ec-title').textContent = titles[_ec.step];
  m.querySelectorAll('.ec-steps span').forEach(function(s, i) { s.classList.toggle('on', i < _ec.step); });
  if (_ec.step === 1) ecStepCourse(body);
  else if (_ec.step === 2) ecStepSettings(body);
  else ecStepMode(body);
  body.scrollTop = 0;
}

/* ─── 1. Le parcours ─── */
function ecStepCourse(body) {
  body.innerHTML = '<input type="search" class="ec-search" placeholder="Chercher un parcours, une ville…" aria-label="Chercher un parcours" value="' + ecEsc(_ec.search) + '">'
    + '<div class="ec-list" id="ec-mine"></div><div class="ec-list" id="ec-comm"></div>'
    + '<button type="button" class="ec-add">+ Mon parcours n\'est pas dans la liste</button>';
  var inp = body.querySelector('.ec-search');
  inp.addEventListener('input', function() { _ec.search = inp.value; ecFillCourses(body); });
  body.querySelector('.ec-add').addEventListener('click', function() {
    ecClose();
    if (typeof openCourseCreator === 'function') openCourseCreator();
  });
  body.onclick = function(e) {
    var b = e.target.closest('[data-ec-course],[data-ec-shared]');
    if (!b) return;
    if (b.hasAttribute('data-ec-shared')) {
      var copy = (typeof shcImport === 'function') ? shcImport(b.getAttribute('data-ec-shared'), null) : null;
      if (!copy) return;
      var all = getAllCourses();
      for (var i = 0; i < all.length; i++) if (all[i].id === copy.id) _ec.course = all[i];
    } else {
      var id = b.getAttribute('data-ec-course');
      _ec.course = getAllCourses().filter(function(c) { return c.id === id; })[0] || null;
    }
    if (!_ec.course) return;
    _ec.tee = null;
    _ec.step = 2;
    ecRender();
  };
  ecFillCourses(body);
}

function ecMatch(c, q) {
  if (!q) return true;
  return [c.name, c.ville, c.region, c.departement].some(function(v) { return String(v || '').toLowerCase().indexOf(q) >= 0; });
}

function ecFillCourses(body) {
  var q = (_ec.search || '').toLowerCase().trim();
  var mine = ecCourses().filter(function(c) { return ecMatch(c, q); });
  var rounds = (typeof roundHistory !== 'undefined' && roundHistory) ? roundHistory : [];
  var lastId = rounds.length ? (rounds[0].courseId || rounds[0].course) : null;
  var host = body.querySelector('#ec-mine');
  host.innerHTML = (mine.length ? '<div class="ec-lbl">Tes parcours</div>' : '<div class="ec-empty">Aucun de tes parcours ne correspond.</div>')
    + mine.map(function(c) {
      var isLast = c.id === lastId || c.name === lastId;
      var meta = [c.ville, c.par_total ? 'par ' + c.par_total : '', (c.trous || []).length === 9 ? '9 trous' : ''].filter(Boolean).join(' · ');
      return '<button type="button" class="ec-course" data-ec-course="' + ecEsc(c.id) + '">'
        + '<span class="ec-course-n">' + ecEsc(c.name) + (isLast ? ' <em>dernier joué</em>' : '') + '</span>'
        + '<span class="ec-course-m">' + ecEsc(meta) + '</span></button>';
    }).join('');

  // Parcours de la communauté (compte connecté)
  var comm = body.querySelector('#ec-comm');
  if (typeof shcFetch !== 'function') { comm.innerHTML = ''; return; }
  shcFetch(function(rows) {
    if (!rows || !document.body.contains(comm)) return;
    var have = {}, imported = {};
    getAllCourses().forEach(function(c) { if (c.name) have[c.name.toLowerCase().trim()] = true; if (c.importedFrom) imported[c.importedFrom] = true; });
    var uid = (typeof sbUserId === 'function') ? sbUserId() : null;
    var list = rows.filter(function(r) {
      return r.data && r.user_id !== uid && !imported[r.id] && !(r.name && have[r.name.toLowerCase().trim()]) && ecMatch(r, q);
    });
    comm.innerHTML = list.length ? '<div class="ec-lbl">Ajoutés par la communauté</div>' + list.map(function(r) {
      var meta = [r.ville, r.par_total ? 'par ' + r.par_total : '', r.author_name ? 'ajouté par ' + r.author_name : ''].filter(Boolean).join(' · ');
      return '<button type="button" class="ec-course ec-course-comm" data-ec-shared="' + ecEsc(r.id) + '">'
        + '<span class="ec-course-n">' + ecEsc(r.name || 'Parcours') + '</span><span class="ec-course-m">' + ecEsc(meta) + '</span></button>';
    }).join('') : '';
  });
}

/* ─── 2. Date, départ, formule ─── */
function ecStepSettings(body) {
  var c = _ec.course;
  var tees = (typeof getCourseTees === 'function') ? getCourseTees(c) : [];
  if (!_ec.tee) {
    var rem = (typeof teeRecall === 'function') ? teeRecall(c.id) : null;
    var def = (typeof teeDefault === 'function') ? teeDefault(c) : tees[0];
    _ec.tee = (rem && tees.some(function(t) { return t.id === rem; })) ? rem : (def ? def.id : null);
  }
  var today = ecDay(0), yest = ecDay(-1);
  var other = _ec.date !== today && _ec.date !== yest;
  var teeBtns = tees.map(function(t) {
    var meta = (typeof teeMeta === 'function') ? teeMeta(t.id) : { dot: '#C9A45C', ring: '#8A6420' };
    return '<button type="button" class="ec-chip ec-tee' + (t.id === _ec.tee ? ' on' : '') + '" data-ec-tee="' + ecEsc(t.id) + '">'
      + '<span class="ec-dot" style="background:' + ecEsc(meta.dot) + ';border-color:' + ecEsc(meta.ring) + '"></span>' + ecEsc(t.name) + '</button>';
  }).join('');
  body.innerHTML = '<div class="ec-picked"><strong>' + ecEsc(c.name) + '</strong><button type="button" class="ec-link" data-ec-change>Changer</button></div>'
    + '<div class="ec-lbl">Quand ?</div><div class="ec-chips">'
    +   '<button type="button" class="ec-chip' + (_ec.date === today ? ' on' : '') + '" data-ec-date="' + today + '">Aujourd\'hui</button>'
    +   '<button type="button" class="ec-chip' + (_ec.date === yest ? ' on' : '') + '" data-ec-date="' + yest + '">Hier</button>'
    +   '<label class="ec-chip ec-date' + (other ? ' on' : '') + '">Autre jour <input type="date" max="' + today + '" value="' + ecEsc(_ec.date) + '" aria-label="Date de la partie"></label>'
    + '</div>'
    + (tees.length > 1 ? '<div class="ec-lbl">Départ</div><div class="ec-chips ec-tees">' + teeBtns + '</div>' : '')
    + '<div class="ec-lbl">Formule</div><div class="ec-seg">'
    +   '<button type="button" class="' + (_ec.format === 'stroke' ? 'on' : '') + '" data-ec-format="stroke">Stroke play<small>tous tes coups</small></button>'
    +   '<button type="button" class="' + (_ec.format === 'stableford' ? 'on' : '') + '" data-ec-format="stableford">Stableford<small>des points par trou</small></button>'
    + '</div>'
    + '<button type="button" class="ec-next btn-start-round">Continuer</button>';
  body.onclick = function(e) {
    var b = e.target.closest('[data-ec-date],[data-ec-tee],[data-ec-format],[data-ec-change],.ec-next');
    if (!b) return;
    if (b.hasAttribute('data-ec-change')) { _ec.step = 1; ecRender(); return; }
    if (b.classList.contains('ec-next')) { _ec.step = 3; ecRender(); return; }
    if (b.hasAttribute('data-ec-date')) _ec.date = b.getAttribute('data-ec-date');
    if (b.hasAttribute('data-ec-tee')) _ec.tee = b.getAttribute('data-ec-tee');
    if (b.hasAttribute('data-ec-format')) _ec.format = b.getAttribute('data-ec-format');
    ecStepSettings(body);
  };
  var di = body.querySelector('.ec-date input');
  di.addEventListener('change', function() { if (di.value) { _ec.date = di.value; ecStepSettings(body); } });
}

/* ─── 3. Comment saisir ─── */
function ecStepMode(body) {
  var teeName = '';
  if (typeof findTee === 'function' && _ec.tee) { var t = findTee(_ec.course, _ec.tee); teeName = t ? t.name : ''; }
  var when = _ec.date === ecDay(0) ? 'aujourd\'hui' : (_ec.date === ecDay(-1) ? 'hier' : _ec.date.split('-').reverse().join('/'));
  body.innerHTML = '<div class="ec-picked"><strong>' + ecEsc(_ec.course.name) + '</strong><span>' + ecEsc([when, teeName ? 'départ ' + teeName : '', _ec.format === 'stableford' ? 'stableford' : 'stroke play'].filter(Boolean).join(' · ')) + '</span></div>'
    + '<button type="button" class="ec-mode ec-mode-main" data-ec-mode="holes">'
    +   '<span class="ec-mode-t">Trou par trou <em>recommandé</em></span>'
    +   '<span class="ec-mode-s">Un tap par trou (birdie, par, bogey…). Tu peux ajouter les putts et les fairways : c\'est ce qui débloque ton analyse complète.</span></button>'
    + '<button type="button" class="ec-mode" data-ec-mode="total">'
    +   '<span class="ec-mode-t">Juste mon score total</span>'
    +   '<span class="ec-mode-s">En 10 secondes, si tu n\'as pas le détail des trous. Compte pour ton index.</span></button>'
    + '<button type="button" class="ec-mode ec-mode-small" data-ec-mode="shared">'
    +   '<span class="ec-mode-t">À plusieurs sur la même carte</span>'
    +   '<span class="ec-mode-s">Chacun voit les scores de tout le monde en direct.</span></button>';
  body.onclick = function(e) {
    var b = e.target.closest('[data-ec-mode]');
    if (b) ecLaunch(b.getAttribute('data-ec-mode'));
  };
}

/* Règle la page Jouer puis ouvre le bon écran de saisie */
function ecLaunch(mode) {
  var c = _ec.course;
  if (mode === 'shared') {
    ecClose();
    if (typeof sgmOpenHub === 'function') sgmOpenHub();
    return;
  }
  if (typeof showPage === 'function') showPage('scorecard');
  if (typeof selectCourse === 'function') selectCourse(c);
  var fd = document.getElementById('f-date'); if (fd) fd.value = _ec.date;
  var ft = document.getElementById('f-tee');
  if (ft && _ec.tee) { ft.value = _ec.tee; ft.dispatchEvent(new Event('change')); }
  if (typeof teeRemember === 'function' && _ec.tee) teeRemember(c.id, _ec.tee);
  var ff = document.getElementById('f-format');
  if (ff) { ff.value = _ec.format; ff.dispatchEvent(new Event('change')); }
  ecClose();

  if (mode === 'holes') {
    if (typeof openQuickScore === 'function') openQuickScore();
    return;
  }
  // Score seul : on pré-remplit la fenêtre existante
  if (typeof openQuickTotal === 'function') {
    openQuickTotal();
    var qc = document.getElementById('qt-course');
    if (qc) { qc.value = c.id; qc.dispatchEvent(new Event('change')); }
    var qtt = document.getElementById('qt-tee'); if (qtt && _ec.tee) qtt.value = _ec.tee;
    var qd = document.getElementById('qt-date'); if (qd) qd.value = _ec.date;
    var qs = document.getElementById('qt-score'); if (qs) { try { qs.focus(); } catch (e) {} }
  }
}

/* Bouton « Entrer ma carte » de la page Jouer (la page est reconstruite : délégation) */
document.addEventListener('click', function(e) {
  if (e.target.closest && e.target.closest('#ec-start')) ecOpen();
});
