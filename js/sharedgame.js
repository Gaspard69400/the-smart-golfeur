/* ════════════════════════════════════════════
 * THE SMART GOLFER — sharedgame.js
 * CARTE PARTAGÉE À PLUSIEURS + MATCH PLAY.
 *
 * Un joueur marque pour la partie (jusqu'à 4) ; chaque joueur qui a
 * rejoint voit la carte se remplir en direct sur son téléphone, et peut
 * aussi marquer. Formats : stroke play, stableford, match play (à 2).
 *
 * Serveur : backend/parties_partagees.sql. Chaque saisie envoie UNE case
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
  stroke:     { label: 'Stroke play', short: 'Stroke' },
  stableford: { label: 'Stableford',  short: 'Stableford' },
  match:      { label: 'Match play',  short: 'Match' }
};

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

/* Handicap de jeu d'un joueur sur le départ de la partie */
function sgmCourseHcp(game, player) {
  if (!player || player.hcp === null || player.hcp === undefined || player.hcp === '') return null;
  var tee = game.tee || {}, c = game.course || {};
  return courseHandicap(Number(player.hcp), tee.slope || c.slope || 113, tee.rating || c.rating, sgmParTotal(game));
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
  rows.sort(function(a, b) {
    if (!a.thru !== !b.thru) return a.thru ? -1 : 1;
    if (game.format === 'stableford') return b.points - a.points || a.index - b.index;
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
    var open = _sgm.players.some(function(p) { return !p.scores || p.scores[i] === null || p.scores[i] === undefined; });
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
  var g = _sgm.game, players = _sgm.players, holes = sgmHoles(g);
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
  var g = _sgm.game, players = _sgm.players, live = g.status === 'live';
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
    } else sub.push(p.hcp !== null && p.hcp !== undefined ? 'index ' + Number(p.hcp).toFixed(1).replace('.', ',') : 'sans index');
    if (has && g.format === 'stableford') sub.push('<strong>' + stablefordPoints(sc, h.par, strokes) + ' pt' + (stablefordPoints(sc, h.par, strokes) > 1 ? 's' : '') + ' ici</strong>');
    var cls = has ? qsRelClass(sc - h.par) : '';
    var mine = p.user_id && currentUser && p.user_id === currentUser.id;
    return '<div class="sgm-p' + (mine ? ' me' : '') + '">'
      + '<div class="sgm-av" style="' + (p.color ? 'color:' + sgmEsc(p.color) + ';' : '') + '">' + sgmEsc(p.initials || (p.name || '?').slice(0, 2).toUpperCase()) + '</div>'
      + '<div class="sgm-pinfo"><div class="sgm-pname">' + sgmEsc(p.name) + (mine ? ' <span class="comm-me">toi</span>' : '') + '</div>'
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
    + (players.length ? '<div class="sgm-players">' + rows + '</div>' : '<div class="sgm-empty">Aucun joueur dans cette partie.</div>')
    + (live && anyEmpty && players.length > 1 ? '<button class="sgm-allpar" data-sgm="allpar">Par pour les cases vides</button>' : '')
    + '<div class="sgm-hint">+ ou − sur une case vide inscrit d\'abord le par.</div>'
    + (players.length ? '<details class="qs-opt sgm-putts"' + (lsGet('sgmPuttsOpen') ? ' open' : '') + '><summary>Putts (facultatif)</summary><div class="qs-opt-body">' + putts + '</div></details>' : '');
}

function sgmBoardHtml() {
  var g = _sgm.game, players = _sgm.players, holes = sgmHoles(g);
  var rows = sgmBoard(g, players);
  var match = sgmMatch(g, players);
  var head = '<div class="sgm-board-row sgm-board-head"><span>#</span><span>Joueur</span><span>Trous</span><span>Brut</span>'
    + '<span>' + (g.format === 'stableford' ? 'Points' : (g.format === 'match' ? 'Net' : 'Score')) + '</span></div>';
  var pos = 0, prevKey = null;
  var list = rows.map(function(r, i) {
    var key = g.format === 'stableford' ? r.points : r.toPar;
    if (key !== prevKey) { pos = i + 1; prevKey = key; }
    var main = !r.thru ? '–' : (g.format === 'stableford' ? r.points : (g.format === 'match' ? sgmRel(r.netToPar) : sgmRel(r.toPar)));
    return '<div class="sgm-board-row"><span class="sgm-pos">' + (r.thru ? pos : '–') + '</span>'
      + '<span class="sgm-bname">' + sgmEsc(r.player.name) + (r.ch !== null ? ' <em>HJ ' + Math.round(r.ch) + '</em>' : '') + '</span>'
      + '<span>' + r.thru + '</span><span>' + (r.thru ? r.gross : '–') + '</span><span class="sgm-bmain">' + main + '</span></div>';
  }).join('');

  // Carte complète : 18 trous × joueurs
  var grid = '<div class="sgm-grid-wrap"><table class="sgm-grid"><thead><tr><th>Trou</th>'
    + holes.map(function(h) { return '<th>' + (h.num || '') + '</th>'; }).join('') + '<th>Tot</th></tr>'
    + '<tr class="sgm-par"><th>Par</th>' + holes.map(function(h) { return '<td>' + h.par + '</td>'; }).join('') + '<td>' + sgmParTotal(g) + '</td></tr></thead><tbody>'
    + players.map(function(p) {
        var tot = 0;
        return '<tr><th>' + sgmEsc(p.name.split(' ')[0]) + '</th>' + holes.map(function(h, i) {
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
      + (_sgm.players.length < SGM_MAX_PLAYERS && !(g.format === 'match' && _sgm.players.length >= 2) ? '<button class="dash-btn dash-btn-outline" data-sgm="guest">+ Joueur invité</button>' : '')
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
    _sgm.players.forEach(function(p) {
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
  _sgm.players.forEach(function(p) { holes.forEach(function(h, i) { if (!p.scores || p.scores[i] === null || p.scores[i] === undefined) missing++; }); });
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
    '<p class="inv-text">Un joueur marque pour le groupe, chacun voit la carte se remplir sur son téléphone. Stroke play, stableford ou match play.</p>'
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
      format = b.getAttribute('data-f');
      m.querySelectorAll('#sgm-formats [data-f]').forEach(function(x) { x.classList.toggle('on', x === b); });
      renderPlayers();
    });
  });

  function renderPlayers() {
    var max = format === 'match' ? 2 : SGM_MAX_PLAYERS;
    m.querySelector('#sgm-count').textContent = state.players.length + '/' + max;
    m.querySelector('#sgm-players').innerHTML = state.players.map(function(p, i) {
      return '<div class="sgm-chip">' + sgmEsc(p.name) + (p.me ? ' (toi)' : (p.user_id ? '' : ' · invité'))
        + (p.hcp !== null && p.hcp !== undefined ? ' <em>' + String(p.hcp).replace('.', ',') + '</em>' : '')
        + '<button type="button" data-rm="' + i + '" title="Retirer">×</button></div>';
    }).join('') || '<div class="ch-empty-inline">Ajoute au moins un joueur.</div>';
    m.querySelectorAll('#sgm-players [data-rm]').forEach(function(b) {
      b.addEventListener('click', function() { state.players.splice(parseInt(b.getAttribute('data-rm'), 10), 1); renderPlayers(); renderMates(); });
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
    err.style.display = 'none'; go.disabled = true; go.textContent = 'Création…';
    teeRemember(c.id, tee ? tee.id : null);
    var snapshot = { id: c.id, name: c.name, par_total: c.par_total, rating: c.rating, slope: c.slope,
      region: c.region || null, ville: c.ville || null,
      trous: (c.trous || []).map(function(h) { return { num: h.num, par: h.par, si: h.si, longueur: h.longueur }; }) };
    window.sbClient.rpc('create_shared_game', {
      p_course: snapshot,
      p_tee: tee ? { id: tee.id, name: tee.name, rating: tee.rating, slope: tee.slope } : null,
      p_format: format,
      p_players: state.players.map(function(p) { return { user_id: p.user_id, name: p.name, initials: p.initials || null, color: p.color || null, hcp: p.hcp }; })
    }).then(function(res) {
      go.disabled = false; go.textContent = 'Lancer la partie';
      var d = res.data;
      if (res.error || !d || !d.ok) {
        err.style.display = 'block';
        err.textContent = (res.error && /create_shared_game|schema cache/i.test(res.error.message))
          ? 'Les parties partagées ne sont pas encore activées sur le serveur.'
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
            + (p.hcp !== null && p.hcp !== undefined ? ' <em>index ' + String(p.hcp).replace('.', ',') + '</em>' : '') + '</button>';
        }).join('') : '')
      + (!full && d.status === 'live' ? '<button class="sgm-slot sgm-slot-new" type="button" data-pid="">+ Je ne suis pas dans la liste : m\'ajouter</button>' : '')
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
