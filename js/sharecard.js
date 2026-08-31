/* ════════════════════════════════════════════
 * THE SMART GOLFER — sharecard.js
 * PARTAGE DE CARTE EN IMAGE — génère une image de ta partie (canvas),
 * prête à poster en story. Partage natif sur mobile, téléchargement ailleurs.
 * Format 1080×1350 (4:5, le ratio le plus haut accepté par Instagram).
 *
 * Dépend de : app.js (showToast), data.js (getAllCourses).
 * ════════════════════════════════════════════ */

var SC_W = 1080, SC_H = 1350;

/* Palette de la carte (indépendante du thème de l'app : l'image est toujours la même) */
var SC_COL = {
  bgTop:   '#1B3D26',
  bgBot:   '#0C1D12',
  gold:    '#C9A84C',
  goldL:   '#E8C96A',
  white:   '#FFFFFF',
  mute:    'rgba(255,255,255,0.62)',
  line:    'rgba(255,255,255,0.14)',
  eagle:   '#8B6FD4',
  birdie:  '#4FA85A',
  par:     'rgba(255,255,255,0.28)',
  bogey:   '#E08A3C',
  double:  '#D9534F'
};

/* ─────────── OUVERTURE ─────────── */

function openShareCard(round) {
  if (!round) { showToast('Aucune partie à partager'); return; }

  var ex = document.getElementById('shr-modal');
  if (ex) ex.remove();

  var m = document.createElement('div');
  m.id = 'shr-modal';
  m.className = 'shr-modal';
  m.innerHTML = ''
    + '<div class="shr-card">'
    +   '<div class="shr-head">'
    +     '<div><div class="shr-tag">Partage</div><div class="shr-title">Ta carte en image</div></div>'
    +     '<button class="shr-close" id="shr-close">×</button>'
    +   '</div>'
    +   '<div class="shr-preview"><div class="shr-loading">Génération…</div></div>'
    +   '<div class="shr-actions">'
    +     '<button class="qs-btn-ghost" id="shr-dl">⤓ Télécharger</button>'
    +     '<button class="qs-btn-gold" id="shr-share">Partager →</button>'
    +   '</div>'
    + '</div>';
  document.body.appendChild(m);

  function close() { m.remove(); }
  document.getElementById('shr-close').addEventListener('click', close);
  m.addEventListener('click', function(e) { if (e.target === m) close(); });

  scRenderCard(round).then(function(canvas) {
    var host = m.querySelector('.shr-preview');
    if (!host) return;
    host.innerHTML = '';
    canvas.className = 'shr-canvas';
    host.appendChild(canvas);

    var fname = scFileName(round);
    var blobPromise = null;

    // L'encodage PNG coûte cher (~600 ko) : on ne le fait qu'une fois
    function getBlob() {
      if (!blobPromise) {
        blobPromise = new Promise(function(resolve, reject) {
          canvas.toBlob(function(b) { b ? resolve(b) : reject(new Error('toBlob')); }, 'image/png');
        });
      }
      return blobPromise;
    }

    function download(blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = fname;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function() { URL.revokeObjectURL(url); }, 2000);
      showToast('Image téléchargée ✓');
    }

    document.getElementById('shr-dl').addEventListener('click', function() {
      getBlob().then(download, function() { showToast('Génération impossible'); });
    });

    document.getElementById('shr-share').addEventListener('click', function() {
      getBlob().then(function(blob) {
        var file = new File([blob], fname, { type: 'image/png' });
        var canShareFiles = false;
        try { canShareFiles = !!(navigator.canShare && navigator.canShare({ files: [file] })); } catch (e) {}
        if (navigator.share && canShareFiles) {
          navigator.share({
            files: [file],
            title: 'Ma partie — The Smart Golfer',
            text: scShareText(round)
          }).then(function() { close(); }, function() { /* annulé par l'utilisateur */ });
        } else {
          // Pas de partage natif (ordinateur, navigateur ancien) → téléchargement
          download(blob);
        }
      }, function() { showToast('Génération impossible'); });
    });
  }, function(err) {
    var host = m.querySelector('.shr-preview');
    if (host) host.innerHTML = '<div class="shr-loading">Impossible de générer l\'image.</div>';
    console.warn('[TSG] sharecard:', err && err.message);
  });
}

function scFileName(round) {
  var d = (round.date || '').replace(/[^0-9-]/g, '') || 'partie';
  return 'smart-golfer-' + d + '-' + (round.score || '') + '.png';
}

function scShareText(round) {
  var rel = scRelToPar(round);
  var relStr = (rel === null) ? '' : (rel > 0 ? ' (+' + rel + ')' : (rel === 0 ? ' (par)' : ' (' + rel + ')'));
  return round.score + relStr + ' à ' + (round.course || 'mon parcours') + ' — suivi avec The Smart Golfer.';
}

/* Écart au par, calculé sur les trous réellement joués */
function scRelToPar(round) {
  if (round.score === null || round.score === undefined) return null;
  var info = (typeof celPlayedInfo === 'function') ? celPlayedInfo(round) : { par: round.par, holes: 18 };
  if (!info || !info.par) return null;
  return round.score - info.par;
}

/* ─────────── DESSIN ─────────── */

function scRenderCard(round) {
  return new Promise(function(resolve, reject) {
    var ready = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
    ready.then(function() {
      try { resolve(scDraw(round)); } catch (e) { reject(e); }
    }, function() {
      try { resolve(scDraw(round)); } catch (e) { reject(e); }
    });
  });
}

function scDraw(round) {
  var cv = document.createElement('canvas');
  cv.width = SC_W; cv.height = SC_H;
  var x = cv.getContext('2d');
  var F = '"Plus Jakarta Sans", system-ui, sans-serif';

  /* Fond dégradé + halo doré */
  var g = x.createLinearGradient(0, 0, 0, SC_H);
  g.addColorStop(0, SC_COL.bgTop);
  g.addColorStop(1, SC_COL.bgBot);
  x.fillStyle = g;
  x.fillRect(0, 0, SC_W, SC_H);

  var halo = x.createRadialGradient(SC_W * 0.82, 150, 20, SC_W * 0.82, 150, 520);
  halo.addColorStop(0, 'rgba(201,168,76,0.30)');
  halo.addColorStop(1, 'rgba(201,168,76,0)');
  x.fillStyle = halo;
  x.fillRect(0, 0, SC_W, 700);

  /* Marque */
  x.fillStyle = SC_COL.gold;
  x.font = '700 26px ' + F;
  x.textAlign = 'left';
  scTracked(x, 'THE SMART GOLFER', 80, 108, 6);

  /* Parcours + date */
  var course = round.course || 'Parcours';
  x.fillStyle = SC_COL.white;
  x.font = '700 54px ' + F;
  scFitText(x, course, 80, 210, SC_W - 160, 54, F, '700');

  x.fillStyle = SC_COL.mute;
  x.font = '500 30px ' + F;
  x.fillText(scPrettyDate(round.date), 80, 262);

  /* Score géant */
  var rel = scRelToPar(round);
  var info = (typeof celPlayedInfo === 'function') ? celPlayedInfo(round) : { holes: 18, par: round.par };

  x.textAlign = 'center';
  x.fillStyle = SC_COL.white;
  x.font = '800 320px ' + F;
  x.fillText(String(round.score), SC_W / 2, 620);

  /* Pastille écart au par */
  if (rel !== null) {
    var relStr = rel > 0 ? '+' + rel : (rel === 0 ? 'PAR' : String(rel));
    var relCol = rel < 0 ? SC_COL.birdie : (rel === 0 ? SC_COL.goldL : SC_COL.bogey);
    x.font = '800 46px ' + F;
    var w = x.measureText(relStr).width + 76;
    scRoundRect(x, (SC_W - w) / 2, 660, w, 84, 42);
    x.fillStyle = 'rgba(255,255,255,0.09)';
    x.fill();
    x.strokeStyle = relCol; x.lineWidth = 3; x.stroke();
    x.fillStyle = relCol;
    x.fillText(relStr, SC_W / 2, 718);
  }

  /* Mention 9 trous le cas échéant */
  if (info && info.holes && info.holes < 18) {
    x.fillStyle = SC_COL.mute;
    x.font = '600 28px ' + F;
    x.fillText(info.holes + ' trous', SC_W / 2, 790);
  }

  /* Bandeau des trous */
  var stripY = 838;
  if (Array.isArray(round.scores) && round.scores.some(function(s) { return s !== null && s !== undefined; })) {
    var pars = (typeof celCoursePars === 'function') ? celCoursePars(round) : null;
    var n = 18, gap = 8;
    var cw = (SC_W - 160 - gap * (n - 1)) / n;
    for (var i = 0; i < n; i++) {
      var sc = round.scores[i];
      var px = 80 + i * (cw + gap);
      var col = 'rgba(255,255,255,0.07)';
      if (sc !== null && sc !== undefined && pars && pars[i]) {
        var d = sc - pars[i];
        if (d <= -2) col = SC_COL.eagle;
        else if (d === -1) col = SC_COL.birdie;
        else if (d === 0) col = SC_COL.par;
        else if (d === 1) col = SC_COL.bogey;
        else col = SC_COL.double;
      }
      scRoundRect(x, px, stripY, cw, 46, 10);
      x.fillStyle = col;
      x.fill();
    }
    stripY += 92;
  }

  /* Statistiques */
  var stats = [
    { v: (round.gir !== null && round.gir !== undefined) ? String(round.gir) : '—', l: 'GREENS' },
    { v: (round.fir !== null && round.fir !== undefined) ? String(round.fir) : '—', l: 'FAIRWAYS' },
    { v: round.putts ? String(round.putts) : '—', l: 'PUTTS' }
  ];
  var boxW = (SC_W - 160 - 40) / 3, boxY = stripY + 10;
  stats.forEach(function(s, i) {
    var bx = 80 + i * (boxW + 20);
    scRoundRect(x, bx, boxY, boxW, 168, 24);
    x.fillStyle = 'rgba(255,255,255,0.06)';
    x.fill();
    x.strokeStyle = SC_COL.line; x.lineWidth = 2; x.stroke();
    x.textAlign = 'center';
    x.fillStyle = SC_COL.white;
    x.font = '800 68px ' + F;
    x.fillText(s.v, bx + boxW / 2, boxY + 92);
    x.fillStyle = SC_COL.mute;
    x.font = '700 22px ' + F;
    scTrackedCentered(x, s.l, bx + boxW / 2, boxY + 134, 3);
  });

  /* Temps forts */
  var hlY = boxY + 226;
  var hls = scHighlights(round);
  if (hls.length) {
    x.textAlign = 'left';
    var cx = 80;
    hls.slice(0, 3).forEach(function(h) {
      x.font = '700 28px ' + F;
      var tw = x.measureText(h).width + 52;
      if (cx + tw > SC_W - 80) return;
      scRoundRect(x, cx, hlY, tw, 60, 30);
      x.fillStyle = 'rgba(201,168,76,0.16)';
      x.fill();
      x.strokeStyle = 'rgba(201,168,76,0.5)'; x.lineWidth = 2; x.stroke();
      x.fillStyle = SC_COL.goldL;
      x.fillText(h, cx + 26, hlY + 40);
      cx += tw + 14;
    });
  }

  /* Pied de page */
  x.strokeStyle = SC_COL.line;
  x.lineWidth = 2;
  x.beginPath();
  x.moveTo(80, SC_H - 128);
  x.lineTo(SC_W - 80, SC_H - 128);
  x.stroke();

  x.textAlign = 'left';
  x.fillStyle = SC_COL.mute;
  x.font = '600 26px ' + F;
  scTracked(x, 'ANALYSER · STRUCTURER · PERFORMER', 80, SC_H - 74, 3);

  return cv;
}

/* Temps forts affichés en pastilles */
function scHighlights(round) {
  var out = [];
  var pars = (typeof celCoursePars === 'function') ? celCoursePars(round) : null;
  if (pars && Array.isArray(round.scores)) {
    var b = 0, e = 0;
    round.scores.forEach(function(s, i) {
      if (s === null || s === undefined || !pars[i]) return;
      var d = s - pars[i];
      if (d <= -2) e++;
      else if (d === -1) b++;
    });
    if (e) out.push('🦅 ' + e + ' eagle' + (e > 1 ? 's' : ''));
    if (b) out.push('🐦 ' + b + ' birdie' + (b > 1 ? 's' : ''));
  }
  if (round.putts && round.putts <= 30) out.push('🧘 ' + round.putts + ' putts');
  if (round.gir >= 9) out.push('🟢 ' + round.gir + ' GIR');
  return out;
}

/* ─────────── HELPERS CANVAS ─────────── */

function scRoundRect(x, px, py, w, h, r) {
  x.beginPath();
  if (x.roundRect) { x.roundRect(px, py, w, h, r); return; }
  x.moveTo(px + r, py);
  x.lineTo(px + w - r, py);
  x.quadraticCurveTo(px + w, py, px + w, py + r);
  x.lineTo(px + w, py + h - r);
  x.quadraticCurveTo(px + w, py + h, px + w - r, py + h);
  x.lineTo(px + r, py + h);
  x.quadraticCurveTo(px, py + h, px, py + h - r);
  x.lineTo(px, py + r);
  x.quadraticCurveTo(px, py, px + r, py);
  x.closePath();
}

/* Texte avec interlettrage (le canvas ne gère pas letter-spacing partout) */
function scTracked(x, txt, px, py, sp) {
  var cx = px;
  for (var i = 0; i < txt.length; i++) {
    x.fillText(txt[i], cx, py);
    cx += x.measureText(txt[i]).width + sp;
  }
}

function scTrackedCentered(x, txt, cxCenter, py, sp) {
  var total = 0, i;
  for (i = 0; i < txt.length; i++) total += x.measureText(txt[i]).width + sp;
  total -= sp;
  var prev = x.textAlign;
  x.textAlign = 'left';
  scTracked(x, txt, cxCenter - total / 2, py, sp);
  x.textAlign = prev;
}

/* Réduit la police jusqu'à ce que le texte tienne dans la largeur */
function scFitText(x, txt, px, py, maxW, size, F, weight) {
  var s = size;
  x.font = weight + ' ' + s + 'px ' + F;
  while (x.measureText(txt).width > maxW && s > 26) {
    s -= 2;
    x.font = weight + ' ' + s + 'px ' + F;
  }
  x.fillText(txt, px, py);
}

function scPrettyDate(d) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch (e) { return d; }
}
