/* assets/js/topics.js : renders data/topics.json (built by tools/build.py). No dependencies. */
(function(){
'use strict';
var LV=['easy','medium','hard'], NAME={easy:'Easy',medium:'Medium',hard:'Hard'};
var st={lv:'easy',t:0,q:''}, D=null;
var $=function(id){return document.getElementById(id)};
var esc=function(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
var sum=function(a){return a.reduce(function(x,y){return x+y},0)};
var count=function(sub){var a=sub.c[st.lv];return st.t?a[st.t-1]:sum(a)};

function ctl(){
  $('tp-lv').innerHTML=LV.map(function(l){return '<button type="button" data-l="'+l+'" aria-pressed="'+(l===st.lv)+'">'+NAME[l]+'</button>'}).join('');
  var n=D.levels[st.lv], o='<option value="0">All '+n+' tests</option>';
  for(var i=1;i<=n;i++) o+='<option value="'+i+'"'+(i===st.t?' selected':'')+'>'+NAME[st.lv]+' Test '+(i<10?'0':'')+i+'</option>';
  $('tp-test').innerHTML=o;
}
function cells(sub){
  var a=sub.c[st.lv], key=function(i){return st.lv+'-'+(i<10?'0':'')+i};
  return '<span class="tp-strip" aria-hidden="true">'+a.map(function(v,i){return '<a href="test.html?t='+key(i+1)+'" class="tp-c'+(v?'':' z')+'" title="'+NAME[st.lv]+' Test '+(i+1)+': '+v+'">'+(v||'')+'</a>'}).join('')+'</span>';
}
function render(){
  var q=st.q.trim().toLowerCase(), out='', nt=0, ns=0, nq=0;
  D.sections.forEach(function(s){
    var body='', sq=0;
    s.topics.forEach(function(tp){
      var rows='', tq=0;
      tp.subs.forEach(function(sub){
        var c=count(sub); if(!c) return;
        if(q && (sub.name+' '+tp.name+' '+s.name).toLowerCase().indexOf(q)<0) return;
        tq+=c; ns++;
        rows+='<li><span class="tp-n">'+esc(sub.name)+'</span><span class="tp-v">'+c+'</span>'+(st.t?'':cells(sub))+'</li>';
      });
      if(!rows) return;
      nt++; sq+=tq;
      body+='<h3>'+esc(tp.name)+' <span>'+tq+'</span></h3><ul class="tp-l">'+rows+'</ul>';
    });
    if(!body) return;
    nq+=sq;
    out+='<section class="card"><h2>'+esc(s.name)+' <span class="tp-tot">'+sq+' questions</span></h2>'+body+'</section>';
  });
  $('tp-out').innerHTML=out||'<div class="card"><p>No subtopic matches that search.</p></div>';
  var scope=st.t?NAME[st.lv]+' Test '+(st.t<10?'0':'')+st.t:'All '+D.levels[st.lv]+' '+NAME[st.lv]+' tests';
  $('tp-stats').innerHTML='<div class="stat"><b>'+nt+'</b><span>topics</span></div><div class="stat"><b>'+ns+'</b><span>subtopics</span></div><div class="stat"><b>'+nq.toLocaleString('en-US')+'</b><span>questions</span></div><div class="stat"><b class="sm">'+esc(scope)+'</b><span>scope</span></div>';
}
function init(){
  ctl(); render();
  $('tp-lv').addEventListener('click',function(e){var b=e.target.closest('button[data-l]'); if(!b) return; st.lv=b.getAttribute('data-l'); st.t=0; ctl(); render()});
  $('tp-test').addEventListener('change',function(e){st.t=+e.target.value; render()});
  $('tp-q').addEventListener('input',function(e){st.q=e.target.value; render()});
}
fetch('data/topics.json').then(function(r){return r.json()}).then(function(j){D=j; init()}).catch(function(){$('tp-out').innerHTML='<div class="card"><p>Could not load the topics list. Reload the page.</p></div>'});
})();
