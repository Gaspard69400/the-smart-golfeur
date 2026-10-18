/* ════════════════════════════════════════════
 * THE SMART GOLFER — profile.js
 * ONGLET PROFIL (S71) — 5e espace de la navigation.
 * Regroupe ce qui était éparpillé : identité + index, niveau et trophées
 * (venus de Communauté), et les raccourcis qui vivaient dans le menu « Plus »
 * (Mes stats, Parcours, Coach, Paramètres, déconnexion).
 *
 * Dépend de : app.js (currentUser, lsGet, showPage, doLogout, openSettingsModal,
 * calcHandicapFromRounds), community.js (commRenderProgress), friends.js,
 * whs.js (openWhsModal), install.js (insShareApp).
 * ════════════════════════════════════════════ */

function prfEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function prfIndex() {
  var idx = null;
  try { if (typeof calcHandicapFromRounds === 'function') idx = calcHandicapFromRounds(); } catch (e) {}
  if (idx === null || idx === undefined) idx = (currentUser && currentUser.hcp !== null && currentUser.hcp !== undefined) ? currentUser.hcp : null;
  return idx;
}

function prfFmt(n) { return (n === null || n === undefined || isNaN(n)) ? '—' : String(Math.round(n * 10) / 10).replace('.', ','); }

/* Une ligne de raccourci : titre, sous-titre, action */
function prfRow(key, title, sub) {
  return '<button type="button" class="prf-row" data-prf="' + key + '">'
    + '<span class="prf-row-txt"><span class="prf-row-t">' + title + '</span>'
    + (sub ? '<span class="prf-row-s">' + sub + '</span>' : '') + '</span>'
    + '<svg class="prf-row-chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>'
    + '</button>';
}

function buildProfilePage(container) {
  if (!container || !currentUser) return;
  while (container.firstChild) container.removeChild(container.firstChild);

  var u = currentUser;
  var cloud = typeof frdCloud === 'function' && frdCloud();
  var rounds = lsGet('rounds') || [];
  var idx = prfIndex();
  var title = null;
  try {
    var playing = (u.role === 'player' || u.role === 'captain' || !u.role);
    if (playing && typeof commCurrentLevel === 'function') { var cl = commCurrentLevel(); title = cl.level.title + ' · Niv. ' + cl.level.level; }
  } catch (e) {}
  if (!title) title = (typeof ROLE_LABELS !== 'undefined' && ROLE_LABELS[u.role]) || 'Joueur';

  var wrap = document.createElement('div');
  wrap.className = 'dash-wrap prf-wrap';
  wrap.innerHTML = ''
    + '<div class="prf-head">'
    +   '<div class="prf-av" style="background:' + prfEsc(u.bg || 'var(--gold-dim)') + ';color:' + prfEsc(u.color || 'var(--gold-d)') + '">' + prfEsc(u.initials || '?') + '</div>'
    +   '<div class="prf-id">'
    +     '<div class="prf-name">' + prfEsc(u.name || 'Golfeur') + '</div>'
    +     '<div class="prf-sub">' + prfEsc(title) + (cloud ? '' : ' · mode démo') + '</div>'
    +   '</div>'
    + '</div>'
    + '<div class="prf-kpis">'
    +   '<button type="button" class="prf-kpi prf-kpi-main" data-prf="whs"><span class="prf-kpi-v">' + prfFmt(idx) + '</span><span class="prf-kpi-l">Index</span></button>'
    +   '<div class="prf-kpi"><span class="prf-kpi-v">' + rounds.length + '</span><span class="prf-kpi-l">Partie' + (rounds.length > 1 ? 's' : '') + '</span></div>'
    +   '<button type="button" class="prf-kpi" data-prf="friends"><span class="prf-kpi-v" id="prf-friends-n">' + (cloud ? '…' : '—') + '</span><span class="prf-kpi-l">Amis</span></button>'
    + '</div>'
    + '<div class="prf-list">'
    +   (cloud ? prfRow('public', 'Mon profil public', 'Ce que voient tes amis') : '')
    +   prfRow('stats', 'Mes stats détaillées', 'Coups gagnés et perdus, évolution')
    +   prfRow('courses', 'Mes parcours', 'Ajouter ou modifier un parcours')
    +   prfRow('coach', 'Mes coachs', 'Un ou plusieurs coachs, avec leur code')
    +   prfRow('invite', 'Inviter un ami', 'Lien ou QR code')
    +   prfRow('settings', 'Paramètres', 'Apparence, sauvegardes, confidentialité')
    +   prfRow('logout', 'Se déconnecter', '')
    + '</div>'
    + '<div class="prf-progress"></div>';
  container.appendChild(wrap);

  // Niveau, trophées du mois et trophées à paliers (community.js)
  if (typeof commRenderProgress === 'function') {
    try { commRenderProgress(wrap.querySelector('.prf-progress')); } catch (e) { console.warn('[TSG] trophées:', e.message); }
  }

  // Nombre d'amis (cloud)
  if (cloud && typeof frdLoad === 'function') {
    var nEl = wrap.querySelector('#prf-friends-n');
    frdLoad(function(list) {
      if (!nEl) return;
      nEl.textContent = (list || []).filter(function(f) { return f.status === 'friends'; }).length;
    });
  }

  wrap.addEventListener('click', function(e) {
    var b = e.target.closest('[data-prf]');
    if (!b) return;
    var k = b.getAttribute('data-prf');
    if (k === 'whs' && typeof openWhsModal === 'function') openWhsModal();
    else if (k === 'friends') showPage('community');
    else if (k === 'public' && typeof frdOpenProfile === 'function') frdOpenProfile(u.id);
    else if (k === 'stats') showPage('analyse');
    else if (k === 'courses') showPage('courses');
    else if (k === 'coach') showPage('coach');
    else if (k === 'invite') {
      if (cloud && typeof frdOpenAdd === 'function') frdOpenAdd();
      else if (typeof insShareApp === 'function') insShareApp();
    }
    else if (k === 'settings' && typeof openSettingsModal === 'function') openSettingsModal();
    else if (k === 'logout') { if (confirm('Se déconnecter ?')) doLogout(); }
  });
}
