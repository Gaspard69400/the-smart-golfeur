/* ════════════════════════════════════════════
 * THE SMART GOLFER — admin.js
 * PILOTAGE (S66) : compteur de joueurs actifs, réservé au compte admin.
 *
 * Objectif de Gaspard : 20 joueurs qui enregistrent au moins une partie
 * CHAQUE SEMAINE d'ici le 15 décembre 2026 — sans le compter lui. Avant
 * cette session, aucun moyen de mesurer ce chiffre.
 *
 * Tout vient de la RPC `admin_weekly_stats()` (backend/maj_pilotage.sql) :
 * elle ne renvoie des chiffres QUE si `profiles.is_admin` est vrai pour le
 * compte connecté (vérifié côté serveur, pas côté app — un autre compte qui
 * l'appelle reçoit une erreur, jamais de données). Rien n'est stocké en
 * clair côté client au-delà de la session en cours.
 *
 * Section entièrement invisible (même son titre) pour un compte normal :
 * `admRenderSettingsSection` ne touche au DOM que si `currentUser.is_admin`.
 * Dépend de : app.js (currentUser, showToast), account.js (accModal pas
 * utilisé ici — section directement dans les Paramètres).
 * ════════════════════════════════════════════ */

var ADMIN_TARGET = 20;   // objectif : joueurs actifs par semaine, cap 15 déc. 2026

function admEsc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* dd/mm, en local (les semaines viennent de Postgres en UTC minuit — un simple slice suffit) */
function admDateShort(iso) {
  var p = String(iso).split('-');
  return p.length === 3 ? (p[2] + '/' + p[1]) : iso;
}

function admRenderSettingsSection(host) {
  var wrap = document.getElementById('settings-admin-wrap');
  if (!wrap) return;
  if (!host || !currentUser || !currentUser.is_admin || !window.tsgCloud || !window.sbClient) {
    wrap.style.display = 'none';
    return;
  }
  wrap.style.display = '';
  host.innerHTML = '<div class="ch-loading">Chargement…</div>';

  window.sbClient.rpc('admin_weekly_stats').then(function(res) {
    if (res.error || !res.data) {
      var msg = (res.error && res.error.message) || '';
      host.innerHTML = '<div class="ch-empty-inline">' + (/admin_weekly_stats|schema cache/i.test(msg)
        ? 'Le SQL « pilotage » (backend/maj_pilotage.sql) n\'est pas encore exécuté.'
        : /acc.s r.serv/i.test(msg)
        ? 'Ce compte n\'est pas marqué admin dans Supabase.'
        : 'Chargement impossible pour l\'instant.') + '</div>';
    } else {
      admRenderStats(host, res.data);
    }
  }, function() {
    host.innerHTML = '<div class="ch-empty-inline">Pas de réseau.</div>';
  });
}

function admRenderStats(host, weeks) {
  if (!weeks || !weeks.length) { host.innerHTML = '<div class="ch-empty-inline">Pas encore de données.</div>'; return; }
  var current = weeks[weeks.length - 1];   // la RPC renvoie les semaines du plus ancien au plus récent
  var rows = weeks.slice().reverse();      // affichage : semaine en cours en premier

  var pct = Math.min(100, Math.round((current.active_players / ADMIN_TARGET) * 100));
  var headline = '<div class="adm-headline">'
    + '<div class="adm-headline-t">Joueurs actifs cette semaine</div>'
    + '<div class="adm-headline-v">' + current.active_players + ' <span>/ ' + ADMIN_TARGET + '</span></div>'
    + '<div class="adm-headline-bar"><span style="width:' + pct + '%"></span></div>'
    + '<div class="adm-headline-sub">Objectif : 20 joueurs actifs par semaine d\'ici le 15 décembre 2026</div>'
    + '</div>';

  var table = '<div class="adm-table">'
    + '<div class="adm-row adm-head"><span>Semaine du</span><span>Comptes créés</span><span>Joueurs actifs</span><span>Parties</span><span>Avis</span></div>'
    + rows.map(function(w) {
        return '<div class="adm-row' + (w.is_current ? ' adm-cur' : '') + '">'
          + '<span>' + admDateShort(w.week_start) + (w.is_current ? ' <em>en cours</em>' : '') + '</span>'
          + '<span>' + w.new_accounts + '</span>'
          + '<span>' + w.active_players + '</span>'
          + '<span>' + w.rounds_logged + '</span>'
          + '<span>' + w.feedback_count + '</span>'
          + '</div>';
      }).join('')
    + '</div>';

  var note = '<div class="settings-hint">Comptes de test (@smartgolfer.test) et ton propre compte exclus de tous ces chiffres. '
    + '« Actif » = au moins une partie enregistrée cette semaine-là.</div>';

  host.innerHTML = headline + table + note;
}
