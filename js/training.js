/* ════════════════════════════════════════════
 * THE SMART GOLFER — training.js
 * Onglet Entraînement : le coach crée des exercices / entraînements,
 * les joueurs les consultent et les marquent comme faits.
 * Stockage localStorage (device unique pour l'instant — la synchro
 * multi-utilisateurs arrivera avec le backend Supabase).
 * Dépend de : data.js, app.js
 * ════════════════════════════════════════════ */

var TRAINING_CATEGORIES = ['Drive', 'Approche', 'Jeu court', 'Putting', 'Mental', 'Physique', 'Parcours'];
var TRAINING_LEVELS = ['Débutant', 'Intermédiaire', 'Avancé', 'Expert'];

var trn_filter = 'all';

/* ─── DONNÉES ─── */

function trnIsCoach() {
  return currentUser && (currentUser.role === 'head' || currentUser.role === 'coach');
}

function getTrainings() {
  var t = lsGet('trainings');
  if (t === null || t === undefined) {
    // Seed initial : quelques exemples pour ne pas avoir une page vide
    t = TRAINING_SEED();
    lsSet('trainings', t);
  }
  return t || [];
}

function saveTraining(item) {
  var list = getTrainings();
  var idx = -1;
  for (var i = 0; i < list.length; i++) { if (list[i].id === item.id) { idx = i; break; } }
  if (idx >= 0) list[idx] = item; else list.unshift(item);
  lsSet('trainings', list);
  if (window.tsgSync) window.tsgSync.pushTraining(item);
}

function deleteTraining(id) {
  var list = getTrainings().filter(function(t) { return t.id !== id; });
  lsSet('trainings', list);
  if (window.tsgSync) window.tsgSync.deleteTraining(id);
}

/* Suivi des réalisations par joueur : { userId: { trainingId: {count, last} } } */
function trnGetDoneMap() {
  return lsGet('training_done') || {};
}
function trnGetDone(id) {
  var map = trnGetDoneMap();
  var uid = (currentUser && currentUser.id) || 'default';
  return (map[uid] && map[uid][id]) || null;
}
function trnMarkDone(id) {
  var map = trnGetDoneMap();
  var uid = (currentUser && currentUser.id) || 'default';
  if (!map[uid]) map[uid] = {};
  var cur = map[uid][id] || { count: 0, last: null };
  cur.count += 1;
  cur.last = new Date().toISOString();
  map[uid][id] = cur;
  lsSet('training_done', map);
  if (window.tsgSync) window.tsgSync.pushTrainingDone(id, cur);
}

function TRAINING_SEED() {
  var coach = { id: 'martin', name: 'Martin Dubois' };
  var now = new Date().toISOString();
  return [
    {
      id: 'seed-putt-1', type: 'exercice', title: 'Échelle de putting 1-2-3m',
      category: 'Putting', level: 'Débutant', duration: 15,
      objective: 'Maîtriser la distance sur les putts courts.',
      description: '1. Place 3 balles à 1m, 2m et 3m du trou.\n2. Rentre les 3 distances d\'affilée sans erreur.\n3. Si tu rates, tu recommences la série.\n4. Objectif : 5 séries complètes.',
      createdBy: coach, createdAt: now
    },
    {
      id: 'seed-app-1', type: 'exercice', title: 'Wedges — 3 distances cibles',
      category: 'Approche', level: 'Intermédiaire', duration: 25,
      objective: 'Contrôler ses distances de wedge (50 / 75 / 100m).',
      description: '1. Choisis 3 distances : 50, 75 et 100m.\n2. Frappe 10 balles par distance.\n3. Note combien atterrissent dans un rayon de 5m.\n4. Vise > 6/10 sur chaque distance.',
      createdBy: coach, createdAt: now
    },
    {
      id: 'seed-train-1', type: 'entrainement', title: 'Séance jeu court complète',
      category: 'Jeu court', level: 'Avancé', duration: 60,
      objective: 'Travailler tout le jeu court en une séance structurée.',
      description: 'Échauffement 10 min.\nChipping : 15 min (3 lies différents).\nBunker : 15 min (sortie + distance).\nPutting : 20 min (échelle de distances + putts courts sous pression).',
      createdBy: coach, createdAt: now
    }
  ];
}

/* ─── PAGE ─── */

function buildTrainingPage(container) {
  if (!container) return;
  while (container.firstChild) container.removeChild(container.firstChild);

  var all = getTrainings();

  var wrap = document.createElement('div');
  wrap.className = 'dash-wrap';

  /* Header */
  var header = document.createElement('div');
  header.className = 'dash-header';
  var left = document.createElement('div');
  var title = document.createElement('div');
  title.className = 'dash-greeting';
  title.textContent = 'Entraînement';
  var meta = document.createElement('div');
  meta.className = 'dash-meta';
  meta.textContent = all.length + ' exercice' + (all.length > 1 ? 's' : '') + ' & entraînements'
    + (trnIsCoach() ? ' · vous pouvez en créer' : ' · proposés par ton coach');
  left.appendChild(title); left.appendChild(meta);
  header.appendChild(left);

  if (trnIsCoach()) {
    var right = document.createElement('div');
    var addBtn = document.createElement('button');
    addBtn.className = 'dash-btn dash-btn-gold';
    addBtn.textContent = '+ Créer un exercice';
    addBtn.addEventListener('click', function() { openTrainingCreator(); });
    right.appendChild(addBtn);
    header.appendChild(right);
  }
  wrap.appendChild(header);

  /* Filtres par catégorie */
  var filterRow = document.createElement('div');
  filterRow.className = 'filter-row';
  function chip(value, label) {
    var b = document.createElement('button');
    b.className = 'filter-btn' + (trn_filter === value ? ' on' : '');
    b.textContent = label;
    b.addEventListener('click', function() {
      trn_filter = value;
      filterRow.querySelectorAll('.filter-btn').forEach(function(x) { x.classList.remove('on'); });
      b.classList.add('on');
      trnRenderGrid();
    });
    return b;
  }
  filterRow.appendChild(chip('all', 'Tout'));
  TRAINING_CATEGORIES.forEach(function(c) {
    if (all.some(function(t) { return t.category === c; })) filterRow.appendChild(chip(c, c));
  });
  wrap.appendChild(filterRow);

  /* Grille */
  var grid = document.createElement('div');
  grid.className = 'trn-grid';
  grid.id = 'trn-grid';
  wrap.appendChild(grid);

  container.appendChild(wrap);
  trnRenderGrid();
}

function trnRenderGrid() {
  var grid = document.getElementById('trn-grid');
  if (!grid) return;
  var all = getTrainings();
  var list = (trn_filter === 'all') ? all : all.filter(function(t) { return t.category === trn_filter; });

  while (grid.firstChild) grid.removeChild(grid.firstChild);

  if (!list.length) {
    var empty = document.createElement('div');
    empty.className = 'an-empty-card trn-empty';
    empty.innerHTML = '<div class="an-empty-icon">🏌️</div>'
      + '<div class="an-empty-title">Aucun exercice ici</div>'
      + '<div class="an-empty-text">' + (trnIsCoach() ? 'Crée ton premier exercice pour tes joueurs.' : 'Ton coach n\'a pas encore proposé d\'exercice dans cette catégorie.') + '</div>';
    if (trnIsCoach()) {
      var cta = document.createElement('button');
      cta.className = 'dash-btn dash-btn-gold an-empty-cta';
      cta.textContent = '+ Créer un exercice';
      cta.addEventListener('click', function() { openTrainingCreator(); });
      empty.appendChild(cta);
    }
    grid.appendChild(empty);
    return;
  }

  list.forEach(function(t) { grid.appendChild(trnBuildCard(t)); });
}

function trnBuildCard(t) {
  var card = document.createElement('div');
  card.className = 'trn-card';

  var done = trnGetDone(t.id);

  var head = document.createElement('div');
  head.className = 'trn-card-head';
  head.innerHTML = ''
    + '<span class="trn-type trn-type-' + (t.type === 'entrainement' ? 'training' : 'exercise') + '">'
    +   (t.type === 'entrainement' ? 'Entraînement' : 'Exercice') + '</span>'
    + '<span class="trn-cat">' + trnEsc(t.category) + '</span>';
  card.appendChild(head);

  var titleEl = document.createElement('div');
  titleEl.className = 'trn-title';
  titleEl.textContent = t.title;
  card.appendChild(titleEl);

  var objEl = document.createElement('div');
  objEl.className = 'trn-obj';
  objEl.textContent = t.objective || '';
  card.appendChild(objEl);

  var metaEl = document.createElement('div');
  metaEl.className = 'trn-meta';
  metaEl.innerHTML = '<span>⏱ ' + (t.duration || '—') + ' min</span>'
    + '<span>· ' + trnEsc(t.level || 'Tous niveaux') + '</span>'
    + (t.createdBy && t.createdBy.name ? '<span>· par ' + trnEsc(t.createdBy.name) + '</span>' : '');
  card.appendChild(metaEl);

  if (done && done.count > 0) {
    var badge = document.createElement('div');
    badge.className = 'trn-done-badge';
    badge.textContent = '✓ Fait ' + done.count + '×';
    card.appendChild(badge);
  }

  var actions = document.createElement('div');
  actions.className = 'trn-actions';

  var viewBtn = document.createElement('button');
  viewBtn.className = 'dash-btn dash-btn-outline trn-view-btn';
  viewBtn.textContent = 'Voir / Faire';
  viewBtn.addEventListener('click', function() { openTrainingDetail(t); });
  actions.appendChild(viewBtn);

  // Le coach peut éditer/supprimer ses propres créations
  if (trnIsCoach()) {
    var editBtn = document.createElement('button');
    editBtn.className = 'dash-btn dash-btn-outline trn-icon-btn';
    editBtn.title = 'Modifier'; editBtn.innerHTML = '✎';
    editBtn.addEventListener('click', function() { openTrainingCreator(t); });
    actions.appendChild(editBtn);

    var delBtn = document.createElement('button');
    delBtn.className = 'dash-btn dash-btn-outline trn-icon-btn trn-del-btn';
    delBtn.title = 'Supprimer'; delBtn.innerHTML = '×';
    delBtn.addEventListener('click', function() {
      if (!confirm('Supprimer « ' + t.title + ' » ?')) return;
      deleteTraining(t.id);
      showToast('Exercice supprimé');
      trnRefresh();
    });
    actions.appendChild(delBtn);
  }

  card.appendChild(actions);
  return card;
}

/* ─── DÉTAIL + MARQUER COMME FAIT ─── */

function openTrainingDetail(t) {
  var existing = document.getElementById('trn-detail-modal');
  if (existing) existing.remove();

  var done = trnGetDone(t.id);
  var steps = (t.description || '').split('\n').filter(function(l) { return l.trim(); });
  var stepsHtml = steps.map(function(s) { return '<li>' + trnEsc(s.replace(/^\d+\.\s*/, '')) + '</li>'; }).join('');

  var modal = document.createElement('div');
  modal.id = 'trn-detail-modal';
  modal.className = 'trn-modal';
  modal.innerHTML = ''
    + '<div class="trn-modal-card">'
    +   '<div class="trn-modal-head">'
    +     '<div>'
    +       '<span class="trn-type trn-type-' + (t.type === 'entrainement' ? 'training' : 'exercise') + '">' + (t.type === 'entrainement' ? 'Entraînement' : 'Exercice') + '</span> '
    +       '<span class="trn-cat">' + trnEsc(t.category) + '</span>'
    +       '<div class="trn-modal-title">' + trnEsc(t.title) + '</div>'
    +     '</div>'
    +     '<button class="trn-modal-close" id="trn-detail-close">×</button>'
    +   '</div>'
    +   '<div class="trn-modal-body">'
    +     '<div class="trn-modal-meta">⏱ ' + (t.duration || '—') + ' min · ' + trnEsc(t.level || 'Tous niveaux')
    +       (t.createdBy && t.createdBy.name ? ' · par ' + trnEsc(t.createdBy.name) : '')
    +       '</div>'
    +     (t.objective ? '<div class="trn-modal-obj"><strong>Objectif :</strong> ' + trnEsc(t.objective) + '</div>' : '')
    +     '<div class="trn-modal-section-title">Consignes</div>'
    +     (stepsHtml ? '<ol class="trn-steps">' + stepsHtml + '</ol>' : '<div class="trn-modal-obj">Pas de consigne détaillée.</div>')
    +     (done && done.count > 0 ? '<div class="trn-done-info">Tu as fait cet exercice <strong>' + done.count + '×</strong>' + (done.last ? ' · dernière fois le ' + new Date(done.last).toLocaleDateString('fr-FR') : '') + '</div>' : '')
    +   '</div>'
    +   '<div class="trn-modal-actions">'
    +     '<button class="dash-btn dash-btn-outline" id="trn-detail-cancel">Fermer</button>'
    +     '<button class="dash-btn dash-btn-gold" id="trn-detail-done">✓ Marquer comme fait</button>'
    +   '</div>'
    + '</div>';

  document.body.appendChild(modal);
  function close() { modal.remove(); }
  document.getElementById('trn-detail-close').addEventListener('click', close);
  document.getElementById('trn-detail-cancel').addEventListener('click', close);
  modal.addEventListener('click', function(ev) { if (ev.target === modal) close(); });
  document.getElementById('trn-detail-done').addEventListener('click', function() {
    trnMarkDone(t.id);
    showToast('Bravo ! Exercice marqué comme fait ✓');
    close();
    trnRefresh();
  });
}

/* ─── CRÉATION / ÉDITION (coach) ─── */

function openTrainingCreator(existing) {
  var isEdit = !!existing;
  var ex = document.getElementById('trn-creator-modal');
  if (ex) ex.remove();

  var f = isEdit ? JSON.parse(JSON.stringify(existing)) : {
    id: 'trn-' + Date.now(), type: 'exercice', title: '', category: 'Putting',
    level: 'Intermédiaire', duration: 20, objective: '', description: '',
    createdBy: { id: (currentUser && currentUser.id) || null, name: (currentUser && currentUser.name) || 'Coach' },
    createdAt: new Date().toISOString()
  };

  var catOpts = TRAINING_CATEGORIES.map(function(c) { return '<option value="' + c + '"' + (f.category === c ? ' selected' : '') + '>' + c + '</option>'; }).join('');
  var lvlOpts = TRAINING_LEVELS.map(function(l) { return '<option value="' + l + '"' + (f.level === l ? ' selected' : '') + '>' + l + '</option>'; }).join('');

  var modal = document.createElement('div');
  modal.id = 'trn-creator-modal';
  modal.className = 'trn-modal';
  modal.innerHTML = ''
    + '<div class="trn-modal-card">'
    +   '<div class="trn-modal-head">'
    +     '<div><div class="trn-modal-tag">' + (isEdit ? 'Modifier' : 'Nouveau') + '</div>'
    +       '<div class="trn-modal-title">' + (isEdit ? 'Modifier l\'exercice' : 'Créer un exercice') + '</div></div>'
    +     '<button class="trn-modal-close" id="trn-cr-close">×</button>'
    +   '</div>'
    +   '<div class="trn-modal-body">'
    +     '<div class="trn-form-grid">'
    +       '<div class="obj-field trn-col-2"><label class="obj-label">Titre *</label>'
    +         '<input type="text" class="obj-input" data-f="title" placeholder="ex. Échelle de putting" value="' + trnEsc(f.title) + '"></div>'
    +       '<div class="obj-field"><label class="obj-label">Type</label><select class="obj-input" data-f="type">'
    +         '<option value="exercice"' + (f.type === 'exercice' ? ' selected' : '') + '>Exercice</option>'
    +         '<option value="entrainement"' + (f.type === 'entrainement' ? ' selected' : '') + '>Entraînement</option></select></div>'
    +       '<div class="obj-field"><label class="obj-label">Catégorie</label><select class="obj-input" data-f="category">' + catOpts + '</select></div>'
    +       '<div class="obj-field"><label class="obj-label">Niveau</label><select class="obj-input" data-f="level">' + lvlOpts + '</select></div>'
    +       '<div class="obj-field"><label class="obj-label">Durée (min)</label><input type="number" class="obj-input" data-f="duration" value="' + (f.duration || 20) + '"></div>'
    +       '<div class="obj-field trn-col-2"><label class="obj-label">Objectif</label>'
    +         '<input type="text" class="obj-input" data-f="objective" placeholder="ex. Maîtriser les putts courts" value="' + trnEsc(f.objective) + '"></div>'
    +       '<div class="obj-field trn-col-2"><label class="obj-label">Consignes <span class="obj-hint">· une étape par ligne</span></label>'
    +         '<textarea class="obj-input trn-textarea" data-f="description" rows="6" placeholder="1. ...\n2. ...">' + trnEsc(f.description) + '</textarea></div>'
    +     '</div>'
    +   '</div>'
    +   '<div class="trn-modal-actions">'
    +     '<button class="dash-btn dash-btn-outline" id="trn-cr-cancel">Annuler</button>'
    +     '<button class="dash-btn dash-btn-gold" id="trn-cr-save">' + (isEdit ? 'Enregistrer' : 'Créer') + '</button>'
    +   '</div>'
    + '</div>';

  document.body.appendChild(modal);
  function close() { modal.remove(); }
  document.getElementById('trn-cr-close').addEventListener('click', close);
  document.getElementById('trn-cr-cancel').addEventListener('click', close);
  modal.addEventListener('click', function(ev) { if (ev.target === modal) close(); });

  document.getElementById('trn-cr-save').addEventListener('click', function() {
    modal.querySelectorAll('[data-f]').forEach(function(inp) {
      var k = inp.getAttribute('data-f');
      f[k] = (k === 'duration') ? (parseInt(inp.value, 10) || 0) : inp.value;
    });
    if (!f.title.trim()) { showToast('Donne un titre à ton exercice'); return; }
    saveTraining(f);
    showToast(isEdit ? 'Exercice modifié ✓' : 'Exercice créé ✓ — visible par tes joueurs');
    close();
    trnRefresh();
  });
}

/* ─── UTILS ─── */

function trnRefresh() {
  var page = document.getElementById('page-training');
  if (page) buildTrainingPage(page);
}

function trnEsc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
