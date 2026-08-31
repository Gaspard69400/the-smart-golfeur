/* ════════════════════════════════════════════
 * THE SMART GOLFER — scorecard.js
 * Page Scorecard : sélection parcours, saisie rapide, historique
 * Le mode Pro est dans radar.js (chargé après).
 * Dépend de : data.js, app.js
 * ════════════════════════════════════════════ */





let sc_detailMode = false;
let sc_detailData = {};  // {hole: {club, fairwayPos, clubApp, distRemain, distFromTarget2}}
let selectedCourse = null;
let activeFilter = 'all';
let scores = new Array(18).fill(null);
let putts = new Array(18).fill(null);
let firState = {};
let girState = {};
let roundStarted = false;
let roundHistory = lsGet('rounds') || [];

// ── INIT ──



function renderCourseList(list) {
  const el = document.getElementById('course-list');
  if (!el) return;
  el.innerHTML = '';
  if (!list.length) { el.innerHTML = '<div style="padding:12px;font-size:10px;color:var(--tx3);text-align:center">Aucun résultat</div>'; return; }
  list.forEach(c => {
    const div = document.createElement('div');
    div.className = 'course-item' + (selectedCourse && selectedCourse.id === c.id ? ' selected' : '');
    div.setAttribute('data-course-id', c.id);
    const lvlClass = (c.niveau || 'Standard').toLowerCase().replace('é','e').replace('è','e').replace('â','a');
    const isUser = !!c.userCreated;
    div.innerHTML = `<div class="ci-name">${isUser ? '<span class="ci-user-badge" title="Parcours créé par vous">\u2726</span> ' : ''}${c.name}</div>
      <div class="ci-meta">
        <span>${c.ville || ''}</span>
        <span>Par ${c.par_total}</span>
        <span>Slope ${c.slope || '—'}</span>
        <span class="ci-tag ${lvlClass}">${c.niveau || 'Standard'}</span>
        ${isUser ? '<button class="ci-edit-btn" data-edit-course="' + c.id + '" title="Modifier ce parcours">\u270e</button><button class="ci-delete-btn" data-del-course="' + c.id + '" title="Supprimer ce parcours">\u00d7</button>' : ''}
      </div>`;
    // Click sur la carte = sélection
    div.addEventListener('click', function(ev) {
      // Ne pas sélectionner si on a cliqué sur un bouton d'action
      if (ev.target.classList.contains('ci-delete-btn')) return;
      if (ev.target.classList.contains('ci-edit-btn')) return;
      selectCourse(c);
    });
    // Listener du bouton supprimer
    var delBtn = div.querySelector('[data-del-course]');
    if (delBtn) {
      delBtn.addEventListener('click', function(ev) {
        ev.stopPropagation();
        if (!confirm('Supprimer définitivement le parcours « ' + c.name + ' » ?')) return;
        if (typeof deleteUserCourse === 'function') {
          deleteUserCourse(c.id);
          // Rafraîchir la liste
          renderCourseList(typeof getAllCourses === 'function' ? getAllCourses() : COURSES);
          showToast('Parcours supprimé');
        }
      });
    }
    // Listener du bouton éditer
    var editBtn = div.querySelector('[data-edit-course]');
    if (editBtn) {
      editBtn.addEventListener('click', function(ev) {
        ev.stopPropagation();
        if (typeof openCourseCreator === 'function') {
          openCourseCreator(c);
        }
      });
    }
    el.appendChild(div);
  });
}

function filterCourses() {
  const q = document.getElementById('search-input').value.toLowerCase();
  let list = (typeof getAllCourses === 'function' ? getAllCourses() : COURSES).filter(c =>
    c.name.toLowerCase().includes(q) ||
    c.ville.toLowerCase().includes(q) ||
    c.region.toLowerCase().includes(q) ||
    c.departement.toLowerCase().includes(q)
  );
  if (activeFilter !== 'all') {
    list = list.filter(c => c.region === activeFilter || c.niveau === activeFilter);
  }
  renderCourseList(list);
}

function setFilter(f, btn) {
  activeFilter = f;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  filterCourses();
}

function selectCourse(c) {
  selectedCourse = c;
  document.querySelectorAll('.course-item').forEach(el => el.classList.remove('selected'));
  // Retrouver l'élément du parcours sélectionné
  var allItems = document.querySelectorAll('.course-item');
  allItems.forEach(function(el) {
    if (el.getAttribute('data-course-id') === c.id) el.classList.add('selected');
  });

  // Update course card
  document.getElementById('course-card').classList.add('visible');
  document.getElementById('cc-name').textContent = c.name;
  document.getElementById('cc-loc').textContent = `${c.ville} · ${c.departement} · ${c.region}`;
  document.getElementById('cc-par').textContent = c.par_total;
  document.getElementById('cc-sss').textContent = c.sss;
  document.getElementById('cc-slope').textContent = c.slope;
  document.getElementById('cc-len').textContent = c.longueur_totale + 'm';
  document.getElementById('cc-rating').textContent = c.rating.toFixed(1);
  document.getElementById('cc-diff-val').textContent = c.niveau;

  const lenPct = Math.round((c.longueur_totale - 5000) / (7000 - 5000) * 100);
  const diffPct = {Débutant:20, Intermédiaire:50, Difficile:75, Expert:95}[c.niveau] || 50;
  const ratingPct = Math.round((c.rating - 65) / (80 - 65) * 100);
  document.getElementById('cc-len-bar').style.width = Math.max(5, lenPct) + '%';
  document.getElementById('cc-diff-bar').style.width = diffPct + '%';
  document.getElementById('cc-rating-bar').style.width = Math.max(5, ratingPct) + '%';

  var btnStart = document.getElementById('btn-start');
  if (btnStart) {
    btnStart.disabled = false;
    btnStart.textContent = 'Démarrer la partie →';
  }
  var btnImm = document.getElementById('btn-immersive');
  if (btnImm) btnImm.disabled = false;
  var btnExp = document.getElementById('btn-express');
  if (btnExp) btnExp.disabled = false;
}

// ── BUILD TABLES ──
function buildTable(tableId, holes) {
  const table = document.getElementById(tableId);
  table.innerHTML = '';

  // Header
  const thead = document.createElement('thead');
  const htr = document.createElement('tr');
  ['Trou','Par','SI','Distance','Score','Stableford'].forEach(h => {
    const th = document.createElement('th');
    th.textContent = h;
    htr.appendChild(th);
  });
  thead.appendChild(htr);
  table.appendChild(thead);

  // Body
  const tbody = document.createElement('tbody');
  holes.forEach(h => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${h.num}</td>
      <td class="par-cell">${h.par}</td>
      <td class="si-cell">${h.si}</td>
      <td class="dist-cell">${h.longueur}m</td>
      <td class="score-cell">
        <input class="score-inp" type="number" min="1" max="12" id="sc-${h.num}"
          placeholder="${h.par}" oninput="onScoreInput(${h.num},${h.par},this)">
      </td>
      <td class="stableford-cell" id="stab-${h.num}" style="color:var(--tx3)">—</td>`;
    tbody.appendChild(tr);

    // Ligne détaillée (visible si sc_detailMode actif)
    const trDetail = document.createElement('tr');
    trDetail.className = 'sc-detail-row' + (sc_detailMode ? ' visible' : '');
    trDetail.id = 'detail-' + h.num;
    const tdDetail = document.createElement('td');
    tdDetail.colSpan = 6;
    tdDetail.style.padding = '0';
    tdDetail.innerHTML = `<div class="sc-detail-row${sc_detailMode ? ' visible' : ''}" style="display:${sc_detailMode ? 'flex' : 'none'}">
      <div class="sc-detail-field">
        <div class="sc-detail-label">Club d\u00e9part</div>
        <select class="sc-detail-select" data-detail="club" data-hole="${h.num}">
          <option value="">—</option>
          <option value="Driver">Driver</option>
          <option value="Bois 3">Bois 3</option>
          <option value="Bois 5">Bois 5</option>
          <option value="Hybride">Hybride</option>
          <option value="Fer 3">Fer 3</option>
          <option value="Fer 4">Fer 4</option>
          <option value="Fer 5">Fer 5</option>
          <option value="Fer 6">Fer 6</option>
        </select>
      </div>
      <div class="sc-detail-field">
        <div class="sc-detail-label">Position</div>
        <select class="sc-detail-select" data-detail="fairwayPos" data-hole="${h.num}">
          <option value="">—</option>
          <option value="fairway">Fairway</option>
          <option value="rough-l">Rough G.</option>
          <option value="rough-r">Rough D.</option>
          <option value="bunker-l">Bunker G.</option>
          <option value="bunker-r">Bunker D.</option>
          <option value="ob">Hors-limite</option>
        </select>
      </div>
      <div class="sc-detail-field">
        <div class="sc-detail-label">Dist. restante (m)</div>
        <input type="number" class="sc-detail-input" placeholder="ex. 150" min="0" max="500" data-detail="distRemain" data-hole="${h.num}">
      </div>
      <div class="sc-detail-field">
        <div class="sc-detail-label">Club approche</div>
        <select class="sc-detail-select" data-detail="clubApp" data-hole="${h.num}">
          <option value="">—</option>
          <option value="Bois 3">Bois 3</option>
          <option value="Hybride">Hybride</option>
          <option value="Fer 5">Fer 5</option>
          <option value="Fer 6">Fer 6</option>
          <option value="Fer 7">Fer 7</option>
          <option value="Fer 8">Fer 8</option>
          <option value="Fer 9">Fer 9</option>
          <option value="PW">PW</option>
          <option value="GW">GW</option>
          <option value="SW">SW</option>
          <option value="LW">LW</option>
        </select>
      </div>
      <div class="sc-detail-field">
        <div class="sc-detail-label">\u00c9cart cible 2e (m)</div>
        <input type="number" class="sc-detail-input" placeholder="ex. 8" min="0" max="100" data-detail="distFromTarget2" data-hole="${h.num}" title="Distance entre la balle apr\u00e8s ton 2e coup et ta cible (drapeau ou centre du green)">
      </div>
    </div>`;
    trDetail.appendChild(tdDetail);
    tbody.appendChild(trDetail);

    // Listeners pour les champs détaillés
    setTimeout(function() {
      var detailInputs = tdDetail.querySelectorAll('[data-detail]');
      detailInputs.forEach(function(inp) {
        inp.addEventListener('change', function() {
          var holeNum = parseInt(inp.getAttribute('data-hole'));
          var field = inp.getAttribute('data-detail');
          if (!sc_detailData[holeNum]) sc_detailData[holeNum] = {};
          sc_detailData[holeNum][field] = inp.value;
        });
      });
    }, 50);
  });

  // Total row
  const totalTr = document.createElement('tr');
  totalTr.className = 'total-row';
  const half = tableId === 'table-aller' ? 'aller' : 'retour';
  totalTr.innerHTML = `
    <td>Total</td>
    <td id="par-${half}-tot" style="color:var(--gold)">—</td>
    <td></td>
    <td id="dist-${half}-tot" style="font-size:9px;color:var(--tx3)">—m</td>
    <td id="score-${half}-tot" style="color:var(--tx)">—</td>
    <td id="stab-${half}-tot" style="color:var(--gold)">—</td>`;
  tbody.appendChild(totalTr);
  table.appendChild(tbody);
}

function buildFirGirToggles(course) {
  const firCont = document.getElementById('fir-toggles');
  const girCont = document.getElementById('gir-toggles');
  firCont.innerHTML = '';
  girCont.innerHTML = '';

  firCont.style.cssText = 'display:grid;grid-template-columns:repeat(9,1fr);gap:5px';
  girCont.style.cssText = 'display:grid;grid-template-columns:repeat(9,1fr);gap:5px';

  course.trous.forEach(function(h) {
    // FIR
    var firCell = document.createElement('div');
    firCell.className = 'toggle-cell';
    firCell.id = 'fir-' + h.num;
    if (h.par === 3) { firCell.style.opacity = '0.25'; firCell.style.pointerEvents = 'none'; }
    var firN = document.createElement('span');
    firN.style.cssText = 'font-size:9px;color:var(--tx3);font-weight:500';
    firN.textContent = h.num;
    var firV = document.createElement('span');
    firV.style.cssText = 'font-size:12px;font-weight:700';
    firV.textContent = h.par !== 3 ? '—' : 'P3';
    firCell.appendChild(firN); firCell.appendChild(firV);
    firCell.addEventListener('click', (function(num){ return function(){ toggleFir(num); }; })(h.num));
    firCont.appendChild(firCell);

    // GIR
    var girCell = document.createElement('div');
    girCell.className = 'toggle-cell';
    girCell.id = 'gir-' + h.num;
    var girN = document.createElement('span');
    girN.style.cssText = 'font-size:9px;color:var(--tx3);font-weight:500';
    girN.textContent = h.num;
    var girV = document.createElement('span');
    girV.style.cssText = 'font-size:12px;font-weight:700';
    girV.textContent = '—';
    girCell.appendChild(girN); girCell.appendChild(girV);
    girCell.addEventListener('click', (function(num){ return function(){ toggleGir(num); }; })(h.num));
    girCont.appendChild(girCell);
  });
}

function buildPuttsInputs(course) {
  const row1 = document.getElementById('putts-row-1');
  const row2 = document.getElementById('putts-row-2');
  row1.innerHTML = '';
  row2.innerHTML = '';

  row1.style.cssText = 'display:grid;grid-template-columns:repeat(9,1fr);gap:5px';
  row2.style.cssText = 'display:grid;grid-template-columns:repeat(9,1fr);gap:5px';

  course.trous.forEach(function(h) {
    var cell = document.createElement('div');
    cell.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px';
    var numLbl = document.createElement('div');
    numLbl.style.cssText = 'font-size:9px;color:var(--tx3);font-weight:500';
    numLbl.textContent = h.num;
    var inp = document.createElement('input');
    inp.type = 'number'; inp.min = '0'; inp.max = '5';
    inp.id = 'putt-' + h.num;
    inp.placeholder = '—';
    inp.className = 'putts-inp';
    inp.style.cssText = 'width:100%;max-width:44px;height:38px;background:var(--bg);border:1px solid var(--bd-card);border-radius:8px;text-align:center;color:var(--tx);font-family:"Plus Jakarta Sans",sans-serif;font-size:16px;font-weight:700;padding:0;outline:none;-moz-appearance:textfield;-webkit-appearance:none';
    inp.addEventListener('input', (function(num){ return function(){ onPuttInput(num, this); }; })(h.num));
    cell.appendChild(numLbl); cell.appendChild(inp);
    if (h.num <= 9) row1.appendChild(cell); else row2.appendChild(cell);
  });
}

// ── SCORE LOGIC ──
function onScoreInput(num, par, inp) {
  const v = inp.value ? parseInt(inp.value) : null;
  scores[num - 1] = v;
  inp.className = 'score-inp ' + getScoreClass(v, par);

  // Stableford
  const stabCell = document.getElementById(`stab-${num}`);
  if (v !== null) {
    const hcp = parseFloat(document.getElementById('f-hcp').value) || 14.2;
    const si = selectedCourse.trous[num-1].si;
    const strokes = Math.floor(hcp / 18) + (si <= (hcp % 18) ? 1 : 0);
    const net = v - par + strokes;
    const pts = Math.max(0, 2 - net);
    stabCell.textContent = pts;
    stabCell.style.color = pts >= 3 ? 'var(--gold-l)' : pts === 2 ? 'var(--ok2)' : pts === 1 ? 'var(--tx2)' : 'var(--ng2)';
  } else {
    stabCell.textContent = '—';
    stabCell.style.color = 'var(--tx3)';
  }

  updateTotals();
}

function onPuttInput(num, inp) {
  putts[num - 1] = inp.value ? parseInt(inp.value) : null;
  updateStats();
}

function getScoreClass(v, par) {
  if (v === null) return '';
  const d = v - par;
  if (d <= -2) return 'eagle';
  if (d === -1) return 'birdie';
  if (d === 0) return 'par-s';
  if (d === 1) return 'bogey';
  if (d === 2) return 'double';
  return 'triple';
}

function toggleFir(num) {
  const states = [null, 'hit', 'miss'];
  const cur = firState[num] || null;
  const next = states[(states.indexOf(cur) + 1) % 3];
  firState[num] = next;
  const cell = document.getElementById(`fir-${num}`);
  cell.className = 'toggle-cell' + (next ? ' ' + next : '');
  const h = selectedCourse.trous[num-1];
  cell.innerHTML = `<span class="hole-n">${num}</span>${next === 'hit' ? '✓' : next === 'miss' ? '✗' : '—'}`;
  updateStats();
}

function toggleGir(num) {
  const states = [null, 'hit', 'miss'];
  const cur = girState[num] || null;
  const next = states[(states.indexOf(cur) + 1) % 3];
  girState[num] = next;
  const cell = document.getElementById(`gir-${num}`);
  cell.className = 'toggle-cell' + (next ? ' ' + next : '');
  cell.innerHTML = `<span class="hole-n">${num}</span>${next === 'hit' ? '✓' : next === 'miss' ? '✗' : '—'}`;
  updateStats();
}


/* null-safe element setter */
function setEl(id, text, style) {
  var el = document.getElementById(id);
  if (!el) return;
  if (text !== undefined) el.textContent = text;
  if (style) Object.assign(el.style, style);
}

function updateTotals() {
  if (!selectedCourse) return;
  const trous = selectedCourse.trous;

  const parAller = trous.slice(0,9).reduce((a,h) => a+h.par, 0);
  const parRetour = trous.slice(9).reduce((a,h) => a+h.par, 0);
  setEl('par-aller-tot', parAller);
  setEl('par-retour-tot', parRetour);
  setEl('par-aller-display', parAller);
  setEl('par-retour-display', parRetour);

  const distAller = trous.slice(0,9).reduce((a,h) => a+h.longueur, 0);
  const distRetour = trous.slice(9).reduce((a,h) => a+h.longueur, 0);
  setEl('dist-aller-tot', distAller + 'm');
  setEl('dist-retour-tot', distRetour + 'm');

  const scoreAller = scores.slice(0,9).reduce((a,s) => s!==null ? a+s : a, 0);
  const scoreRetour = scores.slice(9).reduce((a,s) => s!==null ? a+s : a, 0);
  const filledAller = scores.slice(0,9).filter(s=>s!==null).length;
  const filledRetour = scores.slice(9).filter(s=>s!==null).length;
  const scoreTotal = scoreAller + scoreRetour;
  const parTotal = selectedCourse.par_total;

  if (filledAller > 0) { setEl('score-aller-tot', scoreAller); setEl('score-aller-display', scoreAller); }
  if (filledRetour > 0) { setEl('score-retour-tot', scoreRetour); setEl('score-retour-display', scoreRetour); }

  // Stableford totals
  const stabAller = Array.from({length:9},(_,i)=>{
    const el = document.getElementById(`stab-${i+1}`);
    return el && el.textContent !== '—' ? parseInt(el.textContent)||0 : 0;
  }).reduce((a,b)=>a+b,0);
  const stabRetour = Array.from({length:9},(_,i)=>{
    const el = document.getElementById(`stab-${i+10}`);
    return el && el.textContent !== '—' ? parseInt(el.textContent)||0 : 0;
  }).reduce((a,b)=>a+b,0);
  if (filledAller > 0) setEl('stab-aller-tot', stabAller);
  if (filledRetour > 0) setEl('stab-retour-tot', stabRetour);

  const stabTotal = stabAller + stabRetour;
  const filledTotal = filledAller + filledRetour;

  if (filledTotal > 0) {
    const vsPar = scoreTotal - parTotal;
    setEl('sh-score', scoreTotal);
    setEl('sh-vs-par', (vsPar >= 0 ? '+' : '') + vsPar);
    setEl('sh-vs-par', undefined, {color:vsPar < 0 ? 'var(--ok2)' : vsPar === 0 ? 'var(--gold)' : 'var(--wn2)'});
    setEl('sh-stab', stabTotal);

    // Différentiel
    const diff = ((scoreTotal - selectedCourse.rating) * 113 / selectedCourse.slope).toFixed(1);
    setEl('sh-diff', diff);

    // Summary
    setEl('sum-score', scoreTotal);
    setEl('sum-score-sub', (vsPar >= 0 ? '+' : '') + vsPar + ' vs par');
    (function(){ var _e=document.getElementById('sum-score'); if(_e) _e.className='sum-val ' + (vsPar < 0 ? 'ok' : vsPar <= 5 ? 'wn' : 'ng'); })();
    setEl('sum-stab', stabTotal);
    setEl('sum-diff', diff);
  }

  // Distribution
  if (filledTotal >= 6) updateAnalysis();
  updateDiffRow();
}

function updateDiffRow() {
  const counts = {eagle:0, birdie:0, par:0, bogey:0, double:0, triple:0};
  scores.forEach((s,i) => {
    if (s === null) return;
    const par = selectedCourse.trous[i].par;
    const d = s - par;
    if (d <= -2) counts.eagle++;
    else if (d === -1) counts.birdie++;
    else if (d === 0) counts.par++;
    else if (d === 1) counts.bogey++;
    else if (d === 2) counts.double++;
    else counts.triple++;
  });
  const row = document.getElementById('diff-row');
  row.innerHTML = `
    ${counts.eagle ? `<span class="diff-pill pill-eagle">Eagle ×${counts.eagle}</span>` : ''}
    ${counts.birdie ? `<span class="diff-pill pill-birdie">Birdie ×${counts.birdie}</span>` : ''}
    ${counts.par ? `<span class="diff-pill pill-par">Par ×${counts.par}</span>` : ''}
    ${counts.bogey ? `<span class="diff-pill pill-bogey">Bogey ×${counts.bogey}</span>` : ''}
    ${counts.double ? `<span class="diff-pill pill-double">Double+ ×${counts.double}</span>` : ''}
    ${counts.triple ? `<span class="diff-pill pill-double">Triple+ ×${counts.triple}</span>` : ''}`;
}

function updateStats() {
  if (!selectedCourse) return;
  // Met à jour les insights d'analyse en temps réel
  try { updateAnalysis(); } catch(e) {}
  try { updateTotals(); } catch(e) {}
}

function updateAnalysis() {
  const firHit = Object.values(firState).filter(v=>v==='hit').length;
  const firTotal = selectedCourse.trous.filter(h=>h.par!==3).length;
  const girHit = Object.values(girState).filter(v=>v==='hit').length;
  const puttsTotal = putts.reduce((a,p)=>p!==null?a+p:a, 0);
  const scoreTotal = scores.reduce((a,s)=>s!==null?a+s:a, 0);
  const par = selectedCourse.par_total;
  const diff = ((scoreTotal - selectedCourse.rating) * 113 / selectedCourse.slope);

  const bogeys = scores.filter((s,i)=>s!==null&&s-selectedCourse.trous[i].par===1).length;
  const doubles = scores.filter((s,i)=>s!==null&&s-selectedCourse.trous[i].par>=2).length;

  const cont = document.getElementById('analysis-content');
  if (!cont) return;
  cont.innerHTML = `
    <div class="insight-block">
      <div class="insight-title">Score global</div>
      <div class="insight-body">Score de <strong>${scoreTotal}</strong> (${scoreTotal>par?'+':''}${scoreTotal-par}) · Différentiel <strong>${diff.toFixed(1)}</strong>.
      ${diff < parseFloat(document.getElementById('f-hcp').value) ? 'Partie <strong>sous votre handicap</strong> — score comptable favorable.' : 'Partie au-dessus de votre indice habituel.'}</div>
    </div>
    <div class="insight-block">
      <div class="insight-title">Distribution des scores</div>
      <div class="insight-body"><strong>${bogeys} bogeys</strong> et <strong>${doubles} doubles+</strong> sur ce tour. ${doubles >= 3 ? 'Les grandes erreurs coûtent <strong>~'+Math.round(doubles*1.3)+' coups</strong> au total.' : doubles <= 1 ? 'Excellente gestion des erreurs critiques.' : 'Contrôle correct des grandes erreurs.'}</div>
    </div>
    <div class="insight-block">
      <div class="insight-title">GIR & Approches</div>
      <div class="insight-body">GIR à <strong>${girHit}/18 (${Math.round(girHit/18*100)}%)</strong>. ${girHit >= 9 ? 'Niveau d\'approche au-dessus de votre handicap.' : girHit >= 6 ? 'Marge de progression sur les fers.' : '<strong>Axe prioritaire</strong> — chaque GIR supplémentaire vaut ~0.7 coup.'}</div>
    </div>
    <div class="insight-block">
      <div class="insight-title">Précision tee & Fairways</div>
      <div class="insight-body">FIR à <strong>${firHit}/${firTotal} (${Math.round(firHit/firTotal*100)}%)</strong>. ${firHit/firTotal >= .6 ? 'Bonne précision en jeu — driver sous contrôle.' : firHit/firTotal >= .4 ? 'Précision acceptable — optimisable par choix de club.' : '<strong>Priorité driver</strong> — FIR faible amplifie toutes les erreurs suivantes.'}</div>
    </div>
    ${puttsTotal > 0 ? `<div class="insight-block">
      <div class="insight-title">Putting</div>
      <div class="insight-body">Total <strong>${puttsTotal} putts</strong> sur ce tour. ${puttsTotal <= 30 ? 'Putting excellent — atout majeur de ce tour.' : puttsTotal <= 34 ? 'Niveau standard — stable.' : '<strong>Putting coûteux</strong> : '+(puttsTotal-32)+' putts de trop vs référence hcp 14.'}</div>
    </div>` : ''}
    <div class="insight-block">
      <div class="insight-title">Contexte parcours</div>
      <div class="insight-body">Slope <strong>${selectedCourse.slope}</strong> — ${selectedCourse.slope >= 135 ? 'parcours difficile · score à relativiser positivement.' : selectedCourse.slope >= 125 ? 'difficulté standard.' : 'parcours accessible · exigence élevée sur la performance.'} Rating <strong>${selectedCourse.rating}</strong>.</div>
    </div>`;
}

// ── ROUND LIFECYCLE ──
function startRound() {
  if (!selectedCourse) return;
  roundStarted = true;
  scores = new Array(18).fill(null);
  putts = new Array(18).fill(null);
  firState = {};
  girState = {};
  sc_detailData = {};

  document.getElementById('sc-empty').style.display = 'none';
  const area = document.getElementById('round-area');
  area.style.display = 'flex';

  // Header
  document.getElementById('sc-course-name').textContent = selectedCourse.name;
  var dateEl   = document.getElementById('f-date');
  var teeEl    = document.getElementById('f-tee');
  var condEl   = document.getElementById('f-cond');
  document.getElementById('sc-course-meta').textContent = selectedCourse.ville + ' · ' + selectedCourse.departement + ' · ' + (dateEl ? dateEl.value : '') + ' · ' + (teeEl ? teeEl.value : '') + ' · ' + (condEl ? condEl.options[condEl.selectedIndex].text : '');

  const info = document.getElementById('sc-header-info');
  info.innerHTML = `
    <div class="info-pill">Par <strong>${selectedCourse.par_total}</strong></div>
    <div class="info-pill">SSS <strong>${selectedCourse.sss}</strong></div>
    <div class="info-pill">Slope <strong>${selectedCourse.slope}</strong></div>
    <div class="info-pill">Rating <strong>${selectedCourse.rating}</strong></div>
    <div class="info-pill">Longueur <strong>${selectedCourse.longueur_totale}m</strong></div>
    <div class="info-pill">Niveau <strong>${selectedCourse.niveau}</strong></div>
    <div class="info-pill">Format <strong>${document.getElementById('f-format').options[document.getElementById('f-format').selectedIndex].text}</strong></div>
    <div class="info-pill">Hcp joué <strong>${document.getElementById('f-hcp').value}</strong></div>`;

  buildTable('table-aller', selectedCourse.trous.slice(0,9));
  buildTable('table-retour', selectedCourse.trous.slice(9));
  buildFirGirToggles(selectedCourse);
  buildPuttsInputs(selectedCourse);

  showToast('Partie démarrée — ' + selectedCourse.name);
  setTimeout(() => area.scrollIntoView({behavior:'smooth'}), 100);
}

function resetRound() {
  if (!confirm('Réinitialiser tous les scores ?')) return;
  scores = new Array(18).fill(null);
  putts = new Array(18).fill(null);
  firState = {};
  girState = {};
  sc_detailData = {};
  clearDraftShots();
  if (sc_proMode) buildProShotZone();
  document.querySelectorAll('.score-inp').forEach(i => { i.value = ''; i.className = 'score-inp'; });
  document.querySelectorAll('.stableford-cell').forEach(c => { c.textContent = '—'; c.style.color = 'var(--tx3)'; });
  document.querySelectorAll('[id^="putt-"]').forEach(i => i.value = '');
  document.querySelectorAll('.toggle-cell').forEach(c => { c.className='toggle-cell'; });
  buildFirGirToggles(selectedCourse);
  buildPuttsInputs(selectedCourse);
  ['sh-score','sh-vs-par','sh-stab','sh-diff'].forEach(function(id){ var el=document.getElementById(id); if(el) el.textContent='—'; });
  var dr=document.getElementById('diff-row'); if(dr) dr.innerHTML='';
  var ac=document.getElementById('analysis-content'); if(ac) ac.innerHTML='';
  var ss=document.getElementById('save-status'); if(ss) ss.textContent='Partie réinitialisée';
  showToast('Scorecard réinitialisée');
}

function saveRound() {
  // Si mode Pro : calculer les scores à partir des shots
  if (sc_proMode) {
    Object.keys(sc_shotsByHole).forEach(function(holeKey) {
      var hNum = parseInt(holeKey);
      var shots = sc_shotsByHole[hNum] || [];
      var putts = sc_holePutts[hNum];
      if (shots.length > 0 && sc_holeOnGreen[hNum] !== undefined && putts !== null && putts !== undefined) {
        scores[hNum - 1] = shots.length + putts;
      }
    });
    // FIR/GIR depuis sc_holeFairway et sc_shotsByHole
    if (selectedCourse) {
      selectedCourse.trous.forEach(function(h) {
        if (h.par !== 3 && sc_holeFairway[h.num] === 'yes') firState[h.num] = 'hit';
        else if (h.par !== 3 && sc_holeFairway[h.num] === 'no') firState[h.num] = 'miss';
        // GIR : sur le green en par-2 coups ou moins
        var shotsForHole = sc_shotsByHole[h.num] || [];
        var onGreenAt = sc_holeOnGreen[h.num];
        if (onGreenAt !== undefined && (onGreenAt + 1) <= (h.par - 2)) {
          girState[h.num] = 'hit';
        } else if (onGreenAt !== undefined) {
          girState[h.num] = 'miss';
        }
      });
    }
    // Putts total
    var totalPutts = 0;
    Object.keys(sc_holePutts).forEach(function(k) { totalPutts += sc_holePutts[k] || 0; });
    putts = new Array(18).fill(null);
    selectedCourse.trous.forEach(function(h, i) {
      if (sc_holePutts[h.num] !== undefined) putts[i] = sc_holePutts[h.num];
    });
  }

  const filledScores = scores.filter(s=>s!==null).length;
  if (filledScores < 9) { showToast('Saisissez au moins 9 trous avant d\'enregistrer.'); return; }

  const scoreTotal = scores.reduce((a,s)=>s!==null?a+s:a, 0);
  const par = selectedCourse.par_total;
  const diff = ((scoreTotal - selectedCourse.rating) * 113 / selectedCourse.slope).toFixed(1);
  const firHit = Object.values(firState).filter(v=>v==='hit').length;
  const girHit = Object.values(girState).filter(v=>v==='hit').length;
  const puttsTotal = putts.reduce((a,p)=>p!==null?a+p:a, 0);

  const entry = {
    id: Date.now(),
    date: document.getElementById('f-date').value,
    course: selectedCourse.name,
    courseId: selectedCourse.id,
    score: scoreTotal,
    par: par,
    diff: parseFloat(diff),
    fir: firHit,
    firTotal: selectedCourse.trous.filter(h=>h.par!==3).length,
    gir: girHit,
    putts: puttsTotal || null,
    cond: document.getElementById('f-cond').value,
    format: document.getElementById('f-format').value,
    hcp: parseFloat(document.getElementById('f-hcp').value),
    notes: document.getElementById('f-notes').value,
    scores: [...scores],
    // Strokes Gained : calculés plus bas par le modèle de référence (strokesgained.js)
    sg_tee: null, sg_app: null, sg_arg: null, sg_putt: null,
    // Données détaillées (si saisie détaillée activée)
    detailMode: sc_detailMode,
    proMode: sc_proMode,
    shots: JSON.parse(JSON.stringify(sc_shotsByHole)),
    shotsOnGreen: JSON.parse(JSON.stringify(sc_holeOnGreen)),
    shotsPutts: JSON.parse(JSON.stringify(sc_holePutts)),
    shotsFairway: JSON.parse(JSON.stringify(sc_holeFairway)),
    shotsFairwayMissSide: JSON.parse(JSON.stringify(typeof sc_holeFairwayMissSide !== 'undefined' ? sc_holeFairwayMissSide : {})),
    clubs: [],
    fairwayPos: [],
    distRemain: [],
    clubsApp: [],
    distFromTarget2: []
  };

  // Remplir les tableaux détaillés
  for (var h = 1; h <= 18; h++) {
    var d = sc_detailData[h] || {};
    entry.clubs.push(d.club || null);
    entry.fairwayPos.push(d.fairwayPos || null);
    entry.distRemain.push(d.distRemain ? parseInt(d.distRemain) : null);
    entry.clubsApp.push(d.clubApp || null);
    entry.distFromTarget2.push(d.distFromTarget2 ? parseInt(d.distFromTarget2) : null);
  }

  // Strokes Gained réels (modèle de référence par handicap)
  if (typeof sgApplyToRound === 'function') { try { sgApplyToRound(entry); } catch(ex) { console.warn('SG:', ex.message); } }

  roundHistory.unshift(entry);
  if (roundHistory.length > 50) roundHistory.pop();
  // Save to shared key so dashboard can read it
  lsSet('rounds', roundHistory);
  // Synchro cloud (si connecté)
  if (window.tsgSync) window.tsgSync.pushRound(entry);

  var statusEl = document.getElementById('save-status');
  if (statusEl) statusEl.textContent = 'Partie enregistrée — ' + entry.date;
  var histSec = document.getElementById('roundHistory-section');
  if (histSec) histSec.style.display = 'flex';
  renderHistory();
  clearDraftShots();
  showToast('Partie enregistrée ✓  ' + entry.date + ' · ' + entry.course + ' · ' + scoreTotal + ' (+'+(scoreTotal-par)+')');
  // Le brouillon de saisie express n'a plus lieu d'être
  if (typeof qsClearDraft === 'function') { try { qsClearDraft(); qsRenderResumeBanner(); } catch(ex) {} }
  // Écran de célébration (record, birdies, seuils…)
  if (typeof qsCelebrate === 'function') { try { qsCelebrate(entry); } catch(ex) { console.warn('celebrate:', ex.message); } }
  // Rediriger vers le dashboard et rebuild
  setTimeout(function() {
    try {
      // Mettre à jour le hcp affiché en nav
      if (typeof updateNavUI === 'function') updateNavUI();
      var dashPage = document.getElementById('page-dashboard');
      if (dashPage && typeof buildDashboard === 'function') {
        while (dashPage.firstChild) dashPage.removeChild(dashPage.firstChild);
        buildDashboard(dashPage);
      }
      showPage('dashboard');
    } catch(ex) { console.warn('save redirect:', ex.message); }
  }, 800);
}

function renderHistory() {
  if (!roundHistory.length) return;
  var section = document.getElementById('roundHistory-section');
  if (section) section.style.display = 'flex';
  var titleEl = document.getElementById('hist-title');
  if (titleEl) titleEl.style.display = 'block';
  // L'ID peut être 'roundHistory-list' ou 'history-list' selon les versions
  var cont = document.getElementById('roundHistory-list') || document.getElementById('history-list');
  if (!cont) return;
  cont.innerHTML = roundHistory.slice(0,5).map((e, i) => {
    const vsPar = e.score - e.par;
    const col = vsPar < 0 ? 'var(--ok2)' : vsPar <= 7 ? 'var(--wn2)' : 'var(--ng2)';
    return `<div class="roundHistory-row">
      <div class="hr-date">${e.date}</div>
      <div class="hr-course" style="font-size:10px">${e.course}</div>
      <div class="hr-score" style="color:${col}">${e.score}</div>
      <div class="hr-diff" style="color:${vsPar>=0?'var(--wn2)':'var(--ok2)'}">${vsPar>=0?'+':''}${vsPar}</div>
      <button class="hr-share" data-share="${i}" title="Partager cette partie">📸</button>
    </div>`;
  }).join('');
  cont.querySelectorAll('[data-share]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var idx = parseInt(btn.getAttribute('data-share'), 10);
      if (typeof openShareCard === 'function') openShareCard(roundHistory[idx]);
    });
  });
}

/* showToast handled by app shell */

/* ════ SCORECARD INIT ════ */

/* ════════════════════════════════════════════
   SCORECARD — INIT WRAPPER (Session 3)
════════════════════════════════════════════ */
function initScorecardPage() {
  // Inject the scorecard layout into the page
  var pg = document.getElementById('page-scorecard');
  if (!pg) return;

  // Clear and build layout
  pg.innerHTML = '';
  pg.style.padding = '0';

  var layout = document.createElement('div');
  layout.className = 'sc-layout';

  // ── SIDEBAR ──
  var sb = document.createElement('div');
  sb.className = 'sc-sb';
  sb.id = 'sc-sidebar';

  sb.innerHTML = [
    '<div class="sc-sb-section-title">Choisir un parcours</div>',

    '<div class="search-wrap">',
      '<span class="search-icon">&#9906;</span>',
      '<input class="search-input" id="search-input" type="text"',
      ' placeholder="Nom, ville, région..." oninput="filterCourses()">',
    '</div>',

    '<div class="filter-row" id="filter-row">',
      '<button class="filter-btn on" data-filter="all">Tous</button>',
      '<button class="filter-btn" data-filter="Île-de-France">IDF</button>',
      '<button class="filter-btn" data-filter="Nouvelle-Aquitaine">Sud-O</button>',
      '<button class="filter-btn" data-filter="Expert">Expert</button>',
    '</div>',

    "<button class=\"add-course-btn\" id=\"add-course-btn\">+ Ajouter mon parcours</button>",
      '<div class="course-list" id="course-list"></div>',

    '<div class="sc-sb-section-title">Informations parcours</div>',

    '<div class="course-card" id="course-card">',
      '<div class="cc-name" id="cc-name"></div>',
      '<div class="cc-loc" id="cc-loc"></div>',
      '<div class="cc-stats">',
        '<div class="cc-stat"><div class="cc-stat-val" id="cc-par">—</div><div class="cc-stat-lbl">Par</div></div>',
        '<div class="cc-stat"><div class="cc-stat-val" id="cc-sss">—</div><div class="cc-stat-lbl">SSS</div></div>',
        '<div class="cc-stat"><div class="cc-stat-val" id="cc-slope">—</div><div class="cc-stat-lbl">Slope</div></div>',
      '</div>',
      '<div class="cc-bar"><div class="cc-bar-lbl">Longueur</div><div class="cc-bar-track"><div class="cc-bar-fill" id="cc-len-bar" style="width:0%"></div></div><div class="cc-bar-val" id="cc-len">—</div></div>',
      '<div class="cc-bar"><div class="cc-bar-lbl">Difficulté</div><div class="cc-bar-track"><div class="cc-bar-fill" id="cc-diff-bar" style="width:0%"></div></div><div class="cc-bar-val" id="cc-diff-val">—</div></div>',
      '<div class="cc-bar"><div class="cc-bar-lbl">Rating</div><div class="cc-bar-track"><div class="cc-bar-fill" id="cc-rating-bar" style="width:0%"></div></div><div class="cc-bar-val" id="cc-rating">—</div></div>',
    '</div>',

    '<div class="sc-sb-section-title">Paramètres de la partie</div>',

    '<div class="sc-fg"><div class="sc-fl">Date</div><input class="sc-fi" type="date" id="f-date"></div>',

    '<div class="sc-fr">',
      '<div class="sc-fg"><div class="sc-fl">Départ</div><select class="sc-fs" id="f-tee"><option>Blanc</option><option>Jaune</option><option>Rouge</option><option>Bleu</option></select></div>',
      '<div class="sc-fg"><div class="sc-fl">Format</div><select class="sc-fs" id="f-format"><option value="stroke">Stroke play</option><option value="stableford">Stableford</option></select></div>',
    '</div>',

    '<div class="sc-fr">',
      '<div class="sc-fg"><div class="sc-fl">Conditions</div><select class="sc-fs" id="f-cond"><option value="calme">Calme</option><option value="vent-mod">Vent modéré</option><option value="vent-fort">Vent fort</option><option value="pluie">Pluie</option></select></div>',
      '<div class="sc-fg"><div class="sc-fl">Handicap joué</div><input class="sc-fi" type="number" id="f-hcp" step="0.1" min="-10" max="54"></div>',
    '</div>',

    '<div class="sc-fg"><div class="sc-fl">Notes</div><input class="sc-fi" id="f-notes" placeholder="Observations..."></div>',

    '<button class="btn-express" id="btn-express" onclick="openQuickScore()" disabled>',
      '<span class="btn-express-t">⚡ Saisie express</span>',
      '<span class="btn-express-s">1 tap par trou · reprise automatique</span>',
    '</button>',

    '<button class="btn-immersive" id="btn-immersive" onclick="openImmersiveScoring()" disabled>',
      '⛳ Saisie immersive · trou par trou',
    '</button>',

    '<button class="btn-start-round" id="btn-start" onclick="startRound()" disabled>',
      'Sélectionnez un parcours',
    '</button>',

    '<button class="btn-quicktotal" onclick="openQuickTotal()">',
      '✎ J\'ai déjà joué — entrer juste le score',
    '</button>',

    '<div class="sc-sb-section-title" id="hist-title" style="display:none">Historique</div>',
    '<div id="roundHistory-section" style="display:none"><div id="history-list"></div></div>'
  ].join('');

  // ── MAIN ──
  var main = document.createElement('div');
  main.className = 'sc-main';
  main.id = 'sc-main';

  // Bannière « reprendre la partie en cours » (saisie express)
  var resumeHost = document.createElement('div');
  resumeHost.id = 'qs-resume-host';
  main.appendChild(resumeHost);

  // Empty state
  var empty = document.createElement('div');
  empty.className = 'sc-empty';
  empty.id = 'sc-empty';
  empty.innerHTML = [
    '<div class="sc-empty-icon">⛳</div>',
    '<h3>Prêt à jouer ?</h3>',
    '<p>Sélectionnez un parcours dans la liste pour démarrer votre scorecard.</p>'
  ].join('');

  // Round area (hidden until started) — contient TOUT le contenu de la partie
  var roundArea = document.createElement('div');
  roundArea.id = 'round-area';
  roundArea.style.display = 'none';
  roundArea.style.flexDirection = 'column';
  roundArea.style.gap = '16px';
  roundArea.innerHTML = [
    // ── Live score header ──
    '<div class="sc-round-header" id="sc-round-header">',
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px">',
        '<div>',
          '<div class="sc-round-name" id="sc-course-name">—</div>',
          '<div class="sc-round-meta" id="sc-course-meta">—</div>',
        '</div>',
        '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">',
          '<div class="sc-hstat" id="sh-block-score">',
            '<div class="sc-hstat-val" id="sh-score">—</div>',
            '<div class="sc-hstat-lbl">Score</div>',
          '</div>',
          '<div class="sc-hstat">',
            '<div class="sc-hstat-val" id="sh-vs-par">—</div>',
            '<div class="sc-hstat-lbl">vs Par</div>',
          '</div>',
          '<div class="sc-hstat">',
            '<div class="sc-hstat-val" id="sh-stab">—</div>',
            '<div class="sc-hstat-lbl">Stableford</div>',
          '</div>',
          '<div class="sc-hstat">',
            '<div class="sc-hstat-val" id="sh-diff">—</div>',
            '<div class="sc-hstat-lbl">Diff.</div>',
          '</div>',
        '</div>',
      '</div>',
      // Toggle mode de saisie (rapide / pro)
      '<div class="sc-mode-toggle" style="max-width:440px;margin:0 0 8px">',
        '<button class="sc-mode-btn active" data-mode="quick">⚡ Saisie rapide</button>',
        '<button class="sc-mode-btn" data-mode="pro">◆ Mode Pro · coup par coup</button>',
      '</div>',
      '<div id="sc-header-info" class="sc-round-stats" style="margin-top:6px"></div>',
    '</div>',

    // ── Table aller (trous 1-9) ──
    '<div class="sc-panel">',
      '<div class="sc-panel-header">',
        '<div class="sc-panel-title">Aller — Trous 1 à 9</div>',
        '<div style="display:flex;gap:12px;font-size:10px;font-weight:600;color:var(--tx3)">',
          '<span>Par : <span id="par-aller-display" style="color:var(--gold)">—</span></span>',
          '<span>Score : <span id="score-aller-display" style="color:var(--tx)">—</span></span>',
        '</div>',
      '</div>',
      '<div style="overflow-x:auto"><table class="sc-table" id="table-aller"></table></div>',
    '</div>',

    // ── Table retour (trous 10-18) ──
    '<div class="sc-panel">',
      '<div class="sc-panel-header">',
        '<div class="sc-panel-title">Retour — Trous 10 à 18</div>',
        '<div style="display:flex;gap:12px;font-size:10px;font-weight:600;color:var(--tx3)">',
          '<span>Par : <span id="par-retour-display" style="color:var(--gold)">—</span></span>',
          '<span>Score : <span id="score-retour-display" style="color:var(--tx)">—</span></span>',
        '</div>',
      '</div>',
      '<div style="overflow-x:auto"><table class="sc-table" id="table-retour"></table></div>',
    '</div>',

    // ── Résumé scorecard ──
    '<div class="sc-panel">',
      '<div class="sc-panel-header"><div class="sc-panel-title">Résumé</div></div>',
      '<div class="panel-body" style="padding:14px 18px;display:grid;grid-template-columns:repeat(3,1fr);gap:12px">',
        '<div style="text-align:center">',
          '<div style="font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px">Score total</div>',
          '<div class="sum-val" id="sum-score" style="font-size:28px;font-weight:700;color:var(--tx);letter-spacing:-1px">—</div>',
          '<div id="sum-score-sub" style="font-size:10px;color:var(--tx3);margin-top:2px">—</div>',
        '</div>',
        '<div style="text-align:center">',
          '<div style="font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px">Stableford</div>',
          '<div id="sum-stab" style="font-size:28px;font-weight:700;color:var(--gold-d);letter-spacing:-1px">—</div>',
        '</div>',
        '<div style="text-align:center">',
          '<div style="font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px">Différentiel</div>',
          '<div id="sum-diff" style="font-size:28px;font-weight:700;color:var(--ok2);letter-spacing:-1px">—</div>',
        '</div>',
      '</div>',
      '<div id="diff-row" style="padding:0 18px 14px;display:none;font-size:11px;color:var(--tx2)"></div>',
    '</div>',

    // ── FIR ──
    '<div class="sc-panel">',
      '<div class="sc-panel-header"><div class="sc-panel-title">FIR — Fairways touchés</div></div>',
      '<div style="padding:12px 16px"><div id="fir-toggles" style="display:flex;gap:5px;flex-wrap:wrap"></div></div>',
    '</div>',

    // ── GIR ──
    '<div class="sc-panel">',
      '<div class="sc-panel-header"><div class="sc-panel-title">GIR — Greens en régulation</div></div>',
      '<div style="padding:12px 16px"><div id="gir-toggles" style="display:flex;gap:5px;flex-wrap:wrap"></div></div>',
    '</div>',

    // ── Putts ──
    '<div class="sc-panel">',
      '<div class="sc-panel-header"><div class="sc-panel-title">Putts</div></div>',
      '<div style="padding:12px 16px">',
        '<div id="putts-row-1" style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px"></div>',
        '<div id="putts-row-2" style="display:flex;gap:5px;flex-wrap:wrap"></div>',
      '</div>',
    '</div>',

    // ── Analyse ──
    '<div class="sc-panel">',
      '<div class="sc-panel-header"><div class="sc-panel-title">Statistiques de la partie</div></div>',
      '<div style="padding:14px 18px"><div id="analysis-content" style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px"></div></div>',
    '</div>',

    // ── Zone Mode Pro (coup par coup) ──
    '<div id="shot-pro-zone" style="display:none;flex-direction:column;gap:12px"></div>',

    // ── Actions ──
    '<div style="display:flex;gap:10px;align-items:center;padding:4px 0 16px">',
      '<button class="btn-save-sc" onclick="saveRound()">Enregistrer la partie</button>',
      '<button class="btn-reset-sc" onclick="resetRound()">Recommencer</button>',
      '<div id="save-status" style="font-size:11px;color:var(--ok2);font-weight:600;margin-left:8px"></div>',
    '</div>',
  ].join('');

  main.appendChild(empty);
  main.appendChild(roundArea);
  layout.appendChild(sb);
  layout.appendChild(main);
  pg.appendChild(layout);

  // Attacher les listeners pour les boutons filtre (évite onclick HTML cassé)
  var filterBtns = pg.querySelectorAll('.filter-btn[data-filter]');
  filterBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      setFilter(btn.getAttribute('data-filter'), btn);
    });
  });

  // Listeners du toggle mode (rapide / pro)
  var modeBtns = pg.querySelectorAll('.sc-mode-btn[data-mode]');
  modeBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      var mode = btn.getAttribute('data-mode');
      sc_proMode = (mode === 'pro');
      sc_detailMode = false;  // mode détaillée supprimé

      // Activer le bouton cliqué
      modeBtns.forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');

      // Afficher/masquer la zone Pro (coup par coup)
      var proZone = document.getElementById('shot-pro-zone');
      if (proZone) proZone.style.display = sc_proMode ? 'flex' : 'none';

      // Cacher/montrer les panneaux traditionnels selon le mode
      var tables = document.querySelectorAll('#table-aller, #table-retour, #fir-toggles, #gir-toggles, #putts-row-1, #putts-row-2');
      tables.forEach(function(t) {
        var parentPanel = t.closest('.sc-panel');
        if (parentPanel) parentPanel.style.display = sc_proMode ? 'none' : '';
      });

      // Initialiser la zone Pro si activée
      if (sc_proMode) buildProShotZone();
    });
  });

  // Listener du bouton "Ajouter mon parcours"
  var addBtn = document.getElementById('add-course-btn');
  if (addBtn) {
    addBtn.addEventListener('click', function() {
      openCourseCreator();
    });
  }

  // Init scorecard module
  try {
    var dateEl = document.getElementById('f-date');
    if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];
    var hcpEl = document.getElementById('f-hcp');
    if (hcpEl) hcpEl.value = (currentUser && currentUser.hcp !== null) ? currentUser.hcp : 14.2;

    renderCourseList(typeof getAllCourses === 'function' ? getAllCourses() : COURSES);

    // Load saved rounds
    var saved = lsGet('rounds');
    if (saved && saved.length) {
      roundHistory = saved;
      var ht = document.getElementById('hist-title');
      var hs = document.getElementById('roundHistory-section');
      if (ht) ht.style.display = 'block';
      if (hs) hs.style.display = 'flex';
      renderHistory();
    }
  } catch(e) {
    console.warn('[TSG] Scorecard init error:', e.message);
  }
}


/* ════════════════════════════════════════════
   CRÉATION DE PARCOURS UTILISATEUR — SESSION 8
════════════════════════════════════════════ */

var REGIONS_FR = [
  'Auvergne-Rhône-Alpes', 'Bourgogne-Franche-Comté', 'Bretagne',
  'Centre-Val de Loire', 'Corse', 'Grand Est', 'Hauts-de-France',
  'Île-de-France', 'Normandie', 'Nouvelle-Aquitaine', 'Occitanie',
  'Pays de la Loire', 'Provence-Alpes-Côte d\'Azur',
  'Guadeloupe', 'Martinique', 'Guyane', 'La Réunion', 'Mayotte'
];

function openCourseCreator(existingCourse) {
  // existingCourse = parcours à éditer (optionnel)
  var isEdit = !!existingCourse;

  // État du formulaire
  var formState = isEdit ? JSON.parse(JSON.stringify(existingCourse)) : {
    id: 'user-' + Date.now(),
    name: '',
    ville: '',
    departement: '',
    region: '',
    cp: '',
    type: '18 trous',
    par_total: 72,
    longueur_totale: 0,
    sss: 72.0,
    slope: 130,
    rating: 72.0,
    niveau: 'Standard',
    trous: []
  };

  // Initialiser les 18 trous si vide
  if (!formState.trous || formState.trous.length === 0) {
    for (var i = 1; i <= 18; i++) {
      formState.trous.push({ num: i, par: 4, longueur: 0, si: i });
    }
  }

  // Construire la modale
  var existing = document.getElementById('course-creator-modal');
  if (existing) existing.remove();

  var modal = document.createElement('div');
  modal.id = 'course-creator-modal';
  modal.className = 'cc-modal';
  modal.innerHTML = ''
    + '<div class="cc-card">'
    +   '<div class="cc-header">'
    +     '<div>'
    +       '<div class="cc-title-tag">' + (isEdit ? 'Modifier le parcours' : 'Nouveau parcours') + '</div>'
    +       '<div class="cc-title">' + (isEdit ? formState.name : 'Cr\u00e9er mon parcours') + '</div>'
    +     '</div>'
    +     '<button class="cc-close" id="cc-close-btn">\u00d7</button>'
    +   '</div>'
    +   '<div class="cc-body">'
    +     '<div class="cc-section">'
    +       '<div class="cc-section-title">Informations g\u00e9n\u00e9rales</div>'
    +       '<div class="cc-grid-2">'
    +         '<div class="cc-field">'
    +           '<label class="cc-label">Nom du parcours <span class="cc-required">*</span></label>'
    +           '<input type="text" class="cc-input" data-field="name" placeholder="ex. Golf de Chambon" value="' + (formState.name || '') + '">'
    +         '</div>'
    +         '<div class="cc-field">'
    +           '<label class="cc-label">Ville <span class="cc-required">*</span></label>'
    +           '<input type="text" class="cc-input" data-field="ville" placeholder="ex. Saint-\u00c9tienne" value="' + (formState.ville || '') + '">'
    +         '</div>'
    +         '<div class="cc-field">'
    +           '<label class="cc-label">D\u00e9partement</label>'
    +           '<input type="text" class="cc-input" data-field="departement" placeholder="ex. Loire" value="' + (formState.departement || '') + '">'
    +         '</div>'
    +         '<div class="cc-field">'
    +           '<label class="cc-label">R\u00e9gion</label>'
    +           '<select class="cc-input" data-field="region">'
    +             '<option value="">— S\u00e9lectionner —</option>'
    +             REGIONS_FR.map(function(r) { return '<option value="' + r + '"' + (formState.region === r ? ' selected' : '') + '>' + r + '</option>'; }).join('')
    +           '</select>'
    +         '</div>'
    +       '</div>'
    +     '</div>'
    +     '<div class="cc-section">'
    +       '<div class="cc-section-title">Caract\u00e9ristiques techniques</div>'
    +       '<div class="cc-grid-4">'
    +         '<div class="cc-field">'
    +           '<label class="cc-label">SSS</label>'
    +           '<input type="number" step="0.1" class="cc-input" data-field="sss" value="' + (formState.sss || 72) + '">'
    +         '</div>'
    +         '<div class="cc-field">'
    +           '<label class="cc-label">Slope</label>'
    +           '<input type="number" class="cc-input" data-field="slope" value="' + (formState.slope || 130) + '">'
    +         '</div>'
    +         '<div class="cc-field">'
    +           '<label class="cc-label">Par total (auto)</label>'
    +           '<input type="number" class="cc-input cc-readonly" id="cc-par-total" readonly value="' + (formState.par_total || 0) + '">'
    +         '</div>'
    +         '<div class="cc-field">'
    +           '<label class="cc-label">Longueur (auto)</label>'
    +           '<input type="text" class="cc-input cc-readonly" id="cc-len-total" readonly value="' + (formState.longueur_totale || 0) + 'm">'
    +         '</div>'
    +       '</div>'
    +     '</div>'
    +     '<div class="cc-section">'
    +       '<div class="cc-section-title">Saisie des 18 trous</div>'
    +       '<div class="cc-table-wrap">'
    +         '<table class="cc-table">'
    +           '<thead>'
    +             '<tr><th>Trou</th><th>Par</th><th>Longueur (m)</th><th>SI</th></tr>'
    +           '</thead>'
    +           '<tbody id="cc-trous-body"></tbody>'
    +         '</table>'
    +       '</div>'
    +       '<div class="cc-hint">Astuce : utilise <strong>Tab</strong> pour passer rapidement d\'une case \u00e0 l\'autre.</div>'
    +     '</div>'
    +     '<div id="cc-warnings" class="cc-warnings"></div>'
    +   '</div>'
    +   '<div class="cc-footer">'
    +     '<button class="cc-btn cc-btn-cancel" id="cc-cancel-btn">Annuler</button>'
    +     '<button class="cc-btn cc-btn-save" id="cc-save-btn">' + (isEdit ? 'Enregistrer les modifications' : 'Cr\u00e9er ce parcours') + '</button>'
    +   '</div>'
    + '</div>';

  document.body.appendChild(modal);

  // Construire les 18 lignes
  var trousBody = document.getElementById('cc-trous-body');
  formState.trous.forEach(function(t, idx) {
    var tr = document.createElement('tr');
    tr.innerHTML = ''
      + '<td><strong>' + t.num + '</strong></td>'
      + '<td><select class="cc-input cc-tiny" data-trou="' + idx + '" data-prop="par">'
      +   '<option value="3"' + (t.par === 3 ? ' selected' : '') + '>3</option>'
      +   '<option value="4"' + (t.par === 4 ? ' selected' : '') + '>4</option>'
      +   '<option value="5"' + (t.par === 5 ? ' selected' : '') + '>5</option>'
      + '</select></td>'
      + '<td><input type="number" class="cc-input cc-tiny" data-trou="' + idx + '" data-prop="longueur" min="0" max="700" value="' + (t.longueur || '') + '"></td>'
      + '<td><input type="number" class="cc-input cc-tiny" data-trou="' + idx + '" data-prop="si" min="1" max="18" value="' + (t.si || '') + '"></td>';
    trousBody.appendChild(tr);
  });

  // Listeners
  function updateTotals() {
    var parSum = 0, lenSum = 0;
    formState.trous.forEach(function(t) {
      parSum += parseInt(t.par) || 0;
      lenSum += parseInt(t.longueur) || 0;
    });
    formState.par_total = parSum;
    formState.longueur_totale = lenSum;
    document.getElementById('cc-par-total').value = parSum;
    document.getElementById('cc-len-total').value = lenSum + 'm';
  }

  // Champs généraux
  modal.querySelectorAll('[data-field]').forEach(function(inp) {
    inp.addEventListener('input', function() {
      var field = inp.getAttribute('data-field');
      formState[field] = inp.value;
    });
    inp.addEventListener('change', function() {
      var field = inp.getAttribute('data-field');
      formState[field] = inp.value;
    });
  });

  // Champs trous
  modal.querySelectorAll('[data-trou]').forEach(function(inp) {
    inp.addEventListener('input', function() {
      var idx = parseInt(inp.getAttribute('data-trou'));
      var prop = inp.getAttribute('data-prop');
      var val = inp.value;
      if (prop === 'par' || prop === 'longueur' || prop === 'si') {
        val = parseInt(val) || 0;
      }
      formState.trous[idx][prop] = val;
      updateTotals();
    });
  });

  updateTotals();

  // Fermeture
  function closeCreator() {
    var m = document.getElementById('course-creator-modal');
    if (m) m.remove();
  }
  document.getElementById('cc-close-btn').addEventListener('click', closeCreator);
  document.getElementById('cc-cancel-btn').addEventListener('click', closeCreator);
  modal.addEventListener('click', function(ev) { if (ev.target === modal) closeCreator(); });

  // Sauvegarde
  document.getElementById('cc-save-btn').addEventListener('click', function() {
    // Validation
    var warnings = [];
    if (!formState.name || formState.name.trim().length < 2) {
      warnings.push('Le nom du parcours est obligatoire.');
    }
    if (!formState.ville || formState.ville.trim().length < 2) {
      warnings.push('La ville est obligatoire.');
    }
    // Vérifier que les trous ont une longueur > 0
    var missingLen = formState.trous.filter(function(t) { return !t.longueur || t.longueur < 50; }).length;
    if (missingLen > 0) {
      warnings.push('Attention : ' + missingLen + ' trou(s) ont une longueur manquante ou trop courte (<50m).');
    }
    // Vérifier unicité SI
    var sis = formState.trous.map(function(t) { return t.si; });
    var uniqSis = [];
    sis.forEach(function(s) { if (uniqSis.indexOf(s) < 0) uniqSis.push(s); });
    if (uniqSis.length !== 18) {
      warnings.push('Attention : les SI (Stroke Index) ne sont pas tous uniques (1-18).');
    }

    var warnEl = document.getElementById('cc-warnings');
    if (warnings.length > 0) {
      // Bloquer uniquement si nom/ville manquent (obligatoires)
      var blocking = warnings.filter(function(w) { return w.indexOf('obligatoire') >= 0; }).length;
      warnEl.innerHTML = warnings.map(function(w) {
        var icon = w.indexOf('obligatoire') >= 0 ? '\u26a0' : '\u24d8';
        var cls = w.indexOf('obligatoire') >= 0 ? 'cc-warn-error' : 'cc-warn-info';
        return '<div class="' + cls + '">' + icon + ' ' + w + '</div>';
      }).join('');
      if (blocking > 0) return;
      // Sinon, demander confirmation
      if (!confirm('Des avertissements ont \u00e9t\u00e9 d\u00e9tect\u00e9s, voulez-vous quand m\u00eame enregistrer ?')) return;
    }

    // Déterminer le niveau automatiquement selon le slope
    if (formState.slope >= 140) formState.niveau = 'Expert';
    else if (formState.slope >= 130) formState.niveau = 'Avanc\u00e9';
    else if (formState.slope >= 120) formState.niveau = 'Interm\u00e9diaire';
    else formState.niveau = 'D\u00e9butant';

    // Rating = SSS par défaut
    if (!formState.rating) formState.rating = formState.sss;

    // Sauvegarder
    if (typeof saveUserCourse === 'function') {
      saveUserCourse(formState);
      showToast(isEdit ? 'Parcours modifi\u00e9 \u2713' : 'Parcours cr\u00e9\u00e9 \u2713');
      closeCreator();
      // Rafraîchir la liste de la scorecard
      renderCourseList(typeof getAllCourses === 'function' ? getAllCourses() : COURSES);
      // Rafraîchir la grille de la page Parcours si elle est montée
      if (typeof crsRefresh === 'function') crsRefresh();
    }
  });
}
