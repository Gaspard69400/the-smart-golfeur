/* ════════════════════════════════════════════
 * THE SMART GOLFER — groupchallenges.js
 * DÉFIS ENTRE AMIS dans un groupe : « le moins de putts ce week-end »,
 * « la meilleure carte par rapport à son niveau sur 7 jours »…
 *
 * Un membre lance le défi (table group_challenges, backend/maj_defis.sql) ;
 * le classement se calcule tout seul à partir des parties des membres
 * jouées pendant la période. À la fin : un vainqueur, et de l'XP pour lui.
 *
 * Équité : le défi « par rapport à son niveau » compare index du joueur
 * au moment de la partie − différentiel de la carte. Un 25 d'index qui
 * joue 15 bat un 5 qui joue 6.
 *
 * Dépend de : groups.js (grpEsc), app.js (lsGet/lsSet/showToast), community.js (XP).
 * ════════════════════════════════════════════ */

var GCH_METRICS = {
  net:        { label: 'Meilleure carte par rapport à son niveau', short: 'Perf. vs niveau', lower: false, unit: '', mode: 'best',
                help: 'Index du joueur − différentiel de la carte. Équitable entre tous les niveaux.' },
  putts:      { label: 'Le moins de putts sur une partie', short: 'Putts', lower: true, unit: ' putts', mode: 'best', help: 'Cartes 18 trous avec les putts.' },
  gir:        { label: 'Le plus de greens en régulation', short: 'Greens', lower: false, unit: ' greens', mode: 'best', help: 'Cartes 18 trous avec les greens.' },
  gross:      { label: 'Le meilleur score brut', short: 'Score', lower: true, unit: '', mode: 'best', help: 'Cartes 18 trous.' },
  stableford: { label: 'Le plus de points en stableford', short: 'Stableford', lower: false, unit: ' pts', mode: 'best', help: 'Parties saisies en format stableford.' },
  rounds:     { label: 'Le plus de parties jouées', short: 'Parties', lower: false, unit: ' parties', mode: 'total', help: 'Toutes les parties comptent.' }
};
var GCH_WIN_XP = 150;

function gchDate(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function gchToday() { return gchDate(new Date()); }

/* Période proposée : « ce week-end » = samedi-dimanche à venir (ou en cours) */
function gchPeriod(kind) {
  var now = new Date(), start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (kind === 'weekend') {
    var day = start.getDay();                 // 0 = dimanche
    var sat = new Date(start);
    if (day === 0) sat.setDate(start.getDate() - 1);
    else sat.setDate(start.getDate() + (6 - day));
    var sun = new Date(sat); sun.setDate(sat.getDate() + 1);
    return { starts: gchDate(day === 0 || day === 6 ? start : sat), ends: gchDate(sun) };
  }
  var days = kind === '30' ? 30 : 7;
  var end = new Date(start); end.setDate(start.getDate() + days - 1);
  return { starts: gchDate(start), ends: gchDate(end) };
}

function gchStatus(ch) {
  var t = gchToday();
  if (t < ch.starts_on) return 'soon';
  if (t > ch.ends_on) return 'done';
  return 'live';
}

function gchDaysLeft(ch) {
  var end = new Date(ch.ends_on + 'T23:59:59');
  return Math.max(0, Math.ceil((end - Date.now()) / 86400000));
}

function gchIs18(r) {
  var ex = r.extra || {};
  if (ex.quickEntry) return true;               // saisie du score total : une partie complète
  return Array.isArray(r.scores) && r.scores.filter(function(x) { return x !== null && x !== undefined; }).length >= 18;
}

/* Valeur d'une partie pour une mesure (null = la partie ne compte pas) */
function gchRoundValue(metric, r) {
  var ex = r.extra || {};
  switch (metric) {
    case 'net':   return (gchIs18(r) && r.diff !== null && r.diff !== undefined && r.hcp !== null && r.hcp !== undefined) ? Math.round((Number(r.hcp) - Number(r.diff)) * 10) / 10 : null;
    case 'putts': return (gchIs18(r) && typeof r.putts === 'number' && r.putts >= 18) ? r.putts : null;
    case 'gir':   return (gchIs18(r) && r.gir !== null && r.gir !== undefined) ? r.gir : null;
    case 'gross': return (gchIs18(r) && r.score) ? r.score : null;
    case 'stableford': return (ex.points !== null && ex.points !== undefined && (r.format === 'stableford' || ex.format === 'stableford')) ? ex.points : null;
    case 'rounds': return 1;
  }
  return null;
}

/* Classement d'un défi : [{user_id, value, rounds, when}] trié, ex æquo au même rang */
function gchStandings(ch, rounds, memberIds) {
  var m = GCH_METRICS[ch.metric];
  var by = {};
  rounds.forEach(function(r) {
    if (!r.played_on || r.played_on < ch.starts_on || r.played_on > ch.ends_on) return;
    if (memberIds && memberIds.indexOf(r.user_id) === -1) return;
    var v = gchRoundValue(ch.metric, r);
    if (v === null) return;
    var e = by[r.user_id] = by[r.user_id] || { user_id: r.user_id, value: null, rounds: 0, when: null };
    e.rounds++;
    if (m.mode === 'total') { e.value = (e.value || 0) + v; e.when = e.when && e.when < r.played_on ? e.when : r.played_on; return; }
    var better = e.value === null || (m.lower ? v < e.value : v > e.value)
      || (v === e.value && r.played_on < e.when);           // à égalité, la première réalisée
    if (better) { e.value = v; e.when = r.played_on; }
  });
  var list = Object.keys(by).map(function(k) { return by[k]; });
  list.sort(function(a, b) {
    if (a.value !== b.value) return m.lower ? a.value - b.value : b.value - a.value;
    return (a.when || '') < (b.when || '') ? -1 : 1;
  });
  var rank = 0, prev = null;
  list.forEach(function(e, i) { if (e.value !== prev) { rank = i + 1; prev = e.value; } e.rank = rank; });
  return list;
}

function gchFmt(metric, v) {
  if (v === null || v === undefined) return '—';
  if (metric === 'net') return (v > 0 ? '+' : '') + String(v).replace('.', ',');
  var unit = GCH_METRICS[metric].unit;
  if (Math.abs(v) <= 1) unit = unit.replace(/s$/, '');      // « 1 partie », « 1 green »
  return v + unit;
}

/* XP des défis gagnés (comptée dans le niveau, community.js) */
function gchTotalXp() {
  var w = lsGet('groupChallengeWins') || {};
  return Object.keys(w).reduce(function(a, k) { return a + (Number(w[k]) || 0); }, 0);
}

/* ─────────────── PANNEAU DANS LA PAGE DU GROUPE ─────────────── */

function gchRenderPanel(wrap, groupId, groupName) {
  var sb = window.sbClient, uid = currentUser.id;
  var panel = document.createElement('div');
  panel.className = 'panel gch-panel';
  panel.innerHTML = '<div class="panel-header"><div class="panel-title">🏆 Défis du groupe</div>'
    + '<button class="dash-btn dash-btn-gold gch-new" type="button">+ Lancer un défi</button></div>'
    + '<div class="panel-body gch-body"><div class="ch-loading">Chargement des défis…</div></div>';
  wrap.appendChild(panel);
  var body = panel.querySelector('.gch-body');
  panel.querySelector('.gch-new').addEventListener('click', function() { gchOpenCreate(groupId, groupName, function() { load(); }); });

  function load() {
    sb.from('group_challenges').select('*').eq('group_id', groupId).order('ends_on', { ascending: false }).limit(12).then(function(res) {
      if (res.error) {
        var missing = /group_challenges|schema cache|does not exist/i.test(res.error.message || '');
        body.innerHTML = '<div class="ch-empty-inline">' + (missing ? 'Les défis entre amis ne sont pas encore activés sur le serveur.' : 'Impossible de charger les défis.') + '</div>';
        if (missing) panel.querySelector('.gch-new').disabled = true;
        return;
      }
      var chs = res.data || [];
      if (!chs.length) {
        body.innerHTML = '<div class="gch-empty"><strong>Aucun défi pour l\'instant.</strong> Lance le premier : le moins de putts ce week-end, la meilleure carte par rapport à son niveau… Le classement se remplit tout seul avec vos parties.</div>';
        return;
      }
      var minStart = chs.reduce(function(a, c) { return c.starts_on < a ? c.starts_on : a; }, chs[0].starts_on);
      var maxEnd = chs.reduce(function(a, c) { return c.ends_on > a ? c.ends_on : a; }, chs[0].ends_on);
      sb.from('group_members').select('user_id').eq('group_id', groupId).then(function(r0) {
        var memberIds = (r0.data || []).map(function(m) { return m.user_id; });
        if (!memberIds.length) { body.innerHTML = '<div class="ch-empty-inline">Aucun membre.</div>'; return; }
        return sb.from('profiles').select('id, name, initials, color, bg').in('id', memberIds).then(function(r1) { return [memberIds, r1]; });
      }).then(function(pair) {
        if (!pair) return;
        var memberIds = pair[0], profiles = {};
        (pair[1].data || []).forEach(function(p) { profiles[p.id] = p; });
        sb.from('rounds').select('id, user_id, score, par, diff, hcp, gir, putts, format, scores, extra, played_on')
          .in('user_id', memberIds).gte('played_on', minStart).lte('played_on', maxEnd).then(function(r2) {
            var rounds = r2.data || [];
            gchRenderList(body, chs, rounds, memberIds, profiles, uid, groupName);
          });
      });
    }, function() { body.innerHTML = '<div class="ch-empty-inline">Pas de réseau.</div>'; });
  }
  load();
}

function gchRenderList(body, chs, rounds, memberIds, profiles, uid, groupName) {
  var order = { live: 0, soon: 1, done: 2 };
  chs = chs.slice().sort(function(a, b) { return order[gchStatus(a)] - order[gchStatus(b)] || (a.ends_on < b.ends_on ? -1 : 1); });
  var wins = lsGet('groupChallengeWins') || {}, newWins = [];
  var shownDone = 0;

  body.innerHTML = chs.map(function(ch) {
    var st = gchStatus(ch), m = GCH_METRICS[ch.metric];
    if (st === 'done' && shownDone++ >= 3) return '';
    var rows = gchStandings(ch, rounds, memberIds);
    var mine = rows.find(function(r) { return r.user_id === uid; });
    var winners = rows.filter(function(r) { return r.rank === 1; });   // ex æquo : tous vainqueurs
    var iWon = winners.some(function(r) { return r.user_id === uid; });
    if (st === 'done' && iWon && !wins[ch.id]) newWins.push(ch);
    var name = function(id) { var p = profiles[id]; return p && p.name ? p.name.split(' ')[0] : 'Un membre'; };

    var badge = st === 'live' ? '<span class="gch-st live">' + (gchDaysLeft(ch) <= 1 ? 'Dernier jour' : gchDaysLeft(ch) + ' jours restants') + '</span>'
      : st === 'soon' ? '<span class="gch-st soon">Commence le ' + gchNiceDate(ch.starts_on) + '</span>'
      : '<span class="gch-st done">Terminé</span>';

    var top = rows.slice(0, 4).map(function(r) {
      var medal = r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : r.rank + '.';
      return '<div class="gch-row' + (r.user_id === uid ? ' me' : '') + '"><span class="gch-medal">' + medal + '</span>'
        + '<span class="gch-name">' + grpEsc(name(r.user_id)) + (r.user_id === uid ? ' <span class="grp-me-tag">toi</span>' : '') + '</span>'
        + '<span class="gch-val">' + gchFmt(ch.metric, r.value) + '</span></div>';
    }).join('');

    var foot = '';
    if (st === 'done') {
      foot = rows.length
        ? '<div class="gch-winner">🏆 ' + winners.map(function(w) { return grpEsc(name(w.user_id)); }).join(' et ')
          + (winners.length > 1 ? ' remportent le défi ex æquo' : ' remporte le défi') + (iWon ? ' — bravo, +' + GCH_WIN_XP + ' XP !' : '') + '</div>'
        : '<div class="gch-winner none">Personne n\'a joué pendant la période.</div>';
    } else if (st === 'live') {
      foot = mine ? '<div class="gch-mine">Ta place : ' + mine.rank + (mine.rank === 1 ? 'er' : 'e') + ' sur ' + rows.length + '</div>'
        : '<div class="gch-mine">Tu n\'as pas encore de carte qui compte : joue avant le ' + gchNiceDate(ch.ends_on) + ' !</div>';
    }

    return '<div class="gch-card ' + st + '">'
      + '<div class="gch-head"><div><div class="gch-title">' + grpEsc(ch.title) + '</div>'
      +   '<div class="gch-meta">' + m.label + ' · du ' + gchNiceDate(ch.starts_on) + ' au ' + gchNiceDate(ch.ends_on) + '</div></div>' + badge + '</div>'
      + (st !== 'soon' ? (top || '<div class="gch-none">Aucune carte ne compte encore.</div>') : '<div class="gch-none">' + grpEsc(m.help) + '</div>')
      + foot
      + (ch.created_by === uid && st !== 'done' ? '<button class="gch-del" type="button" data-id="' + ch.id + '">Supprimer ce défi</button>' : '')
      + '</div>';
  }).join('');

  body.querySelectorAll('.gch-del').forEach(function(b) {
    b.addEventListener('click', function() {
      if (!confirm('Supprimer ce défi pour tout le groupe ?')) return;
      window.sbClient.from('group_challenges').delete().eq('id', b.getAttribute('data-id')).then(function(res) {
        if (res.error) { showToast('Suppression impossible'); return; }
        var card = b.closest('.gch-card'); if (card) card.remove();
        showToast('Défi supprimé');
      });
    });
  });

  if (newWins.length) {
    newWins.forEach(function(ch) { wins[ch.id] = GCH_WIN_XP; });
    lsSet('groupChallengeWins', wins);
    showToast('🏆 Tu as gagné « ' + newWins[0].title + ' » : +' + (GCH_WIN_XP * newWins.length) + ' XP');
  }
}

function gchNiceDate(iso) {
  var M = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  var p = String(iso || '').split('-');
  if (p.length < 3) return iso || '';
  return parseInt(p[2], 10) + ' ' + M[parseInt(p[1], 10) - 1];
}

/* ─────────────── LANCER UN DÉFI ─────────────── */

function gchOpenCreate(groupId, groupName, onCreated) {
  var old = document.getElementById('gch-modal');
  if (old) old.remove();
  var m = document.createElement('div');
  m.id = 'gch-modal';
  m.className = 'trn-modal';
  var metricOpts = Object.keys(GCH_METRICS).map(function(k, i) {
    return '<button type="button" class="gch-opt' + (i === 0 ? ' on' : '') + '" data-metric="' + k + '"><strong>' + GCH_METRICS[k].label + '</strong><span>' + GCH_METRICS[k].help + '</span></button>';
  }).join('');
  m.innerHTML = '<div class="trn-modal-card" style="max-width:480px">'
    + '<div class="trn-modal-head"><div><div class="trn-modal-tag">' + grpEsc(groupName || 'Groupe') + '</div>'
    +   '<div class="trn-modal-title">Lancer un défi</div></div><button class="trn-modal-close" type="button">×</button></div>'
    + '<div class="trn-modal-body">'
    +   '<div class="qt-l">Le défi</div><div class="gch-opts" id="gch-metrics">' + metricOpts + '</div>'
    +   '<div class="qt-l">Quand</div><div class="sgm-formats" id="gch-periods">'
    +     '<button type="button" class="theme-opt on" data-p="weekend">Ce week-end</button>'
    +     '<button type="button" class="theme-opt" data-p="7">7 jours</button>'
    +     '<button type="button" class="theme-opt" data-p="30">30 jours</button></div>'
    +   '<div class="gch-dates" id="gch-dates"></div>'
    +   '<div class="qt-field"><label class="qt-l" for="gch-title">Nom du défi</label><input class="obj-input gch-title-in" id="gch-title" maxlength="60"></div>'
    +   '<div class="ch-join-error" id="gch-err" style="display:none"></div>'
    + '</div>'
    + '<div class="trn-modal-actions"><button class="dash-btn dash-btn-outline" type="button" id="gch-cancel">Annuler</button>'
    +   '<button class="dash-btn dash-btn-gold" type="button" id="gch-go">Lancer</button></div></div>';
  document.body.appendChild(m);

  var metric = 'net', period = 'weekend', titleTouched = false;
  var titleIn = m.querySelector('#gch-title');
  function suggest() {
    var p = gchPeriod(period);
    m.querySelector('#gch-dates').textContent = 'Du ' + gchNiceDate(p.starts) + ' au ' + gchNiceDate(p.ends) + ' inclus';
    if (!titleTouched) {
      var when = period === 'weekend' ? 'du week-end' : (period === '7' ? 'de la semaine' : 'du mois');
      titleIn.value = ({ net: 'La perf ', putts: 'Roi du putting ', gir: 'Les greens ', gross: 'Le meilleur score ', stableford: 'Stableford ', rounds: 'Le plus assidu ' })[metric] + when;
    }
  }
  suggest();
  titleIn.addEventListener('input', function() { titleTouched = true; });
  m.querySelectorAll('[data-metric]').forEach(function(b) {
    b.addEventListener('click', function() {
      metric = b.getAttribute('data-metric');
      m.querySelectorAll('[data-metric]').forEach(function(x) { x.classList.toggle('on', x === b); });
      suggest();
    });
  });
  m.querySelectorAll('[data-p]').forEach(function(b) {
    b.addEventListener('click', function() {
      period = b.getAttribute('data-p');
      m.querySelectorAll('[data-p]').forEach(function(x) { x.classList.toggle('on', x === b); });
      suggest();
    });
  });
  function close() { m.remove(); }
  m.querySelector('.trn-modal-close').addEventListener('click', close);
  m.querySelector('#gch-cancel').addEventListener('click', close);
  m.addEventListener('click', function(e) { if (e.target === m) close(); });
  m.querySelector('#gch-go').addEventListener('click', function() {
    var err = m.querySelector('#gch-err'), go = m.querySelector('#gch-go');
    var title = (titleIn.value || '').trim();
    if (!title) { err.style.display = 'block'; err.textContent = 'Donne un nom au défi.'; return; }
    var p = gchPeriod(period);
    go.disabled = true;
    window.sbClient.from('group_challenges').insert({ group_id: groupId, created_by: currentUser.id, title: title.slice(0, 60), metric: metric, starts_on: p.starts, ends_on: p.ends })
      .then(function(res) {
        go.disabled = false;
        if (res.error) { err.style.display = 'block'; err.textContent = 'Impossible de lancer le défi (' + res.error.message + ')'; return; }
        close();
        showToast('Défi lancé ✓ Tout le groupe le voit');
        if (onCreated) onCreated();
      }, function() { go.disabled = false; err.style.display = 'block'; err.textContent = 'Pas de réseau.'; });
  });
}
