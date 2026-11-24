/* assets/js/ui.js : display settings (theme + text size) and a small icon set. No dependencies. */
(function(){
'use strict';
const root = document.documentElement;
const get = k => { try{ return localStorage.getItem(k); }catch(e){ return null; } };
const set = (k, v) => { try{ localStorage.setItem(k, v); }catch(e){} };
/* id, name, background, text, accent (used for the swatch preview) */
const SKINS = [
  ['swiss', 'Swiss', '#f1f0ec', '#0c0c0c', '#c91f18'],
  ['blueprint', 'Blueprint', '#143a85', '#f3f6fc', '#ffd36b'],
  ['glass', 'Glass', '#0d1030', '#f4f6ff', '#9097ff'],
  ['deco', 'Deco', '#070706', '#f1e7c8', '#c9a24b'],
  ['vapor', 'Vapor', '#170a2b', '#fff1fb', '#ff5fd7']
];
const DEFAULT = 'swiss';
const KNOWN = SKINS.map(s => s[0]);
const SIZES = [[16, 'S'], [18, 'M'], [20, 'L'], [22, 'XL']];

const P = {
  back:'<path d="M15 18l-6-6 6-6"/>', next:'<path d="M9 18l6-6-6-6"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  check:'<path d="M20 6L9 17l-5-5"/>', x:'<path d="M18 6L6 18M6 6l12 12"/>',
  flag:'<path d="M5 21V4"/><path d="M5 4h12l-2.5 4L17 12H5"/>',
  bulb:'<path d="M9 18h6M10 21.5h4"/><path d="M12 2.5a6.5 6.5 0 0 0-3.9 11.7c.6.5.9 1.2.9 1.8h6c0-.6.3-1.3.9-1.8A6.5 6.5 0 0 0 12 2.5z"/>',
  lock:'<rect x="4" y="10.5" width="16" height="10.5" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  mail:'<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 7l8.5 6 8.5-6"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  zap:'<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>',
  file:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/>',
  warn:'<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18.5v.01"/>',
  cards:'<rect x="3" y="6" width="14" height="14" rx="2.5"/><path d="M7 3h12a2 2 0 0 1 2 2v12"/>'
};
const icon = n => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[n] || '') + '</svg>';

let theme = get('spsc_theme');
if(KNOWN.indexOf(theme) < 0) theme = DEFAULT;
let size = +get('spsc_fs') || 18;
function apply(){
  root.setAttribute('data-theme', theme);
  root.style.fontSize = size + 'px';
}
apply();

let pop = null, anchor = null;
function popHTML(){
  return '<h3>Style</h3><div class="skins">' + SKINS.map(t => '<button class="sk" data-ui-act="theme" data-v="' + t[0] + '" aria-pressed="' + (theme === t[0]) + '" title="' + t[1] + '">'
      + '<div class="sw" style="background:' + t[2] + '"><i style="background:' + t[3] + '"></i><i style="background:' + t[4] + '"></i></div><span>' + t[1] + '</span></button>').join('') + '</div>'
    + '<h3>Text size</h3><div class="seg">' + SIZES.map(s => '<button data-ui-act="size" data-v="' + s[0] + '" aria-pressed="' + (size === s[0]) + '">' + s[1] + '</button>').join('') + '</div>'
    + '<p class="mut sm-t" style="margin:0">Swiss suits daylight. Glass and Deco are easiest on the eyes at night. Vapor is the loud one.</p>';
}
function place(){
  if(!pop || !anchor || pop.hidden) return;
  const r = anchor.getBoundingClientRect(), w = pop.offsetWidth || 264;
  pop.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w)) + 'px';
  pop.style.top = (r.bottom + 8) + 'px';
}
function toggle(btn){
  if(!pop){ pop = document.createElement('div'); pop.id = 'ui-pop'; pop.hidden = true; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Display settings'); document.body.appendChild(pop); }
  if(!pop.hidden && anchor === btn){ pop.hidden = true; return; }
  anchor = btn; pop.innerHTML = popHTML(); pop.hidden = false; place();
}
function mount(){
  document.querySelectorAll('[data-ui=ctl]').forEach(el => {
    if(el.firstChild) return;
    el.innerHTML = '<button class="ib" data-ui-act="open" aria-label="Display settings" title="Display settings" aria-haspopup="dialog">Aa</button>';
  });
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-ui-act]');
  if(b){
    const a = b.dataset.uiAct;
    if(a === 'open'){ toggle(b); return; }
    if(a === 'theme'){ theme = b.dataset.v; set('spsc_theme', theme); apply(); pop.innerHTML = popHTML(); return; }
    if(a === 'size'){ size = +b.dataset.v; set('spsc_fs', String(size)); apply(); pop.innerHTML = popHTML(); place(); return; }
  }
  if(pop && !pop.hidden && !e.target.closest('#ui-pop')) pop.hidden = true;
});
document.addEventListener('keydown', e => { if(e.key === 'Escape' && pop && !pop.hidden) pop.hidden = true; });
window.addEventListener('resize', place);

window.UI = {icon, mount};
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
