/* ════════════════════════════════════════════
 * THE SMART GOLFER — polish.js
 * FINITIONS : retour tactile, chiffres qui s'animent, réglage « Vibrations ».
 * (Les chargements en squelette et les animations d'apparition sont en CSS.)
 *
 * Tout est désactivé si le téléphone demande de réduire les animations
 * (prefers-reduced-motion), et la vibration se coupe dans les Paramètres.
 * Aucun module n'a été modifié : on écoute les gestes et on enveloppe
 * showToast / openSettingsModal. Chargé après app.js.
 * ════════════════════════════════════════════ */

function tsgReducedMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
}

function tsgHapticsOn() { return lsGet('haptics') !== false; }

/* Vibration courte (Android ; ignorée sans bruit ailleurs, iPhone compris) */
function tsgHaptic(kind) {
  if (!tsgHapticsOn() || !navigator.vibrate) return;
  try { navigator.vibrate(kind === 'success' ? [14, 50, 22] : (kind === 'light' ? 6 : 10)); } catch (e) {}
}

/* Les boutons de saisie répondent au doigt */
var TSG_TAP_TARGETS = '.qs-quick, .qs-step, .qs-putt, .qs-opt-b, .sgm-b, .sgm-allpar, .comm-kudos, .qs-cell, .hn-club, .theme-opt';
document.addEventListener('pointerdown', function(e) {
  var t = e.target.closest && e.target.closest(TSG_TAP_TARGETS);
  if (t && !t.disabled) tsgHaptic(t.classList.contains('qs-cell') || t.classList.contains('theme-opt') ? 'light' : 'tap');
}, { passive: true, capture: true });

/* Une bonne nouvelle se sent aussi (partie enregistrée, défi, objectif…) */
(function wrapToast() {
  if (typeof showToast !== 'function') return;
  var original = showToast;
  showToast = function(msg) {
    original.apply(this, arguments);
    if (/✓|🏆|🎯|bravo/i.test(String(msg || ''))) tsgHaptic('success');
  };
})();

/* ─── Chiffres qui montent jusqu'à leur valeur ─── */

function tsgCountUp(el, duration) {
  if (!el || el._tsgCounted || tsgReducedMotion()) return;
  var txt = el.textContent;
  var m = txt.match(/^([^\d\-+]*)([+\-−]?)(\d+(?:[.,]\d+)?)(.*)$/);
  if (!m) return;
  el._tsgCounted = true;
  var sep = m[3].indexOf(',') !== -1 ? ',' : '.';
  var decimals = (m[3].split(/[.,]/)[1] || '').length;
  var target = parseFloat(m[3].replace(',', '.'));
  if (!isFinite(target) || target === 0) return;
  var start = null, dur = duration || 650;
  function frame(ts) {
    if (!start) start = ts;
    var k = Math.min(1, (ts - start) / dur);
    var eased = 1 - Math.pow(1 - k, 3);
    var v = (target * eased).toFixed(decimals);
    el.textContent = m[1] + m[2] + (sep === ',' ? v.replace('.', ',') : v) + m[4];
    if (k < 1) requestAnimationFrame(frame);
    else el.textContent = txt;                       // valeur exacte d'origine à la fin
  }
  requestAnimationFrame(frame);
}

/* Dès qu'un tableau de bord est (re)construit, ses grands chiffres s'animent */
(function watchDashboard() {
  function run(root) {
    root.querySelectorAll('.kpi-value, .slv-h, .comm-hero-xp, .pts-kpi-v').forEach(function(el) {
      // .slv-h contient une étiquette <small> : on anime seulement le nombre final
      if (el.querySelector('small')) {
        var node = Array.prototype.slice.call(el.childNodes).reverse().find(function(n) { return n.nodeType === 3 && /\d/.test(n.textContent); });
        if (!node) return;
        var span = document.createElement('span');
        span.textContent = node.textContent.trim();
        el.replaceChild(span, node);
        el.appendChild(document.createTextNode(''));
        tsgCountUp(span);
        return;
      }
      tsgCountUp(el);
    });
  }
  function attach() {
    ['page-dashboard', 'page-community', 'page-analyse'].forEach(function(id) {
      var pg = document.getElementById(id);
      if (!pg || pg._tsgWatched) return;
      pg._tsgWatched = true;
      var pending = false;
      new MutationObserver(function() {
        if (pending) return;
        pending = true;
        requestAnimationFrame(function() { pending = false; if (pg.classList.contains('active')) run(pg); });
      }).observe(pg, { childList: true, subtree: true });
    });
  }
  var tries = 0;
  (function wait() {
    attach();
    if (!document.getElementById('page-dashboard') && tries++ < 120) setTimeout(wait, 500);
  })();
  document.addEventListener('click', function() { setTimeout(attach, 0); }, true);
})();

/* ─── Réglage « Vibrations » dans Paramètres → Apparence ─── */
(function wrapSettings() {
  if (typeof openSettingsModal !== 'function') return;
  var original = openSettingsModal;
  openSettingsModal = function() {
    original.apply(this, arguments);
    var picker = document.getElementById('theme-picker');
    if (!picker || document.getElementById('tsg-haptics-toggle')) return;
    var row = document.createElement('label');
    row.className = 'acc-toggle tsg-haptics-row';
    row.innerHTML = '<input type="checkbox" id="tsg-haptics-toggle"' + (tsgHapticsOn() ? ' checked' : '') + '>'
      + '<span>Vibrations à la saisie' + (navigator.vibrate ? '' : ' <em>(non prises en charge sur cet appareil)</em>') + '</span>';
    picker.parentNode.appendChild(row);
    row.querySelector('input').addEventListener('change', function(e) {
      lsSet('haptics', e.target.checked);
      if (e.target.checked) tsgHaptic('success');
    });
  };
})();
