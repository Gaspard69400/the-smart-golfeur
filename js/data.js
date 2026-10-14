/* ════════════════════════════════════════════
 * THE SMART GOLFER — data.js
 * Données : profils, parcours, clubs, messages démo
 * ════════════════════════════════════════════ */

/* ─── DONNÉES PROFILS ─── */

var DEFAULT_PROFILES = [
  {
    id:       'thomas',
    name:     'Thomas Renard',
    hcp:      8.4,
    role:     'player',
    color:    '#3D8A65',
    bg:       'rgba(61,138,101,0.2)',
    initials: 'TR'
  },
  {
    id:       'martin',
    name:     'Martin Dubois',
    hcp:      null,
    role:     'head',
    color:    '#EF9F27',
    bg:       'rgba(239,159,39,0.15)',
    initials: 'MD'
  },
  {
    id:       'sophie',
    name:     'Sophie Laurent',
    hcp:      10.2,
    role:     'captain',
    color:    '#85B7EB',
    bg:       'rgba(133,183,235,0.2)',
    initials: 'SL'
  },
  {
    id:       'alex',
    name:     'Alex Morin',
    hcp:      11.8,
    role:     'player',
    color:    '#C9A84C',
    bg:       'rgba(201,168,76,0.2)',
    initials: 'AM'
  }
];

/* ─── PARCOURS DE GOLF ─── */
/* Seul Lyon Salvagny est inclus pour l'instant (parcours des Étangs).
   Les autres parcours seront ajoutés par l'utilisateur lui-même
   via la fonctionnalité "Ajouter mon parcours" (Session 8). */

/* Lyon Salvagny — Les Étangs (S75, carte corrigée à la demande de Gaspard).
   Pars confirmés par Gaspard (aller 4-4-5-4-3-5-3-4-4). SI et longueurs par repère :
   carte publiée (GolfPass / SouslePar, mêmes chiffres) ; SSS / slope : valeurs FFGolf
   relayées par des-balles-et-des-birdies.com (oct. 2026). `longueur` = repère jaune,
   `longueurs` = par repère (appliquées au départ choisi, scApplyTee). */
const COURSES = [{"id":"golf-lyon-salvagny","name":"Lyon Salvagny Golf Club","region":"Auvergne-Rhône-Alpes","departement":"Rhône","ville":"La Tour-de-Salvagny","cp":"69890","sss":71.8,"slope":137,"par_total":72,"longueur_totale":5591,"rating":71.8,"type":"18 trous","niveau":"Expert","defaultTee":"jaune","departs":[{"id":"noir","name":"Noir","rating":74.4,"slope":152,"longueur":6083},{"id":"blanc","name":"Blanc","rating":73.8,"slope":147,"longueur":5990},{"id":"jaune","name":"Jaune","rating":71.8,"slope":137,"longueur":5591},{"id":"bleu","name":"Bleu","rating":69.0,"slope":129,"longueur":5156},{"id":"rouge","name":"Rouge","rating":66.8,"slope":126,"longueur":4706},{"id":"jaune-dames","name":"Jaune (dames)","rating":78.0,"slope":146,"longueur":5591},{"id":"bleu-dames","name":"Bleu (dames)","rating":75.2,"slope":138,"longueur":5156},{"id":"rouge-dames","name":"Rouge (dames)","rating":71.8,"slope":130,"longueur":4706}],"trous":[{"num":1,"par":4,"longueur":310,"si":11,"longueurs":{"noir":326,"blanc":318,"jaune":310,"bleu":285,"rouge":285}},{"num":2,"par":4,"longueur":293,"si":7,"longueurs":{"noir":321,"blanc":321,"jaune":293,"bleu":274,"rouge":219}},{"num":3,"par":5,"longueur":451,"si":17,"longueurs":{"noir":485,"blanc":479,"jaune":451,"bleu":421,"rouge":412}},{"num":4,"par":4,"longueur":340,"si":1,"longueurs":{"noir":368,"blanc":354,"jaune":340,"bleu":326,"rouge":264}},{"num":5,"par":3,"longueur":146,"si":15,"longueurs":{"noir":163,"blanc":163,"jaune":146,"bleu":127,"rouge":127}},{"num":6,"par":5,"longueur":442,"si":5,"longueurs":{"noir":507,"blanc":488,"jaune":442,"bleu":428,"rouge":416}},{"num":7,"par":3,"longueur":134,"si":13,"longueurs":{"noir":153,"blanc":147,"jaune":134,"bleu":134,"rouge":114}},{"num":8,"par":4,"longueur":389,"si":3,"longueurs":{"noir":431,"blanc":424,"jaune":389,"bleu":274,"rouge":274}},{"num":9,"par":4,"longueur":307,"si":9,"longueurs":{"noir":327,"blanc":327,"jaune":307,"bleu":298,"rouge":262}},{"num":10,"par":5,"longueur":410,"si":10,"longueurs":{"noir":426,"blanc":426,"jaune":410,"bleu":388,"rouge":378}},{"num":11,"par":4,"longueur":369,"si":4,"longueurs":{"noir":403,"blanc":389,"jaune":369,"bleu":334,"rouge":263}},{"num":12,"par":4,"longueur":320,"si":14,"longueurs":{"noir":351,"blanc":351,"jaune":320,"bleu":284,"rouge":284}},{"num":13,"par":4,"longueur":355,"si":2,"longueurs":{"noir":378,"blanc":378,"jaune":355,"bleu":327,"rouge":308}},{"num":14,"par":3,"longueur":149,"si":8,"longueurs":{"noir":160,"blanc":160,"jaune":149,"bleu":136,"rouge":124}},{"num":15,"par":5,"longueur":435,"si":16,"longueurs":{"noir":460,"blanc":460,"jaune":435,"bleu":424,"rouge":382}},{"num":16,"par":4,"longueur":284,"si":18,"longueurs":{"noir":329,"blanc":310,"jaune":284,"bleu":261,"rouge":234}},{"num":17,"par":3,"longueur":164,"si":6,"longueurs":{"noir":183,"blanc":183,"jaune":164,"bleu":164,"rouge":150}},{"num":18,"par":4,"longueur":293,"si":12,"longueurs":{"noir":312,"blanc":312,"jaune":293,"bleu":271,"rouge":210}}]}];

/* ─── CLUBS DISPONIBLES ─── */

var CLUBS = [
  { val: 'Driver',   name: 'Driver',   range: [180, 280] },
  { val: 'Bois 3',   name: 'Bois 3',   range: [170, 230] },
  { val: 'Bois 5',   name: 'Bois 5',   range: [160, 210] },
  { val: 'Hybride',  name: 'Hybride',  range: [140, 190] },
  { val: 'Fer 3',    name: 'Fer 3',    range: [140, 190] },
  { val: 'Fer 4',    name: 'Fer 4',    range: [130, 175] },
  { val: 'Fer 5',    name: 'Fer 5',    range: [120, 165] },
  { val: 'Fer 6',    name: 'Fer 6',    range: [110, 150] },
  { val: 'Fer 7',    name: 'Fer 7',    range: [100, 140] },
  { val: 'Fer 8',    name: 'Fer 8',    range: [90,  125] },
  { val: 'Fer 9',    name: 'Fer 9',    range: [75,  115] },
  { val: 'PW',       name: 'PW',       range: [60,  100] },
  { val: 'GW',       name: 'GW',       range: [50,  85]  },
  { val: 'SW',       name: 'SW',       range: [30,  70]  },
  { val: 'LW',       name: 'LW',       range: [15,  50]  }
];

/* ─── ONGLETS DE NAVIGATION ─── */

/* primary  = affich\u00e9 dans la barre du bas (mobile) ; sinon rang\u00e9 dans "Plus"
   hidden   = pas encore construit \u2192 masqu\u00e9 de la navigation pour l'instant
   short    = libell\u00e9 court pour la barre mobile */
var NAV_TABS = [
  { page: 'dashboard',   icon: '&#9685;', label: 'Dashboard',    short: 'Accueil', primary: true  },
  { page: 'scorecard',   icon: '&#10022;',label: 'Scorecard',    short: 'Partie',  primary: true  },
  { page: 'training',    icon: '&#10037;',label: 'Entra\u00eenement', short: 'Exos',    primary: true  },
  { page: 'community',   icon: '\ud83c\udfc6', label: 'Communaut\u00e9', short: 'Social',  primary: true  },
  { page: 'coach',       icon: '&#9678;', label: 'Coach Hub',    short: 'Coach',   primary: false },
  { page: 'analyse',     icon: '&#9672;', label: 'Analyse',      short: 'Analyse', primary: false },
  { page: 'groups',      icon: '&#9673;', label: 'Groupes',      short: 'Groupes', primary: false },
  { page: 'courses',     icon: '&#9971;', label: 'Parcours',     short: 'Parcours',primary: false },
  { page: 'articles',    icon: '\ud83d\udcd6', label: 'Articles',     short: 'Articles',primary: false },
  { page: 'leaderboard', icon: '&#8801;', label: 'Classements',  short: 'Classt',  primary: false },
  { page: 'profile',     icon: '&#9786;', label: 'Profil',       short: 'Profil',  primary: false }
];

/* ─── LES 5 ESPACES DE LA NAVIGATION (S71) ───
   Chaque espace regroupe une ou plusieurs pages (NAV_TABS) ; quand il en a
   plusieurs, une barre de sous-onglets s'affiche en haut de la page.
   showPage(pageId) marche toujours avec n'importe quelle page. */
var TSG_ICO = {
  home:     '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
  play:     '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 21V4"/><path d="M6 4l11 4-11 4z"/></svg>',
  progress: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>',
  social:   '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14.5c2.3.2 4 1.8 4.5 4.5"/></svg>',
  profile:  '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.2 4.2-6.5 8-6.5s7 2.3 8 6.5"/></svg>'
};

var NAV_HUBS = [
  { id: 'home',     label: 'Accueil',    icon: TSG_ICO.home,
    pages: [{ page: 'dashboard', label: 'Tableau de bord' }, { page: 'analyse', label: 'Mes stats' }] },
  { id: 'play',     label: 'Jouer',      icon: TSG_ICO.play,
    pages: [{ page: 'scorecard', label: 'Partie' }, { page: 'courses', label: 'Parcours' }] },
  { id: 'progress', label: 'Progresser', icon: TSG_ICO.progress,
    pages: [{ page: 'training', label: 'Entraînement' }, { page: 'articles', label: 'Articles' }] },
  { id: 'social',   label: 'Social',     icon: TSG_ICO.social,
    pages: [{ page: 'community', label: 'Fil & amis' }, { page: 'groups', label: 'Groupes' }, { page: 'leaderboard', label: 'Classements' }] },
  { id: 'profile',  label: 'Profil',     icon: TSG_ICO.profile,
    pages: [{ page: 'profile', label: 'Mon profil' }, { page: 'coach', label: 'Coach' }] }
];

/* L'espace qui contient une page (null si aucune) */
function tsgHubOf(pageId) {
  for (var i = 0; i < NAV_HUBS.length; i++) {
    var ps = NAV_HUBS[i].pages;
    for (var j = 0; j < ps.length; j++) if (ps[j].page === pageId) return NAV_HUBS[i];
  }
  return null;
}

/* ─── LIBELLÉS ET CLASSES CSS DES RÔLES ─── */

var ROLE_LABELS = {
  player:  'Joueur',
  head:    'Head Coach',
  coach:   'Coach',
  captain: 'Capitaine'
};

var ROLE_CSS = {
  player:  'role-player',
  head:    'role-head',
  coach:   'role-coach',
  captain: 'role-captain'
};


/* ─── PARCOURS UTILISATEUR ─── */
/* Les parcours créés par l'utilisateur sont stockés dans localStorage
   sous la clé 'tsg_user_courses'. La fonction getAllCourses() retourne
   la fusion : COURSES (système) + parcours utilisateur. */

/* Pars trou par trou d'une partie : ceux enregistrés sur la partie (S63), sinon ceux de son
   parcours (même id, puis même nom). Les trophées (birdies, pars…) n'en dépendent plus d'un
   parcours encore présent sur l'appareil. */
function tsgRoundHolePars(round, courses) {
  if (!round) return null;
  if (Array.isArray(round.holePars) && round.holePars.length) return round.holePars;
  courses = courses || getAllCourses();
  var c = null, i;
  for (i = 0; i < courses.length && !c; i++) if (round.courseId && courses[i].id === round.courseId) c = courses[i];
  var name = String(round.course || '').trim().toLowerCase();
  for (i = 0; i < courses.length && !c && name; i++) if (String(courses[i].name || '').trim().toLowerCase() === name) c = courses[i];
  return (c && Array.isArray(c.trous) && c.trous.length) ? c.trous.map(function(h) { return h.par; }) : null;
}

/* Au lancement : inscrit les pars sur les anciennes parties dont le parcours est connu */
function tsgStampHolePars() {
  var rounds = lsGet('rounds') || [];
  var courses = getAllCourses(), n = 0;
  // S75 : l'ancienne carte de Lyon Salvagny avait des pars FAUX (aller 4-5-4-3-4-5-4-4-3).
  // Les parties jouées dessus gardent leurs scores (vrais) mais reçoivent les bons pars.
  // Relancé à chaque démarrage : la synchro cloud peut ramener l'ancienne liste.
  var LS_OLD = '4,5,4,3,4,5,4,4,3,4,4,4,3,5,4,3,5,4';
  var lsNew = null;
  for (var i = 0; i < COURSES.length; i++) if (COURSES[i].id === 'golf-lyon-salvagny') lsNew = COURSES[i].trous.map(function(h) { return h.par; });
  rounds.forEach(function(r) {
    if (lsNew && Array.isArray(r.holePars) && r.holePars.join(',') === LS_OLD
        && (r.courseId === 'golf-lyon-salvagny' || /salvagny/i.test(String(r.course || '')))) {
      r.holePars = lsNew.slice(); n++;
      return;
    }
    if (Array.isArray(r.holePars) || !Array.isArray(r.scores)) return;
    var pars = tsgRoundHolePars(r, courses);
    if (pars) { r.holePars = pars; n++; }
  });
  if (n) lsSet('rounds', rounds);
  return n;
}

function getAllCourses() {
  var userCourses = [];
  try {
    var raw = localStorage.getItem('tsg_user_courses');
    if (raw) userCourses = JSON.parse(raw) || [];
  } catch(e) {
    console.warn('Lecture parcours utilisateur :', e.message);
  }
  // Nettoyer (un parcours importé de la communauté vient de quelqu'un d'autre) + marquer
  userCourses = userCourses.filter(function(c) { return c && typeof c === 'object'; }).map(tsgSanitizeCourse);
  userCourses.forEach(function(c) { c.userCreated = true; });
  return COURSES.concat(userCourses);
}

/* ⚠️ Sécurité : un parcours partagé (ou reçu dans une partie partagée) a été saisi
   par un autre joueur. Ses textes finissent dans des pages : on retire tout ce qui
   pourrait être interprété comme du code, et on force les nombres à être des nombres. */
function tsgSanitizeCourse(c) {
  function txt(v, max) { return (v === null || v === undefined) ? v : String(v).replace(/[<>"`\\]/g, '').slice(0, max || 80); }
  function num(v) { if (v === null || v === undefined || v === '') return null; var n = Number(v); return isFinite(n) ? n : null; }
  function id(v) { return String(v === null || v === undefined ? '' : v).replace(/[^A-Za-z0-9_\-:.]/g, '').slice(0, 60); }
  var out = {};
  Object.keys(c).forEach(function(k) {
    var v = c[k];
    if (typeof v === 'string') out[k] = txt(v, k === 'notes' ? 400 : 80);
    else if (typeof v === 'number' || typeof v === 'boolean' || v === null) out[k] = v;
  });
  out.id = id(c.id);
  ['par_total', 'rating', 'sss', 'slope', 'longueur_totale'].forEach(function(k) { if (k in c) out[k] = num(c[k]); });
  out.trous = Array.isArray(c.trous) ? c.trous.slice(0, 18).map(function(h, i) {
    h = h || {};
    return { num: num(h.num) || i + 1, par: num(h.par) || 4, si: num(h.si), longueur: num(h.longueur) };
  }) : [];
  // Parcours 9 trous : index de trou ramenés à 1,3,5…17 (rang de difficulté × 2 − 1).
  // Ainsi le calcul des coups reçus sur 18 trous s'applique tel quel.
  if (out.trous.length === 9) {
    var order = out.trous.map(function(h, i) { return { i: i, si: h.si || 99 + i }; }).sort(function(a, b) { return a.si - b.si; });
    order.forEach(function(o, rank) { out.trous[o.i].si = rank * 2 + 1; });
  }
  if (Array.isArray(c.departs)) {
    out.departs = c.departs.slice(0, 8).map(function(t) {
      t = t || {};
      return { id: id(t.id), name: txt(t.name, 30), rating: num(t.rating), slope: num(t.slope), longueur: num(t.longueur) };
    });
  }
  return out;
}

function saveUserCourse(course) {
  var userCourses = [];
  try {
    var raw = localStorage.getItem('tsg_user_courses');
    if (raw) userCourses = JSON.parse(raw) || [];
  } catch(e) {}

  // Si édition (id existant), remplacer
  var foundIdx = -1;
  for (var i = 0; i < userCourses.length; i++) {
    if (userCourses[i].id === course.id) { foundIdx = i; break; }
  }
  if (foundIdx >= 0) {
    userCourses[foundIdx] = course;
  } else {
    userCourses.push(course);
  }
  localStorage.setItem('tsg_user_courses', JSON.stringify(userCourses));
  // La synchro cloud est un bonus : si elle échoue, le parcours reste enregistré en local
  try { if (window.tsgSync) window.tsgSync.pushUserCourse(course); }
  catch (e) { console.warn('[TSG] sync pushUserCourse:', e.message); }
}

function deleteUserCourse(courseId) {
  var userCourses = [];
  try {
    var raw = localStorage.getItem('tsg_user_courses');
    if (raw) userCourses = JSON.parse(raw) || [];
  } catch(e) {}
  userCourses = userCourses.filter(function(c) { return c.id !== courseId; });
  localStorage.setItem('tsg_user_courses', JSON.stringify(userCourses));
  try { if (window.tsgSync) window.tsgSync.deleteUserCourse(courseId); }
  catch (e) { console.warn('[TSG] sync deleteUserCourse:', e.message); }
}
