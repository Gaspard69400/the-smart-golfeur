/* ════════════════════════════════════════════
 * THE SMART GOLFER — account.js
 * COMPTE & CONFIDENTIALITÉ (RGPD) + STATISTIQUES D'USAGE ANONYMES.
 *
 * - Supprimer mon compte : RPC delete_my_account (backend/maj_septembre_2026.sql).
 *   Toutes les tables suivent en cascade ; les groupes que je possède sont
 *   d'abord confiés au plus ancien membre (sinon ils disparaîtraient pour tous).
 * - Effacer les données de cet appareil (mode démo, ou après suppression).
 * - Page « Confidentialité » : ce qui est stocké, qui le voit, comment l'effacer.
 * - Statistiques d'usage : un compteur de pages vues PAR JOUR, sans identifiant
 *   ni adresse ; désactivable. Sert à savoir quels écrans servent vraiment.
 *
 * Dépend de : app.js (lsGet/lsSet/showToast/doLogout), auth.js, safety.js.
 * ════════════════════════════════════════════ */

var ACC_CONFIRM_WORD = 'SUPPRIMER';

function accEsc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* Section insérée dans les Paramètres */
function accRenderSettingsSection(host) {
  if (!host) return;
  var cloud = !!(window.tsgCloud && window.sbClient);
  var email = (cloud && window._sbSession && window._sbSession.user) ? window._sbSession.user.email : '';
  host.innerHTML = ''
    + '<div class="settings-section-sub">' + (cloud
        ? 'Connecté avec <strong>' + accEsc(email || 'ton compte') + '</strong>. Tes parties sont synchronisées dans le cloud.'
        : 'Mode démo : tes parties et tes réglages restent sur cet appareil.') + '</div>'
    + '<div class="acc-row">'
    +   '<button class="settings-btn settings-btn-secondary" id="acc-privacy-btn" type="button">Confidentialité</button>'
    +   '<label class="acc-toggle"><input type="checkbox" id="acc-usage-toggle"' + (accUsageEnabled() ? ' checked' : '') + '>'
    +     '<span>Statistiques d\'usage anonymes</span></label>'
    + '</div>'
    + '<div class="acc-danger">'
    +   (cloud
        ? '<button class="acc-danger-btn" id="acc-delete-btn" type="button">Supprimer mon compte</button>'
          + '<div class="settings-hint">Efface définitivement ton compte et toutes tes données en ligne (parties, parcours, messages, groupes). Pense à exporter tes données avant.</div>'
        : '<button class="acc-danger-btn" id="acc-wipe-btn" type="button">Effacer les données de cet appareil</button>'
          + '<div class="settings-hint">Supprime toutes les parties, parcours et sauvegardes enregistrés sur ce téléphone.</div>')
    + '</div>';

  host.querySelector('#acc-privacy-btn').addEventListener('click', accOpenPrivacy);
  host.querySelector('#acc-usage-toggle').addEventListener('change', function(e) {
    lsSet('usageOptOut', !e.target.checked);
    showToast(e.target.checked ? 'Statistiques d\'usage activées' : 'Statistiques d\'usage désactivées');
  });
  var del = host.querySelector('#acc-delete-btn');
  if (del) del.addEventListener('click', accOpenDelete);
  var wipe = host.querySelector('#acc-wipe-btn');
  if (wipe) wipe.addEventListener('click', accOpenWipe);
}

/* ─────────────── SUPPRESSION DU COMPTE ─────────────── */

function accModal(tag, title, bodyHtml) {
  var old = document.getElementById('acc-modal');
  if (old) old.remove();
  var m = document.createElement('div');
  m.id = 'acc-modal';
  m.className = 'trn-modal acc-modal';
  m.innerHTML = '<div class="trn-modal-card" style="max-width:460px">'
    + '<div class="trn-modal-head"><div><div class="trn-modal-tag">' + tag + '</div>'
    +   '<div class="trn-modal-title">' + title + '</div></div>'
    +   '<button class="trn-modal-close" type="button">×</button></div>'
    + '<div class="trn-modal-body">' + bodyHtml + '</div></div>';
  document.body.appendChild(m);
  function close() { m.remove(); }
  m.querySelector('.trn-modal-close').addEventListener('click', close);
  m.addEventListener('click', function(e) { if (e.target === m) close(); });
  return m;
}

function accOpenDelete() {
  var rounds = (lsGet('rounds') || []).length;
  var m = accModal('Compte', 'Supprimer mon compte', ''
    + '<div class="acc-warn">Cette action est <strong>définitive</strong>. Il n\'y a pas de corbeille.</div>'
    + '<ul class="acc-list">'
    +   '<li>Ton compte et ton profil</li>'
    +   '<li>Tes ' + rounds + ' partie' + (rounds > 1 ? 's' : '') + ', tes objectifs et tes parcours</li>'
    +   '<li>Tes messages, tes inscriptions aux tournois, tes liens coach</li>'
    +   '<li>Tes groupes : ceux que tu as créés passent au plus ancien membre (ou disparaissent si tu es seul)</li>'
    + '</ul>'
    + '<button class="settings-btn settings-btn-secondary acc-export" type="button" id="acc-export">⤓ Exporter mes données d\'abord</button>'
    + '<label class="obj-label" for="acc-confirm">Pour confirmer, tape <strong>' + ACC_CONFIRM_WORD + '</strong></label>'
    + '<input class="obj-input" id="acc-confirm" autocomplete="off" autocapitalize="characters" spellcheck="false">'
    + '<div class="ch-join-error" id="acc-err" style="display:none"></div>'
    + '<div class="trn-modal-actions acc-actions">'
    +   '<button class="dash-btn dash-btn-outline" type="button" id="acc-cancel">Annuler</button>'
    +   '<button class="acc-danger-btn" type="button" id="acc-go" disabled>Supprimer définitivement</button>'
    + '</div>');

  var input = m.querySelector('#acc-confirm'), go = m.querySelector('#acc-go'), err = m.querySelector('#acc-err');
  m.querySelector('#acc-cancel').addEventListener('click', function() { m.remove(); });
  m.querySelector('#acc-export').addEventListener('click', function() { if (typeof exportUserData === 'function') exportUserData(); });
  input.addEventListener('input', function() { go.disabled = input.value.trim().toUpperCase() !== ACC_CONFIRM_WORD; });
  go.addEventListener('click', function() {
    if (input.value.trim().toUpperCase() !== ACC_CONFIRM_WORD) return;
    go.disabled = true; go.textContent = 'Suppression…'; err.style.display = 'none';
    window.sbClient.rpc('delete_my_account').then(function(res) {
      var d = res && res.data;
      if (res.error || !d || !d.ok) {
        var msg = (res.error && res.error.message) || (d && d.error) || '';
        err.style.display = 'block';
        err.textContent = /delete_my_account|function|schema cache/i.test(msg)
          ? 'La suppression de compte n\'est pas encore activée sur le serveur. Rien n\'a été supprimé.'
          : 'La suppression a échoué (' + msg + '). Rien n\'a été supprimé — réessaie avec du réseau.';
        go.disabled = false; go.textContent = 'Supprimer définitivement';
        return;
      }
      accWipeDevice().then(function() {
        m.remove();
        accFarewell();
      });
    }, function() {
      err.style.display = 'block';
      err.textContent = 'Pas de réseau : rien n\'a été supprimé. Réessaie connecté.';
      go.disabled = false; go.textContent = 'Supprimer définitivement';
    });
  });
}

function accOpenWipe() {
  var m = accModal('Appareil', 'Effacer les données de cet appareil', ''
    + '<div class="acc-warn">Toutes les parties, parcours, programmes et sauvegardes automatiques de ce téléphone seront effacés.</div>'
    + '<button class="settings-btn settings-btn-secondary acc-export" type="button" id="acc-export">⤓ Exporter mes données d\'abord</button>'
    + '<div class="trn-modal-actions acc-actions">'
    +   '<button class="dash-btn dash-btn-outline" type="button" id="acc-cancel">Annuler</button>'
    +   '<button class="acc-danger-btn" type="button" id="acc-go">Tout effacer</button>'
    + '</div>');
  m.querySelector('#acc-cancel').addEventListener('click', function() { m.remove(); });
  m.querySelector('#acc-export').addEventListener('click', function() { if (typeof exportUserData === 'function') exportUserData(); });
  m.querySelector('#acc-go').addEventListener('click', function() {
    accWipeDevice().then(function() { m.remove(); accFarewell(true); });
  });
}

/* Efface tout ce que l'app a posé sur l'appareil (localStorage tsg_*, sauvegardes IndexedDB, session) */
function accWipeDevice() {
  try { if (window.sbClient) window.sbClient.auth.signOut(); } catch (e) {}
  window.tsgCloud = false;
  try {
    Object.keys(localStorage).forEach(function(k) { if (k.indexOf('tsg_') === 0) localStorage.removeItem(k); });
  } catch (e) {}
  try { sessionStorage.clear(); } catch (e) {}
  return new Promise(function(resolve) {
    try {
      var req = indexedDB.deleteDatabase('tsg-backups');
      req.onsuccess = req.onerror = req.onblocked = function() { resolve(); };
      setTimeout(resolve, 1500);
    } catch (e) { resolve(); }
  });
}

function accFarewell(localOnly) {
  document.querySelectorAll('.settings-modal').forEach(function(x) { x.remove(); });
  var m = accModal(localOnly ? 'Appareil' : 'Compte', localOnly ? 'Données effacées' : 'Compte supprimé',
    '<p class="inv-text">' + (localOnly
      ? 'Plus aucune donnée The Smart Golfer n\'est stockée sur cet appareil.'
      : 'Ton compte et tes données ont été supprimés. Merci d\'avoir essayé The Smart Golfer.') + '</p>'
    + '<div class="trn-modal-actions"><button class="dash-btn dash-btn-gold" type="button" id="acc-bye">Fermer</button></div>');
  function restart() { location.href = location.pathname; }
  m.querySelector('#acc-bye').addEventListener('click', restart);
  m.querySelector('.trn-modal-close').addEventListener('click', restart);
}

/* ─────────────── CONFIDENTIALITÉ ─────────────── */

function accOpenPrivacy() {
  accModal('Tes données', 'Confidentialité', ''
    + '<div class="acc-privacy">'
    + '<h4>Ce qui est enregistré</h4>'
    + '<p>Ton nom, ton handicap, ton rôle, tes parties (scores, putts, fairways, greens, notes), tes objectifs, tes parcours, '
    +   'tes exercices et, si tu les utilises, tes messages, groupes et inscriptions aux tournois.</p>'
    + '<h4>Où</h4>'
    + '<p><strong>Mode démo</strong> : uniquement sur ton appareil. <strong>Avec un compte</strong> : aussi dans notre base de données '
    +   '(hébergée par Supabase), pour les retrouver sur un autre appareil. Ton mot de passe n\'est jamais visible par l\'app ; '
    +   'avec Google, nous ne recevons que ton nom et ton email.</p>'
    + '<h4>Qui le voit</h4>'
    + '<p>Toi. Les membres de tes <strong>groupes</strong> voient ton profil et tes parties (classement, fil d\'activité). '
    +   'Un <strong>coach</strong> que tu as rejoint voit tes parties et peut t\'écrire. Un parcours que tu choisis de partager est visible par tous les inscrits.</p>'
    + '<h4>Ce qu\'on ne fait pas</h4>'
    + '<p>Pas de publicité, pas de revente, pas de pisteur tiers. Les polices de caractères sont chargées depuis Google Fonts.</p>'
    + '<h4>Statistiques d\'usage</h4>'
    + '<p>Pour savoir quels écrans servent, l\'app compte les pages ouvertes <strong>par jour</strong>, sans identifiant, sans adresse, sans lien avec ton compte. '
    +   'Tu peux les désactiver dans les Paramètres.</p>'
    + '<h4>Tes droits</h4>'
    + '<p>Paramètres → <strong>Exporter mes données</strong> (fichier complet) et <strong>Supprimer mon compte</strong> (effacement définitif, immédiat).</p>'
    + '</div>');
}

/* ─────────────── STATISTIQUES D'USAGE ANONYMES ─────────────── */

var _accTrackBroken = false;

function accUsageEnabled() { return !lsGet('usageOptOut'); }

/* Une page comptée au plus une fois par session de navigation */
function accTrackPage(page) {
  if (_accTrackBroken || !accUsageEnabled() || !window.sbClient) return;
  if (!/^[a-z_-]{2,24}$/.test(page || '')) return;
  if (navigator.onLine === false) return;
  var key = 'tsg_tracked_' + page;
  try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); } catch (e) { return; }
  try {
    window.sbClient.rpc('track_page', { p_page: page }).then(function(res) {
      if (res && res.error) _accTrackBroken = true;     // fonction pas encore installée : on arrête
    }, function() {});
  } catch (e) {}
}
