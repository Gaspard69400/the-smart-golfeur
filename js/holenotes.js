/* ════════════════════════════════════════════
 * THE SMART GOLFER — holenotes.js
 * CARNET DE PARCOURS : tes notes par trou, retrouvées à chaque partie.
 * « Ne jamais aller à gauche », « bois 3 au départ », « green qui part vers l'étang »…
 *
 * Affiché : pendant la saisie express, dans la carte partagée, dans le plan
 * de jeu de chaque trou, et en entier depuis l'onglet Parcours (« Carnet »).
 *
 * Stockage : local (tsg_holeNotes) → marche hors-ligne et en mode démo.
 * Avec un compte : synchronisé dans la table hole_notes (dernière modification
 * gagnante, note par note). Tant que la table n'existe pas, tout reste local.
 *
 * Dépend de : app.js (lsGet/lsSet/showToast), data.js (getAllCourses).
 * ════════════════════════════════════════════ */

var HN_MAX = 280;
var HN_CLUBS = ['Driver', 'Bois 3', 'Bois 5', 'Hybride', 'Fer 3', 'Fer 4', 'Fer 5', 'Fer 6', 'Fer 7', 'Fer 8', 'Fer 9', 'PW', 'Wedge', 'Putter'];

function hnEsc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function hnAll() { return lsGet('holeNotes') || {}; }

function hnGet(courseId, hole) {
  var c = hnAll()[courseId];
  var n = c && c[hole];
  return (n && !n.deleted && (n.text || n.club)) ? n : null;
}

function hnCount(courseId) {
  var c = hnAll()[courseId] || {};
  return Object.keys(c).filter(function(k) { return !c[k].deleted && (c[k].text || c[k].club); }).length;
}

function hnSet(courseId, hole, text, club) {
  var all = hnAll();
  var c = all[courseId] = all[courseId] || {};
  text = String(text || '').trim().slice(0, HN_MAX);
  club = club || '';
  var at = new Date().toISOString();
  if (!text && !club) c[hole] = { deleted: true, at: at, dirty: true };   // pierre tombale jusqu'à la synchro
  else c[hole] = { text: text, club: club, at: at, dirty: true };
  lsSet('holeNotes', all);
  hnPush(courseId, hole);
}

/* Identifiant de parcours utilisé pour les notes : le parcours local s'il existe (même nom) */
function hnCourseKey(course) {
  if (!course) return null;
  var all = (typeof getAllCourses === 'function') ? getAllCourses() : [];
  var local = all.find(function(c) { return c.id === course.id; })
    || all.find(function(c) { return (c.name || '').toLowerCase() === (course.name || '').toLowerCase(); });
  return (local || course).id;
}

/* ─────────────── AFFICHAGE ─────────────── */

/* Encart « ton carnet » pour un trou (saisie express, carte partagée, plan de jeu) */
function hnInlineHtml(course, idx, compact) {
  if (!course || !course.trous || !course.trous[idx]) return '';
  var key = hnCourseKey(course), h = course.trous[idx], n = hnGet(key, h.num);
  var attrs = ' data-hn-edit="1" data-hn-course="' + hnEsc(key) + '" data-hn-hole="' + h.num + '" data-hn-name="' + hnEsc(course.name) + '"';
  if (!n) {
    return '<button type="button" class="hn-add' + (compact ? ' compact' : '') + '"' + attrs + '>📒 ' + (compact ? 'Note' : 'Ajouter une note à ton carnet') + '</button>';
  }
  return '<div class="hn-note' + (compact ? ' compact' : '') + '"><span class="hn-ico">📒</span><div class="hn-txt">'
    + (n.club ? '<strong>' + hnEsc(n.club) + '</strong>' + (n.text ? ' · ' : '') : '') + hnEsc(n.text) + '</div>'
    + '<button type="button" class="hn-edit" title="Modifier"' + attrs + '>✎</button></div>';
}

/* Un clic sur n'importe quel bouton de note ouvre l'éditeur */
document.addEventListener('click', function(e) {
  var b = e.target.closest && e.target.closest('[data-hn-edit]');
  if (!b) return;
  e.preventDefault();
  e.stopPropagation();
  hnOpenEditor(b.getAttribute('data-hn-course'), parseInt(b.getAttribute('data-hn-hole'), 10), b.getAttribute('data-hn-name'));
}, true);

function hnOpenEditor(courseId, hole, courseName) {
  var n = hnGet(courseId, hole) || { text: '', club: '' };
  var old = document.getElementById('hn-modal');
  if (old) old.remove();
  var m = document.createElement('div');
  m.id = 'hn-modal';
  m.className = 'trn-modal hn-modal';
  m.innerHTML = '<div class="trn-modal-card" style="max-width:420px">'
    + '<div class="trn-modal-head"><div><div class="trn-modal-tag">Carnet · ' + hnEsc(courseName || 'Parcours') + '</div>'
    +   '<div class="trn-modal-title">Trou ' + hole + '</div></div><button class="trn-modal-close" type="button">×</button></div>'
    + '<div class="trn-modal-body">'
    +   '<label class="qt-l" for="hn-club">Club au départ</label>'
    +   '<div class="hn-clubs" id="hn-club">' + ['—'].concat(HN_CLUBS).map(function(c) {
          var v = c === '—' ? '' : c;
          return '<button type="button" class="hn-club' + ((n.club || '') === v ? ' on' : '') + '" data-club="' + hnEsc(v) + '">' + hnEsc(c) + '</button>';
        }).join('') + '</div>'
    +   '<label class="qt-l" for="hn-text">Ta note</label>'
    +   '<textarea class="hn-text" id="hn-text" maxlength="' + HN_MAX + '" rows="4" placeholder="Ex : tout penche vers la droite, viser le bord gauche du green. Jamais long.">' + hnEsc(n.text) + '</textarea>'
    +   '<div class="hn-count" id="hn-count"></div>'
    + '</div>'
    + '<div class="trn-modal-actions">'
    +   (n.text || n.club ? '<button class="dash-btn dash-btn-outline hn-del" type="button" id="hn-del">Effacer</button>' : '')
    +   '<button class="dash-btn dash-btn-outline" type="button" id="hn-cancel">Annuler</button>'
    +   '<button class="dash-btn dash-btn-gold" type="button" id="hn-save">Enregistrer</button>'
    + '</div></div>';
  document.body.appendChild(m);

  var club = n.club || '';
  var ta = m.querySelector('#hn-text'), count = m.querySelector('#hn-count');
  function upd() { count.textContent = ta.value.length + ' / ' + HN_MAX; }
  upd();
  ta.addEventListener('input', upd);
  m.querySelectorAll('.hn-club').forEach(function(b) {
    b.addEventListener('click', function() {
      club = b.getAttribute('data-club');
      m.querySelectorAll('.hn-club').forEach(function(x) { x.classList.toggle('on', x === b); });
    });
  });
  function close() { m.remove(); }
  m.querySelector('.trn-modal-close').addEventListener('click', close);
  m.querySelector('#hn-cancel').addEventListener('click', close);
  m.addEventListener('click', function(e) { if (e.target === m) close(); });
  function done(msg) { close(); hnRefreshViews(courseId); showToast(msg); }
  m.querySelector('#hn-save').addEventListener('click', function() {
    hnSet(courseId, hole, ta.value, club);
    done(ta.value.trim() || club ? 'Note enregistrée dans ton carnet ✓' : 'Note effacée');
  });
  var del = m.querySelector('#hn-del');
  if (del) del.addEventListener('click', function() { hnSet(courseId, hole, '', ''); done('Note effacée'); });
  setTimeout(function() { try { ta.focus(); } catch (e) {} }, 50);
}

/* Redessine les écrans ouverts qui affichent des notes */
function hnRefreshViews(courseId) {
  try { if (document.getElementById('qs-overlay') && typeof qsRender === 'function') qsRender(); } catch (e) {}
  try { if (document.getElementById('sgm-overlay') && typeof sgmRender === 'function') sgmRender(); } catch (e) {}
  document.querySelectorAll('[data-hn-slot]').forEach(function(slot) {
    var c = (typeof getAllCourses === 'function' ? getAllCourses() : []).find(function(x) { return x.id === slot.getAttribute('data-hn-course-id'); });
    if (c) slot.innerHTML = hnInlineHtml(c, parseInt(slot.getAttribute('data-hn-slot'), 10), slot.hasAttribute('data-hn-compact'));
  });
  var book = document.getElementById('hn-book');
  if (book && book.getAttribute('data-course') === courseId && typeof hnRenderBook === 'function') hnRenderBook(book);
  document.querySelectorAll('.crs-notes-n[data-course="' + courseId + '"]').forEach(function(el) {
    var n = hnCount(courseId); el.textContent = n ? ' (' + n + ')' : '';
  });
}

/* Emplacement « note » à mettre dans un gabarit HTML (rafraîchi automatiquement) */
function hnSlotHtml(course, idx, compact) {
  return '<div data-hn-slot="' + idx + '" data-hn-course-id="' + hnEsc(course.id) + '"' + (compact ? ' data-hn-compact' : '') + '>'
    + hnInlineHtml(course, idx, compact) + '</div>';
}

/* ─────────────── LE CARNET COMPLET D'UN PARCOURS ─────────────── */

function hnOpenBook(course) {
  var old = document.getElementById('hn-book-modal');
  if (old) old.remove();
  var m = document.createElement('div');
  m.id = 'hn-book-modal';
  m.className = 'trn-modal';
  m.innerHTML = '<div class="trn-modal-card" style="max-width:560px">'
    + '<div class="trn-modal-head"><div><div class="trn-modal-tag">Carnet de parcours</div>'
    +   '<div class="trn-modal-title">' + hnEsc(course.name) + '</div></div><button class="trn-modal-close" type="button">×</button></div>'
    + '<div class="trn-modal-body"><p class="inv-text">Tes repères trou par trou. Ils s\'affichent pendant la saisie de ta partie.</p>'
    +   '<div id="hn-book" data-course="' + hnEsc(course.id) + '"></div></div></div>';
  document.body.appendChild(m);
  m.querySelector('.trn-modal-close').addEventListener('click', function() { m.remove(); });
  m.addEventListener('click', function(e) { if (e.target === m) m.remove(); });
  var book = m.querySelector('#hn-book');
  book._course = course;
  hnRenderBook(book);
}

function hnRenderBook(book) {
  var course = book._course;
  if (!course) return;
  book.innerHTML = course.trous.map(function(h, i) {
    return '<div class="hn-row"><div class="hn-row-n">' + h.num + '</div>'
      + '<div class="hn-row-main"><div class="hn-row-meta">Par ' + h.par + (h.longueur ? ' · ' + h.longueur + ' m' : '') + (h.si ? ' · SI ' + h.si : '') + '</div>'
      + hnInlineHtml(course, i, true) + '</div></div>';
  }).join('');
}

/* ─────────────── SYNCHRO CLOUD ─────────────── */

var _hnCloudOff = false;

function hnCloud() { return !_hnCloudOff && window.tsgCloud && window.sbClient && window._sbSession && window._sbSession.user; }

function hnPush(courseId, hole) {
  if (!hnCloud()) return;
  var all = hnAll(), n = all[courseId] && all[courseId][hole];
  if (!n || !n.dirty) return;
  var uid = window._sbSession.user.id;
  var q = n.deleted
    ? window.sbClient.from('hole_notes').delete().eq('user_id', uid).eq('course_id', courseId).eq('hole', hole)
    : window.sbClient.from('hole_notes').upsert({ user_id: uid, course_id: courseId, hole: hole, body: n.text || '', club: n.club || null, updated_at: n.at });
  q.then(function(res) {
    if (res && res.error) {
      if (/hole_notes|schema cache|does not exist/i.test(res.error.message || '')) _hnCloudOff = true;   // table pas encore créée
      return;
    }
    var cur = hnAll();
    var c = cur[courseId] && cur[courseId][hole];
    if (!c || c.at !== n.at) return;          // modifiée entre-temps : elle repartira
    if (c.deleted) delete cur[courseId][hole]; else delete c.dirty;
    lsSet('holeNotes', cur);
  }, function() {});
}

/* À la connexion : fusion note par note, la plus récente gagne */
function hnSyncPull(uid) {
  if (!window.sbClient) return;
  window.sbClient.from('hole_notes').select('course_id, hole, body, club, updated_at').eq('user_id', uid).then(function(res) {
    if (res.error) { if (/hole_notes|schema cache|does not exist/i.test(res.error.message || '')) _hnCloudOff = true; return; }
    var all = hnAll(), seen = {};
    (res.data || []).forEach(function(r) {
      var c = all[r.course_id] = all[r.course_id] || {};
      var l = c[r.hole];
      seen[r.course_id + '#' + r.hole] = true;
      // (dates comparées en millisecondes : Postgres et le navigateur ne les écrivent pas pareil)
      if (!l || (Date.parse(l.at) || 0) < (Date.parse(r.updated_at) || 0)) {
        c[r.hole] = { text: r.body || '', club: r.club || '', at: r.updated_at };
      }
    });
    // Note locale modifiée ici et pas encore envoyée : on l'envoie.
    // Note déjà synchronisée mais absente du cloud : effacée depuis un autre appareil.
    var toPush = [];
    Object.keys(all).forEach(function(cid) {
      Object.keys(all[cid]).forEach(function(h) {
        var n = all[cid][h];
        if (n.dirty) toPush.push([cid, parseInt(h, 10)]);
        else if (!seen[cid + '#' + h]) delete all[cid][h];
      });
    });
    lsSet('holeNotes', all);
    toPush.forEach(function(p) { hnPush(p[0], p[1]); });
  }, function() {});
}
