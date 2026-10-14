/* ════════════════════════════════════════════
 * THE SMART GOLFER — boot.js
 * Démarrage : reprend une session Supabase si elle existe,
 * sinon affiche l'écran de connexion (auth cloud + mode démo).
 * Chargé EN DERNIER.
 * ════════════════════════════════════════════ */

(function init() {
  // Lien d'invitation (?join=CODE) : mis de côté AVANT tout (retour de connexion Google compris)
  if (typeof invCaptureFromUrl === 'function') {
    try { invCaptureFromUrl(); } catch (e) { console.warn('[TSG] invitation:', e.message); }
  }
  if (typeof sgmCaptureFromUrl === 'function') {
    try { sgmCaptureFromUrl(); } catch (e) { console.warn('[TSG] partie partagée:', e.message); }
  }
  // Lien d'ami (?ami=CODE) : gardé jusqu'à la connexion, inscription comprise
  if (typeof coachCaptureFromUrl === 'function') {
    try { coachCaptureFromUrl(); } catch (e) { console.warn('[TSG] lien coach:', e.message); }
  }
  if (typeof frdCaptureFromUrl === 'function') {
    try { frdCaptureFromUrl(); } catch (e) { console.warn('[TSG] lien d\'ami:', e.message); }
  }

  // Page d'accueil (1re visite uniquement)
  if (typeof landingInit === 'function') {
    try { landingInit(); } catch (e) { console.warn('[TSG] landing:', e.message); }
  }

  // Préparer l'UI d'authentification
  if (typeof initAuthUI === 'function') {
    try { initAuthUI(); } catch (e) { console.warn('[TSG] initAuthUI:', e.message); }
  }

  // Bandeau « Tu es invité dans un groupe »
  if (typeof invRenderAuthBanners === 'function') {
    try { invRenderAuthBanners(); } catch (e) {}
  }
  // Bandeau « Un ami t'invite »
  if (typeof frdRenderAuthBanners === 'function') {
    try { frdRenderAuthBanners(); } catch (e) {}
  }
  // Bandeau « Espace coach » (lien …/?coach)
  if (typeof coachRenderAuthBanners === 'function') {
    try { coachRenderAuthBanners(); } catch (e) {}
  }

  // Préparer les profils de démo (dans la section repliée)
  if (typeof buildProfiles === 'function') {
    try { buildProfiles(); } catch (e) {}
  }

  // Reprendre une session Supabase si présente (auto-login cloud).
  // Si connecté : onAuthenticated() lance l'app. Sinon : on reste sur le login.
  if (typeof authBootstrap === 'function') {
    authBootstrap(function(loggedIn) {
      // Session retrouvée → l'app démarre, la page d'accueil n'a plus lieu d'être
      if (loggedIn && typeof landingHide === 'function') landingHide();
    });
  }
})();
