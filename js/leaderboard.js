/* ════════════════════════════════════════════
 * THE SMART GOLFER — leaderboard.js
 * CLASSEMENTS GLOBAUX + FICHES JOUEUR (profils publics, sur accord).
 *
 * Personne n'apparaît sans l'avoir choisi : case « Apparaître dans les
 * classements » (profiles.public_profile). Toi, tu te vois toujours à ta
 * place, même sans être public (les autres ne te voient pas).
 * Mesures : perf. vs niveau (index − différentiel, équitable), index,
 * meilleur score brut, putts (moyenne, 3 cartes min.), parties jouées —
 * sur 7 jours, 30 jours ou la saison. Calcul côté serveur
 * (RPC global_leaderboard, backend/maj_weekend.sql).
 *
 * Synchronise aussi l'index officiel calculé par l'app vers le profil
 * cloud (sinon les autres voyaient l'index saisi à l'inscription).
 *
 * Dépend de : app.js, groups.js (grpEsc), whs.js.
 * ════════════════════════════════════════════ */

var LB_METRICS = [
  { key: 'net',    label: 'Perf. vs niveau', unit: '',        help: 'La meilleure carte par rapport à son index (index − différentiel) : équitable entre tous les niveaux.' },
  { key: 'index',  label: 'Index',           unit: '',        help: 'L\'index actuel de chaque joueur.' },
  { key: 'gross',  label: 'Meilleur score',  unit: '',        help: 'Le meilleur score brut sur une carte 18 trous.' },
  { key: 'putts',  label: 'Putts',           unit: ' putts',  help: 'Moyenne de putts par carte 18 trous (3 cartes minimum).' },
  { key: 'rounds', label: 'Assiduité',       unit: ' parties', help: 'Le nombre de parties jouées.' }
];
var LB_PERIODS = [{ days: 7, label: '7 jours' }, { days: 30, label: '30 jours' }, { days: 365, label: 'Saison' }];
var _lb = { metric: 'net', days: 30, isPublic: null, missing: false };

function lbEsc(s) { return (typeof grpEsc === 'function') ? grpEsc(s) : String(s == null ? '' : s).replace(/[<>&"]/g, ''); }

function lbFmt(metric, v) {
  if (v === null || v === undefined) return '—';
  var n = Number(v);
  if (metric === 'net') return (n > 0 ? '+' : '') + String(n).replace('.', ',');
  if (metric === 'index') return n < 0 ? '+' + String(-n).replace('.', ',') : String(n).replace('.', ',');
  var unit = (LB_METRICS.find(function(m) { return m.key === metric; }) || {}).unit || '';
  if (Math.abs(n) <= 1) unit = unit.replace(/s$/, '');
  return String(n).replace('.', ',') + unit;
}

/* L'index officiel (calculé dans l'app) part vers le profil cloud */
function lbSyncProfileIndex() {
  if (!window.tsgCloud || !window.sbClient || !currentUser || typeof calcHandicapFromRounds !== 'function') return;
  var idx = calcHandicapFromRounds();
  if (idx === null || idx === undefined) return;
  if (lsGet('syncedIndex') === idx) return;
  window.sbClient.from('profiles').update({ hcp: idx }).eq('id', currentUser.id).then(function(res) {
    if (!res || !res.error) lsSet('syncedIndex', idx);
  }, function() {});
}

function buildLeaderboardPage(container) {
  if (!container) return;
  container.innerHTML = '';
  var wrap = document.createElement('div');
  wrap.className = 'dash-wrap';
  wrap.innerHTML = '<div class="dash-header"><div><div class="dash-greeting">Classements</div>'
    + '<div class="dash-meta">Compare-toi aux golfeurs de l\'app, à ton niveau</div></div></div>';
  container.appendChild(wrap);

  if (!window.tsgCloud || !window.sbClient) {
    wrap.insertAdjacentHTML('beforeend', '<div class="an-empty-card"><div class="an-empty-icon">🔒</div><div class="an-empty-title">Réservé aux comptes</div>'
      + '<div class="an-empty-text">Les classements comparent les joueurs de l\'app : connecte-toi avec un compte pour y participer.</div></div>');
    return;
  }
  lbSyncProfileIndex();

  var consent = document.createElement('div');
  consent.className = 'panel lb-consent';
  wrap.appendChild(consent);

  var controls = document.createElement('div');
  controls.className = 'panel lb-panel';
  controls.innerHTML = '<div class="panel-body">'
    + '<div class="lb-chips" id="lb-metrics">' + LB_METRICS.map(function(m) { return '<button type="button" class="filter-btn' + (m.key === _lb.metric ? ' on' : '') + '" data-m="' + m.key + '">' + m.label + '</button>'; }).join('') + '</div>'
    + '<div class="lb-chips" id="lb-periods">' + LB_PERIODS.map(function(p) { return '<button type="button" class="filter-btn' + (p.days === _lb.days ? ' on' : '') + '" data-d="' + p.days + '">' + p.label + '</button>'; }).join('') + '</div>'
    + '<div class="lb-help" id="lb-help"></div>'
    + '<div id="lb-list"><div class="ch-loading">Chargement du classement…</div></div></div>';
  wrap.appendChild(controls);

  controls.querySelectorAll('[data-m]').forEach(function(b) {
    b.addEventListener('click', function() {
      _lb.metric = b.getAttribute('data-m');
      controls.querySelectorAll('[data-m]').forEach(function(x) { x.classList.toggle('on', x === b); });
      lbLoad(controls);
    });
  });
  controls.querySelectorAll('[data-d]').forEach(function(b) {
    b.addEventListener('click', function() {
      _lb.days = parseInt(b.getAttribute('data-d'), 10);
      controls.querySelectorAll('[data-d]').forEach(function(x) { x.classList.toggle('on', x === b); });
      lbLoad(controls);
    });
  });

  window.sbClient.from('profiles').select('public_profile').eq('id', currentUser.id).maybeSingle().then(function(res) {
    if (res.error) {
      _lb.missing = /public_profile|column|schema cache/i.test(res.error.message || '');
      consent.innerHTML = _lb.missing ? '<div class="panel-body"><div class="ch-empty-inline">Les classements globaux ne sont pas encore activés sur le serveur.</div></div>' : '';
      if (_lb.missing) { controls.remove(); return; }
    } else {
      _lb.isPublic = !!(res.data && res.data.public_profile);
    }
    lbRenderConsent(consent);
    lbLoad(controls);
  }, function() { consent.innerHTML = '<div class="panel-body"><div class="ch-empty-inline">Pas de réseau.</div></div>'; });
}

function lbRenderConsent(host) {
  if (_lb.missing) return;
  host.innerHTML = '<div class="panel-body lb-consent-body">'
    + '<div class="lb-consent-txt">' + (_lb.isPublic
        ? '<strong>Tu apparais dans les classements.</strong> Les autres joueurs voient ton nom, ton index et tes dernières parties.'
        : '<strong>Tu n\'apparais pas encore dans les classements.</strong> Tu vois ta place, mais les autres ne te voient pas.') + '</div>'
    + '<label class="acc-toggle"><input type="checkbox" id="lb-public"' + (_lb.isPublic ? ' checked' : '') + '><span>Apparaître dans les classements</span></label></div>';
  host.querySelector('#lb-public').addEventListener('change', function(e) {
    var on = e.target.checked;
    e.target.disabled = true;
    window.sbClient.from('profiles').update({ public_profile: on }).eq('id', currentUser.id).then(function(res) {
      e.target.disabled = false;
      if (res && res.error) { e.target.checked = !on; showToast('Réglage non enregistré'); return; }
      _lb.isPublic = on;
      showToast(on ? 'Tu apparais dans les classements ✓' : 'Tu n\'apparais plus dans les classements');
      lbRenderConsent(host);
      var list = document.querySelector('.lb-panel');
      if (list) lbLoad(list);
    });
  });
}

function lbLoad(controls) {
  var list = controls.querySelector('#lb-list');
  var m = LB_METRICS.find(function(x) { return x.key === _lb.metric; });
  controls.querySelector('#lb-help').textContent = m.help;
  list.innerHTML = '<div class="ch-loading">Chargement du classement…</div>';
  window.sbClient.rpc('global_leaderboard', { p_metric: _lb.metric, p_days: _lb.days }).then(function(res) {
    if (res.error) {
      list.innerHTML = '<div class="ch-empty-inline">' + (/global_leaderboard|schema cache/i.test(res.error.message || '') ? 'Les classements globaux ne sont pas encore activés sur le serveur.' : 'Impossible de charger le classement.') + '</div>';
      return;
    }
    var rows = res.data || [];
    if (!rows.length) {
      list.innerHTML = '<div class="ch-empty-inline">Personne ne compte encore sur cette période. ' + (_lb.metric === 'putts' ? 'Il faut 3 cartes 18 trous avec les putts.' : 'Joue une partie pour ouvrir le bal !') + '</div>';
      return;
    }
    var rank = 0, prev = null;
    list.innerHTML = '<div class="lb-list">' + rows.map(function(r, i) {
      if (String(r.value) !== String(prev)) { rank = i + 1; prev = r.value; }
      var medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
      return '<button type="button" class="lb-row' + (r.is_me ? ' me' : '') + '" data-uid="' + lbEsc(r.user_id) + '">'
        + '<span class="lb-rank">' + medal + '</span>'
        + '<span class="lb-av" style="background:' + lbEsc(r.bg || 'var(--gold-dim)') + ';color:' + lbEsc(r.color || 'var(--gold-d)') + '">' + lbEsc(r.initials || '?') + '</span>'
        + '<span class="lb-name">' + lbEsc(r.name || 'Joueur') + (r.is_me ? ' <span class="grp-me-tag">toi</span>' : '')
        +   '<em>' + (r.hcp !== null && r.hcp !== undefined ? 'index ' + lbFmt('index', r.hcp) + ' · ' : '') + r.rounds + ' carte' + (r.rounds > 1 ? 's' : '') + '</em></span>'
        + '<span class="lb-val">' + lbFmt(_lb.metric, r.value) + '</span></button>';
    }).join('') + '</div>'
      + (!_lb.isPublic && rows.some(function(r) { return r.is_me; }) ? '<div class="lb-note">Ta ligne n\'est visible que par toi tant que tu n\'apparais pas dans les classements.</div>' : '');
    list.querySelectorAll('.lb-row').forEach(function(b) {
      b.addEventListener('click', function() { lbOpenCard(b.getAttribute('data-uid')); });
    });
  }, function() { list.innerHTML = '<div class="ch-empty-inline">Pas de réseau.</div>'; });
}

function lbOpenCard(uid) {
  var old = document.getElementById('lb-card');
  if (old) old.remove();
  var m = document.createElement('div');
  m.id = 'lb-card';
  m.className = 'trn-modal';
  m.innerHTML = '<div class="trn-modal-card" style="max-width:420px"><div class="trn-modal-head"><div><div class="trn-modal-tag">Fiche joueur</div>'
    + '<div class="trn-modal-title" id="lb-card-name">…</div></div><button class="trn-modal-close" type="button">×</button></div>'
    + '<div class="trn-modal-body" id="lb-card-body"><div class="ch-loading">Chargement…</div></div></div>';
  document.body.appendChild(m);
  m.querySelector('.trn-modal-close').addEventListener('click', function() { m.remove(); });
  m.addEventListener('click', function(e) { if (e.target === m) m.remove(); });
  window.sbClient.rpc('player_card', { p_user: uid }).then(function(res) {
    var d = res.data, body = m.querySelector('#lb-card-body');
    if (res.error || !d || !d.ok) {
      body.innerHTML = '<p class="inv-text">' + (d && d.private ? 'Ce joueur n\'a pas rendu sa fiche publique.' : 'Fiche indisponible.') + '</p>';
      return;
    }
    m.querySelector('#lb-card-name').textContent = d.name || 'Joueur';
    var rounds = (d.rounds || []).map(function(r) {
      var rel = (r.score !== null && r.par) ? r.score - r.par : null;
      return '<div class="lb-cr"><span>' + lbEsc(r.played_on || '') + '</span><span class="lb-cr-c">' + lbEsc(r.course || '') + '</span>'
        + '<strong>' + lbEsc(r.score) + '</strong><em>' + (rel === null ? '' : (rel > 0 ? '+' : '') + rel) + '</em></div>';
    }).join('');
    body.innerHTML = '<div class="lb-card-kpis">'
      + '<div><strong>' + (d.hcp !== null && d.hcp !== undefined ? lbFmt('index', d.hcp) : '—') + '</strong><span>Index</span></div>'
      + '<div><strong>' + (d.best18 || '—') + '</strong><span>Meilleur 18 trous</span></div>'
      + '<div><strong>' + (d.rounds_count || 0) + '</strong><span>Parties</span></div></div>'
      + (rounds ? '<div class="sgm-sec-t">Dernières parties</div>' + rounds : '<p class="inv-text">Pas encore de partie.</p>');
  }, function() { m.querySelector('#lb-card-body').innerHTML = '<p class="inv-text">Pas de réseau.</p>'; });
}
