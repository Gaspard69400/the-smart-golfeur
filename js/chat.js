/* ════════════════════════════════════════════
 * THE SMART GOLFER — chat.js
 * Messagerie — panneau de discussion partagé.
 * channelType = 'group' (params {group_id}) ou 'coach' (params {coach_id, player_id}).
 * Rafraîchissement par polling léger (toutes ~4,5s), auto-nettoyé quand le panneau disparaît.
 * Nécessite un compte cloud.
 * ════════════════════════════════════════════ */

function chatRenderPanel(host, channelType, params, title) {
  if (!host || !window.sbClient || !currentUser) return;

  var panel = document.createElement('div');
  panel.className = 'panel chat-panel';
  panel.innerHTML = '<div class="panel-header"><div class="panel-title">💬 ' + chatEsc(title || 'Messages') + '</div></div>';
  var msgs = document.createElement('div');
  msgs.className = 'chat-msgs';
  msgs.innerHTML = '<div class="ch-loading">…</div>';
  var form = document.createElement('div');
  form.className = 'chat-form';
  form.innerHTML = '<input type="text" class="chat-input" placeholder="Écris un message…" maxlength="500" autocomplete="off">'
    + '<button class="dash-btn dash-btn-gold chat-send">Envoyer</button>';
  panel.appendChild(msgs);
  panel.appendChild(form);
  host.appendChild(panel);

  var input = form.querySelector('.chat-input');
  var sendBtn = form.querySelector('.chat-send');
  var lastCount = -1;

  function load(force) {
    var q = window.sbClient.from('messages').select('*').eq('channel_type', channelType);
    Object.keys(params).forEach(function(k) { q = q.eq(k, params[k]); });
    q.order('created_at', { ascending: true }).limit(80).then(function(res) {
      var list = res.data || [];
      if (!force && list.length === lastCount) return;
      var atBottom = (msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight) < 40;
      var senderIds = {}; list.forEach(function(m) { senderIds[m.sender_id] = 1; });
      var ids = Object.keys(senderIds);
      if (!ids.length) { chatRenderMsgs(msgs, [], {}); lastCount = 0; return; }
      window.sbClient.from('profiles').select('id, name, initials, color, bg').in('id', ids).then(function(pf) {
        var byId = {}; (pf.data || []).forEach(function(p) { byId[p.id] = p; });
        chatRenderMsgs(msgs, list, byId);
        if (force || atBottom) msgs.scrollTop = msgs.scrollHeight;
        lastCount = list.length;
      });
    });
  }

  function send() {
    var txt = (input.value || '').trim();
    if (!txt) return;
    var row = { channel_type: channelType, sender_id: currentUser.id, body: txt };
    Object.keys(params).forEach(function(k) { row[k] = params[k]; });
    input.value = ''; sendBtn.disabled = true;
    window.sbClient.from('messages').insert(row).then(function(res) {
      sendBtn.disabled = false;
      if (res.error) { showToast('Erreur : ' + res.error.message); return; }
      load(true);
    });
  }
  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', function(e) { if (e.key === 'Enter') send(); });

  load(true);

  var pollId = setInterval(function() {
    if (!document.body.contains(panel)) { clearInterval(pollId); return; }
    if (panel.offsetParent === null) return; // page masquée : on ne sollicite pas le réseau
    load(false);
  }, 4500);
}

function chatRenderMsgs(container, list, byId) {
  var me = currentUser.id;
  if (!list.length) { container.innerHTML = '<div class="chat-empty">Aucun message. Lance la discussion ! 👋</div>'; return; }
  container.innerHTML = list.map(function(m) {
    var mine = m.sender_id === me;
    var pr = byId[m.sender_id] || {};
    var t = '';
    try { t = new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); } catch (e) {}
    return '<div class="chat-row ' + (mine ? 'me' : 'other') + '">'
      + (mine ? '' : '<div class="chat-name">' + chatEsc(pr.name || 'Joueur') + '</div>')
      + '<div class="chat-bubble">' + chatEsc(m.body) + '<span class="chat-time">' + t + '</span></div>'
      + '</div>';
  }).join('');
}

function chatEsc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
