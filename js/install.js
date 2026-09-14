/* ════════════════════════════════════════════
 * THE SMART GOLFER — install.js
 * INSTALLER L'APP SUR SON TÉLÉPHONE + FAIRE DÉCOUVRIR L'APP (QR code).
 *
 * L'app est une PWA : installée, elle s'ouvre en plein écran depuis l'écran
 * d'accueil et marche sans réseau. Mais personne ne le sait :
 *  - Android / Chrome : on garde l'événement beforeinstallprompt et on
 *    propose un vrai bouton « Installer ».
 *  - iPhone (Safari) : pas de bouton possible → mode d'emploi en 3 étapes.
 * Bandeau discret sur le Dashboard (mobile, app pas encore installée),
 * masquable 14 jours.
 * « Faire découvrir l'app » : QR code du site + partage, pour qu'un ami
 * l'ouvre en scannant ton écran.
 *
 * Chargé tôt (l'événement d'installation peut arriver avant le lancement).
 * ════════════════════════════════════════════ */

var _insPrompt = null;

window.addEventListener('beforeinstallprompt', function(e) {
  e.preventDefault();                 // on garde la main : bouton dans notre bandeau
  _insPrompt = e;
  var b = document.getElementById('ins-banner');
  if (b) b.hidden = false;
});

window.addEventListener('appinstalled', function() {
  _insPrompt = null;
  try { lsSet('installDone', true); } catch (e) {}
  var b = document.getElementById('ins-banner');
  if (b) b.remove();
  if (typeof showToast === 'function') showToast('App installée ✓ Retrouve-la sur ton écran d\'accueil');
  if (typeof accTrackPage === 'function') accTrackPage('installed');
});

function insIsStandalone() {
  try {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  } catch (e) { return false; }
}

function insPlatform() {
  var ua = navigator.userAgent || '';
  var iOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (iOS) return /CriOS|FxiOS|EdgiOS/.test(ua) ? 'ios-other' : 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

var INS_SHARE_ICON = '<svg class="ins-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M12 3v12M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>';
var INS_ADD_ICON = '<svg class="ins-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

function insOpen() {
  var old = document.getElementById('ins-modal');
  if (old) old.remove();
  var p = insPlatform(), body;
  if (insIsStandalone()) {
    body = '<p class="inv-text">✓ L\'app est déjà installée : tu l\'utilises en ce moment depuis ton écran d\'accueil.</p>';
  } else if (_insPrompt) {
    body = '<p class="inv-text">Un tap et The Smart Golfer rejoint ton écran d\'accueil : plein écran, ouverture instantanée, et elle <strong>marche sans réseau</strong> sur le parcours.</p>'
      + '<button class="btn-express" type="button" id="ins-go"><span class="btn-express-t">📲 Installer l\'app</span><span class="btn-express-s">gratuit · aucune boutique d\'applications</span></button>';
  } else if (p === 'ios') {
    body = '<p class="inv-text">Sur iPhone, l\'installation se fait depuis <strong>Safari</strong>, en 3 gestes :</p>'
      + '<ol class="ins-steps">'
      + '<li><span class="ins-n">1</span><span>Touche le bouton <strong>Partager</strong> ' + INS_SHARE_ICON + ' en bas de l\'écran</span></li>'
      + '<li><span class="ins-n">2</span><span>Fais défiler et choisis <strong>« Sur l\'écran d\'accueil »</strong> ' + INS_ADD_ICON + '</span></li>'
      + '<li><span class="ins-n">3</span><span>Touche <strong>« Ajouter »</strong> en haut à droite</span></li>'
      + '</ol><p class="ins-note">L\'icône The Smart Golfer apparaît avec tes autres apps. Elle s\'ouvre en plein écran et marche sans réseau.</p>';
  } else if (p === 'ios-other') {
    body = '<p class="inv-text">Sur iPhone, ouvre ce site dans <strong>Safari</strong> (pas Chrome ni Firefox), puis : Partager ' + INS_SHARE_ICON + ' → « Sur l\'écran d\'accueil ».</p>'
      + '<button class="dash-btn dash-btn-outline" type="button" id="ins-copy">Copier l\'adresse pour Safari</button>';
  } else if (p === 'android') {
    body = '<p class="inv-text">Dans Chrome, touche le menu <strong>⋮</strong> en haut à droite, puis <strong>« Installer l\'application »</strong> (ou « Ajouter à l\'écran d\'accueil »).</p>';
  } else {
    body = '<p class="inv-text">Sur ordinateur, clique sur l\'icône d\'installation ' + INS_ADD_ICON + ' à droite de la barre d\'adresse (Chrome, Edge). '
      + 'Sur ton téléphone, le plus simple : scanne le code ci-dessous et installe l\'app depuis là.</p>'
      + '<div class="inv-qr">' + insQr() + '</div>';
  }
  var m = document.createElement('div');
  m.id = 'ins-modal';
  m.className = 'trn-modal ins-modal';
  m.innerHTML = '<div class="trn-modal-card" style="max-width:420px">'
    + '<div class="trn-modal-head"><div><div class="trn-modal-tag">Sur ton téléphone</div>'
    +   '<div class="trn-modal-title">Installer l\'app</div></div><button class="trn-modal-close" type="button">×</button></div>'
    + '<div class="trn-modal-body">' + body + '</div></div>';
  document.body.appendChild(m);
  m.querySelector('.trn-modal-close').addEventListener('click', function() { m.remove(); });
  m.addEventListener('click', function(e) { if (e.target === m) m.remove(); });
  var go = m.querySelector('#ins-go');
  if (go) go.addEventListener('click', function() {
    var ev = _insPrompt;
    if (!ev) return;
    ev.prompt();
    ev.userChoice.then(function(c) {
      m.remove();
      if (c && c.outcome === 'accepted') { _insPrompt = null; lsSet('installDone', true); }
    }, function() { m.remove(); });
  });
  var cp = m.querySelector('#ins-copy');
  if (cp) cp.addEventListener('click', function() { insCopy(insAppUrl()); });
}

function insAppUrl() { return location.origin + location.pathname.replace(/index\.html$/, ''); }

function insQr() {
  try { return (typeof qrSvg === 'function') ? qrSvg(insAppUrl()) : ''; } catch (e) { return ''; }
}

function insCopy(text) {
  try {
    navigator.clipboard.writeText(text).then(function() { showToast('Adresse copiée ✓'); }, function() { showToast(text); });
  } catch (e) { showToast(text); }
}

/* Bandeau sur le Dashboard (téléphone, pas encore installée) */
function insRenderBanner(wrap) {
  if (!wrap || insIsStandalone() || lsGet('installDone')) return;
  var p = insPlatform();
  if (p === 'desktop') return;
  var dismissed = lsGet('installDismissed');
  if (dismissed && Date.now() - dismissed < 14 * 86400000) return;
  var b = document.createElement('div');
  b.id = 'ins-banner';
  b.className = 'ins-banner';
  b.innerHTML = '<span class="ins-b-ico">📲</span><div class="ins-b-txt"><strong>Installe l\'app sur ton téléphone</strong>'
    + '<span>Plein écran, plus rapide, et elle marche sans réseau au golf.</span></div>'
    + '<button class="dash-btn dash-btn-gold" type="button" id="ins-b-go">' + (_insPrompt ? 'Installer' : 'Comment ?') + '</button>'
    + '<button class="ins-b-x" type="button" aria-label="Masquer">×</button>';
  var header = wrap.querySelector('.dash-header');
  if (header && header.nextSibling) wrap.insertBefore(b, header.nextSibling); else wrap.insertBefore(b, wrap.firstChild);
  b.querySelector('#ins-b-go').addEventListener('click', insOpen);
  b.querySelector('.ins-b-x').addEventListener('click', function() { lsSet('installDismissed', Date.now()); b.remove(); });
}

/* ─── Faire découvrir l'app à un ami ─── */
function insShareApp() {
  var old = document.getElementById('ins-share');
  if (old) old.remove();
  var url = insAppUrl();
  var m = document.createElement('div');
  m.id = 'ins-share';
  m.className = 'trn-modal ins-modal';
  m.innerHTML = '<div class="trn-modal-card" style="max-width:400px">'
    + '<div class="trn-modal-head"><div><div class="trn-modal-tag">Fais découvrir l\'app</div>'
    +   '<div class="trn-modal-title">Scanne pour ouvrir The Smart Golfer</div></div><button class="trn-modal-close" type="button">×</button></div>'
    + '<div class="trn-modal-body">'
    +   '<div class="inv-qr">' + insQr() + '</div>'
    +   '<div class="inv-qr-hint">Ton ami pointe l\'appareil photo de son téléphone vers ce code. Gratuit, sans rien télécharger.</div>'
    +   '<div class="inv-actions"><button class="dash-btn dash-btn-outline" type="button" id="ins-s-copy">Copier le lien</button>'
    +   (navigator.share ? '<button class="dash-btn dash-btn-gold" type="button" id="ins-s-share">Partager…</button>' : '') + '</div>'
    + '</div></div>';
  document.body.appendChild(m);
  m.querySelector('.trn-modal-close').addEventListener('click', function() { m.remove(); });
  m.addEventListener('click', function(e) { if (e.target === m) m.remove(); });
  m.querySelector('#ins-s-copy').addEventListener('click', function() { insCopy(url); });
  var sh = m.querySelector('#ins-s-share');
  if (sh) sh.addEventListener('click', function() {
    navigator.share({ title: 'The Smart Golfer', text: 'Je suis mes parties de golf avec The Smart Golfer : stats, défis entre amis, carte partagée. Essaie ⛳', url: url }).catch(function() {});
  });
}
