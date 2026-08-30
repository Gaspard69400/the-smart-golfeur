/* ════════════════════════════════════════════
 * THE SMART GOLFER — traininglib.js
 * BIBLIOTHÈQUE d'entraînement intégrée : un catalogue d'exercices de
 * qualité, prêts à l'emploi, couvrant chaque secteur du jeu.
 * + Moteur de recommandation : détecte tes secteurs faibles (Strokes
 *   Gained de tes parties) et propose LA sélection à travailler maintenant.
 *
 * Dépend de : app.js (lsGet, currentUser), training.js (getTrainings).
 * Chaque exercice a la même forme qu'un « training » → réutilise
 * trnBuildCard / openTrainingDetail. Flag `library:true`, `sector` = clé SG.
 * ════════════════════════════════════════════ */

var TRAINING_LIBRARY = [
  /* ─── PUTTING (sg_putt) ─── */
  { id: 'lib-putt-echelle', library: true, sector: 'Putting', type: 'exercice',
    title: 'Échelle de distance 1-2-3 m', category: 'Putting', level: 'Débutant', duration: 15,
    objective: 'Fiabiliser les putts courts et caler la distance.',
    description: '1. Place une balle à 1 m, une à 2 m, une à 3 m du trou.\n2. Rentre les 3 d\'affilée pour valider une série.\n3. À la moindre erreur, tu recommences la série.\n4. Objectif : 5 séries complètes.' },
  { id: 'lib-putt-horloge', library: true, sector: 'Putting', type: 'exercice',
    title: 'Le tour de l\'horloge (1 m)', category: 'Putting', level: 'Intermédiaire', duration: 20,
    objective: 'Rentrer les putts courts sous pression, tous les angles.',
    description: '1. Dispose 6 balles en cercle à 1 m autour du trou.\n2. Rentre-les une à une : tu dois faire le tour complet.\n3. Une balle ratée = tu repars de zéro.\n4. Monte ensuite le cercle à 1,5 m.' },
  { id: 'lib-putt-portail', library: true, sector: 'Putting', type: 'exercice',
    title: 'Portail de putting (gate drill)', category: 'Putting', level: 'Intermédiaire', duration: 15,
    objective: 'Un impact centré et une face de putter carrée.',
    description: '1. Plante 2 tees juste plus larges que ton putter, à 20 cm devant la balle.\n2. Fais passer la balle par le portail sans toucher les tees.\n3. 10 putts réussis d\'affilée à 2 m.' },
  { id: 'lib-putt-lag', library: true, sector: 'Putting', type: 'exercice',
    title: 'Lag putting 8-12-15 m', category: 'Putting', level: 'Avancé', duration: 20,
    objective: 'Supprimer les 3-putts sur les longues distances.',
    description: '1. Putte vers un cercle imaginaire de 1 m de rayon (pas le trou).\n2. 5 balles à 8 m, 5 à 12 m, 5 à 15 m.\n3. Compte combien s\'arrêtent dans le cercle.\n4. Vise 4/5 à chaque distance.' },
  { id: 'lib-putt-pression', library: true, sector: 'Putting', type: 'entrainement',
    title: '50 putts sous pression', category: 'Putting', level: 'Avancé', duration: 25,
    objective: 'Construire une fiabilité totale sur les putts décisifs.',
    description: '1. 50 putts à 1,2 m depuis des angles variés.\n2. Note ton % de réussite.\n3. Rejoue chaque semaine et suis ta progression.\n4. Un bon niveau amateur : > 85 %.' },

  /* ─── APPROCHE (sg_app) — fers & wedges du fairway ─── */
  { id: 'lib-app-3dist', library: true, sector: 'Approche', type: 'exercice',
    title: 'Wedges — 3 distances cibles', category: 'Approche', level: 'Intermédiaire', duration: 25,
    objective: 'Contrôler ses distances de wedge (50 / 75 / 100 m).',
    description: '1. Choisis 3 distances : 50, 75 et 100 m.\n2. Frappe 10 balles par distance.\n3. Compte celles qui atterrissent dans un rayon de 5 m.\n4. Vise > 6/10 par distance.' },
  { id: 'lib-app-horloge', library: true, sector: 'Approche', type: 'exercice',
    title: 'L\'horloge des wedges', category: 'Approche', level: 'Avancé', duration: 25,
    objective: 'Créer 3 distances fiables par wedge via la longueur de swing.',
    description: '1. Pour un même wedge, frappe avec swing à 9h, 10h30 puis 12h.\n2. Note la distance moyenne de chaque longueur.\n3. Construis ta table de distances.\n4. Répète jusqu\'à ± 5 m de constance.' },
  { id: 'lib-app-fenetre', library: true, sector: 'Approche', type: 'exercice',
    title: 'Fenêtre de distance', category: 'Approche', level: 'Intermédiaire', duration: 20,
    objective: 'Réduire la dispersion en profondeur sur les fers.',
    description: '1. Choisis une cible à 120-140 m.\n2. Définis un couloir de profondeur de 10 m autour.\n3. Frappe 15 balles, compte celles dans le couloir.\n4. Progresse : réduis le couloir à 8 m.' },
  { id: 'lib-app-green', library: true, sector: 'Approche', type: 'entrainement',
    title: 'Fers moyens vers un green cible', category: 'Approche', level: 'Avancé', duration: 30,
    objective: 'Toucher plus de greens en régulation (GIR).',
    description: '1. Vise un green (réel ou imaginaire) à 150 m.\n2. Frappe 20 balles avec ta routine complète.\n3. Note ton % de greens touchés.\n4. Analyse le côté des ratés (court/long/gauche/droite).' },

  /* ─── JEU COURT (sg_arg) — chip, pitch, bunker ─── */
  { id: 'lib-arg-chip3', library: true, sector: 'Jeu court', type: 'exercice',
    title: 'Chipping — 3 lies différents', category: 'Jeu court', level: 'Débutant', duration: 20,
    objective: 'S\'adapter à toutes les positions de balle près du green.',
    description: '1. Joue 5 chips depuis le rough, 5 depuis le fairway ras, 5 en pente.\n2. Vise un point d\'atterrissage précis à chaque fois.\n3. Objectif : balle à moins de 2 m du trou.' },
  { id: 'lib-arg-updown', library: true, sector: 'Jeu court', type: 'exercice',
    title: 'Up & down challenge', category: 'Jeu court', level: 'Intermédiaire', duration: 25,
    objective: 'Sauver le par depuis les alentours du green.',
    description: '1. Lâche 10 balles à des endroits variés autour du green.\n2. Pour chacune : 1 approche + putt(s) pour finir.\n3. Compte tes up & down réussis (≤ 2 coups).\n4. Vise 5/10, puis 7/10.' },
  { id: 'lib-arg-bunker', library: true, sector: 'Jeu court', type: 'exercice',
    title: 'Sortie de bunker — distance', category: 'Jeu court', level: 'Intermédiaire', duration: 20,
    objective: 'Sortir à tous les coups et gérer la distance.',
    description: '1. Trace une ligne dans le sable et frappe le sable, pas la balle.\n2. Sors 10 balles : l\'objectif d\'abord est 10/10 sur le green.\n3. Puis vise court / moyen / long drapeau.' },
  { id: 'lib-arg-traj', library: true, sector: 'Jeu court', type: 'exercice',
    title: 'Chip-and-run vs lob', category: 'Jeu court', level: 'Avancé', duration: 25,
    objective: 'Choisir la bonne trajectoire selon la situation.',
    description: '1. Même balle, deux solutions : chip roulé (fer 8) et lob (SW).\n2. Joue les deux vers le même drapeau, 5 fois.\n3. Décide laquelle est la plus fiable pour toi.\n4. Retiens la règle : le sol dès que possible.' },
  { id: 'lib-arg-landing', library: true, sector: 'Jeu court', type: 'exercice',
    title: 'Point d\'atterrissage', category: 'Jeu court', level: 'Débutant', duration: 15,
    objective: 'Piloter le chip par le point de chute, pas le trou.',
    description: '1. Pose une serviette comme cible d\'atterrissage.\n2. Fais atterrir 10 chips dessus.\n3. Observe le roulement selon le club.\n4. Change la distance de la serviette.' },

  /* ─── DRIVE (sg_tee) — mise en jeu ─── */
  { id: 'lib-drv-couloir', library: true, sector: 'Drive', type: 'exercice',
    title: 'Couloir de fairway', category: 'Drive', level: 'Débutant', duration: 20,
    objective: 'Gagner en régularité au départ (plus de fairways).',
    description: '1. Choisis 2 repères formant un couloir de fairway.\n2. Frappe 10 drives en visant le couloir.\n3. Note ton % de fairways touchés.\n4. Compare driver vs bois 3 : garde le plus fiable en jeu.' },
  { id: 'lib-drv-tempo', library: true, sector: 'Drive', type: 'exercice',
    title: 'Tempo 3:1 au driver', category: 'Drive', level: 'Intermédiaire', duration: 20,
    objective: 'Un swing plus fluide et un contact centré.',
    description: '1. Compte « 1-2-3 » à la montée, « 1 » à la descente.\n2. Frappe 15 balles à 80 % d\'effort en gardant ce tempo.\n3. Cherche le centre de la face (spray/marqueur).\n4. La régularité prime sur la distance.' },
  { id: 'lib-drv-routine', library: true, sector: 'Drive', type: 'exercice',
    title: 'Alignement & routine au départ', category: 'Drive', level: 'Intermédiaire', duration: 15,
    objective: 'Viser juste et jouer chaque drive avec la même routine.',
    description: '1. Pose un club au sol sur ta ligne de pieds.\n2. Choisis une cible intermédiaire à 1 m devant la balle.\n3. Déroule la même routine pré-shot sur 10 drives.\n4. Vérifie l\'alignement après chaque coup.' },
  { id: 'lib-drv-dispersion', library: true, sector: 'Drive', type: 'entrainement',
    title: '9 balles — dispersion driver', category: 'Drive', level: 'Avancé', duration: 25,
    objective: 'Mesurer et réduire sa dispersion au driver.',
    description: '1. Frappe 9 drives vers une même cible.\n2. Repère la balle la plus à gauche et la plus à droite.\n3. C\'est ta dispersion réelle : vise avec ce cône en tête sur le parcours.\n4. Réduis-le en travaillant le contact centré.' },

  /* ─── MENTAL ─── */
  { id: 'lib-men-routine', library: true, sector: 'Mental', type: 'exercice',
    title: 'Routine pré-shot en 4 temps', category: 'Mental', level: 'Débutant', duration: 10,
    objective: 'Jouer chaque coup avec le même processus, sans parasites.',
    description: '1. Analyse (cible, vent, lie).\n2. Décision (1 club, 1 cible) — puis on ne change plus.\n3. Visualise le coup.\n4. Respire, engage, joue. Répète à l\'entraînement pour l\'ancrer.' },
  { id: 'lib-men-respir', library: true, sector: 'Mental', type: 'exercice',
    title: 'Respiration & recentrage', category: 'Mental', level: 'Débutant', duration: 10,
    objective: 'Faire retomber la pression avant un coup important.',
    description: '1. Inspire 4 s, bloque 4 s, expire 6 s.\n2. Répète 3 cycles avant le coup.\n3. Fixe un point neutre, relâche les épaules.\n4. Reviens à ta routine.' },

  /* ─── PHYSIQUE ─── */
  { id: 'lib-phy-mobilite', library: true, sector: 'Physique', type: 'exercice',
    title: 'Mobilité golf — 10 min', category: 'Physique', level: 'Débutant', duration: 10,
    objective: 'Préparer le corps et gagner en amplitude de rotation.',
    description: '1. Rotations de hanches et d\'épaules (2 min).\n2. Fentes avec rotation du buste (2 min).\n3. Étirements chaîne postérieure (3 min).\n4. Swings à vide progressifs (3 min).' },
  { id: 'lib-phy-gainage', library: true, sector: 'Physique', type: 'entrainement',
    title: 'Gainage & rotation', category: 'Physique', level: 'Intermédiaire', duration: 15,
    objective: 'Renforcer le centre pour un swing plus stable et puissant.',
    description: '1. Planche 3 × 40 s.\n2. Rotations russes 3 × 20.\n3. Pont fessier 3 × 15.\n4. Anti-rotation (Pallof) 3 × 12 par côté.' },

  /* ─── PARCOURS (course management) ─── */
  { id: 'lib-par-cible', library: true, sector: 'Parcours', type: 'entrainement',
    title: '9 trous — 1 cible par coup', category: 'Parcours', level: 'Avancé', duration: 120,
    objective: 'Transférer l\'entraînement en stratégie sur le parcours.',
    description: '1. Joue 9 trous en te fixant une cible précise à CHAQUE coup.\n2. Choisis toujours le coup le plus fiable, pas le plus héroïque.\n3. Note tes décisions et leurs résultats.\n4. Débriefe : où as-tu perdu des coups évitables ?' },
  { id: 'lib-par-scramble', library: true, sector: 'Parcours', type: 'entrainement',
    title: 'Scramble solo (2 balles)', category: 'Parcours', level: 'Intermédiaire', duration: 90,
    objective: 'Prendre confiance et travailler la gestion de jeu.',
    description: '1. Joue 2 balles par coup et garde la meilleure.\n2. Rejoue le 2e coup depuis la meilleure position.\n3. Observe où se gagnent réellement les coups.\n4. Idéal pour repérer ton secteur à fort potentiel.' }
];

/* Bibliothèque intégrée (statique) */
function getLibrary() { return TRAINING_LIBRARY; }

/* Fusion bibliothèque + exercices du coach (dédoublonnés par titre) */
function getAllExercises() {
  var lib = getLibrary();
  var seen = {};
  lib.forEach(function(e) { seen[(e.title || '').toLowerCase()] = 1; });
  var coach = (typeof getTrainings === 'function' ? getTrainings() : [])
    .filter(function(t) { return !seen[(t.title || '').toLowerCase()]; });
  return lib.concat(coach);
}

/* Niveau du joueur estimé depuis son handicap */
function trnPlayerLevel() {
  var h = currentUser && currentUser.hcp;
  if (h === null || h === undefined) return 'Intermédiaire';
  if (h <= 5) return 'Expert';
  if (h <= 12) return 'Avancé';
  if (h <= 20) return 'Intermédiaire';
  return 'Débutant';
}

/* Secteurs classés du plus faible au plus fort (Strokes Gained) — null si aucune partie */
function trnWeakSectors() {
  var rounds = (typeof lsGet === 'function' && lsGet('rounds')) || [];
  if (!rounds.length) return null;
  var data = rounds.slice(0, 12);
  function avg(key) {
    var s = 0, c = 0;
    data.forEach(function(r) { if (r[key] !== undefined && r[key] !== null) { s += r[key]; c++; } });
    return c ? s / c : 0;
  }
  var sectors = [
    { key: 'Drive',     sg: avg('sg_tee'),  label: 'le driving' },
    { key: 'Approche',  sg: avg('sg_app'),  label: 'les approches' },
    { key: 'Jeu court', sg: avg('sg_arg'),  label: 'le petit jeu' },
    { key: 'Putting',   sg: avg('sg_putt'), label: 'le putting' }
  ];
  sectors.sort(function(a, b) { return a.sg - b.sg; });
  return sectors;
}

/* Sélection recommandée « du moment » : les meilleurs exos pour tes besoins */
function trnPickSelection() {
  var lib = getLibrary();
  var lvl = trnPlayerLevel();
  var order = { 'Débutant': 0, 'Intermédiaire': 1, 'Avancé': 2, 'Expert': 3 };
  var myRank = order[lvl];

  function bestInCategory(cat, count) {
    var inCat = lib.filter(function(e) { return e.category === cat; });
    inCat.sort(function(a, b) {
      return Math.abs((order[a.level] || 1) - myRank) - Math.abs((order[b.level] || 1) - myRank);
    });
    return inCat.slice(0, count);
  }

  var sectors = trnWeakSectors();
  var picks = [];
  if (sectors) {
    // 2 secteurs les plus faibles → 2 exos chacun
    picks = picks.concat(bestInCategory(sectors[0].key, 2));
    picks = picks.concat(bestInCategory(sectors[1].key, 2));
  } else {
    // Aucune partie : une entrée par secteur clé pour démarrer
    ['Putting', 'Approche', 'Jeu court', 'Drive'].forEach(function(cat) {
      picks = picks.concat(bestInCategory(cat, 1));
    });
  }
  // Dédoublonnage par id + limite à 4
  var seen = {}, out = [];
  picks.forEach(function(e) { if (e && !seen[e.id]) { seen[e.id] = 1; out.push(e); } });
  return { picks: out.slice(0, 4), sectors: sectors, level: lvl };
}
