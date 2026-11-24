/* assets/js/pool.js : shared by the home, practice and test pages.
   Subject sets and custom tests are cut at run time from data/pool/<level>-<SEC>.json (built by tools/build.py).
   Nothing is stored per set, and nothing about questions lives in code. */
(function(){
'use strict';
const cache = {};
const pad = n => String(n).padStart(2, '0');
const getJSON = u => fetch(u).then(r => { if(!r.ok) throw new Error(u + ' ' + r.status); return r.json(); });
const sec = (CAT, k) => CAT.sections.find(s => s.k === k);

/* every question of one subject at one level, in CSV order */
const load = (lv, k) => cache[lv + k] || (cache[lv + k] = getJSON('data/pool/' + lv + '-' + k + '.json').then(j => j.q).catch(e => { delete cache[lv + k]; throw e; }));

/* marking for a test of n questions, scaled from the 200-question paper */
const passFor = (CAT, n) => Math.round(2 * n * CAT.marking.pass / CAT.marking.n) / 2;
const minutesFor = (CAT, n) => Math.max(1, Math.round(n * CAT.marking.minutes / CAT.marking.n));

/* ---------- subject sets: a subject at a level, cut into sets of about practice.setSize ---------- */
const setsOf = (CAT, lv, k) => Math.max(1, Math.round(CAT.pools[lv][k] / CAT.practice.setSize));
const subjectId = (CAT, lv, k) => CAT.practice.idBase + Object.keys(CAT.levels).indexOf(lv) * CAT.sections.length + CAT.sections.findIndex(s => s.k === k);
const setTitle = (CAT, lv, k, i) => sec(CAT, k).short + ' · ' + CAT.levels[lv].name + ' · Set ' + pad(i);
const setKey = (lv, k, i) => 's-' + lv + '-' + k.toLowerCase() + '-' + i;
const setSize = (CAT, lv, k, i) => { const n = CAT.pools[lv][k], m = setsOf(CAT, lv, k); return Math.floor(i * n / m) - Math.floor((i - 1) * n / m); };

async function subjectTest(CAT, lv, k, i){
  const s = sec(CAT, k), m = s && CAT.levels[lv] ? setsOf(CAT, lv, k) : 0;
  if(!(i >= 1 && i <= m)) throw new Error('no such set');
  const all = await load(lv, k), q = all.slice(Math.floor((i - 1) * all.length / m), Math.floor(i * all.length / m));
  return fin(CAT, {id:subjectId(CAT, lv, k), key:setKey(lv, k, i), sk:setKey(lv, k, i), level:lv, levelName:CAT.levels[lv].name, kind:'subject',
    title:setTitle(CAT, lv, k, i), sec:[{k, name:s.name, n:q.length, i0:0}], q, back:'practice.html'});
}

/* ---------- custom tests: ?t=custom&l=hard|mix&s=mth,ca&n=50&m=p|e&r=<seed> ---------- */
const parse = (CAT, sp) => {
  const l = (sp.get('l') || '').toLowerCase(), n = +sp.get('n'), r = (sp.get('r') || '').replace(/[^a-z0-9]/gi, '').slice(0, 12), P = CAT.practice;
  const s = CAT.sections.map(x => x.k).filter(k => (sp.get('s') || '').toUpperCase().split(',').includes(k));
  if(!(l === 'mix' || CAT.levels[l]) || !s.length || !(n >= P.customMin && n <= P.customMax) || !r) return null;
  return {l, s, n: Math.floor(n), m: sp.get('m') === 'e' ? 'e' : 'p', r};
};
const query = o => 't=custom&l=' + o.l + '&s=' + o.s.join(',').toLowerCase() + '&n=' + o.n + '&m=' + o.m + '&r=' + o.r;
const levelsOf = (CAT, l) => l === 'mix' ? Object.keys(CAT.levels) : [l];
const avail = (CAT, l, k) => levelsOf(CAT, l).reduce((t, lv) => t + CAT.pools[lv][k], 0);

/* split n over subjects: by real-paper weight (m = p) or evenly (m = e); never above what a subject has */
function alloc(CAT, n, ks, m, cap){
  const w = {}, out = {}; ks.forEach(k => { w[k] = m === 'e' ? 1 : sec(CAT, k).w; out[k] = 0; });
  let left = Math.min(n, ks.reduce((t, k) => t + cap[k], 0));
  while(left > 0){
    const act = ks.filter(k => out[k] < cap[k]); if(!act.length) break;
    const tw = act.reduce((t, k) => t + w[k], 0);
    const q = act.map(k => { const x = left * w[k] / tw; return {k, f:Math.floor(x), r:x - Math.floor(x)}; });
    let given = 0;
    q.forEach(o => { const g = Math.min(o.f, cap[o.k] - out[o.k]); out[o.k] += g; given += g; });
    let rest = left - given;
    q.sort((a, b) => b.r - a.r).forEach(o => { if(rest > 0 && out[o.k] < cap[o.k]){ out[o.k]++; rest--; given++; } });
    if(!given) break;
    left -= given;
  }
  /* a chosen subject never ends up with nothing: take one from the biggest share */
  if(n >= ks.length) ks.filter(k => !out[k] && cap[k] > 0).forEach(k => { const big = ks.reduce((a, b) => out[b] > out[a] ? b : a, ks[0]); if(out[big] > 1){ out[big]--; out[k]++; } });
  return out;
}

function rng(seed){
  let h = 1779033703 ^ seed.length;
  for(let i = 0; i < seed.length; i++){ h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
  let a = h >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

async function customTest(CAT, o){
  const ks = CAT.sections.map(s => s.k).filter(k => o.s.includes(k)), lvs = levelsOf(CAT, o.l), rnd = rng(o.r + o.l + o.s.join(''));
  const pools = {}, cap = {};
  await Promise.all(ks.map(async k => { pools[k] = [].concat(...await Promise.all(lvs.map(lv => load(lv, k)))); cap[k] = pools[k].length; }));
  const take = alloc(CAT, o.n, ks, o.m, cap), sc = [], q = [];
  ks.filter(k => take[k]).forEach(k => {
    const idx = pools[k].map((_, i) => i);
    for(let i = idx.length - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); const t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
    sc.push({k, name:sec(CAT, k).name, n:take[k], i0:q.length});
    idx.slice(0, take[k]).forEach(i => q.push(pools[k][i]));
  });
  const lname = o.l === 'mix' ? 'Mixed' : CAT.levels[o.l].name;
  let title = 'Custom: ' + ks.map(k => sec(CAT, k).short).join(', ') + ' · ' + lname + ' · ' + q.length + ' Q';
  if(title.length > 60) title = 'Custom: ' + ks.length + ' subjects · ' + lname + ' · ' + q.length + ' Q';
  return fin(CAT, {id:CAT.practice.customId, key:'custom', sk:'c_' + [o.l, o.s.join('.'), o.n, o.m, o.r].join('_'), level:o.l, levelName:lname, kind:'custom', title, sec:sc, q, back:'practice.html#build', href:'test.html?' + query(o)});
}

function fin(CAT, T){
  T.pass = passFor(CAT, T.q.length); T.minutes = minutesFor(CAT, T.q.length);
  return T;
}

window.POOL = {load, passFor, minutesFor, setsOf, setSize, setKey, setTitle, subjectId, subjectTest, parse, query, levelsOf, avail, alloc, customTest, fin, pad};
})();
