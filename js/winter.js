/* ════════════════════════════════════════════
 * THE SMART GOLFER — winter.js
 * L'HIVER (S87) : exercices faisables sans parcours + PROGRAMME DE 12 SEMAINES.
 *
 * 1. Bibliothèque d'hiver : ~16 exercices ajoutés à TRAINING_LIBRARY
 *    (`winter:true`, `where` = maison / practice / salle / simu / parcours),
 *    certains mesurés (résultat noté → progression).
 * 2. Programme d'hiver : 3 blocs de 4 semaines
 *      Fondations (S1-4)  : le corps + la technique au ralenti + putting maison
 *      Construction (S5-8): vitesse, contact, petit jeu, secteur faible
 *      Reprise (S9-12)    : précision, pression, jeu réel (simulateur, parcours)
 *    Semaines 4 et 8 allégées. Semaine 12 : séance test (mêmes exercices
 *    mesurés qu'au début → bilan). Le joueur choisit OÙ il peut s'entraîner
 *    et COMBIEN de séances par semaine (2, 3 ou 4).
 *    Même format que le programme de 4 semaines (program.js) : la page, les
 *    séances, le journal (training_log) fonctionnent pareil.
 *
 * Dépend de : traininglib.js (TRAINING_LIBRARY, trnWeakSectors, trnPlayerLevel),
 *             program.js (prgMonday, PRG_LEVEL_RANK, prgSave, prgRenderPanel).
 * ════════════════════════════════════════════ */

var WIN_PLACES = [
  { id: 'maison',   label: 'À la maison' },
  { id: 'practice', label: 'Practice / green' },
  { id: 'salle',    label: 'Salle de sport' },
  { id: 'simu',     label: 'Simulateur' },
  { id: 'parcours', label: 'Parcours (quand il fait beau)' }
];

var WINTER_LIBRARY = [
  /* ─── Putting à la maison ─── */
  { id: 'win-putt-tapis', tag: 'putt', where: ['maison', 'practice'], type: 'exercice',
    title: '50 putts à 1 m sur la moquette', category: 'Putting', level: 'Débutant', duration: 15,
    objective: 'Garder le toucher et la confiance sur les putts courts tout l\'hiver.',
    description: '1. Vise un verre couché, un pied de chaise ou une pièce à 1 m.\n2. Joue 50 putts avec ta routine complète.\n3. Compte ceux qui touchent la cible.\n4. Refais-le chaque semaine : le chiffre doit monter.',
    measure: { label: 'Putts réussis', max: 50 } },
  { id: 'win-putt-mur', tag: 'putt', where: ['maison'], type: 'exercice',
    title: 'Vitesse : s\'arrêter avant le mur', category: 'Putting', level: 'Intermédiaire', duration: 15,
    objective: 'Doser la vitesse sans green, juste avec un couloir et un mur.',
    description: '1. Place-toi à 3-4 m d\'un mur (ou d\'une plinthe).\n2. La balle doit s\'arrêter à moins de 30 cm du mur SANS le toucher.\n3. 10 balles, compte les réussies.\n4. Recule d\'un mètre quand tu fais 7/10.',
    measure: { label: 'Balles arrêtées à moins de 30 cm', max: 10 } },
  { id: 'win-putt-ligne', tag: 'putt', where: ['maison', 'practice'], type: 'exercice',
    title: 'Rouler droit sur une ligne', category: 'Putting', level: 'Débutant', duration: 10,
    objective: 'Un putter qui sort carré : la balle part sur sa ligne.',
    description: '1. Colle un ruban (ou pose une règle) sur 2 m au sol.\n2. Pose la balle dessus et putte en suivant la ligne.\n3. Compte les balles qui restent sur la ligne jusqu\'au bout.\n4. 10 balles par série.',
    measure: { label: 'Balles restées sur la ligne', max: 10 } },

  /* ─── Petit jeu ─── */
  { id: 'win-chip-panier', tag: 'chip', where: ['maison', 'practice'], type: 'exercice',
    title: 'Chips dans un panier', category: 'Jeu court', level: 'Débutant', duration: 15,
    objective: 'Garder le toucher des petits coups (balles mousse à la maison).',
    description: '1. Pose un panier ou un seau à 4-6 m.\n2. Chip 20 balles (balles mousse à la maison, vraies balles au practice).\n3. Compte celles qui tombent dedans ou le touchent.\n4. Change de club : wedge, puis fer 9.',
    measure: { label: 'Balles dans le panier', max: 20 } },
  { id: 'win-chip-serviette', tag: 'chip', where: ['practice'], type: 'exercice',
    title: 'Contact propre : la serviette derrière la balle', category: 'Jeu court', level: 'Intermédiaire', duration: 15,
    objective: 'Toucher la balle avant le sol, même sur les tapis d\'hiver.',
    description: '1. Pose une serviette pliée 15 cm derrière la balle.\n2. Joue 20 chips sans toucher la serviette.\n3. Poids sur le pied avant, mains devant la balle.\n4. Compte les contacts propres.',
    measure: { label: 'Contacts propres', max: 20 } },

  /* ─── Swing : technique et vitesse ─── */
  { id: 'win-swing-miroir', tag: 'tech', where: ['maison', 'salle'], type: 'exercice',
    title: 'Positions clés devant le miroir', category: 'Approche', level: 'Débutant', duration: 10,
    objective: 'Corriger sa posture et son haut de swing sans frapper de balle.',
    description: '1. Devant un miroir (ou ton reflet dans une vitre), prends ta posture.\n2. Monte à mi-montée et arrête-toi : vérifie le club parallèle aux pieds.\n3. Puis haut de swing, puis finish : tiens 3 s chaque position.\n4. 10 répétitions. Filme-toi une fois par semaine.' },
  { id: 'win-swing-lent', tag: 'tech', where: ['maison', 'practice'], type: 'exercice',
    title: 'Swing au ralenti 10-10-10', category: 'Approche', level: 'Intermédiaire', duration: 15,
    objective: 'Graver le bon mouvement : lent d\'abord, vite ensuite.',
    description: '1. 10 swings à 25 % de vitesse, sans balle.\n2. 10 swings à 50 %, en gardant les mêmes positions.\n3. Au practice : 10 balles à 75 %.\n4. Le but : que le swing lent et le swing réel se ressemblent.' },
  { id: 'win-vitesse', tag: 'speed', where: ['maison', 'practice', 'salle'], type: 'exercice',
    title: 'Vitesse : 3 × 10 swings rapides', category: 'Drive', level: 'Intermédiaire', duration: 10,
    objective: 'Gagner de la vitesse de club (et donc de la distance) pendant l\'hiver.',
    description: '1. Retourne ton driver (tiens-le par la tête) : il est plus léger.\n2. 10 swings le plus vite possible, en faisant « siffler » le bas du swing.\n3. 10 swings du côté opposé (gaucher si tu es droitier).\n4. 10 swings normaux. Repos 1 min entre les séries. 2 à 3 fois par semaine.' },
  { id: 'win-prac-routine', tag: 'prac', where: ['practice', 'simu'], type: 'exercice',
    title: 'Practice d\'hiver : 1 balle = 1 routine', category: 'Approche', level: 'Intermédiaire', duration: 30,
    objective: 'Au practice, s\'entraîner comme sur le parcours, pas enchaîner les balles.',
    description: '1. 20 balles, pas plus.\n2. Avant chaque balle : choisis un club ET une cible différente, fais ta routine complète.\n3. Compte les balles qui finissent dans la zone visée.\n4. Pas de deuxième essai : comme sur le parcours.',
    measure: { label: 'Balles dans la zone visée', max: 20 } },

  /* ─── Jeu réel ─── */
  { id: 'win-prac-parcours', tag: 'play', where: ['practice', 'simu'], type: 'entrainement',
    title: 'Parcours imaginaire au practice (9 trous)', category: 'Parcours', level: 'Intermédiaire', duration: 40,
    objective: 'Jouer ton parcours de club depuis le tapis de practice.',
    description: '1. Prends la carte de ton parcours.\n2. Pour chaque trou : drive (ou bois) vers un repère, puis le fer qu\'il te resterait.\n3. Un trou est « réussi » si le drive tient le couloir ET le fer touche la zone du green.\n4. Compte tes trous réussis sur 9.',
    measure: { label: 'Trous réussis', max: 9 } },
  { id: 'win-simu-9', tag: 'play', where: ['simu'], type: 'entrainement',
    title: 'Simulateur : 9 trous en conditions réelles', category: 'Parcours', level: 'Intermédiaire', duration: 60,
    objective: 'Garder le rythme du parcours, avec score et statistiques.',
    description: '1. Choisis un parcours et joue 9 trous sans « mulligan ».\n2. Putts : concédés seulement à moins d\'une longueur de grip.\n3. Note ton score sur 9 trous.\n4. Rejoue le même parcours toutes les 3-4 semaines pour comparer.',
    measure: { label: 'Score sur 9 trous', max: null, lower: true, unit: 'coups' } },

  /* ─── Physique ─── */
  { id: 'win-phy-force', tag: 'body', where: ['salle', 'maison'], type: 'entrainement',
    title: 'Force jambes & hanches', category: 'Physique', level: 'Intermédiaire', duration: 25,
    objective: 'Des appuis solides = un swing plus stable et plus puissant.',
    description: '1. Squats 3 × 12 (lestés en salle).\n2. Fentes arrière 3 × 10 par jambe.\n3. Soulevé de terre jambes tendues (léger) 3 × 10.\n4. Pont fessier une jambe 3 × 10 par côté.\nRepos 1 min entre les séries.' },
  { id: 'win-phy-thorax', tag: 'body', where: ['maison', 'salle'], type: 'exercice',
    title: 'Mobilité du haut du dos (15 min)', category: 'Physique', level: 'Débutant', duration: 15,
    objective: 'Tourner plus, avec moins de tension dans le bas du dos.',
    description: '1. Rotations à quatre pattes (main derrière la tête) 2 × 10 par côté.\n2. « Livre ouvert » allongé sur le côté 2 × 10.\n3. Chat-vache 2 × 10.\n4. Étirement des pectoraux contre un mur, 30 s par côté.' },
  { id: 'win-phy-cardio', tag: 'body', where: ['maison', 'salle'], type: 'exercice',
    title: 'Endurance : 30 min de marche rapide ou de vélo', category: 'Physique', level: 'Débutant', duration: 30,
    objective: 'Finir les 18 trous aussi frais qu\'au départ.',
    description: '1. 30 min à une allure où tu peux parler mais pas chanter.\n2. Marche rapide, vélo, rameur, natation : au choix.\n3. 2 fois par semaine.\n4. Bonus : monte les escaliers au lieu de l\'ascenseur.' },

  /* ─── Mental ─── */
  { id: 'win-men-visu', tag: 'mind', where: ['maison'], type: 'exercice',
    title: 'Visualiser son parcours trou par trou', category: 'Mental', level: 'Débutant', duration: 15,
    objective: 'Préparer tes futures parties dans ta tête : stratégie et confiance.',
    description: '1. Assis, yeux fermés, pars du trou 1 de ton parcours.\n2. Pour chaque trou : la cible du départ, le club, le coup que tu veux voir.\n3. Si un coup « rate » dans ta tête, rejoue-le jusqu\'à le voir réussi.\n4. 9 trous par séance.' },
  { id: 'win-men-bilan', tag: 'mind', where: ['maison'], type: 'exercice',
    title: 'Bilan de saison & objectifs', category: 'Mental', level: 'Débutant', duration: 20,
    objective: 'Savoir où tu as perdu des coups cette saison et décider sur quoi travailler.',
    description: '1. Ouvre l\'onglet Analyse : note ton secteur le plus faible et le plus fort.\n2. Écris tes 3 meilleures parties et ce qui avait marché.\n3. Fixe 1 objectif de résultat (index, score) et 2 objectifs de travail pour l\'hiver.\n4. Partage-les avec ton coach.' }
];

WINTER_LIBRARY.forEach(function(e) { e.library = true; e.winter = true; e.sector = e.category; });
if (typeof TRAINING_LIBRARY !== 'undefined') {
  WINTER_LIBRARY.forEach(function(e) {
    if (!TRAINING_LIBRARY.some(function(x) { return x.id === e.id; })) TRAINING_LIBRARY.push(e);
  });
}

/* Où se fait un exercice de la bibliothèque classique (pour le filtre « où ») */
function winWhere(e) {
  if (e.where) return e.where;
  if (e.category === 'Mental') return ['maison'];
  if (e.category === 'Physique') return ['maison', 'salle'];
  if (e.category === 'Parcours') return ['parcours'];
  return ['practice'];
}
function winTag(e) {
  if (e.tag) return e.tag;
  return { 'Putting': 'putt', 'Jeu court': 'chip', 'Approche': 'prac', 'Drive': 'prac',
           'Physique': 'body', 'Mental': 'mind', 'Parcours': 'play' }[e.category] || 'prac';
}

/* Saison d'hiver : de novembre à février */
function winIsWinter(d) { var m = (d || new Date()).getMonth(); return m >= 10 || m <= 1; }

/* ── Génération ── */
var WIN_BLOCKS = [
  { name: 'Fondations',   weeks: [1, 2, 3, 4],   desc: 'Le corps et la technique au ralenti. On pose des bases solides.' },
  { name: 'Construction', weeks: [5, 6, 7, 8],   desc: 'Vitesse, contact, petit jeu : on construit sur les bases.' },
  { name: 'Reprise',      weeks: [9, 10, 11, 12], desc: 'Précision, pression, jeu réel : on prépare la saison.' }
];

/* Séances type de chaque bloc : liste de « slots » (tag ou secteur prioritaire) */
var WIN_SESSIONS = {
  1: [ { title: 'Le corps',       slots: ['body', 'body'] },
       { title: 'Technique',      slots: ['tech', 'putt'] },
       { title: 'Ton secteur',    slots: ['primary', 'mind'] },
       { title: 'Express maison', slots: ['putt'] } ],
  2: [ { title: 'Corps & vitesse', slots: ['body', 'speed'] },
       { title: 'Petit jeu',       slots: ['chip', 'putt'] },
       { title: 'Ton secteur',     slots: ['primary', 'secondary'] },
       { title: 'Express maison',  slots: ['speed', 'putt'] } ],
  3: [ { title: 'Corps & vitesse', slots: ['body', 'speed'] },
       { title: 'Précision',       slots: ['prac', 'putt'] },
       { title: 'Jeu réel',        slots: ['play', 'primary'] },
       { title: 'Express maison',  slots: ['putt', 'mind'] } ]
};

function winPool(slot, places, primary, secondary) {
  var lib = getLibrary().filter(function(e) {
    return winWhere(e).some(function(w) { return places.indexOf(w) !== -1; });
  });
  if (slot === 'primary' || slot === 'secondary') {
    var sec = slot === 'primary' ? primary : secondary;
    return lib.filter(function(e) { return e.category === sec; });
  }
  return lib.filter(function(e) { return winTag(e) === slot; });
}

function winPick(slot, places, primary, secondary, rank, offset, avoid) {
  var pool = winPool(slot, places, primary, secondary);
  // Rien de faisable là où il s'entraîne : on se rabat sur l'équivalent « maison »
  if (!pool.length) pool = winPool({ play: 'mind', prac: 'tech', chip: 'putt' }[slot] || 'putt', places, primary, secondary);
  if (!pool.length) return null;
  pool.sort(function(a, b) {
    var da = Math.abs((PRG_LEVEL_RANK[a.level] || 1) - rank) + (a.winter ? 0 : 0.4) + (a.measure ? 0 : 0.2);
    var db = Math.abs((PRG_LEVEL_RANK[b.level] || 1) - rank) + (b.winter ? 0 : 0.4) + (b.measure ? 0 : 0.2);
    return (da - db) || (a.id < b.id ? -1 : 1);
  });
  var top = pool.slice(0, Math.min(pool.length, 4));
  for (var i = 0; i < top.length; i++) {
    var c = top[(offset + i) % top.length];
    if (avoid.indexOf(c.id) === -1) return c.id;
  }
  return top[offset % top.length].id;
}

function prgGenerateWinter(opts) {
  opts = opts || {};
  var places = (opts.places && opts.places.length) ? opts.places.slice() : ['maison', 'practice'];
  // Physique, mental, technique au ralenti : toujours faisables chez soi
  if (places.indexOf('maison') === -1) places.unshift('maison');
  var perWeek = Math.max(2, Math.min(4, opts.perWeek || 3));
  var sectors = (typeof trnWeakSectors === 'function') ? trnWeakSectors() : null;
  var order = sectors ? sectors.map(function(s) { return s.key; }) : ['Putting', 'Jeu court', 'Approche', 'Drive'];
  var primary = order[0], secondary = order[1];
  var baseRank = PRG_LEVEL_RANK[(typeof trnPlayerLevel === 'function') ? trnPlayerLevel() : 'Intermédiaire'];
  if (baseRank === undefined) baseRank = 1;

  var weeks = [];
  WIN_BLOCKS.forEach(function(b, bi) {
    b.weeks.forEach(function(n, wi) {
      var light = (n === 4 || n === 8);
      var rank = Math.max(0, Math.min(3, baseRank - 0.5 + bi * 0.5 + wi * 0.15));
      var tpl = WIN_SESSIONS[bi + 1];
      // 2 séances : on garde « Technique/Petit jeu/Précision » + « Ton secteur/Jeu réel », avec un exercice physique en plus
      var chosen = perWeek === 2 ? [tpl[1], tpl[2]] : tpl.slice(0, perWeek);
      if (light) chosen = chosen.slice(0, Math.max(1, chosen.length - 1));
      var weekUsed = [];
      var sessions = chosen.map(function(t, si) {
        var used = weekUsed;
        var slots = t.slots.slice();
        if (perWeek === 2 && si === 0) slots.unshift('body');
        var ex = [];
        slots.forEach(function(sl, k) {
          var id = winPick(sl, places, primary, secondary, rank, n + si + k, used);
          if (id && used.indexOf(id) === -1) { used.push(id); ex.push(id); }
        });
        var focus = t.title === 'Ton secteur' ? PRG_SECTOR_LABEL[primary] ? 'priorité : ' + PRG_SECTOR_LABEL[primary] : primary : t.slots.map(function(s) {
          return { body: 'physique', tech: 'technique', putt: 'putting', chip: 'petit jeu', speed: 'vitesse', prac: 'précision',
                   play: 'jeu réel', mind: 'mental', primary: primary.toLowerCase(), secondary: secondary.toLowerCase() }[s];
        }).filter(function(x, i, arr) { return arr.indexOf(x) === i; }).join(' + ');
        return { key: 'w' + n + 's' + (si + 1), title: t.title, focus: focus, exercises: ex };
      });
      weeks.push({ n: n, block: b.name, theme: b.name + (light ? ' · semaine allégée' : ''),
        desc: light ? 'Semaine plus légère pour récupérer. Garde le rythme sans forcer.' : b.desc, sessions: sessions });
    });
  });

  // Semaine 12, dernière séance : test avec les exercices MESURÉS des 2 premières semaines
  var measured = [];
  weeks.slice(0, 2).forEach(function(w) {
    w.sessions.forEach(function(s) {
      s.exercises.forEach(function(id) {
        var ex = prgEx(id);
        if (ex && ex.measure && measured.indexOf(id) === -1) measured.push(id);
      });
    });
  });
  if (measured.length) {
    var last = weeks[11];
    last.sessions[last.sessions.length - 1] = { key: 'w12s' + last.sessions.length, title: 'Séance test',
      focus: 'Comparaison avec le début de l\'hiver', exercises: measured.slice(0, 4), isTest: true };
  }

  return {
    id: 'prg-' + Date.now(), kind: 'hiver',
    createdAt: new Date().toISOString(), startDate: prgMonday(),
    primary: primary, secondary: secondary, basedOnData: !!sectors,
    places: places, perWeek: perWeek,
    weeks: weeks, progress: {}
  };
}

/* ── Choix du programme (fenêtre) ── */
function prgOpenChooser(host, onDone) {
  var old = document.getElementById('prg-chooser');
  if (old) old.remove();
  var places = ['maison', 'practice'], perWeek = 3, kind = winIsWinter() ? 'hiver' : 'classic';
  var m = document.createElement('div');
  m.id = 'prg-chooser';
  m.className = 'trn-modal';
  function render() {
    m.innerHTML = '<div class="trn-modal-card">'
      + '<div class="trn-modal-head"><div><div class="trn-modal-tag">Programme</div><div class="trn-modal-title">Choisis ton programme</div></div>'
      + '<button class="trn-modal-close" type="button" aria-label="Fermer">×</button></div>'
      + '<div class="trn-modal-body">'
      +   '<div class="prg-kinds">'
      +     '<button type="button" class="prg-kind' + (kind === 'hiver' ? ' on' : '') + '" data-kind="hiver">'
      +       '<span class="prg-kind-t">❄ Programme d\'hiver</span><span class="prg-kind-d">12 semaines · le corps, la technique, puis la reprise. Faisable sans parcours.</span>'
      +       (winIsWinter() ? '<span class="prg-kind-b">Conseillé en ce moment</span>' : '') + '</button>'
      +     '<button type="button" class="prg-kind' + (kind === 'classic' ? ' on' : '') + '" data-kind="classic">'
      +       '<span class="prg-kind-t">Programme 4 semaines</span><span class="prg-kind-d">3 séances par semaine sur ton secteur le plus faible, au practice et au green.</span></button>'
      +   '</div>'
      +   (kind === 'hiver'
          ? '<div class="trn-result-l">Où peux-tu t\'entraîner cet hiver ?</div>'
            + '<div class="tl-types">' + WIN_PLACES.map(function(p) {
                if (p.id === 'maison') return '<span class="tl-type on prg-place-fixed">À la maison ✓</span>';
                return '<button type="button" class="tl-type' + (places.indexOf(p.id) !== -1 ? ' on' : '') + '" data-place="' + p.id + '">' + prgEsc(p.label) + '</button>'; }).join('') + '</div>'
            + '<div class="trn-result-l">Combien de séances par semaine ?</div>'
            + '<div class="tl-feels prg-per">' + [2, 3, 4].map(function(n) { return '<button type="button" class="tl-feel-b' + (n === perWeek ? ' on' : '') + '" data-per="' + n + '">' + n + ' séances</button>'; }).join('') + '</div>'
            + '<p class="tl-empty">Compte 30 à 50 min par séance. Les semaines 4 et 8 sont plus légères pour récupérer.</p>'
          : '')
      + '</div>'
      + '<div class="trn-modal-actions"><button class="dash-btn dash-btn-outline" type="button" data-x>Annuler</button>'
      + '<button class="dash-btn dash-btn-gold" type="button" data-go>Créer mon programme</button></div></div>';
  }
  render();
  document.body.appendChild(m);
  m.addEventListener('click', function(e) {
    if (e.target === m || e.target.closest('.trn-modal-close') || e.target.closest('[data-x]')) { m.remove(); return; }
    var k = e.target.closest('[data-kind]');
    if (k) { kind = k.getAttribute('data-kind'); render(); return; }
    var pl = e.target.closest('[data-place]');
    if (pl) {
      var id = pl.getAttribute('data-place'), i = places.indexOf(id);
      if (i === -1) places.push(id); else places.splice(i, 1);
      render(); return;
    }
    var pw = e.target.closest('[data-per]');
    if (pw) { perWeek = +pw.getAttribute('data-per'); render(); return; }
    if (e.target.closest('[data-go]')) {
      var cur = prgGet();
      if (cur && !confirm('Remplacer ton programme actuel ? Ta progression dessus sera remise à zéro (ton journal et tes résultats sont conservés).')) return;
      var p = kind === 'hiver' ? prgGenerateWinter({ places: places.slice(), perWeek: perWeek }) : prgGenerate();
      prgSave(p);
      _prgViewWeek = null;
      m.remove();
      if (typeof showToast === 'function') showToast(kind === 'hiver' ? 'Programme d\'hiver créé — semaine 1 : Fondations ❄' : 'Programme créé — c\'est parti pour la semaine 1 ✓');
      if (host) prgRenderPanel(host);
      if (onDone) onDone(p);
    }
  });
}
