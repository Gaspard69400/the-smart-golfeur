/* ════════════════════════════════════════════
 * THE SMART GOLFER — sharedcourses.js
 * PARCOURS DE LA COMMUNAUTÉ — chercher un parcours saisi par quelqu'un
 * d'autre et l'ajouter à ses parcours en un clic.
 *
 * Avant : chaque joueur devait ressaisir ses parcours à la main
 * (18 trous × 3 champs). C'était LE mur à l'arrivée d'un nouveau testeur.
 *
 * Nécessite `backend/shared_courses.sql` (colonne `shared` + policy de lecture).
 * Dépend de : app.js (showToast, lsGet/lsSet), data.js (getAllCourses, saveUserCourse),
 *             auth.js (cloudActive), supabaseClient.js (window.sbClient).
 * ════════════════════════════════════════════ */

var _shcSearch = '';
var _shcCache = null;
var _shcListEl = null;   // référence directe : le panneau est bâti hors du document

/* Panneau inséré en haut de l'onglet Parcours */
function shcRenderPanel(host) {
  if (!host) return;

  var panel = document.createElement('div');
  panel.className = 'panel shc-panel';
  panel.innerHTML = ''
    + '<div class="panel-header">'
    +   '<div><div class="panel-title">🌍 Parcours de la communauté</div>'
    +   '<div class="panel-sub">Ne ressaisis pas un parcours que quelqu\'un a déjà fait</div></div>'
    + '</div>'
    + '<div class="panel-body">'
    +   '<div class="shc-searchrow">'
    +     '<input type="text" class="shc-search" id="shc-search" placeholder="Chercher un parcours, une ville, une région…" autocomplete="off">'
    +     '<button class="dash-btn dash-btn-outline" id="shc-refresh" title="Rafraîchir">↻</button>'
    +   '</div>'
    +   '<div id="shc-list"><div class="ch-loading">Chargement…</div></div>'
    + '</div>';
  host.appendChild(panel);
  _shcListEl = panel.querySelector('#shc-list');

  var input = panel.querySelector('#shc-search');
  if (input) {
    input.value = _shcSearch;
    input.addEventListener('input', function() {
      _shcSearch = input.value;
      shcRenderList();
    });
  }
  var refresh = panel.querySelector('#shc-refresh');
  if (refresh) refresh.addEventListener('click', function() { _shcCache = null; shcLoad(true); });

  shcLoad(false);
}

/* Charge les parcours partagés (mise en cache le temps de la session) */
function shcLoad(force) {
  var host = _shcListEl || document.getElementById('shc-list');
  if (!host) return;

  if (typeof cloudActive !== 'function' || !cloudActive()) {
    host.innerHTML = '<div class="shc-cta">'
      + '<div class="shc-cta-ico">🔒</div>'
      + '<div class="shc-cta-txt"><strong>Crée un compte pour accéder aux parcours partagés</strong><br>'
      + 'Tu pourras récupérer en un clic les parcours saisis par les autres joueurs — et partager les tiens.</div>'
      + '</div>';
    return;
  }

  if (_shcCache && !force) { shcRenderList(); return; }

  host.innerHTML = '<div class="ch-loading">Chargement…</div>';
  window.sbClient
    .from('user_courses')
    .select('id, name, region, ville, par_total, holes, author_name, user_id, data')
    .eq('shared', true)
    .order('name', { ascending: true })
    .limit(200)
    .then(function(res) {
      if (res.error) {
        host.innerHTML = '<div class="shc-empty">Impossible de charger : ' + shcEsc(res.error.message)
          + '<br><span class="shc-hint">As-tu bien exécuté <code>backend/shared_courses.sql</code> dans Supabase ?</span></div>';
        return;
      }
      _shcCache = res.data || [];
      shcRenderList();
    }, function(e) {
      host.innerHTML = '<div class="shc-empty">Connexion impossible (' + shcEsc(e.message || '') + ').</div>';
    });
}

function shcRenderList() {
  var host = _shcListEl || document.getElementById('shc-list');
  if (!host || !_shcCache) return;

  // Ce que le joueur possède déjà (système + perso) — pour ne pas proposer un doublon
  var mine = {};
  try {
    (getAllCourses() || []).forEach(function(c) {
      if (c.name) mine[c.name.toLowerCase().trim()] = true;
    });
  } catch (e) {}

  var q = (_shcSearch || '').toLowerCase().trim();
  var list = _shcCache.filter(function(c) {
    if (!q) return true;
    return [c.name, c.ville, c.region].some(function(v) {
      return v && String(v).toLowerCase().indexOf(q) >= 0;
    });
  });

  if (!list.length) {
    host.innerHTML = '<div class="shc-empty">'
      + (q ? 'Aucun parcours ne correspond à « ' + shcEsc(_shcSearch) + ' ».'
           : 'Aucun parcours partagé pour l\'instant. Sois le premier — coche « Partager » en créant un parcours ! ⛳')
      + '</div>';
    return;
  }

  host.innerHTML = '<div class="shc-list">' + list.map(function(c) {
    var owned = c.name && mine[c.name.toLowerCase().trim()];
    var loc = [c.ville, c.region].filter(Boolean).join(' · ');
    var meta = [];
    if (c.holes) meta.push(c.holes + ' trous');
    if (c.par_total) meta.push('Par ' + c.par_total);
    if (c.author_name) meta.push('par ' + c.author_name);
    var btn = owned
      ? '<span class="shc-owned">✓ Déjà chez toi</span>'
      : '<button class="dash-btn dash-btn-gold shc-add" data-id="' + shcEsc(c.id) + '">+ Ajouter</button>';
    return '<div class="shc-row">'
      + '<div class="shc-row-info">'
      +   '<div class="shc-row-name">' + shcEsc(c.name || 'Parcours') + '</div>'
      +   (loc ? '<div class="shc-row-loc">' + shcEsc(loc) + '</div>' : '')
      +   '<div class="shc-row-meta">' + shcEsc(meta.join(' · ')) + '</div>'
      + '</div>' + btn
      + '</div>';
  }).join('') + '</div>';

  host.querySelectorAll('.shc-add').forEach(function(b) {
    b.addEventListener('click', function() { shcImport(b.getAttribute('data-id'), b); });
  });
}

/* Copie un parcours partagé dans MES parcours */
function shcImport(id, btn) {
  var row = null;
  for (var i = 0; i < (_shcCache || []).length; i++) {
    if (_shcCache[i].id === id) { row = _shcCache[i]; break; }
  }
  if (!row || !row.data) { showToast('Parcours introuvable'); return; }

  var course = JSON.parse(JSON.stringify(row.data));
  // Nouvel identifiant local : c'est MA copie, je peux la modifier sans toucher l'original
  course.id = 'user-' + Date.now();
  course.shared = false;              // ma copie n'est pas re-partagée automatiquement
  course.importedFrom = row.id;
  course.importedAuthor = row.author_name || null;

  if (btn) { btn.disabled = true; btn.textContent = '…'; }
  try {
    saveUserCourse(course);
    showToast('« ' + (course.name || 'Parcours') +' » ajouté à tes parcours ✓');
    if (typeof crsRefresh === 'function' && document.getElementById('page-courses')) { try { crsRefresh(); } catch (e) {} }
    if (_shcListEl) shcRenderList();
    return course;
  } catch (e) {
    showToast('Erreur : ' + e.message);
    if (btn) { btn.disabled = false; btn.textContent = '+ Ajouter'; }
  }
  return null;
}

/* Charge (une fois par session) la liste des parcours partagés, puis cb(liste) */
function shcFetch(cb) {
  if (typeof cloudActive !== 'function' || !cloudActive() || !window.sbClient) { cb(null); return; }
  if (_shcCache) { cb(_shcCache); return; }
  window.sbClient.from('user_courses')
    .select('id, name, region, ville, par_total, holes, author_name, user_id, data')
    .eq('shared', true).order('name', { ascending: true }).limit(200)
    .then(function(res) {
      if (res.error) { cb(null); return; }
      _shcCache = res.data || [];
      cb(_shcCache);
    }, function() { cb(null); });
}

/* Scorecard › « Choisir un parcours » : les parcours de la communauté que je n'ai pas
   encore apparaissent sous les miens (S76). Avant, ils n'étaient visibles que dans
   Jouer › Parcours — personne ne les trouvait. Un tap = copie chez moi + sélection. */
var _shcPickTok = 0;
function shcAppendToPicker(el) {
  if (!el) return;
  var tok = ++_shcPickTok;
  shcFetch(function(rows) {
    if (tok !== _shcPickTok || !rows || !document.body.contains(el)) return;
    var old = el.querySelector('.shc-pick');
    if (old) old.remove();
    var mine = {}, myIds = {};
    try { (getAllCourses() || []).forEach(function(c) { if (c.name) mine[c.name.toLowerCase().trim()] = true; if (c.importedFrom) myIds[c.importedFrom] = true; }); } catch (e) {}
    var inp = document.getElementById('search-input');
    var q = inp ? inp.value.toLowerCase().trim() : '';
    var uid = (typeof sbUserId === 'function') ? sbUserId() : null;
    var list = rows.filter(function(r) {
      if (!r.data || r.user_id === uid || myIds[r.id]) return false;
      if (r.name && mine[r.name.toLowerCase().trim()]) return false;
      if (!q) return true;
      return [r.name, r.ville, r.region].some(function(v) { return v && String(v).toLowerCase().indexOf(q) >= 0; });
    });
    if (!list.length) return;
    var box = document.createElement('div');
    box.className = 'shc-pick';
    box.innerHTML = '<div class="shc-pick-head">Parcours de la communauté</div>' + list.map(function(r) {
      var meta = [r.ville, r.holes ? r.holes + ' trous' : '', r.par_total ? 'Par ' + r.par_total : '', r.author_name ? 'ajouté par ' + r.author_name : ''].filter(Boolean).join(' · ');
      return '<button type="button" class="course-item shc-pick-item" data-shc-id="' + shcEsc(r.id) + '">'
        + '<span class="ci-name">' + shcEsc(r.name || 'Parcours') + '</span>'
        + '<span class="shc-pick-meta">' + shcEsc(meta) + '</span>'
        + '<span class="shc-pick-add">+ Ajouter et jouer</span></button>';
    }).join('');
    el.appendChild(box);
    box.addEventListener('click', function(e) {
      var b = e.target.closest('[data-shc-id]');
      if (!b) return;
      var course = shcImport(b.getAttribute('data-shc-id'), null);
      if (!course) return;
      if (typeof filterCourses === 'function') { try { filterCourses(); } catch (x) {} }
      var all = (typeof getAllCourses === 'function') ? getAllCourses() : [];
      for (var i = 0; i < all.length; i++) {
        if (all[i].id === course.id) { if (typeof selectCourse === 'function') selectCourse(all[i]); break; }
      }
    });
  });
}

function shcEsc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
