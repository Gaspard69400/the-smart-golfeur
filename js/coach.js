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

    // Calendrier des tournois de l'équipe (le coach peut en créer)
    if (typeof calendarRenderPanel === 'function') calendarRenderPanel(root, 'coach', uid, true);

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
          : '<div class="ch-player-nodata">Ce joueur n\'a pas encore saisi de partie.</div>')
      + '<div class="ch-player-more">Voir la fiche →</div>';
    card.style.cursor = 'pointer';
    card.title = 'Voir la fiche détaillée';
    card.addEventListener('click', function() {
      if (typeof openPlayerDetailModal === 'function') openPlayerDetailModal(p.id, p.name, { canCoach: true });
    });
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

        // Tournois proposés par le(s) coach(s) — le joueur peut indiquer s'il joue
        coaches.forEach(function(c) {
          if (typeof calendarRenderPanel === 'function') calendarRenderPanel(root, 'coach', c.id, false);
        });
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

/* ════════════════════════════════════════════
   FICHE JOUEUR DÉTAILLÉE (partagée Coach Hub / Groupes)
   Lit les données du joueur via RLS (coach ou co-membre de groupe).
════════════════════════════════════════════ */
function openPlayerDetailModal(playerId, displayName, opts) {
  if (!window.sbClient) return;
  opts = opts || {};
  var sb = window.sbClient;
  var ex = document.getElementById('pd-modal');
  if (ex) ex.remove();

  var modal = document.createElement('div');
  modal.id = 'pd-modal';
  modal.className = 'trn-modal';
  modal.innerHTML = '<div class="trn-modal-card pd-card">'
    + '<div class="trn-modal-head"><div><div class="trn-modal-tag">Fiche joueur</div>'
    +   '<div class="trn-modal-title" id="pd-name">' + coachEsc(displayName || 'Joueur') + '</div></div>'
    +   '<button class="trn-modal-close" id="pd-close">×</button></div>'
    + '<div class="trn-modal-body" id="pd-body"><div class="ch-loading">Chargement…</div></div></div>';
  document.body.appendChild(modal);
  function close() { modal.remove(); }
  document.getElementById('pd-close').addEventListener('click', close);
  modal.addEventListener('click', function(e) { if (e.target === modal) close(); });

  Promise.all([
    sb.from('rounds').select('*').eq('user_id', playerId).order('played_on', { ascending: false }),
    sb.from('objectives').select('*').eq('user_id', playerId).maybeSingle(),
    sb.from('training_done').select('*').eq('user_id', playerId),
    sb.from('trainings').select('id, title'),
    sb.from('profiles').select('*').eq('id', playerId).single()
  ]).then(function(r) {
    var rounds = r[0].data || [];
    var obj = r[1].data;
    var done = r[2].data || [];
    var trainings = r[3].data || [];
    var prof = r[4].data || {};
    pdRender(document.getElementById('pd-body'), rounds, obj, done, trainings, prof);
    var nm = document.getElementById('pd-name');
    if (nm && prof.name) nm.textContent = prof.name;
    // Contrôles coach (notes + assignation d'exercice)
    if (opts.canCoach && coachIsCoachRole() && typeof pdRenderCoachControls === 'function') {
      pdRenderCoachControls(document.getElementById('pd-body'), playerId);
    }
  }).catch(function(e) {
    var b = document.getElementById('pd-body');
    if (b) b.innerHTML = '<div class="ch-empty-inline">Erreur : ' + e.message + '</div>';
  });
}

function pdRender(body, rounds, obj, done, trainings, prof) {
  if (!body) return;
  var n = rounds.length;
  function mean(k) { var s=0,c=0; rounds.forEach(function(r){ if(r[k]!=null){s+=r[k];c++;} }); return c? s/c:0; }
  var firSum=0, firTot=0; rounds.forEach(function(r){ if(r.fir!=null){firSum+=r.fir; firTot+=(r.fir_total||14);} });
  var kpis = n ? [
    ['Score', mean('score').toFixed(1)],
    ['GIR', Math.round(mean('gir')/18*100) + '%'],
    ['FIR', (firTot? Math.round(firSum/firTot*100):0) + '%'],
    ['Putts', mean('putts').toFixed(1)],
    ['Parties', n]
  ] : [];

  var html = '';

  // En-tête profil
  var initials = prof.initials || (prof.name ? prof.name.slice(0,2).toUpperCase() : '?');
  html += '<div class="pd-head">'
    + '<div class="ch-player-av pd-av" style="background:' + (prof.bg||'var(--gold-dim)') + ';color:' + (prof.color||'var(--gold-d)') + '">' + coachEsc(initials) + '</div>'
    + '<div class="pd-head-info"><div class="pd-hcp">Hcp ' + (prof.hcp!=null? prof.hcp : '—') + '</div>'
    + '<div class="pd-role">' + coachEsc((typeof ROLE_LABELS!=='undefined' && ROLE_LABELS[prof.role]) || 'Joueur') + '</div></div></div>';

  if (!n) {
    html += '<div class="ch-empty-inline" style="margin-top:14px">Ce joueur n\'a pas encore saisi de partie.</div>';
    body.innerHTML = html;
    return;
  }

  // KPIs
  html += '<div class="pd-kpis">';
  kpis.forEach(function(k){ html += '<div class="pd-kpi"><div class="pd-kpi-v">' + k[1] + '</div><div class="pd-kpi-l">' + k[0] + '</div></div>'; });
  html += '</div>';

  // Sparkline évolution du score (chronologique)
  var scoresChrono = rounds.slice().reverse().map(function(r){ return r.score; }).filter(function(s){ return s!=null; });
  var spark = pdSparkline(scoresChrono);
  if (spark) html += '<div class="pd-section-title">Évolution du score</div><div class="pd-spark">' + spark + '</div>';

  // Dernières parties
  html += '<div class="pd-section-title">Dernières parties</div><div class="pd-rounds">';
  rounds.slice(0, 6).forEach(function(r){
    var delta = (r.score!=null && r.par!=null) ? (r.score - r.par) : null;
    var deltaStr = delta==null ? '' : (delta>0? '+'+delta : (delta===0? 'Par' : delta));
    var deltaCls = delta==null? '' : (delta>0? 'pd-over' : 'pd-under');
    html += '<div class="pd-round">'
      + '<div class="pd-round-main"><div class="pd-round-course">' + coachEsc(r.course||'Parcours') + '</div>'
      + '<div class="pd-round-date">' + (r.played_on? new Date(r.played_on).toLocaleDateString('fr-FR') : '') + '</div></div>'
      + '<div class="pd-round-score">' + (r.score!=null? r.score : '—') + ' <span class="pd-round-delta ' + deltaCls + '">' + deltaStr + '</span></div>'
      + '</div>';
  });
  html += '</div>';

  // Objectifs
  if (obj) {
    html += '<div class="pd-section-title">Objectifs de saison</div><div class="pd-obj">';
    [['Score', obj.score], ['Hcp', obj.hcp], ['GIR', obj.gir!=null? obj.gir+'%':null], ['FIR', obj.fir!=null? obj.fir+'%':null], ['Putts', obj.putts]].forEach(function(o){
      if (o[1]!=null) html += '<span class="pd-obj-chip">' + o[0] + ' visé <strong>' + o[1] + '</strong></span>';
    });
    html += '</div>';
  }

  // Exercices réalisés
  if (done && done.length) {
    var titleById = {}; (trainings||[]).forEach(function(t){ titleById[t.id]=t.title; });
    var totalReps = done.reduce(function(s,d){ return s+(d.count||0); }, 0);
    html += '<div class="pd-section-title">Entraînement</div>'
      + '<div class="pd-train-summary">' + done.length + ' exercice' + (done.length>1?'s':'') + ' réalisé' + (done.length>1?'s':'') + ' · ' + totalReps + ' fois au total</div>';
    html += '<div class="pd-train-list">';
    done.slice(0, 5).forEach(function(d){
      html += '<div class="pd-train-item">' + coachEsc(titleById[d.training_id] || 'Exercice') + ' <span class="pd-train-count">×' + (d.count||1) + '</span></div>';
    });
    html += '</div>';
  }

  body.innerHTML = html;
}

function pdSparkline(scores) {
  if (!scores || scores.length < 2) return '';
  var w = 300, h = 56, pad = 8;
  var min = Math.min.apply(null, scores), max = Math.max.apply(null, scores);
  var range = (max - min) || 1;
  var innerW = w - 2*pad, innerH = h - 2*pad;
  var pts = scores.map(function(s, i) {
    var x = pad + i * innerW / (scores.length - 1);
    var y = pad + ((s - min) / range) * innerH; // meilleur score (min) en haut
    return { x: x, y: y };
  });
  var line = pts.map(function(p){ return p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' ');
  var area = 'M' + pts[0].x.toFixed(1) + ',' + (h-pad).toFixed(1) + ' L' + line.split(' ').join(' L') + ' L' + pts[pts.length-1].x.toFixed(1) + ',' + (h-pad).toFixed(1) + ' Z';
  var dots = pts.map(function(p){ return '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="2.5" fill="var(--gold-d)"/>'; }).join('');
  return '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" style="width:100%;height:56px">'
    + '<path d="' + area + '" fill="var(--gold-dim)"/>'
    + '<polyline points="' + line + '" fill="none" stroke="var(--gold-d)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>'
    + dots + '</svg>';
}

/* ─── Contrôles coach dans la fiche joueur : notes + assignation d'exercice (S19-B) ─── */
function pdRenderCoachControls(body, playerId) {
  if (!body || !window.sbClient) return;
  var sb = window.sbClient;
  var section = document.createElement('div');
  section.className = 'pd-coach';
  section.innerHTML = '<div class="ch-loading">…</div>';
  body.appendChild(section);

  var myExercises = (typeof getTrainings === 'function' ? getTrainings() : []).filter(function(t) {
    return t.createdBy && t.createdBy.id === currentUser.id;
  });
  var titleById = {}; myExercises.forEach(function(t) { titleById[t.id] = t.title; });

  Promise.all([
    sb.from('coach_notes').select('note').eq('coach_id', currentUser.id).eq('player_id', playerId).maybeSingle(),
    sb.from('training_assignments').select('*').eq('coach_id', currentUser.id).eq('player_id', playerId)
  ]).then(function(r) {
    var note = (r[0].data && r[0].data.note) || '';
    var assigns = r[1].data || [];

    var optHtml = myExercises.length
      ? myExercises.map(function(t) { return '<option value="' + t.id + '">' + coachEsc(t.title) + '</option>'; }).join('')
      : '<option value="">(crée un exercice dans Entraînement)</option>';

    var assignedHtml = assigns.length
      ? assigns.map(function(a) {
          return '<div class="pd-asg-item"><span>' + coachEsc(titleById[a.training_id] || 'Exercice') + '</span>'
            + '<button class="pd-asg-del" data-id="' + a.id + '" title="Retirer">×</button></div>';
        }).join('')
      : '<div class="pd-asg-empty">Aucun exercice assigné pour l\'instant.</div>';

    section.innerHTML =
      '<div class="pd-coach-box">'
      + '<div class="pd-section-title">Notes du coach <span class="pd-priv">privé</span></div>'
      + '<textarea class="obj-input pd-note" id="pd-note" rows="3" placeholder="Note privée sur ce joueur (visible par toi uniquement)…">' + coachEsc(note) + '</textarea>'
      + '<button class="dash-btn dash-btn-outline pd-note-save" id="pd-note-save">Enregistrer la note</button>'
      + '<div class="pd-section-title">Assigner un exercice</div>'
      + '<div class="pd-assign-row"><select class="obj-input" id="pd-assign-select">' + optHtml + '</select>'
      +   '<button class="dash-btn dash-btn-gold" id="pd-assign-btn">Assigner</button></div>'
      + '<div class="pd-asg-list">' + assignedHtml + '</div>'
      + '</div>';

    document.getElementById('pd-note-save').addEventListener('click', function() {
      var val = document.getElementById('pd-note').value;
      sb.from('coach_notes').upsert({ coach_id: currentUser.id, player_id: playerId, note: val, updated_at: new Date().toISOString() })
        .then(function(res) { showToast(res.error ? ('Erreur : ' + res.error.message) : 'Note enregistrée ✓'); });
    });

    document.getElementById('pd-assign-btn').addEventListener('click', function() {
      var tid = document.getElementById('pd-assign-select').value;
      if (!tid) { showToast('Crée d\'abord un exercice dans l\'onglet Entraînement'); return; }
      sb.from('training_assignments').insert({ training_id: tid, player_id: playerId, coach_id: currentUser.id }).then(function(res) {
        if (res.error) {
          showToast(/duplicate|unique/i.test(res.error.message || '') ? 'Déjà assigné à ce joueur' : ('Erreur : ' + res.error.message));
          return;
        }
        showToast('Exercice assigné ✓  Le joueur le verra dans Entraînement');
        section.remove(); pdRenderCoachControls(body, playerId);
      });
    });

    section.querySelectorAll('.pd-asg-del').forEach(function(btn) {
      btn.addEventListener('click', function() {
        sb.from('training_assignments').delete().eq('id', btn.getAttribute('data-id')).then(function() {
          showToast('Assignation retirée');
          section.remove(); pdRenderCoachControls(body, playerId);
        });
      });
    });
  }).catch(function(e) { section.innerHTML = '<div class="ch-empty-inline">Erreur : ' + e.message + '</div>'; });
}
