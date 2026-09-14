/* ════════════════════════════════════════════
 * THE SMART GOLFER — beginner.js
 * ACCUEIL DES DÉBUTANTS + LEXIQUE + « TON AVIS » (retours des testeurs).
 *
 * 1. Niveau de départ : un débutant n'a pas d'index. Avant, l'app prenait
 *    14,2 par défaut (!) : ses points stableford, ses Strokes Gained et ses
 *    comparaisons étaient calculés comme pour un bon joueur — tout en rouge.
 *    On lui demande maintenant son index, ou son score habituel pour en
 *    estimer un. L'index officiel (WHS) prend le relais dès 3 cartes.
 *    Les barèmes amateurs vont désormais jusqu'à 54 (ils s'arrêtaient à 36).
 * 2. Lexique : GIR, fairway, Strokes Gained, stableford… expliqués simplement.
 *    Les pastilles « ? » s'ouvrent au doigt (le survol n'existe pas sur mobile).
 * 3. Ton avis : note + message envoyés à la table feedback
 *    (backend/maj_weekend.sql). Sans réseau ou sans table : gardé et renvoyé.
 *
 * Dépend de : app.js, strokesgained.js, puttingstats.js.
 * ════════════════════════════════════════════ */

/* ─── Barèmes étendus aux index 45 et 54 (débutants) ─── */
(function extendBenchmarks() {
  if (typeof SG_BENCHMARKS !== 'undefined' && SG_BENCHMARKS[SG_BENCHMARKS.length - 1].hcp === 36) {
    SG_BENCHMARKS.push({ hcp: 45, score: 118.0, fir: 0.25, gir: 0.04, putts: 36.0 });
    SG_BENCHMARKS.push({ hcp: 54, score: 127.0, fir: 0.20, gir: 0.02, putts: 37.0 });
  }
})();
function bgnExtendPutting() {
  if (typeof PTS_BENCH !== 'undefined' && PTS_BENCH[PTS_BENCH.length - 1].hcp === 36) {
    PTS_BENCH.push({ hcp: 45, three: 0.26, scr: 0.025, pgir: 2.20 });
    PTS_BENCH.push({ hcp: 54, three: 0.30, scr: 0.015, pgir: 2.25 });
  }
}

/* Index à utiliser quand rien d'autre n'est connu (plus jamais 14,2 par défaut) */
function bgnDefaultIndex() {
  var w = (typeof calcHandicapFromRounds === 'function') ? calcHandicapFromRounds() : null;
  if (w !== null && w !== undefined) return w;
  if (typeof currentUser !== 'undefined' && currentUser && currentUser.hcp !== null && currentUser.hcp !== undefined && !isNaN(currentUser.hcp)) return Number(currentUser.hcp);
  return 36;
}

function bgnNeedsLevel() {
  if (typeof currentUser === 'undefined' || !currentUser) return false;
  if (lsGet('levelAsked')) return false;
  var w = (typeof calcHandicapFromRounds === 'function') ? calcHandicapFromRounds() : null;
  return (w === null || w === undefined) && (currentUser.hcp === null || currentUser.hcp === undefined || isNaN(currentUser.hcp));
}

/* Enregistre l'index de départ (profil local + cloud) */
function bgnSetIndex(v) {
  v = Math.max(-8, Math.min(54, Math.round(Number(v) * 10) / 10));
  currentUser.hcp = v;
  var profiles = lsGet('profiles');
  if (Array.isArray(profiles)) {
    profiles.forEach(function(p) { if (p.id === currentUser.id) p.hcp = v; });
    lsSet('profiles', profiles);
  }
  if (window.tsgCloud && window.sbClient) {
    try { window.sbClient.from('profiles').update({ hcp: v }).eq('id', currentUser.id).then(function() {}, function() {}); } catch (e) {}
  }
  lsSet('levelAsked', true);
  var f = document.getElementById('f-hcp');
  if (f) f.value = v;
  if (typeof sgBackfillRounds === 'function') { try { sgBackfillRounds(true); } catch (e) {} }
  if (typeof updateNavUI === 'function') { try { updateNavUI(); } catch (e) {} }
  if (typeof showPage === 'function') { try { var act = document.querySelector('.app-page.active'); showPage(act ? act.id.replace('page-', '') : 'dashboard'); } catch (e) {} }
}

var BGN_SCORE_CHOICES = [
  { label: 'Je n\'ai jamais fait 18 trous', index: 54 },
  { label: 'Plus de 120', index: 50 },
  { label: 'Entre 110 et 120', index: 40 },
  { label: 'Entre 100 et 110', index: 30 },
  { label: 'Entre 90 et 100', index: 22 },
  { label: 'Moins de 90', index: 15 }
];

function bgnOpenLevel() {
  var old = document.getElementById('bgn-level');
  if (old) old.remove();
  var m = document.createElement('div');
  m.id = 'bgn-level';
  m.className = 'trn-modal bgn-modal';
  m.innerHTML = '<div class="trn-modal-card" style="max-width:440px">'
    + '<div class="trn-modal-head"><div><div class="trn-modal-tag">Pour bien démarrer</div>'
    +   '<div class="trn-modal-title">Ton niveau aujourd\'hui</div></div><button class="trn-modal-close" type="button">×</button></div>'
    + '<div class="trn-modal-body">'
    +   '<p class="inv-text">Toutes les comparaisons se font avec des joueurs <strong>de ton niveau</strong>. Un débutant n\'est pas jugé comme un joueur confirmé.</p>'
    +   '<div class="bgn-choice"><div class="qt-l">Tu as un index (handicap) ?</div>'
    +     '<div class="bgn-row"><input class="obj-input" id="bgn-idx" inputmode="decimal" placeholder="Ex : 18,4" maxlength="5">'
    +     '<button class="dash-btn dash-btn-gold" type="button" id="bgn-idx-ok">Valider</button></div></div>'
    +   '<div class="bgn-or">ou</div>'
    +   '<div class="bgn-choice"><div class="qt-l">Pas d\'index ? Ton score habituel sur 18 trous</div>'
    +     '<div class="bgn-scores">' + BGN_SCORE_CHOICES.map(function(c, i) {
            return '<button type="button" class="bgn-score" data-i="' + i + '">' + c.label + '</button>';
          }).join('') + '</div></div>'
    +   '<div class="bgn-note">L\'app calculera ton <span class="gloss-link" data-gloss="index">index officiel</span> toute seule dès ta 3e carte de 18 trous. '
    +   'Nouveau au golf ? <span class="gloss-link" data-gloss="">Les mots à connaître</span>.</div>'
    +   '<div class="ch-join-error" id="bgn-err" style="display:none"></div>'
    + '</div></div>';
  document.body.appendChild(m);
  function close() { lsSet('levelAsked', true); m.remove(); }
  m.querySelector('.trn-modal-close').addEventListener('click', close);
  m.querySelector('#bgn-idx-ok').addEventListener('click', function() {
    var v = parseFloat(String(m.querySelector('#bgn-idx').value || '').replace(',', '.').replace('+', '-'));
    var err = m.querySelector('#bgn-err');
    if (isNaN(v) || v < -8 || v > 54) { err.style.display = 'block'; err.textContent = 'Un index va de +8 (écrit -8) à 54.'; return; }
    m.remove(); bgnSetIndex(v);
    showToast('Index de départ : ' + String(v).replace('.', ',') + ' ✓');
  });
  m.querySelectorAll('.bgn-score').forEach(function(b) {
    b.addEventListener('click', function() {
      var c = BGN_SCORE_CHOICES[parseInt(b.getAttribute('data-i'), 10)];
      m.remove(); bgnSetIndex(c.index);
      showToast('On part sur un index de ' + c.index + ' ✓ Il s\'ajustera avec tes cartes');
    });
  });
}

/* ─── Lexique ─── */

var GLOSSARY = [
  { id: 'index', term: 'Index (handicap)', def: 'Ton niveau en un chiffre : à peu près le nombre de coups au-dessus du par que tu joues dans un bon jour. 54 = on débute, 0 = « scratch ». Il se calcule avec tes 8 meilleures cartes sur les 20 dernières.' },
  { id: 'par', term: 'Par', def: 'Le nombre de coups prévu pour un bon joueur sur un trou (3, 4 ou 5). Un parcours fait souvent par 72. Bogey = 1 coup de plus que le par, birdie = 1 de moins.' },
  { id: 'gir', term: 'GIR · green en régulation', def: 'Tu atteins le green en « par − 2 » coups : en 1 coup sur un par 3, 2 sur un par 4, 3 sur un par 5. Il reste alors 2 putts pour faire le par.' },
  { id: 'fir', term: 'Fairway touché', def: 'Ton coup de départ s\'arrête sur le fairway (l\'herbe tondue courte), sur les par 4 et par 5. Le rough et les bunkers ne comptent pas.' },
  { id: 'putt', term: 'Putt', def: 'Un coup joué sur le green, en général au putter. 2 putts par trou, c\'est la norme ; 3, c\'est un « 3-putt ».' },
  { id: 'updown', term: 'Up & down · sauvetage', def: 'Tu rates le green, puis tu fais quand même le par : une approche près du trou et un putt rentré.' },
  { id: 'sg', term: 'Strokes Gained', def: 'Combien de coups tu gagnes (+) ou perds (−) dans chaque secteur — départ, approche, petit jeu, putting — par rapport à un joueur de ton index. Le secteur le plus négatif est ta priorité.' },
  { id: 'diff', term: 'Différentiel', def: 'Ta carte ramenée à la difficulté du parcours : (113 / slope) × (score − SSS). C\'est avec lui que se calcule ton index.' },
  { id: 'slope', term: 'SSS et slope', def: 'Deux chiffres de difficulté donnés pour chaque départ. Le SSS (rating) ≈ le score d\'un très bon joueur ; le slope (55 à 155, 113 = moyen) dit combien le parcours est plus dur pour un joueur moyen.' },
  { id: 'hj', term: 'Handicap de jeu', def: 'Les coups que tu reçois sur CE parcours et CE départ : ton index ajusté au slope et au SSS. Ils se répartissent sur les trous les plus difficiles (index de trou « SI » 1, 2, 3…).' },
  { id: 'stableford', term: 'Stableford', def: 'On compte des points plutôt que des coups : 2 points pour le par « net » (après tes coups reçus), 3 pour un birdie net, 1 pour un bogey net, 0 au-delà. 36 points = tu as joué ton handicap.' },
  { id: 'match', term: 'Match play', def: 'Duel trou par trou : le plus petit score (net) gagne le trou. « 2 UP » = 2 trous d\'avance. Le match s\'arrête quand l\'écart dépasse les trous restants (« 3&2 »).' },
  { id: 'net', term: 'Score net / brut', def: 'Brut = les coups réellement joués. Net = brut moins tes coups reçus : c\'est ce qui permet à tous les niveaux de jouer ensemble.' },
  { id: 'tee', term: 'Départ (tee)', def: 'La zone d\'où l\'on joue le premier coup, repérée par une couleur (blanc, jaune, bleu, rouge). Plus le départ est reculé, plus le parcours est long.' },
  { id: 'dispersion', term: 'Dispersion', def: 'L\'écart de tes balles autour de la cible. Moins de dispersion = plus de régularité, souvent plus utile que la distance.' }
];

function glossOpen(focusId) {
  var old = document.getElementById('gloss-modal');
  if (old) old.remove();
  var m = document.createElement('div');
  m.id = 'gloss-modal';
  m.className = 'trn-modal gloss-modal';
  m.innerHTML = '<div class="trn-modal-card" style="max-width:520px">'
    + '<div class="trn-modal-head"><div><div class="trn-modal-tag">Nouveau au golf ?</div>'
    +   '<div class="trn-modal-title">Les mots à connaître</div></div><button class="trn-modal-close" type="button">×</button></div>'
    + '<div class="trn-modal-body"><input class="obj-input gloss-search" id="gloss-q" placeholder="Chercher un mot…" autocomplete="off">'
    +   '<div class="gloss-list" id="gloss-list">' + GLOSSARY.map(function(g) {
          return '<div class="gloss-item" id="gloss-' + g.id + '" data-text="' + (g.term + ' ' + g.def).toLowerCase().replace(/"/g, '') + '">'
            + '<div class="gloss-term">' + g.term + '</div><div class="gloss-def">' + g.def + '</div></div>';
        }).join('') + '</div></div></div>';
  document.body.appendChild(m);
  m.querySelector('.trn-modal-close').addEventListener('click', function() { m.remove(); });
  m.addEventListener('click', function(e) { if (e.target === m) m.remove(); });
  m.querySelector('#gloss-q').addEventListener('input', function(e) {
    var q = e.target.value.toLowerCase().trim();
    m.querySelectorAll('.gloss-item').forEach(function(it) { it.hidden = q && it.getAttribute('data-text').indexOf(q) === -1; });
  });
  if (focusId) {
    var el = m.querySelector('#gloss-' + focusId);
    if (el) { el.classList.add('hl'); setTimeout(function() { try { el.scrollIntoView({ block: 'center' }); } catch (e) {} }, 30); }
  }
}

/* Un clic sur un mot du lexique, ou sur une pastille « ? » (lisible au doigt) */
document.addEventListener('click', function(e) {
  var g = e.target.closest && e.target.closest('[data-gloss]');
  if (g) { e.preventDefault(); glossOpen(g.getAttribute('data-gloss')); return; }
  var tip = e.target.closest && e.target.closest('.info-tip');
  if (tip && (tip.title || tip.getAttribute('data-tip'))) {
    e.preventDefault(); e.stopPropagation();
    var text = tip.getAttribute('data-tip') || tip.title;
    if (!tip.getAttribute('data-tip')) { tip.setAttribute('data-tip', text); tip.removeAttribute('title'); }
    var old = document.getElementById('tip-pop');
    if (old) old.remove();
    var pop = document.createElement('div');
    pop.id = 'tip-pop';
    pop.className = 'trn-modal';
    pop.innerHTML = '<div class="trn-modal-card" style="max-width:420px"><div class="trn-modal-head"><div><div class="trn-modal-tag">Explication</div></div>'
      + '<button class="trn-modal-close" type="button">×</button></div><div class="trn-modal-body"><p class="inv-text">' + text.replace(/</g, '&lt;') + '</p>'
      + '<button class="dash-btn dash-btn-outline" type="button" data-gloss="">📖 Tous les mots du golf</button></div></div>';
    document.body.appendChild(pop);
    pop.addEventListener('click', function(ev) { if (ev.target === pop || ev.target.closest('.trn-modal-close') || ev.target.closest('[data-gloss]')) pop.remove(); });
  }
}, true);

/* ─── Ton avis (retours des testeurs) ─── */

var FB_MOODS = ['😕', '🙁', '😐', '🙂', '😍'];

function fbOpen() {
  var old = document.getElementById('fb-modal');
  if (old) old.remove();
  var m = document.createElement('div');
  m.id = 'fb-modal';
  m.className = 'trn-modal fb-modal';
  var page = (document.querySelector('.app-page.active') || {}).id || '';
  m.innerHTML = '<div class="trn-modal-card" style="max-width:440px">'
    + '<div class="trn-modal-head"><div><div class="trn-modal-tag">Version de test</div>'
    +   '<div class="trn-modal-title">Ton avis compte</div></div><button class="trn-modal-close" type="button">×</button></div>'
    + '<div class="trn-modal-body">'
    +   '<p class="inv-text">Ce qui t\'a plu, ce qui t\'a perdu, ce qui manque : tout est lu.</p>'
    +   '<div class="fb-moods">' + FB_MOODS.map(function(e, i) { return '<button type="button" class="fb-mood" data-m="' + (i + 1) + '">' + e + '</button>'; }).join('') + '</div>'
    +   '<div class="fb-cats">' + ['J\'aime', 'Pas clair', 'Bug', 'Idée'].map(function(c) { return '<button type="button" class="hn-club" data-c="' + c + '">' + c + '</button>'; }).join('') + '</div>'
    +   '<textarea class="hn-text" id="fb-body" rows="4" maxlength="2000" placeholder="Raconte-nous…"></textarea>'
    +   '<div class="ch-join-error" id="fb-err" style="display:none"></div>'
    + '</div>'
    + '<div class="trn-modal-actions"><button class="dash-btn dash-btn-outline" type="button" id="fb-cancel">Annuler</button>'
    +   '<button class="dash-btn dash-btn-gold" type="button" id="fb-send">Envoyer</button></div></div>';
  document.body.appendChild(m);
  var mood = null, cat = null;
  m.querySelectorAll('.fb-mood').forEach(function(b) { b.addEventListener('click', function() { mood = parseInt(b.getAttribute('data-m'), 10); m.querySelectorAll('.fb-mood').forEach(function(x) { x.classList.toggle('on', x === b); }); }); });
  m.querySelectorAll('[data-c]').forEach(function(b) { b.addEventListener('click', function() { cat = cat === b.getAttribute('data-c') ? null : b.getAttribute('data-c'); m.querySelectorAll('[data-c]').forEach(function(x) { x.classList.toggle('on', x.getAttribute('data-c') === cat); }); }); });
  function close() { m.remove(); }
  m.querySelector('.trn-modal-close').addEventListener('click', close);
  m.querySelector('#fb-cancel').addEventListener('click', close);
  m.querySelector('#fb-send').addEventListener('click', function() {
    var body = (m.querySelector('#fb-body').value || '').trim();
    if (!mood && !body) { var err = m.querySelector('#fb-err'); err.style.display = 'block'; err.textContent = 'Choisis une humeur ou écris un mot.'; return; }
    var item = { mood: mood, category: cat, body: body.slice(0, 2000), page: page.replace('page-', ''),
      meta: { w: window.innerWidth, h: window.innerHeight, standalone: !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches),
              ua: navigator.userAgent.slice(0, 160), cloud: !!window.tsgCloud, rounds: (lsGet('rounds') || []).length, v: fbVersion() },
      at: new Date().toISOString() };
    var q = lsGet('feedbackQueue') || [];
    q.push(item);
    lsSet('feedbackQueue', q.slice(-20));
    close();
    showToast('Merci ! Ton avis est bien noté ✓');
    fbFlush();
  });
  setTimeout(function() { try { m.querySelector('#fb-body').focus(); } catch (e) {} }, 60);
}

function fbVersion() {
  var s = document.querySelector('script[src*="app.js?v="]');
  return s ? (s.getAttribute('src').split('v=')[1] || '') : '';
}

var _fbBusy = false;
function fbFlush() {
  var q = lsGet('feedbackQueue') || [];
  if (!q.length || _fbBusy || !window.sbClient || navigator.onLine === false) return;
  _fbBusy = true;
  var item = q[0];
  var row = { mood: item.mood, category: item.category, body: item.body, page: item.page, meta: item.meta, created_at: item.at };
  if (window.tsgCloud && window._sbSession && window._sbSession.user) row.user_id = window._sbSession.user.id;
  var req;
  try { req = window.sbClient.from('feedback').insert(row); } catch (e) { _fbBusy = false; return; }
  req.then(function(res) {
    _fbBusy = false;
    if (res && res.error) return;                      // table absente ou refus : on garde, on réessaiera
    var cur = lsGet('feedbackQueue') || [];
    cur.shift();
    lsSet('feedbackQueue', cur);
    if (cur.length) fbFlush();
  }, function() { _fbBusy = false; });
}

/* Bouton flottant « Ton avis » (phase de test) */
function fbMountButton() {
  if (document.getElementById('fb-fab') || lsGet('fbHidden')) return;
  var b = document.createElement('button');
  b.id = 'fb-fab';
  b.type = 'button';
  b.className = 'fb-fab';
  b.setAttribute('aria-label', 'Donner mon avis');
  b.innerHTML = '💬<span>Ton avis</span>';
  b.addEventListener('click', fbOpen);
  document.body.appendChild(b);
}

/* Au lancement de l'app */
function bgnOnLaunch() {
  bgnExtendPutting();
  fbMountButton();
  setTimeout(fbFlush, 2500);
  if (bgnNeedsLevel()) {
    var tries = 0;
    (function wait() {
      if (document.querySelector('.onb-modal, #inv-modal, #sgm-joinm') && tries++ < 300) { setTimeout(wait, 700); return; }
      if (bgnNeedsLevel()) bgnOpenLevel();
    })();
  }
}
