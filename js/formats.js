/* ════════════════════════════════════════════
 * THE SMART GOLFER — formats.js
 * FORMATS DE JEU — Stableford (et bases du net).
 *
 * Le stableford est LE format des compétitions amateurs françaises.
 * Sans lui, une bonne partie des cartes ne se saisissent tout simplement pas.
 *
 * ⚠️ Ce qui existait avant était faux : le calcul utilisait l'INDEX brut
 * comme nombre de coups rendus. Or on doit utiliser le HANDICAP DE JEU :
 *     HJ = Index × (Slope / 113) + (Rating − Par)
 * Sur un parcours slope 138 / rating 73.8 / par 72, un index 15 joue 20,1 —
 * soit 5 coups d'écart, donc plusieurs points de stableford.
 *
 * Dépend de : tees.js (rating/slope du départ joué).
 * ════════════════════════════════════════════ */

/* Handicap de jeu sur un départ donné (norme WHS) */
function courseHandicap(index, slope, rating, par) {
  if (index === null || index === undefined || isNaN(index)) return null;
  var sl = slope || 113;
  var ch = Number(index) * (sl / 113);
  if (rating && par) ch += (Number(rating) - Number(par));
  return Math.round(ch * 10) / 10;
}

/* Coups rendus sur un trou, selon son index de difficulté (SI 1 = le plus dur).
   Gère aussi les handicaps « plus » (le joueur RÉEL rend des coups). */
function strokesOnHole(ch, si) {
  if (ch === null || ch === undefined || isNaN(ch) || !si) return 0;
  var n = Math.round(ch);
  if (n >= 0) {
    return Math.floor(n / 18) + ((si <= (n % 18)) ? 1 : 0);
  }
  // Handicap « plus » : les coups se rendent en partant des trous les plus faciles (SI 18, 17…)
  var p = -n;
  var base = Math.floor(p / 18);
  var rest = p % 18;
  return -(base + ((si >= (19 - rest) && rest > 0) ? 1 : 0));
}

/* Points stableford d'un trou : net double bogey ou pire = 0, net par = 2, net birdie = 3… */
function stablefordPoints(gross, par, strokes) {
  if (gross === null || gross === undefined) return null;
  var net = gross - (strokes || 0);
  return Math.max(0, 2 - (net - par));
}

/* Calcule tout le stableford d'une partie.
   Renvoie { ch, points, byHole:[], holes } — ou null si le format ne s'applique pas. */
function stablefordRound(course, scores, index, tee) {
  if (!course || !Array.isArray(scores)) return null;
  var rating = (tee && tee.rating) || course.rating;
  var slope  = (tee && tee.slope)  || course.slope;
  var ch = courseHandicap(index, slope, rating, course.par_total);
  if (ch === null) return null;

  var byHole = [], total = 0, holes = 0;
  course.trous.forEach(function(h, i) {
    var g = scores[i];
    if (g === null || g === undefined) { byHole.push(null); return; }
    var s = strokesOnHole(ch, h.si);
    var p = stablefordPoints(g, h.par, s);
    byHole.push({ points: p, strokes: s, net: g - s });
    total += p;
    holes++;
  });
  return { ch: ch, points: total, byHole: byHole, holes: holes };
}

/* Barème stableford d'un score : sert à colorer et à libeller */
function stablefordLabel(points) {
  if (points === null || points === undefined) return '';
  if (points >= 5) return 'Exceptionnel';
  if (points === 4) return 'Superbe';
  if (points === 3) return 'Très bon';
  if (points === 2) return 'Dans le par';
  if (points === 1) return 'Un point';
  return 'Rien';
}

function stablefordClass(points) {
  if (points === null || points === undefined) return '';
  if (points >= 4) return 'stb-4';
  if (points === 3) return 'stb-3';
  if (points === 2) return 'stb-2';
  if (points === 1) return 'stb-1';
  return 'stb-0';
}

/* Format actuellement choisi dans la Scorecard */
function currentFormat() {
  var el = document.getElementById('f-format');
  return (el && el.value) ? el.value : 'stroke';
}

/* Index du joueur saisi dans la Scorecard (repli : handicap du profil) */
function currentIndex() {
  var el = document.getElementById('f-hcp');
  var v = el ? parseFloat(el.value) : NaN;
  if (!isNaN(v)) return v;
  if (typeof currentUser !== 'undefined' && currentUser && currentUser.hcp !== null && currentUser.hcp !== undefined) {
    return currentUser.hcp;
  }
  return null;
}
