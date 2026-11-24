/* assets/js/app.js : Firebase login gate, per-user progress and score history, PDF report + email trigger.
   Plain browser JS, no build step. Needs assets/firebase-config.js and the vendored Firebase compat scripts. */
(function(){
'use strict';
const CFG = window.SPSC_CONFIG || {}, FBC = CFG.firebase || {};
const missing = v => !v || /PASTE/i.test(v);
const configured = !missing(FBC.apiKey) && !missing(FBC.projectId) && !missing(FBC.appId);
const mailOn = !missing(CFG.mailEndpoint);
const NS = 'spsc26v3_';
const SRC = (document.currentScript && document.currentScript.src) || '';
const BASE = SRC.slice(0, SRC.lastIndexOf('/') + 1);
const $ = (s, r) => (r || document).querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const f2 = x => (Math.round(x * 100) / 100).toString();
const lsGet = (k, d) => { try{ const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); }catch(e){ return d; } };
const lsSet = (k, v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
const newId = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

let auth = null, db = null, user = null, ready = false, initError = '';
const subs = [];
let profiled = '', current = null;

const verified = u => !!(u && u.emailVerified);
const uid = () => (user && user.uid) || 'anon';
const nameOf = u => (u && (u.displayName || (u.email || '').split('@')[0])) || '';

/* ---------------- init ---------------- */
function init(){
  if(!configured){ ready = true; return; }
  if(!window.firebase || !firebase.initializeApp){ initError = 'Could not load the sign-in library. Check your connection and reload.'; ready = true; return; }
  try{
    firebase.initializeApp(FBC);
    auth = firebase.auth();
    db = firebase.firestore();
    try{ db.settings({experimentalAutoDetectLongPolling:true, merge:true}); }catch(e){}
  }catch(e){ initError = 'Sign-in could not start: ' + (e.message || e); ready = true; return; }
  auth.onAuthStateChanged(u => { user = u; ready = true; if(verified(u)) afterVerified(); emit(); });
}
function emit(){ subs.slice().forEach(fn => { try{ fn(user); }catch(e){ console.error(e); } }); paintAcct(); modalSync(); }
function onAuth(fn){ subs.push(fn); if(ready) setTimeout(() => fn(user), 0); }

/* ---------------- local + remote records (per user) ---------------- */
const histKey = () => NS + uid() + '_hist';
const localHist = () => lsGet(histKey(), {});
const putLocal = (aid, a) => { const h = localHist(); h[aid] = a; lsSet(histKey(), h); };
const attRef = aid => db.collection('users').doc(user.uid).collection('attempts').doc(aid);
const sortHist = h => Object.keys(h).map(k => Object.assign({aid:k}, h[k])).sort((a, b) => b.ts - a.ts);
function cachedHistory(){ return user ? sortHist(localHist()) : []; }

async function pushRemote(aid){
  if(!db || !verified(user)) return false;
  const a = localHist()[aid]; if(!a) return false;
  const data = Object.assign({}, a); delete data.synced;
  try{ await withTimeout(attRef(aid).set(data), 9000); a.synced = true; putLocal(aid, a); return true; }
  catch(e){ return false; }
}
async function history(){
  if(!user) return [];
  if(db && verified(user)){
    try{
      const snap = await withTimeout(db.collection('users').doc(user.uid).collection('attempts').orderBy('ts', 'desc').limit(300).get(), 10000);
      const h = localHist();
      snap.forEach(d => { h[d.id] = Object.assign({}, d.data(), {synced:true}); });
      lsSet(histKey(), h);
      Object.keys(h).filter(k => !h[k].synced).forEach(k => pushRemote(k));
    }catch(e){ /* offline or rules not set: fall back to the local cache */ }
  }
  return cachedHistory();
}
async function afterVerified(){
  if(!db || profiled === user.uid) return;
  profiled = user.uid;
  try{ await user.getIdToken(true); }catch(e){}
  try{ await withTimeout(db.collection('users').doc(user.uid).set({name:nameOf(user), email:user.email || '', updated:Date.now()}, {merge:true}), 9000); }catch(e){}
  const h = localHist(); Object.keys(h).filter(k => !h[k].synced).forEach(k => pushRemote(k));
}

/* ---------------- auth actions ---------------- */
const ERR = {
  'auth/invalid-email':'That email address does not look right.',
  'auth/missing-email':'Enter your email address.',
  'auth/missing-password':'Enter your password.',
  'auth/invalid-credential':'Email or password is wrong.',
  'auth/invalid-login-credentials':'Email or password is wrong.',
  'auth/wrong-password':'Email or password is wrong.',
  'auth/user-not-found':'Email or password is wrong.',
  'auth/email-already-in-use':'An account with this email already exists. Log in instead.',
  'auth/weak-password':'Choose a longer password (8 or more characters).',
  'auth/too-many-requests':'Too many attempts. Wait a few minutes and try again.',
  'auth/network-request-failed':'No connection. Check your internet and try again.',
  'auth/popup-closed-by-user':'The Google window was closed before finishing.',
  'auth/cancelled-popup-request':'The Google window was closed before finishing.',
  'auth/popup-blocked':'Your browser blocked the Google pop-up. Allow pop-ups for this site and try again.',
  'auth/unauthorized-domain':'This website address is not authorised in Firebase yet (instructions.md, step 1.6).',
  'auth/operation-not-allowed':'This sign-in method is not switched on in Firebase yet (instructions.md, step 1.3).',
  'auth/user-disabled':'This account has been disabled.',
  'auth/operation-not-supported-in-this-environment':'Login needs the website address (https:// or localhost), not a file opened from disk.'
};
const errText = e => ERR[e && e.code] || ((e && e.message) ? e.message.replace(/^Firebase: /, '') : 'Something went wrong. Try again.');

/* ---------------- modal ---------------- */
let modal = {open:false, view:'login', email:'', name:'', msg:null, busy:false, onSuccess:null}, poll = null;
function ensureModal(){
  if($('#spsc-auth')) return;
  const d = document.createElement('div');
  d.id = 'spsc-auth'; d.className = 'spsc-ov'; d.hidden = true;
  d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true');
  d.innerHTML = '<div class="spsc-box"><button class="spsc-x" data-spsc="close" aria-label="Close">×</button><div id="spsc-body"></div></div>';
  document.body.appendChild(d);
  d.addEventListener('mousedown', e => { if(e.target === d) closeModal(); });
}
function openAuth(o){
  o = o || {}; ensureModal();
  modal = {open:true, view:o.view || 'login', email:modal.email || '', name:modal.name || '', msg:null, busy:false, onSuccess:o.onSuccess || null};
  if(user && !verified(user)) modal.view = 'verify';
  $('#spsc-auth').hidden = false; renderModal();
  const f = $('#spsc-body input'); if(f) f.focus();
}
function closeModal(){ stopPoll(); modal.open = false; const m = $('#spsc-auth'); if(m) m.hidden = true; }
function modalSync(){
  if(!modal.open) return;
  if(verified(user)){ const cb = modal.onSuccess; closeModal(); modal.onSuccess = null; if(cb) cb(); return; }
  if(user && modal.view !== 'verify'){ modal.view = 'verify'; modal.msg = null; renderModal(); }
}
function setMsg(type, text){ modal.msg = text ? {type, text} : null; }
function readFields(){
  const b = $('#spsc-body'); if(!b) return {};
  const g = n => { const e = b.querySelector('[name=' + n + ']'); return e ? e.value : ''; };
  const o = {email:g('email').trim(), password:g('password'), name:g('name').trim()};
  if(o.email) modal.email = o.email; if(o.name) modal.name = o.name;
  return o;
}
function renderModal(){
  const b = $('#spsc-body'); if(!b) return;
  const v = modal.view, m = modal.msg, dis = modal.busy ? ' disabled' : '';
  const msg = m ? '<div class="spsc-msg ' + m.type + '" role="status">' + esc(m.text) + '</div>' : '';
  let h = '';
  if(!configured || initError){
    h = '<h2>Login is not set up yet</h2><p>' + esc(initError || 'This site has no Firebase configuration yet. The site owner needs to fill in assets/firebase-config.js (see instructions.md).') + '</p><button class="spsc-btn" data-spsc="close">Close</button>';
  }else if(v === 'verify'){
    h = '<h2>Verify your email</h2><p>We sent a link to <b>' + esc(user ? user.email : modal.email) + '</b>. Open it, then come back here. This page notices by itself.</p>'
      + '<button class="spsc-btn pri" data-spsc="check"' + dis + '>I have verified, continue</button>'
      + '<button class="spsc-btn" data-spsc="resend"' + dis + '>Send the email again</button>' + msg
      + '<div class="spsc-sw"><span class="mut">Wrong address?</span><button class="spsc-link" data-spsc="signout">Use another account</button></div>';
  }else if(v === 'reset'){
    h = '<h2>Reset password</h2><p class="mut">Enter your email and we will send a reset link.</p>'
      + '<form data-spsc-form="reset" novalidate><label class="spsc-f">Email<input type="email" name="email" autocomplete="email" value="' + esc(modal.email) + '" required></label>'
      + '<button class="spsc-btn pri" type="submit"' + dis + '>Send reset link</button></form>' + msg
      + '<div class="spsc-sw"><button class="spsc-link" data-spsc="view-login">Back to log in</button></div>';
  }else{
    const su = v === 'signup';
    h = '<h2>' + (su ? 'Create your account' : 'Log in') + '</h2><p class="mut">' + (su ? 'Your tests, scores and reports are kept under your own account.' : 'Log in to attempt the tests and keep your scores.') + '</p>'
      + '<button class="spsc-btn" data-spsc="google"' + dis + '>Continue with Google</button><div class="spsc-or">or use email</div>'
      + '<form data-spsc-form="' + v + '" novalidate>'
      + (su ? '<label class="spsc-f">Your name<input type="text" name="name" autocomplete="name" value="' + esc(modal.name) + '" required></label>' : '')
      + '<label class="spsc-f">Email<input type="email" name="email" autocomplete="email" value="' + esc(modal.email) + '" required></label>'
      + '<label class="spsc-f">Password<input type="password" name="password" autocomplete="' + (su ? 'new-password' : 'current-password') + '" required' + (su ? ' minlength="8"' : '') + '></label>'
      + '<label class="spsc-chk"><input type="checkbox" data-spsc="showpw"> Show password</label>'
      + '<button class="spsc-btn pri" type="submit"' + dis + '>' + (su ? 'Create account' : 'Log in') + '</button></form>' + msg
      + '<div class="spsc-sw">' + (su ? '<button class="spsc-link" data-spsc="view-login">I already have an account</button>'
        : '<button class="spsc-link" data-spsc="view-signup">Create account</button><button class="spsc-link" data-spsc="view-reset">Forgot password?</button>') + '</div>';
  }
  b.innerHTML = h;
  if(v === 'verify' && configured && !initError) startPoll();
}
function startPoll(){
  stopPoll();
  poll = setInterval(async () => {
    if(!auth || !auth.currentUser || !modal.open) return stopPoll();
    try{ await auth.currentUser.reload(); if(auth.currentUser.emailVerified){ await auth.currentUser.getIdToken(true); stopPoll(); user = auth.currentUser; afterVerified(); emit(); } }catch(e){}
  }, 4000);
}
function stopPoll(){ if(poll){ clearInterval(poll); poll = null; } }
async function busy(fn){
  modal.busy = true; renderModal();
  try{ await fn(); }catch(e){ setMsg('err', errText(e)); }
  modal.busy = false; if(modal.open) renderModal();
}

async function submitForm(kind){
  const f = readFields();
  if(kind === 'reset'){
    return busy(async () => { await auth.sendPasswordResetEmail(f.email); setMsg('ok', 'If an account exists for that email, a reset link is on its way. Check your inbox and spam folder.'); });
  }
  if(kind === 'signup'){
    if(f.name.length < 2){ setMsg('err', 'Enter your name.'); return renderModal(); }
    if(f.password.length < 8){ setMsg('err', 'Choose a password with at least 8 characters.'); return renderModal(); }
    return busy(async () => {
      const c = await auth.createUserWithEmailAndPassword(f.email, f.password);
      try{ await c.user.updateProfile({displayName:f.name}); }catch(e){}
      try{ await c.user.sendEmailVerification(); }catch(e){}
      user = auth.currentUser; modal.view = 'verify'; setMsg('info', 'Account created. Verification email sent.'); emit();
    });
  }
  return busy(async () => { await auth.signInWithEmailAndPassword(f.email, f.password); });
}

async function resendVerification(){
  return busy(async () => { await auth.currentUser.sendEmailVerification(); setMsg('ok', 'Sent again. Check your inbox and spam folder.'); });
}
async function checkVerified(){
  return busy(async () => {
    await auth.currentUser.reload();
    if(auth.currentUser.emailVerified){ await auth.currentUser.getIdToken(true); user = auth.currentUser; afterVerified(); emit(); }
    else setMsg('err', 'Not verified yet. Open the link in the email first.');
  });
}
function signOut(){ if(!auth) return; auth.signOut().then(() => location.reload()); }

/* ---------------- account line ---------------- */
function paintAcct(){
  document.querySelectorAll('.spsc-acct').forEach(el => {
    if(!ready) el.innerHTML = '';
    else if(verified(user)) el.innerHTML = 'Signed in as <b>' + esc(nameOf(user)) + '</b> <button class="spsc-link" data-spsc="signout">Sign out</button>';
    else if(user) el.innerHTML = 'Email not verified <button class="spsc-link" data-spsc="login">Verify</button> <button class="spsc-link" data-spsc="signout">Sign out</button>';
    else el.innerHTML = '<button class="spsc-link" data-spsc="login">Log in</button> or <button class="spsc-link" data-spsc="signup">create an account</button>';
  });
}

/* ---------------- login banner for list pages ---------------- */
function paintBanner(el){
  const open = (id, view) => { const b = $('#' + id, el); if(b) b.onclick = () => openAuth({view}); };
  if(!configured) el.innerHTML = '<div class="banner warn"><div class="tx"><b>Login is not set up yet.</b> The site owner still has to add the Firebase configuration (see instructions.md). You can browse the tests but not attempt them.</div></div>';
  else if(!ready) el.innerHTML = '';
  else if(user && !verified(user)) el.innerHTML = '<div class="banner warn"><div class="tx"><b>Verify your email to continue.</b> We sent a link to ' + esc(user.email) + '.</div><button class="b pri sm" id="bv">Verify email</button></div>';
  else if(!user) el.innerHTML = '<div class="banner"><div class="tx"><b>Browse freely.</b> Log in to attempt a test, keep your own scores and get a PDF report by email.</div><button class="b pri sm" id="bl">Log in</button><button class="b sm" id="bs">Create account</button></div>';
  else el.innerHTML = '';
  open('bv', 'verify'); open('bl', 'login'); open('bs', 'signup');
}

/* ---------------- gate for test pages ---------------- */
function gateHTML(T){
  const ic = n => (window.UI ? UI.icon(n) : '');
  const chips = (T.sec || []).map(s => '<span><b>' + s.n + '</b> ' + esc(s.name) + '</span>').join('');
  let card;
  if(!configured || initError){
    card = '<div class="lock">' + ic('warn') + '</div><h2>Login is not set up yet</h2><p class="mut">' + esc(initError || 'The site owner still has to add the Firebase configuration (instructions.md).') + '</p>';
  }else if(user && !verified(user)){
    card = '<div class="lock">' + ic('mail') + '</div><h2>Verify your email to continue</h2><p class="mut">Open the link we sent to ' + esc(user.email) + ', then press the button.</p><div class="actions"><button class="b pri" data-spsc="login">Verify email</button></div>';
  }else{
    card = '<div class="lock">' + ic('lock') + '</div><h2>Log in to attempt this test</h2><p class="mut">The tests are free. An account keeps your progress and scores separate and emails you a PDF report after every test.</p><div class="actions"><button class="b pri" data-spsc="login">Log in</button><button class="b" data-spsc="signup">Create account</button></div>';
  }
  return '<div class="wrap"><div class="site-top"><a class="back" href="' + esc(T.back || 'index.html') + '">' + ic('back') + (T.kind ? ' Practice' : ' All tests') + '</a><div class="right"><span class="spsc-acct"></span><span data-ui="ctl"></span></div></div>'
    + '<div class="hero"><h1>' + esc(T.title) + '</h1><p>' + T.q.length + ' questions · ' + (T.kind ? 'practice set' : 'SPSC CCE-2026 screening pattern') + '</p></div>'
    + '<div class="card spsc-gate">' + card + '</div>'
    + '<div class="card"><h3>Marking</h3><ul class="rule-list"><li>' + ic('check') + '<span><b>+1</b> right, <b>−0.25</b> wrong, <b>0</b> skipped. Pass mark <b>' + f2(T.pass || 66) + '</b> net (33%).</span></li></ul>'
    + '<h3 style="margin-top:1rem">Sections</h3><div class="secs">' + chips + '</div></div></div>';
}
function guard(o){
  const mount = $(o.mount || '#app'); let started = false;
  const draw = () => {
    if(started){ if(!verified(user)) location.reload(); return; }
    if(!ready){ mount.innerHTML = '<div class="wrap"><p class="mut">Checking sign-in…</p></div>'; return; }
    if(verified(user)){ started = true; o.start(); paintAcct(); return; }
    mount.innerHTML = gateHTML(o.test); paintAcct(); if(window.UI) UI.mount();
  };
  onAuth(draw); draw();
}

/* ---------------- exam finished: save, build PDF, email ---------------- */
let libsP = null;
function loadScript(src){ return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src)); document.head.appendChild(s); }); }
function loadReportLibs(){
  if(window.SPSC_REPORT && window.jspdf) return Promise.resolve();
  if(!libsP) libsP = loadScript(BASE + '../vendor/jspdf.umd.min.js').then(() => loadScript(BASE + '../vendor/jspdf.plugin.autotable.min.js')).then(() => loadScript(BASE + 'report.js')).catch(e => { libsP = null; throw e; });
  return libsP;
}
const stKey = aid => NS + uid() + '_rep_' + aid;
function setStatus(aid, st){
  lsSet(stKey(aid), st);
  if(current && current.aid === aid) paintStatus(st);
}
function paintStatus(st){
  const el = $('#spsc-rep-st'); if(!el) return;
  el.className = 'st ' + (st.state === 'ok' ? 'ok' : st.state === 'err' ? 'err' : 'work'); el.textContent = st.text;
  const rb = $('#spsc-rep button[data-spsc=resend]'); if(rb) rb.disabled = st.state === 'work';
}
const reportCtx = c => ({T:c.T, ans:c.ans, mode:c.mode, used:c.used, ts:c.ts, name:nameOf(user), email:user && user.email, aid:c.aid});
function toAttempt(c){
  const r = SECSCORE(c.T, c.ans), sec = {};
  Object.keys(r.sec).forEach(k => { const z = r.sec[k]; sec[k] = {n:z.n, c:z.c, w:z.w, u:z.u}; });
  return {v:1, test:c.T.id, title:c.T.title, mode:'exam', ts:c.ts, net:r.net, c:r.c, w:r.w, u:r.u, used:Math.min(20000, Math.max(0, Math.round(c.used || 0))), sec, emailed:false};
}
function SECSCORE(T, ans){
  let c = 0, w = 0, u = 0; const sec = {};
  T.sec.forEach(s => sec[s.k] = {n:0, c:0, w:0, u:0});
  T.q.forEach((q, i) => { const z = sec[q.s]; z.n++; if(ans[i] < 0){ u++; z.u++; } else if(ans[i] === q.a){ c++; z.c++; } else { w++; z.w++; } });
  return {c, w, u, net:c - 0.25 * w, sec};
}
let mailV2 = null;     /* does the deployed mailer know about tests that are not 200 questions? (Code.gs v2) */
const mailerV2 = () => mailV2 || (mailV2 = withTimeout(fetch(CFG.mailEndpoint).then(r => r.json()), 15000).then(j => !!(j && j.v >= 2)).catch(() => false));
async function emailReport(c){
  const who = user && user.email;
  if(!mailOn){ setStatus(c.aid, {state:'err', text:'Emailing is not switched on for this site yet (instructions.md, step 2). Your result is saved; download the PDF instead.'}); return false; }
  if(c.T.q.length !== 200 && !await mailerV2()){ setStatus(c.aid, {state:'err', text:'Emailing reports for subject and custom tests needs the updated mailer script (see instructions.md). Your result is saved; download the PDF instead.'}); return false; }
  setStatus(c.aid, {state:'work', text:'Building your PDF report and emailing it to ' + who + '…'});
  try{
    await loadReportLibs();
    const rep = SPSC_REPORT.toBase64(reportCtx(c));
    const token = await user.getIdToken();
    const a = localHist()[c.aid] || toAttempt(c);
    const res = await withTimeout(fetch(CFG.mailEndpoint, {
      method:'POST', redirect:'follow', headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify({token, test:a.test, title:a.title, n:c.T.q.length, net:a.net, c:a.c, w:a.w, u:a.u, file:rep.file, pdf:rep.base64})
    }), 60000);
    let j = null;
    try{ j = await res.json(); }catch(x){ throw new Error('the mail service sent an unexpected reply (HTTP ' + res.status + ')'); }
    if(!j || !j.ok) throw new Error((j && j.error) || 'The mail service refused the request.');
    const h = localHist(); if(h[c.aid]){ h[c.aid].emailed = true; h[c.aid].synced = false; lsSet(histKey(), h); pushRemote(c.aid); }
    setStatus(c.aid, {state:'ok', text:'Report emailed to ' + who + '. Check your inbox (and the spam folder, just in case).'});
    return true;
  }catch(e){
    if(e instanceof TypeError || (e && e.message === 'timeout')){
      setStatus(c.aid, {state:'err', text:'Could not confirm whether the report was sent (the mail service did not answer). Check your inbox and spam folder before trying again, or download the PDF. Your result is saved.'});
      return false;
    }
    const why = (e && e.message) || 'unknown error';
    setStatus(c.aid, {state:'err', text:'Could not email the report (' + why + '). Your result is saved. Try again, or download the PDF.'});
    return false;
  }
}
async function examDone(c){
  if(c.mode !== 'exam' || !verified(user)) return;
  current = c;
  if(!localHist()[c.aid]) putLocal(c.aid, Object.assign(toAttempt(c), {synced:false}));
  setStatus(c.aid, {state:'work', text:'Saving your result…'});
  await pushRemote(c.aid);
  await emailReport(c);
}
function paintReport(c){
  const slot = $('#spsc-report'); if(!slot) return;
  current = c;
  const exam = c.mode === 'exam';
  const st = (exam && lsGet(stKey(c.aid), null)) || {state:exam ? 'err' : 'work', text:exam ? 'Report not emailed yet. Press the button to send it.' : 'Download a PDF copy of this result. Emailed reports and score history are for timed exams.'};
  slot.innerHTML = '<div class="card spsc-rep"><h3>Your report</h3><div id="spsc-rep-st" class="st"></div><div class="actions"><button class="b pri sm" data-spsc="pdf">Download PDF</button>'
    + (exam ? '<button class="b sm" data-spsc="resend-report">Email it to me again</button>' : '') + '</div></div>';
  paintStatus(st);
}
async function downloadPdf(){
  if(!current) return;
  const el = $('#spsc-rep-st'), keep = el && el.textContent;
  try{
    await loadReportLibs();
    const r = SPSC_REPORT.toBlob(reportCtx(current));
    const a = document.createElement('a'); a.href = URL.createObjectURL(r.blob); a.download = r.file;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }catch(e){ if(el) el.textContent = 'Could not build the PDF: ' + (e.message || e); setTimeout(() => { if(el && keep) el.textContent = keep; }, 4000); }
}

/* ---------------- global click + submit handling ---------------- */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-spsc]'); if(!b) return;
  const a = b.dataset.spsc;
  if(a === 'showpw'){ const p = $('#spsc-body input[name=password]'); if(p) p.type = b.checked ? 'text' : 'password'; return; }
  e.preventDefault();
  if(a === 'login') openAuth({view:'login'});
  else if(a === 'signup') openAuth({view:'signup'});
  else if(a === 'close') closeModal();
  else if(a === 'view-login' || a === 'view-signup' || a === 'view-reset'){ readFields(); modal.view = a.slice(5); modal.msg = null; renderModal(); }
  else if(a === 'google') busy(async () => { await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); });
  else if(a === 'resend') resendVerification();
  else if(a === 'check') checkVerified();
  else if(a === 'signout') signOut();
  else if(a === 'pdf') downloadPdf();
  else if(a === 'resend-report'){ if(current) emailReport(current); }
});
/* links marked data-go (a test to start) ask for a verified login first */
document.addEventListener('click', e => {
  const a = e.target.closest('a[data-go]');
  if(!a || e.ctrlKey || e.metaKey || e.shiftKey || e.button || verified(user)) return;
  e.preventDefault();
  openAuth({onSuccess:() => { location.href = a.getAttribute('href'); }});
});
document.addEventListener('submit', e => {
  const f = e.target.closest('[data-spsc-form]'); if(!f) return;
  e.preventDefault(); submitForm(f.dataset.spscForm);
});
document.addEventListener('keydown', e => { if(e.key === 'Escape' && modal.open) closeModal(); });

window.SPSC = {
  configured, mailOn, uid, newId, onAuth, guard, openAuth, signOut, paintAcct, paintBanner, history, cachedHistory,
  state: () => ({ready, user, verified:verified(user), name:nameOf(user), email:user && user.email}),
  ns: suffix => NS + uid() + '_' + suffix,
  requireLogin: fn => { if(verified(user)) fn(); else openAuth({onSuccess:fn}); },
  examDone, paintReport
};
init();
})();
