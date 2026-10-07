/* ════════════════════════════════════════════
 * THE SMART GOLFER — friends.js
 * AMIS ET PROFILS (S68) — backend/maj_amis.sql.
 *
 * - Liste d'amis en tête de l'onglet Communauté : demandes reçues
 *   (Accepter / Refuser), amis (clic → profil), demandes envoyées.
 * - Ajouter un ami, 3 façons :
 *     · partager SON lien / QR code (…/?ami=CODE) → amis tout de suite,
 *       même si l'ami n'a pas encore de compte (le code survit à l'inscription) ;
 *     · saisir le code d'un ami → amis tout de suite ;
 *     · chercher par nom (profils publics + membres de mes groupes) → demande
 *       que l'autre doit accepter.
 * - Profil d'un joueur (frdOpenProfile) : complet si public, ami ou même
 *   groupe ; sinon nom seulement + bouton « Ajouter en ami ».
 *   Remplace l'ancienne fiche des Classements (lbOpenCard y délègue).
 * - Des amis se voient comme des membres d'un même groupe : leurs parties
 *   arrivent dans le fil d'activité (community.js), avec 👏 et commentaires.
 *
 * Tout est vérifié côté serveur (RLS + fonctions SECURITY DEFINER).
 * Sans le SQL : message « pas encore activé », le reste de l'app ne bouge pas.
 * Dépend de : app.js, qrcode.js, install.js (insAppUrl), community.js.
 * ════════════════════════════════════════════ */

var FRD_TTL_DAYS = 14;
var _frdCache = null;       // dernière liste reçue de my_friends()
var _frdMissing = false;    // SQL pas encore exécuté

function frdCloud() { return !!(window.tsgCloud && window.sbClient && typeof currentUser !== 'undefined' && currentUser); }

function frdEsc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function frdSanitize(code) {
  // Les codes sont hexadécimaux (0-9, A-F) : un « O » tapé à la place d'un zéro est corrigé
  var c = String(code || '').trim().toUpperCase().replace(/O/g, '0');
  return /^[A-Z0-9]{4,12}$/.test(c) ? c : null;
}

/* Accepte un code OU un lien d'ami collé */
function frdExtractCode(input) {
  var s = String(input || '').trim();
  var m = s.match(/[?&#]ami=([A-Za-z0-9]{4,12})/);
  return frdSanitize(m ? m[1] : s);
}

function frdLink(code) {
  var base = (typeof insAppUrl === 'function') ? insAppUrl() : (location.origin + location.pathname.replace(/index\.html$/, ''));
  return base + '?ami=' + encodeURIComponent(code);
}

function frdIsMissing(err) {
  var m = (err && err.message) || '';
  return /schema cache|my_friends|could not find the function|does not exist/i.test(m);
}

function frdAvatar(p, size) {
  size = size || 40;
  return '<span class="frd-av" style="width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size * 0.36) + 'px;'
    + 'background:' + frdEsc(p.bg || 'rgba(201,168,76,0.2)') + ';color:' + frdEsc(p.color || '#C9A84C') + '">'
    + frdEsc(p.initials || (p.name || '?').slice(0, 2).toUpperCase()) + '</span>';
}

function frdFirstName(name) { return String(name || 'Joueur').split(' ')[0]; }

function frdDate(d) {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); } catch (e) { return String(d); }
}

/* ═════════════ LIEN D'AMI REÇU (…/?ami=CODE) ═════════════ */

/* À appeler le plus tôt possible (boot.js) : le code survit à l'inscription et au retour Google */
function frdCaptureFromUrl() {
  var code = null;
  try { code = frdSanitize(new URLSearchParams(location.search).get('ami')); } catch (e) {}
  if (!code) return null;
  lsSet('pendingFriend', { code: code, ts: Date.now() });
  try {
    var params = new URLSearchParams(location.search);
    params.delete('ami');
    var qs = params.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
  } catch (e) {}
  return code;
}

function frdPending() {
  var p = lsGet('pendingFriend');
  if (!p || !frdSanitize(p.code)) return null;
  if (Date.now() - (p.ts || 0) > FRD_TTL_DAYS * 86400000) { frdClearPending(); return null; }
  return p;
}
function frdClearPending() { try { localStorage.removeItem('tsg_pendingFriend'); } catch (e) {} }

/* Bandeau sur l'accueil et l'écran de connexion */
function frdRenderAuthBanners() {
  if (!frdPending()) return;
  document.querySelectorAll('.frd-banner').forEach(function(b) { b.remove(); });
  var html = '<span class="inv-banner-ico">🤝</span><div><strong>Un ami t\'invite sur The Smart Golfer</strong>'
    + '<div class="inv-banner-sub">Crée ton compte (ou connecte-toi) : vous serez amis automatiquement.</div></div>';
  var cta = document.querySelector('#landing .ld-cta');
  if (cta) {
    var b1 = document.createElement('div');
    b1.className = 'inv-banner inv-banner-dark frd-banner';
    b1.innerHTML = html;
    cta.parentNode.insertBefore(b1, cta);
  }
  var box = document.getElementById('auth-box');
  if (box) {
    var b2 = document.createElement('div');
    b2.className = 'inv-banner frd-banner';
    b2.innerHTML = html;
    box.insertBefore(b2, box.firstChild);
    if (!lsGet('lastUser')) {
      var tab = document.getElementById('auth-tab-signup');
      if (tab) tab.click();
    }
  }
}

/* Après le lancement : lien d'ami en attente + demandes reçues */
function frdOnLaunch() {
  if (!frdCloud()) {
    if (frdPending()) showToast('Crée un compte pour devenir ami avec la personne qui t\'a invité');
    return;
  }
  var p = frdPending();
  var tries = 0;
  (function waitModals() {
    if (document.querySelector('.onb-modal, #bgn-level, #inv-modal') && tries++ < 300) { setTimeout(waitModals, 700); return; }
    if (p) frdAddByCode(p.code, { fromLink: true });
    else frdNotifyRequests();
  })();
}

function frdNotifyRequests() {
  frdLoad(function(list) {
    var n = list.filter(function(f) { return f.status === 'pending_in'; }).length;
    if (n) showToast('🤝 ' + n + ' demande' + (n > 1 ? 's' : '') + ' d\'ami — onglet Communauté');
  });
}

/* ═════════════ DONNÉES ═════════════ */

function frdLoad(cb) {
  if (!frdCloud()) { cb([]); return; }
  window.sbClient.rpc('my_friends').then(function(res) {
    if (res.error) { _frdMissing = frdIsMissing(res.error); cb([], res.error); return; }
    _frdMissing = false;
    _frdCache = res.data || [];
    cb(_frdCache);
  }, function(e) { cb([], e || { message: 'réseau' }); });
}

/* Ids des amis (fil d'activité) — liste vide si indisponible */
function frdFriendIds(cb) {
  frdLoad(function(list) {
    cb(list.filter(function(f) { return f.status === 'friends'; }).map(function(f) { return f.user_id; }));
  });
}

/* Actions : statut → serveur → rafraîchir ce qui est affiché */
function frdAction(kind, uid, done) {
  var rpc, args;
  if (kind === 'add') { rpc = 'send_friend_request'; args = { p_user: uid }; }
  else if (kind === 'accept') { rpc = 'respond_friend_request'; args = { p_user: uid, p_accept: true }; }
  else if (kind === 'decline') { rpc = 'respond_friend_request'; args = { p_user: uid, p_accept: false }; }
  else { rpc = 'remove_friend'; args = { p_user: uid }; }
  window.sbClient.rpc(rpc, args).then(function(res) {
    var d = res.data;
    if (res.error || !d || d.ok === false) {
      showToast(frdIsMissing(res.error) ? 'Les amis ne sont pas encore activés sur le serveur'
        : ((d && d.error) || 'Action impossible pour le moment'));
      return;
    }
    if (kind === 'add') showToast(d.status === 'friends' ? 'Vous êtes maintenant amis 🤝' : 'Demande envoyée ✓');
    else if (kind === 'accept') showToast('Vous êtes maintenant amis 🤝');
    else if (kind === 'decline') showToast('Demande refusée');
    else if (kind === 'cancel') showToast('Demande annulée');
    else showToast('Retiré de tes amis');
    frdRefreshAll();
    if (done) done(d);
  }, function() { showToast('Pas de réseau — réessaie plus tard'); });
}

function frdAddByCode(code, opts) {
  opts = opts || {};
  window.sbClient.rpc('add_friend_by_code', { p_code: code }).then(function(res) {
    var d = res.data;
    if (res.error || !d || !d.ok) {
      if (frdIsMissing(res.error)) { showToast('Les amis ne sont pas encore activés sur le serveur'); return; }
      var msg = (d && d.error) || 'Code inconnu';
      showToast(opts.fromLink ? 'Lien d\'ami invalide (' + msg + ')' : msg);
      if (opts.fromLink) frdClearPending();
      if (opts.onError) opts.onError(msg);
      return;
    }
    if (opts.fromLink) frdClearPending();
    showToast('Vous êtes maintenant amis avec ' + frdFirstName(d.name) + ' 🤝');
    frdRefreshAll();
    if (opts.onDone) opts.onDone(d);
    frdOpenProfile(d.id);
  }, function() { showToast('Pas de réseau — réessaie plus tard'); });
}

/* Ce qui affiche des amis se redessine après une action */
function frdRefreshAll() {
  var host = document.getElementById('frd-panel');
  if (host) frdRenderPanel(host);
  var open = document.getElementById('frd-profile');
  if (open && open.getAttribute('data-uid')) frdOpenProfile(open.getAttribute('data-uid'), { keep: true });
  if (typeof commRenderFeed === 'function' && document.getElementById('comm-feed')) commRenderFeed();
}

/* ═════════════ PANNEAU « MES AMIS » (Communauté) ═════════════ */

function frdRenderPanel(host) {
  if (!host) return;
  host.id = 'frd-panel';
  if (!frdCloud()) {
    host.innerHTML = '<div class="frd-panel frd-panel-empty"><div class="frd-head"><div class="frd-title">🤝 Mes amis</div></div>'
      + '<div class="frd-empty-t">Ajoute tes partenaires de jeu : vous verrez vos profils et vos parties, avec 👏 et commentaires.</div>'
      + '<div class="frd-empty-s">Il faut un compte (le mode démo reste sur ce téléphone).</div></div>';
    return;
  }
  if (!host.innerHTML) host.innerHTML = '<div class="frd-panel"><div class="ch-loading">Chargement de tes amis…</div></div>';

  frdLoad(function(list, err) {
    if (err && _frdMissing) {
      host.innerHTML = '<div class="frd-panel"><div class="frd-head"><div class="frd-title">🤝 Mes amis</div></div>'
        + '<div class="frd-empty-s">Les amis ne sont pas encore activés sur le serveur.</div></div>';
      return;
    }
    if (err) {
      host.innerHTML = '<div class="frd-panel"><div class="frd-head"><div class="frd-title">🤝 Mes amis</div></div>'
        + '<div class="frd-empty-s">Impossible de charger tes amis pour le moment.</div></div>';
      return;
    }
    var incoming = list.filter(function(f) { return f.status === 'pending_in'; });
    var friends = list.filter(function(f) { return f.status === 'friends'; })
      .sort(function(a, b) { return String(b.last_played || '').localeCompare(String(a.last_played || '')) || String(a.name).localeCompare(String(b.name)); });
    var outgoing = list.filter(function(f) { return f.status === 'pending_out'; });

    var html = '<div class="frd-panel">'
      + '<div class="frd-head"><div class="frd-title">🤝 Mes amis' + (friends.length ? ' <span class="frd-count">' + friends.length + '</span>' : '') + '</div>'
      + '<div class="frd-head-btns"><button class="dash-btn dash-btn-outline frd-me-btn" type="button" data-frd="me">Mon profil</button>'
      + '<button class="dash-btn dash-btn-gold" type="button" data-frd="add">+ Ajouter</button></div></div>';

    if (incoming.length) {
      html += '<div class="frd-sec-t">Demandes reçues</div>' + incoming.map(function(f) {
        return '<div class="frd-req">' + '<button class="frd-req-who" type="button" data-frd-open="' + frdEsc(f.user_id) + '">' + frdAvatar(f, 36)
          + '<span><strong>' + frdEsc(f.name) + '</strong><em>veut être ton ami</em></span></button>'
          + '<div class="frd-req-btns"><button class="dash-btn dash-btn-outline" type="button" data-frd-act="decline" data-uid="' + frdEsc(f.user_id) + '">Refuser</button>'
          + '<button class="dash-btn dash-btn-gold" type="button" data-frd-act="accept" data-uid="' + frdEsc(f.user_id) + '">Accepter</button></div></div>';
      }).join('');
    }

    if (friends.length) {
      html += '<div class="frd-list">' + friends.map(function(f) {
        var sub = (f.hcp !== null && f.hcp !== undefined) ? 'Index ' + String(Math.round(f.hcp * 10) / 10).replace('.', ',') : 'Sans index';
        if (f.last_played) sub += ' · joué le ' + frdDate(f.last_played);
        return '<button class="frd-friend" type="button" data-frd-open="' + frdEsc(f.user_id) + '">' + frdAvatar(f, 44)
          + '<span class="frd-friend-n">' + frdEsc(frdFirstName(f.name)) + '</span>'
          + '<span class="frd-friend-s">' + frdEsc(sub) + '</span></button>';
      }).join('') + '</div>';
    } else if (!incoming.length) {
      html += '<div class="frd-empty-t">Ajoute tes partenaires de jeu : vous verrez vos profils et vos parties dans le fil, avec 👏 et commentaires.</div>'
        + '<div class="frd-empty-s">Le plus simple : envoie-leur ton lien d\'ami, vous serez reliés dès qu\'ils l\'ouvrent.</div>';
    }

    if (outgoing.length) {
      html += '<div class="frd-sec-t">Demandes envoyées</div><div class="frd-out">' + outgoing.map(function(f) {
        return '<span class="frd-out-chip">' + frdEsc(frdFirstName(f.name))
          + '<button type="button" data-frd-act="cancel" data-uid="' + frdEsc(f.user_id) + '" aria-label="Annuler la demande">×</button></span>';
      }).join('') + '</div>';
    }
    html += '</div>';
    host.innerHTML = html;
  });

  if (!host._frdWired) {
    host._frdWired = true;
    host.addEventListener('click', function(e) {
      var t = e.target.closest('[data-frd],[data-frd-open],[data-frd-act]');
      if (!t) return;
      if (t.getAttribute('data-frd') === 'add') { frdOpenAdd(); return; }
      if (t.getAttribute('data-frd') === 'me') { frdOpenProfile(currentUser.id); return; }
      if (t.hasAttribute('data-frd-open')) { frdOpenProfile(t.getAttribute('data-frd-open')); return; }
      if (t.hasAttribute('data-frd-act')) { t.disabled = true; frdAction(t.getAttribute('data-frd-act'), t.getAttribute('data-uid')); }
    });
  }
}

/* ═════════════ AJOUTER UN AMI ═════════════ */

function frdModal(id, tag, title, body) {
  var old = document.getElementById(id);
  if (old) old.remove();
  var m = document.createElement('div');
  m.id = id;
  m.className = 'trn-modal frd-modal';
  m.innerHTML = '<div class="trn-modal-card" style="max-width:440px"><div class="trn-modal-head"><div><div class="trn-modal-tag">' + tag + '</div>'
    + '<div class="trn-modal-title">' + title + '</div></div><button class="trn-modal-close" type="button">×</button></div>'
    + '<div class="trn-modal-body">' + body + '</div></div>';
  document.body.appendChild(m);
  m.querySelector('.trn-modal-close').addEventListener('click', function() { m.remove(); });
  m.addEventListener('click', function(e) { if (e.target === m) m.remove(); });
  return m;
}

function frdOpenAdd() {
  if (!frdCloud()) { if (typeof insShareApp === 'function') insShareApp(); return; }
  var m = frdModal('frd-add', 'Amis', 'Ajouter un ami', ''
    + '<div class="frd-add-sec"><div class="frd-add-t">1 · Envoie ton lien</div>'
    +   '<div class="frd-add-d">Ton ami l\'ouvre (ou scanne le QR code) : vous êtes amis tout de suite, même s\'il n\'a pas encore de compte.</div>'
    +   '<div id="frd-mylink"><div class="ch-loading">Préparation de ton lien…</div></div></div>'
    + '<div class="frd-add-sec"><div class="frd-add-t">2 · Il t\'a donné son code ?</div>'
    +   '<div class="ch-join-row"><input class="ch-join-input" id="frd-code" placeholder="Code ou lien d\'ami" maxlength="200" autocomplete="off">'
    +   '<button class="dash-btn dash-btn-outline" type="button" id="frd-code-btn">Ajouter</button></div>'
    +   '<div class="ch-join-error" id="frd-code-err" style="display:none"></div></div>'
    + '<div class="frd-add-sec"><div class="frd-add-t">3 · Chercher par son nom</div>'
    +   '<input class="obj-input frd-search" id="frd-q" type="search" placeholder="Prénom ou nom…" autocomplete="off">'
    +   '<div id="frd-results" class="frd-results"></div>'
    +   '<div class="frd-add-d">Tu ne le trouves pas ? Seuls les profils publics et les membres de tes groupes apparaissent : envoie-lui plutôt ton lien. Une recherche envoie une demande qu\'il devra accepter.</div></div>');

  // 1. Mon lien
  var box = m.querySelector('#frd-mylink');
  window.sbClient.rpc('ensure_friend_code').then(function(res) {
    var code = res.data;
    if (res.error || !code) {
      box.innerHTML = '<div class="frd-add-d">' + (frdIsMissing(res.error) ? 'Les amis ne sont pas encore activés sur le serveur.' : 'Lien indisponible pour le moment.') + '</div>';
      return;
    }
    var link = frdLink(code), qr = '';
    try { qr = (typeof qrSvg === 'function') ? qrSvg(link, { dark: '#0f2a1e' }) : ''; } catch (e) { qr = ''; }
    box.innerHTML = (qr ? '<div class="inv-qr frd-qr">' + qr + '</div>' : '')
      + '<div class="inv-actions">'
      +   '<button class="dash-btn dash-btn-outline" type="button" id="frd-copy">Copier mon lien</button>'
      +   (navigator.share ? '<button class="dash-btn dash-btn-gold" type="button" id="frd-share">Partager…</button>' : '')
      + '</div>'
      + '<div class="inv-code-line">Ton code ami : <strong>' + frdEsc(code) + '</strong></div>';
    box.querySelector('#frd-copy').addEventListener('click', function() {
      try { navigator.clipboard.writeText(link).then(function() { showToast('Lien copié ✓'); }, function() { showToast(link); }); }
      catch (e) { showToast(link); }
    });
    var sh = box.querySelector('#frd-share');
    if (sh) sh.addEventListener('click', function() {
      navigator.share({ title: 'The Smart Golfer', text: 'Ajoute-moi en ami sur The Smart Golfer ⛳ On verra nos parties et nos progrès.', url: link }).catch(function() {});
    });
  }, function() { box.innerHTML = '<div class="frd-add-d">Pas de réseau.</div>'; });

  // 2. Par code
  var codeIn = m.querySelector('#frd-code');
  function byCode() {
    var err = m.querySelector('#frd-code-err');
    var code = frdExtractCode(codeIn.value);
    if (!code) { err.style.display = 'block'; err.textContent = 'Code invalide.'; return; }
    err.style.display = 'none';
    frdAddByCode(code, {
      onDone: function() { m.remove(); },
      onError: function(msg) { err.style.display = 'block'; err.textContent = msg; }
    });
  }
  m.querySelector('#frd-code-btn').addEventListener('click', byCode);
  codeIn.addEventListener('keydown', function(e) { if (e.key === 'Enter') byCode(); });

  // 3. Par nom
  var q = m.querySelector('#frd-q'), results = m.querySelector('#frd-results'), timer = null, seq = 0;
  q.addEventListener('input', function() {
    clearTimeout(timer);
    var term = q.value.trim();
    if (term.length < 2) { results.innerHTML = ''; return; }
    timer = setTimeout(function() {
      var mine = ++seq;
      results.innerHTML = '<div class="ch-loading">Recherche…</div>';
      window.sbClient.rpc('search_players', { p_query: term }).then(function(res) {
        if (mine !== seq) return;
        if (res.error) { results.innerHTML = '<div class="frd-add-d">' + (frdIsMissing(res.error) ? 'Recherche pas encore activée sur le serveur.' : 'Recherche impossible.') + '</div>'; return; }
        var list = res.data || [];
        if (!list.length) { results.innerHTML = '<div class="frd-add-d">Aucun joueur trouvé pour « ' + frdEsc(term) + ' ».</div>'; return; }
        results.innerHTML = list.map(function(p) {
          return '<div class="frd-res"><button class="frd-req-who" type="button" data-frd-open="' + frdEsc(p.user_id) + '">' + frdAvatar(p, 32)
            + '<span><strong>' + frdEsc(p.name) + '</strong></span></button>' + frdStatusButton(p.status, p.user_id, true) + '</div>';
        }).join('');
      }, function() { if (mine === seq) results.innerHTML = '<div class="frd-add-d">Pas de réseau.</div>'; });
    }, 300);
  });
  results.addEventListener('click', function(e) {
    var t = e.target.closest('[data-frd-open],[data-frd-act]');
    if (!t) return;
    if (t.hasAttribute('data-frd-open')) { frdOpenProfile(t.getAttribute('data-frd-open')); return; }
    t.disabled = true;
    frdAction(t.getAttribute('data-frd-act'), t.getAttribute('data-uid'), function(d) {
      var row = t.closest('.frd-res');
      if (row) t.outerHTML = frdStatusButton(d.status || (t.getAttribute('data-frd-act') === 'add' ? 'pending_out' : 'none'), t.getAttribute('data-uid'), true);
    });
  });
  setTimeout(function() { try { q.focus(); } catch (e) {} }, 60);
}

/* Le bouton qui correspond à la relation avec un joueur */
function frdStatusButton(status, uid, compact) {
  var u = frdEsc(uid);
  if (status === 'friends') return '<span class="frd-state frd-state-ok">✓ Amis</span>';
  if (status === 'pending_out') return '<span class="frd-state">Demande envoyée</span>';
  if (status === 'pending_in') return '<button class="dash-btn dash-btn-gold" type="button" data-frd-act="accept" data-uid="' + u + '">Accepter</button>';
  if (status === 'self') return '';
  return '<button class="dash-btn dash-btn-gold" type="button" data-frd-act="add" data-uid="' + u + '">' + (compact ? '+ Ajouter' : '+ Ajouter en ami') + '</button>';
}

/* ═════════════ PROFIL D'UN JOUEUR ═════════════ */

function frdOpenProfile(uid, opts) {
  opts = opts || {};
  if (!uid) return;
  if (!frdCloud()) { showToast('Les profils demandent un compte'); return; }
  var m = document.getElementById('frd-profile');
  if (!m || !opts.keep) {
    m = frdModal('frd-profile', 'Fiche joueur', '…', '<div class="ch-loading">Chargement du profil…</div>');
    m.classList.add('frd-profile-modal');
  }
  m.setAttribute('data-uid', uid);
  var body = m.querySelector('.trn-modal-body');
  var title = m.querySelector('.trn-modal-title');

  window.sbClient.rpc('player_card', { p_user: uid }).then(function(res) {
    var d = res.data;
    if (res.error || !d || (!d.ok && !d.private)) {
      title.textContent = 'Profil';
      body.innerHTML = '<p class="inv-text">Profil indisponible.</p>';
      return;
    }
    var status = d.friend_status || (uid === currentUser.id ? 'self' : 'none');
    title.textContent = status === 'self' ? 'Mon profil' : 'Profil de ' + frdFirstName(d.name);

    var hcp = (d.hcp !== null && d.hcp !== undefined) ? String(Math.round(d.hcp * 10) / 10).replace('.', ',') : '—';
    var subBits = [];
    if (d.ok) subBits.push((d.rounds_count || 0) + ' partie' + ((d.rounds_count || 0) > 1 ? 's' : ''));
    if (d.friends_count !== undefined && d.friends_count !== null) subBits.push(d.friends_count + ' ami' + (d.friends_count > 1 ? 's' : ''));
    if (d.member_since) {
      try { subBits.push('depuis ' + new Date(d.member_since).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })); } catch (e) {}
    }

    var actions = '';
    if (status === 'friends') {
      actions = '<div class="frd-p-actions"><span class="frd-state frd-state-ok">✓ Vous êtes amis</span>'
        + '<button class="frd-link-btn" type="button" data-frd-act="remove" data-uid="' + frdEsc(d.id) + '">Retirer</button></div>';
    } else if (status === 'pending_in') {
      actions = '<div class="frd-p-actions"><span class="frd-state">' + frdEsc(frdFirstName(d.name)) + ' veut être ton ami</span>'
        + '<button class="dash-btn dash-btn-outline" type="button" data-frd-act="decline" data-uid="' + frdEsc(d.id) + '">Refuser</button>'
        + '<button class="dash-btn dash-btn-gold" type="button" data-frd-act="accept" data-uid="' + frdEsc(d.id) + '">Accepter</button></div>';
    } else if (status === 'pending_out') {
      actions = '<div class="frd-p-actions"><span class="frd-state">Demande envoyée</span>'
        + '<button class="frd-link-btn" type="button" data-frd-act="cancel" data-uid="' + frdEsc(d.id) + '">Annuler</button></div>';
    } else if (status === 'none') {
      actions = '<div class="frd-p-actions"><button class="dash-btn dash-btn-gold frd-p-add" type="button" data-frd-act="add" data-uid="' + frdEsc(d.id) + '">+ Ajouter en ami</button></div>';
    }

    var head = '<div class="frd-p-head">' + frdAvatar(d, 64)
      + '<div class="frd-p-id"><div class="frd-p-name">' + frdEsc(d.name || 'Joueur') + '</div>'
      + '<div class="frd-p-sub">' + frdEsc(subBits.join(' · ')) + '</div></div></div>' + actions;

    if (!d.ok) {
      body.innerHTML = head + '<div class="frd-p-lock"><div class="frd-p-lock-i">🔒</div>'
        + '<div>Profil privé. ' + (status === 'pending_out'
          ? 'Dès que ' + frdEsc(frdFirstName(d.name)) + ' accepte ta demande, tu verras son index et ses parties.'
          : 'Devenez amis pour voir son index, ses records et ses dernières parties.') + '</div></div>';
      return;
    }

    var kpis = '<div class="frd-p-kpis">'
      + '<div><strong>' + hcp + '</strong><span>Index</span></div>'
      + '<div><strong>' + (d.best18 || '—') + '</strong><span>Meilleur 18 trous</span></div>'
      + '<div><strong>' + (d.avg18 !== null && d.avg18 !== undefined ? String(d.avg18).replace('.', ',') : '—') + '</strong><span>Moyenne 18 trous</span></div>'
      + '</div>';
    var rounds = (d.rounds || []).map(function(r) {
      var rel = (r.score !== null && r.par) ? r.score - r.par : null;
      return '<div class="frd-p-round"><span class="frd-p-rd">' + frdEsc(frdDate(r.played_on)) + '</span>'
        + '<span class="frd-p-rc">' + frdEsc(r.course || '') + '</span>'
        + '<strong>' + frdEsc(r.score) + '</strong>'
        + '<em class="' + (rel === null ? '' : (rel <= 0 ? 'good' : '')) + '">' + (rel === null ? '' : (rel > 0 ? '+' : '') + (rel === 0 ? 'PAR' : rel)) + '</em></div>';
    }).join('');
    var selfNote = status === 'self'
      ? '<div class="frd-p-note">C\'est ce que voient tes amis et les membres de tes groupes'
        + (d.public ? ', et tout le monde (ton profil est public).' : '. Les autres joueurs ne voient que ton nom.') + '</div>'
      : '';

    body.innerHTML = head + kpis
      + (rounds ? '<div class="frd-sec-t">Dernières parties</div><div class="frd-p-rounds">' + rounds + '</div>'
                : '<p class="inv-text">Pas encore de partie enregistrée.</p>')
      + selfNote;
  }, function() {
    body.innerHTML = '<p class="inv-text">Pas de réseau.</p>';
  });

  if (!m._frdWired) {
    m._frdWired = true;
    m.addEventListener('click', function(e) {
      var t = e.target.closest('[data-frd-act]');
      if (!t) return;
      var act = t.getAttribute('data-frd-act');
      if (act === 'remove' && !confirm('Retirer ce joueur de tes amis ? Vous ne verrez plus vos parties l\'un l\'autre.')) return;
      t.disabled = true;
      frdAction(act, t.getAttribute('data-uid'));
    });
  }
}
