/* ════════════════════════════════════════════
 * THE SMART GOLFER — tees.js
 * CHOIX DES DÉPARTS (repères).
 *
 * Avant : le menu « Départ » de la Scorecard était décoratif — 4 options en
 * dur, jamais lues, sans rating ni slope. Or chaque départ a SON rating et
 * SON slope : jouer 88 des blancs n'est pas jouer 88 des rouges. Le
 * différentiel et les Strokes Gained en dépendent directement.
 *
 * Modèle : `course.departs = [{ id, name, rating, slope, longueur }]`.
 * Les parcours sans `departs` (tout l'historique) continuent de marcher :
 * on fabrique un départ unique depuis course.rating / slope / longueur_totale.
 *
 * Dépend de : app.js (lsGet/lsSet).
 * ════════════════════════════════════════════ */

/* Repères français usuels */
var TEE_PRESETS = [
  { id: 'blanc', name: 'Blanc', dot: '#F5F1E6', ring: '#B9AE93' },
  { id: 'jaune', name: 'Jaune', dot: '#EFC93D', ring: '#C29B10' },
  { id: 'bleu',  name: 'Bleu',  dot: '#5B8DEF', ring: '#3C6BC0' },
  { id: 'rouge', name: 'Rouge', dot: '#D9534F', ring: '#A93B37' }
];

function teeMeta(id) {
  for (var i = 0; i < TEE_PRESETS.length; i++) {
    if (TEE_PRESETS[i].id === id) return TEE_PRESETS[i];
  }
  return { id: id || 'default', name: 'Départ', dot: '#C9A84C', ring: '#A8851E' };
}

/* Toujours au moins un départ, même pour les parcours historiques */
function getCourseTees(course) {
  if (!course) return [];
  if (Array.isArray(course.departs) && course.departs.length) {
    return course.departs.filter(function(t) { return t && t.rating && t.slope; });
  }
  return [{
    id: 'default',
    name: 'Départ principal',
    rating: course.rating || course.sss || null,
    slope: course.slope || 113,
    longueur: course.longueur_totale || null
  }];
}

function findTee(course, id) {
  var tees = getCourseTees(course);
  for (var i = 0; i < tees.length; i++) { if (tees[i].id === id) return tees[i]; }
  return tees[0] || null;
}

/* Le départ retenu pour une partie : d'abord ce qui est enregistré dessus,
   sinon le départ principal du parcours. */
function roundTee(round, course) {
  if (round && round.teeRating && round.teeSlope) {
    return { id: round.teeId || 'default', name: round.teeName || 'Départ',
             rating: round.teeRating, slope: round.teeSlope };
  }
  return getCourseTees(course)[0] || null;
}

/* Dernier départ choisi sur ce parcours (mémorisé d'une partie à l'autre) */
function teeRemember(courseId, teeId) {
  var m = lsGet('teeByCourse') || {};
  m[courseId] = teeId;
  lsSet('teeByCourse', m);
}
function teeRecall(courseId) {
  var m = lsGet('teeByCourse') || {};
  return m[courseId] || null;
}

/* ─── Remplit le menu « Départ » de la Scorecard ─── */
function teeFillSelect(course) {
  var sel = document.getElementById('f-tee');
  if (!sel || !course) return null;

  var tees = getCourseTees(course);
  var wanted = teeRecall(course.id);
  var chosen = null;
  for (var i = 0; i < tees.length; i++) { if (tees[i].id === wanted) chosen = tees[i]; }
  if (!chosen) chosen = tees[0];

  sel.innerHTML = tees.map(function(t) {
    var bits = [];
    if (t.longueur) bits.push(t.longueur + ' m');
    if (t.rating) bits.push('SSS ' + Number(t.rating).toFixed(1));
    if (t.slope) bits.push('slope ' + t.slope);
    var label = t.name + (bits.length ? ' · ' + bits.join(' · ') : '');
    return '<option value="' + teeEsc(t.id) + '"' + (chosen && t.id === chosen.id ? ' selected' : '') + '>'
      + teeEsc(label) + '</option>';
  }).join('');

  sel.disabled = tees.length < 2;
  return chosen;
}

/* Le départ actuellement sélectionné dans l'écran */
function currentTee(course) {
  var sel = document.getElementById('f-tee');
  if (!course) return null;
  if (!sel || !sel.value) return getCourseTees(course)[0] || null;
  return findTee(course, sel.value);
}

function teeEsc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
