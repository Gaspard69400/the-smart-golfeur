/* ════════════════════════════════════════════
 * THE SMART GOLFER — myrounds.js
 * MES PARTIES (S82) : la liste de TOUTES ses cartes, pour en corriger une
 * (date, départ, score trou par trou ou total, putts) ou la supprimer.
 * Avant, l'historique de la Scorecard ne montrait que les 5 dernières, sans
 * aucun moyen de réparer une carte fausse — qui faussait l'index et les stats.
 *
 * Après une correction, tout ce qui dépend de la carte est recalculé :
 * score, différentiel (départ), greens en régulation (putts trou par trou),
 * points stableford, Strokes Gained. Synchro : tsgSync.pushRound / deleteRound.
 *
 * Dépend de : app.js (lsGet/lsSet, showToast, showPage), data.js (getAllCourses,
 * tsgRoundHolePars), scorecard.js (roundHistory, renderHistory), tees.js,
 * formats.js (stablefordRound), strokesgained.js (sgApplyToRound), auth.js (tsgSync).
 * ════════════════════════════════════════════ */

function mrEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function mrRounds() {
  var rs = (typeof roundHistory !== 'undefined' && roundHistory && roundHistory.length) ? roundHistory : (lsGet('rounds') || []);
  return rs.slice().sort(function(a, b) {
    var da = a.date || '', db = b.date || '';
    if (da !== db) return da < db ? 1 : -1;
    return Number(b.id) - Number(a.id);
  });
}

function mrDateFr(d) {
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || '');
  return m ? (m[3] + '/' + m[2] + '/' + m[1]) : (d || '—');
}

function mrHoleScores(r) {
  return Array.isArray(r.scores) && r.scores.some(function(v) { return v != null && v !== ''; });
}

function mrCourseOf(r) {
  var all = (typeof getAllCourses === 'function') ? getAllCourses() : [];
  var name = String(r.course || '').trim().toLowerCase(), byName = null;
  for (var i = 0; i < all.length; i++) {
    if (r.courseId && all[i].id === r.courseId) return all[i];
    if (!byName && name && String(all[i].name || '').trim().toLowerCase() === name) byName = all[i];
  }
  return byName;
}

/* Enregistre la liste (mémoire + appareil) */
function mrPersist(list) {
  if (typeof roundHistory !== 'undefined') {
    roundHistory.length = 0;
    list.forEach(function(r) { roundHistory.push(r); });
    lsSet('rounds', roundHistory);
  } else {
    lsSet('rounds', list);
  }
  if (typeof tsgAutoBackup === 'function') { try { tsgAutoBackup(true); } catch (e) {} }
}

/* Après un changement : historique, page courante (Accueil, stats…) */
function mrRefreshApp() {
  if (typeof renderHistory === 'function') { try { renderHistory(); } catch (e) {} }
  var cur = document.querySelector('.app-page.active');
  if (cur && typeof showPage === 'function') { try { showPage(cur.id.replace('page-', '')); } catch (e) {} }
  if (typeof updateNavUI === 'function') { try { updateNavUI(); } catch (e) {} }
}

/* ─── La liste ─── */
function mrOpen() {
  var old = document.getElementById('mr-modal');
  if (old) old.remove();
  var m = document.createElement('div');
  m.id = 'mr-modal';
  m.className = 'trn-modal mr-modal';
  m.innerHTML = '<div class="trn-modal-card mr-card">'
    + '<div class="trn-modal-head"><div><div class="trn-modal-tag">Historique</div>'
    +   '<div class="trn-modal-title">Mes parties</div></div>'
    +   '<button class="trn-modal-close" type="button" aria-label="Fermer">×</button></div>'
    + '<div class="trn-modal-body mr-body"></div></div>';
  document.body.appendChild(m);
  m.querySelector('.trn-modal-close').addEventListener('click', function() { m.remove(); });
  m.addEventListener('click', function(e) { if (e.target === m) m.remove(); });
  mrRenderList(m.querySelector('.mr-body'));
}

function mrRenderList(body) {
  var rs = mrRounds();
  if (!rs.length) {
    body.innerHTML = '<p class="inv-text">Aucune partie enregistrée pour l\'instant. Va dans <strong>Jouer</strong> pour entrer ta première carte.</p>';
    return;
  }
  body.innerHTML = '<p class="mr-intro">' + rs.length + ' partie' + (rs.length > 1 ? 's' : '') + '. Une carte fausse fausse aussi ton index et tes stats : corrige-la ou supprime-la.</p>'
    + '<div class="mr-list">' + rs.map(function(r) {
      var vs = (r.score && r.par) ? r.score - r.par : null;
      var main = r.points != null ? r.points + ' pts' : (r.score || '—');
      var sub = [mrDateFr(r.date), r.teeName ? 'départ ' + r.teeName : '', r.quickEntry ? 'score seul' : ''].filter(Boolean).join(' · ');
      return '<div class="mr-row" data-id="' + mrEsc(r.id) + '">'
        + '<div class="mr-row-main"><div class="mr-row-c">' + mrEsc(r.course || 'Parcours') + '</div><div class="mr-row-s">' + mrEsc(sub) + '</div></div>'
        + '<div class="mr-row-score"><strong>' + mrEsc(main) + '</strong>' + (vs !== null && r.points == null ? '<span>' + (vs > 0 ? '+' : '') + (vs === 0 ? 'par' : vs) + '</span>' : '') + '</div>'
        + '<div class="mr-row-btns"><button type="button" class="dash-btn dash-btn-outline" data-mr="edit">Modifier</button>'
        + '<button type="button" class="dash-btn dash-btn-outline mr-del" data-mr="del" aria-label="Supprimer cette partie">Supprimer</button></div>'
        + '</div>';
    }).join('') + '</div>';
  body.onclick = function(e) {
    var b = e.target.closest('[data-mr]');
    if (!b) return;
    var id = b.closest('.mr-row').getAttribute('data-id');
    var r = mrRounds().filter(function(x) { return String(x.id) === id; })[0];
    if (!r) return;
    if (b.getAttribute('data-mr') === 'del') mrDelete(r, body);
    else mrEdit(r, body);
  };
}

/* ─── Supprimer ─── */
function mrDelete(r, listBody) {
  var label = (r.course || 'cette partie') + ' du ' + mrDateFr(r.date) + (r.score ? ' (' + r.score + ')' : '');
  if (!confirm('Supprimer ' + label + ' ?\n\nElle disparaît de ton historique, de ton index et de tes stats. C\'est définitif.')) return;
  var list = mrRounds().filter(function(x) { return String(x.id) !== String(r.id); });
  mrPersist(list);
  if (window.tsgSync && window.tsgSync.deleteRound) window.tsgSync.deleteRound(r.id);
  showToast('Partie supprimée');
  if (listBody) mrRenderList(listBody);
  mrRefreshApp();
}

/* ─── Modifier ─── */
function mrEdit(r, listBody) {
  var course = mrCourseOf(r);
  var pars = (typeof tsgRoundHolePars === 'function' ? tsgRoundHolePars(r) : null) || (course ? course.trous.map(function(h) { return h.par; }) : null);
  var byHole = mrHoleScores(r) && pars;
  var tees = (course && typeof getCourseTees === 'function') ? getCourseTees(course) : [];

  var teeHtml = tees.length
    ? '<div class="qt-field"><label class="qt-l" for="mr-tee">Départ</label><select class="qt-i" id="mr-tee">'
      + tees.map(function(t) { return '<option value="' + mrEsc(t.id) + '"' + (t.id === r.teeId ? ' selected' : '') + '>' + mrEsc(t.name + (t.rating ? ' · SSS ' + Number(t.rating).toFixed(1) : '')) + '</option>'; }).join('')
      + '</select></div>'
    : '';

  var scoreHtml;
  if (byHole) {
    var n = Math.min(r.scores.length, pars.length);
    var cells = '';
    for (var i = 0; i < n; i++) {
      cells += '<label class="mr-hole"><span>' + (i + 1) + '<small>par ' + pars[i] + '</small></span>'
        + '<input type="number" inputmode="numeric" min="1" max="15" data-hole="' + i + '" value="' + (r.scores[i] != null ? r.scores[i] : '') + '" aria-label="Score au trou ' + (i + 1) + '"></label>';
    }
    scoreHtml = '<div class="qt-l">Score trou par trou</div><div class="mr-holes">' + cells + '</div>'
      + '<div class="mr-total">Total : <strong id="mr-sum">' + (r.score || '—') + '</strong></div>';
  } else {
    scoreHtml = '<div class="qt-field"><label class="qt-l" for="mr-score">Score total</label>'
      + '<input class="qt-i" id="mr-score" type="number" inputmode="numeric" min="30" max="200" value="' + (r.score || '') + '"></div>';
  }
  var hasPuttsByHole = Array.isArray(r.puttsByHole) && r.puttsByHole.some(function(v) { return v != null; });
  var puttsHtml = hasPuttsByHole ? '' : '<div class="qt-field"><label class="qt-l" for="mr-putts">Putts (total)</label>'
    + '<input class="qt-i" id="mr-putts" type="number" inputmode="numeric" min="0" max="80" value="' + (r.putts != null ? r.putts : '') + '"></div>';

  var m = document.createElement('div');
  m.id = 'mr-edit';
  m.className = 'trn-modal mr-modal';
  m.innerHTML = '<div class="trn-modal-card mr-card">'
    + '<div class="trn-modal-head"><div><div class="trn-modal-tag">Corriger une carte</div>'
    +   '<div class="trn-modal-title">' + mrEsc(r.course || 'Partie') + '</div></div>'
    +   '<button class="trn-modal-close" type="button" aria-label="Fermer">×</button></div>'
    + '<div class="trn-modal-body">'
    +   '<div class="mr-form-row"><div class="qt-field"><label class="qt-l" for="mr-date">Date</label><input class="qt-i" id="mr-date" type="date" value="' + mrEsc(r.date || '') + '"></div>' + teeHtml + '</div>'
    +   scoreHtml + puttsHtml
    +   (course ? '' : '<p class="mr-warn">Ce parcours n\'est plus dans ta liste : le départ ne peut pas être changé.</p>')
    +   '<div class="mr-actions"><button type="button" class="dash-btn dash-btn-outline" id="mr-cancel">Annuler</button>'
    +   '<button type="button" class="btn-start-round" id="mr-save">Enregistrer la correction</button></div>'
    + '</div></div>';
  document.body.appendChild(m);
  function close() { m.remove(); }
  m.querySelector('.trn-modal-close').addEventListener('click', close);
  m.querySelector('#mr-cancel').addEventListener('click', close);
  m.addEventListener('click', function(e) { if (e.target === m) close(); });

  var sumEl = m.querySelector('#mr-sum');
  if (sumEl) m.querySelector('.mr-holes').addEventListener('input', function() {
    var t = 0, c = 0;
    m.querySelectorAll('[data-hole]').forEach(function(inp) { var v = parseInt(inp.value, 10); if (v > 0) { t += v; c++; } });
    sumEl.textContent = c ? t : '—';
  });

  m.querySelector('#mr-save').addEventListener('click', function() {
    var upd = JSON.parse(JSON.stringify(r));
    var d = m.querySelector('#mr-date').value;
    if (d) upd.date = d;

    if (byHole) {
      var sc = upd.scores.slice(), bad = false;
      m.querySelectorAll('[data-hole]').forEach(function(inp) {
        var i = +inp.getAttribute('data-hole'), v = inp.value === '' ? null : parseInt(inp.value, 10);
        if (v !== null && (isNaN(v) || v < 1 || v > 15)) bad = true;
        sc[i] = v;
      });
      if (bad) { showToast('Un score par trou doit être entre 1 et 15'); return; }
      upd.scores = sc;
      upd.score = sc.reduce(function(a, v) { return a + (v || 0); }, 0);
      if (!upd.score) { showToast('La carte est vide'); return; }
    } else {
      var tot = parseInt(m.querySelector('#mr-score').value, 10);
      if (!tot || tot < 30 || tot > 200) { showToast('Renseigne un score total valable'); return; }
      upd.score = tot;
    }
    var pIn = m.querySelector('#mr-putts');
    if (pIn) { var pv = parseInt(pIn.value, 10); upd.putts = isNaN(pv) ? null : pv; }

    // Départ choisi
    var tee = null;
    var tSel = m.querySelector('#mr-tee');
    if (tSel && course && typeof findTee === 'function') tee = findTee(course, tSel.value);
    if (tee) { upd.teeId = tee.id; upd.teeName = tee.name; upd.teeRating = tee.rating; upd.teeSlope = tee.slope; }

    mrRecompute(upd, course, tee, pars);

    var list = mrRounds().map(function(x) { return String(x.id) === String(r.id) ? upd : x; });
    mrPersist(list);
    if (window.tsgSync) window.tsgSync.pushRound(upd);
    close();
    showToast('Partie corrigée ✓');
    if (listBody) mrRenderList(listBody);
    mrRefreshApp();
  });
}

/* Recalcule tout ce qui dépend de la carte */
function mrRecompute(r, course, tee, pars) {
  var rating = r.teeRating || (course && (course.rating || course.sss));
  var slope = r.teeSlope || (course && course.slope) || 113;
  if (rating && r.score) r.diff = parseFloat(((r.score - rating) * 113 / slope).toFixed(1));

  // Greens en régulation : score − putts ≤ par − 2, trou par trou, quand les putts sont connus
  if (pars && Array.isArray(r.scores) && Array.isArray(r.puttsByHole)) {
    var gb = r.scores.map(function(s, i) {
      var p = r.puttsByHole[i];
      if (s == null || p == null || !pars[i]) return null;
      return (s - p) <= (pars[i] - 2) ? 1 : 0;
    });
    if (gb.some(function(v) { return v !== null; })) {
      r.girByHole = gb;
      r.gir = gb.reduce(function(a, v) { return a + (v || 0); }, 0);
    }
    var pt = r.puttsByHole.reduce(function(a, v) { return a + (v || 0); }, 0);
    if (pt) r.putts = pt;
  }

  // Stableford
  if (r.format === 'stableford' && course && typeof stablefordRound === 'function' && Array.isArray(r.scores)) {
    try {
      var st = stablefordRound(course, r.scores, r.hcp, tee || (typeof roundTee === 'function' ? roundTee(r, course) : null));
      if (st) { r.points = st.points; r.courseHcp = st.ch; r.pointsByHole = st.byHole.map(function(h) { return h ? h.points : null; }); }
    } catch (e) {}
  }

  // Strokes Gained
  r.sg_tee = r.sg_app = r.sg_arg = r.sg_putt = null;
  if (typeof sgApplyToRound === 'function') { try { sgApplyToRound(r); } catch (e) {} }
  r.editedAt = new Date().toISOString();
}

/* Bouton « Toutes mes parties » sous l'historique de la Scorecard (délégation : la page est reconstruite) */
document.addEventListener('click', function(e) {
  if (e.target.closest && e.target.closest('.mr-open-btn')) mrOpen();
});
