/* ════════════════════════════════════════════
 * THE SMART GOLFER — social.js
 * KUDOS PARTAGÉS + COMMENTAIRES sous les parties du fil d'activité.
 *
 * Avant : le 👏 était enregistré sur MON téléphone seulement — l'ami
 * applaudi n'en savait rien, et le compteur ne bougeait jamais chez lui.
 * Maintenant (tables round_kudos / round_comments, backend/maj_septembre_2026.sql) :
 * chacun voit qui a applaudi et peut répondre sous la carte.
 *
 * Tant que le SQL n'est pas exécuté : repli automatique sur les kudos
 * locaux d'avant, et pas de bouton commentaire (rien de cassé).
 *
 * Qui voit quoi (RLS) : les réactions d'une partie sont visibles de ceux
 * qui voient la partie — son auteur et les membres de ses groupes.
 *
 * Dépend de : community.js (commEsc, commRelDate, commWireKudos), app.js.
 * ════════════════════════════════════════════ */

var SOC_MAX_LEN = 500;
var _soc = { kudos: {}, comments: {}, profiles: {}, uid: null };

/* Appelé par le fil d'activité (mode cloud) une fois les cartes affichées */
function socEnhance(host, roundIds, profilesById) {
  var sb = window.sbClient;
  _soc.uid = currentUser && currentUser.id;
  _soc.profiles = profilesById || {};
  if (!sb || !roundIds.length) { commWireKudos(host); return; }

  Promise.all([
    sb.from('round_kudos').select('round_id, user_id').in('round_id', roundIds),
    sb.from('round_comments').select('id, round_id, user_id, body, created_at').in('round_id', roundIds)
      .order('created_at', { ascending: true })
  ]).then(function(res) {
    if (res[0].error || res[1].error) {       // tables pas encore créées : comportement d'avant
      commWireKudos(host);
      return;
    }
    _soc.kudos = {}; _soc.comments = {};
    (res[0].data || []).forEach(function(k) { (_soc.kudos[k.round_id] = _soc.kudos[k.round_id] || []).push(k.user_id); });
    (res[1].data || []).forEach(function(c) { (_soc.comments[c.round_id] = _soc.comments[c.round_id] || []).push(c); });
    host.querySelectorAll('.comm-card[data-rid]').forEach(function(card) { socWireCard(card); });
  }, function() { commWireKudos(host); });
}

function socName(uid) {
  if (uid === _soc.uid) return 'Toi';
  var p = _soc.profiles[uid];
  return (p && p.name) ? p.name.split(' ')[0] : 'Un membre';
}

function socWireCard(card) {
  var rid = card.getAttribute('data-rid');
  var kBtn = card.querySelector('.comm-kudos');
  var cBtn = card.querySelector('.comm-cmt-btn');
  var thread = card.querySelector('.comm-thread');
  if (!kBtn || !cBtn || !thread) return;

  socRenderKudos(card, rid);
  cBtn.hidden = false;
  socRenderCommentCount(card, rid);

  kBtn.addEventListener('click', function() { socToggleKudo(card, rid); });
  cBtn.addEventListener('click', function() {
    thread.hidden = !thread.hidden;
    if (!thread.hidden) {
      socRenderThread(card, rid);
      var inp = thread.querySelector('.comm-cmt-input');
      if (inp) { try { inp.focus({ preventScroll: true }); } catch (e) {} }
    }
  });
}

function socRenderKudos(card, rid) {
  var list = _soc.kudos[rid] || [];
  var kBtn = card.querySelector('.comm-kudos');
  kBtn.classList.toggle('on', list.indexOf(_soc.uid) !== -1);
  kBtn.querySelector('.comm-kudos-n').textContent = list.length;
  var who = card.querySelector('.comm-kudos-who');
  if (who) {
    who.textContent = list.length
      ? list.slice(0, 3).map(socName).join(', ') + (list.length > 3 ? ' et ' + (list.length - 3) + ' autre' + (list.length > 4 ? 's' : '') : '')
      : '';
  }
}

function socRenderCommentCount(card, rid) {
  var n = (_soc.comments[rid] || []).length;
  var el = card.querySelector('.comm-cmt-n');
  if (el) el.textContent = n ? n : 'Commenter';
}

function socToggleKudo(card, rid) {
  var list = _soc.kudos[rid] = _soc.kudos[rid] || [];
  var mine = list.indexOf(_soc.uid) !== -1;
  var btn = card.querySelector('.comm-kudos');
  // Optimiste : l'interface répond tout de suite, on annule si le serveur refuse
  if (mine) list.splice(list.indexOf(_soc.uid), 1); else list.push(_soc.uid);
  socRenderKudos(card, rid);
  if (!mine) { btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop'); }
  var q = mine
    ? window.sbClient.from('round_kudos').delete().eq('round_id', rid).eq('user_id', _soc.uid)
    : window.sbClient.from('round_kudos').insert({ round_id: Number(rid), user_id: _soc.uid });
  q.then(function(res) {
    if (res && res.error && !/duplicate/i.test(res.error.message || '')) {
      if (mine) list.push(_soc.uid); else list.splice(list.indexOf(_soc.uid), 1);
      socRenderKudos(card, rid);
      showToast('Réaction non enregistrée — vérifie ta connexion');
    }
  }, function() {
    if (mine) list.push(_soc.uid); else list.splice(list.indexOf(_soc.uid), 1);
    socRenderKudos(card, rid);
    showToast('Pas de réseau');
  });
}

function socRenderThread(card, rid) {
  var thread = card.querySelector('.comm-thread');
  var ownerId = card.getAttribute('data-owner');
  var list = _soc.comments[rid] || [];
  thread.innerHTML = ''
    + (list.length ? '<div class="comm-cmts">' + list.map(function(c) {
        var canDelete = c.user_id === _soc.uid || ownerId === _soc.uid;
        var p = _soc.profiles[c.user_id] || {};
        return '<div class="comm-cmt" data-cid="' + commEsc(c.id) + '">'
          + '<div class="comm-cmt-av" style="background:' + (p.bg || 'rgba(201,168,76,0.2)') + ';color:' + (p.color || '#C9A84C') + '">' + commEsc(p.initials || '?') + '</div>'
          + '<div class="comm-cmt-main"><div class="comm-cmt-head"><strong>' + commEsc(socName(c.user_id)) + '</strong>'
          +   '<span>' + commEsc(socWhen(c.created_at)) + '</span>'
          +   (canDelete ? '<button class="comm-cmt-del" type="button" title="Supprimer">×</button>' : '') + '</div>'
          + '<div class="comm-cmt-body">' + commEsc(c.body) + '</div></div></div>';
      }).join('') + '</div>' : '<div class="comm-cmt-empty">Sois le premier à réagir à cette partie.</div>')
    + '<form class="comm-cmt-form">'
    +   '<input class="comm-cmt-input" maxlength="' + SOC_MAX_LEN + '" placeholder="Écris un commentaire…" autocomplete="off">'
    +   '<button class="comm-cmt-send" type="submit">Envoyer</button>'
    + '</form>';

  thread.querySelectorAll('.comm-cmt-del').forEach(function(b) {
    b.addEventListener('click', function() {
      var cid = b.closest('.comm-cmt').getAttribute('data-cid');
      if (!confirm('Supprimer ce commentaire ?')) return;
      window.sbClient.from('round_comments').delete().eq('id', cid).then(function(res) {
        if (res && res.error) { showToast('Suppression impossible'); return; }
        _soc.comments[rid] = (_soc.comments[rid] || []).filter(function(c) { return String(c.id) !== cid; });
        socRenderThread(card, rid); socRenderCommentCount(card, rid);
      });
    });
  });

  var form = thread.querySelector('.comm-cmt-form');
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    var inp = form.querySelector('.comm-cmt-input'), send = form.querySelector('.comm-cmt-send');
    var body = (inp.value || '').trim().slice(0, SOC_MAX_LEN);
    if (!body) return;
    send.disabled = true;
    window.sbClient.from('round_comments').insert({ round_id: Number(rid), user_id: _soc.uid, body: body })
      .select('id, round_id, user_id, body, created_at').single()
      .then(function(res) {
        send.disabled = false;
        if (res.error || !res.data) { showToast('Commentaire non envoyé — vérifie ta connexion'); return; }
        (_soc.comments[rid] = _soc.comments[rid] || []).push(res.data);
        socRenderThread(card, rid); socRenderCommentCount(card, rid);
        var again = card.querySelector('.comm-cmt-input');
        if (again) { try { again.focus({ preventScroll: true }); } catch (e2) {} }
      }, function() { send.disabled = false; showToast('Pas de réseau'); });
  });
}

function socWhen(iso) {
  var t = new Date(iso).getTime();
  if (isNaN(t)) return '';
  var min = Math.floor((Date.now() - t) / 60000);
  if (min < 1) return 'à l\'instant';
  if (min < 60) return 'il y a ' + min + ' min';
  var h = Math.floor(min / 60);
  if (h < 24) return 'il y a ' + h + ' h';
  return commRelDate(iso.slice(0, 10));
}
