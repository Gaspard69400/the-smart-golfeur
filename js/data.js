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
/* Seul Lyon Salvagny est inclus pour l'instant.
   Les autres parcours seront ajoutés par l'utilisateur lui-même
   via la fonctionnalité "Ajouter mon parcours" (Session 8). */

const COURSES = [{"id":"golf-lyon-salvagny","name":"Lyon Salvagny Golf Club","region":"Auvergne-Rhône-Alpes","departement":"Rhône","ville":"La Tour-de-Salvagny","cp":"69890","sss":73.8,"slope":138,"par_total":72,"longueur_totale":6107,"rating":73.8,"type":"18 trous","niveau":"Expert","trous":[{"num":1,"par":4,"longueur":358,"si":11},{"num":2,"par":5,"longueur":472,"si":5},{"num":3,"par":4,"longueur":332,"si":13},{"num":4,"par":3,"longueur":152,"si":17},{"num":5,"par":4,"longueur":388,"si":3},{"num":6,"par":5,"longueur":488,"si":7},{"num":7,"par":4,"longueur":368,"si":9},{"num":8,"par":4,"longueur":408,"si":1},{"num":9,"par":3,"longueur":165,"si":15},{"num":10,"par":4,"longueur":348,"si":12},{"num":11,"par":4,"longueur":410,"si":2},{"num":12,"par":4,"longueur":348,"si":14},{"num":13,"par":3,"longueur":158,"si":18},{"num":14,"par":5,"longueur":482,"si":8},{"num":15,"par":4,"longueur":378,"si":4},{"num":16,"par":3,"longueur":138,"si":16},{"num":17,"par":5,"longueur":502,"si":6},{"num":18,"par":4,"longueur":365,"si":10}]}];

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
  { page: 'coach',       icon: '&#9678;', label: 'Coach Hub',    short: 'Coach',   primary: true  },
  { page: 'analyse',     icon: '&#9672;', label: 'Analyse',      short: 'Analyse', primary: false },
  { page: 'groups',      icon: '&#9673;', label: 'Groupes',      short: 'Groupes', primary: false },
  { page: 'courses',     icon: '&#9971;', label: 'Parcours',     short: 'Parcours',primary: false },
  { page: 'articles',    icon: '&#9638;', label: 'Biblioth\u00e8que', short: 'Articles',primary: false, hidden: true },
  { page: 'leaderboard', icon: '&#8801;', label: 'Classements',  short: 'Classt',  primary: false, hidden: true }
];

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

function getAllCourses() {
  var userCourses = [];
  try {
    var raw = localStorage.getItem('tsg_user_courses');
    if (raw) userCourses = JSON.parse(raw) || [];
  } catch(e) {
    console.warn('Lecture parcours utilisateur :', e.message);
  }
  // Marquer les parcours utilisateur avec un flag
  userCourses.forEach(function(c) { c.userCreated = true; });
  return COURSES.concat(userCourses);
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
  if (window.tsgSync) window.tsgSync.pushUserCourse(course);
}

function deleteUserCourse(courseId) {
  var userCourses = [];
  try {
    var raw = localStorage.getItem('tsg_user_courses');
    if (raw) userCourses = JSON.parse(raw) || [];
  } catch(e) {}
  userCourses = userCourses.filter(function(c) { return c.id !== courseId; });
  localStorage.setItem('tsg_user_courses', JSON.stringify(userCourses));
  if (window.tsgSync) window.tsgSync.deleteUserCourse(courseId);
}
