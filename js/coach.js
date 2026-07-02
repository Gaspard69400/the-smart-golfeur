/* ════════════════════════════════════════════
 * THE SMART GOLFER — coach.js
 * Coach Hub : liaison coach ↔ joueurs via code d'équipe.
 * - Coach (head/coach) : son code d'équipe + liste de ses joueurs + fiche joueur (vraies stats)
 * - Joueur : voir/rejoindre son coach
 * Nécessite un compte (mode cloud Supabase).
 * Dépend de : app.js (currentUser, showToast), supabaseClient.js, auth.js (tsgCloud)
 * ════════════════════════════════════════════ */

function coachIsCoachRole() {
  return currentUser && (currentUser.role === 'head' || currentUser.role === 'coach');
}

function buildCoachPage(container) {
  if (!container) return;
  while (container.firstChild) container.removeChild(container.firstChild);

  var wrap = document.createElement('div');
  wrap.className = 'dash-wrap';

  // En-tête
  var header = document.createElement('div');
  header.className = 'dash-header';
  var left = document.createElement('div');
  left.innerHTML = '<div class="dash-greeting">Coach Hub</div>'
    + '<div class="dash-meta">' + (coachIsCoachRole() ? 'Suivez vos joueurs et leur progression' : 'Reliez-vous à votre coach') + '</div>';
  header.appendChild(left);
  wrap.appendChild(header);

  // Nécessite un compte cloud
  if (!window.tsgCloud || !window.sbClient) {
    var box = document.createElement('div');
    box.className = 'an-empty-card';
    box.innerHTML = '<div class="an-empty-icon">🔒</div>'
      + '<div class="an-empty-title">Réservé aux comptes</div>'
      + '<div class="an-empty-text">Le Coach Hub relie plusieurs personnes : il faut être connecté avec un compte (pas le mode démo). Déconnecte-toi puis crée un compte pour l\'utiliser.</div>';
    wrap.appendChild(box);
    container.appendChild(wrap);
    return;
  }

  var content = document.createElement('div');
  content.id = 'ch-content';
  content.innerHTML = '<div class="ch-loading">Chargement…</div>';
  wrap.appendChild(content);
  container.appendChild(wrap);

  if (coachIsCoachRole()) coachRenderCoachView(content);
  else coachRenderPlayerView(content);
}

/* ─────────────── VUE COACH ─────────────── */

function coachRenderCoachView(root) {
  var sb = window.sbClient;
  var uid = currentUser.id;

  // 1) Code d'équipe (RPC) + 2) liste des joueurs
  Promise.all([
    sb.rpc('ensure_coach_code'),
    sb.from('coach_players').select('player_id, created_at').eq('coach_id', uid)
  ]).then(function(res) {
    var code = (res[0] && res[0].data) ? res[0].data : '—';
    var links = (res[1] && res[1].data) ? res[1].data : [];
    var ids = links.map(function(l) { return l.player_id; });

    root.innerHTML = '';

    // Panneau code d'équipe
    var codePanel = document.createElement('div');
    codePanel.className = 'panel ch-code-panel';
    codePanel.innerHTML =
      '<div class="panel-header"><div class="panel-title">Ton code d\'équipe</div></div>'
      + '<div class="panel-body ch-code-body">'
      +   '<div class="ch-code" id="ch-code-val">' + code + '</div>'
      +   '<button class="dash-btn dash-btn-outline" id="ch-copy-btn">Copier</button>'
      +   '<div class="ch-code-hint">Partage ce code à tes joueurs. Ils le saisissent dans <strong>Coach Hub → Rejoindre un coach</strong> pour apparaître ici.</div>'
      + '</div>';
    root.appendChild(codePanel);
    var copyBtn = document.getElementById('ch-copy-btn');
    if (copyBtn) copyBtn.addEventListener('click', function() {
      try { navigator.clipboard.writeText(code); showToast('Code copié : ' + code); }
      catch (e) { showToast('Code : ' + code); }
    });

    // Panneau joueurs
    var playersPanel = document.createElement('div');
    playersPanel.className = 'panel';
    playersPanel.innerHTML = '<div class="panel-header"><div class="panel-title">Mes joueurs</div>'
      + '<div class="panel-sub">' + ids.length + ' joueur' + (ids.length > 1 ? 's' : '') + '</div></div>';
    var pbody = document.createElement('div');
    pbody.className = 'panel-body';
    pbody.id = 'ch-players-body';
    playersPanel.appendChild(pbody);
    root.appendChild(playersPanel);

    if (!ids.length) {
      pbody.innerHTML = '<div class="ch-empty-inline">Aucun joueur relié pour l\'instant. Partage ton code d\'équipe pour commencer !</div>';
      return;
    }

    pbody.innerHTML = '<div class="ch-loading">Chargement des joueurs…</div>';
    // Charger profils + parties de tous les joueurs
    Promise.all([
      sb.from('profiles').select('*').in('id', ids),
      sb.from('rounds').select('user_id, score, gir, fir, fir_total, putts, played_on').in('user_id', ids)
    ]).then(function(r2) {
      var profiles = (r2[0] && r2[0].data) ? r2[0].data : [];
      var rounds = (r2[1] && r2[1].data) ? r2[1].data : [];
      coachRenderPlayerList(pbody, profiles, rounds);
    }).catch(function(e) {
      pbody.innerHTML = '<div class="ch-empty-inline">Erreur de chargement : ' + e.message + '</div>';
    });

  }).catch(function(e) {
    root.innerHTML = '<div class="an-empty-card"><div class="an-empty-title">Erreur</div><div class="an-empty-text">' + e.message + '</div></div>';
  });
}

function coachComputeStats(rounds) {
  var n = rounds.length;
  if (!n) return { n: 0 };
  function mean(key) { var s = 0, c = 0; rounds.forEach(function(r){ if (r[key] != null) { s += r[key]; c++; } }); return c ? s / c : 0; }
  var firSum = 0, firTot = 0;
  rounds.forEach(function(r){ if (r.fir != null) { firSum += r.fir; firTot += (r.fir_total || 14); } });
  var last = rounds.map(function(r){ return r.played_on; }).filter(Boolean).sort().pop();
  return {
    n: n,
    score: mean('score').toFixed(1),
    gir: Math.round(mean('gir') / 18 * 100),
    fir: firTot ? Math.round(firSum / firTot * 100) : 0,
    putts: mean('putts').toFixed(1),
    last: last
  };
}

function coachRenderPlayerList(body, profiles, allRounds) {
  body.innerHTML = '';
  var grid = document.createElement('div');
  grid.className = 'ch-players-grid';

  profiles.forEach(function(p) {
    var rounds = allRounds.filter(function(r){ return r.user_id === p.id; });
    var st = coachComputeStats(rounds);
    var card = document.createElement('div');
    card.className = 'ch-player-card';
    var initials = p.initials || (p.name ? p.name.slice(0, 2).toUpperCase() : '?');
    card.innerHTML =
      '<div class="ch-player-head">'
      +  '<div class="ch-player-av" style="background:' + (p.bg || 'var(--gold-dim)') + ';color:' + (p.color || 'var(--gold-d)') + '">' + coachEsc(initials) + '</div>'
      +  '<div><div class="ch-player-name">' + coachEsc(p.name || 'Joueur') + '</div>'
      +    '<div class="ch-player-sub">' + (p.hcp != null ? 'Hcp ' + p.hcp : 'Hcp —') + (st.n ? ' · ' + st.n + ' partie' + (st.n>1?'s':'') : ' · aucune partie') + '</div></div>'
      + '</div>'
      + (st.n
          ? '<div class="ch-player-stats">'
            + '<div class="ch-ps"><div class="ch-ps-v">' + st.score + '</div><div class="ch-ps-l">Score</div></div>'
            + '<div class="ch-ps"><div class="ch-ps-v">' + st.gir + '%</div><div class="ch-ps-l">GIR</div></div>'
            + '<div class="ch-ps"><div class="ch-ps-v">' + st.fir + '%</div><div class="ch-ps-l">FIR</div></div>'
            + '<div class="ch-ps"><div class="ch-ps-v">' + st.putts + '</div><div class="ch-ps-l">Putts</div></div>'
            + '</div>'
          : '<div class="ch-player-nodata">Ce joueur n\'a pas encore saisi de partie.</div>');
    grid.appendChild(card);
  });

  body.appendChild(grid);
}

/* ─────────────── VUE JOUEUR ─────────────── */

function coachRenderPlayerView(root) {
  var sb = window.sbClient;
  var uid = currentUser.id;

  sb.from('coach_players').select('coach_id').eq('player_id', uid).then(function(res) {
    var links = (res && res.data) ? res.data : [];
    root.innerHTML = '';

    if (links.length) {
      var coachIds = links.map(function(l){ return l.coach_id; });
      sb.from('profiles').select('id, name, initials, color, bg').in('id', coachIds).then(function(r2) {
        var coaches = (r2 && r2.data) ? r2.data : [];
        var panel = document.createElement('div');
        panel.className = 'panel';
        panel.innerHTML = '<div class="panel-header"><div class="panel-title">Mon coach</div></div>';
        var b = document.createElement('div');
        b.className = 'panel-body';
        coaches.forEach(function(c) {
          var initials = c.initials || (c.name ? c.name.slice(0,2).toUpperCase() : 'C');
          var row = document.createElement('div');
          row.className = 'ch-coach-row';
          row.innerHTML =
            '<div class="ch-player-av" style="background:' + (c.bg||'var(--gold-dim)') + ';color:' + (c.color||'var(--gold-d)') + '">' + coachEsc(initials) + '</div>'
            + '<div class="ch-coach-name">' + coachEsc(c.name || 'Coach') + '</div>';
          var leave = document.createElement('button');
          leave.className = 'dash-btn dash-btn-outline ch-leave-btn';
          leave.textContent = 'Se délier';
          leave.addEventListener('click', function() {
            if (!confirm('Se délier de ' + (c.name || 'ce coach') + ' ? Il ne verra plus tes données.')) return;
            sb.from('coach_players').delete().eq('coach_id', c.id).eq('player_id', uid).then(function() {
              showToast('Délié de ' + (c.name || 'ce coach'));
              coachRefresh();
            });
          });
          row.appendChild(leave);
          b.appendChild(row);
        });
        var hint = document.createElement('div');
        hint.className = 'ch-code-hint';
        hint.style.marginTop = '12px';
        hint.innerHTML = 'Ton coach voit tes statistiques (parties, objectifs, exercices faits) pour t\'accompagner.';
        b.appendChild(hint);
        panel.appendChild(b);
        root.appendChild(panel);
      });
    } else {
      // Formulaire pour rejoindre un coach
      var panel = document.createElement('div');
      panel.className = 'panel';
      panel.innerHTML = '<div class="panel-header"><div class="panel-title">Rejoindre un coach</div></div>'
        + '<div class="panel-body">'
        +   '<div class="ch-join-intro">Ton coach t\'a donné un <strong>code d\'équipe</strong> ? Saisis-le ci-dessous pour qu\'il puisse suivre ta progression.</div>'
        +   '<div class="ch-join-row">'
        +     '<input type="text" class="ch-join-input" id="ch-join-code" placeholder="Ex : A1B2C3" maxlength="12" autocomplete="off">'
        +     '<button class="dash-btn dash-btn-gold" id="ch-join-btn">Rejoindre</button>'
        +   '</div>'
        +   '<div class="ch-join-error" id="ch-join-error" style="display:none"></div>'
        + '</div>';
      root.appendChild(panel);

      var btn = document.getElementById('ch-join-btn');
      var input = document.getElementById('ch-join-code');
      function submit() {
        var code = (input.value || '').trim();
        var errEl = document.getElementById('ch-join-error');
        if (!code) { errEl.style.display = 'block'; errEl.textContent = 'Saisis un code.'; return; }
        btn.disabled = true; errEl.style.display = 'none';
        sb.rpc('join_coach_by_code', { p_code: code }).then(function(res) {
          btn.disabled = false;
          var d = res.data;
          if (res.error) { errEl.style.display = 'block'; errEl.textContent = res.error.message; return; }
          if (d && d.ok) { showToast('Tu as rejoint ' + (d.coach_name || 'ton coach') + ' ✓'); coachRefresh(); }
          else { errEl.style.display = 'block'; errEl.textContent = (d && d.error) || 'Code invalide.'; }
        }, function(err) { btn.disabled = false; errEl.style.display = 'block'; errEl.textContent = err.message; });
      }
      if (btn) btn.addEventListener('click', submit);
      if (input) input.addEventListener('keydown', function(e){ if (e.key === 'Enter') submit(); });
    }
  }).catch(function(e) {
    root.innerHTML = '<div class="an-empty-card"><div class="an-empty-title">Erreur</div><div class="an-empty-text">' + e.message + '</div></div>';
  });
}

function coachRefresh() {
  var page = document.getElementById('page-coach');
  if (page) buildCoachPage(page);
}

function coachEsc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
