/* ════════════════════════════════════════════
 * THE SMART GOLFER — sharedgame.js
 * CARTE PARTAGÉE À PLUSIEURS + MATCH PLAY.
 *
 * Un joueur marque pour la partie (jusqu'à 4) ; chaque joueur qui a
 * rejoint voit la carte se remplir en direct sur son téléphone, et peut
 * aussi marquer. Formats : stroke play, stableford, match play (à 2),
 * et par équipe (S62, backend/maj_equipes.sql) : scramble, greensome,
 * foursome. En équipe, une « unité » par équipe (sgmUnits) dont la carte est
 * la ligne de son 1er joueur ; handicap d'équipe = % WHS (SGM_TEAM_ALLOW) ;
 * pas d'ajout à l'historique individuel (ne compte pas pour l'index).
 *
 * Serveur : backend/maj_parties_carnet.sql. Chaque saisie envoie UNE case
 * (set_game_score) : deux marqueurs ne s'écrasent jamais la carte.
 * Hors réseau : les saisies attendent dans une file (tsg_sgmLocal) et
 * partent dès que la connexion revient — rien n'est perdu.
 * Rafraîchissement par interrogation légère (toutes les 4 s, en pause
 * quand l'écran est masqué), comme la messagerie.
 *
 * Dépend de : formats.js (courseHandicap, strokesOnHole, stablefordPoints),
 * tees.js, data.js (getAllCourses), app.js, qrcode.js, quickscore.js (qsRelClass).
 * ════════════════════════════════════════════ */

var SGM_POLL_MS = 4000;
var SGM_MAX_PLAYERS = 4;
var SGM_FORMATS = {
  stroke:     { label: 'Stroke play', short: 'Stroke',     help: 'Chacun compte tous ses coups.' },
  stableford: { label: 'Stableford',  short: 'Stableford', help: 'Des points à chaque trou selon ton handicap : un trou raté ne ruine pas la carte.' },
  match:      { label: 'Match play',  short: 'Match',      help: 'Duel à 2, trou par trou.' },
  scramble:   { label: 'Scramble',    short: 'Scramble',   team: true, help: 'Par équipe : tout le monde joue, on garde la meilleure balle à chaque coup. Idéal pour débuter.' },
  greensome:  { label: 'Greensome',   short: 'Greensome',  team: true, help: 'Équipes de 2 : les deux jouent le départ, on garde le meilleur, puis on joue à tour de rôle.' },
  foursome:   { label: 'Foursome',    short: 'Foursome',   team: true, help: 'Équipes de 2 : une seule balle, chacun joue à son tour (départs alternés).' }
};

/* Handicap d'équipe (recommandations WHS, appliquées aux handicaps de jeu du plus bas au plus haut) */
var SGM_TEAM_ALLOW = {
  scramble:  { 2: [0.35, 0.15], 3: [0.30, 0.20, 0.10], 4: [0.25, 0.20, 0.15, 0.10] },
  greensome: { 2: [0.60, 0.40] },
  foursome:  { 2: [0.50, 0.50] }
};
var SGM_TEAM_NAMES = { 1: 'Équipe A', 2: 'Équipe B' };

var _sgm = null;   // partie ouverte : { game, players, hole, view, pending, timer, busy, offline, lastSync }

function sgmCloud() { return !!(window.tsgCloud && window.sbClient && typeof currentUser !== 'undefined' && currentUser); }

function sgmEsc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ═════════════ CALCULS (sans DOM) ═════════════ */

function sgmHoles(game) { return (game && game.course && game.course.trous) || []; }

function sgmParTotal(game) {
  var c = game.course || {};
  return c.par_total || sgmHoles(game).reduce(function(a, h) { return a + (h.par || 0); }, 0);
}

function sgmIsTeam(game) { return !!(game && SGM_FORMATS[game.format] && SGM_FORMATS[game.format].team); }

/* Handicap de jeu d'une équipe : % des handicaps de jeu des membres (du plus bas au plus haut), arrondi.
   null si un membre n'a pas d'index (on ne fabrique pas de chiffre). */
function sgmTeamHcp(game, members) {
  var pct = (SGM_TEAM_ALLOW[game.format] || {})[members.length];
  if (!pct) return null;
  var chs = members.map(function(m) { return sgmCourseHcp(game, m); });
  if (chs.some(function(c) { return c === null; })) return null;
  chs = chs.map(function(c) { return Math.round(c); });   // WHS : le pourcentage s'applique au handicap de jeu arrondi
  chs.sort(function(a, b) { return a - b; });
  return Math.round(chs.reduce(function(sum, c, i) { return sum + c * pct[i]; }, 0));
}

/* Ce qu'on note : les joueurs, ou en équipe une « unité » par équipe (carte = ligne du 1er joueur) */
function sgmUnits(game, players) {
  if (!sgmIsTeam(game)) return players;
  var units = [];
  [1, 2].forEach(function(t) {
    var members = players.filter(function(p) { return Number(p.team) === t; })
      .sort(function(a, b) { return (a.position || 0) - (b.position || 0); });
    if (!members.length) return;
    var cap = members[0];
    units.push({ id: cap.id, name: SGM_TEAM_NAMES[t], team: t, initials: t === 1 ? 'A' : 'B', color: cap.color,
      scores: cap.scores, putts: cap.putts, position: cap.position, user_id: null,
      members: members, teamCh: sgmTeamHcp(game, members) });
  });
  return units;
}

/* Handicap de jeu d'un joueur sur le départ de la partie */
function sgmCourseHcp(game, player) {
  if (player && player.members) return player.teamCh;
  if (!player || player.hcp === null || player.hcp === undefined || player.hcp === '') return null;
  var tee = game.tee || {}, c = game.course || {};
  return courseHandicap(Number(player.hcp), tee.slope || c.slope || 113, tee.rating || c.rating, sgmParTotal(game), sgmHoles(game).length);
}

/* Match play : le mieux classé rend la DIFFÉRENCE des handicaps de jeu, répartie par index de difficulté */
function sgmMatchAllowance(game, players) {
  if (!players || players.length !== 2) return null;
  var a = sgmCourseHcp(game, players[0]), b = sgmCourseHcp(game, players[1]);
  var ra = (a === null) ? 0 : Math.round(a), rb = (b === null) ? 0 : Math.round(b);
  var diff = ra - rb;
  return { receiver: diff > 0 ? 0 : (diff < 0 ? 1 : null), strokes: Math.abs(diff), chA: a, chB: b };
}

/* Coups reçus par un joueur sur un trou (dépend du format) */
function sgmStrokesOn(game, players, pIndex, hole) {
  if (game.format === 'match') {
    var al = sgmMatchAllowance(game, players);
    if (!al || al.receiver !== pIndex) return 0;
    return strokesOnHole(al.strokes, hole.si);
  }
  return strokesOnHole(sgmCourseHcp(game, players[pIndex]), hole.si);
}

/* Classement : trous joués, brut, par rapport au par, net, points */
function sgmBoard(game, players) {
  var holes = sgmHoles(game);
  var rows = players.map(function(p, pi) {
    var thru = 0, gross = 0, toPar = 0, net = 0, points = 0;
    holes.forEach(function(h, i) {
      var s = p.scores ? p.scores[i] : null;
      if (s === null || s === undefined) return;
      var st = sgmStrokesOn(game, players, pi, h);
      thru++; gross += s; toPar += s - h.par; net += s - h.par - st;
      points += stablefordPoints(s, h.par, st);
    });
    return { player: p, index: pi, thru: thru, gross: gross, toPar: toPar, netToPar: net, points: points, ch: sgmCourseHcp(game, p) };
  });
  var teamNet = sgmIsTeam(game) && rows.every(function(r) { return r.ch !== null; });
  rows.sort(function(a, b) {
    if (!a.thru !== !b.thru) return a.thru ? -1 : 1;
    if (game.format === 'stableford') return b.points - a.points || a.index - b.index;
    if (teamNet) return a.netToPar - b.netToPar || a.toPar - b.toPar || a.index - b.index;
    return a.toPar - b.toPar || a.index - b.index;
  });
  return rows;
}

/* État du match : trou par trou, avance, résultat (« 3&2 », « 1 up », égalité) */
function sgmMatch(game, players) {
  if (game.format !== 'match' || !players || players.length !== 2) return null;
  var holes = sgmHoles(game), up = 0, played = 0, byHole = [], closedAt = null;
  holes.forEach(function(h, i) {
    var sa = players[0].scores ? players[0].scores[i] : null, sb = players[1].scores ? players[1].scores[i] : null;
    if (sa === null || sa === undefined || sb === null || sb === undefined || closedAt !== null) { byHole.push(null); return; }
    var na = sa - sgmStrokesOn(game, players, 0, h), nb = sb - sgmStrokesOn(game, players, 1, h);
    var w = na < nb ? 0 : (nb < na ? 1 : -1);        // -1 = trou partagé
    if (w === 0) up++; else if (w === 1) up--;
    played++;
    byHole.push(w);
    if (Math.abs(up) > holes.length - played) closedAt = played;
  });
  var remaining = holes.length - played;
  var leader = up > 0 ? 0 : (up < 0 ? 1 : null);
  var lead = Math.abs(up), text, result = null;
  var ln = function(i) { return players[i].name.split(' ')[0]; };
  if (closedAt !== null) {
    result = (remaining === 0) ? lead + ' up' : lead + '&' + remaining;
    text = ln(leader) + ' gagne ' + result;
  } else if (played === 0) {
    text = 'Le match n\'a pas commencé';
  } else if (remaining === 0) {
    result = lead ? lead + ' up' : 'égalité';
    text = lead ? ln(leader) + ' gagne ' + result : 'Match nul (égalité)';
  } else if (lead === 0) {
    text = 'Égalité · ' + remaining + ' à jouer';
  } else {
    text = ln(leader) + ' ' + lead + ' UP · ' + remaining + ' à jouer' + (lead === remaining ? ' (dormie)' : '');
  }
  return { byHole: byHole, up: up, lead: lead, leader: leader, played: played, remaining: remaining,
           closed: closedAt !== null || remaining === 0, result: result, text: text };
}

function sgmRel(v) { return v === 0 ? 'PAR' : (v > 0 ? '+' + v : '' + v); }

/* ═════════════ SYNCHRO (file d'attente des saisies) ═════════════ */

function sgmSaveLocal() {
  if (!_sgm) return;
  lsSet('sgmLocal', { gameId: _sgm.game.id, hole: _sgm.hole, pending: _sgm.pending });
}

function sgmApplyOp(players, op) {
  var p = players.find(function(x) { return x.id === op.pid; });
  if (!p) return;
  if (!Array.isArray(p.scores)) p.scores = new Array(18).fill(null);
  if (!Array.isArray(p.putts)) p.putts = new Array(18).fill(null);
  if (op.setScore) p.scores[op.hole - 1] = op.score;
  if (op.setPutts) p.putts[op.hole - 1] = op.putts;
}

/* Enregistre une saisie : affichée tout de suite, envoyée dès que possible */
function sgmQueue(pid, holeIdx, fields) {
  var op = { pid: pid, hole: holeIdx + 1, setScore: false, setPutts: false, score: null, putts: null };
  // Fusionner avec une saisie du même joueur sur le même trou encore en attente (sauf celle en cours d'envoi)
  var existing = null;
  for (var i = _sgm.busy ? 1 : 0; i < _sgm.pending.length; i++) {
    if (_sgm.pending[i].pid === pid && _sgm.pending[i].hole === holeIdx + 1) existing = _sgm.pending[i];
  }
  if (existing) op = existing;
  if ('score' in fields) { op.setScore = true; op.score = fields.score; }
  if ('putts' in fields) { op.setPutts = true; op.putts = fields.putts; }
  if (!existing) _sgm.pending.push(op);
  sgmApplyOp(_sgm.players, op);
  sgmSaveLocal();
  sgmFlush();
}

function sgmIsNetworkError(err) {
  var m = (err && (err.message || String(err))) || '';
  return /fetch|network|load failed|timeout|offline/i.test(m);
}

function sgmFlush() {
  if (!_sgm || _sgm.busy || !_sgm.pending.length) { sgmRenderSync(); return; }
  _sgm.flushedSome = true;
  var s = _sgm, op = s.pending[0];
  s.busy = true;
  sgmRenderSync();
  window.sbClient.rpc('set_game_score', {
    p_player: op.pid, p_hole: op.hole,
    p_score: op.setScore ? op.score : null,
    p_putts: op.setPutts ? op.putts : null,
    p_set_putts: !!op.setPutts,
    p_set_score: !!op.setScore
  }).then(function(res) {
    if (_sgm !== s) return;
    s.busy = false;
    if (res.error) {
      if (sgmIsNetworkError(res.error)) { s.offline = true; sgmRenderSync(); return; }   // on garde, on réessaiera
      s.pending.shift(); sgmSaveLocal();
      showToast('Saisie refusée : ' + res.error.message);
    } else if (res.data && !res.data.ok) {
      s.pending.shift(); sgmSaveLocal();
      showToast(res.data.error || 'Saisie refusée');
    } else {
      s.offline = false;
      s.lastAckAt = Date.now();   // une lecture partie AVANT cet accusé est périmée
      s.pending.shift(); sgmSaveLocal();
    }
    if (!s.pending.length && s.flushedSome) { s.flushedSome = false; setTimeout(sgmPoll, 300); }   // relire la carte complète
    sgmFlush();
  }, function() {
    if (_sgm !== s) return;
    s.busy = false; s.offline = true; sgmRenderSync();
  });
}

function sgmPoll() {
  if (!_sgm) return;
  var s = _sgm;
  // Les saisies en attente partent même écran masqué ; seule la lecture est mise en pause
  if (s.pending.length && !s.busy) sgmFlush();
  if (document.hidden) return;
  var sb = window.sbClient, started = Date.now();
  Promise.all([
    sb.from('shared_games').select('*').eq('id', s.game.id).maybeSingle(),
    sb.from('shared_game_players').select('*').eq('game_id', s.game.id).order('position', { ascending: true })
  ]).then(function(r) {
    if (_sgm !== s) return;
    if (r[0].error || r[1].error) {
      if (sgmIsNetworkError(r[0].error || r[1].error)) s.offline = true;
      sgmRenderSync();
      return;
    }
    if (!r[0].data) { sgmClose(true); showToast('Cette partie a été supprimée'); return; }
    // Réponse partie avant l'enregistrement d'une de mes saisies : elle l'effacerait à l'écran
    if (s.lastAckAt && started <= s.lastAckAt) { setTimeout(sgmPoll, 500); return; }
    var before = JSON.stringify([s.game, s.players]);
    var wasLive = s.game.status === 'live';
    s.game = r[0].data;
    var players = r[1].data || [];
    s.pending.forEach(function(op) { sgmApplyOp(players, op); });   // mes saisies pas encore parties restent affichées
    s.players = players;
    s.offline = false;
    s.lastSync = Date.now();
    if (s.pending.length && !s.busy) sgmFlush();
    if (wasLive && s.game.status === 'done' && typeof sgmOnFinished === 'function') sgmOnFinished();
    if (JSON.stringify([s.game, s.players]) !== before) sgmRender();   // pas de redessin inutile toutes les 4 s
    else sgmRenderSync();
  }, function() { if (_sgm === s) { s.offline = true; sgmRenderSync(); } });
}

/* Retour du réseau / de l'écran : on renvoie et on relit tout de suite */
window.addEventListener('online', function() { if (_sgm) { _sgm.offline = false; sgmFlush(); sgmPoll(); } });
document.addEventListener('visibilitychange', function() { if (_sgm && !document.hidden) sgmPoll(); });

/* ═════════════ ÉCRAN DE MARQUE ═════════════ */

function sgmOpenGame(gameId) {
  if (!sgmCloud()) { showToast('Les parties partagées demandent un compte'); return; }
  sgmClose(true);
  var local = lsGet('sgmLocal');
  _sgm = { game: { id: gameId, status: 'live', course: { trous: [] } }, players: [], hole: 1, view: 'score',
           pending: (local && local.gameId === gameId && Array.isArray(local.pending)) ? local.pending : [],
           timer: null, busy: false, offline: false, lastSync: 0, loaded: false };
  if (local && local.gameId === gameId && local.hole) _sgm.hole = local.hole;

  var ov = document.createElement('div');
  ov.id = 'sgm-overlay';
  ov.className = 'qs-overlay sgm-overlay';
  ov.innerHTML = '<div class="qs-stage sgm-stage" id="sgm-stage"><div class="ch-loading">Chargement de la partie…</div></div>';
  document.body.appendChild(ov);
  ov.addEventListener('click', sgmOnClick);

  var s = _sgm;
  Promise.all([
    window.sbClient.from('shared_games').select('*').eq('id', gameId).maybeSingle(),
    window.sbClient.from('shared_game_players').select('*').eq('game_id', gameId).order('position', { ascending: true })
  ]).then(function(r) {
    if (_sgm !== s) return;
    if (r[0].error || !r[0].data) {
      document.getElementById('sgm-stage').innerHTML = '<div class="sgm-empty">'
        + (r[0].error ? 'Impossible de charger la partie (' + sgmEsc(r[0].error.message) + ').' : 'Partie introuvable.')
        + '<br><br><button class="dash-btn dash-btn-outline" data-sgm="close">Fermer</button></div>';
      return;
    }
    s.game = r[0].data;
    s.players = r[1].data || [];
    s.pending.forEach(function(op) { sgmApplyOp(s.players, op); });
    s.loaded = true;
    s.lastSync = Date.now();
    // Reprendre au premier trou incomplet
    if (!(local && local.gameId === gameId)) s.hole = sgmFirstOpenHole();
    sgmRender();
    sgmFlush();
    s.timer = setInterval(sgmPoll, SGM_POLL_MS);
  }, function(e) {
    var st = document.getElementById('sgm-stage');
    if (st) st.innerHTML = '<div class="sgm-empty">Pas de réseau pour charger la partie.<br><br><button class="dash-btn dash-btn-outline" data-sgm="close">Fermer</button></div>';
  });
}

function sgmFirstOpenHole() {
  var holes = sgmHoles(_sgm.game);
  for (var i = 0; i < holes.length; i++) {
    var open = sgmUnits(_sgm.game, _sgm.players).some(function(p) { return !p.scores || p.scores[i] === null || p.scores[i] === undefined; });
    if (open) return i + 1;
  }
  return Math.max(1, holes.length);
}

function sgmClose(silent) {
  var ov = document.getElementById('sgm-overlay');
  if (_sgm && _sgm.timer) clearInterval(_sgm.timer);
  if (_sgm && _sgm.pending.length && !silent) showToast(_sgm.pending.length + ' saisie(s) en attente de réseau — elles partiront à la réouverture');
  _sgm = null;
  if (ov) ov.remove();
}

function sgmIsOwner() { return _sgm && currentUser && _sgm.game.created_by === currentUser.id; }

function sgmRender() {
  var st = document.getElementById('sgm-stage');
  if (!st || !_sgm || !_sgm.loaded) return;
  var g = _sgm.game, players = sgmUnits(_sgm.game, _sgm.players), holes = sgmHoles(g);
  var idx = Math.min(Math.max(_sgm.hole, 1), holes.length) - 1;
  var h = holes[idx] || { num: idx + 1, par: 4 };
  var live = g.status === 'live';
  var match = sgmMatch(g, players);

  var strip = holes.map(function(hh, i) {
    var filled = players.length && players.every(function(p) { return p.scores && p.scores[i] !== null && p.scores[i] !== undefined; });
    var cls = 'qs-cell' + (i === idx ? ' cur' : '') + (filled ? ' sgm-done' : '');
    if (match && match.byHole[i] !== null && match.byHole[i] !== undefined) cls += match.byHole[i] === -1 ? ' sgm-halved' : ' sgm-won-' + match.byHole[i];
    return '<button class="' + cls + '" data-sgm="go" data-i="' + (i + 1) + '">' + (hh.num || i + 1) + '</button>';
  }).join('');

  var head = '<div class="qs-top">'
    + '<button class="qs-x" data-sgm="close" title="Fermer (la partie continue)">×</button>'
    + '<div class="qs-top-c"><div class="qs-course">' + sgmEsc((g.course && g.course.name) || 'Parcours') + '</div>'
    +   '<div class="qs-total">' + SGM_FORMATS[g.format].label + ' · code <strong>' + sgmEsc(g.code) + '</strong> · <span id="sgm-sync"></span></div></div>'
    + '<button class="qs-finish-top" data-sgm="share" title="Inviter">Inviter</button>'
    + '</div>'
    + (live ? '' : '<div class="sgm-finished">Partie terminée' + (match && match.result ? ' · ' + sgmEsc(match.text) : '') + '</div>')
    + (match ? '<div class="sgm-match' + (match.leader === null ? '' : ' lead-' + match.leader) + '">' + sgmEsc(match.text) + '</div>'
      + '<div class="sgm-legend"><span class="k0"></span>' + sgmEsc(players[0].name.split(' ')[0]) + ' gagne'
      + '<span class="k1"></span>' + sgmEsc(players[1].name.split(' ')[0]) + ' gagne<span class="kh"></span>partagé</div>' : '')
    + '<div class="sgm-tabs"><button class="sgm-tab' + (_sgm.view === 'score' ? ' on' : '') + '" data-sgm="view" data-v="score">Carte</button>'
    +   '<button class="sgm-tab' + (_sgm.view === 'board' ? ' on' : '') + '" data-sgm="view" data-v="board">Classement</button></div>';

  var body = _sgm.view === 'board' ? sgmBoardHtml() : sgmScoreHtml(idx, h);

  st.innerHTML = head + (_sgm.view === 'score' ? '<div class="qs-strip">' + strip + '</div>' : '') + body + sgmFooterHtml(idx, holes.length);
  var det = st.querySelector('.sgm-putts');
  if (det) det.addEventListener('toggle', function() { lsSet('sgmPuttsOpen', det.open); });
  sgmRenderSync();
}

function sgmScoreHtml(idx, h) {
  var g = _sgm.game, players = sgmUnits(_sgm.game, _sgm.players), live = g.status === 'live', team = sgmIsTeam(g);
  var rows = players.map(function(p, pi) {
    var sc = p.scores ? p.scores[idx] : null;
    var has = sc !== null && sc !== undefined;
    var strokes = sgmStrokesOn(g, players, pi, h);
    var sub = [];
    if (strokes > 0) sub.push('<span class="sgm-dots">' + new Array(Math.min(strokes, 3) + 1).join('•') + '</span> ' + strokes + ' coup' + (strokes > 1 ? 's' : '') + ' reçu' + (strokes > 1 ? 's' : ''));
    var full = sgmBoard(g, players).find(function(r) { return r.player === p; });
    if (full.thru) {
      sub.push(g.format === 'stableford' ? full.points + ' pts' : sgmRel(full.toPar));
      sub.push(full.thru + ' trou' + (full.thru > 1 ? 's' : ''));
    } else if (team) sub.push(p.teamCh !== null ? 'HJ équipe ' + p.teamCh : 'sans handicap d\'équipe');
    else sub.push(p.hcp !== null && p.hcp !== undefined ? 'index ' + Number(p.hcp).toFixed(1).replace('.', ',') : 'sans index');
    if (team) sub.unshift(p.members.map(function(m) { return sgmEsc(m.name.split(' ')[0]); }).join(' & '));
    if (has && g.format === 'stableford') sub.push('<strong>' + stablefordPoints(sc, h.par, strokes) + ' pt' + (stablefordPoints(sc, h.par, strokes) > 1 ? 's' : '') + ' ici</strong>');
    var cls = has ? qsRelClass(sc - h.par) : '';
    var mine = currentUser && (team ? p.members.some(function(m) { return m.user_id === currentUser.id; }) : (p.user_id && p.user_id === currentUser.id));
    return '<div class="sgm-p' + (mine ? ' me' : '') + '">'
      + '<div class="sgm-av" style="' + (p.color ? 'color:' + sgmEsc(p.color) + ';' : '') + '">' + sgmEsc(p.initials || (p.name || '?').slice(0, 2).toUpperCase()) + '</div>'
      + '<div class="sgm-pinfo"><div class="sgm-pname">' + sgmEsc(p.name) + (mine ? ' <span class="comm-me">' + (team ? 'ton équipe' : 'toi') + '</span>' : '') + '</div>'
      +   '<div class="sgm-psub">' + sub.join(' · ') + '</div></div>'
      + '<div class="sgm-step">'
      +   '<button class="sgm-b" data-sgm="adj" data-pid="' + p.id + '" data-d="-1"' + (live ? '' : ' disabled') + '>−</button>'
      +   '<div class="sgm-sv ' + cls + '">' + (has ? sc : '–') + '</div>'
      +   '<button class="sgm-b" data-sgm="adj" data-pid="' + p.id + '" data-d="1"' + (live ? '' : ' disabled') + '>+</button>'
      + '</div></div>';
  }).join('');

  var anyEmpty = players.some(function(p) { return !p.scores || p.scores[idx] === null || p.scores[idx] === undefined; });
  var putts = players.map(function(p) {
    var pt = p.putts ? p.putts[idx] : null;
    return '<div class="qs-opt-row"><span class="qs-opt-l">' + sgmEsc(p.name.split(' ')[0]) + '</span><div class="qs-opt-btns qs-putt-btns">'
      + [0, 1, 2, 3, 4].map(function(n) {
          return '<button class="qs-opt-b qs-putt' + (pt === n ? ' on' : '') + '" data-sgm="putt" data-pid="' + p.id + '" data-n="' + n + '"' + (live ? '' : ' disabled') + '>' + n + '</button>';
        }).join('') + '</div></div>';
  }).join('');

  return '<div class="qs-hole"><div class="qs-hole-n">Trou ' + (h.num || idx + 1) + '</div>'
    + '<div class="qs-hole-meta">Par ' + h.par + (h.longueur ? ' · ' + h.longueur + ' m' : '') + (h.si ? ' · SI ' + h.si : '') + '</div></div>'
    + ((typeof hnInlineHtml === 'function') ? hnInlineHtml(g.course, idx) : '')
    + (players.length ? '<div class="sgm-players">' + rows + '</div>' : '<div class="sgm-empty">Aucun joueur dans cette partie.</div>')
    + (live && anyEmpty && players.length > 1 ? '<button class="sgm-allpar" data-sgm="allpar">Par pour les cases vides</button>' : '')
    + '<div class="sgm-hint">+ ou − sur une case vide inscrit d\'abord le par.' + (team ? ' Un seul score par équipe.' : '') + '</div>'
    + (players.length ? '<details class="qs-opt sgm-putts"' + (lsGet('sgmPuttsOpen') ? ' open' : '') + '><summary>Putts (facultatif)</summary><div class="qs-opt-body">' + putts + '</div></details>' : '');
}

function sgmBoardHtml() {
  var g = _sgm.game, players = sgmUnits(_sgm.game, _sgm.players), holes = sgmHoles(g), team = sgmIsTeam(g);
  var rows = sgmBoard(g, players);
  var teamNet = team && rows.every(function(r) { return r.ch !== null; });
  var match = sgmMatch(g, players);
  var head = '<div class="sgm-board-row sgm-board-head"><span>#</span><span>Joueur</span><span>Trous</span><span>Brut</span>'
    + '<span>' + (g.format === 'stableford' ? 'Points' : (g.format === 'match' || teamNet ? 'Net' : 'Score')) + '</span></div>';
  var pos = 0, prevKey = null;
  var list = rows.map(function(r, i) {
    var key = g.format === 'stableford' ? r.points : (teamNet ? r.netToPar : r.toPar);
    if (key !== prevKey) { pos = i + 1; prevKey = key; }
    var main = !r.thru ? '–' : (g.format === 'stableford' ? r.points : (g.format === 'match' || teamNet ? sgmRel(r.netToPar) : sgmRel(r.toPar)));
    return '<div class="sgm-board-row"><span class="sgm-pos">' + (r.thru ? pos : '–') + '</span>'
      + '<span class="sgm-bname">' + sgmEsc(r.player.name) + (r.ch !== null ? ' <em>HJ ' + Math.round(r.ch) + '</em>' : '')
      +   (team ? '<em class="sgm-bteam">' + r.player.members.map(function(m) { return sgmEsc(m.name.split(' ')[0]); }).join(' & ') + '</em>' : '') + '</span>'
      + '<span>' + r.thru + '</span><span>' + (r.thru ? r.gross : '–') + '</span><span class="sgm-bmain">' + main + '</span></div>';
  }).join('');

  // Carte complète : 18 trous × joueurs
  var grid = '<div class="sgm-grid-wrap"><table class="sgm-grid"><thead><tr><th>Trou</th>'
    + holes.map(function(h) { return '<th>' + (h.num || '') + '</th>'; }).join('') + '<th>Tot</th></tr>'
    + '<tr class="sgm-par"><th>Par</th>' + holes.map(function(h) { return '<td>' + h.par + '</td>'; }).join('') + '<td>' + sgmParTotal(g) + '</td></tr></thead><tbody>'
    + players.map(function(p) {
        var tot = 0;
        return '<tr><th>' + sgmEsc(team ? p.name.replace('Équipe ', 'Éq. ') : p.name.split(' ')[0]) + '</th>' + holes.map(function(h, i) {
          var s = p.scores ? p.scores[i] : null;
          if (s === null || s === undefined) return '<td></td>';
          tot += s;
          return '<td class="' + qsRelClass(s - h.par) + '">' + s + '</td>';
        }).join('') + '<td><strong>' + (tot || '') + '</strong></td></tr>';
      }).join('')
    + '</tbody></table></div>';

  var allowance = '';
  if (match) {
    var al = sgmMatchAllowance(g, players);
    allowance = '<div class="sgm-note">' + (al && al.receiver !== null
      ? sgmEsc(players[al.receiver].name.split(' ')[0]) + ' reçoit ' + al.strokes + ' coup' + (al.strokes > 1 ? 's' : '') + ' (différence des handicaps de jeu), sur les trous d\'index 1 à ' + Math.min(18, al.strokes) + (al.strokes > 18 ? ' puis en boucle' : '') + '.'
      : 'Aucun coup rendu : handicaps de jeu identiques (ou non renseignés).') + '</div>';
  } else if (team) {
    var pcts = SGM_TEAM_ALLOW[g.format] || {};
    var how = g.format === 'scramble' ? 'à 2 : 35 % du meilleur handicap de jeu + 15 % de l\'autre ; à 3 : 30/20/10 % ; à 4 : 25/20/15/10 %'
      : (g.format === 'greensome' ? '60 % du meilleur handicap de jeu + 40 % de l\'autre' : '50 % de la somme des deux handicaps de jeu');
    allowance = '<div class="sgm-note">HJ équipe = ' + how + ' (recommandations du WHS). '
      + (teamNet ? 'Le classement se fait en net : brut moins les coups reçus trou par trou.' : 'Il manque un index dans une équipe : classement en brut.')
      + ' Les parties en équipe ne comptent pas pour l\'index et ne vont pas dans l\'historique individuel.</div>';
  } else {
    allowance = '<div class="sgm-note">HJ = handicap de jeu sur le départ joué' + (g.tee && g.tee.name ? ' (' + sgmEsc(g.tee.name) + ')' : '') + '. '
      + (g.format === 'stableford' ? 'Points calculés avec les coups reçus par index de difficulté.' : 'Score = brut par rapport au par des trous joués.') + '</div>';
  }
  return '<div class="sgm-board">' + head + list + '</div>' + allowance + grid;
}

function sgmFooterHtml(idx, n) {
  var g = _sgm.game;
  var nav = _sgm.view === 'score'
    ? '<div class="qs-nav sgm-nav"><button class="qs-nav-b" data-sgm="go" data-i="' + idx + '"' + (idx === 0 ? ' disabled' : '') + '>' + (idx === 0 ? '←' : '← Trou ' + idx) + '</button>'
      + '<button class="qs-nav-b" data-sgm="go" data-i="' + (idx + 2) + '"' + (idx + 1 >= n ? ' disabled' : '') + '>' + (idx + 1 >= n ? '→' : 'Trou ' + (idx + 2) + ' →') + '</button></div>'
    : '';
  var owner = sgmIsOwner();
  var actions = '';
  if (g.status === 'live') {
    actions = '<div class="sgm-actions">'
      + (_sgm.players.length < SGM_MAX_PLAYERS && !sgmIsTeam(g) && !(g.format === 'match' && _sgm.players.length >= 2) ? '<button class="dash-btn dash-btn-outline" data-sgm="guest">+ Joueur invité</button>' : '')
      + (owner ? '<button class="dash-btn dash-btn-gold" data-sgm="finish">Terminer la partie</button>' : '')
      + '</div>';
  } else if (typeof sgmClaimBarHtml === 'function') {
    actions = sgmClaimBarHtml();
  }
  return nav + actions;
}

/* Indicateur de synchro dans l'en-tête */
function sgmRenderSync() {
  var el = document.getElementById('sgm-sync');
  if (!el || !_sgm) return;
  var n = _sgm.pending.length;
  if (_sgm.offline) el.innerHTML = '<span class="sgm-off">hors réseau' + (n ? ' · ' + n + ' en attente' : '') + '</span>';
  else if (n) el.innerHTML = '<span class="sgm-wait">envoi… (' + n + ')</span>';
  else el.innerHTML = '<span class="sgm-ok">✓ à jour</span>';
}

function sgmOnClick(e) {
  var t = e.target.closest('[data-sgm]');
  if (!t || t.disabled || !_sgm) return;
  var a = t.getAttribute('data-sgm');
  var holes = sgmHoles(_sgm.game);
  var idx = _sgm.hole - 1;
  if (a === 'close') { sgmClose(); return; }
  if (a === 'view') { _sgm.view = t.getAttribute('data-v'); sgmRender(); return; }
  if (a === 'go') {
    _sgm.hole = Math.min(Math.max(1, parseInt(t.getAttribute('data-i'), 10)), holes.length);
    _sgm.view = 'score'; sgmSaveLocal(); sgmRender(); return;
  }
  if (a === 'share') { sgmOpenShare(_sgm.game); return; }
  if (a === 'adj') {
    var p = _sgm.players.find(function(x) { return x.id === t.getAttribute('data-pid'); });
    if (!p) return;
    var par = holes[idx].par, cur = p.scores ? p.scores[idx] : null;
    var next = (cur === null || cur === undefined) ? par : Math.min(20, Math.max(1, cur + parseInt(t.getAttribute('data-d'), 10)));
    sgmQueue(p.id, idx, { score: next });
    sgmRender(); return;
  }
  if (a === 'allpar') {
    sgmUnits(_sgm.game, _sgm.players).forEach(function(p) {
      if (!p.scores || p.scores[idx] === null || p.scores[idx] === undefined) sgmQueue(p.id, idx, { score: holes[idx].par });
    });
    sgmRender(); return;
  }
  if (a === 'putt') {
    var pp = _sgm.players.find(function(x) { return x.id === t.getAttribute('data-pid'); });
    if (!pp) return;
    var n = parseInt(t.getAttribute('data-n'), 10);
    var curP = pp.putts ? pp.putts[idx] : null;
    lsSet('sgmPuttsOpen', true);
    sgmQueue(pp.id, idx, { putts: curP === n ? null : n });
    sgmRender(); return;
  }
  if (a === 'guest') { sgmAddGuest(); return; }
  if (a === 'finish') { sgmFinish(); return; }
  if (a === 'claim' && typeof sgmClaim === 'function') { sgmClaim(t.getAttribute('data-pid'), t.getAttribute('data-state')); return; }
}

function sgmAddGuest() {
  var name = prompt('Nom du joueur invité (sans compte) :');
  if (!name || !name.trim()) return;
  var hcpRaw = prompt('Son index (laisse vide si inconnu) :', '');
  var hcp = hcpRaw ? parseFloat(String(hcpRaw).replace(',', '.')) : null;
  window.sbClient.rpc('add_game_guest', { p_game: _sgm.game.id, p_name: name.trim().slice(0, 40), p_hcp: isNaN(hcp) ? null : hcp })
    .then(function(res) {
      if (res.error || !res.data || !res.data.ok) { showToast((res.data && res.data.error) || 'Ajout impossible'); return; }
      sgmPoll();
    });
}

function sgmFinish() {
  var holes = sgmHoles(_sgm.game);
  var missing = 0;
  sgmUnits(_sgm.game, _sgm.players).forEach(function(p) { holes.forEach(function(h, i) { if (!p.scores || p.scores[i] === null || p.scores[i] === undefined) missing++; }); });
  if (_sgm.pending.length) { showToast('Attends que les dernières saisies soient envoyées'); sgmFlush(); return; }
  if (!confirm(missing ? 'Il reste ' + missing + ' case(s) vide(s). Terminer quand même ?' : 'Terminer la partie ? Les scores ne pourront plus être modifiés.')) return;
  window.sbClient.rpc('finish_shared_game', { p_game: _sgm.game.id }).then(function(res) {
    if (res.error || !res.data || !res.data.ok) { showToast('Impossible de terminer la partie'); return; }
    showToast('Partie terminée ✓');
    sgmPoll();
  });
}

/* ═════════════ INVITER (code + QR) ═════════════ */

function sgmLink(code) {
  return location.origin + location.pathname.replace(/index\.html$/, '') + '?game=' + encodeURIComponent(code);
}

function sgmOpenShare(game) {
  var link = sgmLink(game.code), qr = '';
  try { qr = qrSvg(link); } catch (e) {}
  var old = document.getElementById('sgm-share');
  if (old) old.remove();
  var m = document.createElement('div');
  m.id = 'sgm-share';
  m.className = 'trn-modal sgm-modal';
  m.innerHTML = '<div class="trn-modal-card" style="max-width:420px">'
    + '<div class="trn-modal-head"><div><div class="trn-modal-tag">Partie partagée</div>'
    +   '<div class="trn-modal-title">Faire rejoindre les joueurs</div></div><button class="trn-modal-close" type="button">×</button></div>'
    + '<div class="trn-modal-body">'
    +   '<div class="sgm-bigcode">' + sgmEsc(game.code) + '</div>'
    +   (qr ? '<div class="inv-qr">' + qr + '</div>' : '')
    +   '<div class="inv-qr-hint">Chaque joueur scanne (ou saisit le code dans « Partie à plusieurs ») pour suivre et marquer la carte sur son téléphone.</div>'
    +   '<div class="inv-actions"><button class="dash-btn dash-btn-outline" type="button" id="sgm-copy">Copier le lien</button>'
    +   (navigator.share ? '<button class="dash-btn dash-btn-gold" type="button" id="sgm-native">Partager…</button>' : '') + '</div>'
    + '</div></div>';
  document.body.appendChild(m);
  function close() { m.remove(); }
  m.querySelector('.trn-modal-close').addEventListener('click', close);
  m.addEventListener('click', function(e) { if (e.target === m) close(); });
  m.querySelector('#sgm-copy').addEventListener('click', function() {
    try { navigator.clipboard.writeText(link).then(function() { showToast('Lien copié ✓'); }, function() { showToast(link); }); }
    catch (e) { showToast(link); }
  });
  var nat = m.querySelector('#sgm-native');
  if (nat) nat.addEventListener('click', function() {
    navigator.share({ title: 'The Smart Golfer', text: 'Rejoins la partie sur ' + ((game.course && game.course.name) || 'le parcours') + ' ⛳ (code ' + game.code + ')', url: link }).catch(function() {});
  });
}

/* ═════════════ ACCUEIL : mes parties, créer, rejoindre ═════════════ */

function sgmModal(id, tag, title, body) {
  var old = document.getElementById(id);
  if (old) old.remove();
  var m = document.createElement('div');
  m.id = id;
  m.className = 'trn-modal sgm-modal';
  m.innerHTML = '<div class="trn-modal-card" style="max-width:480px">'
    + '<div class="trn-modal-head"><div><div class="trn-modal-tag">' + tag + '</div><div class="trn-modal-title">' + title + '</div></div>'
    + '<button class="trn-modal-close" type="button">×</button></div><div class="trn-modal-body">' + body + '</div></div>';
  document.body.appendChild(m);
  m.querySelector('.trn-modal-close').addEventListener('click', function() { m.remove(); });
  m.addEventListener('click', function(e) { if (e.target === m) m.remove(); });
  return m;
}

function sgmOpenHub() {
  if (!sgmCloud()) {
    sgmModal('sgm-hub', 'Partie à plusieurs', 'Réservé aux comptes',
      '<p class="inv-text">Une carte partagée relie les téléphones de plusieurs joueurs : il faut être connecté avec un compte (le mode démo reste sur cet appareil).</p>');
    return;
  }
  var m = sgmModal('sgm-hub', 'Partie à plusieurs', 'Carte partagée',
    '<p class="inv-text">Un joueur marque pour le groupe, chacun voit la carte se remplir sur son téléphone. Stroke play, stableford, match play, ou en équipe : scramble, greensome, foursome.</p>'
    + '<button class="btn-express sgm-new" type="button" id="sgm-new"><span class="btn-express-t">+ Nouvelle partie</span><span class="btn-express-s">jusqu\'à 4 joueurs · avec ou sans compte</span></button>'
    + '<div class="ch-join-row sgm-join"><input class="ch-join-input" id="sgm-code" placeholder="Code ou lien reçu" maxlength="200" autocomplete="off">'
    +   '<button class="dash-btn dash-btn-outline" type="button" id="sgm-join-btn">Rejoindre</button></div>'
    + '<div class="ch-join-error" id="sgm-join-err" style="display:none"></div>'
    + '<div id="sgm-claims"></div>'
    + '<div class="sgm-sec-t">Mes parties</div><div id="sgm-list"><div class="ch-loading">Chargement…</div></div>');

  m.querySelector('#sgm-new').addEventListener('click', function() { m.remove(); sgmOpenCreate(); });
  var codeIn = m.querySelector('#sgm-code');
  function join() {
    var code = sgmExtractCode(codeIn.value);
    var err = m.querySelector('#sgm-join-err');
    if (!code) { err.style.display = 'block'; err.textContent = 'Code invalide (6 caractères).'; return; }
    m.remove();
    sgmAskJoin(code);
  }
  m.querySelector('#sgm-join-btn').addEventListener('click', join);
  codeIn.addEventListener('keydown', function(e) { if (e.key === 'Enter') join(); });

  var listEl = m.querySelector('#sgm-list');
  window.sbClient.from('shared_games').select('id, code, course, format, status, played_on, created_by, updated_at')
    .order('updated_at', { ascending: false }).limit(15)
    .then(function(res) {
      if (res.error) {
        listEl.innerHTML = '<div class="ch-empty-inline">' + (/shared_games|schema cache|does not exist/i.test(res.error.message)
          ? 'Les parties partagées ne sont pas encore activées sur le serveur.' : 'Impossible de charger tes parties.') + '</div>';
        return;
      }
      var games = res.data || [];
      if (!games.length) { listEl.innerHTML = '<div class="ch-empty-inline">Aucune partie pour l\'instant.</div>'; return; }
      var ids = games.map(function(g) { return g.id; });
      window.sbClient.from('shared_game_players').select('id, game_id, name, user_id, scores, claimed').in('game_id', ids).then(function(pr) {
        var byGame = {};
        (pr.data || []).forEach(function(p) { (byGame[p.game_id] = byGame[p.game_id] || []).push(p); });
        listEl.innerHTML = games.map(function(g) {
          var ps = byGame[g.id] || [];
          var names = ps.map(function(p) { return p.name.split(' ')[0]; }).join(', ');
          return '<button class="sgm-game" type="button" data-gid="' + g.id + '">'
            + '<span class="sgm-game-st ' + g.status + '">' + (g.status === 'live' ? 'En cours' : 'Terminée') + '</span>'
            + '<span class="sgm-game-t">' + sgmEsc((g.course && g.course.name) || 'Parcours') + '</span>'
            + '<span class="sgm-game-s">' + SGM_FORMATS[g.format].short + ' · ' + sgmEsc(names || '—') + ' · ' + sgmEsc(g.played_on || '') + '</span>'
            + '</button>';
        }).join('');
        listEl.querySelectorAll('.sgm-game').forEach(function(b) {
          b.addEventListener('click', function() { m.remove(); sgmOpenGame(b.getAttribute('data-gid')); });
        });
        if (typeof sgmRenderClaims === 'function') sgmRenderClaims(m.querySelector('#sgm-claims'), games, byGame);
      });
    }, function() { listEl.innerHTML = '<div class="ch-empty-inline">Pas de réseau.</div>'; });
}

function sgmExtractCode(input) {
  var s = String(input || '').trim();
  var mm = s.match(/[?&#]game=([A-Za-z0-9]{6})/);
  var c = (mm ? mm[1] : s).toUpperCase();
  return /^[A-Z0-9]{6}$/.test(c) ? c : null;
}

/* ─── Créer ─── */

function sgmMyIndex() {
  var v = (typeof sgRefHcp === 'function') ? sgRefHcp() : (currentUser && currentUser.hcp);
  return (v === null || v === undefined || isNaN(v)) ? null : Math.round(v * 10) / 10;
}

/* Composition des équipes valide ? (mêmes règles que create_shared_game) */
function sgmTeamCheck(format, players) {
  var a = players.filter(function(p) { return p.team === 1; }).length, b = players.filter(function(p) { return p.team === 2; }).length;
  if (format === 'scramble') {
    if ((a && a < 2) || (b && b < 2) || a + b < 2) return { ok: false, hint: 'Scramble : au moins 2 joueurs par équipe (une équipe de 2 à 4, ou deux équipes de 2).' };
    return { ok: true, hint: a && b ? '2 équipes : classement entre elles.' : 'Une seule équipe : vous jouez contre le par.' };
  }
  if ((a && a !== 2) || (b && b !== 2) || a + b < 2) return { ok: false, hint: SGM_FORMATS[format].label + ' : équipes de 2 exactement.' };
  return { ok: true, hint: a && b ? '2 équipes de 2 : classement entre elles.' : 'Une équipe de 2 : vous jouez contre le par.' };
}

function sgmOpenCreate() {
  var courses = (typeof getAllCourses === 'function') ? getAllCourses() : [];
  if (!courses.length) { showToast('Ajoute d\'abord un parcours'); return; }
  var defId = (typeof selectedCourse !== 'undefined' && selectedCourse) ? selectedCourse.id : courses[0].id;
  var state = { players: [], mates: [] };
  state.players.push({ user_id: currentUser.id, name: currentUser.name, initials: currentUser.initials, color: currentUser.color, hcp: sgmMyIndex(), me: true });

  var m = sgmModal('sgm-create', 'Nouvelle partie', 'Carte partagée', ''
    + '<div class="qt-field"><label class="qt-l" for="sgm-course">Parcours</label><select class="qt-i" id="sgm-course">'
    +   courses.map(function(c) { return '<option value="' + sgmEsc(c.id) + '"' + (c.id === defId ? ' selected' : '') + '>' + sgmEsc(c.name) + '</option>'; }).join('')
    + '</select></div>'
    + '<div class="qt-field"><label class="qt-l" for="sgm-tee">Départ</label><select class="qt-i" id="sgm-tee"></select></div>'
    + '<div class="qt-l">Format</div><div class="sgm-formats" id="sgm-formats">'
    +   Object.keys(SGM_FORMATS).map(function(k, i) { return '<button type="button" class="theme-opt' + (i === 0 ? ' on' : '') + '" data-f="' + k + '">' + SGM_FORMATS[k].label + '</button>'; }).join('')
    + '</div>'
    + '<div class="sgm-fhelp" id="sgm-fhelp">' + SGM_FORMATS.stroke.help + '</div>'
    + '<div class="sgm-sec-t">Joueurs <span id="sgm-count"></span></div>'
    + '<div id="sgm-players"></div>'
    + '<div id="sgm-mates"><div class="ch-loading">Membres de tes groupes…</div></div>'
    + '<div class="sgm-guest-row"><input class="obj-input" id="sgm-gname" placeholder="Invité sans compte" maxlength="40">'
    +   '<input class="obj-input" id="sgm-ghcp" placeholder="Index" inputmode="decimal" maxlength="5">'
    +   '<button class="dash-btn dash-btn-outline" type="button" id="sgm-gadd">Ajouter</button></div>'
    + '<div class="ch-join-error" id="sgm-cerr" style="display:none"></div>'
    + '<div class="trn-modal-actions sgm-create-actions"><button class="dash-btn dash-btn-outline" type="button" id="sgm-ccancel">Annuler</button>'
    +   '<button class="dash-btn dash-btn-gold" type="button" id="sgm-cgo">Lancer la partie</button></div>');

  var courseSel = m.querySelector('#sgm-course'), teeSel = m.querySelector('#sgm-tee');
  var format = 'stroke';
  function course() { return courses.find(function(c) { return c.id === courseSel.value; }); }
  function fillTees() {
    var tees = getCourseTees(course()), wanted = teeRecall(courseSel.value);
    teeSel.innerHTML = tees.map(function(t) {
      return '<option value="' + sgmEsc(t.id) + '"' + (t.id === wanted ? ' selected' : '') + '>' + sgmEsc(t.name)
        + (t.rating ? ' · SSS ' + Number(t.rating).toFixed(1) : '') + (t.slope ? ' · slope ' + t.slope : '') + '</option>';
    }).join('');
    teeSel.disabled = tees.length < 2;
  }
  fillTees();
  courseSel.addEventListener('change', fillTees);
  m.querySelectorAll('#sgm-formats [data-f]').forEach(function(b) {
    b.addEventListener('click', function() {
      var wasTeam = !!SGM_FORMATS[format].team;
      format = b.getAttribute('data-f');
      m.querySelectorAll('#sgm-formats [data-f]').forEach(function(x) { x.classList.toggle('on', x === b); });
      m.querySelector('#sgm-fhelp').textContent = SGM_FORMATS[format].help;
      if (SGM_FORMATS[format].team && !wasTeam) autoTeams();
      renderPlayers();
    });
  });

  /* Équipes par défaut : 4 joueurs → A B A B ; sinon tout le monde en A */
  function autoTeams() {
    state.players.forEach(function(p, i) { p.team = state.players.length === 4 ? (i % 2 ? 2 : 1) : 1; });
  }
  function nextTeam() {
    var a = state.players.filter(function(p) { return p.team === 1; }).length;
    return a < 2 || state.players.length === 2 ? 1 : 2;
  }
  function renderPlayers() {
    var max = format === 'match' ? 2 : SGM_MAX_PLAYERS;
    var team = !!SGM_FORMATS[format].team;
    if (team) state.players.forEach(function(p) { if (p.team !== 1 && p.team !== 2) p.team = nextTeam(); });
    m.querySelector('#sgm-count').textContent = state.players.length + '/' + max;
    m.querySelector('#sgm-players').innerHTML = state.players.map(function(p, i) {
      return '<div class="sgm-chip' + (team ? ' sgm-chip-t' + p.team : '') + '">'
        + (team ? '<button type="button" class="sgm-tbtn" data-team="' + i + '" title="Changer d\'équipe">' + (p.team === 1 ? 'A' : 'B') + '</button>' : '')
        + sgmEsc(p.name) + (p.me ? ' (toi)' : (p.user_id ? '' : ' · invité'))
        + (p.hcp !== null && p.hcp !== undefined ? ' <em>' + String(p.hcp).replace('.', ',') + '</em>' : '')
        + '<button type="button" data-rm="' + i + '" title="Retirer">×</button></div>';
    }).join('') || '<div class="ch-empty-inline">Ajoute au moins un joueur.</div>';
    if (team) m.querySelector('#sgm-players').insertAdjacentHTML('beforeend', '<div class="sgm-team-hint">Touche A / B pour changer un joueur d\'équipe. ' + sgmTeamCheck(format, state.players).hint + '</div>');
    m.querySelectorAll('#sgm-players [data-rm]').forEach(function(b) {
      b.addEventListener('click', function() { state.players.splice(parseInt(b.getAttribute('data-rm'), 10), 1); renderPlayers(); renderMates(); });
    });
    m.querySelectorAll('#sgm-players [data-team]').forEach(function(b) {
      b.addEventListener('click', function() { var p = state.players[parseInt(b.getAttribute('data-team'), 10)]; p.team = p.team === 1 ? 2 : 1; renderPlayers(); });
    });
  }
  function renderMates() {
    var host = m.querySelector('#sgm-mates');
    if (!state.mates.length) { host.innerHTML = ''; return; }
    host.innerHTML = '<div class="sgm-mates">' + state.mates.map(function(p) {
      var inGame = state.players.some(function(x) { return x.user_id === p.id; });
      return '<button type="button" class="sgm-mate' + (inGame ? ' on' : '') + '" data-uid="' + p.id + '">' + (inGame ? '✓ ' : '+ ') + sgmEsc(p.name) + '</button>';
    }).join('') + '</div>';
    host.querySelectorAll('[data-uid]').forEach(function(b) {
      b.addEventListener('click', function() {
        var uid = b.getAttribute('data-uid');
        var at = state.players.findIndex(function(x) { return x.user_id === uid; });
        if (at >= 0) state.players.splice(at, 1);
        else {
          if (!sgmRoomLeft()) return;
          var p = state.mates.find(function(x) { return x.id === uid; });
          state.players.push({ user_id: p.id, name: p.name, initials: p.initials, color: p.color, hcp: p.hcp !== null && p.hcp !== undefined ? Number(p.hcp) : null });
        }
        renderPlayers(); renderMates();
      });
    });
  }
  function sgmRoomLeft() {
    var max = format === 'match' ? 2 : SGM_MAX_PLAYERS;
    if (state.players.length >= max) { showToast(format === 'match' ? 'Le match play se joue à 2' : 'Maximum 4 joueurs'); return false; }
    return true;
  }
  renderPlayers();

  // Membres de mes groupes (ajout en 1 tap)
  window.sbClient.from('group_members').select('group_id').eq('user_id', currentUser.id).then(function(res) {
    var gids = (res.data || []).map(function(r) { return r.group_id; });
    if (!gids.length) { m.querySelector('#sgm-mates').innerHTML = ''; return; }
    window.sbClient.from('group_members').select('user_id').in('group_id', gids).then(function(mr) {
      var ids = {}; (mr.data || []).forEach(function(r) { if (r.user_id !== currentUser.id) ids[r.user_id] = 1; });
      var list = Object.keys(ids);
      if (!list.length) { m.querySelector('#sgm-mates').innerHTML = ''; return; }
      window.sbClient.from('profiles').select('id, name, initials, color, hcp').in('id', list).then(function(pr) {
        state.mates = (pr.data || []).sort(function(a, b) { return (a.name || '').localeCompare(b.name || ''); });
        renderMates();
      });
    });
  });

  m.querySelector('#sgm-gadd').addEventListener('click', function() {
    var n = m.querySelector('#sgm-gname'), hc = m.querySelector('#sgm-ghcp');
    var name = (n.value || '').trim();
    if (!name) { n.focus(); return; }
    if (!sgmRoomLeft()) return;
    var hv = parseFloat(String(hc.value || '').replace(',', '.'));
    state.players.push({ user_id: null, name: name.slice(0, 40), initials: name.slice(0, 2).toUpperCase(), hcp: isNaN(hv) ? null : Math.max(-10, Math.min(54, hv)) });
    n.value = ''; hc.value = '';
    renderPlayers();
  });
  m.querySelector('#sgm-ccancel').addEventListener('click', function() { m.remove(); });
  m.querySelector('#sgm-cgo').addEventListener('click', function() {
    var err = m.querySelector('#sgm-cerr'), go = m.querySelector('#sgm-cgo');
    var c = course(), tee = findTee(c, teeSel.value);
    if (!state.players.length) { err.style.display = 'block'; err.textContent = 'Ajoute au moins un joueur.'; return; }
    if (format === 'match' && state.players.length !== 2) { err.style.display = 'block'; err.textContent = 'Le match play se joue à 2 joueurs.'; return; }
    if (SGM_FORMATS[format].team) {
      var tc = sgmTeamCheck(format, state.players);
      if (!tc.ok) { err.style.display = 'block'; err.textContent = tc.hint; return; }
    }
    err.style.display = 'none'; go.disabled = true; go.textContent = 'Création…';
    teeRemember(c.id, tee ? tee.id : null);
    var snapshot = { id: c.id, name: c.name, par_total: c.par_total, rating: c.rating, slope: c.slope,
      region: c.region || null, ville: c.ville || null,
      trous: (c.trous || []).map(function(h) { return { num: h.num, par: h.par, si: h.si, longueur: h.longueur }; }) };
    window.sbClient.rpc('create_shared_game', {
      p_course: snapshot,
      p_tee: tee ? { id: tee.id, name: tee.name, rating: tee.rating, slope: tee.slope } : null,
      p_format: format,
      p_players: state.players.map(function(p) { return { user_id: p.user_id, name: p.name, initials: p.initials || null, color: p.color || null, hcp: p.hcp, team: SGM_FORMATS[format].team ? p.team : null }; })
    }).then(function(res) {
      go.disabled = false; go.textContent = 'Lancer la partie';
      var d = res.data;
      if (res.error || !d || !d.ok) {
        err.style.display = 'block';
        err.textContent = (res.error && /create_shared_game|schema cache/i.test(res.error.message))
          ? 'Les parties partagées ne sont pas encore activées sur le serveur.'
          : (SGM_FORMATS[format].team && d && /format inconnu/i.test(d.error || ''))
          ? 'Les formats par équipe ne sont pas encore activés sur le serveur : joue en stroke play en attendant.'
          : ((d && d.error) || (res.error && res.error.message) || 'Création impossible');
        return;
      }
      m.remove();
      sgmOpenGame(d.id);
      if (state.players.some(function(p) { return !p.me; })) setTimeout(function() { sgmOpenShare({ code: d.code, course: snapshot }); }, 400);
    }, function() { go.disabled = false; go.textContent = 'Lancer la partie'; err.style.display = 'block'; err.textContent = 'Pas de réseau : il en faut pour créer la partie.'; });
  });
}

/* ─── Rejoindre ─── */

function sgmAskJoin(code) {
  if (!sgmCloud()) { sgmOpenHub(); return; }
  var m = sgmModal('sgm-joinm', 'Partie partagée', 'Rejoindre la partie', '<div id="sgm-jbody"><div class="ch-loading">Recherche de la partie…</div></div>');
  var body = m.querySelector('#sgm-jbody');
  window.sbClient.rpc('shared_game_preview', { p_code: code }).then(function(res) {
    var d = res.data;
    if (res.error || !d) { body.innerHTML = '<p class="inv-text">Les parties partagées ne sont pas encore activées sur le serveur.</p>'; return; }
    if (!d.ok) { body.innerHTML = '<p class="inv-text">Aucune partie avec le code <strong>' + sgmEsc(code) + '</strong>.</p>'; return; }
    var me = d.players.find(function(p) { return p.is_me; });
    if (me) { m.remove(); sgmOpenGame(d.id); return; }
    var free = d.players.filter(function(p) { return !p.taken; });
    var full = d.players.length >= (d.format === 'match' ? 2 : SGM_MAX_PLAYERS);
    body.innerHTML = '<div class="inv-group-name">' + sgmEsc(d.course || 'Parcours') + '</div>'
      + '<div class="inv-group-meta">' + SGM_FORMATS[d.format].label + (d.owner_name ? ' · lancée par ' + sgmEsc(d.owner_name) : '') + (d.status === 'done' ? ' · terminée' : '') + '</div>'
      + '<div class="sgm-sec-t">Qui es-tu ?</div>'
      + (free.length ? free.map(function(p) {
          return '<button class="sgm-slot" type="button" data-pid="' + p.id + '">C\'est moi : <strong>' + sgmEsc(p.name) + '</strong>'
            + (p.team ? ' <em>' + SGM_TEAM_NAMES[p.team] + '</em>' : '')
            + (p.hcp !== null && p.hcp !== undefined ? ' <em>index ' + String(p.hcp).replace('.', ',') + '</em>' : '') + '</button>';
        }).join('') : '')
      + (!full && d.status === 'live' && !(SGM_FORMATS[d.format] && SGM_FORMATS[d.format].team) ? '<button class="sgm-slot sgm-slot-new" type="button" data-pid="">+ Je ne suis pas dans la liste : m\'ajouter</button>' : '')
      + (!free.length && (full || d.status !== 'live') ? '<p class="inv-text">Plus de place libre dans cette partie.</p>' : '')
      + '<div class="ch-join-error" id="sgm-jerr" style="display:none"></div>';
    body.querySelectorAll('.sgm-slot').forEach(function(b) {
      b.addEventListener('click', function() {
        var pid = b.getAttribute('data-pid') || null;
        b.disabled = true;
        window.sbClient.rpc('join_shared_game', { p_code: code, p_player: pid, p_hcp: pid ? null : sgmMyIndex() }).then(function(jr) {
          var jd = jr.data;
          if (jr.error || !jd || !jd.ok) {
            b.disabled = false;
            var er = body.querySelector('#sgm-jerr');
            er.style.display = 'block'; er.textContent = (jd && jd.error) || (jr.error && jr.error.message) || 'Impossible de rejoindre';
            return;
          }
          lsSet('pendingGame', null);
          m.remove();
          showToast('Tu as rejoint la partie ✓');
          sgmOpenGame(jd.game_id);
        });
      });
    });
  }, function() { body.innerHTML = '<p class="inv-text">Pas de réseau.</p>'; });
}

/* ─── Lien reçu (…/?game=CODE) ─── */

function sgmCaptureFromUrl() {
  var code = null;
  try { code = sgmExtractCode(new URLSearchParams(location.search).get('game')); } catch (e) {}
  if (!code) return null;
  lsSet('pendingGame', { code: code, ts: Date.now() });
  try {
    var params = new URLSearchParams(location.search);
    params.delete('game');
    var qs = params.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
  } catch (e) {}
  return code;
}

function sgmOnLaunch() {
  var p = lsGet('pendingGame');
  if (p && p.code && Date.now() - (p.ts || 0) < 2 * 86400000) {
    var tries = 0;
    (function wait() {
      if ((document.querySelector('.onb-modal') || document.getElementById('inv-modal')) && tries++ < 300) { setTimeout(wait, 700); return; }
      if (!sgmCloud()) {
        sgmModal('sgm-hub', 'Partie à plusieurs', 'On t\'invite à marquer une partie',
          '<p class="inv-text">Pour suivre et marquer la carte partagée (code <strong>' + sgmEsc(p.code) + '</strong>), connecte-toi avec un compte : le mode démo reste sur cet appareil. L\'invitation est gardée 48 h.</p>');
        return;
      }
      lsSet('pendingGame', null);
      sgmAskJoin(p.code);
    })();
  } else if (p) {
    lsSet('pendingGame', null);
  }
  if (typeof sgmCheckClaims === 'function') sgmCheckClaims();
}

/* ═════════════ FIN DE PARTIE : chaque joueur ajoute SA carte à son historique ═════════════
   Personne n'écrit dans l'historique d'un autre : le marqueur termine la partie,
   chaque joueur avec un compte valide (ou ignore) sa propre carte. */

/* Le parcours doit exister sur l'appareil du joueur (analyses, game plan, putting) */
function sgmEnsureCourse(game) {
  var snap = game.course || {};
  var all = (typeof getAllCourses === 'function') ? getAllCourses() : [];
  var local = all.find(function(c) { return c.id === snap.id; })
    || all.find(function(c) { return (c.name || '').toLowerCase() === (snap.name || '').toLowerCase(); });
  if (local) return local;
  var course = {
    // ⚠️ Nouvel id : garder celui du créateur faisait échouer l'envoi au cloud (id déjà pris
    // par SON parcours), et la synchro suivante effaçait ce parcours de l'appareil.
    id: 'user-' + Date.now(), name: snap.name || 'Parcours', region: snap.region || '', ville: snap.ville || '',
    par_total: sgmParTotal(game), rating: snap.rating || (game.tee && game.tee.rating) || null, slope: snap.slope || (game.tee && game.tee.slope) || 113,
    trous: sgmHoles(game).map(function(h) { return { num: h.num, par: h.par, si: h.si, longueur: h.longueur || 0 }; }),
    departs: game.tee && game.tee.rating && game.tee.slope ? [game.tee] : undefined,
    importedFrom: 'partie-partagee', shared: false
  };
  course.longueur_totale = course.trous.reduce(function(a, h) { return a + (h.longueur || 0); }, 0) || null;
  if (typeof saveUserCourse === 'function') saveUserCourse(course);
  return course;
}

/* Fabrique une partie d'historique à partir d'une ligne de la carte partagée */
function sgmBuildRound(game, players, player) {
  var course = sgmEnsureCourse(game);
  var holes = sgmHoles(game);
  var tee = game.tee || getCourseTees(course)[0] || {};
  var scores = holes.map(function(h, i) { var s = player.scores ? player.scores[i] : null; return (s === null || s === undefined) ? null : s; });
  while (scores.length < 18) scores.push(null);
  var puttsBy = holes.map(function(h, i) { var p = player.putts ? player.putts[i] : null; return (p === null || p === undefined) ? null : p; });
  while (puttsBy.length < 18) puttsBy.push(null);
  var filled = scores.filter(function(s) { return s !== null; });
  var total = filled.reduce(function(a, b) { return a + b; }, 0);
  var withPutts = holes.filter(function(h, i) { return scores[i] !== null && puttsBy[i] !== null; }).length;
  var allPutts = filled.length > 0 && withPutts === filled.length;
  var girBy = holes.map(function(h, i) {
    return (scores[i] !== null && puttsBy[i] !== null) ? ((scores[i] - puttsBy[i]) <= (h.par - 2) ? 1 : 0) : null;
  });
  while (girBy.length < 18) girBy.push(null);
  var rating = tee.rating || course.rating, slope = tee.slope || course.slope || 113;
  var others = players.filter(function(p) { return p.id !== player.id; }).map(function(p) { return p.name.split(' ')[0]; });
  var match = sgmMatch(game, players);
  var fmt = game.format === 'match' ? 'match' : game.format;

  var entry = {
    id: Date.now(),
    date: game.played_on || new Date().toISOString().slice(0, 10),
    course: course.name, courseId: course.id,
    holePars: holes.map(function(h) { return h.par; }),
    score: total, par: course.par_total || sgmParTotal(game),
    diff: parseFloat(((total - rating) * 113 / slope).toFixed(1)),
    teeId: tee.id || null, teeName: tee.name || null, teeRating: rating, teeSlope: slope,
    fir: null, firTotal: holes.filter(function(h) { return h.par !== 3; }).length,
    gir: allPutts ? girBy.filter(function(g) { return g === 1; }).length : null,
    putts: allPutts ? puttsBy.reduce(function(a, p) { return a + (p || 0); }, 0) : null,
    cond: 'calme', format: fmt,
    hcp: (player.hcp === null || player.hcp === undefined) ? null : Number(player.hcp),
    notes: 'Carte partagée' + (others.length ? ' avec ' + others.join(', ') : ''),
    scores: scores,
    puttsByHole: puttsBy, girByHole: girBy, firByHole: new Array(18).fill(null),
    sg_tee: null, sg_app: null, sg_arg: null, sg_putt: null,
    sharedGameId: game.id, sharedGameCode: game.code, courseHoles: holes.length,
    weather: (typeof wxCached === 'function' && game.played_on === new Date().toISOString().slice(0, 10)) ? wxCached(course) : null,
    detailMode: false, proMode: false,
    shots: {}, shotsOnGreen: {}, shotsPutts: {}, shotsFairway: {}, shotsFairwayMissSide: {},
    clubs: [], fairwayPos: [], distRemain: [], clubsApp: [], distFromTarget2: []
  };
  if (match) {
    var me = players.indexOf(player);
    entry.matchResult = match.leader === null ? 'égalité' : (match.leader === me ? 'gagné ' : 'perdu ') + (match.result || (match.lead + ' up'));
    entry.matchOpponent = others[0] || null;
  }
  if (fmt === 'stableford' || fmt === 'match') {
    var stb = stablefordRound(course, scores, entry.hcp, { rating: rating, slope: slope });
    if (stb && fmt === 'stableford') { entry.points = stb.points; entry.courseHcp = stb.ch; entry.pointsByHole = stb.byHole.map(function(h) { return h ? h.points : null; }); }
    else if (stb) entry.courseHcp = stb.ch;
  }
  if (typeof sgApplyToRound === 'function') { try { sgApplyToRound(entry); } catch (e) {} }
  return entry;
}

function sgmClaim(pid, state) {
  var s = _sgm;
  if (!s) return;
  var player = s.players.find(function(p) { return p.id === pid; });
  if (!player) return;
  sgmClaimPlayer(s.game, s.players, player, state, function() { if (_sgm === s) sgmRender(); });
}

function sgmClaimPlayer(game, players, player, state, done) {
  if (state === 'saved') {
    var rounds = lsGet('rounds') || [];
    var already = rounds.some(function(r) { return r.sharedGameId === game.id; });
    if (!already) {
      var filled = (player.scores || []).filter(function(x) { return x !== null && x !== undefined; }).length;
      if (filled < 9) { showToast('Il faut au moins 9 trous marqués pour l\'ajouter à ton historique'); return; }
      var entry = sgmBuildRound(game, players, player);
      if (typeof roundHistory !== 'undefined') { roundHistory = lsGet('rounds') || []; roundHistory.unshift(entry); lsSet('rounds', roundHistory); }
      else { rounds.unshift(entry); lsSet('rounds', rounds); }
      if (window.tsgSync) { try { window.tsgSync.pushRound(entry); } catch (e) { console.warn('[TSG] sync carte partagée:', e.message); } }
      if (typeof tsgAutoBackup === 'function') { try { tsgAutoBackup(true); } catch (e) {} }
      if (typeof chCheck === 'function') { try { chCheck(true); } catch (e) {} }
      if (typeof renderHistory === 'function') { try { renderHistory(); } catch (e) {} }
      if (typeof updateNavUI === 'function') { try { updateNavUI(); } catch (e) {} }
      showToast('Carte ajoutée à ton historique ✓ ' + entry.course + ' · ' + entry.score);
    }
  }
  window.sbClient.rpc('claim_game_card', { p_player: player.id, p_state: state }).then(function(res) {
    if (state === 'ignored') showToast('Carte ignorée');
    player.claimed = state;
    if (done) done();
  }, function() { if (done) done(); });
}

/* Barre affichée en bas d'une partie terminée */
function sgmClaimBarHtml() {
  if (!_sgm || !currentUser) return '';
  if (sgmIsTeam(_sgm.game)) return '<div class="sgm-claim"><div class="sgm-claim-t">Partie en équipe terminée</div>'
    + '<div class="sgm-claim-d">Les formats par équipe ne comptent pas pour l\'index : la carte reste ici, sans aller dans ton historique individuel.</div></div>';
  var mine = _sgm.players.find(function(p) { return p.user_id === currentUser.id; });
  if (!mine) return '<div class="sgm-claim"><div class="sgm-claim-t">Partie terminée</div><div class="sgm-claim-d">Tu as marqué sans jouer : chaque joueur ajoute sa carte depuis son téléphone.</div></div>';
  var already = (lsGet('rounds') || []).some(function(r) { return r.sharedGameId === _sgm.game.id; });
  if (mine.claimed === 'saved' || already) return '<div class="sgm-claim done"><div class="sgm-claim-t">✓ Ta carte est dans ton historique</div></div>';
  if (mine.claimed === 'ignored') return '<div class="sgm-claim"><div class="sgm-claim-t">Carte ignorée</div>'
    + '<button class="dash-btn dash-btn-outline" data-sgm="claim" data-pid="' + mine.id + '" data-state="saved">L\'ajouter quand même</button></div>';
  return '<div class="sgm-claim"><div class="sgm-claim-t">Ta carte : ' + (mine.scores || []).filter(function(x) { return x !== null && x !== undefined; }).reduce(function(a, b) { return a + b; }, 0) + '</div>'
    + '<div class="sgm-claim-d">Ajoute-la à ton historique : Strokes Gained, index, trophées et défis en tiennent compte.</div>'
    + '<div class="sgm-claim-b"><button class="dash-btn dash-btn-outline" data-sgm="claim" data-pid="' + mine.id + '" data-state="ignored">Ignorer</button>'
    + '<button class="dash-btn dash-btn-gold" data-sgm="claim" data-pid="' + mine.id + '" data-state="saved">Ajouter à mon historique</button></div></div>';
}

function sgmOnFinished() {
  if (!_sgm) return;
  _sgm.view = 'board';
  showToast('La partie est terminée — vérifie le classement et valide ta carte');
}

/* Au lancement : cartes terminées pas encore validées */
function sgmCheckClaims() {
  if (!sgmCloud()) return;
  var uid = currentUser.id;
  window.sbClient.from('shared_game_players').select('id, game_id, name, scores, putts, hcp, user_id, claimed')
    .eq('user_id', uid).is('claimed', null).then(function(res) {
      if (res.error || !res.data || !res.data.length) return;
      var ids = res.data.map(function(p) { return p.game_id; });
      window.sbClient.from('shared_games').select('*').in('id', ids).eq('status', 'done').then(function(gr) {
        var games = gr.data || [];
        if (!games.length) return;
        var rounds = lsGet('rounds') || [];
        var todo = games.filter(function(g) { return !sgmIsTeam(g) && !rounds.some(function(r) { return r.sharedGameId === g.id; }); });
        if (!todo.length) return;
        sgmShowClaimsModal(todo);
      });
    });
}

function sgmShowClaimsModal(games) {
  if (document.getElementById('sgm-overlay')) return;
  var m = sgmModal('sgm-claims-m', 'Partie partagée', games.length > 1 ? games.length + ' cartes à valider' : 'Une carte à valider',
    '<p class="inv-text">Ces parties ont été marquées pour toi. Ajoute ta carte à ton historique, ou ignore-la.</p><div id="sgm-claims-list"><div class="ch-loading">…</div></div>');
  var list = m.querySelector('#sgm-claims-list');
  window.sbClient.from('shared_game_players').select('*').in('game_id', games.map(function(g) { return g.id; })).then(function(pr) {
    var byGame = {};
    (pr.data || []).forEach(function(p) { (byGame[p.game_id] = byGame[p.game_id] || []).push(p); });
    sgmRenderClaims(list, games, byGame, function() { if (!list.querySelector('.sgm-claim-row')) m.remove(); });
  });
}

/* Liste « cartes à valider » (accueil des parties + modale de lancement) */
function sgmRenderClaims(host, games, byGame, onChange) {
  if (!host || !currentUser) return;
  var rounds = lsGet('rounds') || [];
  var rows = [];
  games.forEach(function(g) {
    if (g.status !== 'done' || sgmIsTeam(g)) return;
    var ps = (byGame[g.id] || []).slice().sort(function(a, b) { return (a.position || 0) - (b.position || 0); });
    var mine = ps.find(function(p) { return p.user_id === currentUser.id; });
    if (!mine || mine.claimed || rounds.some(function(r) { return r.sharedGameId === g.id; })) return;
    var total = (mine.scores || []).filter(function(x) { return x !== null && x !== undefined; }).reduce(function(a, b) { return a + b; }, 0);
    rows.push({ g: g, ps: ps, mine: mine, total: total });
  });
  if (!rows.length) { host.innerHTML = ''; if (onChange) onChange(); return; }
  host.innerHTML = '<div class="sgm-sec-t">Cartes à valider</div>' + rows.map(function(r, i) {
    return '<div class="sgm-claim-row" data-i="' + i + '"><div><div class="sgm-game-t">' + sgmEsc((r.g.course && r.g.course.name) || 'Parcours') + ' · ' + r.total + '</div>'
      + '<div class="sgm-game-s">' + SGM_FORMATS[r.g.format].short + ' · ' + sgmEsc(r.g.played_on || '') + ' · avec ' + sgmEsc(r.ps.filter(function(p) { return p !== r.mine; }).map(function(p) { return p.name.split(' ')[0]; }).join(', ') || 'personne') + '</div></div>'
      + '<div class="sgm-claim-b"><button class="dash-btn dash-btn-outline" type="button" data-act="ignored">Ignorer</button>'
      + '<button class="dash-btn dash-btn-gold" type="button" data-act="saved">Ajouter</button></div></div>';
  }).join('');
  host.querySelectorAll('.sgm-claim-row').forEach(function(el) {
    var r = rows[parseInt(el.getAttribute('data-i'), 10)];
    el.querySelectorAll('[data-act]').forEach(function(b) {
      b.addEventListener('click', function() {
        el.querySelectorAll('button').forEach(function(x) { x.disabled = true; });
        sgmClaimPlayer(r.g, r.ps, r.mine, b.getAttribute('data-act'), function() {
          el.remove();
          if (!host.querySelector('.sgm-claim-row')) host.innerHTML = '';
          if (onChange) onChange();
        });
      });
    });
  });
}
