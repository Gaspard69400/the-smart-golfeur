/* ════════════════════════════════════════════
 * THE SMART GOLFER — boot.js
 * Démarrage de l'application
 * Chargé EN DERNIER, après tous les autres modules
 * Dépend de : data.js, app.js, dashboard.js, scorecard.js, radar.js, analyse.js
 * ════════════════════════════════════════════ */

/* ─── BOOT ─── */

(function init() {
  // Construire les profils dans le login
  buildProfiles();

  // Auto-login si un utilisateur est mémorisé
  var lastId = lsGet('lastUser');
  if (lastId) {
    var profiles = lsGet('profiles') || DEFAULT_PROFILES;
    for (var i = 0; i < profiles.length; i++) {
      if (profiles[i].id === lastId) {
        currentUser     = profiles[i];
        selectedProfile = profiles[i];
        launchApp();
        return;
      }
    }
  }
  // Sinon afficher le login
})();
