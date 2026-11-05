/* ════════════════════════════════════════════
 * THE SMART GOLFER — wintermotiv.js
 * MOTIVATION D'HIVER (S89) : garder les joueurs actifs sans compétition.
 *
 *  · « Mon hiver » (onglet Entraînement) : heures cumulées depuis le
 *    1er novembre, paliers (5 h → 100 h), série de semaines à 2 séances
 *    ou plus, minutes des 8 dernières semaines.
 *  · Carte « Ton hiver » sur l'Accueil (de novembre à février, ou dès
 *    qu'une séance est notée depuis 30 jours) : la semaine en cours, la
 *    série, et « Noter une séance » en un geste.
 *  · Bilan du lundi : un message une fois par semaine sur la semaine passée.
 *  · Défi d'hiver dans chaque groupe : classement des minutes
 *    d'entraînement (semaine / depuis le 1er novembre) via la fonction
 *    serveur `group_training_board` (backend/maj_defi_hiver.sql) — totaux
 *    seulement, réservés aux membres. Panneau masqué si indisponible.
 *
 * Dépend de : traininglog.js (tlAll, tlMonday, tlEsc, tlOpenFree,
 *             tlRenderPanel), winter.js (winIsWinter), app.js.
 * ════════════════════════════════════════════ */

var WM_TIERS = [
  { h: 5,   l: 'Bien lancé' },
  { h: 10,  l: 'Régulier' },
  { h: 25,  l: 'Acharné' },
  { h: 50,  l: 'Hiver de champion' },
  { h: 100, l: 'Légende de l\'hiver' }
];

/* 1er novembre de l'hiver en cours (de novembre à avril inclus), sinon null */
function wmSeasonStart(d) {
  d = d || new Date();
  var m = d.getMonth();
  if (m >= 10) return new Date(d.getFullYear(), 10, 1);
  if (m <= 3) return new Date(d.getFullYear() - 1, 10, 1);
  return null;
}

function wmFmtMin(min) {
  if (min < 60) return min + ' min';
  return Math.floor(min / 60) + ' h' + (min % 60 ? ' ' + String(min % 60).padStart(2, '0') : '');
}

/* Toutes les statistiques d'hiver depuis une liste d'entrées du journal */
function wmStats(entries) {
  var start = wmSeasonStart();
  var since = start ? start.getTime() : tlMonday(new Date()).getTime() - 12 * 7 * 86400000;
  var season = entries.filter(function(e) { return (Date.parse(e.date) || 0) >= since; });
  var minutes = season.reduce(function(s, e) { return s + (e.duration || 0); }, 0);
  var hours = minutes / 60;
  var tier = null, next = WM_TIERS[0];
  for (var i = 0; i < WM_TIERS.length; i++) {
    if (hours >= WM_TIERS[i].h) { tier = WM_TIERS[i]; next = WM_TIERS[i + 1] || null; }
  }
  // Semaines (lundi → dimanche), de la plus récente à la plus ancienne
  var mon = tlMonday(new Date()).getTime(), weeks = [];
  for (var k = 0; k < 8; k++) {
    var a = mon - k * 7 * 86400000, b = a + 7 * 86400000;
    var wl = entries.filter(function(e) { var t = Date.parse(e.date); return t >= a && t < b; });
    weeks.push({ start: a, n: wl.length, min: wl.reduce(function(s, e) { return s + (e.duration || 0); }, 0) });
  }
  // Série : semaines consécutives à 2 séances ou plus (la semaine en cours compte si déjà atteinte)
  var streak = 0;
  for (var j = (weeks[0].n >= 2 ? 0 : 1); j < weeks.length; j++) { if (weeks[j].n >= 2) streak++; else break; }
  return { start: start, sessions: season.length, minutes: minutes, tier: tier, next: next, weeks: weeks, streak: streak };
}

/* ─── « Mon hiver » (onglet Entraînement) ─── */
function wmRenderCard(host) {
  if (!host || typeof tlAll !== 'function') return;
  var st = wmStats(tlAll());
  var maxMin = Math.max(30, Math.max.apply(null, st.weeks.map(function(w) { return w.min; })));
  var bars = st.weeks.slice().reverse().map(function(w, i, arr) {
    var h = Math.round(100 * w.min / maxMin);
    var cur = i === arr.length - 1;
    return '<div class="wm-col' + (cur ? ' cur' : '') + '" title="' + w.min + ' min"><div class="wm-colbar" style="height:' + Math.max(3, h) + '%"></div>'
      + '<span>' + (cur ? 'cette sem.' : new Date(w.start).toLocaleDateString('fr-FR', { day: 'numeric', month: 'numeric' })) + '</span></div>';
  }).join('');
  var nextHtml = st.next
    ? (function() {
        var prev = st.tier ? st.tier.h : 0;
        var pct = Math.min(100, Math.round(100 * (st.minutes / 60 - prev) / (st.next.h - prev)));
        return '<div class="wm-next"><div class="cp-bar-l"><span>Prochain palier : <strong>' + st.next.h + ' h · ' + tlEsc(st.next.l) + '</strong></span><span>encore ' + wmFmtMin(Math.max(0, Math.round(st.next.h * 60 - st.minutes))) + '</span></div>'
          + '<div class="prg-progress-bar"><div class="prg-progress-fill" style="width:' + pct + '%"></div></div></div>';
      })()
    : '<div class="wm-next"><strong>Tous les paliers sont atteints. Chapeau !</strong></div>';
  host.innerHTML = '<div class="panel wm-panel">'
    + '<div class="panel-header"><div><div class="panel-title">❄️ Mon hiver</div>'
    + '<div class="panel-sub cp-sub">' + (st.start ? 'Depuis le 1er novembre' : 'Les 12 dernières semaines') + '</div></div>'
    + (st.tier ? '<span class="wm-tier">' + st.tier.h + ' h · ' + tlEsc(st.tier.l) + '</span>' : '') + '</div>'
    + '<div class="panel-body">'
    +   '<div class="tl-week">'
    +     '<div><span>' + wmFmtMin(st.minutes) + '</span>d\'entraînement</div>'
    +     '<div><span>' + st.sessions + '</span>séance' + (st.sessions > 1 ? 's' : '') + '</div>'
    +     '<div><span>' + st.streak + '</span>semaine' + (st.streak > 1 ? 's' : '') + ' d\'affilée</div>'
    +   '</div>'
    +   nextHtml
    +   '<div class="wm-chart">' + bars + '</div>'
    +   '<p class="tl-empty">Une semaine compte dans la série à partir de 2 séances notées.</p>'
    + '</div></div>';
}

/* ─── Carte d'Accueil ─── */
function wmRenderHome(wrap, after) {
  if (!wrap || typeof tlAll !== 'function') return;
  var entries = tlAll();
  var recent = entries.some(function(e) { return Date.now() - (Date.parse(e.date) || 0) < 30 * 86400000; });
  var winter = (typeof winIsWinter === 'function') && winIsWinter();
  if (!winter && !recent) return;
  var st = wmStats(entries);
  var w = st.weeks[0];
  var card = document.createElement('div');
  card.className = 'panel wm-home';
  var line = w.n
    ? 'Cette semaine : <strong>' + w.n + ' séance' + (w.n > 1 ? 's' : '') + ' · ' + wmFmtMin(w.min) + '</strong>' + (w.n < 2 ? ' — encore 1 pour valider la semaine' : ' ✓')
    : 'Pas encore de séance cette semaine. 15 minutes de putting sur la moquette, ça compte.';
  card.innerHTML = '<div class="wm-home-in">'
    + '<div class="wm-home-ico" aria-hidden="true">❄️</div>'
    + '<div class="wm-home-txt"><div class="wm-home-t">Ton hiver : ' + wmFmtMin(st.minutes) + (st.streak ? ' · ' + st.streak + ' sem. d\'affilée' : '') + '</div>'
    + '<div class="wm-home-d">' + line + '</div></div></div>'
    + '<div class="wm-home-btns"><button type="button" class="dash-btn dash-btn-gold" data-wm="add">+ Noter une séance</button>'
    + '<button type="button" class="dash-btn dash-btn-outline" data-wm="go">Mon entraînement</button></div>';
  card.addEventListener('click', function(e) {
    var b = e.target.closest('[data-wm]');
    if (!b) return;
    if (b.getAttribute('data-wm') === 'add' && typeof tlOpenFree === 'function') {
      tlOpenFree(function() { var fresh = document.querySelector('.wm-home'); var p = fresh && fresh.parentNode; var nx = fresh && fresh.previousSibling; if (fresh) fresh.remove(); if (p) wmRenderHome(p, nx); });
    } else if (typeof showPage === 'function') showPage('training');
  });
  if (after && after.parentNode === wrap) wrap.insertBefore(card, after.nextSibling); else wrap.appendChild(card);
}

/* ─── Bilan du lundi (une fois par semaine) ─── */
function wmWeeklyRecap() {
  if (typeof tlAll !== 'function' || typeof showToast !== 'function') return;
  var winter = (typeof winIsWinter === 'function') && winIsWinter();
  var entries = tlAll();
  if (!winter && !entries.length) return;
  var key = String(tlMonday(new Date()).getTime());
  if (lsGet('weekRecap') === key) return;
  lsSet('weekRecap', key);
  var last = wmStats(entries).weeks[1];
  if (!entries.length) return;   // jamais rien noté : pas de message
  showToast(last.n
    ? 'La semaine dernière : ' + last.n + ' séance' + (last.n > 1 ? 's' : '') + ', ' + wmFmtMin(last.min) + ' d\'entraînement. On remet ça ? 💪'
    : 'Pas d\'entraînement la semaine dernière. 15 min de putting ce soir pour repartir ?');
}

/* ─── Défi d'hiver dans un groupe ─── */
var _wmBoardMode = 'week';
function wmRenderGroupBoard(panel, groupId) {
  if (!panel || !window.sbClient) return;
  var body = panel.querySelector('.wm-board-body');
  var since = _wmBoardMode === 'week' ? tlMonday(new Date()) : (wmSeasonStart() || new Date(Date.now() - 90 * 86400000));
  window.sbClient.rpc('group_training_board', { p_group: groupId, p_since: since.toISOString() }).then(function(res) {
    if (!res || res.error || !res.data) { panel.style.display = 'none'; return; }
    panel.style.display = '';
    var rows = res.data.slice().sort(function(a, b) { return (b.minutes - a.minutes) || (b.sessions - a.sessions); });
    var total = rows.reduce(function(s, r) { return s + (r.minutes || 0); }, 0);
    var max = Math.max(1, rows[0] ? rows[0].minutes : 1);
    var me = (currentUser && currentUser.id) || '';
    body.innerHTML = '<div class="wm-board-total">Le groupe a cumulé <strong>' + wmFmtMin(total) + '</strong> ' + (_wmBoardMode === 'week' ? 'cette semaine' : 'cet hiver') + '</div>'
      + rows.map(function(r, i) {
          return '<div class="wm-brow' + (r.user_id === me ? ' me' : '') + '">'
            + '<span class="wm-brank">' + (r.minutes ? (i + 1) : '–') + '</span>'
            + '<span class="wm-bname">' + tlEsc(r.name) + '<small>' + r.sessions + ' séance' + (r.sessions > 1 ? 's' : '') + ' · ' + r.active_days + ' jour' + (r.active_days > 1 ? 's' : '') + '</small>'
            + '<span class="wm-bbar"><span style="width:' + Math.round(100 * r.minutes / max) + '%"></span></span></span>'
            + '<span class="wm-bmin">' + wmFmtMin(r.minutes) + '</span></div>';
        }).join('')
      + '<p class="tl-empty">Seuls les totaux sont partagés : tes notes et le détail de tes séances restent privés (ton coach mis à part).</p>';
  }, function() { panel.style.display = 'none'; });
}

function wmGroupBoardPanel(groupId) {
  var panel = document.createElement('div');
  panel.className = 'panel wm-board';
  panel.innerHTML = '<div class="panel-header"><div><div class="panel-title">❄️ Défi d\'hiver : qui s\'entraîne le plus ?</div>'
    + '<div class="panel-sub cp-sub">Minutes d\'entraînement notées dans le journal</div></div></div>'
    + '<div class="filter-row wm-board-modes">'
    + '<button type="button" class="filter-btn' + (_wmBoardMode === 'week' ? ' on' : '') + '" data-mode="week">Cette semaine</button>'
    + '<button type="button" class="filter-btn' + (_wmBoardMode === 'season' ? ' on' : '') + '" data-mode="season">Depuis le 1er novembre</button></div>'
    + '<div class="panel-body wm-board-body"><div class="ch-loading">…</div></div>';
  panel.addEventListener('click', function(e) {
    var b = e.target.closest('[data-mode]');
    if (!b) return;
    _wmBoardMode = b.getAttribute('data-mode');
    panel.querySelectorAll('[data-mode]').forEach(function(x) { x.classList.toggle('on', x === b); });
    wmRenderGroupBoard(panel, groupId);
  });
  wmRenderGroupBoard(panel, groupId);
  return panel;
}
