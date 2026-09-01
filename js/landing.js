/* ════════════════════════════════════════════
 * THE SMART GOLFER — landing.js
 * PAGE D'ACCUEIL PUBLIQUE — ce que voit quelqu'un qui reçoit le lien.
 * Avant, on tombait direct sur un écran de connexion, sans savoir
 * de quoi il s'agissait : le pire accueil possible pour un testeur.
 *
 * Ne s'affiche qu'à la 1re visite : dès qu'on a un profil local ou une
 * session cloud, on va directement à la connexion (puis à l'app).
 *
 * Dépend de : app.js (lsGet/lsSet).
 * ════════════════════════════════════════════ */

/* Un visiteur qui a déjà utilisé l'app ne doit pas la revoir */
function landingShouldShow() {
  try {
    if (lsGet('landingSeen')) return false;
    if (lsGet('lastUser')) return false;                       // profil démo déjà utilisé
    if ((lsGet('rounds') || []).length) return false;          // des parties existent
    var profiles = lsGet('profiles');
    if (profiles && profiles.length > 4) return false;         // profils perso créés
  } catch (e) {}
  return true;
}

function landingHide(remember) {
  var el = document.getElementById('landing');
  if (el) el.classList.add('ld-hidden');
  document.body.classList.remove('ld-open');
  if (remember !== false) { try { lsSet('landingSeen', true); } catch (e) {} }
}

function landingShow() {
  var el = document.getElementById('landing');
  if (!el) return;
  el.classList.remove('ld-hidden');
  document.body.classList.add('ld-open');
}

/* Le visiteur veut créer un compte → connexion, onglet « Créer un compte » */
function landingGoSignup() {
  landingHide();
  var tab = document.getElementById('auth-tab-signup');
  if (tab) tab.click();
  var name = document.getElementById('auth-name');
  if (name) { try { name.focus(); } catch (e) {} }
}

/* Le visiteur veut juste essayer → connexion, section mode démo dépliée */
function landingGoDemo() {
  landingHide();
  var box = document.getElementById('guest-section');
  var tog = document.getElementById('auth-guest-toggle');
  if (box && (box.style.display === 'none' || !box.style.display) && tog) {
    tog.click();   // réutilise la bascule existante (elle reconstruit les profils)
  }
  if (box) { try { box.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (e) {} }
}

function landingInit() {
  var el = document.getElementById('landing');
  if (!el) return;

  [['ld-signup', landingGoSignup], ['ld-signup-2', landingGoSignup],
   ['ld-demo', landingGoDemo],     ['ld-demo-2', landingGoDemo]].forEach(function(pair) {
    var b = document.getElementById(pair[0]);
    if (b) b.addEventListener('click', pair[1]);
  });

  if (landingShouldShow()) landingShow();
  else landingHide(false);
}
