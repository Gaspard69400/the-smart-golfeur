/* ════════════════════════════════════════════
 * THE SMART GOLFER — safety.js
 * FILET DE SÉCURITÉ : erreurs lisibles + sauvegardes automatiques.
 *
 * Avant l'ouverture à de vrais joueurs, deux règles :
 *  1. personne ne voit un écran blanc — une erreur dit ce qui s'est passé
 *     et propose une porte de sortie ;
 *  2. personne ne perd ses parties — un instantané de toutes les données
 *     est pris automatiquement et reste restaurable depuis les Paramètres.
 *
 * Les sauvegardes vivent dans IndexedDB, un stockage SÉPARÉ de localStorage :
 * si les données principales sont abîmées ou le quota plein, elles survivent.
 * (« Effacer les données du site » dans le navigateur supprime les deux.)
 * ════════════════════════════════════════════ */

/* ─────────── 1. ERREURS ─────────── */

var _tsgShownErrors = {};
var _tsgLastBanner = 0;

/* Bandeau discret en haut d'écran, avec « Recharger » */
function tsgErrorBanner(title, detail) {
  var now = Date.now();
  if (now - _tsgLastBanner < 8000) return;          // pas d'avalanche
  _tsgLastBanner = now;

  var old = document.getElementById('tsg-err-banner');
  if (old) old.remove();
  var b = document.createElement('div');
  b.id = 'tsg-err-banner';
  b.className = 'tsg-err-banner';
  b.setAttribute('role', 'alert');
  b.innerHTML = '<div class="tsg-err-txt"><strong>' + tsgEsc(title) + '</strong>'
    + (detail ? '<span>' + tsgEsc(detail) + '</span>' : '') + '</div>'
    + '<div class="tsg-err-act">'
    +   '<button class="tsg-err-btn" id="tsg-err-reload">Recharger</button>'
    +   '<button class="tsg-err-x" id="tsg-err-close" aria-label="Fermer">×</button>'
    + '</div>';
  document.body.appendChild(b);
  document.getElementById('tsg-err-reload').addEventListener('click', function() { location.reload(); });
  document.getElementById('tsg-err-close').addEventListener('click', function() { b.remove(); });
}

/* Erreurs non rattrapées : on ne signale que celles de l'app, une fois chacune */
function tsgIsOwnError(msg, file) {
  if (!msg) return false;
  if (/ResizeObserver loop|Script error\.?$/i.test(msg)) return false;   // bruit navigateur
  if (file && file.indexOf(location.origin) !== 0) return false;           // extensions, CDN
  return true;
}

window.addEventListener('error', function(ev) {
  var msg = ev && ev.message, file = ev && ev.filename;
  if (!tsgIsOwnError(msg, file)) return;
  if (_tsgShownErrors[msg]) return;
  _tsgShownErrors[msg] = true;
  console.error('[TSG] Erreur :', msg, file + ':' + (ev.lineno || '?'));
  if (document.getElementById('app') && document.getElementById('app').classList.contains('visible')) {
    tsgErrorBanner('Un souci est survenu dans l\'app.', 'Tes données sont intactes. Recharge si quelque chose ne répond plus.');
  }
});

window.addEventListener('unhandledrejection', function(ev) {
  var r = ev && ev.reason;
  var msg = (r && r.message) ? r.message : String(r || '');
  // Les erreurs réseau vers Supabase sont normales hors-ligne : pas de bandeau
  if (/Failed to fetch|NetworkError|Load failed|network/i.test(msg)) return;
  if (_tsgShownErrors[msg]) return;
  _tsgShownErrors[msg] = true;
  console.error('[TSG] Promesse rejetée :', msg);
});

/* Une page qui plante : carte honnête + « Réessayer » (au lieu de « Bientôt disponible ») */
function tsgPageError(container, tab, err) {
  if (!container) return;
  while (container.firstChild) container.removeChild(container.firstChild);
  var label = (tab && tab.label) || 'Cette page';
  var card = document.createElement('div');
  card.className = 'tsg-page-err';
  card.innerHTML = '<div class="tsg-page-err-ico">⚠️</div>'
    + '<h3>' + tsgEsc(label) + ' n\'a pas pu s\'afficher</h3>'
    + '<p>Tes données ne sont pas touchées. Réessaie ; si ça persiste, recharge l\'app.</p>'
    + '<div class="tsg-page-err-act">'
    +   '<button class="dash-btn dash-btn-gold" data-retry>Réessayer</button>'
    +   '<button class="dash-btn dash-btn-outline" data-reload>Recharger l\'app</button>'
    + '</div>'
    + '<details class="tsg-page-err-det"><summary>Détail technique</summary><code>'
    +   tsgEsc((err && err.message) || String(err)) + '</code></details>';
  container.appendChild(card);
  card.querySelector('[data-retry]').addEventListener('click', function() {
    if (tab && tab.page && typeof showPage === 'function') showPage(tab.page);
  });
  card.querySelector('[data-reload]').addEventListener('click', function() { location.reload(); });
}

/* L'app ne démarre pas : écran de secours, jamais d'écran blanc */
function tsgShowRecovery(err) {
  var old = document.getElementById('tsg-recovery');
  if (old) old.remove();
  var m = document.createElement('div');
  m.id = 'tsg-recovery';
  m.className = 'tsg-recovery';
  m.innerHTML = '<div class="tsg-rec-card">'
    + '<div class="tsg-rec-ico">🛟</div>'
    + '<h2>L\'app n\'a pas pu démarrer</h2>'
    + '<p>Tes parties sont enregistrées sur cet appareil'
    +   ((typeof cloudActive === 'function' && cloudActive()) ? ' et sur ton compte' : '')
    +   '. Essaie dans l\'ordre :</p>'
    + '<div class="tsg-rec-steps">'
    +   '<button class="tsg-rec-btn" data-a="reload"><strong>1. Recharger</strong><span>Suffit dans la plupart des cas.</span></button>'
    +   '<button class="tsg-rec-btn" data-a="cache"><strong>2. Vider le cache de l\'app</strong><span>Recharge une version propre. Tes données sont conservées.</span></button>'
    +   '<button class="tsg-rec-btn" data-a="restore"><strong>3. Restaurer la dernière sauvegarde</strong><span>Revient à l\'instantané automatique le plus récent.</span></button>'
    +   '<button class="tsg-rec-btn" data-a="export"><strong>Exporter mes données</strong><span>Un fichier de secours, à garder précieusement.</span></button>'
    + '</div>'
    + '<details class="tsg-page-err-det"><summary>Détail technique</summary><code>'
    +   tsgEsc((err && err.message) || String(err)) + '</code></details>'
    + '</div>';
  document.body.appendChild(m);

  m.querySelectorAll('[data-a]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var a = btn.getAttribute('data-a');
      if (a === 'reload') location.reload();
      if (a === 'cache') tsgClearAppCache().then(function() { location.reload(); });
      if (a === 'export' && typeof exportUserData === 'function') exportUserData();
      if (a === 'restore') {
        tsgListBackups().then(function(list) {
          if (!list.length) { alert('Aucune sauvegarde automatique trouvée sur cet appareil.'); return; }
          if (!confirm('Restaurer la sauvegarde du ' + tsgFmtDate(list[0].date) + ' (' + list[0].rounds + ' parties) ?')) return;
          tsgRestoreBackup(list[0].id).then(function() { location.reload(); });
        });
      }
    });
  });
}

/* Vide le Service Worker et ses caches — PAS les données */
function tsgClearAppCache() {
  var jobs = [];
  if ('serviceWorker' in navigator) {
    jobs.push(navigator.serviceWorker.getRegistrations().then(function(regs) {
      return Promise.all(regs.map(function(r) { return r.unregister(); }));
    }));
  }
  if (window.caches) {
    jobs.push(caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(k) { return caches.delete(k); }));
    }));
  }
  return Promise.all(jobs).catch(function() {});
}

/* Donnée illisible détectée par lsGet */
function tsgOnCorruptData(key) {
  console.error('[TSG] Donnée illisible mise de côté :', key);
  setTimeout(function() {
    tsgErrorBanner('Une partie de tes données était illisible.',
      'Elle a été mise de côté. Tu peux restaurer une sauvegarde automatique dans Paramètres → Sauvegardes.');
  }, 400);
}

/* Écriture impossible (souvent : stockage plein) */
var _tsgStorageWarned = false;
function tsgOnStorageFailure(key, quota) {
  console.error('[TSG] Écriture impossible :', key, quota ? '(stockage plein)' : '');
  if (_tsgStorageWarned) return;
  _tsgStorageWarned = true;
  tsgErrorBanner(quota ? 'Le stockage de l\'appareil est plein.' : 'Une sauvegarde n\'a pas pu être écrite.',
    quota ? 'Tes dernières modifications risquent de ne pas être gardées. Exporte tes données depuis les Paramètres.'
          : 'Réessaie ; si ça persiste, exporte tes données depuis les Paramètres.');
}

/* ─────────── 2. SAUVEGARDES AUTOMATIQUES (IndexedDB) ─────────── */

var TSG_BK_DB = 'tsg-backups';
var TSG_BK_STORE = 'snapshots';
var TSG_BK_KEEP = 10;
var TSG_BK_MIN_INTERVAL = 6 * 3600 * 1000;   // au plus une sauvegarde auto toutes les 6 h

function tsgBkOpen() {
  return new Promise(function(resolve, reject) {
    if (!window.indexedDB) { reject(new Error('IndexedDB indisponible')); return; }
    var req = indexedDB.open(TSG_BK_DB, 1);
    req.onupgradeneeded = function() {
      var db = req.result;
      if (!db.objectStoreNames.contains(TSG_BK_STORE)) db.createObjectStore(TSG_BK_STORE, { keyPath: 'id' });
    };
    req.onsuccess = function() { resolve(req.result); };
    req.onerror = function() { reject(req.error); };
  });
}

/* Toutes les données de l'app… sauf le jeton de connexion (jamais copié) et les copies de secours */
function tsgBkCollect() {
  var data = {};
  for (var i = 0; i < localStorage.length; i++) {
    var k = localStorage.key(i);
    if (!k || k.indexOf('tsg_') !== 0) continue;
    if (k === 'tsg_sb_auth' || k.indexOf('tsg_corrupt_') === 0) continue;
    data[k] = localStorage.getItem(k);
  }
  return data;
}

function tsgBkCountRounds(data) {
  try { var r = JSON.parse(data['tsg_rounds'] || '[]'); return Array.isArray(r) ? r.length : 0; }
  catch (e) { return 0; }
}

function tsgBackupNow(reason) {
  return tsgBkOpen().then(function(db) {
    return new Promise(function(resolve, reject) {
      var data = tsgBkCollect();
      var size = 0;
      Object.keys(data).forEach(function(k) { size += (data[k] || '').length; });
      var snap = {
        id: Date.now(),
        date: new Date().toISOString(),
        reason: reason || 'auto',
        rounds: tsgBkCountRounds(data),
        size: size,
        data: data
      };
      var tx = db.transaction(TSG_BK_STORE, 'readwrite');
      tx.objectStore(TSG_BK_STORE).put(snap);
      tx.oncomplete = function() { tsgBkPrune(db).then(function() { resolve(snap); }); };
      tx.onerror = function() { reject(tx.error); };
    });
  });
}

/* On garde les 10 plus récentes */
function tsgBkPrune(db) {
  return new Promise(function(resolve) {
    var tx = db.transaction(TSG_BK_STORE, 'readwrite');
    var store = tx.objectStore(TSG_BK_STORE);
    var req = store.getAllKeys();
    req.onsuccess = function() {
      var keys = (req.result || []).sort(function(a, b) { return b - a; });
      keys.slice(TSG_BK_KEEP).forEach(function(k) { store.delete(k); });
    };
    tx.oncomplete = function() { resolve(); };
    tx.onerror = function() { resolve(); };
  });
}

/* Liste (sans le contenu, plus léger), du plus récent au plus ancien */
function tsgListBackups() {
  return tsgBkOpen().then(function(db) {
    return new Promise(function(resolve) {
      var req = db.transaction(TSG_BK_STORE, 'readonly').objectStore(TSG_BK_STORE).getAll();
      req.onsuccess = function() {
        var list = (req.result || []).map(function(s) {
          return { id: s.id, date: s.date, reason: s.reason, rounds: s.rounds, size: s.size };
        }).sort(function(a, b) { return b.id - a.id; });
        resolve(list);
      };
      req.onerror = function() { resolve([]); };
    });
  }).catch(function() { return []; });
}

/* Restaure un instantané. L'état actuel est d'abord sauvegardé : l'opération est réversible. */
function tsgRestoreBackup(id) {
  return tsgBackupNow('avant-restauration').catch(function() {}).then(function() {
    return tsgBkOpen();
  }).then(function(db) {
    return new Promise(function(resolve, reject) {
      var req = db.transaction(TSG_BK_STORE, 'readonly').objectStore(TSG_BK_STORE).get(id);
      req.onsuccess = function() {
        var snap = req.result;
        if (!snap || !snap.data) { reject(new Error('Sauvegarde introuvable')); return; }
        // Retirer les données actuelles de l'app (sauf connexion), puis réécrire l'instantané
        var toRemove = [];
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && k.indexOf('tsg_') === 0 && k !== 'tsg_sb_auth' && k.indexOf('tsg_corrupt_') !== 0) toRemove.push(k);
        }
        toRemove.forEach(function(k) { localStorage.removeItem(k); });
        Object.keys(snap.data).forEach(function(k) {
          try { localStorage.setItem(k, snap.data[k]); } catch (e) {}
        });
        resolve(snap);
      };
      req.onerror = function() { reject(req.error); };
    });
  });
}

/* Sauvegarde automatique : au lancement si la dernière a plus de 6 h,
   et après chaque partie enregistrée (le nombre de parties a changé). */
function tsgAutoBackup(force) {
  return tsgListBackups().then(function(list) {
    var last = list[0];
    var roundsNow = tsgBkCountRounds(tsgBkCollect());
    var stale = !last || (Date.now() - last.id) > TSG_BK_MIN_INTERVAL;
    var changed = last && last.rounds !== roundsNow;
    if (force || stale || changed) {
      return tsgBackupNow(force ? 'partie' : 'auto');
    }
    return null;
  }).catch(function(e) { console.warn('[TSG] sauvegarde auto :', e && e.message); return null; });
}

/* ─────────── 3. PANNEAU « SAUVEGARDES » DES PARAMÈTRES ─────────── */

function tsgRenderBackupSection(host) {
  if (!host) return;
  host.innerHTML = '<div class="bk-loading">Chargement…</div>';
  tsgListBackups().then(function(list) {
    var cloud = (typeof cloudActive === 'function' && cloudActive());
    var head = '<div class="bk-info">'
      + (cloud ? '☁️ Ton compte est synchronisé : tes parties sont aussi sauvegardées en ligne.<br>' : '')
      + 'Un instantané de toutes tes données est pris automatiquement sur cet appareil '
      + '(au lancement et après chaque partie). Les 10 plus récents sont gardés.</div>';

    var rows = list.length ? list.map(function(b) {
      var why = { auto: 'Automatique', partie: 'Après une partie', manuel: 'Manuelle', 'avant-restauration': 'Avant restauration' }[b.reason] || b.reason;
      return '<div class="bk-row">'
        + '<div class="bk-row-info"><div class="bk-row-date">' + tsgEsc(tsgFmtDate(b.date)) + '</div>'
        + '<div class="bk-row-meta">' + tsgEsc(why) + ' · ' + b.rounds + ' partie' + (b.rounds > 1 ? 's' : '')
        + ' · ' + Math.max(1, Math.round(b.size / 1024)) + ' ko</div></div>'
        + '<button class="settings-btn settings-btn-secondary bk-restore" data-id="' + b.id + '">Restaurer</button>'
        + '</div>';
    }).join('') : '<div class="bk-empty">Aucune sauvegarde pour l\'instant.</div>';

    host.innerHTML = head + '<div class="bk-list">' + rows + '</div>'
      + '<button class="settings-btn settings-btn-primary bk-now" id="bk-now">Sauvegarder maintenant</button>';

    var nowBtn = document.getElementById('bk-now');
    if (nowBtn) nowBtn.addEventListener('click', function() {
      nowBtn.disabled = true;
      tsgBackupNow('manuel').then(function() {
        if (typeof showToast === 'function') showToast('Sauvegarde créée ✓');
        tsgRenderBackupSection(host);
      }, function(e) {
        nowBtn.disabled = false;
        if (typeof showToast === 'function') showToast('Sauvegarde impossible : ' + (e && e.message));
      });
    });

    host.querySelectorAll('.bk-restore').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = Number(btn.getAttribute('data-id'));
        var b = list.filter(function(x) { return x.id === id; })[0];
        if (!b) return;
        if (!confirm('Restaurer la sauvegarde du ' + tsgFmtDate(b.date) + ' (' + b.rounds + ' parties) ?\n\n'
          + 'Ton état actuel sera d\'abord sauvegardé : tu pourras revenir en arrière.')) return;
        tsgRestoreBackup(id).then(function() {
          if (typeof showToast === 'function') showToast('Sauvegarde restaurée ✓ Rechargement…');
          setTimeout(function() { location.reload(); }, 900);
        }, function(e) {
          if (typeof showToast === 'function') showToast('Restauration impossible : ' + (e && e.message));
        });
      });
    });
  });
}

function tsgFmtDate(iso) {
  try {
    return new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch (e) { return iso; }
}

function tsgEsc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
