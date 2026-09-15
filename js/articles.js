/* ════════════════════════════════════════════
 * THE SMART GOLFER — articles.js
 * ONGLET ARTICLES : 38 articles (guides, fiches, analyses) pour apprendre.
 *
 *  - Contenu dans articles-data.js, chargé À LA DEMANDE (≈ 80 ko) à la
 *    première ouverture : le démarrage de l'app n'en paie pas le prix.
 *    Précaché par le service worker → lisible hors-ligne.
 *  - « Pour toi » : parcours « Par où commencer » (10 articles, dans l'ordre)
 *    pour un débutant ; sinon les articles liés à ton secteur le plus faible.
 *  - Recherche, filtres catégorie / niveau, lecteur plein écran avec barre
 *    de progression, article suivant, bouton vers la fonction de l'app.
 *  - Lu ✓ quand on arrive en bas de l'article (`tsg_articlesRead` {id: date}).
 * ════════════════════════════════════════════ */

var ART_CATS = {
  analyse:     { label: 'Analyse',     ico: '📊' },
  strategie:   { label: 'Stratégie',   ico: '🧭' },
  technique:   { label: 'Technique',   ico: '🏌️' },
  mental:      { label: 'Mental',      ico: '🧠' },
  preparation: { label: 'Préparation', ico: '📅' },
  competition: { label: 'Compétition', ico: '🏆' },
  equipement:  { label: 'Équipement',  ico: '🎒' },
  parcours:    { label: 'Parcours',    ico: '⛳' }
};
var ART_LEVELS = ['Débutant', 'Intermédiaire', 'Avancé', 'Expert'];
var ART_FORMATS = { longform: 'Dossier', guide: 'Guide pratique', fiche: 'Fiche' };
/* Secteur faible (trnWeakSectors) → articles utiles */
var ART_BY_SECTOR = { 'Putting': [10, 1, 32], 'Approche': [2, 11, 7], 'Jeu court': [11, 5, 35], 'Drive': [5, 33, 12] };

var _art = { cat: 'all', level: 'all', q: '' };
var _artLoading = null;

function artLoad(cb) {
  if (typeof ARTICLES !== 'undefined') { cb(true); return; }
  if (_artLoading) { _artLoading.push(cb); return; }
  _artLoading = [cb];
  var v = '';
  var me = document.querySelector('script[src*="js/articles.js"]');
  if (me) { var m = me.getAttribute('src').match(/\?v=(\w+)/); if (m) v = '?v=' + m[1]; }
  var s = document.createElement('script');
  s.src = 'js/articles-data.js' + v;
  function done(ok) { var l = _artLoading; _artLoading = null; l.forEach(function(f) { f(ok); }); }
  s.onload = function() { done(typeof ARTICLES !== 'undefined'); };
  s.onerror = function() { s.remove(); done(false); };
  document.head.appendChild(s);
}

function artReadMap() { var r = lsGet('articlesRead'); return (r && typeof r === 'object') ? r : {}; }
function artIsRead(id) { return !!artReadMap()[id]; }
function artMarkRead(id) {
  var r = artReadMap();
  if (r[id]) return false;
  r[id] = Date.now();
  lsSet('articlesRead', r);
  return true;
}
function artById(id) { for (var i = 0; i < ARTICLES.length; i++) if (ARTICLES[i].id === id) return ARTICLES[i]; return null; }
function artMinutes(a) {
  if (!a._min) a._min = Math.max(2, Math.round(a.body.replace(/<[^>]+>/g, ' ').split(/\s+/).length / 200));
  return a._min;
}
function artLevelClass(n) { return 'art-lv-' + ART_LEVELS.indexOf(n); }
function artPath() {
  return ARTICLES.filter(function(a) { return a.start != null; }).sort(function(a, b) { return a.start - b.start; });
}

/* Débutant = index (calculé, sinon profil, sinon 36 par défaut) élevé */
function artIsBeginner() {
  var idx = (typeof bgnDefaultIndex === 'function') ? bgnDefaultIndex() : null;
  return idx == null || idx >= 26;
}

function buildArticlesPage(container) {
  if (!container) return;
  container.innerHTML = '';
  var wrap = document.createElement('div');
  wrap.className = 'dash-wrap art-wrap';
  wrap.innerHTML = '<div class="dash-header"><div><div class="dash-greeting">Articles</div>'
    + '<div class="dash-meta" data-art="meta">Guides et fiches pour comprendre et progresser</div></div></div>'
    + '<div data-art="body"><div class="ch-loading">Chargement des articles…</div></div>';
  container.appendChild(wrap);
  var body = wrap.querySelector('[data-art="body"]');
  artLoad(function(ok) {
    if (!ok) {
      body.innerHTML = '<div class="an-empty-card"><div class="an-empty-icon">📖</div><div class="an-empty-title">Articles indisponibles</div>'
        + '<div class="an-empty-text">Ils n\'ont pas pu être chargés. Vérifie ta connexion puis réessaie.</div>'
        + '<button class="dash-btn dash-btn-gold" type="button" data-art="retry" style="margin-top:14px">Réessayer</button></div>';
      body.querySelector('[data-art="retry"]').addEventListener('click', function() { buildArticlesPage(container); });
      return;
    }
    artRenderBody(wrap, body);
  });
}

function artRenderBody(wrap, body) {
  var read = artReadMap();
  var nRead = ARTICLES.filter(function(a) { return read[a.id]; }).length;
  wrap.querySelector('[data-art="meta"]').textContent = ARTICLES.length + ' articles · ' + (nRead ? nRead + ' lu' + (nRead > 1 ? 's' : '') : 'guides et fiches pour progresser');

  body.innerHTML = '<div data-art="foryou"></div>'
    + '<div class="panel art-browse"><div class="panel-body">'
    +   '<input class="obj-input art-search" type="search" data-art="q" placeholder="Chercher : putting, stableford, première partie…" autocomplete="off" value="' + artAttr(_art.q) + '">'
    +   '<div class="art-chips" data-art="cats">'
    +     '<button type="button" class="filter-btn" data-cat="all">Tout</button>'
    +     Object.keys(ART_CATS).map(function(k) { return '<button type="button" class="filter-btn" data-cat="' + k + '">' + ART_CATS[k].ico + ' ' + ART_CATS[k].label + '</button>'; }).join('')
    +   '</div>'
    +   '<div class="art-chips" data-art="levels">'
    +     '<button type="button" class="filter-btn" data-lv="all">Tous niveaux</button>'
    +     ART_LEVELS.map(function(l) { return '<button type="button" class="filter-btn" data-lv="' + l + '">' + l + '</button>'; }).join('')
    +   '</div>'
    +   '<div class="art-count" data-art="count"></div>'
    +   '<div class="art-grid" data-art="grid"></div>'
    + '</div></div>';

  artRenderForYou(body.querySelector('[data-art="foryou"]'), function() { artRenderBody(wrap, body); });

  var grid = body.querySelector('[data-art="grid"]');
  function refresh() {
    body.querySelectorAll('[data-cat]').forEach(function(b) { b.classList.toggle('on', b.getAttribute('data-cat') === _art.cat); });
    body.querySelectorAll('[data-lv]').forEach(function(b) { b.classList.toggle('on', b.getAttribute('data-lv') === _art.level); });
    var list = artFiltered();
    body.querySelector('[data-art="count"]').textContent = list.length ? (list.length + ' article' + (list.length > 1 ? 's' : '')) : '';
    grid.innerHTML = list.length ? list.map(artCardHtml).join('')
      : '<div class="art-none">Aucun article ne correspond. Essaie un autre mot ou retire un filtre.</div>';
  }
  body.querySelectorAll('[data-cat]').forEach(function(b) {
    b.addEventListener('click', function() { _art.cat = b.getAttribute('data-cat'); refresh(); });
  });
  body.querySelectorAll('[data-lv]').forEach(function(b) {
    b.addEventListener('click', function() { _art.level = b.getAttribute('data-lv'); refresh(); });
  });
  body.querySelector('[data-art="q"]').addEventListener('input', function(e) { _art.q = e.target.value; refresh(); });
  grid.addEventListener('click', function(e) {
    var c = e.target.closest('[data-art-id]');
    if (!c) return;
    var list = artFiltered().map(function(a) { return a.id; });
    artOpen(parseInt(c.getAttribute('data-art-id'), 10), list, function() { artRenderBody(wrap, body); });
  });
  refresh();
}

function artAttr(s) { return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

function artNorm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }

function artFiltered() {
  var q = artNorm(_art.q).trim();
  var words = q ? q.split(/\s+/) : [];
  var list = ARTICLES.filter(function(a) {
    if (_art.cat !== 'all' && a.cat !== _art.cat) return false;
    if (_art.level !== 'all' && a.niveau !== _art.level) return false;
    if (!words.length) return true;
    if (!a._text) a._text = artNorm(a.title + ' ' + a.subtitle + ' ' + a.excerpt + ' ' + ART_CATS[a.cat].label + ' ' + a.body.replace(/<[^>]+>/g, ' '));
    return words.every(function(w) { return a._text.indexOf(w) !== -1; });
  });
  // Débutant d'abord, puis par catégorie
  var keys = Object.keys(ART_CATS);
  return list.sort(function(a, b) {
    return (ART_LEVELS.indexOf(a.niveau) - ART_LEVELS.indexOf(b.niveau)) || (keys.indexOf(a.cat) - keys.indexOf(b.cat)) || (a.id - b.id);
  });
}

function artCardHtml(a) {
  var cat = ART_CATS[a.cat];
  var read = artIsRead(a.id);
  return '<button type="button" class="art-card' + (read ? ' is-read' : '') + '" data-art-id="' + a.id + '">'
    + '<div class="art-card-tags"><span class="art-tag-cat">' + cat.ico + ' ' + cat.label + '</span>'
    +   '<span class="art-tag-lv ' + artLevelClass(a.niveau) + '">' + a.niveau + '</span>'
    +   (a.isNew ? '<span class="art-tag-new">Nouveau</span>' : '') + '</div>'
    + '<div class="art-card-title">' + a.title + '</div>'
    + '<div class="art-card-exc">' + a.excerpt + '</div>'
    + '<div class="art-card-foot"><span>' + artMinutes(a) + ' min · ' + ART_FORMATS[a.format] + '</span>'
    +   (read ? '<span class="art-read">✓ Lu</span>' : '') + '</div>'
    + '</button>';
}

/* ─── Pour toi : parcours débutant, ou secteur faible ─── */
function artRenderForYou(host, onChange) {
  var read = artReadMap();
  var beginner = artIsBeginner();
  var panel = document.createElement('div');
  panel.className = 'panel art-foryou';

  if (beginner) {
    var path = artPath();
    var done = path.filter(function(a) { return read[a.id]; }).length;
    var next = path.filter(function(a) { return !read[a.id]; })[0];
    panel.innerHTML = '<div class="panel-header"><div><div class="panel-title">🌱 Par où commencer</div>'
      + '<div class="panel-sub">' + path.length + ' articles courts, dans l\'ordre, pour bien débuter</div></div>'
      + '<div class="art-path-count">' + done + '/' + path.length + '</div></div>'
      + '<div class="panel-body"><div class="art-path-bar"><span style="width:' + Math.round(done / path.length * 100) + '%"></span></div>'
      + (next ? '<button type="button" class="btn-express art-next" data-art-id="' + next.id + '"><span class="btn-express-t">' + (done ? 'Continuer' : 'Commencer') + ' : ' + next.title + '</span>'
          + '<span class="btn-express-s">' + artMinutes(next) + ' min de lecture</span></button>'
        : '<div class="art-path-done">🎉 Parcours terminé : tu connais les bases. Pioche maintenant dans les articles Intermédiaire.</div>')
      + '<ol class="art-path">' + path.map(function(a, i) {
          return '<li><button type="button" class="art-path-item' + (read[a.id] ? ' is-read' : '') + '" data-art-id="' + a.id + '">'
            + '<span class="art-path-n">' + (read[a.id] ? '✓' : (i + 1)) + '</span><span class="art-path-t">' + a.title + '</span>'
            + '<span class="art-path-m">' + artMinutes(a) + ' min</span></button></li>';
        }).join('') + '</ol></div>';
    panel.addEventListener('click', function(e) {
      var b = e.target.closest('[data-art-id]');
      if (b) artOpen(parseInt(b.getAttribute('data-art-id'), 10), path.map(function(a) { return a.id; }), onChange);
    });
  } else {
    var sectors = (typeof trnWeakSectors === 'function') ? trnWeakSectors() : null;
    var weak = sectors && sectors[0];
    var ids = (weak && ART_BY_SECTOR[weak.key]) || [3, 8, 33];
    var picks = ids.map(artById).filter(Boolean);
    panel.innerHTML = '<div class="panel-header"><div><div class="panel-title">★ À lire pour toi</div>'
      + '<div class="panel-sub">' + (weak && weak.sg < 0 ? 'Tu perds le plus de coups sur <strong>' + weak.label + '</strong> : ces articles t\'aident à comprendre pourquoi.' : 'Une sélection pour aller plus loin.') + '</div></div></div>'
      + '<div class="panel-body art-grid art-grid-3">' + picks.map(artCardHtml).join('') + '</div>';
    panel.addEventListener('click', function(e) {
      var b = e.target.closest('[data-art-id]');
      if (b) artOpen(parseInt(b.getAttribute('data-art-id'), 10), ids, onChange);
    });
  }
  host.appendChild(panel);
}

/* ─── Lecteur plein écran ─── */
function artOpen(id, sequence, onChange) {
  artLoad(function(ok) {
    if (!ok) { if (typeof showToast === 'function') showToast('Articles indisponibles pour le moment'); return; }
    var a = artById(id);
    if (!a) return;
    var old = document.getElementById('art-reader');
    if (old) old.remove();
    var seq = sequence && sequence.length ? sequence : ARTICLES.map(function(x) { return x.id; });
    var pos = seq.indexOf(id);
    var next = pos >= 0 && pos < seq.length - 1 ? artById(seq[pos + 1]) : null;
    var prev = pos > 0 ? artById(seq[pos - 1]) : null;
    var cat = ART_CATS[a.cat];
    var changed = false;

    var m = document.createElement('div');
    m.id = 'art-reader';
    m.className = 'trn-modal art-reader';
    m.innerHTML = '<div class="art-reader-card" role="document">'
      + '<div class="art-reader-top"><div class="art-reader-prog"><span></span></div>'
      +   '<span class="art-reader-crumb">' + cat.ico + ' ' + cat.label + (pos >= 0 && seq.length > 1 ? ' · ' + (pos + 1) + '/' + seq.length : '') + '</span>'
      +   '<button class="trn-modal-close" type="button" aria-label="Fermer">×</button></div>'
      + '<div class="art-reader-scroll">'
      +   '<article class="art-reader-inner">'
      +     '<div class="art-card-tags"><span class="art-tag-lv ' + artLevelClass(a.niveau) + '">' + a.niveau + '</span><span class="art-tag-cat">' + ART_FORMATS[a.format] + ' · ' + artMinutes(a) + ' min</span></div>'
      +     '<h2 class="art-reader-title" id="art-reader-title">' + a.title + '</h2>'
      +     '<p class="art-reader-sub">' + a.subtitle + '</p>'
      +     '<div class="art-body">' + a.body + '</div>'
      +     (a.app ? '<button type="button" class="dash-btn dash-btn-gold art-app-btn" data-art-go="' + a.app.go + '">' + a.app.label + ' →</button>' : '')
      +     '<div class="art-reader-end" data-art="end">' + (artIsRead(a.id) ? '✓ Article lu' : '') + '</div>'
      +     '<div class="art-reader-nav">'
      +       (prev ? '<button type="button" class="art-nav-btn" data-art-id="' + prev.id + '"><small>← Précédent</small><span>' + prev.title + '</span></button>' : '<span></span>')
      +       (next ? '<button type="button" class="art-nav-btn art-nav-next" data-art-id="' + next.id + '"><small>Suivant →</small><span>' + next.title + '</span></button>' : '')
      +     '</div>'
      +   '</article>'
      + '</div></div>';
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-modal', 'true');
    m.setAttribute('aria-labelledby', 'art-reader-title');
    document.body.appendChild(m);
    document.body.classList.add('art-open');

    var scroller = m.querySelector('.art-reader-scroll');
    var bar = m.querySelector('.art-reader-prog span');
    var endEl = m.querySelector('[data-art="end"]');
    function onScroll() {
      var max = scroller.scrollHeight - scroller.clientHeight;
      var p = max <= 4 ? 1 : scroller.scrollTop / max;
      bar.style.width = Math.round(p * 100) + '%';
      if (p >= 0.9 && artMarkRead(a.id)) {
        changed = true;
        endEl.textContent = '✓ Article lu';
        if (typeof accTrackPage === 'function') accTrackPage('article_read');
      }
    }
    scroller.addEventListener('scroll', onScroll, { passive: true });
    setTimeout(onScroll, 400);

    function close() {
      m.remove();
      document.body.classList.remove('art-open');
      if (changed && typeof onChange === 'function') { try { onChange(); } catch (e) {} }
    }
    m.querySelector('.trn-modal-close').addEventListener('click', close);
    m.addEventListener('click', function(e) {
      var nav = e.target.closest('[data-art-id]');
      if (nav) {
        if (changed && typeof onChange === 'function') { try { onChange(); } catch (x) {} }
        artOpen(parseInt(nav.getAttribute('data-art-id'), 10), seq, onChange);
        return;
      }
      var go = e.target.closest('[data-art-go]');
      if (go) { close(); artGo(go.getAttribute('data-art-go')); }
    });
  });
}

function artGo(target) {
  if (target === 'gloss') { if (typeof glossOpen === 'function') glossOpen(); return; }
  if (target === 'whs') { if (typeof openWhsModal === 'function') openWhsModal(); return; }
  if (typeof showPage === 'function') { showPage(target); window.scrollTo(0, 0); }
}
