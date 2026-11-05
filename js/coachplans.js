/* ════════════════════════════════════════════
 * THE SMART GOLFER — coachplans.js
 * PLANS D'ENTRAÎNEMENT DONNÉS PAR LE COACH (S88).
 *
 * Le coach fixe à un de ses joueurs : un titre, une durée (semaines), un
 * objectif par semaine (séances + minutes), les exercices à faire chaque
 * semaine (bibliothèque, hiver, ou ses propres exercices) et un message.
 * Table `training_plans` (backend/maj_plans.sql) — un plan actif par
 * couple coach / joueur.
 *
 * Le SUIVI se calcule depuis le journal (training_log, S86) :
 *  · joueur : panneau « Plan de ton coach » en tête d'Entraînement
 *    (semaine X/N, séances et minutes vs objectif, exercices cochés) ;
 *  · coach : dans la fiche du joueur (semaine par semaine) et sur chaque
 *    carte de « Mes joueurs » (cette semaine, dernière séance).
 *
 * Dépend de : traininglog.js (tlAll, tlFromDb, tlMonday, tlEsc, tlRowHtml),
 *             traininglib.js/winter.js (getAllExercises), training.js
 *             (openTrainingDetail), coach.js (coachIsCoachRole).
 * ════════════════════════════════════════════ */

/* Modèles pour aller vite côté coach */
var CP_TEMPLATES = [
  { id: 'hiver-maison', title: 'Hiver à la maison', sessions: 3, minutes: 120,
    ex: ['win-putt-tapis', 'win-putt-mur', 'win-swing-miroir', 'win-vitesse', 'win-phy-force', 'win-phy-thorax'] },
  { id: 'hiver-practice', title: 'Hiver practice + maison', sessions: 3, minutes: 150,
    ex: ['win-prac-routine', 'win-chip-serviette', 'win-putt-tapis', 'win-vitesse', 'win-phy-force', 'win-prac-parcours'] },
  { id: 'petit-jeu', title: 'Petit jeu & putting', sessions: 3, minutes: 120,
    ex: ['lib-arg-updown', 'lib-arg-landing', 'win-chip-panier', 'lib-putt-echelle', 'lib-putt-lag', 'win-putt-mur'] },
  { id: 'physique', title: 'Préparation physique', sessions: 2, minutes: 90,
    ex: ['win-phy-force', 'win-phy-thorax', 'win-phy-cardio', 'win-vitesse', 'lib-phy-gainage'] }
];

function cpCloud() { return !!(window.tsgCloud && window.sbClient && currentUser && currentUser.id); }

function cpExercise(id, extra) {
  var all = (typeof getAllExercises === 'function') ? getAllExercises() : [];
  for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
  if (extra && extra[id]) return extra[id];
  return null;
}

/* Lundi (minuit local) de la semaine de départ, puis numéro de semaine courante */
function cpStart(plan) { return tlMonday(new Date(plan.start_date + 'T12:00:00')); }
function cpWeekNow(plan) {
  var days = Math.floor((tlMonday(new Date()).getTime() - cpStart(plan).getTime()) / 86400000 + 0.5);
  return Math.floor(days / 7) + 1;
}

/* Séances / minutes / exercices faits dans la semaine k du plan */
function cpWeek(plan, entries, k) {
  var a = cpStart(plan).getTime() + (k - 1) * 7 * 86400000, b = a + 7 * 86400000;
  var wk = entries.filter(function(e) { var t = Date.parse(e.date); return t >= a && t < b; });
  var done = {};
  wk.forEach(function(e) { if (e.id) done[e.id] = (done[e.id] || 0) + 1; });
  return { sessions: wk.length, minutes: wk.reduce(function(s, e) { return s + (e.duration || 0); }, 0), done: done };
}

/* Taux d'atteinte d'une semaine (0-1) : moyenne séances et minutes, plafonnée */
function cpRate(plan, w) {
  var s = plan.sessions_per_week ? Math.min(1, w.sessions / plan.sessions_per_week) : 1;
  var m = plan.minutes_per_week ? Math.min(1, w.minutes / plan.minutes_per_week) : s;
  return (s + m) / 2;
}
function cpRateClass(r) { return r >= 0.9 ? 'ok' : (r >= 0.5 ? 'mid' : 'low'); }

function cpBar(label, val, target, unit) {
  var pct = target ? Math.min(100, Math.round(100 * val / target)) : 0;
  return '<div class="cp-bar"><div class="cp-bar-l"><span>' + label + '</span><strong>' + val + (target ? ' / ' + target : '') + (unit ? ' ' + unit : '') + '</strong></div>'
    + '<div class="prg-progress-bar"><div class="prg-progress-fill cp-fill-' + cpRateClass(target ? val / target : 0) + '" style="width:' + pct + '%"></div></div></div>';
}

/* ════════════ CÔTÉ JOUEUR ════════════ */

function cpRenderPlayerPanel(host) {
  if (!host || !cpCloud()) return;
  var sb = window.sbClient;
  sb.from('training_plans').select('*').eq('player_id', currentUser.id).eq('status', 'active').then(function(res) {
    var plans = (res && res.data) || [];
    if (!plans.length) { host.innerHTML = ''; return; }
    var coachIds = plans.map(function(p) { return p.coach_id; });
    var unknown = [];
    plans.forEach(function(p) { (p.exercises || []).forEach(function(id) { if (!cpExercise(id) && unknown.indexOf(id) === -1) unknown.push(id); }); });
    Promise.all([
      sb.from('profiles').select('id, name').in('id', coachIds),
      unknown.length ? sb.from('trainings').select('*').in('id', unknown) : Promise.resolve({ data: [] })
    ]).then(function(r) {
      var names = {}; ((r[0] && r[0].data) || []).forEach(function(c) { names[c.id] = c.name; });
      var extra = {};
      ((r[1] && r[1].data) || []).forEach(function(t) {
        extra[t.id] = { id: t.id, type: t.type, title: t.title, category: t.category, level: t.level, duration: t.duration,
          objective: t.objective, description: t.description, createdBy: { id: t.created_by, name: t.author_name } };
      });
      host.innerHTML = '';
      plans.forEach(function(p) { host.appendChild(cpPlayerPlanEl(p, names[p.coach_id] || 'Ton coach', extra, host)); });
      // Nouveau plan → petit message une seule fois
      var seen = lsGet('plansSeen') || [];
      plans.forEach(function(p) {
        var tag = p.id + '@' + p.updated_at;
        if (seen.indexOf(tag) === -1) { seen.push(tag); }
      });
      lsSet('plansSeen', seen.slice(-50));
    });
  }, function() {});
}

function cpPlayerPlanEl(p, coachName, extra, host) {
  var entries = (typeof tlAll === 'function') ? tlAll() : [];
  var k = cpWeekNow(p);
  var el = document.createElement('div');
  el.className = 'panel cp-panel';
  var notStarted = k < 1, over = k > p.weeks;
  var w = cpWeek(p, entries, Math.max(1, Math.min(k, p.weeks)));
  var exHtml = (p.exercises || []).map(function(id) {
    var ex = cpExercise(id, extra);
    if (!ex) return '';
    var n = w.done[id] || 0;
    return '<button type="button" class="cp-ex' + (n ? ' is-done' : '') + '" data-cp-ex="' + tlEsc(id) + '">'
      + '<span class="cp-ex-check">' + (n ? '✓' : '') + '</span>'
      + '<span class="cp-ex-t">' + tlEsc(ex.title) + '<small>' + tlEsc(ex.category || '') + (ex.duration ? ' · ' + ex.duration + ' min' : '') + (n > 1 ? ' · ' + n + '× cette semaine' : '') + '</small></span>'
      + '<span class="cp-ex-go">›</span></button>';
  }).join('');
  el.innerHTML = '<div class="panel-header"><div><div class="panel-title">📋 ' + tlEsc(p.title) + '</div>'
    + '<div class="panel-sub cp-sub">Plan de ' + tlEsc(coachName) + ' · '
    + (notStarted ? 'commence le ' + new Date(p.start_date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
       : (over ? 'terminé' : 'semaine ' + k + ' sur ' + p.weeks)) + '</div></div></div>'
    + '<div class="panel-body">'
    + (p.message ? '<div class="cp-msg">« ' + tlEsc(p.message) + ' »</div>' : '')
    + (!notStarted && !over ? '<div class="cp-ex-title">Cette semaine</div><div class="cp-bars">' + cpBar('Séances', w.sessions, p.sessions_per_week) + cpBar('Minutes', w.minutes, p.minutes_per_week, 'min') + '</div>' : '')
    + (exHtml ? '<div class="cp-ex-title">À faire chaque semaine</div><div class="cp-ex-list">' + exHtml + '</div>' : '')
    + '<p class="tl-empty">Chaque exercice validé et chaque séance notée dans ton journal comptent. ' + tlEsc(coachName) + ' voit ta progression.</p>'
    + '</div>';
  el.addEventListener('click', function(e) {
    var b = e.target.closest('[data-cp-ex]');
    if (!b) return;
    var ex = cpExercise(b.getAttribute('data-cp-ex'), extra);
    if (ex && typeof openTrainingDetail === 'function') openTrainingDetail(ex, { onDone: function() { cpRenderPlayerPanel(host); if (typeof tlRenderPanel === 'function') tlRenderPanel(document.getElementById('tl-host')); } });
  });
  return el;
}

/* Au lancement : prévenir d'un nouveau plan (une fois) */
function cpOnLaunch() {
  if (!cpCloud() || (typeof coachIsCoachRole === 'function' && coachIsCoachRole())) return;
  window.sbClient.from('training_plans').select('id, title, updated_at').eq('player_id', currentUser.id).eq('status', 'active').then(function(res) {
    var plans = (res && res.data) || [];
    var seen = lsGet('plansSeen') || [];
    var fresh = plans.filter(function(p) { return seen.indexOf(p.id + '@' + p.updated_at) === -1; });
    if (fresh.length && typeof showToast === 'function') showToast('📋 Ton coach t\'a donné un plan : « ' + fresh[0].title + ' » — onglet Progresser');
  }, function() {});
}

/* ════════════ CÔTÉ COACH ════════════ */

/* Section « Plan d'entraînement » dans la fiche d'un joueur */
function cpRenderCoachSection(body, playerId) {
  if (!body || !window.sbClient) return;
  var sb = window.sbClient;
  var box = document.createElement('div');
  box.className = 'cp-coach';
  box.innerHTML = '<div class="pd-section-title">Plan d\'entraînement</div><div class="ch-loading">Chargement…</div>';
  // Juste après le journal (S86) s'il est là, sinon à la fin
  var journal = body.querySelector('.tl-coach');
  if (journal && journal.nextSibling) body.insertBefore(box, journal.nextSibling); else body.appendChild(box);

  sb.from('training_plans').select('*').eq('coach_id', currentUser.id).eq('player_id', playerId).eq('status', 'active').maybeSingle().then(function(res) {
    var plan = res && res.data;
    if (!plan) {
      box.innerHTML = '<div class="pd-section-title">Plan d\'entraînement</div>'
        + '<p class="tl-empty">Aucun plan en cours. Donne-lui un objectif par semaine et les exercices à faire : tu suivras sa progression ici.</p>'
        + '<button type="button" class="dash-btn dash-btn-gold cp-new">+ Donner un plan</button>';
      box.querySelector('.cp-new').addEventListener('click', function() {
        cpOpenEditor(playerId, null, function() { box.remove(); cpRenderCoachSection(body, playerId); });
      });
      return;
    }
    var since = cpStart(plan).toISOString();
    sb.from('training_log').select('*').eq('user_id', playerId).gte('done_at', since).order('done_at', { ascending: false }).limit(800).then(function(r2) {
      var entries = ((r2 && r2.data) || []).map(tlFromDb);
      var k = cpWeekNow(plan);
      var last = Math.max(0, Math.min(k, plan.weeks));
      var rows = '';
      for (var i = last; i >= 1; i--) {
        var w = cpWeek(plan, entries, i), rate = cpRate(plan, w);
        rows += '<div class="cp-wrow"><span class="cp-wn">S' + i + (i === k ? ' <small>en cours</small>' : '') + '</span>'
          + '<span class="cp-wv">' + w.sessions + '/' + plan.sessions_per_week + ' séances · ' + w.minutes + '/' + plan.minutes_per_week + ' min</span>'
          + '<span class="cp-dot cp-dot-' + (i === k && rate < 0.9 ? 'cur' : cpRateClass(rate)) + '"></span></div>';
      }
      var exTitles = (plan.exercises || []).map(function(id) { var ex = cpExercise(id); return ex ? ex.title : null; }).filter(Boolean);
      box.innerHTML = '<div class="pd-section-title">Plan d\'entraînement</div>'
        + '<div class="cp-csum"><strong>' + tlEsc(plan.title) + '</strong> · ' + (k < 1 ? 'commence bientôt' : (k > plan.weeks ? 'terminé' : 'semaine ' + k + '/' + plan.weeks))
        + '<br>Objectif : ' + plan.sessions_per_week + ' séances et ' + plan.minutes_per_week + ' min par semaine'
        + (exTitles.length ? '<br><span class="tl-row-s">' + exTitles.length + ' exercice' + (exTitles.length > 1 ? 's' : '') + ' : ' + tlEsc(exTitles.join(', ')) + '</span>' : '') + '</div>'
        + (rows ? '<div class="cp-weeks">' + rows + '</div>' : '')
        + '<div class="cp-cactions"><button type="button" class="dash-btn dash-btn-outline" data-cp="edit">Modifier</button>'
        + '<button type="button" class="dash-btn dash-btn-outline" data-cp="stop">Arrêter le plan</button></div>';
      box.addEventListener('click', function(e) {
        var b = e.target.closest('[data-cp]');
        if (!b) return;
        if (b.getAttribute('data-cp') === 'edit') cpOpenEditor(playerId, plan, function() { box.remove(); cpRenderCoachSection(body, playerId); });
        else if (confirm('Arrêter ce plan ? Le joueur ne le verra plus (son journal reste intact).')) {
          sb.from('training_plans').update({ status: 'archived', updated_at: new Date().toISOString() }).eq('id', plan.id).then(function(r3) {
            if (r3 && r3.error) { showToast('Erreur : ' + r3.error.message); return; }
            showToast('Plan arrêté');
            box.remove(); cpRenderCoachSection(body, playerId);
          });
        }
      });
    }, function() {});
  }, function() { box.innerHTML = '<p class="tl-empty">Plans indisponibles pour le moment.</p>'; });
}

/* Éditeur de plan (création / modification) */
function cpOpenEditor(playerId, plan, onSaved) {
  var old = document.getElementById('cp-editor');
  if (old) old.remove();
  var st = {
    title: plan ? plan.title : 'Plan d\'hiver',
    weeks: plan ? plan.weeks : 8,
    sessions: plan ? plan.sessions_per_week : 3,
    minutes: plan ? plan.minutes_per_week : 120,
    ex: plan ? (plan.exercises || []).slice() : [],
    message: plan ? (plan.message || '') : '',
    q: '', cat: 'winter'
  };
  var all = (typeof getAllExercises === 'function') ? getAllExercises() : [];
  var cats = [{ id: 'winter', l: '❄ Hiver' }, { id: 'mine', l: 'Mes exercices' }].concat(['Putting', 'Jeu court', 'Approche', 'Drive', 'Physique', 'Mental', 'Parcours'].map(function(c) { return { id: c, l: c }; }));
  var m = document.createElement('div');
  m.id = 'cp-editor';
  m.className = 'trn-modal';
  function listHtml() {
    var q = st.q.trim().toLowerCase();
    var list = all.filter(function(e) {
      if (q) return (e.title || '').toLowerCase().indexOf(q) !== -1;
      if (st.cat === 'winter') return e.winter;
      if (st.cat === 'mine') return !e.library;
      return e.category === st.cat;
    });
    if (!list.length) return '<p class="tl-empty">Aucun exercice ici' + (st.cat === 'mine' ? ' : crée les tiens dans Progresser → Entraînement.' : '.') + '</p>';
    return list.map(function(e) {
      var on = st.ex.indexOf(e.id) !== -1;
      return '<button type="button" class="cp-pick' + (on ? ' on' : '') + '" data-pick="' + tlEsc(e.id) + '"><span class="cp-ex-check">' + (on ? '✓' : '') + '</span>'
        + '<span class="cp-ex-t">' + tlEsc(e.title) + '<small>' + tlEsc(e.category || '') + (e.duration ? ' · ' + e.duration + ' min' : '') + '</small></span></button>';
    }).join('');
  }
  function render() {
    m.innerHTML = '<div class="trn-modal-card">'
      + '<div class="trn-modal-head"><div><div class="trn-modal-tag">Plan d\'entraînement</div><div class="trn-modal-title">' + (plan ? 'Modifier le plan' : 'Donner un plan') + '</div></div>'
      + '<button class="trn-modal-close" type="button" aria-label="Fermer">×</button></div>'
      + '<div class="trn-modal-body">'
      +   (plan ? '' : '<div class="trn-result-l">Partir d\'un modèle <span>(facultatif)</span></div><div class="tl-types">'
            + CP_TEMPLATES.map(function(t) { return '<button type="button" class="tl-type" data-tpl="' + t.id + '">' + tlEsc(t.title) + '</button>'; }).join('') + '</div>')
      +   '<div class="tl-f"><label class="trn-result-l" for="cp-title">Titre</label><input id="cp-title" class="trn-result-in cp-in" maxlength="80" value="' + tlEsc(st.title) + '"></div>'
      +   '<div class="cp-grid3">'
      +     '<div class="tl-f"><label class="trn-result-l" for="cp-weeks">Durée</label><select id="cp-weeks" class="trn-result-in cp-in">' + [2, 4, 6, 8, 10, 12, 16].map(function(n) { return '<option value="' + n + '"' + (n === st.weeks ? ' selected' : '') + '>' + n + ' sem.</option>'; }).join('') + '</select></div>'
      +     '<div class="tl-f"><label class="trn-result-l" for="cp-sess">Séances / sem.</label><select id="cp-sess" class="trn-result-in cp-in">' + [1, 2, 3, 4, 5, 6, 7].map(function(n) { return '<option value="' + n + '"' + (n === st.sessions ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></div>'
      +     '<div class="tl-f"><label class="trn-result-l" for="cp-min">Minutes / sem.</label><input id="cp-min" type="number" inputmode="numeric" min="0" max="1200" class="trn-result-in cp-in" value="' + st.minutes + '"></div>'
      +   '</div>'
      +   '<div class="trn-result-l cp-ex-head">Exercices à faire chaque semaine <span>(' + st.ex.length + '/12)</span></div>'
      +   (st.ex.length ? '<div class="cp-chosen">' + st.ex.map(function(id) { var e = cpExercise(id); return '<button type="button" class="cp-chip" data-unpick="' + tlEsc(id) + '">' + tlEsc(e ? e.title : id) + ' ×</button>'; }).join('') + '</div>' : '')
      +   '<input type="search" id="cp-q" class="trn-result-in cp-in cp-q" placeholder="Chercher un exercice…" value="' + tlEsc(st.q) + '">'
      +   '<div class="filter-row cp-cats">' + cats.map(function(c) { return '<button type="button" class="filter-btn' + (!st.q && st.cat === c.id ? ' on' : '') + '" data-cat="' + c.id + '">' + tlEsc(c.l) + '</button>'; }).join('') + '</div>'
      +   '<div class="cp-pick-list" id="cp-pick-list">' + listHtml() + '</div>'
      +   '<div class="tl-f"><label class="trn-result-l" for="cp-msg">Message au joueur <span>(facultatif)</span></label><textarea id="cp-msg" class="tl-note" maxlength="500" rows="2" placeholder="Ex. : on garde le contact tout l\'hiver, priorité au putting.">' + tlEsc(st.message) + '</textarea></div>'
      + '</div>'
      + '<div class="trn-modal-actions"><button class="dash-btn dash-btn-outline" type="button" data-x>Annuler</button>'
      + '<button class="dash-btn dash-btn-gold" type="button" data-save>' + (plan ? 'Enregistrer' : 'Envoyer le plan') + '</button></div></div>';
  }
  function readInputs() {
    var g = function(id) { return m.querySelector('#' + id); };
    if (g('cp-title')) st.title = g('cp-title').value;
    if (g('cp-weeks')) st.weeks = +g('cp-weeks').value;
    if (g('cp-sess')) st.sessions = +g('cp-sess').value;
    if (g('cp-min')) st.minutes = parseInt(g('cp-min').value, 10) || 0;
    if (g('cp-msg')) st.message = g('cp-msg').value;
  }
  render();
  document.body.appendChild(m);
  m.addEventListener('input', function(e) {
    if (e.target.id === 'cp-q') { st.q = e.target.value; m.querySelector('#cp-pick-list').innerHTML = listHtml(); }
  });
  m.addEventListener('click', function(e) {
    if (e.target === m || e.target.closest('.trn-modal-close') || e.target.closest('[data-x]')) { m.remove(); return; }
    var t;
    if ((t = e.target.closest('[data-tpl]'))) {
      readInputs();
      var tpl = CP_TEMPLATES.filter(function(x) { return x.id === t.getAttribute('data-tpl'); })[0];
      st.title = tpl.title; st.sessions = tpl.sessions; st.minutes = tpl.minutes;
      st.ex = tpl.ex.filter(function(id) { return !!cpExercise(id); });
      render(); return;
    }
    if ((t = e.target.closest('[data-pick]'))) {
      readInputs();
      var id = t.getAttribute('data-pick'), i = st.ex.indexOf(id);
      if (i !== -1) st.ex.splice(i, 1);
      else if (st.ex.length >= 12) { showToast('12 exercices maximum'); return; }
      else st.ex.push(id);
      var y = m.querySelector('.trn-modal-body').scrollTop;
      render(); m.querySelector('.trn-modal-body').scrollTop = y; return;
    }
    if ((t = e.target.closest('[data-unpick]'))) {
      readInputs();
      st.ex.splice(st.ex.indexOf(t.getAttribute('data-unpick')), 1);
      render(); return;
    }
    if ((t = e.target.closest('[data-cat]'))) {
      readInputs(); st.cat = t.getAttribute('data-cat'); st.q = ''; render(); return;
    }
    if (e.target.closest('[data-save]')) {
      readInputs();
      var title = st.title.trim();
      if (!title) { showToast('Donne un titre au plan'); return; }
      if (!st.ex.length && !confirm('Aucun exercice choisi : le plan ne fixera qu\'un objectif de séances et de minutes. Continuer ?')) return;
      var row = { title: title.slice(0, 80), weeks: st.weeks, sessions_per_week: st.sessions,
        minutes_per_week: Math.max(0, Math.min(1200, st.minutes)), exercises: st.ex.slice(0, 12),
        message: st.message.trim() ? st.message.trim().slice(0, 500) : null, updated_at: new Date().toISOString() };
      var btn = e.target.closest('[data-save]'); btn.disabled = true;
      var q = plan
        ? window.sbClient.from('training_plans').update(row).eq('id', plan.id)
        : window.sbClient.from('training_plans').insert(Object.assign({ coach_id: currentUser.id, player_id: playerId, start_date: cpYmd(tlMonday(new Date())) }, row));
      q.then(function(res) {
        if (res && res.error) { btn.disabled = false; showToast('Erreur : ' + res.error.message); return; }
        m.remove();
        showToast(plan ? 'Plan modifié ✓' : 'Plan envoyé ✓ Le joueur le verra dans Progresser');
        if (onSaved) onSaved();
      }, function() { btn.disabled = false; showToast('Pas de réseau — réessaie'); });
    }
  });
}

function cpYmd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

/* Cartes « Mes joueurs » : l'entraînement de la semaine sous chaque joueur */
function cpDecoratePlayerCards(grid, ids) {
  if (!grid || !ids || !ids.length || !window.sbClient) return;
  var sb = window.sbClient;
  var since = new Date(tlMonday(new Date()).getTime() - 21 * 86400000).toISOString();
  Promise.all([
    sb.from('training_log').select('user_id, done_at, duration_min').in('user_id', ids).gte('done_at', since).limit(2000),
    sb.from('training_plans').select('player_id, sessions_per_week, minutes_per_week, title').eq('coach_id', currentUser.id).eq('status', 'active')
  ]).then(function(r) {
    var logs = (r[0] && r[0].data) || [], plans = {};
    ((r[1] && r[1].data) || []).forEach(function(p) { plans[p.player_id] = p; });
    var mon = tlMonday(new Date()).getTime();
    ids.forEach(function(id) {
      var card = grid.querySelector('[data-pid="' + id + '"]');
      if (!card) return;
      var mine = logs.filter(function(l) { return l.user_id === id; });
      var wk = mine.filter(function(l) { return Date.parse(l.done_at) >= mon; });
      var min = wk.reduce(function(s, l) { return s + (l.duration_min || 0); }, 0);
      var lastT = mine.reduce(function(a, l) { return Math.max(a, Date.parse(l.done_at) || 0); }, 0);
      var p = plans[id];
      var cls = p ? cpRateClass(cpRate(p, { sessions: wk.length, minutes: min })) : (wk.length ? 'ok' : 'low');
      var lastTxt = lastT ? (function() { var d = Math.floor((Date.now() - lastT) / 86400000); return d === 0 ? 'aujourd\'hui' : (d === 1 ? 'hier' : 'il y a ' + d + ' j'); })() : 'aucune séance depuis 3 semaines';
      var div = document.createElement('div');
      div.className = 'cp-card-line';
      div.innerHTML = '<span class="cp-dot cp-dot-' + cls + '"></span><span><strong>Cette semaine :</strong> ' + wk.length + (p ? '/' + p.sessions_per_week : '') + ' séance' + (wk.length > 1 ? 's' : '') + ' · ' + min + (p ? '/' + p.minutes_per_week : '') + ' min'
        + '<br><small>Dernière séance : ' + lastTxt + (p ? ' · plan « ' + tlEsc(p.title) + ' »' : ' · pas de plan') + '</small></span>';
      var more = card.querySelector('.ch-player-more');
      if (more) card.insertBefore(div, more); else card.appendChild(div);
    });
  }, function() {});
}
