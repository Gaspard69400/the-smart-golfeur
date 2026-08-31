/* ════════════════════════════════════════════
 * THE SMART GOLFER — courses.js
 * Page Parcours : catalogue de découverte
 * Liste/recherche/filtres des parcours, ajout de ses parcours,
 * bouton "Jouer" qui bascule vers la Scorecard avec le parcours sélectionné.
 * Dépend de : data.js (getAllCourses/saveUserCourse/deleteUserCourse),
 *             app.js (showPage, showToast), scorecard.js (selectCourse, openCourseCreator)
 * ════════════════════════════════════════════ */

var crs_search = '';
var crs_region = 'all';

/* Normalise un libellé de niveau pour la classe CSS */
function crsLvlClass(niveau) {
  return (niveau || 'Standard').toLowerCase()
    .replace(/é/g, 'e').replace(/è/g, 'e').replace(/â/g, 'a').replace(/\s+/g, '-');
}

/* Construit la page complète dans le container fourni */
function buildCoursesPage(container) {
  if (!container) return;
  while (container.firstChild) container.removeChild(container.firstChild);

  var all = (typeof getAllCourses === 'function') ? getAllCourses() : (typeof COURSES !== 'undefined' ? COURSES : []);

  var wrap = document.createElement('div');
  wrap.className = 'dash-wrap';

  /* ── HEADER ── */
  var header = document.createElement('div');
  header.className = 'dash-header';

  var left = document.createElement('div');
  var title = document.createElement('div');
  title.className = 'dash-greeting';
  title.textContent = 'Parcours';
  var meta = document.createElement('div');
  meta.className = 'dash-meta';
  var nbUser = all.filter(function(c) { return c.userCreated; }).length;
  meta.textContent = all.length + ' parcours · ' + nbUser + ' créé' + (nbUser > 1 ? 's' : '') + ' par vous';
  left.appendChild(title);
  left.appendChild(meta);

  var right = document.createElement('div');
  right.style.display = 'flex';
  right.style.gap = '8px';
  var addBtn = document.createElement('button');
  addBtn.className = 'dash-btn dash-btn-gold';
  addBtn.textContent = '+ Ajouter mon parcours';
  addBtn.addEventListener('click', function() {
    if (typeof openCourseCreator === 'function') openCourseCreator();
    else showToast('Création de parcours indisponible');
  });
  right.appendChild(addBtn);

  header.appendChild(left);
  header.appendChild(right);
  wrap.appendChild(header);

  /* ── Parcours de la communauté (import en un clic) ── */
  try { if (typeof shcRenderPanel === 'function') shcRenderPanel(wrap); }
  catch (e) { console.warn('[TSG] Parcours partagés:', e.message); }

  /* ── BARRE DE RECHERCHE + FILTRES ── */
  var controls = document.createElement('div');
  controls.className = 'crs-controls';

  var search = document.createElement('input');
  search.type = 'text';
  search.className = 'crs-search';
  search.id = 'crs-search-input';
  search.placeholder = 'Rechercher un parcours, une ville, une région…';
  search.value = crs_search;
  search.addEventListener('input', function() {
    crs_search = this.value;
    crsRenderGrid();
  });
  controls.appendChild(search);

  /* Chips de régions (dynamiques) */
  var regions = [];
  all.forEach(function(c) {
    if (c.region && regions.indexOf(c.region) === -1) regions.push(c.region);
  });
  regions.sort();

  var filterRow = document.createElement('div');
  filterRow.className = 'filter-row crs-filter-row';

  function makeChip(value, label) {
    var b = document.createElement('button');
    b.className = 'filter-btn' + (crs_region === value ? ' on' : '');
    b.textContent = label;
    b.addEventListener('click', function() {
      crs_region = value;
      filterRow.querySelectorAll('.filter-btn').forEach(function(x) { x.classList.remove('on'); });
      b.classList.add('on');
      crsRenderGrid();
    });
    return b;
  }
  filterRow.appendChild(makeChip('all', 'Toutes les régions'));
  regions.forEach(function(r) { filterRow.appendChild(makeChip(r, r)); });
  controls.appendChild(filterRow);

  wrap.appendChild(controls);

  /* ── GRILLE ── */
  var grid = document.createElement('div');
  grid.className = 'crs-grid';
  grid.id = 'crs-grid';
  wrap.appendChild(grid);

  container.appendChild(wrap);

  crsRenderGrid();
}

/* Filtre + rendu de la grille de cartes */
function crsRenderGrid() {
  var grid = document.getElementById('crs-grid');
  if (!grid) return;

  var all = (typeof getAllCourses === 'function') ? getAllCourses() : (typeof COURSES !== 'undefined' ? COURSES : []);
  var q = (crs_search || '').toLowerCase().trim();

  var list = all.filter(function(c) {
    var matchQ = !q
      || (c.name && c.name.toLowerCase().indexOf(q) !== -1)
      || (c.ville && c.ville.toLowerCase().indexOf(q) !== -1)
      || (c.region && c.region.toLowerCase().indexOf(q) !== -1)
      || (c.departement && c.departement.toLowerCase().indexOf(q) !== -1);
    var matchR = (crs_region === 'all') || (c.region === crs_region);
    return matchQ && matchR;
  });

  while (grid.firstChild) grid.removeChild(grid.firstChild);

  if (!list.length) {
    var empty = document.createElement('div');
    empty.className = 'an-empty-card crs-empty';
    empty.innerHTML = '<div class="an-empty-icon">⛳</div>'
      + '<div class="an-empty-title">Aucun parcours trouvé</div>'
      + '<div class="an-empty-text">Modifie ta recherche, ou ajoute ton propre parcours.</div>';
    var cta = document.createElement('button');
    cta.className = 'dash-btn dash-btn-gold an-empty-cta';
    cta.textContent = '+ Ajouter mon parcours';
    cta.addEventListener('click', function() { if (typeof openCourseCreator === 'function') openCourseCreator(); });
    empty.appendChild(cta);
    grid.appendChild(empty);
    return;
  }

  list.forEach(function(c) {
    grid.appendChild(crsBuildCard(c));
  });
}

/* Construit une carte parcours */
function crsBuildCard(c) {
  var card = document.createElement('div');
  card.className = 'crs-card';

  var isUser = !!c.userCreated;
  var lvl = c.niveau || 'Standard';

  /* En-tête de carte */
  var head = document.createElement('div');
  head.className = 'crs-card-head';
  head.innerHTML = ''
    + '<div class="crs-card-titles">'
    +   '<div class="crs-card-name">' + (isUser ? '<span class="crs-user-badge" title="Parcours créé par vous">✦</span> ' : '') + crsEsc(c.name) + '</div>'
    +   '<div class="crs-card-loc">' + crsEsc([c.ville, c.departement, c.region].filter(Boolean).join(' · ')) + '</div>'
    + '</div>'
    + '<span class="crs-lvl crs-lvl-' + crsLvlClass(lvl) + '">' + crsEsc(lvl) + '</span>';
  card.appendChild(head);

  /* Stats */
  var stats = document.createElement('div');
  stats.className = 'crs-stats';
  var statDefs = [
    ['Par', c.par_total],
    ['SSS', c.sss],
    ['Slope', c.slope || '—'],
    ['Rating', (typeof c.rating === 'number') ? c.rating.toFixed(1) : (c.rating || '—')],
    ['Long.', (c.longueur_totale ? c.longueur_totale + 'm' : '—')],
    ['Trous', (c.trous && c.trous.length) ? c.trous.length : '18']
  ];
  statDefs.forEach(function(s) {
    var st = document.createElement('div');
    st.className = 'crs-stat';
    st.innerHTML = '<div class="crs-stat-val">' + crsEsc(String(s[1])) + '</div>'
      + '<div class="crs-stat-lbl">' + s[0] + '</div>';
    stats.appendChild(st);
  });
  card.appendChild(stats);

  /* Actions */
  var actions = document.createElement('div');
  actions.className = 'crs-actions';

  var playBtn = document.createElement('button');
  playBtn.className = 'dash-btn dash-btn-gold crs-play-btn';
  playBtn.textContent = 'Jouer ce parcours →';
  playBtn.addEventListener('click', function() { crsPlayCourse(c); });
  actions.appendChild(playBtn);

  if (isUser) {
    var editBtn = document.createElement('button');
    editBtn.className = 'dash-btn dash-btn-outline crs-icon-btn';
    editBtn.title = 'Modifier ce parcours';
    editBtn.innerHTML = '✎';
    editBtn.addEventListener('click', function() {
      if (typeof openCourseCreator === 'function') openCourseCreator(c);
    });
    actions.appendChild(editBtn);

    var delBtn = document.createElement('button');
    delBtn.className = 'dash-btn dash-btn-outline crs-icon-btn crs-del-btn';
    delBtn.title = 'Supprimer ce parcours';
    delBtn.innerHTML = '×';
    delBtn.addEventListener('click', function() {
      if (!confirm('Supprimer définitivement le parcours « ' + c.name + ' » ?')) return;
      if (typeof deleteUserCourse === 'function') {
        deleteUserCourse(c.id);
        showToast('Parcours supprimé');
        crsRefresh();
      }
    });
    actions.appendChild(delBtn);
  }

  card.appendChild(actions);
  return card;
}

/* Sélectionne le parcours et bascule vers la Scorecard */
function crsPlayCourse(c) {
  try {
    if (typeof selectCourse === 'function') selectCourse(c);
  } catch (e) {
    console.warn('crsPlayCourse selectCourse:', e.message);
  }
  if (typeof showPage === 'function') showPage('scorecard');
  if (typeof showToast === 'function') showToast('Parcours sélectionné : ' + c.name);
}

/* Rafraîchit toute la page Parcours (header + grille) — appelé après ajout/suppression */
function crsRefresh() {
  var page = document.getElementById('page-courses');
  if (page) buildCoursesPage(page);
}

/* Petit échappement HTML pour le contenu injecté */
function crsEsc(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
