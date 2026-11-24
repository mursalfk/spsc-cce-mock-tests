/* assets/js/runner.js : the one test page for every test.
     test.html?t=easy-07                      a full test (data/tests/easy-07.json)
     test.html?t=s-hard-mth-3                 a subject set (cut from data/pool/, see pool.js)
     test.html?t=custom&l=hard&s=mth,ca&n=50  a custom test (random, but fixed by the seed in &r=)
   then runs the exam screen, result, review and flashcards.
   No question data lives in code: edit data/questions.csv and run tools/build.py. */
(function(){
"use strict";
const app = document.getElementById('app');
const SP = new URLSearchParams(location.search), KEY = (SP.get('t') || '').toLowerCase();
const FULL = /^(easy|medium|hard)-\d{2}$/, SUBJ = /^s-(easy|medium|hard)-([a-z]+)-(\d+)$/;
const BACK = KEY === 'custom' ? 'practice.html#build' : SUBJ.test(KEY) ? 'practice.html' : 'index.html#' + KEY.split('-')[0];
const getJSON = u => fetch(u).then(r => { if(!r.ok) throw new Error(u + ' ' + r.status); return r.json(); });
const lost = (h, p) => { app.innerHTML = '<div class="wrap"><div class="site-top"><a class="back" href="index.html">&larr; All tests</a></div><h1>' + h + '</h1><div class="card"><p class="mut" style="margin:0">' + p + '</p></div></div>'; };

if(!FULL.test(KEY) && !SUBJ.test(KEY) && KEY !== 'custom'){ lost('Pick a test', 'This page opens a test from the list. <a href="index.html">Go to all tests</a>.'); return; }
if(!window.SPSC || !window.POOL){ lost('Could not load the sign-in files', 'Check your connection and reload. If you opened this file from your computer, open the live site instead.'); return; }
getJSON('data/catalog.json').then(CAT => resolve(CAT).then(T => boot(T, CAT)))
  .catch(() => lost('Test not found', 'That test is not available (yet). <a href="' + BACK + '">Back to the list</a>.'));

function resolve(CAT){
  if(FULL.test(KEY)) return getJSON('data/tests/' + KEY + '.json').then(T => POOL.fin(CAT, Object.assign(T, {levelName:CAT.levels[T.level].name, back:BACK})));
  const m = SUBJ.exec(KEY);
  if(m) return POOL.subjectTest(CAT, m[1], m[2].toUpperCase(), +m[3]);
  const o = POOL.parse(CAT, SP);
  return o ? POOL.customTest(CAT, o) : Promise.reject(new Error('bad custom test'));
}

function boot(T, CAT){
const N = T.q.length;
document.title = T.title + ' \u00b7 ' + CAT.exam.name;
const I = window.UI ? UI.icon : () => '';
function engine(){
const R = {limit:T.minutes * 60, minus:-CAT.marking.wrong, pass:T.pass};
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const L = 'ABCD', LCHIP = {easy:'ok', medium:'warn', hard:'bad'};
const KEY = SPSC.ns('u' + (T.sk || T.id));
const secOf = k => T.sec.find(s => s.k === k);
const f2 = x => (Math.round(x * 100) / 100).toString();
let S, FS = null, filt = 'wrong', tickT = null, last = 0, ticks = 0, showExp = false, drawer = false;

function fresh(){ return {on:false, ans:Array(N).fill(-1), mk:Array(N).fill(0), cur:0, used:0, limit:0, done:false, t:T.title, u:location.search}; }
function load(){ try{ const x = JSON.parse(localStorage.getItem(KEY)); if(x && x.ans && x.ans.length === N) return Object.assign(fresh(), x); }catch(e){} return null; }
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){} }
S = load() || fresh();

function score(){
  let c = 0, w = 0, u = 0; const sec = {};
  T.sec.forEach(s => sec[s.k] = {n:0, c:0, w:0, u:0});
  T.q.forEach((q, i) => { const z = sec[q.s]; z.n++;
    if(S.ans[i] < 0){ u++; z.u++; } else if(S.ans[i] === q.a){ c++; z.c++; } else { w++; z.w++; } });
  return {c, w, u, net: c - R.minus * w, sec};
}
const usedSec = () => Math.min(20000, Math.round(S.used || 0));
const repCtx = () => ({aid:S.aid, T, ans:S.ans.slice(), mode:'exam', used:usedSec(), ts:S.fin || Date.now()});
function view(h){
  app.innerHTML = h; window.scrollTo(0, 0);
  SPSC.paintAcct(); if(window.UI) UI.mount();
}
const topStrip = (back) => `<div class="site-top">${back || '<a class="back" href="' + T.back + '">' + I('back') + (T.kind ? ' Practice' : ' All tests') + '</a>'}<div class="right"><span class="spsc-acct"></span><span data-ui="ctl"></span></div></div>`;

function ask(title, body, ok, cancel){
  return new Promise(res => {
    const d = document.createElement('div'); d.className = 'spsc-ov'; d.id = 'dlg';
    d.innerHTML = `<div class="spsc-box" role="alertdialog" aria-modal="true" aria-labelledby="dlg-t"><h2 id="dlg-t">${esc(title)}</h2><p>${esc(body)}</p>
      <button class="spsc-btn pri" data-d="ok">${esc(ok)}</button>${cancel === false ? '' : `<button class="spsc-btn" data-d="no">${esc(cancel || 'Cancel')}</button>`}</div>`;
    document.body.appendChild(d);
    const done = v => { d.remove(); document.removeEventListener('keydown', kd, true); res(v); };
    const kd = e => { if(e.key === 'Escape'){ e.stopPropagation(); done(false); } };
    d.addEventListener('click', e => { const b = e.target.closest('[data-d]'); if(b) done(b.dataset.d === 'ok'); else if(e.target === d && cancel !== false) done(false); });
    document.addEventListener('keydown', kd, true);
    (d.querySelector('[data-d=no]') || d.querySelector('[data-d=ok]')).focus();
  });
}

/* ---------- start ---------- */
function showStart(){
  stopTick(); FS = null; drawer = false;
  const r = score(), answered = r.c + r.w, inprog = S.on && !S.done;
  const chips = T.sec.map(s => `<span><b>${s.n}</b> ${esc(s.name)}</span>`).join('');
  let main;
  if(inprog){
    main = `<div class="card"><h3>Your progress</h3><div class="resume"><div><b>Question ${S.cur + 1} of ${N}</b><div class="mut sm-t">${answered} answered · ${r.c} right · ${r.w} wrong · net ${f2(r.net)}</div></div>
      <div class="actions"><button class="b pri" data-a="resume">Resume test</button><button class="b" data-a="finish">Finish now</button><button class="b ghost" data-a="reset">Start over</button></div></div></div>`;
  }else{
    main = `<div class="card"><h3>Ready?</h3>
      <label class="opt-row"><input type="checkbox" id="opt-timer"> Use the ${T.minutes}-minute countdown${T.kind ? '' : ' (like the real paper)'}</label>
      <p class="mut sm-t" style="margin:.1rem 0 1rem">Off by default: the clock then just counts up, and closing the page never costs you time.</p>
      <div class="actions"><button class="b pri" data-a="start">${S.done ? 'Take it again' : 'Start test'}</button>${S.done ? '<button class="b" data-a="view-result">View last result</button>' : ''}</div></div>`;
  }
  view(`<div class="wrap">${topStrip()}
   <div class="hero"><h1>${esc(T.title)}</h1><p>${N} questions · ${T.kind ? 'practice set' : 'SPSC CCE-2026 screening pattern'}&nbsp;<span class="chip ${LCHIP[T.level] || ''}">${esc(T.levelName)} level</span></p></div>
   ${main}
   <div class="card"><h3>How this test works</h3><ul class="rule-list">
     <li>${I('file')}<span>One question per screen, like the computer-based test.</span></li>
     <li>${I('zap')}<span>Tap an answer and you see straight away whether it is right or wrong. The answer then locks.</span></li>
     <li>${I('bulb')}<span>An <b>Explanation</b> button is there when you want it. It stays hidden until you press it.</span></li>
     <li>${I('check')}<span>Marking: <b>+1</b> right, <b>−${R.minus}</b> wrong, <b>0</b> skipped. Pass mark <b>${f2(R.pass)}</b> net (33%).</span></li>
     <li>${I('mail')}<span>When you finish, your result is saved to your account and a PDF report is emailed to you.</span></li></ul>
     <h3 style="margin-top:1.1rem">Sections</h3><div class="secs">${chips}</div></div>
   <div class="actions"><button class="b" data-a="start-flash">${I('cards')}Flashcards (all ${N})</button></div></div>`);
}
function startTest(){
  const t = $('#opt-timer'), lim = t && t.checked ? R.limit : 0;
  S = fresh(); S.on = true; S.limit = lim; save(); showTest();
}
async function resetTest(){
  if(!await ask('Start over?', 'This erases your answers for this test. Results you already finished stay in your history.', 'Start over', 'Cancel')) return;
  S = fresh(); save(); showStart();
}

/* ---------- test screen ---------- */
function showTest(){
  drawer = false; showExp = false;
  view(`<div class="tbar"><div class="in">
      <button class="ib" data-a="home" aria-label="Back to test overview">${I('back')}</button>
      <div class="tt"><b>${esc(T.title)}</b><small id="qn"></small></div>
      <div class="tally" id="ty"></div><div class="timer" id="tm"></div>
      <button class="b sm ghost fin-t" data-a="finish">Finish</button>
      <button class="ib" data-a="pal" aria-label="Question list">${I('grid')}</button><span data-ui="ctl"></span></div>
      <div class="pbar"><i id="pb"></i></div></div>
    <main class="qwrap" id="qc"></main>
    <div class="tfoot"><div class="in" id="tf"></div></div><div id="dr"></div>`);
  renderQ(); renderBar(); startTick();
}
function renderBar(){
  const r = score(), a = r.c + r.w;
  $('#qn').textContent = `Question ${S.cur + 1} of ${N}`;
  $('#ty').innerHTML = `<span class="g">${r.c} right</span><span class="r">${r.w} wrong</span>`;
  $('#pb').style.width = (100 * a / N) + '%';
  paintTimer();
}
function renderQ(){
  const i = S.cur, q = T.q[i], sec = secOf(q.s), picked = S.ans[i], done = picked >= 0;
  let h = `<div class="qmeta"><span class="chip">${esc(sec.name)}</span><span class="sp"></span>
    <button class="b sm ghost" data-a="mark" aria-pressed="${!!S.mk[i]}">${I('flag')}${S.mk[i] ? 'Marked' : 'Mark for later'}</button></div>
    <h2 class="qtext">${esc(q.q)}</h2><div class="opts" role="group" aria-label="Answer options">`;
  q.o.forEach((o, k) => {
    let c = 'opt', mark = L[k], sr = '';
    if(done){
      c += ' locked';
      if(k === q.a){ c += ' right'; mark = I('check'); sr = picked === k ? 'Your answer, correct. ' : 'Correct answer. '; }
      else if(k === picked){ c += ' wrong'; mark = I('x'); sr = 'Your answer, incorrect. '; }
      else c += ' dim';
    }
    h += `<button class="${c}" data-a="opt" data-k="${k}"${done ? ' aria-disabled="true"' : ''}><span class="k">${mark}</span><span>${sr ? `<span class="sr">${sr}</span>` : ''}${esc(o)}</span></button>`;
  });
  h += '</div>';
  if(done){
    const ok = picked === q.a;
    h += `<div class="fb ${ok ? 'ok' : 'bad'}" role="status">${I(ok ? 'check' : 'x')}<div>${ok ? 'Correct · +1' : 'Incorrect · −0.25'}${ok ? '' : `<small>Correct answer: <b>${L[q.a]}</b>. ${esc(q.o[q.a])}</small>`}</div></div>
      <div class="fbrow"><button class="b sm" data-a="exp" aria-expanded="${showExp}">${I('bulb')}${showExp ? 'Hide explanation' : 'Show explanation'}</button></div>`;
    if(showExp) h += `<div class="expl">${q.e ? esc(q.e) : 'No explanation is stored for this question.'}</div>`;
  }
  h += '<div class="keys"><kbd>1</kbd>–<kbd>4</kbd> or <kbd>A</kbd>–<kbd>D</kbd> answer · <kbd>E</kbd> explanation · <kbd>←</kbd> <kbd>→</kbd> move · <kbd>M</kbd> mark</div>';
  $('#qc').innerHTML = h;
  const lastQ = i === N - 1;
  $('#tf').innerHTML = `<button class="b" data-a="prev"${i === 0 ? ' disabled' : ''}>${I('back')}Previous</button><span class="sp"></span>`
    + (lastQ ? '<button class="b pri" data-a="finish">Finish test</button>'
             : `<button class="b${done ? ' pri' : ''}" data-a="next">${done ? 'Next' : 'Skip'}${I('next')}</button>`);
}
function pick(k){
  const i = S.cur; if(S.ans[i] >= 0) return;
  S.ans[i] = k; showExp = false; save(); renderQ(); renderBar();
  const f = $('.fb'); if(f) f.scrollIntoView({block:'nearest', behavior:'smooth'});
}
function toggleExp(){
  showExp = !showExp; renderQ();
  if(showExp){ const x = $('.expl'); if(x) x.scrollIntoView({block:'nearest', behavior:'smooth'}); }
}
function go(i){
  S.cur = Math.max(0, Math.min(N - 1, i)); showExp = false; save(); renderQ(); renderBar(); window.scrollTo(0, 0);
}
function renderDrawer(){
  const el = $('#dr'); if(!el) return;
  if(!drawer){ el.innerHTML = ''; return; }
  const r = score();
  let h = `<div class="dov" data-a="pal-close"></div><aside class="drawer" role="dialog" aria-label="Question list"><div class="hd"><b>Questions</b><button class="ib" data-a="pal-close" aria-label="Close">${I('x')}</button></div>
    <div class="mut sm-t">${r.c + r.w} of ${N} answered · net ${f2(r.net)}</div>
    <div class="leg"><span><i class="r"></i>Right</span><span><i class="w"></i>Wrong</span><span><i></i>Not answered</span><span><i class="m"></i>Marked</span></div>`;
  T.sec.forEach(s => {
    h += `<div class="ph">${esc(s.name)}</div><div class="pg">`;
    for(let i = s.i0; i < s.i0 + s.n; i++){
      let c = 'pb'; const a = S.ans[i];
      if(a >= 0) c += a === T.q[i].a ? ' r' : ' w';
      if(S.mk[i]) c += ' m'; if(i === S.cur) c += ' c';
      h += `<button class="${c}" data-a="go" data-i="${i}" aria-label="Question ${i + 1}">${i + 1}</button>`;
    }
    h += '</div>';
  });
  h += '<div class="fin"><button class="b pri block" data-a="finish">Finish test</button></div></aside>';
  el.innerHTML = h;
}

/* ---------- timer ---------- */
function mmss(s){ s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function paintTimer(){
  const el = $('#tm'); if(!el) return;
  if(S.limit){ const rem = S.limit - S.used; el.textContent = mmss(rem) + ' left'; el.classList.toggle('low', rem < 600); }
  else{ el.textContent = mmss(S.used); el.classList.remove('low'); }
}
function stopTick(){ if(tickT){ clearInterval(tickT); tickT = null; } }
function startTick(){ stopTick(); last = Date.now(); tickT = setInterval(tick, 1000); }
function tick(){
  const now = Date.now(), dt = Math.min(5, (now - last) / 1000); last = now;
  if(document.visibilityState === 'visible') S.used += dt;
  paintTimer(); if(++ticks % 5 === 0) save();
  if(S.limit && S.used >= S.limit) finish(true);
}
document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'hidden' && S.on && !S.done) save(); });

/* ---------- finish + result ---------- */
async function finish(auto){
  const r = score();
  if(!auto){
    if(r.c + r.w === 0){ await ask('Nothing answered yet', 'Answer at least one question before finishing.', 'OK', false); return; }
    const ok = await ask('Finish this test?',
      r.u ? `${r.u} question${r.u > 1 ? 's are' : ' is'} still unanswered and will count as skipped.` : 'Every question is answered. You will see your result and get your PDF report.',
      'Finish and see result', 'Keep going');
    if(!ok) return;
  }
  stopTick(); drawer = false;
  S.done = true; S.used = usedSec(); S.fin = Date.now(); if(!S.aid) S.aid = SPSC.newId();
  save();
  if(r.c + r.w > 0) SPSC.examDone(repCtx());
  showResult();
}
function showResult(){
  stopTick();
  const r = score(), pass = r.net >= R.pass, att = r.c + r.w;
  const rows = T.sec.map(s => { const z = r.sec[s.k], a = z.c + z.w;
    return `<tr><td>${esc(s.name)}</td><td class="n">${z.n}</td><td class="n">${z.c}</td><td class="n">${z.w}</td><td class="n">${z.u}</td><td class="n">${f2(z.c - R.minus * z.w)}</td><td class="n">${a ? Math.round(100 * z.c / a) + '%' : '–'}</td></tr>`; }).join('');
  const mm = Math.floor(usedSec() / 60), pm = 100 * R.pass / N, fill = 100 * Math.max(0, r.net) / N;
  view(`<div class="wrap">${topStrip()}
  <div class="hero"><h1>${esc(T.title)} · result</h1></div>
  <div class="card"><div class="big ${pass ? 'pass' : 'fail'}">${f2(r.net)} <small>/ ${N}</small></div>
   <p style="margin:.6rem 0 0"><span class="chip ${pass ? 'ok' : 'bad'}">${pass ? 'Above the pass mark' : 'Below the pass mark'}</span>
    <span class="mut sm-t"> pass = ${f2(R.pass)} net · ${pass ? 'margin +' + f2(r.net - R.pass) : 'short by ' + f2(R.pass - r.net)}</span></p>
   <div class="meter ${pass ? '' : 'low'}"><i style="width:${fill}%"></i><u style="left:${pm}%"></u></div>
   <div class="meter-l" style="position:relative;height:1.1rem"><span>0</span><span style="position:absolute;left:${pm}%;transform:translateX(-50%)">Pass ${f2(R.pass)}</span><span>${N}</span></div>
   <div class="stats"><div class="stat"><b>${r.c}</b><span>right (+${r.c})</span></div><div class="stat"><b>${r.w}</b><span>wrong (−${f2(r.w * R.minus)})</span></div><div class="stat"><b>${r.u}</b><span>skipped</span></div><div class="stat"><b>${att ? Math.round(100 * r.c / att) : 0}%</b><span>accuracy</span></div><div class="stat"><b>${mm} min</b><span>time used</span></div></div>
   <div class="note">Guess audit: your wrong answers cost ${f2(r.w * R.minus)} marks. Skipping every one of them would have scored ${r.c}. Guess only after eliminating at least one option.</div></div>
  <div id="spsc-report"></div>
  <div class="card sc"><h3>By section</h3><table><tr><th>Section</th><th class="n">Qs</th><th class="n">Right</th><th class="n">Wrong</th><th class="n">Skipped</th><th class="n">Net</th><th class="n">Accuracy</th></tr>${rows}</table></div>
  <div class="actions" style="margin:1rem 0"><button class="b pri" data-a="flash-missed">${I('cards')}Flashcards: missed + skipped (${r.w + r.u})</button><button class="b" data-a="reset">Take it again</button>${T.kind === 'custom' ? '<a class="b" href="practice.html#build">New custom test</a>' : ''}<button class="b ghost" data-a="home">Test overview</button></div>
  <h2 id="rev">Review your answers</h2><div class="tabs" id="tabs"></div><div id="rl"></div></div>`);
  SPSC.paintReport(repCtx());
  renderReview();
}
function renderReview(){
  const tabs = [['wrong', 'Wrong'], ['skip', 'Skipped'], ['mark', 'Marked'], ['ok', 'Right'], ['all', 'All']];
  $('#tabs').innerHTML = tabs.map(t => `<button class="b${filt === t[0] ? ' on' : ''}" data-a="filt" data-f="${t[0]}">${t[1]}</button>`).join('');
  let h = '';
  T.q.forEach((q, i) => {
    const a = S.ans[i], st = a < 0 ? 'un' : (a === q.a ? 'ok' : 'bad');
    const show = filt === 'all' || (filt === 'wrong' && st === 'bad') || (filt === 'skip' && st === 'un') || (filt === 'ok' && st === 'ok') || (filt === 'mark' && S.mk[i]);
    if(!show) return;
    h += `<div class="card rv ${st}"><div class="qmeta" style="margin:0"><span class="chip">${esc(secOf(q.s).name)}</span><span class="mut sm-t">Q${i + 1}</span></div><div class="qtext">${esc(q.q)}</div>
      <div class="ans">Your answer: <b>${a < 0 ? 'skipped' : L[a] + '. ' + esc(q.o[a])}</b></div>
      <div class="ans">Correct: <b class="pass">${L[q.a]}. ${esc(q.o[q.a])}</b></div>
      ${q.e ? `<details><summary>Explanation</summary><div class="expl">${esc(q.e)}</div></details>` : ''}</div>`;
  });
  $('#rl').innerHTML = h || '<p class="mut">Nothing in this view.</p>';
}

/* ---------- flashcards ---------- */
function startFlash(idx, label){ FS = {deck:idx, pos:0, show:false, exp:false, know:0, miss:[], label:label || 'All questions'}; renderFlash(); }
function renderFlash(){
  stopTick();
  const back = '<a class="back" href="#" data-a="home">' + I('back') + ' Test overview</a>';
  if(!FS.deck.length){ view(`<div class="wrap">${topStrip(back)}<div class="card"><p>Nothing to review here.</p><button class="b" data-a="home">Back</button></div></div>`); return; }
  if(FS.pos >= FS.deck.length){
    view(`<div class="wrap">${topStrip(back)}<div class="hero"><h1>Deck finished</h1></div><div class="card"><p>${FS.know} known · ${FS.miss.length} missed (${esc(FS.label)}).</p>
      <div class="actions">${FS.miss.length ? '<button class="b pri" data-a="flash-redo">Redo the missed ones</button>' : ''}<button class="b" data-a="home">Test overview</button></div></div></div>`);
    return;
  }
  const i = FS.deck[FS.pos], q = T.q[i];
  view(`<div class="wrap">${topStrip(back)}
   <div class="mut sm-t">${esc(FS.label)} · card ${FS.pos + 1} of ${FS.deck.length}</div><div class="bar"><i style="width:${100 * FS.pos / FS.deck.length}%"></i></div>
   <div class="card fc"><div class="qmeta"><span class="chip">${esc(secOf(q.s).name)}</span></div><h2 class="qtext">${esc(q.q)}</h2>
   ${FS.show ? `<div class="fb ok">${I('check')}<div>${L[q.a]}. ${esc(q.o[q.a])}</div></div>
     <div class="fbrow"><button class="b sm" data-a="fexp">${I('bulb')}${FS.exp ? 'Hide explanation' : 'Show explanation'}</button></div>${FS.exp ? `<div class="expl">${q.e ? esc(q.e) : 'No explanation is stored for this question.'}</div>` : ''}
     <div class="actions" style="margin-top:1.2rem"><button class="b pri" data-a="fk">I knew it</button><button class="b" data-a="fm">Missed it</button></div>`
   : `<div style="margin-bottom:1rem">${q.o.map((o, k) => `<div class="ol">${L[k]}. ${esc(o)}</div>`).join('')}</div><div class="actions"><button class="b pri" data-a="fshow">Show answer</button></div>`}
   </div></div>`);
}

/* ---------- events ---------- */
app.addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if(!b) return;
  const a = b.dataset.a;
  if(a === 'home'){ e.preventDefault(); showStart(); }
  else if(a === 'start') startTest();
  else if(a === 'start-flash') startFlash(T.q.map((_, i) => i), 'All questions');
  else if(a === 'resume') showTest();
  else if(a === 'reset') resetTest();
  else if(a === 'view-result') showResult();
  else if(a === 'opt') pick(+b.dataset.k);
  else if(a === 'next') go(S.cur + 1);
  else if(a === 'prev') go(S.cur - 1);
  else if(a === 'exp'){ toggleExp(); }
  else if(a === 'mark'){ S.mk[S.cur] = S.mk[S.cur] ? 0 : 1; save(); renderQ(); }
  else if(a === 'pal'){ drawer = true; renderDrawer(); }
  else if(a === 'pal-close'){ drawer = false; renderDrawer(); }
  else if(a === 'go'){ drawer = false; renderDrawer(); go(+b.dataset.i); }
  else if(a === 'finish'){ finish(false); }
  else if(a === 'filt'){ filt = b.dataset.f; renderReview(); }
  else if(a === 'flash-missed'){ const d = []; T.q.forEach((q, i) => { if(S.ans[i] !== q.a) d.push(i); }); startFlash(d, 'Missed + skipped'); }
  else if(a === 'fshow'){ FS.show = true; renderFlash(); }
  else if(a === 'fexp'){ FS.exp = !FS.exp; renderFlash(); }
  else if(a === 'fk'){ FS.know++; FS.pos++; FS.show = false; FS.exp = false; renderFlash(); }
  else if(a === 'fm'){ FS.miss.push(FS.deck[FS.pos]); FS.pos++; FS.show = false; FS.exp = false; renderFlash(); }
  else if(a === 'flash-redo') startFlash(FS.miss.slice(), 'Redo missed');
});
document.addEventListener('keydown', e => {
  if(!$('#qc') || !S.on || S.done || drawer || $('#dlg') || e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target; if(t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
  const k = e.key.toLowerCase();
  if(k.length === 1 && '1234'.includes(k)) pick(+k - 1);
  else if(k.length === 1 && 'abcd'.includes(k)) pick('abcd'.indexOf(k));
  else if(k === 'arrowright' || k === 'n') go(S.cur + 1);
  else if(k === 'arrowleft' || k === 'p') go(S.cur - 1);
  else if(k === 'e' && S.ans[S.cur] >= 0){ toggleExp(); }
  else if(k === 'm'){ S.mk[S.cur] = S.mk[S.cur] ? 0 : 1; save(); renderQ(); }
});

if(S.done) showResult(); else if(S.on) showTest(); else showStart();
}
SPSC.guard({test:T, mount:'#app', start:engine});
}
})();
