/* assets/js/practice.js : practice.html. Two tabs:
   "By subject": a subject at a level, cut into sets of about 50 questions (test.html?t=s-hard-mth-3).
   "Build your own": pick level, subjects and length; opens test.html?t=custom&... with a fresh random seed.
   The sets and the draw come from pool.js, which reads data/pool/. Nothing about questions lives here. */
(function(){
'use strict';
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const f2 = x => (Math.round(x * 100) / 100).toString();
const lsGet = k => { try{ return localStorage.getItem(k); }catch(e){ return null; } };
const lsSet = (k, v) => { try{ localStorage.setItem(k, v); }catch(e){} };
const seed = () => Math.random().toString(36).slice(2, 8);
const PRESETS = [25, 50, 100, 200];

let CAT = null, hist = [], live = 0, tab = 'sets', lv = 'easy', subj = 'ENG';
let B = {l:'easy', s:[], n:50, m:'p'};

/* ---------- helpers ---------- */
const keys = () => CAT.sections.map(s => s.k);
const sname = k => CAT.sections.find(s => s.k === k).name;
const locked = () => !SPSC.state().verified;
function accuracy(k){
  let c = 0, w = 0;
  hist.forEach(x => { const z = x.sec && x.sec[k]; if(z){ c += z.c; w += z.w; } });
  return c + w >= 5 ? Math.round(100 * c / (c + w)) : null;
}
function answered(sk){
  try{ const x = JSON.parse(lsGet(SPSC.ns('u' + sk))); if(x && x.on && !x.done) return x.ans.filter(v => v >= 0).length; }catch(e){}
  return 0;
}
function inProgress(){
  const pre = SPSC.ns('uc_'), out = [];
  try{ for(let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i); if(k.indexOf(pre) !== 0) continue;
    const x = JSON.parse(localStorage.getItem(k)); if(x && x.on && !x.done && x.u && x.t) out.push(x); } }catch(e){}
  return out;
}
const levelBar = (id, withMix, cur) => '<div class="seg" id="' + id + '" role="group" aria-label="Level">'
  + Object.keys(CAT.levels).concat(withMix ? ['mix'] : []).map(k => '<button type="button" data-lv="' + k + '" aria-pressed="' + (cur === k) + '">' + esc(k === 'mix' ? 'Mixed' : CAT.levels[k].name) + '</button>').join('') + '</div>';

/* ---------- tab 1: subject sets ---------- */
function setCard(k, i){
  const key = POOL.setKey(lv, k, i), n = POOL.setSize(CAT, lv, k, i), id = POOL.subjectId(CAT, lv, k), title = POOL.setTitle(CAT, lv, k, i);
  const h = hist.filter(x => x.test === id && x.title === title).sort((a, b) => a.ts - b.ts), prog = locked() ? 0 : answered(key);
  let st = '', bar = '';
  if(locked()) st = 'Log in to attempt';
  else if(prog){ st = '<b>' + prog + '</b> / ' + n + ' answered'; bar = '<div class="pbar"><i style="width:' + (100 * prog / n) + '%"></i></div>'; }
  else if(h.length){ const last = h[h.length - 1], best = Math.max.apply(null, h.map(x => x.net)); st = '<span class="dot ' + (last.net >= POOL.passFor(CAT, n) ? 'ok' : 'bad') + '"></span>Last <b>' + f2(last.net) + '</b> · best ' + f2(best); }
  else st = 'Not started';
  return '<a class="tc ' + lv + '" href="test.html?t=' + key + '" data-go="1"><span class="no">' + POOL.pad(i) + '</span><span class="nm">' + esc(CAT.sections.find(s => s.k === k).short) + ' · ' + esc(CAT.levels[lv].name) + '</span>'
    + '<span class="me">' + n + ' questions · ' + POOL.minutesFor(CAT, n) + ' min</span><span class="st">' + st + '</span>' + bar + '</a>';
}
function paintSets(){
  let h = levelBar('pr-lv', false, lv) + '<p class="lvl-note">' + CAT.levels[lv].note + '</p><div class="pr-subj" role="group" aria-label="Subject">';
  CAT.sections.forEach(s => {
    const a = accuracy(s.k), m = POOL.setsOf(CAT, lv, s.k);
    h += '<button type="button" data-sub="' + s.k + '" aria-pressed="' + (subj === s.k) + '"><b>' + esc(s.name) + '</b><span>' + m + ' sets · ' + CAT.pools[lv][s.k] + ' Qs</span>' + (a == null ? '' : '<em>' + a + '% right so far</em>') + '</button>';
  });
  h += '</div>';
  const m = POOL.setsOf(CAT, lv, subj);
  h += '<div class="week"><h2>' + esc(sname(subj)) + ' · ' + esc(CAT.levels[lv].name) + '</h2><span>' + m + ' sets · ' + CAT.pools[lv][subj] + ' questions</span></div><div class="grid">';
  for(let i = 1; i <= m; i++) h += setCard(subj, i);
  return h + '</div>';
}

/* ---------- tab 2: build your own ---------- */
function clampBuild(){
  B.s = keys().filter(k => B.s.indexOf(k) >= 0);
  const cap = B.s.reduce((t, k) => t + POOL.avail(CAT, B.l, k), 0), P = CAT.practice;
  B.n = Math.max(P.customMin, Math.min(P.customMax, cap || P.customMax, Math.round(+B.n) || 50));
  return cap;
}
function url(){ return 'test.html?' + POOL.query({l:B.l, s:B.s, n:B.n, m:B.m, r:seed()}); }
function summary(){
  const cap = clampBuild();
  if(!B.s.length) return {html:'<p class="mut" style="margin:0">Pick at least one subject.</p>', ok:false};
  const caps = {}; B.s.forEach(k => caps[k] = POOL.avail(CAT, B.l, k));
  const take = POOL.alloc(CAT, B.n, B.s, B.m, caps), n = B.s.reduce((t, k) => t + take[k], 0);
  return {ok:true, html:'<div class="secs">' + B.s.filter(k => take[k]).map(k => '<span><b>' + take[k] + '</b> ' + esc(CAT.sections.find(s => s.k === k).short) + '</span>').join('') + '</div>'
    + '<p class="mut sm-t" style="margin:.7rem 0 0">' + n + ' questions · ' + POOL.minutesFor(CAT, n) + ' min if you use the countdown · pass mark ' + f2(POOL.passFor(CAT, n)) + ' net'
    + '. Drawn from ' + cap + ' questions.</p>'};
}
function paintSum(){
  const s = summary(), go = $('pr-go'); if(!go) return;
  $('pr-sum').innerHTML = s.html;
  go.setAttribute('aria-disabled', String(!s.ok)); go.classList.toggle('off', !s.ok);
  go.setAttribute('href', s.ok ? url() : '#');
  document.querySelectorAll('[data-bn]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.bn === B.n)));
}
function paintBuild(){
  clampBuild();
  const rs = inProgress();
  let h = rs.length ? '<div class="card"><h3>In progress</h3><ul class="pr-res">' + rs.map(x => '<li><a href="test.html' + esc(x.u) + '">' + esc(x.t) + '</a><span class="mut">' + x.ans.filter(v => v >= 0).length + ' / ' + x.ans.length + ' answered</span></li>').join('') + '</ul></div>' : '';
  h += '<div class="card pr-build"><h3>1 · Level</h3>' + levelBar('pr-bl', true, B.l)
    + '<h3>2 · Subjects <span class="pr-all"><button type="button" class="spsc-link" data-all="1">All</button> · <button type="button" class="spsc-link" data-all="0">None</button></span></h3><div class="pr-subj" role="group" aria-label="Subjects">'
    + CAT.sections.map(s => '<button type="button" data-bs="' + s.k + '" aria-pressed="' + (B.s.indexOf(s.k) >= 0) + '"><b>' + esc(s.name) + '</b><span>' + POOL.avail(CAT, B.l, s.k) + ' Qs available</span></button>').join('') + '</div>'
    + '<h3>3 · Length</h3><div class="pr-len"><div class="seg" role="group" aria-label="Questions">' + PRESETS.map(n => '<button type="button" data-bn="' + n + '" aria-pressed="false">' + n + '</button>').join('') + '</div>'
    + '<label class="tp-sel">Or type a number <input id="pr-n" type="number" inputmode="numeric" min="' + CAT.practice.customMin + '" max="' + CAT.practice.customMax + '" value="' + B.n + '"></label></div>'
    + '<h3>4 · Mix</h3><label class="opt-row"><input type="radio" name="pr-m" value="p"' + (B.m === 'p' ? ' checked' : '') + '> Like the real paper (more English and Pakistan Affairs, fewer IT questions)</label>'
    + '<label class="opt-row"><input type="radio" name="pr-m" value="e"' + (B.m === 'e' ? ' checked' : '') + '> Equal number from each subject</label>'
    + '<h3>Your test</h3><div id="pr-sum"></div><div class="actions" style="margin-top:1.1rem"><a class="b pri" id="pr-go" href="#" data-go="1">Start test</a></div></div>';
  return h;
}

/* ---------- paint + events ---------- */
function paint(){
  SPSC.paintBanner($('bn'));
  $('pr-tabs').innerHTML = [['sets', 'By subject'], ['build', 'Build your own']].map(t => '<button type="button" data-tab="' + t[0] + '" aria-pressed="' + (tab === t[0]) + '">' + t[1] + '</button>').join('');
  $('pr-out').innerHTML = tab === 'sets' ? paintSets() : paintBuild();
  if(tab === 'build') paintSum();
  SPSC.paintAcct();
}
function save(){ lsSet('spsc_level', lv); lsSet('spsc_subj', subj); lsSet('spsc_build', JSON.stringify(B)); }
function setTab(t){ tab = t; try{ history.replaceState(null, '', t === 'build' ? '#build' : '#subjects'); }catch(e){} paint(); }

$('pr-tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if(b) setTab(b.dataset.tab); });
$('pr-out').addEventListener('click', e => {
  const b = e.target.closest('button, a#pr-go'); if(!b) return;
  if(b.id === 'pr-go'){ if(b.getAttribute('aria-disabled') === 'true') e.preventDefault(); else b.setAttribute('href', url()); return; }   /* fresh seed on every start */
  if(b.dataset.lv){ if(b.parentNode.id === 'pr-bl') B.l = b.dataset.lv; else lv = b.dataset.lv; }
  else if(b.dataset.sub) subj = b.dataset.sub;
  else if(b.dataset.bs){ const i = B.s.indexOf(b.dataset.bs); if(i >= 0) B.s.splice(i, 1); else B.s.push(b.dataset.bs); }
  else if(b.dataset.all) B.s = b.dataset.all === '1' ? keys() : [];
  else if(b.dataset.bn){ B.n = +b.dataset.bn; save(); paintSum(); $('pr-n').value = B.n; return; }
  else return;
  save(); paint();
});
$('pr-out').addEventListener('input', e => { if(e.target.id === 'pr-n'){ B.n = +e.target.value || B.n; save(); paintSum(); } });
$('pr-out').addEventListener('change', e => {
  if(e.target.name === 'pr-m'){ B.m = e.target.value; save(); paintSum(); }
  else if(e.target.id === 'pr-n') e.target.value = B.n;
});
window.addEventListener('hashchange', () => { const t = location.hash === '#build' ? 'build' : 'sets'; if(CAT && t !== tab) setTab(t); });
window.addEventListener('pageshow', e => { if(e.persisted && CAT) paint(); });

async function refresh(){
  const my = ++live, s = SPSC.state();
  hist = s.verified ? SPSC.cachedHistory() : [];
  paint();
  if(s.verified){ const h = await SPSC.history(); if(my === live){ hist = h; paint(); } }
}

fetch('data/catalog.json').then(r => r.json()).then(c => {
  CAT = c;
  const saved = lsGet('spsc_level'), sv = lsGet('spsc_subj');
  lv = CAT.levels[saved] ? saved : 'easy';
  subj = keys().indexOf(sv) >= 0 ? sv : keys()[0];
  try{ const b = JSON.parse(lsGet('spsc_build')); if(b && Array.isArray(b.s)) B = {l:b.l === 'mix' || CAT.levels[b.l] ? b.l : lv, s:b.s, n:b.n, m:b.m === 'e' ? 'e' : 'p'}; }catch(e){}
  if(!B.s.length) B.s = keys().slice(0, 1);
  tab = location.hash === '#build' ? 'build' : 'sets';
  SPSC.onAuth(refresh); refresh();
}).catch(() => { $('pr-out').innerHTML = '<div class="banner warn"><div class="tx">Could not load the test list. Check your connection and reload.</div></div>'; });
})();
