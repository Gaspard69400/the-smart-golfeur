/* ════════════════════════════════════════════
 * THE SMART GOLFER — auth.js
 * Authentification Supabase (email + mot de passe) + synchro cloud.
 * Mode démo local conservé en repli.
 * Dépend de : supabaseClient.js, app.js (currentUser, lsGet/lsSet, launchApp, showToast)
 * ════════════════════════════════════════════ */

var _authMode = 'login';        // 'login' | 'signup'
window.tsgCloud = false;        // true quand connecté via Supabase

function cloudActive() { return window.tsgCloud && window.sbClient; }
function sbUserId() {
  try { return window._sbSession && window._sbSession.user ? window._sbSession.user.id : null; }
  catch (e) { return null; }
}

/* ─────────────── UI AUTH ─────────────── */

function initAuthUI() {
  var tabLogin  = document.getElementById('auth-tab-login');
  var tabSignup = document.getElementById('auth-tab-signup');
  var submit    = document.getElementById('auth-submit');
  var guestTog  = document.getElementById('auth-guest-toggle');
  if (!submit) return;

  function setMode(m) {
    _authMode = m;
    if (tabLogin)  tabLogin.classList.toggle('on', m === 'login');
    if (tabSignup) tabSignup.classList.toggle('on', m === 'signup');
    document.querySelectorAll('.auth-signup-only').forEach(function(el) {
      el.style.display = (m === 'signup') ? '' : 'none';
    });
    submit.textContent = (m === 'signup') ? 'Créer mon compte →' : 'Se connecter →';
    authError('');
  }
  if (tabLogin)  tabLogin.addEventListener('click', function() { setMode('login'); });
  if (tabSignup) tabSignup.addEventListener('click', function() { setMode('signup'); });

  submit.addEventListener('click', function() { authSubmit(); });
  ['auth-email', 'auth-password'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('keydown', function(e) { if (e.key === 'Enter') authSubmit(); });
  });

  if (guestTog) guestTog.addEventListener('click', function() {
    var g = document.getElementById('guest-section');
    if (g) {
      var show = g.style.display === 'none' || !g.style.display;
      g.style.display = show ? 'block' : 'none';
      guestTog.textContent = show ? 'Masquer le mode démo' : 'Essayer en mode démo (sans compte)';
      if (show && typeof buildProfiles === 'function') buildProfiles();
    }
  });

  if (!window.sbClient) {
    // Supabase indisponible → basculer directement en mode démo
    var authBox = document.getElementById('auth-box');
    if (authBox) authBox.style.display = 'none';
    var g2 = document.getElementById('guest-section');
    if (g2) { g2.style.display = 'block'; if (typeof buildProfiles === 'function') buildProfiles(); }
  }

  setMode('login');
}

function authError(msg) {
  var box = document.getElementById('auth-error');
  if (!box) return;
  if (!msg) { box.style.display = 'none'; box.textContent = ''; return; }
  box.style.display = 'block';
  box.textContent = msg;
}

function authBusy(on) {
  var submit = document.getElementById('auth-submit');
  if (submit) { submit.disabled = on; submit.style.opacity = on ? '0.6' : '1'; }
}

function authSubmit() {
  var email = (document.getElementById('auth-email') || {}).value || '';
  var pass  = (document.getElementById('auth-password') || {}).value || '';
  email = email.trim();
  if (!email || !pass) { authError('Renseigne ton email et ton mot de passe.'); return; }
  if (_authMode === 'signup' && pass.length < 6) { authError('Le mot de passe doit faire au moins 6 caractères.'); return; }

  if (_authMode === 'signup') doSignup(email, pass);
  else doSignIn(email, pass);
}

function doSignup(email, pass) {
  if (!window.sbClient) { authError('Service indisponible.'); return; }
  var name = (document.getElementById('auth-name') || {}).value || '';
  var hcp  = (document.getElementById('auth-hcp') || {}).value || '';
  var role = (document.getElementById('auth-role') || {}).value || 'player';
  name = name.trim();
  var initials = name ? name.split(/\s+/).map(function(w){return w[0];}).join('').slice(0,2).toUpperCase() : email.slice(0,2).toUpperCase();

  authBusy(true); authError('');
  window.sbClient.auth.signUp({
    email: email, password: pass,
    options: { data: { name: name || email.split('@')[0], hcp: hcp, role: role, initials: initials,
      color: '#C9A84C', bg: 'rgba(201,168,76,0.2)' } }
  }).then(function(res) {
    authBusy(false);
    if (res.error) { authError(traduireErreur(res.error.message)); return; }
    if (res.data && res.data.session) {
      onAuthenticated(res.data.session);
    } else {
      // Confirmation email activée : pas de session immédiate
      authError('Compte créé ! Vérifie ta boîte mail pour confirmer, puis connecte-toi.');
      _authMode = 'login';
    }
  }, function(err) { authBusy(false); authError('Erreur : ' + err.message); });
}

function doSignIn(email, pass) {
  if (!window.sbClient) { authError('Service indisponible.'); return; }
  authBusy(true); authError('');
  window.sbClient.auth.signInWithPassword({ email: email, password: pass })
    .then(function(res) {
      authBusy(false);
      if (res.error) { authError(traduireErreur(res.error.message)); return; }
      if (res.data && res.data.session) onAuthenticated(res.data.session);
    }, function(err) { authBusy(false); authError('Erreur : ' + err.message); });
}

function traduireErreur(msg) {
  msg = (msg || '').toLowerCase();
  if (msg.indexOf('invalid login') !== -1) return 'Email ou mot de passe incorrect.';
  if (msg.indexOf('already registered') !== -1 || msg.indexOf('already exists') !== -1) return 'Un compte existe déjà avec cet email. Connecte-toi.';
  if (msg.indexOf('email not confirmed') !== -1) return 'Email pas encore confirmé. Vérifie ta boîte mail.';
  if (msg.indexOf('password') !== -1) return 'Mot de passe trop court (min. 6 caractères).';
  return msg || 'Une erreur est survenue.';
}

/* ─────────────── SESSION ─────────────── */

/* Appelé au démarrage (boot) : reprend la session si elle existe */
function authBootstrap(onDone) {
  if (!window.sbClient) { onDone(false); return; }
  window.sbClient.auth.getSession().then(function(res) {
    var session = res && res.data ? res.data.session : null;
    if (session) { onAuthenticated(session, true); onDone(true); }
    else onDone(false);
  }, function() { onDone(false); });
}

/* Une fois authentifié : charger le profil + les données puis lancer l'app */
function onAuthenticated(session, silent) {
  window._sbSession = session;
  window.tsgCloud = true;
  var uid = session.user.id;

  loadCloudProfile(uid).then(function(profile) {
    currentUser = profile;
    selectedProfile = profile;
    lsSet('lastUser', profile.id);
    return syncPullAll(uid);
  }).then(function() {
    // Cacher le login, lancer l'app
    launchApp();
    if (!silent) showToast('Connecté ☁ — tes données sont synchronisées');
  }).catch(function(e) {
    console.warn('[TSG] onAuthenticated:', e.message);
    // En cas d'échec de chargement, lancer quand même avec un profil minimal
    if (!currentUser) {
      currentUser = { id: uid, name: (session.user.email || 'Golfeur'), hcp: null, role: 'player',
        color: '#C9A84C', bg: 'rgba(201,168,76,0.2)', initials: (session.user.email || 'G').slice(0,2).toUpperCase() };
    }
    launchApp();
  });
}

function loadCloudProfile(uid) {
  return window.sbClient.from('profiles').select('*').eq('id', uid).single()
    .then(function(res) {
      if (res.error || !res.data) {
        return { id: uid, name: 'Golfeur', hcp: null, role: 'player',
          color: '#C9A84C', bg: 'rgba(201,168,76,0.2)', initials: 'G' };
      }
      var p = res.data;
      return { id: p.id, name: p.name || 'Golfeur', hcp: (p.hcp !== null ? Number(p.hcp) : null),
        role: p.role || 'player', color: p.color || '#C9A84C',
        bg: p.bg || 'rgba(201,168,76,0.2)', initials: p.initials || (p.name ? p.name.slice(0,2).toUpperCase() : 'G') };
    });
}

/* Déconnexion cloud */
function authSignOut() {
  if (window.sbClient && window.tsgCloud) {
    try { window.sbClient.auth.signOut(); } catch (e) {}
  }
  window.tsgCloud = false;
  window._sbSession = null;
  // Vider le cache local des données (elles restent dans le cloud)
  ['rounds', 'objectives', 'trainings', 'training_done'].forEach(function(k) {
    try { localStorage.removeItem('tsg_' + k); } catch (e) {}
  });
  try { localStorage.removeItem('tsg_user_courses'); } catch (e) {}
}

/* ─────────────── SYNCHRO CLOUD ─────────────── */

/* Tirer toutes les données de l'utilisateur depuis le cloud vers le cache local */
function syncPullAll(uid) {
  if (!cloudActive()) return Promise.resolve();
  var sb = window.sbClient;
  return Promise.all([
    sb.from('rounds').select('*').eq('user_id', uid).order('played_on', { ascending: false }),
    sb.from('objectives').select('*').eq('user_id', uid).maybeSingle(),
    sb.from('trainings').select('*').order('created_at', { ascending: false }),
    sb.from('training_done').select('*').eq('user_id', uid),
    sb.from('user_courses').select('*').eq('user_id', uid)
  ]).then(function(r) {
    // Rounds
    var rounds = (r[0].data || []).map(dbToRound);
    lsSet('rounds', rounds);
    // Objectives
    if (r[1].data) {
      var o = r[1].data;
      var allObj = lsGet('objectives') || {};
      allObj[uid] = { score: num(o.score), hcp: num(o.hcp), gir: num(o.gir), fir: num(o.fir), putts: num(o.putts) };
      lsSet('objectives', allObj);
    }
    // Trainings
    var trainings = (r[2].data || []).map(dbToTraining);
    lsSet('trainings', trainings);
    // Training done
    var doneMap = lsGet('training_done') || {};
    doneMap[uid] = {};
    (r[3].data || []).forEach(function(d) {
      doneMap[uid][d.training_id] = { count: d.count, last: d.last_done };
    });
    lsSet('training_done', doneMap);
    // User courses
    var courses = (r[4].data || []).map(function(row) { return row.data; });
    localStorage.setItem('tsg_user_courses', JSON.stringify(courses));
  }).catch(function(e) { console.warn('[TSG] syncPullAll:', e.message); });
}

function num(v) { return (v === null || v === undefined) ? null : Number(v); }

function dbToRound(row) {
  return { id: row.id, date: row.played_on, course: row.course, courseId: row.course_id,
    score: row.score, par: row.par, diff: num(row.diff), fir: row.fir, firTotal: row.fir_total,
    gir: row.gir, putts: row.putts, cond: row.cond, format: row.format, hcp: num(row.hcp),
    notes: row.notes, scores: row.scores, sg_tee: num(row.sg_tee), sg_app: num(row.sg_app),
    sg_arg: num(row.sg_arg), sg_putt: num(row.sg_putt) };
}
function roundToDb(r, uid) {
  return { id: r.id, user_id: uid, played_on: r.date || null, course: r.course || null,
    course_id: r.courseId || null, score: r.score, par: r.par, diff: r.diff, fir: r.fir,
    fir_total: r.firTotal, gir: r.gir, putts: r.putts, cond: r.cond || null, format: r.format || null,
    hcp: r.hcp, notes: r.notes || '', scores: r.scores || null,
    sg_tee: r.sg_tee, sg_app: r.sg_app, sg_arg: r.sg_arg, sg_putt: r.sg_putt };
}
function dbToTraining(row) {
  return { id: row.id, type: row.type, title: row.title, category: row.category, level: row.level,
    duration: row.duration, objective: row.objective, description: row.description,
    createdBy: { id: row.created_by, name: row.author_name }, createdAt: row.created_at };
}

/* Poussées (fire-and-forget, protégées) */
window.tsgSync = {
  pushRound: function(r) {
    if (!cloudActive()) return;
    window.sbClient.from('rounds').upsert(roundToDb(r, sbUserId())).then(null, logSync('pushRound'));
  },
  deleteRound: function(id) {
    if (!cloudActive()) return;
    window.sbClient.from('rounds').delete().eq('id', id).eq('user_id', sbUserId()).then(null, logSync('deleteRound'));
  },
  pushObjectives: function(o) {
    if (!cloudActive()) return;
    window.sbClient.from('objectives').upsert({ user_id: sbUserId(), score: o.score, hcp: o.hcp,
      gir: o.gir, fir: o.fir, putts: o.putts, updated_at: new Date().toISOString() }).then(null, logSync('pushObjectives'));
  },
  pushTraining: function(t) {
    if (!cloudActive()) return;
    window.sbClient.from('trainings').upsert({ id: t.id, created_by: sbUserId(),
      author_name: (t.createdBy && t.createdBy.name) || (currentUser && currentUser.name) || 'Coach',
      type: t.type, title: t.title, category: t.category, level: t.level, duration: t.duration,
      objective: t.objective, description: t.description }).then(null, logSync('pushTraining'));
  },
  deleteTraining: function(id) {
    if (!cloudActive()) return;
    window.sbClient.from('trainings').delete().eq('id', id).eq('created_by', sbUserId()).then(null, logSync('deleteTraining'));
  },
  pushTrainingDone: function(trainingId, entry) {
    if (!cloudActive()) return;
    window.sbClient.from('training_done').upsert({ user_id: sbUserId(), training_id: trainingId,
      count: entry.count, last_done: entry.last }).then(null, logSync('pushTrainingDone'));
  },
  pushUserCourse: function(course) {
    if (!cloudActive()) return;
    window.sbClient.from('user_courses').upsert({ id: course.id, user_id: sbUserId(), data: course }).then(null, logSync('pushUserCourse'));
  },
  deleteUserCourse: function(id) {
    if (!cloudActive()) return;
    window.sbClient.from('user_courses').delete().eq('id', id).eq('user_id', sbUserId()).then(null, logSync('deleteUserCourse'));
  }
};

function logSync(where) {
  return function(err) { if (err) console.warn('[TSG] sync ' + where + ':', err.message || err); };
}
