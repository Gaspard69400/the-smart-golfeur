/* ════════════════════════════════════════════
 * THE SMART GOLFER — groups.js
 * Onglet Groupes : groupes entre joueurs (fun), avec classement amical.
 * - Créer un groupe → code d'invitation à partager
 * - Rejoindre un groupe via code
 * - Détail : classement des membres (score, GIR…) + quitter
 * Nécessite un compte (mode cloud Supabase).
 * ════════════════════════════════════════════ */

var _grpView = { mode: 'list', groupId: null, groupName: '' };
var _grpState = { criterion: 'score', rows: [], uid: null };

var GRP_CRITERIA = [
  { key: 'score', label: 'Score',    lower: true },
  { key: 'gir',   label: 'GIR',      lower: false, suffix: '%' },
  { key: 'fir',   label: 'FIR',      lower: false, suffix: '%' },
  { key: 'putts', label: 'Putts',    lower: true },
  { key: 'hcp',   label: 'Handicap', lower: true }
];

function buildGroupsPage(container) {
  if (!container) return;
  while (container.firstChild) container.removeChild(container.firstChild);

  var wrap = document.createElement('div');
  wrap.className = 'dash-wrap';

  if (!window.tsgCloud || !window.sbClient) {
    wrap.innerHTML = '<div class="dash-header"><div><div class="dash-greeting">Groupes</div>'
      + '<div class="dash-meta">Jouez et progressez entre amis</div></div></div>'
      + '<div class="an-empty-card"><div class="an-empty-icon">🔒</div>'
      + '<div class="an-empty-title">Réservé aux comptes</div>'
      + '<div class="an-empty-text">Les groupes relient plusieurs joueurs : connecte-toi avec un compte (pas le mode démo) pour créer ou rejoindre un groupe.</div></div>';
    container.appendChild(wrap);
    return;
  }

  if (_grpView.mode === 'detail' && _grpView.groupId) {
    grpBuildDetail(wrap, _grpView.groupId);
  } else {
    grpBuildList(wrap);
  }
  container.appendChild(wrap);
}

/* ─────────────── LISTE DES GROUPES ─────────────── */

function grpBuildList(wrap) {
  var header = document.createElement('div');
  header.className = 'dash-header';
  header.innerHTML = '<div><div class="dash-greeting">Groupes</div>'
    + '<div class="dash-meta">Jouez et progressez entre amis</div></div>';
  var right = document.createElement('div');
  var createBtn = document.createElement('button');
  createBtn.className = 'dash-btn dash-btn-gold';
  createBtn.textContent = '+ Créer un groupe';
  createBtn.addEventListener('click', grpOpenCreate);
  right.appendChild(createBtn);
  header.appendChild(right);
  wrap.appendChild(header);

  // Bloc rejoindre
  var joinPanel = document.createElement('div');
  joinPanel.className = 'panel grp-join-panel';
  joinPanel.innerHTML = '<div class="panel-body">'
    + '<div class="grp-join-intro">Un ami t\'a donné un <strong>code de groupe</strong> ?</div>'
    + '<div class="ch-join-row">'
    +   '<input type="text" class="ch-join-input" id="grp-join-code" placeholder="Code ou lien reçu" maxlength="200" autocomplete="off">'
    +   '<button class="dash-btn dash-btn-outline" id="grp-join-btn">Rejoindre</button>'
    + '</div><div class="ch-join-error" id="grp-join-error" style="display:none"></div></div>';
  wrap.appendChild(joinPanel);

  var listPanel = document.createElement('div');
  listPanel.className = 'panel';
  listPanel.innerHTML = '<div class="panel-header"><div class="panel-title">Mes groupes</div></div>';
  var body = document.createElement('div');
  body.className = 'panel-body';
  body.id = 'grp-list-body';
  body.innerHTML = '<div class="ch-loading">Chargement…</div>';
  listPanel.appendChild(body);
  wrap.appendChild(listPanel);

  // Listeners rejoindre
  setTimeout(function() {
    var jb = document.getElementById('grp-join-btn');
    var ji = document.getElementById('grp-join-code');
    function join() {
      var raw = (ji.value || '').trim();
      var code = (typeof invExtractCode === 'function' ? invExtractCode(raw) : null) || raw;
      var err = document.getElementById('grp-join-error');
      if (!code) { err.style.display = 'block'; err.textContent = 'Saisis un code ou colle le lien reçu.'; return; }
      jb.disabled = true; err.style.display = 'none';
      window.sbClient.rpc('join_group', { p_code: code }).then(function(res) {
        jb.disabled = false;
        var d = res.data;
        if (res.error) { err.style.display = 'block'; err.textContent = res.error.message; return; }
        if (d && d.ok) { showToast('Tu as rejoint « ' + (d.group_name || 'le groupe') + ' » ✓'); grpRefresh(); }
        else { err.style.display = 'block'; err.textContent = (d && d.error) || 'Code invalide.'; }
      }, function(e) { jb.disabled = false; err.style.display = 'block'; err.textContent = e.message; });
    }
    if (jb) jb.addEventListener('click', join);
    if (ji) ji.addEventListener('keydown', function(e) { if (e.key === 'Enter') join(); });
  }, 0);

  // Charger mes groupes
  var sb = window.sbClient, uid = currentUser.id;
  sb.from('group_members').select('group_id').eq('user_id', uid).then(function(res) {
    var ids = (res.data || []).map(function(r) { return r.group_id; });
    var body = document.getElementById('grp-list-body');
    if (!body) return;
    if (!ids.length) {
      body.innerHTML = '<div class="ch-empty-inline">Tu n\'es dans aucun groupe. Crées-en un et invite tes amis !</div>';
      return;
    }
    Promise.all([
      sb.from('groups').select('*').in('id', ids),
      sb.from('group_members').select('group_id, user_id').in('group_id', ids)
    ]).then(function(r2) {
      var groups = r2[0].data || [];
      var members = r2[1].data || [];
      body.innerHTML = '';
      var grid = document.createElement('div');
      grid.className = 'grp-grid';
      groups.forEach(function(g) {
        var count = members.filter(function(m) { return m.group_id === g.id; }).length;
        var card = document.createElement('div');
        card.className = 'grp-card';
        card.innerHTML = '<div class="grp-card-name">' + grpEsc(g.name) + '</div>'
          + '<div class="grp-card-meta">' + count + ' membre' + (count > 1 ? 's' : '')
          + (g.owner_id === uid ? ' · <span class="grp-owner-tag">Créé par toi</span>' : '') + '</div>';
        card.addEventListener('click', function() {
          _grpView = { mode: 'detail', groupId: g.id, groupName: g.name };
          grpRefresh();
        });
        grid.appendChild(card);
      });
      body.appendChild(grid);
    });
  }, function(e) {
    var body = document.getElementById('grp-list-body');
    if (body) body.innerHTML = '<div class="ch-empty-inline">Erreur : ' + e.message + '</div>';
  });
}

/* ─────────────── DÉTAIL D'UN GROUPE (classement) ─────────────── */

function grpBuildDetail(wrap, groupId) {
  var sb = window.sbClient, uid = currentUser.id;

  var header = document.createElement('div');
  header.className = 'dash-header';
  var back = document.createElement('button');
  back.className = 'dash-btn dash-btn-outline grp-back-btn';
  back.innerHTML = '← Groupes';
  back.addEventListener('click', function() { _grpView = { mode: 'list' }; grpRefresh(); });
  var titleWrap = document.createElement('div');
  titleWrap.innerHTML = '<div class="dash-greeting" id="grp-detail-name">' + grpEsc(_grpView.groupName || 'Groupe') + '</div>'
    + '<div class="dash-meta">Classement du groupe</div>';
  var hl = document.createElement('div');
  hl.style.cssText = 'display:flex;align-items:center;gap:12px;flex-wrap:wrap';
  hl.appendChild(back); hl.appendChild(titleWrap);
  header.appendChild(hl);
  wrap.appendChild(header);

  // Panneau code + quitter
  var infoPanel = document.createElement('div');
  infoPanel.className = 'panel grp-info-panel';
  infoPanel.innerHTML = '<div class="panel-body grp-info-body">'
    + '<div class="grp-code-block"><div class="grp-code-lbl">Code d\'invitation</div>'
    +   '<div class="grp-code" id="grp-code-val">…</div></div>'
    + '<button class="dash-btn dash-btn-gold" id="grp-invite-btn">Inviter</button>'
    + '<button class="dash-btn dash-btn-outline" id="grp-copy-btn">Copier le code</button>'
    + '<button class="dash-btn dash-btn-outline grp-leave-btn" id="grp-leave-btn">Quitter</button>'
    + '</div>';
  wrap.appendChild(infoPanel);

  // Records du groupe
  var recPanel = document.createElement('div');
  recPanel.className = 'panel grp-records-panel';
  recPanel.innerHTML = '<div class="panel-body" id="grp-records"><div class="ch-loading">…</div></div>';
  wrap.appendChild(recPanel);

  // Le groupe par secteur de jeu (S80) — surtout utile au coach qui a rejoint le groupe
  var secPanel = document.createElement('div');
  secPanel.className = 'panel grp-sec-panel';
  secPanel.innerHTML = '<div class="panel-header"><div><div class="panel-title">Le groupe par secteur de jeu</div>'
    + '<div class="panel-sub">Où le groupe gagne et perd des coups, comparé au niveau de chaque joueur</div></div></div>'
    + '<div class="panel-body grp-sec-body"><div class="ch-loading">…</div></div>';
  wrap.appendChild(secPanel);

  // Défis entre amis (groupchallenges.js)
  if (typeof gchRenderPanel === 'function') gchRenderPanel(wrap, groupId, _grpView.groupName);

  // Classement (avec sélecteur de critère)
  var lbPanel = document.createElement('div');
  lbPanel.className = 'panel';
  var chips = GRP_CRITERIA.map(function(c) {
    return '<button class="filter-btn grp-crit-btn' + (c.key === _grpState.criterion ? ' on' : '') + '" data-crit="' + c.key + '">' + c.label + '</button>';
  }).join('');
  lbPanel.innerHTML = '<div class="panel-header"><div class="panel-title">Classement</div></div>'
    + '<div class="grp-crit-row filter-row">' + chips + '</div>';
  var lbBody = document.createElement('div');
  lbBody.className = 'panel-body';
  lbBody.id = 'grp-lb-body';
  lbBody.innerHTML = '<div class="ch-loading">Chargement du classement…</div>';
  lbPanel.appendChild(lbBody);
  wrap.appendChild(lbPanel);

  // Fil d'activité
  var feedPanel = document.createElement('div');
  feedPanel.className = 'panel';
  feedPanel.innerHTML = '<div class="panel-header"><div class="panel-title">Fil d\'activité</div></div>'
    + '<div class="panel-body" id="grp-feed"><div class="ch-loading">…</div></div>';
  wrap.appendChild(feedPanel);

  // Calendrier des tournois du groupe (tout membre peut en créer)
  if (typeof calendarRenderPanel === 'function') calendarRenderPanel(wrap, 'group', groupId, true);

  // Discussion du groupe
  if (typeof chatRenderPanel === 'function') chatRenderPanel(wrap, 'group', { group_id: groupId }, 'Discussion du groupe');

  // Sélecteur de critère
  setTimeout(function() {
    lbPanel.querySelectorAll('.grp-crit-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        _grpState.criterion = btn.getAttribute('data-crit');
        lbPanel.querySelectorAll('.grp-crit-btn').forEach(function(b) { b.classList.remove('on'); });
        btn.classList.add('on');
        grpRenderLeaderboard(document.getElementById('grp-lb-body'), _grpState.rows, _grpState.criterion, _grpState.uid);
      });
    });
  }, 0);

  // Charger groupe + membres + parties
  sb.from('groups').select('*').eq('id', groupId).single().then(function(gres) {
    var g = gres.data;
    if (g) {
      var cv = document.getElementById('grp-code-val'); if (cv) cv.textContent = g.invite_code || '—';
      var nm = document.getElementById('grp-detail-name'); if (nm) nm.textContent = g.name;
      var inv = document.getElementById('grp-invite-btn');
      if (inv && typeof invOpenShare === 'function') inv.addEventListener('click', function() { invOpenShare(g); });
      var copy = document.getElementById('grp-copy-btn');
      if (copy) copy.addEventListener('click', function() {
        try { navigator.clipboard.writeText(g.invite_code); showToast('Code copié : ' + g.invite_code); }
        catch (e) { showToast('Code : ' + g.invite_code); }
      });
    }
  });

  var leave = document.getElementById('grp-leave-btn');
  if (leave) leave.addEventListener('click', function() {
    if (!confirm('Quitter ce groupe ?')) return;
    sb.from('group_members').delete().eq('group_id', groupId).eq('user_id', uid).then(function() {
      showToast('Tu as quitté le groupe');
      _grpView = { mode: 'list' }; grpRefresh();
    });
  });

  _grpState.uid = uid;
  sb.from('group_members').select('user_id').eq('group_id', groupId).then(function(mres) {
    var ids = (mres.data || []).map(function(m) { return m.user_id; });
    if (!ids.length) { document.getElementById('grp-lb-body').innerHTML = '<div class="ch-empty-inline">Aucun membre.</div>'; return; }
    Promise.all([
      sb.from('profiles').select('id, name, initials, color, bg, hcp').in('id', ids),
      sb.from('rounds').select('user_id, score, par, gir, fir, fir_total, putts, course, played_on, created_at, sg_tee, sg_app, sg_arg, sg_putt').in('user_id', ids)
    ]).then(function(r) {
      var profiles = r[0].data || [];
      var rounds = r[1].data || [];
      _grpState.rows = grpComputeRows(profiles, rounds);
      grpRenderLeaderboard(document.getElementById('grp-lb-body'), _grpState.rows, _grpState.criterion, uid);
      grpRenderRecords(document.getElementById('grp-records'), rounds, profiles);
      grpRenderFeed(document.getElementById('grp-feed'), rounds, profiles);
      grpRenderSectors(secPanel.querySelector('.grp-sec-body'), rounds, profiles);
    });
  });
}

/* ── Le groupe par secteur de jeu (S80) ──
   Pour chaque joueur : ses 10 dernières parties (90 derniers jours). Strokes Gained
   moyens par secteur = coups gagnés (+) ou perdus (−) par partie comparé à un
   joueur de SON niveau ; la moyenne du groupe donne le même poids à chaque joueur.
   + Moyennes brutes du groupe (score, fairways, greens, putts). */
var GRP_SECTORS = [
  { k: 'sg_tee',  l: 'Départ',    s: 'Départ' },
  { k: 'sg_app',  l: 'Approche',  s: 'Appro.' },
  { k: 'sg_arg',  l: 'Petit jeu', s: 'P. jeu' },
  { k: 'sg_putt', l: 'Putting',   s: 'Putting' }
];

function grpRenderSectors(body, allRounds, profiles) {
  if (!body) return;
  var since = Date.now() - 90 * 86400000;
  function fmt(v) { var r = Math.round(v * 10) / 10; return (r > 0 ? '+' : (r < 0 ? '−' : '')) + Math.abs(r).toFixed(1).replace('.', ','); }
  var players = profiles.map(function(p) {
    var rs = allRounds.filter(function(r) {
      if (r.user_id !== p.id) return false;
      var t = Date.parse(r.played_on || r.created_at || '');
      return !t || t >= since;
    }).sort(function(a, b) { return String(b.played_on || '').localeCompare(String(a.played_on || '')); }).slice(0, 10);
    var sg = {}, any = false;
    GRP_SECTORS.forEach(function(s) {
      var sum = 0, c = 0;
      rs.forEach(function(r) { if (r[s.k] != null && !isNaN(r[s.k])) { sum += Number(r[s.k]); c++; } });
      sg[s.k] = c ? sum / c : null;
      if (c) any = true;
    });
    var weak = null;
    GRP_SECTORS.forEach(function(s) { if (sg[s.k] != null && (weak === null || sg[s.k] < sg[weak])) weak = s.k; });
    return { p: p, n: rs.length, rs: rs, sg: sg, any: any, weak: weak };
  }).filter(function(x) { return x.n > 0; });

  if (!players.length) {
    body.innerHTML = '<div class="ch-empty-inline">Les moyennes apparaîtront dès que les membres auront entré des parties.</div>';
    return;
  }

  // Moyenne du groupe par secteur (chaque joueur pèse pareil)
  var grp = {};
  GRP_SECTORS.forEach(function(s) {
    var vals = players.map(function(x) { return x.sg[s.k]; }).filter(function(v) { return v != null; });
    grp[s.k] = vals.length ? vals.reduce(function(a, b) { return a + b; }, 0) / vals.length : null;
  });
  var gWeak = null;
  GRP_SECTORS.forEach(function(s) { if (grp[s.k] != null && (gWeak === null || grp[s.k] < grp[gWeak])) gWeak = s.k; });
  var nWeak = gWeak ? players.filter(function(x) { return x.weak === gWeak; }).length : 0;
  var label = {}; GRP_SECTORS.forEach(function(s) { label[s.k] = s.l; });

  // Moyennes brutes
  var all = []; players.forEach(function(x) { all = all.concat(x.rs); });
  function mean(arr, f) { var v = arr.map(f).filter(function(z) { return z != null && !isNaN(z); }); return v.length ? v.reduce(function(a, b) { return a + b; }, 0) / v.length : null; }
  var full = all.filter(function(r) { return r.score && r.score >= 60; });
  var mScore = mean(full, function(r) { return r.score; });
  var mFir = mean(all, function(r) { return r.fir != null ? r.fir / (r.fir_total || 14) * 100 : null; });
  var mGir = mean(all, function(r) { return r.gir != null ? r.gir / 18 * 100 : null; });
  var mPutts = mean(full, function(r) { return r.putts; });

  var bars = GRP_SECTORS.map(function(s) {
    var v = grp[s.k];
    if (v == null) return '<div class="grp-sec-row"><div class="grp-sec-l">' + s.l + '</div><div class="grp-sec-track"></div><div class="grp-sec-v">—</div></div>';
    var w = Math.min(50, Math.abs(v) / 2 * 50);
    var bar = '<div class="grp-sec-bar ' + (v >= 0 ? 'pos' : 'neg') + '" style="width:' + w.toFixed(0) + '%"></div>';
    return '<div class="grp-sec-row' + (s.k === gWeak ? ' weak' : '') + '"><div class="grp-sec-l">' + s.l + '</div>'
      + '<div class="grp-sec-track"><div class="grp-sec-mid"></div>' + bar + '</div>'
      + '<div class="grp-sec-v ' + (v >= 0 ? 'pos' : 'neg') + '">' + fmt(v) + '</div></div>';
  }).join('');

  // Répartition des points faibles individuels (ex. « Putting : 3 · Approche : 1 »)
  var weakCount = {};
  players.forEach(function(x) { if (x.weak && x.sg[x.weak] < 0) weakCount[x.weak] = (weakCount[x.weak] || 0) + 1; });
  var weakList = GRP_SECTORS.filter(function(s) { return weakCount[s.k]; })
    .sort(function(a, b) { return weakCount[b.k] - weakCount[a.k]; })
    .map(function(s) { return s.l + ' : ' + weakCount[s.k]; }).join(' · ');
  var lost = gWeak != null ? Math.round(-grp[gWeak] * 10) / 10 : 0;
  var verdict;
  if (gWeak && lost >= 0.3) {
    verdict = '<strong>À travailler en priorité : ' + label[gWeak] + '</strong> — le groupe y perd ' + fmt(lost).replace('+', '') + ' coup' + (lost >= 2 ? 's' : '') + ' par partie en moyenne'
      + (players.length > 1 ? ', et c\'est le point faible de ' + nWeak + ' joueur' + (nWeak > 1 ? 's' : '') + ' sur ' + players.length : '') + '.';
  } else if (gWeak && lost > 0) {
    verdict = 'Pas de grosse faiblesse commune : le secteur le plus faible du groupe est <strong>' + label[gWeak] + '</strong> (' + fmt(grp[gWeak]) + ' coup par partie). Mieux vaut travailler joueur par joueur.';
  } else {
    verdict = 'Le groupe est au niveau attendu (ou au-dessus) dans tous les secteurs.';
  }
  if (weakList && players.length > 1) verdict += '<div class="grp-sec-weaks">Points faibles des joueurs — ' + weakList + '</div>';
  verdict = '<div class="grp-sec-verdict">' + verdict + '</div>';

  var avg = '<div class="grp-sec-avgs">'
    + '<div><span>' + (mScore != null ? mScore.toFixed(1).replace('.', ',') : '—') + '</span>Score moyen</div>'
    + '<div><span>' + (mFir != null ? Math.round(mFir) + '%' : '—') + '</span>Fairways</div>'
    + '<div><span>' + (mGir != null ? Math.round(mGir) + '%' : '—') + '</span>Greens</div>'
    + '<div><span>' + (mPutts != null ? mPutts.toFixed(1).replace('.', ',') : '—') + '</span>Putts</div></div>';

  var rows = players.sort(function(a, b) { return (a.p.name || '').localeCompare(b.p.name || ''); }).map(function(x) {
    var cells = GRP_SECTORS.map(function(s) {
      var v = x.sg[s.k];
      if (v == null) return '<td>—</td>';
      return '<td class="' + (v >= 0 ? 'pos' : 'neg') + (s.k === x.weak && v < 0 ? ' weak' : '') + '">' + fmt(v) + '</td>';
    }).join('');
    return '<tr data-uid="' + grpEsc(x.p.id) + '"><th>' + grpEsc(x.p.name || 'Joueur') + '<small>' + x.n + ' partie' + (x.n > 1 ? 's' : '') + '</small></th>' + cells + '</tr>';
  }).join('');

  body.innerHTML = avg + bars + verdict
    + '<div class="grp-sec-tblw"><table class="grp-sec-tbl"><thead><tr><th>Joueur</th>'
    + GRP_SECTORS.map(function(s) { return '<th title="' + s.l + '">' + s.s + '</th>'; }).join('') + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
    + '<div class="grp-sec-note">Coups gagnés (+) ou perdus (−) par partie comparé à un joueur de même niveau · 10 dernières parties de chacun (90 jours) · en gras : le point faible du joueur. Touche un nom pour voir sa fiche.</div>';

  body.querySelectorAll('tr[data-uid]').forEach(function(tr) {
    tr.addEventListener('click', function() {
      if (typeof openPlayerDetailModal === 'function') openPlayerDetailModal(tr.getAttribute('data-uid'), tr.querySelector('th').firstChild.textContent);
    });
  });
}

function grpComputeRows(profiles, allRounds) {
  return profiles.map(function(p) {
    var rs = allRounds.filter(function(r) { return r.user_id === p.id; });
    var n = rs.length;
    function mean(k) { var s = 0, c = 0; rs.forEach(function(r){ if (r[k] != null) { s += r[k]; c++; } }); return c ? s / c : null; }
    var firSum = 0, firTot = 0;
    rs.forEach(function(r) { if (r.fir != null) { firSum += r.fir; firTot += (r.fir_total || 14); } });
    return {
      id: p.id, name: p.name || 'Joueur', initials: p.initials || (p.name ? p.name.slice(0,2).toUpperCase() : '?'),
      color: p.color, bg: p.bg, hcp: (p.hcp != null ? Number(p.hcp) : null), n: n,
      score: n ? mean('score') : null,
      gir: n ? (mean('gir') / 18 * 100) : null,
      fir: firTot ? (firSum / firTot * 100) : null,
      putts: n ? mean('putts') : null
    };
  });
}

function grpFmtCrit(v, crit) {
  if (v == null) return '—';
  if (crit.suffix === '%') return Math.round(v) + '%';
  return (Math.round(v * 10) / 10).toFixed(1);
}

function grpRenderLeaderboard(body, rows, critKey, myId) {
  if (!body) return;
  var crit = GRP_CRITERIA.filter(function(c) { return c.key === critKey; })[0] || GRP_CRITERIA[0];
  var sorted = rows.slice().sort(function(a, b) {
    var va = a[crit.key], vb = b[crit.key];
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    return crit.lower ? (va - vb) : (vb - va);
  });

  body.innerHTML = '';
  var list = document.createElement('div');
  list.className = 'grp-lb';
  sorted.forEach(function(r, i) {
    var has = r[crit.key] != null;
    var rank = has ? (i + 1) : '–';
    var medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
    var row = document.createElement('div');
    row.className = 'grp-lb-row' + (r.id === myId ? ' me' : '');
    row.style.cursor = 'pointer';
    row.title = 'Voir la fiche';
    row.innerHTML =
      '<div class="grp-lb-rank">' + medal + '</div>'
      + '<div class="ch-player-av grp-lb-av" style="background:' + (r.bg||'var(--gold-dim)') + ';color:' + (r.color||'var(--gold-d)') + '">' + grpEsc(r.initials) + '</div>'
      + '<div class="grp-lb-info"><div class="grp-lb-name">' + grpEsc(r.name) + (r.id === myId ? ' <span class="grp-me-tag">toi</span>' : '') + '</div>'
      +   '<div class="grp-lb-sub">' + (r.n ? r.n + ' partie' + (r.n>1?'s':'') : 'aucune partie') + '</div></div>'
      + '<div class="grp-lb-score">' + grpFmtCrit(r[crit.key], crit) + '</div>';
    row.addEventListener('click', function() {
      if (typeof openPlayerDetailModal === 'function') openPlayerDetailModal(r.id, r.name);
    });
    list.appendChild(row);
  });
  body.appendChild(list);
}

function grpRenderRecords(body, allRounds, profiles) {
  if (!body) return;
  var withData = allRounds.filter(function(r) { return r.score != null; });
  if (!withData.length) { body.innerHTML = '<div class="ch-empty-inline">Pas encore de partie dans le groupe.</div>'; return; }
  var nameById = {}; profiles.forEach(function(p) { nameById[p.id] = p.name || 'Joueur'; });
  var best = withData.slice().sort(function(a, b) { return (a.score - (a.par||0)) - (b.score - (b.par||0)); })[0];
  var counts = {}; withData.forEach(function(r) { counts[r.user_id] = (counts[r.user_id] || 0) + 1; });
  var mostActiveId = Object.keys(counts).sort(function(a, b) { return counts[b] - counts[a]; })[0];
  body.innerHTML = '<div class="grp-records">'
    + '<div class="grp-rec"><div class="grp-rec-v">' + best.score + '</div><div class="grp-rec-l">Meilleure partie · ' + grpEsc(nameById[best.user_id]||'') + '</div></div>'
    + '<div class="grp-rec"><div class="grp-rec-v">' + withData.length + '</div><div class="grp-rec-l">Parties au total</div></div>'
    + '<div class="grp-rec"><div class="grp-rec-v">' + (counts[mostActiveId]||0) + '</div><div class="grp-rec-l">Plus actif · ' + grpEsc(nameById[mostActiveId]||'') + '</div></div>'
    + '</div>';
}

function grpRenderFeed(body, allRounds, profiles) {
  if (!body) return;
  var nameById = {}, avById = {};
  profiles.forEach(function(p) {
    nameById[p.id] = p.name || 'Joueur';
    avById[p.id] = { initials: p.initials || (p.name ? p.name.slice(0,2).toUpperCase() : '?'), color: p.color, bg: p.bg };
  });
  var feed = allRounds.filter(function(r) { return r.played_on; })
    .slice().sort(function(a, b) { return new Date(b.played_on) - new Date(a.played_on); }).slice(0, 8);
  if (!feed.length) { body.innerHTML = '<div class="ch-empty-inline">Aucune activité récente. Jouez une partie !</div>'; return; }
  body.innerHTML = feed.map(function(r) {
    var av = avById[r.user_id] || {};
    return '<div class="grp-feed-item">'
      + '<div class="ch-player-av grp-feed-av" style="background:' + (av.bg||'var(--gold-dim)') + ';color:' + (av.color||'var(--gold-d)') + '">' + grpEsc(av.initials||'?') + '</div>'
      + '<div class="grp-feed-txt"><strong>' + grpEsc(nameById[r.user_id]||'Joueur') + '</strong> a joué à ' + grpEsc(r.course||'un parcours') + '</div>'
      + '<div class="grp-feed-score">' + (r.score != null ? r.score : '') + '</div>'
      + '<div class="grp-feed-date">' + (r.played_on ? new Date(r.played_on).toLocaleDateString('fr-FR') : '') + '</div>'
      + '</div>';
  }).join('');
}

/* ─────────────── CRÉER UN GROUPE ─────────────── */

function grpOpenCreate() {
  var ex = document.getElementById('grp-create-modal');
  if (ex) ex.remove();
  var modal = document.createElement('div');
  modal.id = 'grp-create-modal';
  modal.className = 'trn-modal';
  modal.innerHTML = '<div class="trn-modal-card" style="max-width:420px">'
    + '<div class="trn-modal-head"><div><div class="trn-modal-tag">Nouveau</div>'
    +   '<div class="trn-modal-title">Créer un groupe</div></div>'
    +   '<button class="trn-modal-close" id="grp-cr-close">×</button></div>'
    + '<div class="trn-modal-body">'
    +   '<div class="obj-field"><label class="obj-label">Nom du groupe</label>'
    +     '<input type="text" class="obj-input" id="grp-cr-name" placeholder="Ex : Les copains du dimanche" maxlength="40"></div>'
    +   '<div class="ch-join-error" id="grp-cr-error" style="display:none"></div>'
    + '</div>'
    + '<div class="trn-modal-actions">'
    +   '<button class="dash-btn dash-btn-outline" id="grp-cr-cancel">Annuler</button>'
    +   '<button class="dash-btn dash-btn-gold" id="grp-cr-save">Créer</button>'
    + '</div></div>';
  document.body.appendChild(modal);
  function close() { modal.remove(); }
  document.getElementById('grp-cr-close').addEventListener('click', close);
  document.getElementById('grp-cr-cancel').addEventListener('click', close);
  modal.addEventListener('click', function(e) { if (e.target === modal) close(); });
  var nameInput = document.getElementById('grp-cr-name');
  nameInput.focus();
  document.getElementById('grp-cr-save').addEventListener('click', function() {
    var name = (nameInput.value || '').trim();
    var err = document.getElementById('grp-cr-error');
    if (!name) { err.style.display = 'block'; err.textContent = 'Donne un nom à ton groupe.'; return; }
    window.sbClient.rpc('create_group', { p_name: name }).then(function(res) {
      var d = res.data;
      if (res.error) { err.style.display = 'block'; err.textContent = res.error.message; return; }
      if (d && d.ok) {
        close();
        showToast('Groupe « ' + d.name + ' » créé ✓');
        _grpView = { mode: 'detail', groupId: d.id, groupName: d.name };
        grpRefresh();
        // Un groupe vide ne sert à rien : proposer tout de suite d'inviter
        if (typeof invOpenShare === 'function') invOpenShare({ name: d.name, invite_code: d.invite_code });
      } else { err.style.display = 'block'; err.textContent = (d && d.error) || 'Erreur.'; }
    }, function(e) { err.style.display = 'block'; err.textContent = e.message; });
  });
  nameInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') document.getElementById('grp-cr-save').click(); });
}

function grpRefresh() {
  var page = document.getElementById('page-groups');
  if (page) buildGroupsPage(page);
}

function grpEsc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
