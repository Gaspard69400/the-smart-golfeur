/* ════════════════════════════════════════════
 * THE SMART GOLFER — sectorlevels.js
 * NIVEAU PAR SECTEUR : « ton putting joue comme un index 6, ton drive comme un 17 ».
 *
 * Pour chaque secteur, on cherche l'index dont la statistique moyenne
 * correspond à la tienne (tables amateurs de strokesgained.js et puttingstats.js,
 * lues à l'envers) :
 *   Départ     → % de fairways touchés
 *   Approche   → % de greens en régulation
 *   Petit jeu  → % de sauvetages (green manqué puis par) — putts trou par trou requis
 *   Putting    → putts par carte 18 trous
 * Comparé à ton index global, chaque secteur devient un point fort ou un
 * chantier. Tendance : tes 5 dernières cartes contre les 5 précédentes.
 *
 * Aucun chiffre inventé : un secteur sans données suffisantes l'indique.
 * Dépend de : strokesgained.js (SG_BENCHMARKS, sgRefHcp), puttingstats.js (PTS_BENCH, ptsCompute).
 * ════════════════════════════════════════════ */

var SLV_WINDOW = 10;       // cartes récentes prises en compte
var SLV_MIN_ROUNDS = 3;
var SLV_TIERS = [
  { max: 0,   label: 'Élite',          cls: 't-elite' },
  { max: 5,   label: 'Expert',         cls: 't-expert' },
  { max: 12,  label: 'Avancé',         cls: 't-adv' },
  { max: 20,  label: 'Confirmé',       cls: 't-conf' },
  { max: 28,  label: 'Intermédiaire',  cls: 't-inter' },
  { max: 999, label: 'Débutant',       cls: 't-beg' }
];

var SLV_SECTORS = [
  { key: 'tee',  label: 'Départ',    icon: '🏌️', stat: 'Fairways',   train: 'drive' },
  { key: 'app',  label: 'Approche',  icon: '🎯', stat: 'Greens',     train: 'approche' },
  { key: 'arg',  label: 'Petit jeu', icon: '⛳', stat: 'Sauvetages', train: 'jeu-court' },
  { key: 'putt', label: 'Putting',   icon: '🟢', stat: 'Putts/partie', train: 'putting' }
];

/* Index équivalent : lit une table { hcp, valeur } à l'envers, avec prolongement
   linéaire aux deux bouts (un très bon putting peut valoir « +3 »). */
function slvInverse(table, key, value) {
  if (value === null || value === undefined || isNaN(value)) return null;
  var pts = table.map(function(r) { return { h: r.hcp, v: r[key] }; });
  for (var i = 0; i < pts.length - 1; i++) {
    var a = pts[i], b = pts[i + 1];
    var lo = Math.min(a.v, b.v), hi = Math.max(a.v, b.v);
    if (value >= lo && value <= hi && a.v !== b.v) return a.h + (value - a.v) * (b.h - a.h) / (b.v - a.v);
  }
  var first = pts[0], second = pts[1], last = pts[pts.length - 1], prev = pts[pts.length - 2];
  var increasing = last.v > first.v;       // la valeur grimpe avec l'index (putts) ou baisse (fairways, greens)
  var better = increasing ? value < first.v : value > first.v;
  var h = better
    ? first.h + (value - first.v) * (second.h - first.h) / (second.v - first.v)
    : last.h + (value - last.v) * (last.h - prev.h) / (last.v - prev.v);
  // Au-delà des barèmes, la pente s'emballe : on borne à des niveaux qui ont encore un sens
  return Math.max(first.h - 6, Math.min(last.h + 4, h));
}

function slvTier(h) {
  for (var i = 0; i < SLV_TIERS.length; i++) if (h <= SLV_TIERS[i].max) return SLV_TIERS[i];
  return SLV_TIERS[SLV_TIERS.length - 1];
}

function slvIs18(r) {
  return Array.isArray(r.scores) && r.scores.filter(function(x) { return x !== null && x !== undefined; }).length >= 18;
}

/* Calcule les 4 secteurs sur une liste de parties (plus récente en premier) */
function slvComputeSet(rounds) {
  var out = {};
  // Départ : % fairways (parties où la stat est connue)
  var fr = rounds.filter(function(r) { return r.fir !== null && r.fir !== undefined && (r.firTotal || 0) > 0 && slvIs18(r); });
  if (fr.length >= SLV_MIN_ROUNDS) {
    var fp = fr.reduce(function(a, r) { return a + r.fir / r.firTotal; }, 0) / fr.length;
    out.tee = { value: fp, display: Math.round(fp * 100) + '\u00a0%', n: fr.length, h: slvInverse(SG_BENCHMARKS, 'fir', fp) };
  }
  // Approche : % greens en régulation
  var gr = rounds.filter(function(r) { return r.gir !== null && r.gir !== undefined && slvIs18(r); });
  if (gr.length >= SLV_MIN_ROUNDS) {
    var gp = gr.reduce(function(a, r) { return a + r.gir / 18; }, 0) / gr.length;
    out.app = { value: gp, display: Math.round(gp * 100) + '\u00a0%', n: gr.length, h: slvInverse(SG_BENCHMARKS, 'gir', gp) };
  }
  // Putting : putts par carte 18 trous (crédibles)
  var pr = rounds.filter(function(r) { return typeof r.putts === 'number' && r.putts >= 18 && slvIs18(r); });
  if (pr.length >= SLV_MIN_ROUNDS) {
    var pp = pr.reduce(function(a, r) { return a + r.putts; }, 0) / pr.length;
    out.putt = { value: pp, display: pp.toFixed(1).replace('.', ','), n: pr.length, h: slvInverse(SG_BENCHMARKS, 'putts', pp) };
  }
  // Petit jeu : sauvetages, à partir des putts trou par trou
  if (typeof ptsCompute === 'function' && typeof PTS_BENCH !== 'undefined') {
    var st = ptsCompute(rounds);
    if (st.missHoles >= 12 && st.scrRate !== null) {
      out.arg = { value: st.scrRate, display: Math.round(st.scrRate * 100) + '\u00a0%', n: st.roundsDetailed, h: slvInverse(PTS_BENCH, 'scr', st.scrRate), holes: st.missHoles };
    }
  }
  return out;
}

function slvCompute(rounds) {
  rounds = rounds || lsGet('rounds') || [];
  var recent = rounds.slice(0, SLV_WINDOW);
  var cur = slvComputeSet(recent);
  var last5 = slvComputeSet(rounds.slice(0, 5)), prev5 = slvComputeSet(rounds.slice(5, 10));
  var ref = (typeof sgRefHcp === 'function') ? sgRefHcp() : null;
  SLV_SECTORS.forEach(function(s) {
    var c = cur[s.key];
    if (!c) return;
    c.tier = slvTier(c.h);
    c.gap = (ref === null || ref === undefined) ? null : c.h - ref;      // négatif = meilleur que ton index
    if (last5[s.key] && prev5[s.key] && rounds.length >= 8) c.trend = prev5[s.key].h - last5[s.key].h;   // positif = progrès
  });
  return { sectors: cur, ref: ref, rounds: rounds.length };
}

function slvFmtIndex(h) {
  if (h === null || h === undefined) return '—';
  var r = Math.round(h * 10) / 10;
  if (r >= 40) return '36+';
  if (r < 0) return '+' + String(Math.abs(r)).replace('.', ',');
  return String(r).replace('.', ',');
}

/* Panneau du Dashboard */
function slvRenderPanel(wrap) {
  var res = slvCompute();
  if (!res.rounds) return;               // mode démo sans partie : pas de faux niveaux

  var known = SLV_SECTORS.filter(function(s) { return res.sectors[s.key]; });
  var best = null, worst = null;
  known.forEach(function(s) {
    var h = res.sectors[s.key].h;
    if (!best || h < res.sectors[best.key].h) best = s;
    if (!worst || h > res.sectors[worst.key].h) worst = s;
  });

  var cards = SLV_SECTORS.map(function(s) {
    var c = res.sectors[s.key];
    if (!c) {
      var why = s.key === 'arg' ? 'Saisis tes putts trou par trou pour le mesurer.'
        : s.key === 'putt' ? 'Il faut ' + SLV_MIN_ROUNDS + ' cartes 18 trous avec les putts.'
        : 'Il faut ' + SLV_MIN_ROUNDS + ' cartes 18 trous avec les ' + (s.key === 'tee' ? 'fairways' : 'greens') + '.';
      return '<div class="slv-card slv-empty"><div class="slv-top"><span class="slv-ico">' + s.icon + '</span><span class="slv-name">' + s.label + '</span></div>'
        + '<div class="slv-h">—</div><div class="slv-why">' + why + '</div></div>';
    }
    var gapTxt = '';
    if (c.gap !== null) {
      var g = Math.round(c.gap * 10) / 10;
      gapTxt = Math.abs(g) < 1.5 ? '<span class="slv-gap mid">au niveau de ton index</span>'
        : (g < 0 ? '<span class="slv-gap good">' + slvFmtIndex(Math.abs(g)) + ' pts de mieux que ton index</span>'
                 : '<span class="slv-gap bad">' + slvFmtIndex(g) + ' pts moins bien que ton index</span>');
    }
    var trend = (c.trend === undefined || Math.abs(c.trend) < 0.8) ? ''
      : '<span class="slv-trend ' + (c.trend > 0 ? 'up' : 'down') + '">' + (c.trend > 0 ? '▲ en progrès' : '▼ en recul') + '</span>';
    var mark = (known.length > 1 && s === best) ? '<span class="slv-mark good">Point fort</span>' : ((known.length > 1 && s === worst) ? '<span class="slv-mark bad">Priorité</span>' : '');
    return '<div class="slv-card ' + c.tier.cls + '">'
      + '<div class="slv-top"><span class="slv-ico">' + s.icon + '</span><span class="slv-name">' + s.label + '</span>' + mark + '</div>'
      + '<div class="slv-h"><small>joue comme un</small> ' + slvFmtIndex(c.h) + '</div>'
      + '<div class="slv-tier">' + c.tier.label + '</div>'
      + '<div class="slv-stat">' + s.stat + ' : <strong>' + c.display + '</strong></div>'
      + gapTxt + trend
      + '</div>';
  }).join('');

  var lead = '';
  if (best && worst && best !== worst) {
    var diff = Math.round(res.sectors[worst.key].h - res.sectors[best.key].h);
    lead = '<div class="slv-lead">Ton <strong>' + best.label.toLowerCase() + '</strong> joue comme un index ' + slvFmtIndex(res.sectors[best.key].h)
      + ', ton <strong>' + worst.label.toLowerCase() + '</strong> comme un ' + slvFmtIndex(res.sectors[worst.key].h)
      + (diff >= 3 ? ' : c\'est là que se trouvent tes coups les plus faciles à gagner.' : '.') + '</div>';
  }

  var panel = document.createElement('div');
  panel.className = 'panel slv-panel';
  panel.innerHTML = '<div class="panel-header"><div class="panel-title">📊 Ton niveau par secteur</div>'
    + '<div class="slv-sub">' + (res.ref !== null ? 'Ton index : ' + slvFmtIndex(res.ref) + ' · ' : '') + 'sur tes ' + Math.min(SLV_WINDOW, res.rounds) + ' dernières parties</div></div>'
    + '<div class="panel-body">' + lead + '<div class="slv-grid">' + cards + '</div>'
    + '<div class="slv-note">« Joue comme un index X » : l\'index dont la moyenne amateur correspond à ta statistique. Repères indicatifs, plus fiables avec de nombreuses cartes.</div></div>';
  wrap.appendChild(panel);
}
