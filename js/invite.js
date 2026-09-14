/* ════════════════════════════════════════════
 * THE SMART GOLFER — invite.js
 * INVITATION À UN GROUPE PAR LIEN OU QR CODE.
 * Avant : il fallait dicter un code de 6 caractères, que l'ami devait
 * retrouver dans l'onglet Groupes après avoir créé son compte.
 * Maintenant : un lien (ou un scan) → compte → groupe rejoint.
 *
 * Parcours d'un invité :
 *   1. ouvre …/?join=A1B2C3  → le code est mis de côté (tsg_pendingJoin)
 *      et retiré de l'URL (il survit ainsi au retour de connexion Google)
 *   2. page d'accueil / connexion : bandeau « Tu es invité dans un groupe »
 *   3. une fois connecté : confirmation → join_group → page du groupe
 *
 * Dépend de : app.js (lsGet/lsSet/showToast/showPage), qrcode.js, groups.js.
 * RPC facultative group_preview (backend/social.sql) : affiche le nom du
 * groupe avant d'accepter. Sans elle, l'invitation marche quand même.
 * ════════════════════════════════════════════ */

var INV_TTL_DAYS = 14;

function invSanitize(code) {
  var c = String(code || '').trim().toUpperCase();
  return /^[A-Z0-9]{4,12}$/.test(c) ? c : null;
}

/* Accepte un code OU un lien d'invitation collé */
function invExtractCode(input) {
  var s = String(input || '').trim();
  var m = s.match(/[?&#]join=([A-Za-z0-9]{4,12})/);
  return invSanitize(m ? m[1] : s);
}

function invBaseUrl() {
  return location.origin + location.pathname.replace(/index\.html$/, '');
}

function invLink(code) {
  return invBaseUrl() + '?join=' + encodeURIComponent(code);
}

/* À appeler le plus tôt possible (boot.js), avant toute redirection */
function invCaptureFromUrl() {
  var code = null;
  try { code = invSanitize(new URLSearchParams(location.search).get('join')); } catch (e) {}
  if (!code) return null;
  lsSet('pendingJoin', { code: code, ts: Date.now() });
  try {
    var params = new URLSearchParams(location.search);
    params.delete('join');
    var qs = params.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
  } catch (e) {}
  return code;
}

function invPending() {
  var p = lsGet('pendingJoin');
  if (!p || !invSanitize(p.code)) return null;
  if (Date.now() - (p.ts || 0) > INV_TTL_DAYS * 86400000) { invClearPending(); return null; }
  return p;
}

function invClearPending() {
  try { localStorage.removeItem('tsg_pendingJoin'); } catch (e) {}
}

/* Bandeau sur la page d'accueil et sur l'écran de connexion */
function invRenderAuthBanners() {
  var p = invPending();
  document.querySelectorAll('.inv-banner').forEach(function(b) { b.remove(); });
  if (!p) return;
  var html = '<span class="inv-banner-ico">🎟️</span><div><strong>Tu es invité dans un groupe</strong>'
    + '<div class="inv-banner-sub">Crée ton compte (ou connecte-toi) : tu le rejoindras automatiquement.</div></div>';

  var cta = document.querySelector('#landing .ld-cta');
  if (cta) {
    var b1 = document.createElement('div');
    b1.className = 'inv-banner inv-banner-dark';
    b1.innerHTML = html;
    cta.parentNode.insertBefore(b1, cta);
  }
  var box = document.getElementById('auth-box');
  if (box) {
    var b2 = document.createElement('div');
    b2.className = 'inv-banner';
    b2.innerHTML = html;
    box.insertBefore(b2, box.firstChild);
    // Un invité n'a en général pas encore de compte
    if (!lsGet('lastUser')) {
      var tab = document.getElementById('auth-tab-signup');
      if (tab) tab.click();
    }
  }
}

/* ─────────────── APRÈS LA CONNEXION ─────────────── */

function invProcessPending() {
  var p = invPending();
  if (!p) return;
  // Ne pas superposer à l'accueil du tout premier lancement
  var tries = 0;
  (function waitOnboarding() {
    if (document.querySelector('.onb-modal') && tries++ < 300) { setTimeout(waitOnboarding, 700); return; }
    invAskJoin(p.code);
  })();
}

function invAskJoin(code) {
  if (!window.tsgCloud || !window.sbClient) {
    invModal({
      tag: 'Invitation',
      title: 'Rejoindre un groupe',
      body: '<p class="inv-text">Un ami t\'a invité dans son groupe (code <strong>' + code + '</strong>).</p>'
        + '<p class="inv-text">Les groupes relient plusieurs joueurs : il te faut un <strong>compte</strong> — le mode démo reste sur ce téléphone. '
        + 'L\'invitation est gardée : crée ton compte et tu rejoindras le groupe automatiquement.</p>',
      primary: 'Créer mon compte',
      secondary: 'Plus tard',
      onPrimary: function() {
        if (typeof doLogout === 'function') doLogout();
        setTimeout(function() {
          invRenderAuthBanners();
          var tab = document.getElementById('auth-tab-signup');
          if (tab) tab.click();
        }, 50);
      }
    });
    return;
  }

  var modal = invModal({
    tag: 'Invitation',
    title: 'Rejoindre le groupe ?',
    body: '<div class="inv-preview" id="inv-preview"><div class="ch-loading">Chargement…</div></div>',
    primary: 'Rejoindre',
    secondary: 'Refuser',
    onSecondary: function() { invClearPending(); showToast('Invitation ignorée'); },
    onPrimary: function() { invJoin(code); }
  });
  var box = modal.querySelector('#inv-preview');

  function fallback() {
    box.innerHTML = '<div class="inv-group-name">Code ' + code + '</div>'
      + '<div class="inv-text">Un ami t\'invite à rejoindre son groupe : classement, fil d\'activité et discussion entre vous.</div>';
  }
  window.sbClient.rpc('group_preview', { p_code: code }).then(function(res) {
    var d = res && res.data;
    if (res.error || !d) { fallback(); return; }        // RPC pas encore installée
    if (!d.ok) {
      box.innerHTML = '<div class="inv-text">Ce lien d\'invitation ne correspond plus à aucun groupe (le groupe a peut-être été supprimé).</div>';
      var prim = modal.querySelector('.inv-primary');
      if (prim) { prim.textContent = 'Fermer'; prim.onclick = function() { modal.remove(); }; }
      invClearPending();
      return;
    }
    if (d.is_member) {
      box.innerHTML = '<div class="inv-group-name">' + grpEsc(d.name) + '</div>'
        + '<div class="inv-text">Tu fais déjà partie de ce groupe.</div>';
      var pr = modal.querySelector('.inv-primary');
      if (pr) pr.textContent = 'Voir le groupe';
      return;
    }
    box.innerHTML = '<div class="inv-group-name">' + grpEsc(d.name) + '</div>'
      + '<div class="inv-group-meta">' + d.members + ' membre' + (d.members > 1 ? 's' : '')
      + (d.owner_name ? ' · créé par ' + grpEsc(d.owner_name) : '') + '</div>'
      + '<div class="inv-text">Classement, fil d\'activité et discussion entre vous.</div>';
  }, fallback);
}

function invJoin(code) {
  window.sbClient.rpc('join_group', { p_code: code }).then(function(res) {
    var d = res.data;
    if (res.error || !d || !d.ok) {
      showToast((d && d.error) || (res.error && res.error.message) || 'Impossible de rejoindre le groupe');
      if (d && d.error === 'Code introuvable') invClearPending();
      return;
    }
    invClearPending();
    showToast('Tu as rejoint « ' + (d.group_name || 'le groupe') + ' » ✓');
    // showPage('groups') remet la vue sur la liste : ouvrir le détail APRÈS
    if (typeof showPage === 'function') showPage('groups');
    _grpView = { mode: 'detail', groupId: d.group_id, groupName: d.group_name || '' };
    if (typeof grpRefresh === 'function') grpRefresh();
  }, function(e) { showToast('Réseau indisponible — réessaie plus tard'); });
}

/* Petite modale générique (réutilise le style des modales Entraînement) */
function invModal(o) {
  var old = document.getElementById('inv-modal');
  if (old) old.remove();
  var modal = document.createElement('div');
  modal.id = 'inv-modal';
  modal.className = 'trn-modal';
  modal.innerHTML = '<div class="trn-modal-card" style="max-width:440px">'
    + '<div class="trn-modal-head"><div><div class="trn-modal-tag">' + o.tag + '</div>'
    +   '<div class="trn-modal-title">' + o.title + '</div></div>'
    +   '<button class="trn-modal-close" type="button">×</button></div>'
    + '<div class="trn-modal-body">' + o.body + '</div>'
    + ((o.primary || o.secondary) ? '<div class="trn-modal-actions">'
    +   (o.secondary ? '<button class="dash-btn dash-btn-outline inv-secondary" type="button">' + o.secondary + '</button>' : '')
    +   (o.primary ? '<button class="dash-btn dash-btn-gold inv-primary" type="button">' + o.primary + '</button>' : '')
    + '</div>' : '')
    + '</div>';
  document.body.appendChild(modal);
  function close() { modal.remove(); }
  modal.querySelector('.trn-modal-close').addEventListener('click', close);
  modal.addEventListener('click', function(e) { if (e.target === modal) close(); });
  var sec = modal.querySelector('.inv-secondary');
  if (sec) sec.addEventListener('click', function() { close(); if (o.onSecondary) o.onSecondary(); });
  var prim = modal.querySelector('.inv-primary');
  if (prim) prim.onclick = function() { close(); if (o.onPrimary) o.onPrimary(); };
  return modal;
}

/* ─────────────── CÔTÉ HÔTE : INVITER ─────────────── */

function invOpenShare(group) {
  if (!group || !group.invite_code) return;
  var link = invLink(group.invite_code);
  var qr = '';
  try { qr = qrSvg(link, { dark: '#0f2a1e' }); } catch (e) { qr = ''; }
  var canShare = !!navigator.share;

  var modal = invModal({
    tag: 'Inviter',
    title: grpEsc(group.name),
    body: (qr ? '<div class="inv-qr">' + qr + '</div>'
            + '<div class="inv-qr-hint">Fais scanner ce code avec l\'appareil photo de ton ami</div>' : '')
      + '<div class="inv-link-row"><input class="obj-input inv-link" readonly value="' + grpEsc(link) + '"></div>'
      + '<div class="inv-actions">'
      +   '<button class="dash-btn dash-btn-outline" type="button" id="inv-copy">Copier le lien</button>'
      +   (canShare ? '<button class="dash-btn dash-btn-gold" type="button" id="inv-share">Partager…</button>' : '')
      + '</div>'
      + '<div class="inv-code-line">Ou donne le code <strong>' + grpEsc(group.invite_code) + '</strong></div>'
  });

  var input = modal.querySelector('.inv-link');
  input.addEventListener('focus', function() { input.select(); });
  modal.querySelector('#inv-copy').addEventListener('click', function() {
    function done() { showToast('Lien copié ✓'); }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(link).then(done, function() { input.select(); document.execCommand('copy'); done(); });
      } else { input.select(); document.execCommand('copy'); done(); }
    } catch (e) { showToast('Copie impossible — sélectionne le lien'); }
  });
  var sh = modal.querySelector('#inv-share');
  if (sh) sh.addEventListener('click', function() {
    navigator.share({
      title: 'The Smart Golfer',
      text: 'Rejoins mon groupe « ' + group.name + ' » sur The Smart Golfer ⛳',
      url: link
    }).catch(function() {});
  });
}
