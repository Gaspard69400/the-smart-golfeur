/* ════════════════════════════════════════════
 * THE SMART GOLFER — calendar.js
 * Calendrier des tournois — panneau partagé (Coach Hub + Groupes).
 * scope = 'coach' (scope_id = id du coach) ou 'group' (scope_id = id du groupe).
 * canCreate : le coach (scope coach) ou tout membre (scope group) peut créer.
 * Chacun indique s'il joue (participation).
 * Nécessite un compte cloud.
 * ════════════════════════════════════════════ */

function calendarRenderPanel(host, scope, scopeId, canCreate) {
  if (!host || !window.sbClient || !scopeId) return;
  var panel = document.createElement('div');
  panel.className = 'panel cal-panel';
  panel.innerHTML = '<div class="panel-header"><div class="panel-title">📅 Tournois</div></div>';
  if (canCreate) {
    var addBtn = document.createElement('button');
    addBtn.className = 'dash-btn dash-btn-gold cal-add-btn';
    addBtn.textContent = '+ Ajouter';
    panel.querySelector('.panel-header').appendChild(addBtn);
    addBtn.addEventListener('click', function() {
      calOpenCreate(scope, scopeId, function() { calLoadEvents(body, scope, scopeId, canCreate); });
    });
  }
  var body = document.createElement('div');
  body.className = 'panel-body';
  body.innerHTML = '<div class="ch-loading">…</div>';
  panel.appendChild(body);
  host.appendChild(panel);

  calLoadEvents(body, scope, scopeId, canCreate);
}

function calLoadEvents(body, scope, scopeId, canCreate) {
  var sb = window.sbClient;
  sb.from('events').select('*').eq('scope', scope).eq('scope_id', scopeId)
    .order('event_date', { ascending: true }).then(function(res) {
    var events = (res.data || []);
    if (res.error) { body.innerHTML = '<div class="ch-empty-inline">Erreur : ' + res.error.message + '</div>'; return; }
    if (!events.length) {
      body.innerHTML = '<div class="ch-empty-inline">Aucun tournoi prévu' + (canCreate ? ' — ajoute le premier !' : '.') + '</div>';
      return;
    }
    var ids = events.map(function(e) { return e.id; });
    sb.from('event_participants').select('*').in('event_id', ids).then(function(pr) {
      var parts = pr.data || [];
      var uids = {};
      parts.forEach(function(p) { uids[p.user_id] = 1; });
      var uidList = Object.keys(uids);
      if (!uidList.length) { calRenderEvents(body, scope, scopeId, canCreate, events, parts, {}); return; }
      sb.from('profiles').select('id, name, initials, color, bg').in('id', uidList).then(function(pf) {
        var byId = {}; (pf.data || []).forEach(function(p) { byId[p.id] = p; });
        calRenderEvents(body, scope, scopeId, canCreate, events, parts, byId);
      });
    });
  });
}

function calRenderEvents(body, scope, scopeId, canCreate, events, parts, profById) {
  var me = currentUser.id;
  body.innerHTML = '';
  var list = document.createElement('div');
  list.className = 'cal-list';

  events.forEach(function(ev) {
    var evParts = parts.filter(function(p) { return p.event_id === ev.id; });
    var going = evParts.filter(function(p) { return p.status === 'in'; });
    var mine = evParts.filter(function(p) { return p.user_id === me; })[0];
    var myStatus = mine ? mine.status : null;

    var card = document.createElement('div');
    card.className = 'cal-event';

    var d = ev.event_date ? new Date(ev.event_date + 'T00:00:00') : null;
    var dateStr = d ? d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Date à définir';

    var avatars = going.slice(0, 6).map(function(p) {
      var pr = profById[p.user_id] || {};
      var ini = pr.initials || (pr.name ? pr.name.slice(0, 2).toUpperCase() : '?');
      return '<div class="cal-av" style="background:' + (pr.bg || 'var(--gold-dim)') + ';color:' + (pr.color || 'var(--gold-d)') + '" title="' + calEsc(pr.name || '') + '">' + calEsc(ini) + '</div>';
    }).join('');

    card.innerHTML =
      '<div class="cal-ev-head">'
      +   '<div class="cal-date"><div class="cal-date-d">' + (d ? d.getDate() : '–') + '</div><div class="cal-date-m">' + (d ? d.toLocaleDateString('fr-FR', { month: 'short' }) : '') + '</div></div>'
      +   '<div class="cal-ev-info"><div class="cal-ev-title">' + calEsc(ev.title) + '</div>'
      +     '<div class="cal-ev-sub">' + dateStr + (ev.course ? ' · ' + calEsc(ev.course) : '') + '</div>'
      +     (ev.notes ? '<div class="cal-ev-notes">' + calEsc(ev.notes) + '</div>' : '') + '</div>'
      + '</div>'
      + '<div class="cal-part"><div class="cal-avs">' + avatars + '</div>'
      +   '<div class="cal-part-txt">' + going.length + ' participant' + (going.length > 1 ? 's' : '') + '</div></div>'
      + '<div class="cal-actions">'
      +   '<button class="cal-rsvp cal-in' + (myStatus === 'in' ? ' on' : '') + '" data-s="in">✓ Je joue</button>'
      +   '<button class="cal-rsvp cal-out' + (myStatus === 'out' ? ' on' : '') + '" data-s="out">Absent</button>'
      +   (ev.created_by === me ? '<button class="cal-del" title="Supprimer">×</button>' : '')
      + '</div>';

    card.querySelectorAll('.cal-rsvp').forEach(function(btn) {
      btn.addEventListener('click', function() {
        calSetStatus(ev.id, btn.getAttribute('data-s'), function() { calLoadEvents(body, scope, scopeId, canCreate); });
      });
    });
    var del = card.querySelector('.cal-del');
    if (del) del.addEventListener('click', function() {
      if (!confirm('Supprimer « ' + ev.title + ' » ?')) return;
      window.sbClient.from('events').delete().eq('id', ev.id).then(function() {
        showToast('Tournoi supprimé'); calLoadEvents(body, scope, scopeId, canCreate);
      });
    });

    list.appendChild(card);
  });

  body.appendChild(list);
}

function calSetStatus(eventId, status, cb) {
  window.sbClient.from('event_participants').upsert({
    event_id: eventId, user_id: currentUser.id, status: status, updated_at: new Date().toISOString()
  }).then(function(res) {
    if (res.error) { showToast('Erreur : ' + res.error.message); return; }
    showToast(status === 'in' ? 'Tu participes ✓' : 'Marqué absent');
    if (cb) cb();
  });
}

function calOpenCreate(scope, scopeId, cb) {
  var ex = document.getElementById('cal-create-modal');
  if (ex) ex.remove();
  var modal = document.createElement('div');
  modal.id = 'cal-create-modal';
  modal.className = 'trn-modal';
  modal.innerHTML = '<div class="trn-modal-card" style="max-width:440px">'
    + '<div class="trn-modal-head"><div><div class="trn-modal-tag">Nouveau</div>'
    +   '<div class="trn-modal-title">Ajouter un tournoi</div></div>'
    +   '<button class="trn-modal-close" id="cal-cr-close">×</button></div>'
    + '<div class="trn-modal-body">'
    +   '<div class="obj-field"><label class="obj-label">Nom du tournoi *</label>'
    +     '<input type="text" class="obj-input" id="cal-title" placeholder="Ex : Coupe du club" maxlength="60"></div>'
    +   '<div class="trn-form-grid"><div class="obj-field"><label class="obj-label">Date</label>'
    +     '<input type="date" class="obj-input" id="cal-date"></div>'
    +   '<div class="obj-field"><label class="obj-label">Parcours</label>'
    +     '<input type="text" class="obj-input" id="cal-course" placeholder="Ex : Golf de Lyon"></div></div>'
    +   '<div class="obj-field"><label class="obj-label">Note (option.)</label>'
    +     '<input type="text" class="obj-input" id="cal-notes" placeholder="Ex : départ 9h, stableford"></div>'
    +   '<div class="ch-join-error" id="cal-cr-error" style="display:none"></div>'
    + '</div>'
    + '<div class="trn-modal-actions">'
    +   '<button class="dash-btn dash-btn-outline" id="cal-cr-cancel">Annuler</button>'
    +   '<button class="dash-btn dash-btn-gold" id="cal-cr-save">Créer</button>'
    + '</div></div>';
  document.body.appendChild(modal);
  function close() { modal.remove(); }
  document.getElementById('cal-cr-close').addEventListener('click', close);
  document.getElementById('cal-cr-cancel').addEventListener('click', close);
  modal.addEventListener('click', function(e) { if (e.target === modal) close(); });

  document.getElementById('cal-cr-save').addEventListener('click', function() {
    var title = (document.getElementById('cal-title').value || '').trim();
    var err = document.getElementById('cal-cr-error');
    if (!title) { err.style.display = 'block'; err.textContent = 'Donne un nom au tournoi.'; return; }
    var row = {
      title: title,
      event_date: document.getElementById('cal-date').value || null,
      course: (document.getElementById('cal-course').value || '').trim() || null,
      notes: (document.getElementById('cal-notes').value || '').trim() || null,
      scope: scope, scope_id: scopeId, created_by: currentUser.id
    };
    window.sbClient.from('events').insert(row).then(function(res) {
      if (res.error) { err.style.display = 'block'; err.textContent = res.error.message; return; }
      // Le créateur participe par défaut
      showToast('Tournoi créé ✓');
      close();
      if (cb) cb();
    });
  });
}

function calEsc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
