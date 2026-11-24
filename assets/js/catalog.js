/* assets/js/catalog.js : the home page. Reads data/catalog.json, shows the Easy / Medium / Hard lists,
   the user's progress and recent results. Nothing about the tests is hard-coded here. */
(function(){
'use strict';
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad = n => String(n).padStart(2, '0');
const f2 = x => (Math.round(x * 100) / 100).toFixed(2);
const ic = n => (window.UI ? UI.icon(n) : '');
const PER_ROW = 7;

let CAT = null, hist = [], live = 0, level = 'easy';

/* static bits */
$('t1').innerHTML = '<i>01</i><b>One question at a time</b><span>A clean screen per question, like the real computer-based test.</span>';
$('t2').innerHTML = '<i>02</i><b>Instant feedback</b><span>Tap an answer and see at once if it is right. Explanations are optional.</span>';
$('t3').innerHTML = '<i>03</i><b>PDF report by email</b><span>Every finished test is saved to your account and mailed to you.</span>';

if(!window.SPSC) $('bn').innerHTML = '<div class="banner warn"><div class="tx">Could not load the sign-in files. Check your connection and reload.</div></div>';

const tests = lv => CAT.tests.filter(t => t.level === lv);
const byId = id => CAT.tests.find(t => t.id === id);
const lvlOfHash = () => { const h = location.hash.slice(1).toLowerCase(); return h === 'std' || h === 'standard' ? 'easy' : (CAT && CAT.levels[h] ? h : null); };

function setLevel(v){
  level = v;
  try{ localStorage.setItem('spsc_level', v); }catch(e){}
  try{ history.replaceState(null, '', '#' + v); }catch(e){}
  paint();
}

function lead(){
  const n = CAT.tests.length, names = Object.values(CAT.levels).map(l => l.name);
  $('lead').textContent = n + ' full-length mock tests for the ' + CAT.exam.name + ' screening test, at three levels: ' + names.join(', ') + '. 200 questions each, marked +1 right, −'
    + Math.abs(CAT.marking.wrong) + ' wrong, with a pass mark of ' + CAT.marking.pass + ' net.';
  const days = Math.ceil((new Date(CAT.exam.date) - new Date()) / 86400000);
  if(days >= 1) $('cd').innerHTML = '<span class="chip warn countdown">' + ic('clock').replace('<svg', '<svg style="width:.9rem;height:.9rem"') + (days === 1 ? 'Exam is tomorrow' : days + ' days to the exam') + ' · ' + esc(CAT.exam.dateLabel) + '</span>';
}

function banner(){
  const s = SPSC.state(), el = $('bn');
  if(!SPSC.configured) el.innerHTML = '<div class="banner warn"><div class="tx"><b>Login is not set up yet.</b> The site owner still has to add the Firebase configuration (see docs/instructions.md). You can browse the tests but not attempt them.</div></div>';
  else if(!s.ready) el.innerHTML = '';
  else if(s.user && !s.verified) el.innerHTML = '<div class="banner warn"><div class="tx"><b>Verify your email to continue.</b> We sent a link to ' + esc(s.email) + '.</div><button class="b pri sm" id="bv">Verify email</button></div>';
  else if(!s.user) el.innerHTML = '<div class="banner"><div class="tx"><b>Browse freely.</b> Log in to attempt a test, keep your own scores and get a PDF report by email.</div><button class="b pri sm" id="bl">Log in</button><button class="b sm" id="bs">Create account</button></div>';
  else el.innerHTML = '';
  if($('bv')) $('bv').onclick = () => SPSC.openAuth({view:'verify'});
  if($('bl')) $('bl').onclick = () => SPSC.openAuth({view:'login'});
  if($('bs')) $('bs').onclick = () => SPSC.openAuth({view:'signup'});
}

function stats(){
  const s = SPSC.state(), el = $('st'), L = CAT.levels[level].name, PASS = CAT.marking.pass;
  if(!s.verified){ el.innerHTML = ''; return; }
  if(!hist.length){ el.innerHTML = '<div class="card"><h3>Your progress</h3><p class="mut" style="margin:0">No finished tests yet. Finish one and your score, history and report will show up here.</p></div>'; return; }
  const ids = new Set(tests(level).map(t => t.id)), lh = hist.filter(x => ids.has(x.test));
  if(!lh.length){ el.innerHTML = '<div class="card"><h3>Your progress · ' + L + '</h3><p class="mut" style="margin:0">No finished ' + L + ' tests yet.</p></div>'; return; }
  const nets = lh.map(x => x.net), best = Math.max.apply(null, nets), avg = nets.reduce((a, b) => a + b, 0) / nets.length;
  const passes = nets.filter(n => n >= PASS).length, done = new Set(lh.map(x => x.test)).size;
  el.innerHTML = '<div class="card"><h3>Your progress · ' + L + '</h3><div class="spsc-stats">'
    + '<div><b>' + lh.length + '</b><span>finished tests</span></div>'
    + '<div><b>' + done + '/' + ids.size + '</b><span>different tests</span></div>'
    + '<div><b>' + f2(best) + '</b><span>best net score</span></div>'
    + '<div><b>' + f2(avg) + '</b><span>average net</span></div>'
    + '<div><b>' + passes + '</b><span>at or above ' + PASS + '</span></div></div></div>';
}

function progressOf(id){
  try{ const x = JSON.parse(localStorage.getItem(SPSC.ns('u' + id))); if(x && x.ans && x.on && !x.done) return x.ans.filter(v => v >= 0).length; }catch(e){}
  return 0;
}
function card(t, locked, pre){
  const PASS = CAT.marking.pass, h = hist.filter(x => x.test === t.id).sort((a, b) => a.ts - b.ts);
  const prog = locked ? 0 : progressOf(t.id);
  let st = '', bar = '';
  if(pre) st = '&nbsp;';
  else if(locked) st = 'Log in to attempt';
  else if(prog){ st = '<b>' + prog + '</b> / ' + t.count + ' answered'; bar = '<div class="pbar"><i style="width:' + (100 * prog / t.count) + '%"></i></div>'; }
  else if(h.length){
    const last = h[h.length - 1], best = Math.max.apply(null, h.map(x => x.net));
    st = '<span class="dot ' + (last.net >= PASS ? 'ok' : 'bad') + '"></span>Last <b>' + f2(last.net) + '</b> · best ' + f2(best) + ' · ' + h.length + (h.length > 1 ? ' tries' : ' try');
  }else st = 'Not started';
  return '<a class="tc ' + t.level + '" href="test.html?t=' + t.key + '" data-go="1">' + (locked && !pre ? '<span class="lk" title="Login required">' + ic('lock') + '</span>' : '')
    + '<span class="no">' + pad(t.n) + '</span><span class="nm">' + esc(t.title) + '</span><span class="me">' + t.count + ' questions · ' + CAT.marking.minutes + ' min</span>'
    + '<span class="st">' + st + '</span>' + bar + '</a>';
}
function lvlBar(){
  $('lv').innerHTML = '<div class="lvl"><div class="seg" role="group" aria-label="Difficulty">'
    + Object.keys(CAT.levels).map(k => '<button type="button" data-lv="' + k + '" aria-pressed="' + (level === k) + '">' + esc(CAT.levels[k].name) + ' · ' + tests(k).length + '</button>').join('')
    + '</div><p class="lvl-note">' + CAT.levels[level].note + '</p></div>';
  $('lv').querySelectorAll('button').forEach(b => { b.onclick = () => setLevel(b.getAttribute('data-lv')); });
}
function grid(){
  const s0 = SPSC.state(), pre = !!SPSC.configured && !s0.ready, locked = !s0.verified;
  lvlBar();
  const list = tests(level).sort((a, b) => a.n - b.n), want = CAT.levels[level].tests;
  let out = '';
  for(let i = 0; i < list.length; i += PER_ROW){
    const part = list.slice(i, i + PER_ROW);
    out += '<div class="week"><h2>Tests ' + pad(part[0].n) + ' to ' + pad(part[part.length - 1].n) + '</h2></div><div class="grid">' + part.map(t => card(t, locked, pre)).join('') + '</div>';
  }
  if(!list.length) out = '<div class="card"><p class="mut" style="margin:0">No ' + esc(CAT.levels[level].name) + ' tests are published yet.</p></div>';
  else if(list.length < want) out += '<p class="mut sm-t">' + list.length + ' of ' + want + ' ' + esc(CAT.levels[level].name) + ' tests are ready. The rest are being written.</p>';
  $('g').innerHTML = out;
}

function recent(){
  const s = SPSC.state(), el = $('rc'), PASS = CAT.marking.pass;
  if(!s.verified || !hist.length){ el.innerHTML = ''; return; }
  const rows = hist.slice(0, 10).map(x => {
    const d = new Date(x.ts), ok = x.net >= PASS, t = byId(x.test);
    const when = d.toLocaleDateString(undefined, {day:'numeric', month:'short', year:'numeric'}) + ' ' + d.toLocaleTimeString(undefined, {hour:'2-digit', minute:'2-digit'});
    return '<tr><td>' + (t ? '<a href="test.html?t=' + t.key + '">' + esc(t.title) + '</a>' : esc(x.title || 'Test ' + x.test)) + '</td><td>' + esc(when) + '</td>'
      + '<td class="n">' + x.c + '</td><td class="n">' + x.w + '</td><td class="n">' + x.u + '</td><td class="n"><b class="' + (ok ? 'pass' : 'fail') + '">' + f2(Number(x.net)) + '</b></td><td>' + (ok ? 'Pass' : 'Below') + '</td></tr>';
  }).join('');
  el.innerHTML = '<h2>Recent tests</h2><div class="card sc"><table><tr><th>Test</th><th>When</th><th class="n">Right</th><th class="n">Wrong</th><th class="n">Skipped</th><th class="n">Net</th><th>vs ' + PASS + '</th></tr>' + rows + '</table></div>';
}

function paint(){ banner(); stats(); grid(); recent(); SPSC.paintAcct(); }

async function refresh(){
  const my = ++live, s = SPSC.state();
  hist = s.verified ? SPSC.cachedHistory() : [];
  paint();
  if(s.verified){
    const h = await SPSC.history();
    if(my === live){ hist = h; paint(); }
  }
}

document.addEventListener('click', e => {
  const a = e.target.closest('a[data-go]');
  if(!a || e.ctrlKey || e.metaKey || e.shiftKey || e.button) return;
  if(SPSC.state().verified) return;
  e.preventDefault();
  SPSC.requireLogin(() => { location.href = a.getAttribute('href'); });
});
window.addEventListener('hashchange', () => { const v = lvlOfHash(); if(CAT && v) setLevel(v); });

if(window.SPSC){
  fetch('data/catalog.json').then(r => r.json()).then(c => {
    CAT = c;
    let saved = null; try{ saved = localStorage.getItem('spsc_level'); }catch(e){}
    if(saved === 'std') saved = 'easy';
    level = lvlOfHash() || (CAT.levels[saved] ? saved : 'easy');
    lead(); paint(); SPSC.onAuth(refresh);
  }).catch(() => { $('bn').innerHTML = '<div class="banner warn"><div class="tx">Could not load the test list. Check your connection and reload.</div></div>'; });
}
})();
