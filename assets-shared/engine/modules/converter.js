/* Fileora module: File Converter (7 tools on the processing server). */
(function (E) {
  'use strict';
  if (!E) return;
  const R = def => E.register(Object.assign({ server: true, multi: true }, def));
  R({ id: 'word2pdf', accept: 'word', cta: 'Convert to PDF', verb: 'Converting', opts: [] });
  R({ id: 'excel2pdf', accept: 'excel', cta: 'Convert to PDF', verb: 'Converting',
    opts: [
      { id: 'fit', type: 'toggle', label: 'Fit all columns on one page', value: true,
        help: o => o.fit ? 'Each sheet becomes one page, sized to fit, so no columns are cut off.' : 'Uses the page setup saved in the file (paper size, orientation, print area).' }
    ] });
  R({ id: 'ppt2pdf', accept: 'ppt', cta: 'Convert to PDF', verb: 'Converting',
    opts: [{ id: 'notes', type: 'toggle', label: 'Include speaker notes', value: false }] });
  R({ id: 'pdf2word', accept: 'pdf', cta: 'Convert to Word', verb: 'Converting',
    opts: [{ id: 'ocr', type: 'toggle', label: 'Recognize text in scanned pages', value: true }] });
  R({ id: 'pdf2excel', accept: 'pdf', cta: 'Convert to Excel', verb: 'Extracting tables',
    opts: [{ id: 'sheets', type: 'seg', label: 'Worksheets', value: 'page', choices: [['page', 'One per page'], ['one', 'All in one']] }] });
  R({ id: 'pdf2ppt', accept: 'pdf', cta: 'Convert to PowerPoint', verb: 'Converting', opts: [] });
  R({ id: 'html2pdf', accept: 'url', multi: false, cta: 'Convert to PDF', verb: 'Capturing the page',
    tip: 'Saves a public web page as a PDF. Have HTML code or an .html file instead? Use HTML Code to PDF.',
    opts: [
      { id: 'page', type: 'seg', label: 'Page size', value: 'a4', choices: [['a4', 'A4'], ['letter', 'US Letter'], ['one', 'One long page']] },
      { id: 'orient', type: 'seg', label: 'Orientation', value: 'portrait', choices: [['portrait', 'Portrait'], ['landscape', 'Landscape']], show: o => o.page !== 'one' },
      { id: 'clean', type: 'toggle', label: 'Hide ads and pop-ups', value: true }
    ] });

  /* ---------------- HTML Code to PDF ----------------
     The visitor's own HTML is shown in a sandboxed frame (its own opaque origin: it can't reach
     this page, its cookies or storage). Scripts stay blocked by a Content-Security-Policy unless
     "Run JavaScript" is on. The PDF itself is made on the processing server by Chromium. */
  const { $, esc, toast, icon } = E.h;
  const MAXB = 5242880, KEY = 'fileora.code2pdf';
  const PAPER = { a4: [794, 1123], letter: [816, 1056] };   // CSS px at 96 dpi
  const MARGIN = { none: 0, small: 23, normal: 45 };        // 0, 6 and 12 mm
  const EXAMPLE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Invoice INV-1024</title>
<style>
  body { font-family: Arial, sans-serif; color: #1f2333; margin: 0; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; }
  h1 { margin: 0; font-size: 28px; color: #2f6bf3; }
  .muted { color: #6b7086; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin-top: 24px; }
  th, td { padding: 10px; border-bottom: 1px solid #e3e5ee; text-align: left; }
  th { background: #f2f4fa; font-size: 13px; text-transform: uppercase; }
  td.num, th.num { text-align: right; }
  .total { font-size: 18px; font-weight: bold; }
  .badge { display: inline-block; background: #ffd43b; padding: 4px 10px; border-radius: 99px; font-size: 12px; }
</style>
</head>
<body>
  <div class="top">
    <div>
      <h1>Your Company</h1>
      <p class="muted">12 Example Road, Pune 411001</p>
    </div>
    <div style="text-align:right">
      <span class="badge">INVOICE</span>
      <p class="muted">No. INV-1024<br>Date: 21 Oct 2026</p>
    </div>
  </div>
  <p><strong>Bill to:</strong> A. Customer</p>
  <table>
    <tr><th>Item</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th></tr>
    <tr><td>Website design</td><td class="num">1</td><td class="num">12,000</td><td class="num">12,000</td></tr>
    <tr><td>Hosting (1 year)</td><td class="num">1</td><td class="num">3,500</td><td class="num">3,500</td></tr>
    <tr><td colspan="3" class="num total">Total (INR)</td><td class="num total">15,500</td></tr>
  </table>
  <p class="muted">Thank you for your business.</p>
</body>
</html>`;
  const store = { get() { try { return sessionStorage.getItem(KEY) || ''; } catch (e) { return ''; } }, set(v) { try { if (v.length < 2e6) sessionStorage.setItem(KEY, v); } catch (e) { /* storage off or full: the code still lives in the editor */ } } };
  const bytes = v => new Blob([v]).size;
  const fmt = n => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(2) + ' MB';
  /* the document shown in the preview frame: the visitor's code plus a tiny helper that reports
     the height and prints on request; with scripts off, a CSP lets only the helper run */
  function frameDoc(html, js, nonce) {
    const csp = js ? '' : `<meta http-equiv="Content-Security-Policy" content="script-src 'nonce-${nonce}'">`;
    const helper = `<script nonce="${nonce}">(function(){var p=function(){try{parent.postMessage({fo:'h',n:'${nonce}',h:Math.max(document.documentElement.scrollHeight,document.body?document.body.scrollHeight:0)},'*')}catch(e){}};addEventListener('load',p);addEventListener('resize',p);try{new ResizeObserver(p).observe(document.documentElement)}catch(e){}addEventListener('message',function(e){if(e.data&&e.data.fo==='print'&&e.data.n==='${nonce}')print()});setTimeout(p,50)})();<\/script>`;
    const head = csp + helper;
    const m = /^\s*<!doctype[^>]*>/i.exec(html);
    return m ? m[0] + head + html.slice(m[0].length) : head + html;
  }

  function codeView(main, WS, api) {
    if (!WS.opts.html && store.get()) WS.opts.html = store.get();
    const nonce = Math.random().toString(36).slice(2, 12);
    main.innerHTML = `<div class="fo-code">
      <div class="fo-code-bar">
        <button type="button" class="fo-btn fo-btn-line fo-btn-sm" data-c="open">${icon('upload', 'fo-ic fo-ic-sm')}Open .html file</button>
        <button type="button" class="fo-btn fo-btn-quiet fo-btn-sm" data-c="example">Insert an example</button>
        <button type="button" class="fo-btn fo-btn-quiet fo-btn-sm" data-c="clear">Clear</button>
        <span class="fo-code-size" aria-live="polite"></span>
        <input type="file" accept=".html,.htm,text/html" hidden>
      </div>
      <div class="fo-code-panes">
        <div class="fo-code-edit">
          <label class="fo-opt-l" for="${WS.root.id || 'fo'}-code">HTML code</label>
          <textarea id="${WS.root.id || 'fo'}-code" class="fo-code-ta" spellcheck="false" autocapitalize="off" autocomplete="off" wrap="off" placeholder="Paste your HTML here, including &lt;style&gt; for CSS. Example: &lt;h1&gt;Hello&lt;/h1&gt;"></textarea>
          <small>Tab adds two spaces; press Esc, then Tab, to leave the editor.</small>
        </div>
        <div class="fo-code-prev">
          <div class="fo-code-prev-head"><span class="fo-opt-l">Live preview</span><span class="fo-code-paper"></span></div>
          <div class="fo-code-stage" tabindex="0" aria-label="Live preview, scrollable"><div class="fo-code-sizer"><div class="fo-code-sheet"><iframe title="Preview of your HTML" sandbox="allow-scripts allow-modals" referrerpolicy="no-referrer"></iframe></div></div></div>
          <p class="fo-code-note">The preview uses screen styles and one long page; the PDF follows the page size and CSS media you choose. <button type="button" class="fo-link" data-c="print">Print with my browser instead</button></p>
        </div>
      </div>
    </div>`;
    const ta = $('.fo-code-ta', main), frame = $('iframe', main), stage = $('.fo-code-stage', main), sizer = $('.fo-code-sizer', main), sheet = $('.fo-code-sheet', main), size = $('.fo-code-size', main), file = $('input[type=file]', main);
    ta.value = WS.opts.html || '';
    let timer = 0, contentH = 600;
    function layout() {
      const o = WS.opts, fit = o.page === 'fit';
      let [w] = fit ? [1240] : PAPER[o.page] || PAPER.a4;
      if (!fit && o.orient === 'landscape') w = (PAPER[o.page] || PAPER.a4)[1];
      const m = fit ? 0 : MARGIN[o.margin] ?? 45;
      const scale = Math.min(1, (stage.clientWidth - 2) / w);
      sheet.style.width = w + 'px'; sheet.style.padding = m + 'px';
      frame.style.width = (w - 2 * m) + 'px'; frame.style.height = Math.max(200, contentH) + 'px';
      sheet.style.transform = `scale(${scale})`;
      sizer.style.height = Math.ceil((Math.max(200, contentH) + 2 * m) * scale) + 'px';
      $('.fo-code-paper', main).textContent = fit ? 'Fit content' : `${o.page === 'letter' ? 'US Letter' : 'A4'}, ${o.orient === 'landscape' ? 'landscape' : 'portrait'}`;
    }
    function render() {
      const html = WS.opts.html || '';
      frame.srcdoc = html.trim() ? frameDoc(html, !!WS.opts.js, nonce) : '<p style="font:15px system-ui;color:#8a8fa8;padding:24px">Your preview appears here.</p>';
      const n = bytes(html);
      size.textContent = n ? fmt(n) + (n > MAXB ? ' – over the 5 MB limit' : '') : '';
      size.classList.toggle('err', n > MAXB);
      layout();
    }
    function set(v) { WS.opts.html = v; if (ta.value !== v) ta.value = v; store.set(v); api.update(); clearTimeout(timer); timer = setTimeout(render, 300); }
    ta.addEventListener('input', () => set(ta.value));
    ta.addEventListener('keydown', e => {
      if (e.key === 'Escape') { ta.dataset.esc = '1'; return; }
      if (e.key === 'Tab' && !e.shiftKey && !ta.dataset.esc && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault(); const a = ta.selectionStart, b = ta.selectionEnd;
        ta.setRangeText('  ', a, b, 'end'); set(ta.value);
      } else if (e.key !== 'Tab') delete ta.dataset.esc;
    });
    ta.addEventListener('blur', () => delete ta.dataset.esc);
    WS.code = { frame, nonce, onHeight: h => { contentH = Math.min(30000, +h || 600); layout(); }, layout };
    if (!WS.codeListening) {   /* once per tool, whatever view is showing now */
      WS.codeListening = true;
      addEventListener('message', e => { const c = WS.code; if (c && c.frame.isConnected && e.source === c.frame.contentWindow && e.data && e.data.fo === 'h' && e.data.n === c.nonce) c.onHeight(e.data.h); });
      let rz = 0; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { const c = WS.code; if (c && c.frame.isConnected) c.layout(); }, 100); });
    }
    main.addEventListener('click', e => {
      const b = e.target.closest('[data-c]'); if (!b) return;
      const c = b.dataset.c;
      if (c === 'open') { file.value = ''; file.click(); }
      if (c === 'example') { if (ta.value.trim()) return toast('Clear the editor first, so your own code isn’t replaced.'); set(EXAMPLE); render(); ta.focus(); }
      if (c === 'clear') { set(''); render(); ta.focus(); }
      if (c === 'print') { if (!(WS.opts.html || '').trim()) return toast('Add some HTML first.', 'error'); frame.contentWindow.postMessage({ fo: 'print', n: nonce }, '*'); }
    });
    file.addEventListener('change', () => { if (file.files[0]) loadFile(file.files[0], WS); });
    WS.codeSet = v => { set(v); render(); };
    WS.codeLayout = () => { render(); };
    render();
    requestAnimationFrame(layout);
  }
  function loadFile(f, WS) {
    if (!/\.html?$/i.test(f.name) && f.type !== 'text/html') return toast('Choose an .html or .htm file.', 'error');
    if (f.size > MAXB) return toast(`${f.name} is larger than 5 MB.`, 'error');
    f.text().then(t => { if (WS.codeSet) WS.codeSet(t); toast(`Opened ${f.name}`, 'ok'); }, () => toast('That file couldn’t be read.', 'error'));
  }

  R({ id: 'code2pdf', accept: 'html', multi: false, cta: 'Convert to PDF', verb: 'Making your PDF',
    tip: 'Paste HTML and CSS, check the live preview, then download a PDF with real, selectable text.',
    localOpts: ['html'],
    codeView, onFiles: (list, WS) => { const f = list.find(x => /\.html?$/i.test(x.name)); if (f) loadFile(f, WS); else toast('Drop an .html file here.', 'error'); },
    codeFile: WS => new File([WS.opts.html || ''], 'document.html', { type: 'text/html' }),
    onOpt: (fid, WS) => { if (WS.codeLayout && WS.code && WS.code.frame.isConnected && ['page', 'orient', 'margin', 'js'].includes(fid)) WS.codeLayout(); },
    opts: [
      { id: 'page', type: 'seg', label: 'Page size', value: 'a4', choices: [['a4', 'A4'], ['letter', 'US Letter'], ['fit', 'Fit content']] },
      { id: 'orient', type: 'seg', label: 'Orientation', value: 'portrait', choices: [['portrait', 'Portrait'], ['landscape', 'Landscape']], show: o => o.page !== 'fit' },
      { id: 'margin', type: 'seg', label: 'Margins', value: 'normal', choices: [['none', 'None'], ['small', 'Small'], ['normal', 'Normal']], show: o => o.page !== 'fit',
        help: 'A @page rule in your CSS (size, margin) takes priority.' },
      { id: 'media', type: 'seg', label: 'CSS media', value: 'print', choices: [['print', 'Print'], ['screen', 'Screen']],
        help: o => o.media === 'print' ? 'Uses your @media print styles, like a browser’s “Save as PDF”.' : 'Ignores @media print and keeps the on-screen look.' },
      { id: 'bg', type: 'toggle', label: 'Background colours and images', value: true },
      { id: 'js', type: 'toggle', label: 'Run JavaScript', value: false,
        help: o => o.js ? 'Scripts run in an isolated browser that can only reach the public internet.' : 'Off: scripts in your code are ignored. Turn on for charts or content built by scripts.' },
      { id: 'name', type: 'text', label: 'File name', value: '', placeholder: 'document', maxlength: 80 }
    ] });
})(window.FileoraEngine);
