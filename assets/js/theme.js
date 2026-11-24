/* assets/js/theme.js : applies the saved skin and text size before first paint (loaded in <head>) */
try{var d=document.documentElement,t=localStorage.getItem('spsc_theme'),s=localStorage.getItem('spsc_fs');if(['swiss','blueprint','glass','deco','vapor'].indexOf(t)<0)t='swiss';d.setAttribute('data-theme',t);if(s)d.style.fontSize=s+'px'}catch(e){}
