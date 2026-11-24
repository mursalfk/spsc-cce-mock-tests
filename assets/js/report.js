/* assets/js/report.js : builds the PDF score report in the browser (jsPDF + autotable, loaded on demand) */
(function(){
'use strict';
const PASS = (window.SPSC_CONFIG && window.SPSC_CONFIG.passMark) || 66;
const MINUS = 0.25, L = 'ABCDE';
const f2 = x => (Math.round(x * 100) / 100).toString();

/* jsPDF's built-in fonts only cover Latin-1, so map the few other symbols we use */
const MAP = {'−':'-','–':'-','—':'-','‘':"'",'’':"'",'“':'"','”':'"','→':'->','π':'pi','√':'sqrt','…':'...',' ':' ',' ':' ',' ':' ','✓':'ok','★':'*'};
function t(s){
  s = String(s == null ? '' : s).replace(/[‘’“”−–—→π√…   ✓★]/g, c => MAP[c]);
  return s.replace(/[^\n\x20-\x7e\xa1-\xff]/g, '?');
}

function score(T, ans){
  let c = 0, w = 0, u = 0; const sec = {};
  T.sec.forEach(s => sec[s.k] = {n:0, c:0, w:0, u:0});
  T.q.forEach((q, i) => { const z = sec[q.s]; z.n++;
    if(ans[i] < 0){ u++; z.u++; } else if(ans[i] === q.a){ c++; z.c++; } else { w++; z.w++; } });
  return {c, w, u, net: c - MINUS * w, sec};
}

function build(ctx){
  const jsPDF = window.jspdf && window.jspdf.jsPDF;
  if(!jsPDF) throw new Error('PDF library not loaded');
  const T = ctx.T, ans = ctx.ans, N = T.q.length;
  const r = score(T, ans), pass = r.net >= PASS, att = r.c + r.w;
  const doc = new jsPDF({unit:'mm', format:'a4', compress:true});
  const W = 210, M = 14, ACC = [31,78,121], OK = [27,127,75], BAD = [179,38,30], MUT = [102,112,125], INK = [28,34,48];
  const when = new Date(ctx.ts || Date.now());
  const dateStr = t(when.toLocaleString('en-GB', {day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'}));
  const modeLabel = ctx.mode === 'exam' ? 'Full mock test' : 'Practice';
  const mins = Math.floor((ctx.used || 0) / 60), secs = (ctx.used || 0) % 60;

  /* ---- header band ---- */
  doc.setFillColor(...ACC); doc.rect(0, 0, W, 32, 'F');
  doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(19);
  doc.text('SPSC CCE-2026 Mock Test Report', M, 14);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
  doc.text(t(T.title + '  |  ' + modeLabel), M, 23);
  doc.text(dateStr, W - M, 23, {align:'right'});

  /* ---- candidate ---- */
  let y = 42;
  doc.setTextColor(...INK); doc.setFontSize(10.5);
  const cand = [['Candidate', ctx.name || '-'], ['Email', ctx.email || '-'], ['Time used', mins + ' min ' + secs + ' s of 200 min']];
  cand.forEach(row => {
    doc.setFont('helvetica', 'bold'); doc.text(row[0], M, y);
    doc.setFont('helvetica', 'normal'); doc.text(t(row[1]), M + 28, y); y += 6;
  });

  /* ---- result box ---- */
  y += 3;
  const bx = M, bw = W - 2 * M, bh = 38;
  doc.setDrawColor(...(pass ? OK : BAD)); doc.setLineWidth(0.8);
  doc.setFillColor(pass ? 233 : 252, pass ? 246 : 236, pass ? 238 : 234);
  doc.roundedRect(bx, y, bw, bh, 3, 3, 'FD');
  doc.setTextColor(...(pass ? OK : BAD)); doc.setFont('helvetica', 'bold'); doc.setFontSize(30);
  doc.text(f2(r.net) + ' / ' + N, bx + 8, y + 17);
  doc.setFontSize(12);
  doc.text(pass ? 'ABOVE THE PASS MARK' : 'BELOW THE PASS MARK', bx + 8, y + 25);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...INK);
  doc.text('Pass mark ' + PASS + ' net (33%). ' + (pass ? 'Margin +' : 'Short by ') + f2(Math.abs(r.net - PASS)) + ' marks.', bx + 8, y + 31);
  const stats = [['Correct', r.c], ['Wrong', r.w], ['Skipped', r.u], ['Accuracy*', att ? Math.round(100 * r.c / att) + '%' : '-']];
  stats.forEach((s, k) => {
    const sx = bx + 104 + k * 20;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(...INK);
    doc.text(String(s[1]), sx, y + 17);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...MUT);
    doc.text(s[0], sx, y + 22);
  });
  doc.setFontSize(8); doc.setTextColor(...MUT);
  doc.text('* accuracy on attempted questions', bx + 104, y + 31);
  y += bh + 8;

  /* ---- section table ---- */
  doc.setTextColor(...ACC); doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text('Section-wise performance', M, y); y += 2;
  const body = T.sec.map(s => { const z = r.sec[s.k], a = z.c + z.w;
    return [t(s.name), z.n, z.c, z.w, z.u, f2(z.c - MINUS * z.w), a ? Math.round(100 * z.c / a) + '%' : '-']; });
  body.push(['Total', N, r.c, r.w, r.u, f2(r.net), att ? Math.round(100 * r.c / att) + '%' : '-']);
  doc.autoTable({
    startY: y + 2, margin:{left:M, right:M},
    head:[['Section', 'Qs', 'Right', 'Wrong', 'Skipped', 'Net', 'Accuracy']], body,
    theme:'grid', styles:{fontSize:9.5, cellPadding:2, textColor:INK, lineColor:[226,221,208]},
    headStyles:{fillColor:ACC, textColor:255},
    columnStyles:{0:{cellWidth:68}, 1:{halign:'right'}, 2:{halign:'right'}, 3:{halign:'right'}, 4:{halign:'right'}, 5:{halign:'right'}, 6:{halign:'right'}},
    didParseCell: d => { if(d.section === 'body' && d.row.index === body.length - 1){ d.cell.styles.fontStyle = 'bold'; d.cell.styles.fillColor = [231,238,246]; } }
  });
  y = doc.lastAutoTable.finalY + 9;

  /* ---- focus areas + guess audit ---- */
  const ranked = T.sec.map(s => { const z = r.sec[s.k]; return {name:s.name, z, ratio:(z.c - MINUS * z.w) / z.n}; })
    .filter(x => x.z.w + x.z.u > 0).sort((a, b) => a.ratio - b.ratio).slice(0, 3);
  const need = () => { if(y > 255){ doc.addPage(); y = 20; } };
  need();
  doc.setTextColor(...ACC); doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text('Where to focus next', M, y); y += 6;
  doc.setTextColor(...INK); doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  const lines = ranked.length ? ranked.map(x => '- ' + x.name + ': ' + f2(x.z.c - MINUS * x.z.w) + ' net from ' + x.z.n + ' questions (' + x.z.w + ' wrong, ' + x.z.u + ' skipped).')
    : ['- Nothing flagged: every question was answered correctly.'];
  lines.forEach(l => { const parts = doc.splitTextToSize(t(l), W - 2 * M); doc.text(parts, M, y); y += 5 * parts.length; });
  y += 4; need();
  doc.setTextColor(...ACC); doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text('Guess audit', M, y); y += 6;
  doc.setTextColor(...INK); doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  const ga = 'Your wrong answers cost ' + f2(r.w * MINUS) + ' marks. Skipping every one of them would have scored ' + r.c + '. A blind guess among four options is worth about +0.06 marks on average, so guess only after you can rule out at least one option. You skipped ' + r.u + ' question' + (r.u === 1 ? '' : 's') + '.';
  const gp = doc.splitTextToSize(t(ga), W - 2 * M); doc.text(gp, M, y); y += 5 * gp.length + 4;

  /* ---- review tables ---- */
  const legend = T.sec.map(s => s.k + ' = ' + s.name).join('   ');
  const rows = (kind) => {
    const out = [];
    T.q.forEach((q, i) => {
      const a = ans[i];
      if(kind === 'wrong' && !(a >= 0 && a !== q.a)) return;
      if(kind === 'skip' && a >= 0) return;
      let cell = q.q + '\n';
      if(kind === 'wrong') cell += 'Your answer: ' + L[a] + '. ' + q.o[a] + '\n';
      cell += 'Correct answer: ' + L[q.a] + '. ' + q.o[q.a];
      if(q.e) cell += '\nNote: ' + q.e;
      out.push([i + 1, q.s, t(cell)]);
    });
    return out;
  };
  [['wrong', 'Questions answered wrongly'], ['skip', 'Questions skipped']].forEach(([kind, title]) => {
    const data = rows(kind);
    doc.addPage(); let yy = 20;
    doc.setTextColor(...ACC); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
    doc.text(title + ' (' + data.length + ')', M, yy); yy += 5;
    doc.setTextColor(...MUT); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    const lg = doc.splitTextToSize(t(legend), W - 2 * M); doc.text(lg, M, yy + 1); yy += 4 * lg.length + 2;
    if(!data.length){
      doc.setTextColor(...INK); doc.setFontSize(10.5);
      doc.text(kind === 'wrong' ? 'None. No wrong answers in this attempt.' : 'None. Every question was attempted.', M, yy + 6);
      return;
    }
    doc.autoTable({
      startY: yy, margin:{left:M, right:M, top:16, bottom:16},
      head:[['Q', 'Sec', kind === 'wrong' ? 'Question, your answer and the correct answer' : 'Question and the correct answer']], body:data,
      theme:'grid', styles:{fontSize:8.8, cellPadding:2, textColor:INK, lineColor:[226,221,208], valign:'top', overflow:'linebreak'},
      headStyles:{fillColor:ACC, textColor:255},
      columnStyles:{0:{cellWidth:10, halign:'right'}, 1:{cellWidth:14}, 2:{cellWidth:'auto'}},
      alternateRowStyles:{fillColor:[247,246,241]}
    });
  });

  /* ---- footer on every page ---- */
  const pages = doc.getNumberOfPages();
  for(let p = 1; p <= pages; p++){
    doc.setPage(p); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUT);
    doc.text('Unofficial practice report. Not affiliated with the Sindh Public Service Commission.', M, 289);
    doc.text('Page ' + p + ' of ' + pages, W - M, 289, {align:'right'});
  }
  const file = 'CCE_' + t(T.title).replace(/\s+/g, '_') + '_report.pdf';
  return {doc, file, result:r};
}

function toBlob(ctx){ const b = build(ctx); return {blob:b.doc.output('blob'), file:b.file, result:b.result}; }
function toBase64(ctx){
  const b = build(ctx), buf = new Uint8Array(b.doc.output('arraybuffer'));
  let s = ''; for(let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return {base64:btoa(s), file:b.file, bytes:buf.length, result:b.result};
}
window.SPSC_REPORT = {toBlob, toBase64, score};
})();
