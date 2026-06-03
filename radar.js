/* ════════════════════════════════════════════
 * THE SMART GOLFER — radar.js
 * Mode Pro : saisie coup par coup avec radar SVG de dispersion
 * Dépend de : data.js (CLUBS), app.js (lsGet/lsSet, showToast)
 * ════════════════════════════════════════════ */

/* ════════════════════════════════════════════
   RADAR DE DISPERSION — SESSION 5
════════════════════════════════════════════ */

// État global de la partie en cours (mode pro)
var sc_proMode = false;           // Mode pro activé ?
var sc_shotsByHole = {};          // { holeNum: [shots] }
var sc_holeOnGreen = {};          // { holeNum: indexDuShotOuArriveeAuGreen }
var sc_holePutts = {};            // { holeNum: nombreDePutts }
var sc_holeFairway = {};          // { holeNum: 'yes'|'no'|null } pour FIR
var sc_clubMemory = {};           // { distance: lastClubUsed } pour suggestion

// État du radar courant (en cours d'édition)
var _radarState = null;

/* La liste CLUBS est définie dans data.js, chargé avant ce module. */

function suggestClubForDistance(distance) {
  if (!distance || distance <= 0) return null;
  // 1. Mémoire personnelle d'abord
  var rounds = lsGet('rounds') || [];
  var sameDistanceShots = [];
  rounds.forEach(function(r) {
    if (!r.shots) return;
    Object.keys(r.shots).forEach(function(holeKey) {
      r.shots[holeKey].forEach(function(shot) {
        if (shot.distBefore && Math.abs(shot.distBefore - distance) < 15 && shot.club) {
          sameDistanceShots.push(shot.club);
        }
      });
    });
  });
  if (sameDistanceShots.length >= 2) {
    // Club le plus utilisé
    var counts = {};
    sameDistanceShots.forEach(function(c) { counts[c] = (counts[c]||0) + 1; });
    var best = Object.keys(counts).sort(function(a,b) { return counts[b]-counts[a]; })[0];
    return { club: best, source: 'mémoire (' + sameDistanceShots.length + ' coups passés)' };
  }
  // 2. Sinon, suggestion générique basée sur la distance
  for (var i = 0; i < CLUBS.length; i++) {
    var c = CLUBS[i];
    if (distance >= c.range[0] && distance <= c.range[1]) {
      return { club: c.val, source: 'suggestion standard' };
    }
  }
  // 3. Hors plage
  if (distance > 280) return { club: 'Driver', source: 'distance importante' };
  if (distance < 15)  return { club: 'LW', source: 'distance très courte' };
  return null;
}

/* ──────────────────────────────────
   OUVERTURE DU RADAR
   options : {
     holeNum,         // numéro du trou
     shotIndex,       // index du coup (0 = drive)
     parTrou,         // par du trou
     totalDist,       // distance totale du trou
     prevShot,        // coup précédent (pour distance restante)
     defaultDist,     // distance par défaut au radar
     isApproach,      // true si on vise le green
     onSave           // callback(shot) quand validé
   }
────────────────────────────────── */
function openRadar(options) {
  options = options || {};
  var holeNum     = options.holeNum;
  var shotIndex   = options.shotIndex;
  var parTrou     = options.parTrou || 4;
  var totalDist   = options.totalDist || 0;
  var defaultDist = options.defaultDist || (parTrou === 3 ? totalDist : totalDist - 220);
  if (defaultDist < 20) defaultDist = 50;

  // Suggestion club
  var suggestion = suggestClubForDistance(defaultDist);

  _radarState = {
    distToTarget: null,    // calculé après clic
    direction: null,       // angle en degrés
    side: null,            // 'left' | 'right' | 'long' | 'short' | 'pin'
    ballX: null,           // position % dans le SVG
    ballY: null,
    club: suggestion ? suggestion.club : '',
    distBefore: defaultDist,
    onGreen: false,        // case arrivée au green
    fairwayState: null     // pour le drive uniquement
  };

  // Build modal
  var modal = document.getElementById('radar-modal');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.className = 'radar-modal';
  modal.id = 'radar-modal';

  // Construction conditionnelle de l'UI
  var coupLabel = '';
  var isDrive = (shotIndex === 0);
  if (isDrive && parTrou !== 3) {
    coupLabel = 'Coup 1 — Départ';
  } else if (isDrive && parTrou === 3) {
    coupLabel = 'Coup 1 — Départ vers green';
  } else {
    coupLabel = 'Coup ' + (shotIndex + 1) + (options.isApproach ? ' — Approche' : '');
  }

  var clubOptionsHtml = '<option value="">— Choisir un club —</option>'
    + CLUBS.map(function(c) {
        return '<option value="' + c.val + '"' + (c.val === _radarState.club ? ' selected' : '') + '>' + c.name + '</option>';
      }).join('');

  // Fairway toggle (uniquement pour drive sur par 4/5)
  var fairwayHtml = '';
  if (isDrive && parTrou !== 3) {
    fairwayHtml = ''
      + '<div>'
      +   '<div class="radar-field-label">Position après le drive</div>'
      +   '<div class="radar-fairway-toggle">'
      +     '<button type="button" class="radar-fairway-btn yes" data-fairway="yes">✓ Sur le fairway</button>'
      +     '<button type="button" class="radar-fairway-btn no" data-fairway="no">✗ Manqué</button>'
      +   '</div>'
      + '</div>';
  }

  // Toggle "arrivée au green" (sauf si c'est déjà sur le green, ou putt)
  var greenToggleHtml = '';
  if (!options.isPutt) {
    greenToggleHtml = ''
      + '<div class="radar-green-toggle" id="radar-green-toggle">'
      +   '<div class="radar-green-checkbox" id="radar-green-cb"></div>'
      +   '<div>'
      +     '<div class="radar-green-label">Arrivée au green ⛳</div>'
      +     '<div class="radar-green-sub">Coche si ta balle est sur le green après ce coup. Les prochains coups seront des putts.</div>'
      +   '</div>'
      + '</div>';
  }

  modal.innerHTML = ''
    + '<div class="radar-card">'
    +   '<div class="radar-header">'
    +     '<div class="radar-header-left">'
    +       '<div class="radar-trou">Trou ' + holeNum + ' · Par ' + parTrou + ' · ' + totalDist + 'm</div>'
    +       '<div class="radar-coup">' + coupLabel + '</div>'
    +     '</div>'
    +     '<button class="radar-close" id="radar-close-btn">×</button>'
    +   '</div>'
    +   '<div class="radar-body">'
    +     '<div class="radar-fields">'
    +       '<div>'
    +         '<div class="radar-field-label">Club utilisé</div>'
    +         '<select class="radar-field-select" id="radar-club">' + clubOptionsHtml + '</select>'
    +         (suggestion ? '<div class="radar-suggestion">◆ Suggestion : ' + suggestion.club + ' (' + suggestion.source + ')</div>' : '')
    +       '</div>'
    +       '<div>'
    +         '<div class="radar-field-label">Distance au coup (m)</div>'
    +         '<input type="number" class="radar-field-input" id="radar-dist-before" value="' + Math.round(defaultDist) + '" min="0" max="500">'
    +       '</div>'
    +     '</div>'
    +     fairwayHtml
    +     '<div>'
    +       '<div class="radar-field-label" style="margin-bottom:8px">Position de ta balle <span style="color:var(--tx4);font-weight:500;text-transform:none;font-size:10px">(tape sur le radar pour positionner)</span></div>'
    +       '<div class="radar-svg-wrap" id="radar-svg-wrap">'
    +         buildRadarSVG()
    +       '</div>'
    +     '</div>'
    +     '<div class="radar-result" id="radar-result">'
    +       '<div class="radar-empty" style="grid-column:1/3">Tape sur le radar pour positionner ta balle</div>'
    +     '</div>'
    +     greenToggleHtml
    +   '</div>'
    +   '<div class="radar-footer">'
    +     '<button class="radar-btn radar-btn-cancel" id="radar-cancel-btn">Annuler</button>'
    +     '<button class="radar-btn radar-btn-validate" id="radar-validate-btn" disabled>Valider ce coup ✓</button>'
    +   '</div>'
    + '</div>';

  document.body.appendChild(modal);

  // Listeners
  document.getElementById('radar-close-btn').addEventListener('click', closeRadar);
  document.getElementById('radar-cancel-btn').addEventListener('click', closeRadar);
  modal.addEventListener('click', function(ev) {
    if (ev.target === modal) closeRadar();
  });

  // Champs
  document.getElementById('radar-club').addEventListener('change', function() {
    _radarState.club = this.value;
    updateValidateBtn();
  });
  document.getElementById('radar-dist-before').addEventListener('input', function() {
    _radarState.distBefore = parseFloat(this.value) || 0;
  });

  // Fairway toggle
  if (isDrive && parTrou !== 3) {
    var fbtns = modal.querySelectorAll('.radar-fairway-btn');
    fbtns.forEach(function(b) {
      b.addEventListener('click', function() {
        fbtns.forEach(function(x) { x.classList.remove('active'); });
        b.classList.add('active');
        _radarState.fairwayState = b.getAttribute('data-fairway');
        updateValidateBtn();
      });
    });
  }

  // Green toggle
  var greenToggle = document.getElementById('radar-green-toggle');
  if (greenToggle) {
    greenToggle.addEventListener('click', function() {
      _radarState.onGreen = !_radarState.onGreen;
      greenToggle.classList.toggle('checked', _radarState.onGreen);
      var cb = document.getElementById('radar-green-cb');
      if (cb) cb.textContent = _radarState.onGreen ? '✓' : '';
    });
  }

  // Click sur le radar (tap pour positionner la balle)
  var wrap = document.getElementById('radar-svg-wrap');
  var handlePointer = function(ev) {
    ev.preventDefault();
    var rect = wrap.getBoundingClientRect();
    var clientX, clientY;
    if (ev.touches && ev.touches.length) {
      clientX = ev.touches[0].clientX;
      clientY = ev.touches[0].clientY;
    } else {
      clientX = ev.clientX;
      clientY = ev.clientY;
    }
    var x = ((clientX - rect.left) / rect.width) * 100;
    var y = ((clientY - rect.top) / rect.height) * 100;
    // Clip
    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));
    positionBall(x, y);
  };
  wrap.addEventListener('mousedown', handlePointer);
  wrap.addEventListener('touchstart', handlePointer, { passive: false });

  // Validate
  document.getElementById('radar-validate-btn').addEventListener('click', function() {
    if (!_radarState.ballX) return;
    var shot = {
      shotIndex: shotIndex,
      club: _radarState.club,
      distBefore: _radarState.distBefore,
      distToTarget: _radarState.distToTarget,
      side: _radarState.side,
      angle: _radarState.direction,
      ballX: _radarState.ballX,
      ballY: _radarState.ballY,
      onGreen: _radarState.onGreen,
      fairwayState: _radarState.fairwayState,
      timestamp: Date.now()
    };
    closeRadar();
    if (typeof options.onSave === 'function') options.onSave(shot);
  });
}

function closeRadar() {
  var m = document.getElementById('radar-modal');
  if (m) m.remove();
  _radarState = null;
}

/* SVG du radar (cible au centre + anneaux concentriques) */
function buildRadarSVG() {
  // Anneaux : 5m, 10m, 20m, 30m
  // Le centre = cible (drapeau)
  // L'échelle : 30m = bord du radar (50% du SVG = 30m réel)
  var html = '<svg class="radar-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">';
  // Croix axes
  html += '<line class="radar-axis" x1="100" y1="0" x2="100" y2="200"/>';
  html += '<line class="radar-axis" x1="0" y1="100" x2="200" y2="100"/>';
  // Anneaux
  // 5m → r=16.67 / 10m → r=33.33 / 20m → r=66.67 / 30m → r=100
  [
    { r: 16.67, label: '5m' },
    { r: 33.33, label: '10m' },
    { r: 66.67, label: '20m' },
    { r: 100,   label: '30m' }
  ].forEach(function(ring) {
    html += '<circle class="radar-ring" cx="100" cy="100" r="' + ring.r + '"/>';
    html += '<text class="radar-ring-label" x="100" y="' + (100 - ring.r - 2) + '" text-anchor="middle">' + ring.label + '</text>';
  });
  // Cible au centre (drapeau emoji)
  html += '<circle class="radar-target-circle" cx="100" cy="100" r="4"/>';
  html += '<text x="100" y="106" text-anchor="middle" font-size="20">⛳</text>';
  // Points cardinaux
  html += '<text class="radar-cardinal" x="100" y="12" text-anchor="middle">LONG</text>';
  html += '<text class="radar-cardinal" x="100" y="195" text-anchor="middle">COURT</text>';
  html += '<text class="radar-cardinal" x="6" y="103" text-anchor="start">G</text>';
  html += '<text class="radar-cardinal" x="194" y="103" text-anchor="end">D</text>';
  // Position de la balle (cachée au démarrage)
  html += '<circle class="radar-ball" id="radar-ball-mark" cx="100" cy="100" r="0"/>';
  html += '</svg>';
  return html;
}

/* Positionne la balle sur le radar et calcule distance/direction */
function positionBall(percentX, percentY) {
  // Position dans le SVG (en %)
  // Convertir en coordonnées SVG (0-200)
  var svgX = (percentX / 100) * 200;
  var svgY = (percentY / 100) * 200;
  // Distance pixel au centre (100,100)
  var dx = svgX - 100;
  var dy = svgY - 100;
  var distPx = Math.sqrt(dx*dx + dy*dy);
  // Conversion px → mètres : r=100 = 30m → 1m = 3.33px
  var distMeters = distPx / (100/30);

  // Angle (0 = haut, 90 = droite, 180 = bas, 270 = gauche)
  var angleRad = Math.atan2(dx, -dy);
  var angleDeg = Math.round((angleRad * 180 / Math.PI + 360) % 360);

  // Détermination côté
  var side;
  if (distMeters < 2) side = 'pin';
  else if (angleDeg >= 315 || angleDeg < 45) side = 'long';
  else if (angleDeg >= 45 && angleDeg < 135) side = 'right';
  else if (angleDeg >= 135 && angleDeg < 225) side = 'short';
  else side = 'left';

  _radarState.ballX = percentX;
  _radarState.ballY = percentY;
  _radarState.distToTarget = Math.round(distMeters * 10) / 10;
  _radarState.direction = angleDeg;
  _radarState.side = side;

  // Mettre à jour la balle sur le SVG
  var ballMark = document.getElementById('radar-ball-mark');
  if (ballMark) {
    ballMark.setAttribute('cx', svgX);
    ballMark.setAttribute('cy', svgY);
    ballMark.setAttribute('r', '6');
  }

  // Mettre à jour les résultats affichés
  var sideLabels = {
    pin: '🎯 Sur la cible !',
    long: '⬆ Long',
    short: '⬇ Court',
    left: '⬅ Gauche',
    right: 'Droite ➡'
  };
  var resultEl = document.getElementById('radar-result');
  if (resultEl) {
    resultEl.innerHTML = ''
      + '<div class="radar-result-item">'
      +   '<div class="radar-result-val">' + _radarState.distToTarget + 'm</div>'
      +   '<div class="radar-result-lbl">de la cible</div>'
      + '</div>'
      + '<div class="radar-result-item">'
      +   '<div class="radar-result-val" style="font-size:14px;padding:6px 0">' + sideLabels[side] + '</div>'
      +   '<div class="radar-result-lbl">direction</div>'
      + '</div>';
  }

  updateValidateBtn();
}

function updateValidateBtn() {
  var btn = document.getElementById('radar-validate-btn');
  if (!btn) return;
  var ok = _radarState && _radarState.ballX !== null && _radarState.club;
  btn.disabled = !ok;
}




/* ════════════════════════════════════════════
   ZONE PRO — Cartes par trou (coup par coup)
════════════════════════════════════════════ */
function buildProShotZone() {
  var zone = document.getElementById('shot-pro-zone');
  if (!zone) return;
  if (!selectedCourse) return;

  zone.innerHTML = '';

  // Banner explicatif
  var banner = document.createElement('div');
  banner.style.cssText = 'background:var(--gold-dim);border:1px solid rgba(201,168,76,0.3);border-radius:12px;padding:12px 16px;font-size:12px;color:var(--tx2);line-height:1.5';
  banner.innerHTML = '<strong style="color:var(--gold-d)">◆ Mode Pro</strong> · Pour chaque trou, enregistre <strong>chaque coup individuellement</strong> en utilisant le radar de dispersion. Tu obtiendras des données ultra-précises pour ton analyse de performance.';
  zone.appendChild(banner);

  // Carte pour chaque trou
  selectedCourse.trous.forEach(function(h) {
    zone.appendChild(buildHoleCard(h));
  });
}

function buildHoleCard(hole) {
  var card = document.createElement('div');
  card.className = 'shot-trou-card';
  card.id = 'hole-card-' + hole.num;

  var shots = sc_shotsByHole[hole.num] || [];
  var putts = sc_holePutts[hole.num];
  var onGreenIdx = sc_holeOnGreen[hole.num];
  var fairwayState = sc_holeFairway[hole.num];

  // Score total : coups jusqu'au green + putts
  var coupsCount = shots.length;
  var totalScore = coupsCount + (putts || 0);
  var hasOnGreen = onGreenIdx !== undefined && onGreenIdx !== null;
  var canAddShots = !hasOnGreen;

  var scoreColor = 'var(--tx)';
  var scoreLabel = '';
  if (totalScore > 0 && hasOnGreen && putts !== null && putts !== undefined) {
    var rel = totalScore - hole.par;
    if (rel <= -2) { scoreColor = 'var(--gold-d)'; scoreLabel = 'EAGLE'; }
    else if (rel === -1) { scoreColor = 'var(--ok2)'; scoreLabel = 'BIRDIE'; }
    else if (rel === 0) { scoreColor = 'var(--tx2)'; scoreLabel = 'PAR'; }
    else if (rel === 1) { scoreColor = 'var(--wn)'; scoreLabel = 'BOGEY'; }
    else if (rel === 2) { scoreColor = 'var(--ng2)'; scoreLabel = 'DOUBLE'; }
    else { scoreColor = 'var(--ng)'; scoreLabel = '+' + rel; }
  }

  // Header
  var headerHtml = ''
    + '<div class="shot-trou-header">'
    +   '<div>'
    +     '<div class="shot-trou-title">Trou ' + hole.num + '</div>'
    +     '<div class="shot-trou-meta">Par <strong>' + hole.par + '</strong> · SI <strong>' + hole.si + '</strong> · <strong>' + hole.longueur + 'm</strong></div>'
    +   '</div>'
    +   (totalScore > 0 ? '<div style="text-align:right">'
    +     '<div class="shot-summary-score" style="color:' + scoreColor + '">' + totalScore + '</div>'
    +     (scoreLabel ? '<div style="font-size:9px;font-weight:700;color:' + scoreColor + ';text-transform:uppercase;letter-spacing:.08em;margin-top:-2px">' + scoreLabel + '</div>' : '')
    +   '</div>' : '')
    + '</div>';

  card.innerHTML = headerHtml + '<div class="shot-trou-body" id="hole-body-' + hole.num + '"></div>';

  var body = card.querySelector('.shot-trou-body');

  // Liste des coups enregistrés
  shots.forEach(function(shot, idx) {
    var entry = document.createElement('div');
    entry.className = 'shot-entry';
    var clubText = shot.club || 'Club non précisé';
    var sideLabel = '';
    if (shot.side === 'pin')   sideLabel = ' 🎯 sur la cible';
    else if (shot.side === 'left')  sideLabel = ' ⬅ gauche';
    else if (shot.side === 'right') sideLabel = ' ➡ droite';
    else if (shot.side === 'long')  sideLabel = ' ⬆ long';
    else if (shot.side === 'short') sideLabel = ' ⬇ court';

    var distStr = (shot.distToTarget !== null && shot.distToTarget !== undefined)
      ? shot.distToTarget + 'm de la cible' : '';

    entry.innerHTML = ''
      + '<div class="shot-entry-num">' + (idx + 1) + '</div>'
      + '<div class="shot-entry-info">'
      +   '<div class="shot-entry-title">' + clubText + (shot.onGreen ? ' ⛳ Arrivée au green' : '') + '</div>'
      +   '<div class="shot-entry-meta">' + (shot.distBefore ? 'Distance ' + shot.distBefore + 'm · ' : '') + distStr + sideLabel + '</div>'
      + '</div>'
      + '<div class="shot-entry-actions">'
      +   '<button class="shot-action-btn delete" data-action="del" data-shot="' + idx + '" title="Supprimer">×</button>'
      + '</div>';
    body.appendChild(entry);

    entry.querySelector('[data-action="del"]').addEventListener('click', function() {
      if (!confirm('Supprimer ce coup ?')) return;
      sc_shotsByHole[hole.num].splice(idx, 1);
      // Si on supprime le coup d'arrivée au green, reset
      if (idx === sc_holeOnGreen[hole.num]) {
        delete sc_holeOnGreen[hole.num];
        delete sc_holePutts[hole.num];
      } else if (sc_holeOnGreen[hole.num] !== undefined && idx < sc_holeOnGreen[hole.num]) {
        sc_holeOnGreen[hole.num]--;
      }
      buildProShotZone();
      saveDraftShots();
    });
  });

  // Si arrivée au green : champ putts
  if (hasOnGreen) {
    var puttsRow = document.createElement('div');
    puttsRow.className = 'shot-putts-row';
    puttsRow.innerHTML = ''
      + '<div class="shot-putts-label">⛳ Sur le green — Nombre de putts ?</div>'
      + '<input type="number" class="shot-putts-input" id="putts-input-' + hole.num + '" min="0" max="10" placeholder="—" value="' + (putts !== null && putts !== undefined ? putts : '') + '">';
    body.appendChild(puttsRow);

    puttsRow.querySelector('input').addEventListener('input', function() {
      var v = parseInt(this.value);
      if (!isNaN(v) && v >= 0) {
        sc_holePutts[hole.num] = v;
      } else {
        sc_holePutts[hole.num] = null;
      }
      saveDraftShots();
      // Rebuild only the header to update score
      var updated = buildHoleCard(hole);
      card.replaceWith(updated);
    });
  }

  // Bouton ajouter un coup (si pas encore arrivé au green)
  if (canAddShots) {
    var addBtn = document.createElement('button');
    addBtn.className = 'shot-add-btn';
    var nextShotNum = shots.length + 1;
    var nextLabel = nextShotNum === 1 ? 'Enregistrer le départ' : 'Enregistrer le coup ' + nextShotNum;
    addBtn.innerHTML = ''
      + '<div class="shot-add-icon">+</div>'
      + '<div>' + nextLabel + '</div>';
    addBtn.addEventListener('click', function() {
      // Calculer la distance restante avant ce coup
      var distBefore = hole.longueur;  // au départ, distance totale
      if (shots.length > 0) {
        var lastShot = shots[shots.length - 1];
        distBefore = lastShot.distToTarget || 100;
      }
      openRadar({
        holeNum: hole.num,
        shotIndex: shots.length,
        parTrou: hole.par,
        totalDist: hole.longueur,
        defaultDist: distBefore,
        isApproach: (shots.length >= hole.par - 2),
        onSave: function(shot) {
          if (!sc_shotsByHole[hole.num]) sc_shotsByHole[hole.num] = [];
          sc_shotsByHole[hole.num].push(shot);
          if (shot.onGreen) {
            sc_holeOnGreen[hole.num] = sc_shotsByHole[hole.num].length - 1;
          }
          if (shot.fairwayState !== null && shot.fairwayState !== undefined) {
            sc_holeFairway[hole.num] = shot.fairwayState;
          }
          buildProShotZone();
          saveDraftShots();
        }
      });
    });
    body.appendChild(addBtn);
  }

  return card;
}

/* Sauvegarde locale temporaire pendant la partie */
function saveDraftShots() {
  try {
    localStorage.setItem('tsg_draft_shots', JSON.stringify({
      shotsByHole: sc_shotsByHole,
      onGreen: sc_holeOnGreen,
      putts: sc_holePutts,
      fairway: sc_holeFairway
    }));
  } catch(e) {}
}

function loadDraftShots() {
  try {
    var raw = localStorage.getItem('tsg_draft_shots');
    if (raw) {
      var d = JSON.parse(raw);
      sc_shotsByHole = d.shotsByHole || {};
      sc_holeOnGreen = d.onGreen || {};
      sc_holePutts = d.putts || {};
      sc_holeFairway = d.fairway || {};
    }
  } catch(e) {}
}

function clearDraftShots() {
  try { localStorage.removeItem('tsg_draft_shots'); } catch(e) {}
  sc_shotsByHole = {};
  sc_holeOnGreen = {};
  sc_holePutts = {};
  sc_holeFairway = {};
}

