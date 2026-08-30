/* ════════════════════════════════════════════
 * THE SMART GOLFER — app.js
 * Login, navigation, shell, boot
 * Dépend de : data.js
 * ════════════════════════════════════════════ */


/* ─── ÉTAT GLOBAL ─── */

/* ─── ÉTAT ─── */

var currentUser     = null;
var selectedProfile = null;


/* ─── LOCALSTORAGE ─── */

function lsGet(key) {
  try {
    var val = localStorage.getItem('tsg_' + key);
    return val ? JSON.parse(val) : null;
  } catch(e) {
    return null;
  }
}

function lsSet(key, value) {
  try {
    localStorage.setItem('tsg_' + key, JSON.stringify(value));
    return true;
  } catch(e) {
    return false;
  }
}


/* ─── TOAST ─── */

function showToast(msg) {
  var t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(function() {
    t.classList.remove('show');
  }, 2800);
}


/* ─── BUILD PROFILES (createElement - jamais innerHTML) ─── */

function buildProfiles() {
  var container = document.getElementById('profiles-list');
  if (!container) return;

  // Vider le container
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  var profiles = lsGet('profiles') || DEFAULT_PROFILES;

  profiles.forEach(function(p) {
    // Créer le bouton principal
    var btn = document.createElement('button');
    btn.className = 'profile-btn';
    btn.id = 'pb-' + p.id;
    btn.setAttribute('type', 'button');
    btn.setAttribute('data-pid', p.id);

    // Avatar
    var av = document.createElement('div');
    av.className = 'profile-avatar';
    av.style.background = p.bg;
    av.style.color = p.color;
    av.textContent = p.initials;

    // Infos
    var info = document.createElement('div');
    info.className = 'profile-info';

    var name = document.createElement('div');
    name.className = 'profile-name';
    name.textContent = p.name;

    var role = document.createElement('div');
    role.className = 'profile-role';
    role.style.color = p.color;
    var roleText = ROLE_LABELS[p.role] || p.role;
    if (p.hcp !== null && p.hcp !== undefined) {
      roleText += ' \u00b7 Hcp ' + p.hcp;
    }
    role.textContent = roleText;

    info.appendChild(name);
    info.appendChild(role);
    btn.appendChild(av);
    btn.appendChild(info);

    // Attacher le click PROPREMENT (closure pour capturer p.id)
    btn.addEventListener('click', (function(pid) {
      return function() { selectProfile(pid); };
    })(p.id));

    container.appendChild(btn);
  });

  // Auto-sélectionner le dernier profil ou le premier
  var lastId = lsGet('lastUser');
  var profiles2 = lsGet('profiles') || DEFAULT_PROFILES;
  var autoId = null;

  if (lastId) {
    for (var i = 0; i < profiles2.length; i++) {
      if (profiles2[i].id === lastId) { autoId = lastId; break; }
    }
  }

  if (!autoId && profiles2.length > 0) {
    autoId = profiles2[0].id;
  }

  if (autoId) selectProfile(autoId);
}

function selectProfile(id) {
  var profiles = lsGet('profiles') || DEFAULT_PROFILES;
  selectedProfile = null;

  for (var i = 0; i < profiles.length; i++) {
    if (profiles[i].id === id) {
      selectedProfile = profiles[i];
      break;
    }
  }

  // Mettre à jour l'UI
  var btns = document.querySelectorAll('.profile-btn');
  for (var j = 0; j < btns.length; j++) {
    btns[j].classList.remove('selected');
  }

  var target = document.getElementById('pb-' + id);
  if (target) target.classList.add('selected');
}


/* ─── LOGIN ─── */

function doLogin() {
  var nameEl = document.getElementById('inp-name');
  var hcpEl  = document.getElementById('inp-hcp');
  var roleEl = document.getElementById('inp-role');

  var nameVal = nameEl ? nameEl.value.trim() : '';

  if (nameVal) {
    // Créer un nouveau profil depuis le formulaire
    var hcpVal  = hcpEl  ? (parseFloat(hcpEl.value) || null) : null;
    var roleVal = roleEl ? (roleEl.value || 'player')        : 'player';

    // Générer les initiales
    var words    = nameVal.split(' ').filter(function(w) { return w.length > 0; });
    var initials = words.map(function(w) { return w[0].toUpperCase(); }).join('').slice(0, 2);
    if (!initials) initials = '?';

    // Couleur aléatoire parmi la palette
    var palette = [
      { color: '#C9A84C', bg: 'rgba(201,168,76,0.2)'   },
      { color: '#3D8A65', bg: 'rgba(61,138,101,0.2)'   },
      { color: '#85B7EB', bg: 'rgba(133,183,235,0.2)'  },
      { color: '#EF9F27', bg: 'rgba(239,159,39,0.2)'   },
      { color: '#AFA9EC', bg: 'rgba(175,169,236,0.2)'  },
      { color: '#F0997B', bg: 'rgba(240,153,123,0.2)'  }
    ];
    var pick = palette[Math.floor(Math.random() * palette.length)];

    var newProfile = {
      id:       'user_' + Date.now(),
      name:     nameVal,
      hcp:      hcpVal,
      role:     roleVal,
      color:    pick.color,
      bg:       pick.bg,
      initials: initials
    };

    // Ajouter aux profils sauvegardés
    var profiles = lsGet('profiles') || DEFAULT_PROFILES.slice();
    profiles.push(newProfile);
    lsSet('profiles', profiles);
    selectedProfile = newProfile;
  }

  // Fallback : utiliser le profil sélectionné, ou le premier par défaut
  if (!selectedProfile) {
    var allProfiles = lsGet('profiles') || DEFAULT_PROFILES;
    selectedProfile = allProfiles[0] || DEFAULT_PROFILES[0];
  }

  // Sauvegarder le dernier utilisateur
  lsSet('lastUser', selectedProfile.id);
  currentUser = selectedProfile;

  // Lancer l'application
  launchApp();
}


/* ─── LAUNCH APP ─── */

function launchApp() {
  // 1. Cacher le login
  var loginEl = document.getElementById('login-screen');
  if (loginEl) loginEl.style.display = 'none';

  // 2. Afficher l'app
  var appEl = document.getElementById('app');
  if (appEl) appEl.classList.add('visible');

  // 3. Mettre à jour la barre de navigation
  updateNavUI();

  // 3b. Injecter le bouton paramètres ⚙️ (Session 10)
  injectSettingsButton();

  // 4. Construire la navigation
  buildNavTabs();

  // 5. Construire les pages (chacune protégée)
  buildPages();

  // 6. Initialiser la scorecard
  try { initScorecardPage(); } catch(e) { console.warn('SC:', e.message); }

  // 6b. Initialiser l'analyse (placeholder, rempli au showPage)
  try { initAnalysePage(); } catch(e) { console.warn('Analyse:', e.message); }

  // 7. Activer la première page (showPage appelle buildDashboard avec destroy avant)
  showPage('dashboard');

  // 8. Confirmer
  showToast('Bienvenue ' + currentUser.name + ' \u2014 Bonne session !');

  // 9. Onboarding au tout premier lancement
  try { maybeShowOnboarding(); } catch (e) {}
}

/* \u2500\u2500\u2500 ONBOARDING (1er lancement) \u2500\u2500\u2500 */
function maybeShowOnboarding() {
  if (lsGet('onboarded')) return;
  var modal = document.createElement('div');
  modal.className = 'onb-modal';
  modal.innerHTML =
    '<div class="onb-card">'
    + '<div class="onb-hero"><div class="onb-hero-brand">The Smart Golfer</div>'
    +   '<div class="onb-hero-tag">Analyser \u00b7 Structurer \u00b7 Performer</div></div>'
    + '<div class="onb-body">'
    +   '<div class="onb-intro">Bienvenue ! Ici, tu progresses au golf <strong>par la donn\u00e9e et les d\u00e9cisions</strong>, pas par le swing.</div>'
    +   '<div class="onb-pillars">'
    +     '<div class="onb-pillar"><div class="onb-pillar-ico">1</div><div><div class="onb-pillar-t">Analyser</div><div class="onb-pillar-d">Saisis tes parties dans la Scorecard \u2192 ton Dashboard r\u00e9v\u00e8le tes forces et faiblesses.</div></div></div>'
    +     '<div class="onb-pillar"><div class="onb-pillar-ico">2</div><div><div class="onb-pillar-t">Structurer</div><div class="onb-pillar-d">Ton plan d\'entra\u00eenement te dit quoi travailler en priorit\u00e9. Fixe tes objectifs de saison.</div></div></div>'
    +     '<div class="onb-pillar"><div class="onb-pillar-ico">3</div><div><div class="onb-pillar-t">Performer</div><div class="onb-pillar-d">Rejoins ton coach et tes amis (Groupes) pour progresser ensemble.</div></div></div>'
    +   '</div>'
    +   '<button class="btn-login onb-btn" id="onb-start">C\'est parti \u2192</button>'
    + '</div></div>';
  document.body.appendChild(modal);
  function close() { lsSet('onboarded', true); modal.remove(); }
  document.getElementById('onb-start').addEventListener('click', close);
  modal.addEventListener('click', function(e) { if (e.target === modal) close(); });
}

/* ─── NAVIGATION UI ─── */


function calcHandicapFromRounds() {
  var rounds = lsGet('rounds') || [];
  if (rounds.length < 3) return null;
  // Prendre les 20 dernières parties
  var recent = rounds.slice(0, 20);
  // Extraire les différentiels valides
  var diffs = recent.map(function(r) { return r.diff; }).filter(function(d) {
    return d !== null && d !== undefined && !isNaN(d);
  });
  if (diffs.length < 3) return null;
  // Trier croissant et prendre les 8 meilleurs (ou moins si peu de parties)
  diffs.sort(function(a, b) { return a - b; });
  var n = Math.min(8, Math.max(3, Math.floor(diffs.length * 0.4)));
  var best = diffs.slice(0, n);
  var avg = best.reduce(function(a, b) { return a + b; }, 0) / best.length;
  return Math.round(avg * 10) / 10;
}

function updateNavUI() {
  if (!currentUser) return;

  // Avatar
  var av = document.getElementById('nav-av');
  if (av) {
    av.textContent       = currentUser.initials || '?';
    av.style.background  = currentUser.bg;
    av.style.color       = currentUser.color;
  }

  // Nom
  var nm = document.getElementById('nav-name');
  if (nm) nm.textContent = currentUser.name;

  // Handicap : calculer dynamiquement depuis les parties enregistrées
  var hcp = document.getElementById('nav-hcp');
  if (hcp) {
    var calculatedHcp = calcHandicapFromRounds();
    var displayHcp;
    if (calculatedHcp !== null) {
      displayHcp = calculatedHcp;
      currentUser.hcp = calculatedHcp; // Mettre à jour le profil
      // Sauvegarder le profil mis à jour
      var profiles = lsGet('profiles') || DEFAULT_PROFILES;
      for (var i = 0; i < profiles.length; i++) {
        if (profiles[i].id === currentUser.id) {
          profiles[i].hcp = calculatedHcp;
          break;
        }
      }
      lsSet('profiles', profiles);
    } else if (currentUser.hcp !== null && currentUser.hcp !== undefined) {
      displayHcp = currentUser.hcp;
    } else {
      displayHcp = '\u2014';
    }
    hcp.textContent = displayHcp;
  }

  // Badge rôle
  var rb = document.getElementById('nav-role');
  if (rb) {
    rb.textContent = ROLE_LABELS[currentUser.role] || currentUser.role;
    rb.className   = 'nav-role-badge ' + (ROLE_CSS[currentUser.role] || 'role-player');
  }

  // Clic sur l'utilisateur = déconnexion
  var navUser = document.getElementById('nav-user');
  if (navUser) {
    // Supprimer l'ancien listener s'il existe
    var newUser = navUser.cloneNode(true);
    navUser.parentNode.replaceChild(newUser, navUser);
    document.getElementById('nav-user').addEventListener('click', function() {
      if (confirm('Se d\u00e9connecter ?')) doLogout();
    });
  }
}

/* ─── BUILD NAV TABS ─── */

function navVisibleTabs() {
  return NAV_TABS.filter(function(t) { return !t.hidden; });
}

function buildNavTabs() {
  var container = document.getElementById('nav-tabs');
  if (!container) return;

  // Vider
  while (container.firstChild) container.removeChild(container.firstChild);

  navVisibleTabs().forEach(function(tab) {
    var btn = document.createElement('button');
    btn.className = 'nav-tab';
    btn.setAttribute('data-page', tab.page);

    var icon = document.createElement('span');
    icon.className = 'nav-tab-icon';
    icon.innerHTML = tab.icon;

    var label = document.createElement('span');
    label.textContent = tab.label;

    btn.appendChild(icon);
    btn.appendChild(label);

    btn.addEventListener('click', (function(page) {
      return function() { showPage(page); };
    })(tab.page));

    container.appendChild(btn);
  });

  // Construire aussi la barre du bas (mobile)
  buildBottomNav();
}

/* ─── BARRE DE NAVIGATION MOBILE (bas) + menu "Plus" ─── */

function buildBottomNav() {
  var bar = document.getElementById('bottomnav');
  if (!bar) return;
  while (bar.firstChild) bar.removeChild(bar.firstChild);

  var visible = navVisibleTabs();
  var primaries = visible.filter(function(t) { return t.primary; });
  var secondaries = visible.filter(function(t) { return !t.primary; });

  function makeItem(page, iconHtml, labelText, onClick) {
    var btn = document.createElement('button');
    btn.className = 'mnav-item';
    if (page) btn.setAttribute('data-page', page);
    var ic = document.createElement('span');
    ic.className = 'mnav-icon';
    ic.innerHTML = iconHtml;
    var lb = document.createElement('span');
    lb.className = 'mnav-label';
    lb.textContent = labelText;
    btn.appendChild(ic);
    btn.appendChild(lb);
    btn.addEventListener('click', onClick);
    return btn;
  }

  primaries.forEach(function(tab) {
    bar.appendChild(makeItem(tab.page, tab.icon, tab.short || tab.label, function() {
      showPage(tab.page);
    }));
  });

  // Bouton "Plus" (ouvre la feuille)
  bar.appendChild(makeItem(null, '&#8943;', 'Plus', function() { openNavSheet(); }));

  // Fermeture de la feuille via le fond (onclick = pas d'empilement de listeners)
  var bd = document.getElementById('nav-sheet-backdrop');
  if (bd) bd.onclick = closeNavSheet;

  // Construire le contenu de la feuille "Plus"
  var sheetList = document.getElementById('nav-sheet-list');
  if (sheetList) {
    while (sheetList.firstChild) sheetList.removeChild(sheetList.firstChild);
    secondaries.forEach(function(tab) {
      sheetList.appendChild(makeSheetRow(tab.icon, tab.label, function() {
        closeNavSheet(); showPage(tab.page);
      }));
    });
    // Paramètres
    sheetList.appendChild(makeSheetRow('&#9881;', 'Paramètres', function() {
      closeNavSheet(); if (typeof openSettingsModal === 'function') openSettingsModal();
    }));
    // Déconnexion
    sheetList.appendChild(makeSheetRow('&#9099;', 'Se déconnecter', function() {
      closeNavSheet(); if (confirm('Se déconnecter ?')) doLogout();
    }));
  }
}

function makeSheetRow(iconHtml, labelText, onClick) {
  var row = document.createElement('button');
  row.className = 'nav-sheet-row';
  var ic = document.createElement('span');
  ic.className = 'nav-sheet-icon';
  ic.innerHTML = iconHtml;
  var lb = document.createElement('span');
  lb.textContent = labelText;
  row.appendChild(ic);
  row.appendChild(lb);
  row.addEventListener('click', onClick);
  return row;
}

function openNavSheet() {
  var s = document.getElementById('nav-sheet');
  if (s) s.classList.add('open');
}
function closeNavSheet() {
  var s = document.getElementById('nav-sheet');
  if (s) s.classList.remove('open');
}

/* ─── BUILD PAGES ─── */

function buildPages() {
  var content = document.getElementById('app-content');
  if (!content) return;

  // Vider
  while (content.firstChild) content.removeChild(content.firstChild);

  NAV_TABS.forEach(function(tab) {
    var page = document.createElement('div');
    page.className = 'app-page';
    page.id = 'page-' + tab.page;

    // Initialiser chaque page dans un try/catch
    try {
      if (tab.page === 'dashboard') {
        buildDashboard(page);
      } else if (tab.page === 'scorecard') {
        // Scorecard initialisée séparément via initScorecardPage()
      } else if (tab.page === 'analyse') {
        // Analyse initialisée séparément via initAnalysePage()
      } else if (tab.page === 'courses') {
        buildCoursesPage(page);
      } else if (tab.page === 'training') {
        buildTrainingPage(page);
      } else if (tab.page === 'coach') {
        buildCoachPage(page);
      } else if (tab.page === 'groups') {
        buildGroupsPage(page);
      } else if (tab.page === 'community') {
        buildCommunityPage(page);
      } else {
        buildComingSoon(page, tab.label);
      }
    } catch(e) {
      console.warn('[TSG] Erreur init page ' + tab.page + ':', e.message);
      buildComingSoon(page, tab.label);
    }

    content.appendChild(page);
  });
}

/* ─── SHOW PAGE ─── */

function showPage(pageId) {
  // Désactiver tous les onglets et pages
  var tabs  = document.querySelectorAll('.nav-tab');
  var pages = document.querySelectorAll('.app-page');

  for (var i = 0; i < tabs.length; i++)  tabs[i].classList.remove('active');
  for (var j = 0; j < pages.length; j++) pages[j].classList.remove('active');

  // Barre du bas (mobile) : synchroniser l'état actif
  var mitems = document.querySelectorAll('.mnav-item');
  var isPrimary = false;
  for (var m = 0; m < mitems.length; m++) {
    var mp = mitems[m].getAttribute('data-page');
    mitems[m].classList.toggle('active', mp === pageId);
    if (mp === pageId) isPrimary = true;
  }
  // Si la page n'est pas dans la barre (page "Plus"), surligner le bouton Plus
  var plusBtn = document.querySelector('.mnav-item:not([data-page])');
  if (plusBtn) plusBtn.classList.toggle('active', !isPrimary);

  // Activer l'onglet
  var tabs2 = document.querySelectorAll('.nav-tab');
  for (var k = 0; k < tabs2.length; k++) {
    if (tabs2[k].getAttribute('data-page') === pageId) {
      tabs2[k].classList.add('active');
      break;
    }
  }

  // Activer la page
  var target = document.getElementById('page-' + pageId);
  if (target) target.classList.add('active');

  // Si on revient sur le dashboard : reconstruire pour avoir les vraies données
  if (pageId === 'dashboard' && target && typeof buildDashboard === 'function') {
    try {
      while (target.firstChild) target.removeChild(target.firstChild);
      buildDashboard(target);
    } catch(e) { console.warn('Dashboard rebuild:', e.message); }
  }
  // Si on va sur l'onglet Analyse : initialiser/rafraîchir
  if (pageId === 'analyse' && typeof initAnalysePage === 'function') {
    try { initAnalysePage(); } catch(e) { console.warn('Analyse init:', e.message); }
  }
  // Si on va sur l'onglet Parcours : reconstruire pour refléter les ajouts/suppressions
  if (pageId === 'courses' && target && typeof buildCoursesPage === 'function') {
    try { buildCoursesPage(target); } catch(e) { console.warn('Courses rebuild:', e.message); }
  }
  // Si on va sur l'onglet Entraînement : reconstruire (nouveaux exercices, réalisations)
  if (pageId === 'training' && target && typeof buildTrainingPage === 'function') {
    try { buildTrainingPage(target); } catch(e) { console.warn('Training rebuild:', e.message); }
  }
  // Si on va sur l'onglet Coach Hub : reconstruire (données joueurs à jour)
  if (pageId === 'coach' && target && typeof buildCoachPage === 'function') {
    try { buildCoachPage(target); } catch(e) { console.warn('Coach rebuild:', e.message); }
  }
  // Si on va sur l'onglet Groupes : revenir à la liste + reconstruire
  if (pageId === 'groups' && target && typeof buildGroupsPage === 'function') {
    try { _grpView = { mode: 'list' }; buildGroupsPage(target); } catch(e) { console.warn('Groups rebuild:', e.message); }
  }
  // Si on va sur l'onglet Communauté : reconstruire (XP, badges, fil à jour)
  if (pageId === 'community' && target && typeof buildCommunityPage === 'function') {
    try { buildCommunityPage(target); } catch(e) { console.warn('Community rebuild:', e.message); }
  }
}


/* ─── PAGE COMING SOON ─── */

function buildComingSoon(container, label) {
  var div = document.createElement('div');
  div.className = 'coming-soon';

  var icon = document.createElement('div');
  icon.className = 'coming-soon-icon';
  icon.textContent = '⚙';

  var h3 = document.createElement('h3');
  h3.textContent = label;

  var p = document.createElement('p');
  p.textContent = 'Cette section sera construite lors des prochaines sessions.';

  div.appendChild(icon);
  div.appendChild(h3);
  div.appendChild(p);
  container.appendChild(div);
}


/* ─── LOGOUT ─── */

function doLogout() {
  // Déconnexion cloud (Supabase) si session active
  if (typeof authSignOut === 'function') {
    try { authSignOut(); } catch (e) {}
  }

  currentUser     = null;
  selectedProfile = null;

  var appEl   = document.getElementById('app');
  var loginEl = document.getElementById('login-screen');

  if (appEl)   appEl.classList.remove('visible');
  if (loginEl) loginEl.style.display = 'flex';

  // Revenir à l'écran d'auth (masquer le mode démo)
  var authBox = document.getElementById('auth-box');
  var guest   = document.getElementById('guest-section');
  if (authBox) authBox.style.display = 'block';
  if (guest)   guest.style.display = 'none';
  var gTog = document.getElementById('auth-guest-toggle');
  if (gTog) gTog.textContent = 'Essayer en mode démo (sans compte)';

  // Nettoyer le formulaire
  var nameEl = document.getElementById('inp-name');
  var hcpEl  = document.getElementById('inp-hcp');
  if (nameEl) nameEl.value = '';
  if (hcpEl)  hcpEl.value  = '';

  // Reconstruire les profils
  buildProfiles();

  showToast('D\u00e9connect\u00e9 avec succ\u00e8s');
}


/* ─── CLAVIER ─── */

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    var appEl = document.getElementById('app');
    if (appEl && appEl.classList.contains('visible')) {
      if (confirm('Se d\u00e9connecter ?')) doLogout();
    }
  }
});


/* ─── BOUTON LOGIN ─── */

var btnEnter = document.getElementById('btn-enter');
if (btnEnter) {
  btnEnter.addEventListener('click', function() {
    doLogin();
  });
}

/* Permettre Entrée dans le formulaire */
var inputs = document.querySelectorAll('#inp-name, #inp-hcp, #inp-role');
for (var i = 0; i < inputs.length; i++) {
  inputs[i].addEventListener('keydown', function(e) {
    if (e.key === 'Enter') doLogin();
  });
}


/* ════════════════════════════════════════════
   SESSION 10 — PARAMÈTRES + EXPORT/IMPORT
════════════════════════════════════════════ */

function injectSettingsButton() {
  var navRight = document.querySelector('.nav-right');
  if (!navRight) return;
  // Eviter le doublon si déjà injecté
  if (document.getElementById('nav-settings-btn')) return;

  var btn = document.createElement('button');
  btn.id = 'nav-settings-btn';
  btn.className = 'nav-settings-btn';
  btn.title = 'Paramètres';
  btn.innerHTML = '\u2699';  // ⚙

  btn.addEventListener('click', function() {
    openSettingsModal();
  });

  // Insérer avant le nav-hcp-block (donc en premier dans nav-right)
  var firstChild = navRight.firstChild;
  if (firstChild) {
    navRight.insertBefore(btn, firstChild);
  } else {
    navRight.appendChild(btn);
  }
}

function openSettingsModal() {
  // Fermer modale existante
  var existing = document.getElementById('settings-modal');
  if (existing) existing.remove();

  // Compter les données actuelles
  var rounds = lsGet('rounds') || [];
  var userCourses = [];
  try {
    var raw = localStorage.getItem('tsg_user_courses');
    if (raw) userCourses = JSON.parse(raw) || [];
  } catch(e) {}
  var profiles = lsGet('profiles') || [];

  var modal = document.createElement('div');
  modal.id = 'settings-modal';
  modal.className = 'settings-modal';
  modal.innerHTML = ''
    + '<div class="settings-card">'
    +   '<div class="settings-header">'
    +     '<div>'
    +       '<div class="settings-title-tag">Configuration</div>'
    +       '<div class="settings-title">Param\u00e8tres</div>'
    +     '</div>'
    +     '<button class="settings-close" id="settings-close-btn">\u00d7</button>'
    +   '</div>'
    +   '<div class="settings-body">'
    +     '<div class="settings-section">'
    +       '<div class="settings-section-title">Mes donn\u00e9es</div>'
    +       '<div class="settings-section-sub">Sauvegarder ou restaurer toutes tes donn\u00e9es (parties, parcours, profils).</div>'
    +       '<div class="settings-stats">'
    +         '<div class="settings-stat"><div class="settings-stat-val">' + rounds.length + '</div><div class="settings-stat-lbl">Parties</div></div>'
    +         '<div class="settings-stat"><div class="settings-stat-val">' + userCourses.length + '</div><div class="settings-stat-lbl">Parcours cr\u00e9\u00e9s</div></div>'
    +         '<div class="settings-stat"><div class="settings-stat-val">' + profiles.length + '</div><div class="settings-stat-lbl">Profils</div></div>'
    +       '</div>'
    +       '<div class="settings-actions">'
    +         '<button class="settings-btn settings-btn-primary" id="settings-export-btn">'
    +           '<span class="settings-btn-icon">\u2913</span> Exporter mes donn\u00e9es'
    +         '</button>'
    +         '<button class="settings-btn settings-btn-secondary" id="settings-import-btn">'
    +           '<span class="settings-btn-icon">\u2912</span> Importer un fichier'
    +         '</button>'
    +         '<input type="file" id="settings-import-input" accept=".json,application/json" style="display:none">'
    +       '</div>'
    +       '<div class="settings-hint">Le fichier export\u00e9 contient toutes tes donn\u00e9es au format JSON. Garde-le pr\u00e9cieusement \u2014 il te permet de tout restaurer sur un autre appareil.</div>'
    +     '</div>'
    +     '<div class="settings-section">'
    +       '<div class="settings-section-title">\u00c0 propos</div>'
    +       '<div class="settings-about">'
    +         '<div><strong>The Smart Golfer</strong></div>'
    +         '<div>Version d\u00e9veloppement \u00b7 Session 10</div>'
    +         '<div style="margin-top:8px;font-size:11px;color:var(--tx3)">Analyser \u00b7 Structurer \u00b7 Performer</div>'
    +       '</div>'
    +     '</div>'
    +   '</div>'
    + '</div>';

  document.body.appendChild(modal);

  // Listeners
  document.getElementById('settings-close-btn').addEventListener('click', closeSettingsModal);
  modal.addEventListener('click', function(ev) { if (ev.target === modal) closeSettingsModal(); });

  document.getElementById('settings-export-btn').addEventListener('click', exportUserData);
  document.getElementById('settings-import-btn').addEventListener('click', function() {
    document.getElementById('settings-import-input').click();
  });
  document.getElementById('settings-import-input').addEventListener('change', function(ev) {
    var file = ev.target.files[0];
    if (file) importUserData(file);
  });
}

function closeSettingsModal() {
  var m = document.getElementById('settings-modal');
  if (m) m.remove();
}

function exportUserData() {
  try {
    var data = {
      version: 1,
      exportDate: new Date().toISOString(),
      app: 'The Smart Golfer',
      profiles: lsGet('profiles') || [],
      rounds: lsGet('rounds') || [],
      userCourses: [],
      lastUser: lsGet('lastUser') || null
    };

    try {
      var rawUC = localStorage.getItem('tsg_user_courses');
      if (rawUC) data.userCourses = JSON.parse(rawUC) || [];
    } catch(e) {}

    var json = JSON.stringify(data, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);

    // Créer le nom du fichier
    var now = new Date();
    var dateStr = now.getFullYear() + '-'
      + String(now.getMonth() + 1).padStart(2, '0') + '-'
      + String(now.getDate()).padStart(2, '0');
    var filename = 'smart-golfer-export-' + dateStr + '.json';

    // Déclencher le téléchargement
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Export r\u00e9ussi \u2713  ' + data.rounds.length + ' parties + ' + data.userCourses.length + ' parcours');
  } catch(ex) {
    console.error('Export :', ex);
    showToast('\u26a0 Erreur lors de l\'export : ' + ex.message);
  }
}

function importUserData(file) {
  var reader = new FileReader();
  reader.onload = function(ev) {
    try {
      var data = JSON.parse(ev.target.result);

      // Vérifier que c'est un export valide
      if (!data || data.app !== 'The Smart Golfer') {
        if (!confirm('Ce fichier ne semble pas \u00eatre un export The Smart Golfer. Continuer quand m\u00eame ?')) return;
      }

      // Préparer le décompte
      var imp = {
        rounds: Array.isArray(data.rounds) ? data.rounds : [],
        userCourses: Array.isArray(data.userCourses) ? data.userCourses : [],
        profiles: Array.isArray(data.profiles) ? data.profiles : []
      };

      // Détecter les doublons (parties)
      var existing = lsGet('rounds') || [];
      var existingIds = {};
      existing.forEach(function(r) {
        var key = (r.date || '') + '|' + (r.course || '') + '|' + (r.score || '');
        existingIds[key] = true;
      });
      var duplicates = 0;
      imp.rounds.forEach(function(r) {
        var key = (r.date || '') + '|' + (r.course || '') + '|' + (r.score || '');
        if (existingIds[key]) duplicates++;
      });

      // Si doublons, demander à l'utilisateur (option C)
      var strategy = 'merge';  // par défaut : ajouter sans doublon
      if (duplicates > 0) {
        var msg = duplicates + ' partie(s) du fichier existent d\u00e9j\u00e0 dans tes donn\u00e9es.\n\n'
          + 'OK = Tout remplacer (supprime ton historique et utilise uniquement le fichier)\n'
          + 'Annuler = Ignorer les doublons (garder ton historique + ajouter les parties nouvelles)';
        if (confirm(msg)) {
          strategy = 'replace';
        } else {
          strategy = 'merge';
        }
      }

      // Confirmation finale
      var preview = 'Import pr\u00eat :\n\n'
        + '\u2022 ' + imp.rounds.length + ' parties dans le fichier\n'
        + '\u2022 ' + imp.userCourses.length + ' parcours personnels\n'
        + '\u2022 ' + imp.profiles.length + ' profils\n\n'
        + 'Strat\u00e9gie : ' + (strategy === 'replace' ? 'TOUT REMPLACER' : 'AJOUTER les nouvelles parties (ignorer doublons)') + '\n\n'
        + 'Confirmer l\'import ?';

      if (!confirm(preview)) return;

      // Appliquer l'import
      if (strategy === 'replace') {
        lsSet('rounds', imp.rounds);
        if (imp.userCourses.length > 0) localStorage.setItem('tsg_user_courses', JSON.stringify(imp.userCourses));
        if (imp.profiles.length > 0) lsSet('profiles', imp.profiles);
      } else {
        // Merge : ajouter uniquement les non-doublons
        var newRounds = existing.slice();
        imp.rounds.forEach(function(r) {
          var key = (r.date || '') + '|' + (r.course || '') + '|' + (r.score || '');
          if (!existingIds[key]) {
            newRounds.unshift(r);
            existingIds[key] = true;
          }
        });
        // Garder l'ordre récent en premier (re-trier par date desc si possible)
        newRounds.sort(function(a, b) {
          var da = new Date(a.date || 0).getTime();
          var db = new Date(b.date || 0).getTime();
          return db - da;
        });
        lsSet('rounds', newRounds);

        // Pour les parcours utilisateur : ajouter ceux pas encore présents
        var existingUC = [];
        try {
          var rawUC = localStorage.getItem('tsg_user_courses');
          if (rawUC) existingUC = JSON.parse(rawUC) || [];
        } catch(e) {}
        var existingUCIds = {};
        existingUC.forEach(function(c) { existingUCIds[c.id] = true; });
        imp.userCourses.forEach(function(c) {
          if (!existingUCIds[c.id]) existingUC.push(c);
        });
        localStorage.setItem('tsg_user_courses', JSON.stringify(existingUC));
      }

      showToast('Import r\u00e9ussi \u2713  Rechargement...');
      closeSettingsModal();
      // Recharger pour appliquer
      setTimeout(function() { window.location.reload(); }, 1200);

    } catch(ex) {
      console.error('Import :', ex);
      alert('Erreur lors de l\'import : ' + ex.message + '\n\nV\u00e9rifie que le fichier est un export The Smart Golfer valide.');
    }
  };
  reader.onerror = function() {
    alert('Erreur de lecture du fichier');
  };
  reader.readAsText(file);
}
