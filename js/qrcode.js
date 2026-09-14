/* ════════════════════════════════════════════
 * THE SMART GOLFER — qrcode.js
 * Générateur de QR code autonome (aucune librairie, marche hors-ligne).
 * Norme ISO 18004 : mode octet (UTF-8), correction d'erreur M (~15 %),
 * versions 1 à 10 (jusqu'à 213 octets — une URL d'invitation en fait ~60).
 *
 * qrMatrix(text)        → tableau de lignes de booléens (true = module noir)
 * qrSvg(text, opts)     → chaîne SVG prête à insérer
 * ════════════════════════════════════════════ */

var QR_TOTAL_CW = [0, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346];  // codewords par version
var QR_ECC_M    = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];         // codewords de correction par bloc (M)
var QR_BLOCKS_M = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];                   // nombre de blocs (M)
var QR_ALIGN    = [[], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
                   [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

/* Multiplication dans GF(256), polynôme 0x11D */
function qrGfMul(x, y) {
  var z = 0;
  for (var i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11D);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xFF;
}

function qrRsDivisor(degree) {
  var res = [];
  for (var i = 0; i < degree - 1; i++) res.push(0);
  res.push(1);
  var root = 1;
  for (i = 0; i < degree; i++) {
    for (var j = 0; j < res.length; j++) {
      res[j] = qrGfMul(res[j], root);
      if (j + 1 < res.length) res[j] ^= res[j + 1];
    }
    root = qrGfMul(root, 0x02);
  }
  return res;
}

function qrRsRemainder(data, divisor) {
  var res = divisor.map(function() { return 0; });
  data.forEach(function(b) {
    var factor = b ^ res.shift();
    res.push(0);
    for (var i = 0; i < res.length; i++) res[i] ^= qrGfMul(divisor[i], factor);
  });
  return res;
}

function qrUtf8(text) {
  var s = unescape(encodeURIComponent(String(text)));
  var out = [];
  for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
  return out;
}

/* Données → codewords (mode octet + terminaison + remplissage), puis blocs entrelacés avec leur correction */
function qrCodewords(bytes, ver) {
  var bits = [];
  function put(val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
  var dataCw = QR_TOTAL_CW[ver] - QR_ECC_M[ver] * QR_BLOCKS_M[ver];
  put(0x4, 4);
  put(bytes.length, ver < 10 ? 8 : 16);
  bytes.forEach(function(b) { put(b, 8); });
  var cap = dataCw * 8;
  put(0, Math.min(4, cap - bits.length));
  while (bits.length % 8) bits.push(0);
  var data = [];
  for (var i = 0; i < bits.length; i += 8) {
    var v = 0;
    for (var k = 0; k < 8; k++) v = (v << 1) | bits[i + k];
    data.push(v);
  }
  for (var pad = 0xEC; data.length < dataCw; pad ^= 0xEC ^ 0x11) data.push(pad);

  var nBlocks = QR_BLOCKS_M[ver], ecc = QR_ECC_M[ver], total = QR_TOTAL_CW[ver];
  var nShort = nBlocks - total % nBlocks;
  var shortLen = Math.floor(total / nBlocks) - ecc;
  var divisor = qrRsDivisor(ecc);
  var blocks = [], eccs = [], pos = 0;
  for (i = 0; i < nBlocks; i++) {
    var blk = data.slice(pos, pos + shortLen + (i < nShort ? 0 : 1));
    pos += blk.length;
    blocks.push(blk);
    eccs.push(qrRsRemainder(blk, divisor));
  }
  var out = [];
  for (i = 0; i <= shortLen; i++) blocks.forEach(function(b) { if (i < b.length) out.push(b[i]); });
  for (i = 0; i < ecc; i++) eccs.forEach(function(e) { out.push(e[i]); });
  return out;
}

function qrMatrix(text) {
  var bytes = qrUtf8(text);
  var ver = 0;
  for (var v = 1; v <= 10; v++) {
    var dataCw = QR_TOTAL_CW[v] - QR_ECC_M[v] * QR_BLOCKS_M[v];
    var need = 4 + (v < 10 ? 8 : 16) + bytes.length * 8;
    if (need <= dataCw * 8) { ver = v; break; }
  }
  if (!ver) throw new Error('Texte trop long pour le QR code');

  var size = ver * 4 + 17;
  var mod = [], fn = [];
  for (var y = 0; y < size; y++) {
    mod.push(new Array(size).fill(false));
    fn.push(new Array(size).fill(false));
  }
  function setF(x, y, dark) { mod[y][x] = dark; fn[y][x] = true; }

  // Motifs de synchronisation
  for (var i = 0; i < size; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
  // Trois repères de position (avec leur séparateur blanc)
  [[3, 3], [size - 4, 3], [3, size - 4]].forEach(function(c) {
    for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
      var d = Math.max(Math.abs(dx), Math.abs(dy)), xx = c[0] + dx, yy = c[1] + dy;
      if (xx >= 0 && xx < size && yy >= 0 && yy < size) setF(xx, yy, d !== 2 && d !== 4);
    }
  });
  // Motifs d'alignement
  var al = QR_ALIGN[ver], last = al.length - 1;
  al.forEach(function(ax, ai) {
    al.forEach(function(ay, aj) {
      if ((ai === 0 && aj === 0) || (ai === 0 && aj === last) || (ai === last && aj === 0)) return;
      for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) {
        setF(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    });
  });

  function drawFormat(mask) {
    var data = (0 << 3) | mask;            // niveau M = 00
    var rem = data;
    for (var i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    var bits = ((data << 10) | rem) ^ 0x5412;
    function b(i) { return ((bits >>> i) & 1) !== 0; }
    for (i = 0; i <= 5; i++) setF(8, i, b(i));
    setF(8, 7, b(6)); setF(8, 8, b(7)); setF(7, 8, b(8));
    for (i = 9; i < 15; i++) setF(14 - i, 8, b(i));
    for (i = 0; i < 8; i++) setF(size - 1 - i, 8, b(i));
    for (i = 8; i < 15; i++) setF(8, size - 15 + i, b(i));
    setF(8, size - 8, true);
  }
  drawFormat(0);  // réserve les zones

  if (ver >= 7) {
    var rem = ver;
    for (i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
    var vbits = (ver << 12) | rem;
    for (i = 0; i < 18; i++) {
      var bit = ((vbits >>> i) & 1) !== 0, a = size - 11 + i % 3, bb = Math.floor(i / 3);
      setF(a, bb, bit); setF(bb, a, bit);
    }
  }

  // Placement des données en zigzag
  var cw = qrCodewords(bytes, ver), idx = 0, totalBits = cw.length * 8;
  for (var right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (var vert = 0; vert < size; vert++) {
      for (var j = 0; j < 2; j++) {
        var x = right - j;
        var up = ((right + 1) & 2) === 0;
        y = up ? size - 1 - vert : vert;
        if (!fn[y][x] && idx < totalBits) {
          mod[y][x] = ((cw[idx >>> 3] >>> (7 - (idx & 7))) & 1) !== 0;
          idx++;
        }
      }
    }
  }

  function maskFn(m, x, y) {
    switch (m) {
      case 0: return (x + y) % 2 === 0;
      case 1: return y % 2 === 0;
      case 2: return x % 3 === 0;
      case 3: return (x + y) % 3 === 0;
      case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
      case 5: return x * y % 2 + x * y % 3 === 0;
      case 6: return (x * y % 2 + x * y % 3) % 2 === 0;
      default: return ((x + y) % 2 + x * y % 3) % 2 === 0;
    }
  }
  function applyMask(m) {
    for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) {
      if (!fn[y][x] && maskFn(m, x, y)) mod[y][x] = !mod[y][x];
    }
  }
  // Pénalité simplifiée (suites, blocs 2×2, équilibre) pour choisir un masque lisible
  function penalty() {
    var p = 0, dark = 0, x, y, run;
    for (y = 0; y < size; y++) {
      run = 1;
      for (x = 1; x < size; x++) {
        if (mod[y][x] === mod[y][x - 1]) { run++; if (run === 5) p += 3; else if (run > 5) p++; }
        else run = 1;
      }
    }
    for (x = 0; x < size; x++) {
      run = 1;
      for (y = 1; y < size; y++) {
        if (mod[y][x] === mod[y - 1][x]) { run++; if (run === 5) p += 3; else if (run > 5) p++; }
        else run = 1;
      }
    }
    for (y = 0; y < size; y++) for (x = 0; x < size; x++) {
      if (mod[y][x]) dark++;
      if (x < size - 1 && y < size - 1 && mod[y][x] === mod[y][x + 1]
          && mod[y][x] === mod[y + 1][x] && mod[y][x] === mod[y + 1][x + 1]) p += 3;
    }
    p += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
    return p;
  }

  var best = 0, bestP = Infinity;
  for (var m = 0; m < 8; m++) {
    applyMask(m); drawFormat(m);
    var pen = penalty();
    if (pen < bestP) { bestP = pen; best = m; }
    applyMask(m);  // annule (XOR)
  }
  applyMask(best); drawFormat(best);
  return mod;
}

function qrSvg(text, opts) {
  opts = opts || {};
  var mod = qrMatrix(text), n = mod.length, q = opts.quiet != null ? opts.quiet : 4, dim = n + q * 2;
  var path = '';
  for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
    if (mod[y][x]) path += 'M' + (x + q) + ' ' + (y + q) + 'h1v1h-1z';
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + dim + ' ' + dim + '"'
    + ' shape-rendering="crispEdges" role="img" aria-label="QR code">'
    + '<rect width="' + dim + '" height="' + dim + '" fill="' + (opts.light || '#fff') + '"/>'
    + '<path d="' + path + '" fill="' + (opts.dark || '#0f2a1e') + '"/></svg>';
}
