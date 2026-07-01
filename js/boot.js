/* ════════════════════════════════════════════
 * THE SMART GOLFER — boot.js
 * Démarrage : reprend une session Supabase si elle existe,
 * sinon affiche l'écran de connexion (auth cloud + mode démo).
 * Chargé EN DERNIER.
 * ════════════════════════════════════════════ */

(function init() {
  // Préparer l'UI d'authentification
  if (typeof initAuthUI === 'function') {
    try { initAuthUI(); } catch (e) { console.warn('[TSG] initAuthUI:', e.message); }
  }

  // Préparer les profils de démo (dans la section repliée)
  if (typeof buildProfiles === 'function') {
    try { buildProfiles(); } catch (e) {}
  }

  // Reprendre une session Supabase si présente (auto-login cloud).
  // Si connecté : onAuthenticated() lance l'app. Sinon : on reste sur le login.
  if (typeof authBootstrap === 'function') {
    authBootstrap(function(loggedIn) { /* rien de plus */ });
  }
})();
