/* ════════════════════════════════════════════
 * THE SMART GOLFER — strokesgained.js
 * STROKES GAINED RÉELS — modèle de référence par handicap.
 *
 * Avant (S1→S27) : 4 formules inventées, sans base. Maintenant : un modèle
 * cohérent, adossé aux barèmes amateurs publiés (méthode Broadie / données USGA).
 *
 * Principe — on décompose l'écart de score par rapport à ce qu'un joueur
 * de niveau de référence aurait fait sur CE parcours :
 *   SG total   = score attendu − score réel
 *   SG putting = putts attendus − putts réels          (exact : un putt = un coup)
 *   SG départ  = (ton %fairway − %attendu) × trous × 0,28
 *   SG approche= (ton %green − %attendu)   × trous × 0,55
 *   SG petit jeu = SG total − les trois autres          (résidu : récup., pénalités)
 * Les 4 composantes somment EXACTEMENT au SG total : le modèle est bouclé.
 *
 * Si les putts ne sont pas saisis, putting et petit jeu valent null
 * (le dashboard ignore déjà les valeurs nulles) — on préfère ne rien dire
 * que d'inventer un chiffre.
 *
 * Dépend de : app.js (lsGet/lsSet), data.js (getAllCourses).
 * ════════════════════════════════════════════ */

/* Barèmes amateurs par index — moyennes sur 18 trous, parcours standard (par 72).
   Sources : données amateurs agrégées (Broadie « Every Shot Counts », USGA/Arccos). */
var SG_BENCHMARKS = [
  { hcp: 0,  score: 72.9, fir: 0.62, gir: 0.62, putts: 29.5 },
  { hcp: 5,  score: 78.0, fir: 0.57, gir: 0.48, putts: 30.5 },
  { hcp: 10, score: 83.0, fir: 0.52, gir: 0.38, putts: 31.5 },
  { hcp: 15, score: 88.0, fir: 0.47, gir: 0.29, putts: 32.4 },
  { hcp: 20, score: 93.0, fir: 0.42, gir: 0.21, putts: 33.2 },
  { hcp: 25, score: 98.0, fir: 0.38, gir: 0.15, putts: 33.9 },
  { hcp: 30, score: 103.0, fir: 0.34, gir: 0.11, putts: 34.4 },
  { hcp: 36, score: 109.0, fir: 0.30, gir: 0.07, putts: 35.0 }
];

/* Valeur en coups d'un fairway / d'un green touché en plus */
var SG_PER_FAIRWAY = 0.28;
var SG_PER_GIR     = 0.55;

/* Un score moyen se situe ~3 coups au-dessus du handicap
   (l'index ne retient que les 8 meilleures cartes sur 20). */
var SG_AVG_ABOVE_HCP = 3.0;

/* Barème interpolé pour un index donné */
function sgBaseline(hcp) {
  var h = (hcp === null || hcp === undefined || isNaN(hcp)) ? 18 : Number(hcp);
  var t = SG_BENCHMARKS;
  if (h <= t[0].hcp) return t[0];
  if (h >= t[t.length - 1].hcp) return t[t.length - 1];
  for (var i = 0; i < t.length - 1; i++) {
    var a = t[i], b = t[i + 1];
    if (h >= a.hcp && h <= b.hcp) {
      var k = (h - a.hcp) / (b.hcp - a.hcp);
      return {
        hcp: h,
        score: a.score + (b.score - a.score) * k,
        fir:   a.fir   + (b.fir   - a.fir)   * k,
        gir:   a.gir   + (b.gir   - a.gir)   * k,
        putts: a.putts + (b.putts - a.putts) * k
      };
    }
  }
  return t[t.length - 1];
}

/* Retrouve le parcours d'une partie (pour rating / slope / pars) */
function sgCourseOf(round) {
  if (!round) return null;
  var courses = (typeof getAllCourses === 'function') ? getAllCourses() : [];
  for (var i = 0; i < courses.length; i++) {
    if (courses[i].id === round.courseId) return courses[i];
  }
  return null;
}

/* Nombre de trous réellement joués */
function sgHolesPlayed(round) {
  if (Array.isArray(round.scores)) {
    var n = round.scores.filter(function(s) { return s !== null && s !== undefined; }).length;
    if (n > 0) return n;
  }
  // Saisie rapide (score total) : on déduit du score
  return 18;
}

/* ── LE CALCUL ── */
function sgComputeRound(round, refHcp) {
  if (!round || round.score === null || round.score === undefined) return null;

  var course = sgCourseOf(round);
  var holes  = sgHolesPlayed(round);
  var factor = holes / 18;
  if (factor <= 0) return null;

  var base   = sgBaseline(refHcp);
  var rating = (course && course.rating) ? course.rating : ((round.par || 72) + 1.5);
  var slope  = (course && course.slope)  ? course.slope  : 113;

  /* Score attendu sur CE parcours pour ce niveau, ramené aux trous joués */
  var courseHcp     = (refHcp === null || refHcp === undefined || isNaN(refHcp)) ? 18 : (Number(refHcp) * slope / 113);
  var expected18    = rating + courseHcp + SG_AVG_ABOVE_HCP;
  var expectedScore = expected18 * factor;

  var totalSG = expectedScore - round.score;

  /* Départ : fairways touchés vs attendus */
  var firHoles = round.firTotal;
  if (!firHoles && course) firHoles = course.trous.filter(function(h) { return h.par !== 3; }).length;
  if (!firHoles) firHoles = Math.round(14 * factor);
  else firHoles = Math.round(firHoles * factor);
  var sgOtt = null;
  if (firHoles > 0 && round.fir !== null && round.fir !== undefined) {
    sgOtt = ((round.fir / firHoles) - base.fir) * firHoles * SG_PER_FAIRWAY;
  }

  /* Approche : greens en régulation vs attendus */
  var sgApp = null;
  if (round.gir !== null && round.gir !== undefined) {
    sgApp = ((round.gir / holes) - base.gir) * holes * SG_PER_GIR;
  }

  /* Putting : exact, un putt est un coup */
  var sgPutt = null;
  if (round.putts !== null && round.putts !== undefined && round.putts > 0) {
    sgPutt = (base.putts * factor) - round.putts;
  }

  /* Petit jeu : le résidu — n'a de sens que si tout le reste est connu */
  var sgArg = null;
  if (sgOtt !== null && sgApp !== null && sgPutt !== null) {
    sgArg = totalSG - sgOtt - sgApp - sgPutt;
  }

  function r2(v) { return (v === null) ? null : Math.round(v * 100) / 100; }
  function clamp(v) {
    if (v === null) return null;
    return Math.max(-8, Math.min(8, v));   // garde-fou contre les valeurs aberrantes
  }

  return {
    sg_tee:  r2(clamp(sgOtt)),
    sg_app:  r2(clamp(sgApp)),
    sg_arg:  r2(clamp(sgArg)),
    sg_putt: r2(clamp(sgPutt)),
    sg_total: r2(clamp(totalSG)),
    expected: Math.round(expectedScore * 10) / 10,
    holes: holes,
    refHcp: (refHcp === null || refHcp === undefined || isNaN(refHcp)) ? 18 : Number(refHcp),
    complete: (sgArg !== null)
  };
}

/* Index de référence du joueur */
function sgRefHcp() {
  if (typeof calcHandicapFromRounds === 'function') {
    var c = calcHandicapFromRounds();
    if (c !== null && c !== undefined && !isNaN(c)) return c;
  }
  if (typeof currentUser !== 'undefined' && currentUser && currentUser.hcp !== null && currentUser.hcp !== undefined) {
    return currentUser.hcp;
  }
  return 18;
}

/* Applique le modèle à une partie (mutation en place) */
function sgApplyToRound(round, refHcp) {
  var res = sgComputeRound(round, (refHcp === undefined) ? sgRefHcp() : refHcp);
  if (!res) return round;
  round.sg_tee  = res.sg_tee;
  round.sg_app  = res.sg_app;
  round.sg_arg  = res.sg_arg;
  round.sg_putt = res.sg_putt;
  round.sg_total = res.sg_total;
  round.sg_expected = res.expected;
  round.sg_model = 2;      // version du modèle (1 = anciennes formules inventées)
  return round;
}

/* Recalcule TOUT l'historique avec le modèle courant.
   Appelé au démarrage : les anciennes parties récupèrent de vrais chiffres. */
function sgBackfillRounds(force) {
  var rounds = (typeof lsGet === 'function' && lsGet('rounds')) || [];
  if (!rounds.length) return 0;
  var ref = sgRefHcp();
  var n = 0;
  rounds.forEach(function(r) {
    if (!force && r.sg_model === 2 && r.sg_ref === ref) return;
    sgApplyToRound(r, ref);
    r.sg_ref = ref;
    n++;
  });
  if (n) lsSet('rounds', rounds);
  if (typeof roundHistory !== 'undefined') roundHistory = rounds;
  return n;
}

/* Texte d'explication affiché sous le panneau */
function sgReferenceLabel(refHcp) {
  var h = Math.round(refHcp * 10) / 10;
  if (h <= 0.5) return 'un joueur scratch';
  return 'un joueur d\'index ' + h;
}
