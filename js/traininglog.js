/* ════════════════════════════════════════════
 * THE SMART GOLFER — traininglog.js
 * JOURNAL D'ENTRAÎNEMENT EN LIGNE (S86) — base de l'offre d'hiver.
 *
 * Avant : `tsg_trainingLog` restait sur le téléphone ({id: exercice, category,
 * date, score, max}). Le coach ne voyait rien, un changement de téléphone
 * effaçait tout. Désormais chaque séance a un identifiant propre (`lid`),
 * des champs en plus (durée, ressenti 1-5, note, titre, source) et part dans
 * la table `training_log` (backend/maj_journal.sql) : visible sur tous ses
 * appareils, et par son coach (lecture seule).
 *
 * Le format local reste compatible avec ce qui le lit déjà (défis, série,
 * trophées du mois, programme, courbe de progression : id / category / date /
 * score / max) — on n'ajoute que des champs.
 *
 * Dépend de : app.js (lsGet/lsSet, showToast), auth.js (sbUserId, tsgCloud),
 * training.js (getAllExercises), challenges.js (chCheck).
 * ════════════════════════════════════════════ */

/* Séances libres : ce qui n'est pas un exercice de la bibliothèque */
var TL_FREE_TYPES = [
  { id: 'free-practice', title: 'Practice — jeu long',      category: 'Drive' },
  { id: 'free-approche', title: 'Approches et fers',          category: 'Approche' },
  { id: 'free-petitjeu', title: 'Petit jeu (chips, bunker)',  category: 'Jeu court' },
  { id: 'free-putting',  title: 'Putting',                    category: 'Putting' },
  { id: 'free-parcours', title: 'Parcours / partie d\'entraînement', category: 'Parcours' },
  { id: 'free-simu',     title: 'Simulateur',                 category: 'Parcours' },
  { id: 'free-physique', title: 'Préparation physique',       category: 'Physique' },
  { id: 'free-mental',   title: 'Mental, visualisation',      category: 'Mental' },
  { id: 'free-cours',    title: 'Cours avec mon coach',       category: 'Parcours' }
];

var TL_FEELINGS = [
  { v: 1, l: 'Dur' }, { v: 2, l: 'Moyen' }, { v: 3, l: 'Correct' }, { v: 4, l: 'Bien' }, { v: 5, l: 'Excellent' }
];

function tlEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function tlCloud() {
  return !!(window.tsgCloud && window.sbClient && typeof sbUserId === 'function' && sbUserId());
}

/* Identifiant d'une séance. Pour les anciennes entrées (sans lid) il est déduit
   de la date + de l'exercice : deux appareils produisent le même → pas de doublon. */
function tlNewId() {
  return 'tl-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}
function tlLegacyId(e) {
  var t = Date.parse(e.date || '') || 0;
  return ('tl-' + t.toString(36) + '-' + String(e.id || 'x').replace(/[^A-Za-z0-9_-]/g, '')).slice(0, 60);
}

function tlTitleOf(exId) {
  for (var i = 0; i < TL_FREE_TYPES.length; i++) if (TL_FREE_TYPES[i].id === exId) return TL_FREE_TYPES[i].title;
  try {
    var all = (typeof getAllExercises === 'function') ? getAllExercises() : [];
    for (var j = 0; j < all.length; j++) if (all[j].id === exId) return all[j].title;
  } catch (e) {}
  return null;
}

/* Liste locale, chaque entrée garantie avec un lid */
function tlAll() {
  var log = lsGet('trainingLog') || [], changed = false;
  log.forEach(function(e) { if (!e.lid) { e.lid = tlLegacyId(e); changed = true; } });
  if (changed) lsSet('trainingLog', log);
  return log;
}
function tlSaveAll(log) {
  log.sort(function(a, b) { return (Date.parse(a.date) || 0) - (Date.parse(b.date) || 0); });
  if (log.length > 1500) log = log.slice(-1500);
  lsSet('trainingLog', log);
}

/* ─── Écriture ─── */

/* Ajoute une séance (exercice de la bibliothèque, séance libre…) et l'envoie */
function tlAdd(entry) {
  var e = {
    lid: tlNewId(),
    id: entry.id || null,
    title: entry.title || tlTitleOf(entry.id) || null,
    category: entry.category || null,
    date: entry.date || new Date().toISOString(),
    duration: entry.duration != null && !isNaN(entry.duration) ? Math.max(0, Math.min(600, Math.round(entry.duration))) : null,
    feeling: entry.feeling ? Math.max(1, Math.min(5, Math.round(entry.feeling))) : null,
    note: entry.note ? String(entry.note).slice(0, 500) : null,
    src: entry.src || null
  };
  if (entry.score !== null && entry.score !== undefined && !isNaN(entry.score)) {
    e.score = Number(entry.score);
    if (entry.max) e.max = Number(entry.max);
  }
  var log = tlAll();
  log.push(e);
  tlSaveAll(log);
  tlPush(e);
  return e;
}

function tlDelete(lid) {
  var log = tlAll().filter(function(e) { return e.lid !== lid; });
  tlSaveAll(log);
  var dead = lsGet('trainingLogDeleted') || [];
  if (dead.indexOf(lid) === -1) { dead.push(lid); lsSet('trainingLogDeleted', dead); }
  if (tlCloud()) {
    window.sbClient.from('training_log').delete().eq('id', lid).then(function(res) {
      if (res && !res.error) lsSet('trainingLogDeleted', (lsGet('trainingLogDeleted') || []).filter(function(x) { return x !== lid; }));
    }, function() {});
  }
}

function tlToDb(e) {
  return {
    id: e.lid, user_id: sbUserId(), done_at: e.date,
    exercise_id: e.id ? String(e.id).slice(0, 80) : null,
    exercise_title: e.title ? String(e.title).slice(0, 120) : null,
    category: e.category ? String(e.category).slice(0, 40) : null,
    duration_min: e.duration != null ? e.duration : null,
    score: e.score != null ? e.score : null,
    max_score: e.max != null ? e.max : null,
    feeling: e.feeling || null,
    note: e.note || null,
    source: e.src ? String(e.src).slice(0, 20) : null,
    updated_at: new Date().toISOString()
  };
}
function tlFromDb(r) {
  var e = { lid: r.id, id: r.exercise_id, title: r.exercise_title, category: r.category, date: r.done_at,
    duration: r.duration_min, feeling: r.feeling, note: r.note, src: r.source, synced: true };
  if (r.score != null) e.score = Number(r.score);
  if (r.max_score != null) e.max = Number(r.max_score);
  return e;
}

var _tlMissing = false;   // table absente côté serveur : on n'insiste pas
function tlPush(e) {
  if (!tlCloud() || _tlMissing) return;
  window.sbClient.from('training_log').upsert(tlToDb(e)).then(function(res) {
    if (res && res.error) {
      if (/training_log|does not exist|relation/i.test(res.error.message || '')) _tlMissing = true;
      return;
    }
    var log = tlAll();
    for (var i = 0; i < log.length; i++) if (log[i].lid === e.lid) { log[i].synced = true; break; }
    tlSaveAll(log);
  }, function() {});
}

/* Au lancement (compte connecté) : récupère les séances des autres appareils,
   envoie celles qui ne sont pas encore parties (dont tout l'historique d'avant S86). */
function tlSync(done) {
  if (!tlCloud()) { if (done) done(); return; }
  window.sbClient.from('training_log').select('*').order('done_at', { ascending: false }).limit(1500).then(function(res) {
    if (res.error) {
      if (/training_log|does not exist|relation/i.test(res.error.message || '')) _tlMissing = true;
      if (done) done(); return;
    }
    var uid = sbUserId();
    var mine = (res.data || []).filter(function(r) { return r.user_id === uid; });
    var dead = lsGet('trainingLogDeleted') || [];
    var log = tlAll(), byLid = {};
    log.forEach(function(e) { byLid[e.lid] = e; });
    var inCloud = {};
    mine.forEach(function(r) {
      inCloud[r.id] = true;
      if (dead.indexOf(r.id) !== -1) {          // supprimée ici, pas encore côté serveur
        window.sbClient.from('training_log').delete().eq('id', r.id).then(function() {}, function() {});
        return;
      }
      if (!byLid[r.id]) { var n = tlFromDb(r); log.push(n); byLid[r.id] = n; }
      else byLid[r.id].synced = true;
    });
    tlSaveAll(log);
    // Envoi de ce qui manque côté serveur (par paquets)
    var toSend = log.filter(function(e) { return !inCloud[e.lid]; });
    for (var i = 0; i < toSend.length; i += 100) {
      (function(chunk) {
        window.sbClient.from('training_log').upsert(chunk.map(tlToDb)).then(function(r2) {
          if (r2 && !r2.error) {
            var l2 = tlAll(), ids = {};
            chunk.forEach(function(c) { ids[c.lid] = true; });
            l2.forEach(function(e) { if (ids[e.lid]) e.synced = true; });
            tlSaveAll(l2);
          }
        }, function() {});
      })(toSend.slice(i, i + 100));
    }
    if (done) done();
  }, function() { if (done) done(); });
}

/* ─── Lecture / résumés ─── */

function tlMonday(d) {
  var x = new Date(d); x.setHours(0, 0, 0, 0);
  var day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day);
  return x;
}

/* Résumé d'une liste d'entrées sur la semaine en cours */
function tlWeekStats(list) {
  var mon = tlMonday(new Date()).getTime();
  var wk = list.filter(function(e) { return (Date.parse(e.date) || 0) >= mon; });
  var minutes = wk.reduce(function(a, e) { return a + (e.duration || 0); }, 0);
  var days = {};
  wk.forEach(function(e) { var d = new Date(e.date); days[d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate()] = 1; });
  var cats = {};
  wk.forEach(function(e) { if (e.category) cats[e.category] = (cats[e.category] || 0) + 1; });
  return { sessions: wk.length, minutes: minutes, days: Object.keys(days).length, cats: cats };
}

function tlDateFr(iso) {
  var d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var dd = new Date(d); dd.setHours(0, 0, 0, 0);
  var diff = Math.round((today - dd) / 86400000);
  if (diff === 0) return 'aujourd\'hui';
  if (diff === 1) return 'hier';
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

function tlFeelLabel(v) { for (var i = 0; i < TL_FEELINGS.length; i++) if (TL_FEELINGS[i].v === v) return TL_FEELINGS[i].l; return ''; }

/* Une ligne de journal (joueur ou coach) */
function tlRowHtml(e, canDelete) {
  var bits = [];
  if (e.duration) bits.push(e.duration + ' min');
  if (e.score != null) bits.push(e.score + (e.max ? '/' + e.max : ''));
  if (e.feeling) bits.push('ressenti : ' + tlFeelLabel(e.feeling).toLowerCase());
  return '<div class="tl-row">'
    + '<div class="tl-row-main"><div class="tl-row-t">' + tlEsc(e.title || tlTitleOf(e.id) || 'Séance') + '</div>'
    + '<div class="tl-row-s">' + tlEsc(tlDateFr(e.date)) + (e.category ? ' · ' + tlEsc(e.category) : '') + (bits.length ? ' · ' + tlEsc(bits.join(' · ')) : '') + '</div>'
    + (e.note ? '<div class="tl-row-note">« ' + tlEsc(e.note) + ' »</div>' : '') + '</div>'
    + (e.feeling ? '<span class="tl-feel tl-feel-' + e.feeling + '" aria-hidden="true"></span>' : '')
    + (canDelete ? '<button type="button" class="tl-del" data-tl-del="' + tlEsc(e.lid) + '" aria-label="Supprimer cette séance">×</button>' : '')
    + '</div>';
}

/* ─── Panneau « Mon journal » (onglet Entraînement) ─── */

function tlRenderPanel(host) {
  if (!host) return;
  var log = tlAll().slice().reverse();
  var w = tlWeekStats(log);
  var catHtml = Object.keys(w.cats).map(function(c) { return '<span class="tl-cat">' + tlEsc(c) + ' · ' + w.cats[c] + '</span>'; }).join('');
  host.innerHTML = '<div class="panel tl-panel">'
    + '<div class="panel-header"><div><div class="panel-title">Mon journal d\'entraînement</div>'
    + '<div class="panel-sub">' + (tlCloud() ? 'Enregistré dans ton compte · visible par ton coach' : 'Sur cet appareil (crée un compte pour le garder et le partager avec ton coach)') + '</div></div></div>'
    + '<div class="panel-body">'
    +   '<div class="tl-week">'
    +     '<div><span>' + w.sessions + '</span>séance' + (w.sessions > 1 ? 's' : '') + ' cette semaine</div>'
    +     '<div><span>' + (w.minutes >= 60 ? Math.floor(w.minutes / 60) + ' h ' + String(w.minutes % 60).padStart(2, '0') : w.minutes + ' min') + '</span>d\'entraînement</div>'
    +     '<div><span>' + w.days + '</span>jour' + (w.days > 1 ? 's' : '') + ' actif' + (w.days > 1 ? 's' : '') + '</div>'
    +   '</div>'
    +   (catHtml ? '<div class="tl-cats">' + catHtml + '</div>' : '')
    +   '<button type="button" class="btn-start-round tl-add-btn" data-tl="add">+ Noter une séance</button>'
    +   (log.length
          ? '<div class="tl-list">' + log.slice(0, 5).map(function(e) { return tlRowHtml(e, false); }).join('') + '</div>'
            + (log.length > 5 ? '<button type="button" class="tl-all-btn" data-tl="all">Tout mon journal (' + log.length + ' séances)</button>' : '')
          : '<p class="tl-empty">Aucune séance notée pour l\'instant. Fais un exercice de la bibliothèque, ou note ta séance de practice, de salle ou de simulateur.</p>')
    + '</div></div>';
  host.onclick = function(e) {
    var b = e.target.closest('[data-tl]');
    if (!b) return;
    if (b.getAttribute('data-tl') === 'add') tlOpenFree(function() { tlRenderPanel(host); });
    else tlOpenAll(function() { tlRenderPanel(host); });
  };
}

/* Champs communs « durée / ressenti / note » (aussi utilisés dans la fiche d'un exercice) */
function tlExtraFieldsHtml(defMin) {
  return '<div class="tl-fields">'
    + '<div class="tl-f"><label class="trn-result-l" for="tl-dur">Durée</label>'
    +   '<div class="tl-dur-row"><input type="number" inputmode="numeric" min="0" max="600" id="tl-dur" class="trn-result-in" value="' + (defMin != null ? defMin : '') + '" placeholder="—"><span>min</span></div></div>'
    + '<div class="tl-f"><div class="trn-result-l">Ressenti</div><div class="tl-feels" role="radiogroup" aria-label="Ressenti">'
    +   TL_FEELINGS.map(function(f) { return '<button type="button" class="tl-feel-b" role="radio" aria-checked="false" data-feel="' + f.v + '">' + f.l + '</button>'; }).join('')
    + '</div></div>'
    + '<div class="tl-f"><label class="trn-result-l" for="tl-note">Note <span>(facultatif)</span></label>'
    +   '<textarea id="tl-note" class="tl-note" maxlength="500" rows="2" placeholder="Ce qui a marché, ce qui coince…"></textarea></div>'
    + '</div>';
}

/* Brancher les champs et lire leurs valeurs */
function tlWireExtra(root) {
  var picked = null;
  root.querySelectorAll('.tl-feel-b').forEach(function(b) {
    b.addEventListener('click', function() {
      var v = +b.getAttribute('data-feel');
      picked = (picked === v) ? null : v;
      root.querySelectorAll('.tl-feel-b').forEach(function(x) {
        var on = +x.getAttribute('data-feel') === picked;
        x.classList.toggle('on', on); x.setAttribute('aria-checked', on);
      });
    });
  });
  return function read() {
    var d = root.querySelector('#tl-dur'), n = root.querySelector('#tl-note');
    var dv = d && d.value !== '' ? parseInt(d.value, 10) : null;
    return { duration: (dv != null && !isNaN(dv)) ? dv : null, feeling: picked, note: n && n.value.trim() ? n.value.trim() : null };
  };
}

/* ─── Séance libre ─── */
function tlOpenFree(onSaved) {
  var old = document.getElementById('tl-free');
  if (old) old.remove();
  var today = new Date(), iso = function(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  var m = document.createElement('div');
  m.id = 'tl-free';
  m.className = 'trn-modal';
  m.innerHTML = '<div class="trn-modal-card">'
    + '<div class="trn-modal-head"><div><div class="trn-modal-tag">Journal</div><div class="trn-modal-title">Noter une séance</div></div>'
    + '<button class="trn-modal-close" type="button" aria-label="Fermer">×</button></div>'
    + '<div class="trn-modal-body">'
    +   '<div class="trn-result-l">Qu\'as-tu travaillé ?</div>'
    +   '<div class="tl-types">' + TL_FREE_TYPES.map(function(t, i) { return '<button type="button" class="tl-type' + (i === 0 ? ' on' : '') + '" data-type="' + t.id + '">' + tlEsc(t.title) + '</button>'; }).join('') + '</div>'
    +   '<div class="tl-f"><label class="trn-result-l" for="tl-date">Quand ?</label><input type="date" id="tl-date" class="trn-result-in tl-date" value="' + iso(today) + '" max="' + iso(today) + '"></div>'
    +   tlExtraFieldsHtml(60)
    + '</div>'
    + '<div class="trn-modal-actions"><button class="dash-btn dash-btn-outline" type="button" data-x>Annuler</button>'
    + '<button class="dash-btn dash-btn-gold" type="button" data-save>Enregistrer la séance</button></div></div>';
  document.body.appendChild(m);
  function close() { m.remove(); }
  m.querySelector('.trn-modal-close').addEventListener('click', close);
  m.querySelector('[data-x]').addEventListener('click', close);
  m.addEventListener('click', function(e) { if (e.target === m) close(); });
  var type = TL_FREE_TYPES[0];
  m.querySelectorAll('.tl-type').forEach(function(b) {
    b.addEventListener('click', function() {
      m.querySelectorAll('.tl-type').forEach(function(x) { x.classList.remove('on'); });
      b.classList.add('on');
      type = TL_FREE_TYPES.filter(function(t) { return t.id === b.getAttribute('data-type'); })[0];
    });
  });
  var read = tlWireExtra(m);
  m.querySelector('[data-save]').addEventListener('click', function() {
    var x = read();
    if (!x.duration) { showToast('Indique la durée de ta séance'); var d = m.querySelector('#tl-dur'); if (d) d.focus(); return; }
    var dv = m.querySelector('#tl-date').value;
    var when = new Date();
    if (dv && dv !== iso(today)) { var p = dv.split('-'); when = new Date(+p[0], +p[1] - 1, +p[2], 18, 0, 0); }
    tlAdd({ id: type.id, title: type.title, category: type.category, date: when.toISOString(),
      duration: x.duration, feeling: x.feeling, note: x.note, src: 'free' });
    if (typeof chCheck === 'function') { try { chCheck(true); } catch (e) {} }
    close();
    showToast('Séance enregistrée ✓ ' + x.duration + ' min');
    if (onSaved) onSaved();
  });
}

/* ─── Tout le journal ─── */
function tlOpenAll(onChange) {
  var old = document.getElementById('tl-all');
  if (old) old.remove();
  var m = document.createElement('div');
  m.id = 'tl-all';
  m.className = 'trn-modal';
  function render() {
    var log = tlAll().slice().reverse();
    m.innerHTML = '<div class="trn-modal-card">'
      + '<div class="trn-modal-head"><div><div class="trn-modal-tag">Journal</div><div class="trn-modal-title">Toutes mes séances</div></div>'
      + '<button class="trn-modal-close" type="button" aria-label="Fermer">×</button></div>'
      + '<div class="trn-modal-body"><div class="tl-list">' + (log.map(function(e) { return tlRowHtml(e, true); }).join('') || '<p class="tl-empty">Aucune séance.</p>') + '</div></div></div>';
    m.querySelector('.trn-modal-close').addEventListener('click', function() { m.remove(); if (onChange) onChange(); });
  }
  m.addEventListener('click', function(e) {
    if (e.target === m) { m.remove(); if (onChange) onChange(); return; }
    var d = e.target.closest('[data-tl-del]');
    if (d && confirm('Supprimer cette séance du journal ?')) { tlDelete(d.getAttribute('data-tl-del')); render(); }
  });
  document.body.appendChild(m);
  render();
}

/* ─── Côté coach : le journal d'un joueur dans sa fiche ─── */
function tlRenderForCoach(host, playerId) {
  if (!host || !window.sbClient) return;
  var since = new Date(Date.now() - 56 * 86400000).toISOString();
  var box = document.createElement('div');
  box.className = 'tl-coach';
  box.innerHTML = '<div class="pd-section-title">Journal d\'entraînement</div><div class="ch-loading">Chargement…</div>';
  host.appendChild(box);
  window.sbClient.from('training_log').select('*').eq('user_id', playerId).gte('done_at', since).order('done_at', { ascending: false }).limit(200).then(function(res) {
    if (res.error) { box.querySelector('.ch-loading').outerHTML = '<p class="tl-empty">Journal indisponible pour le moment.</p>'; return; }
    var list = (res.data || []).map(tlFromDb);
    if (!list.length) { box.querySelector('.ch-loading').outerHTML = '<p class="tl-empty">Aucune séance notée ces 8 dernières semaines.</p>'; return; }
    // 4 dernières semaines : séances et minutes par semaine
    var mon = tlMonday(new Date()).getTime(), weeks = [];
    for (var k = 0; k < 4; k++) {
      var a = mon - k * 7 * 86400000, b = a + 7 * 86400000;
      var wl = list.filter(function(e) { var t = Date.parse(e.date); return t >= a && t < b; });
      weeks.push({ label: k === 0 ? 'Cette sem.' : (k === 1 ? 'Sem. dernière' : 'Il y a ' + k + ' sem.'), n: wl.length, min: wl.reduce(function(s, e) { return s + (e.duration || 0); }, 0) });
    }
    var cats = {};
    list.forEach(function(e) { if (e.category) cats[e.category] = (cats[e.category] || 0) + (e.duration || 0); });
    var catTxt = Object.keys(cats).sort(function(x, y) { return cats[y] - cats[x]; }).map(function(c) { return c + ' ' + cats[c] + ' min'; }).join(' · ');
    box.querySelector('.ch-loading').outerHTML = '<div class="tl-coach-weeks">' + weeks.map(function(w) {
      return '<div><span>' + w.n + '</span>' + tlEsc(w.label) + '<small>' + w.min + ' min</small></div>';
    }).join('') + '</div>'
      + (catTxt ? '<div class="tl-row-s" style="margin:6px 0 8px">8 semaines : ' + tlEsc(catTxt) + '</div>' : '')
      + '<div class="tl-list">' + list.slice(0, 10).map(function(e) { return tlRowHtml(e, false); }).join('') + '</div>';
  }, function() {});
}
