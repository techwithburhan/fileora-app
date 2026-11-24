/* Fileora module: File Converter (8 tools on the processing server, Text to PDF in the browser). */
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

  /* ---------------- Text to PDF (2.18, in the browser) ----------------
     Typed or pasted text (or a .txt file) becomes a tidy PDF with real, selectable text:
     * Formatting found by itself: headings and headlines in bold, lines starting with "-" (or •, *)
       as bullet points, "1." lists, the rest as paragraphs with even spacing.
     * Hindi, Marathi and other Devanagari text, Tamil, Bengali, Gujarati, Punjabi (Gurmukhi),
       Kannada, Malayalam, Odia and Telugu are shaped with HarfBuzz (the engine browsers use), so
       conjuncts, vowel signs and their order come out right. Latin text uses Noto Sans.
     Fonts: Noto Sans families (SIL Open Font License) in public/vendor/fonts, loaded only for the
     scripts in the text. */
  const TXT_MAXB = 2097152, TKEY = 'fileora.txt2pdf';
  const TPAGE = { a4: [595.28, 841.89], letter: [612, 792] };
  const TMARGIN = { narrow: 40, normal: 60, wide: 80 };
  const SCRIPTS = [[0x0900, 0x097F, 'Devanagari'], [0xA8E0, 0xA8FF, 'Devanagari'], [0x1CD0, 0x1CFF, 'Devanagari'],
    [0x0980, 0x09FF, 'Bengali'], [0x0A00, 0x0A7F, 'Gurmukhi'], [0x0A80, 0x0AFF, 'Gujarati'], [0x0B00, 0x0B7F, 'Oriya'],
    [0x0B80, 0x0BFF, 'Tamil'], [0x0C00, 0x0C7F, 'Telugu'], [0x0C80, 0x0CFF, 'Kannada'], [0x0D00, 0x0D7F, 'Malayalam']];
  const TEXT_EXAMPLE = `Monthly Report – November 2026

Summary
This report covers the work done this month. Everything below was formatted automatically: the headings are bold, the lines that start with a hyphen became bullet points, and the rest became paragraphs.

Highlights
- 12 new tools were added to the website
- The mobile app now refreshes with a pull
- Hindi and Tamil text is printed correctly

हिंदी में सारांश
इस महीने हमने वेबसाइट और मोबाइल ऐप में कई सुधार किए। संयुक्ताक्षर जैसे क्ष, त्र, ज्ञ और श्र सही दिखते हैं।
- नए टूल जोड़े गए
- प्रक्रिया पहले से तेज़ है

தமிழில் சுருக்கம்
இந்த மாதம் இணையதளத்திலும் செயலியிலும் பல மேம்பாடுகள் செய்யப்பட்டன.
- புதிய கருவிகள் சேர்க்கப்பட்டன
- கோப்புகள் விரைவாக செயலாக்கப்படுகின்றன

Next steps
1. Test every tool on Android and iPhone
2. Publish the new app pages`;
  const tstore = { get() { try { return sessionStorage.getItem(TKEY) || ''; } catch (e) { return ''; } }, set(v) { try { if (v.length < 2e6) sessionStorage.setItem(TKEY, v); } catch (e) { /* storage off */ } } };
  const scriptOf = cp => { for (const [a, b, s] of SCRIPTS) if (cp >= a && cp <= b) return s; return cp === 0x200C || cp === 0x200D || (cp >= 0x0300 && cp <= 0x036F) ? '' : 'Latin'; };
  const SCALE = { Devanagari: 1.1, Bengali: 1.06, Gurmukhi: 1.06, Gujarati: 1.08, Oriya: 1.04 };
  const fontFile = (script, bold) => `NotoSans${script === 'Latin' ? '' : script}-${bold ? 'Bold' : 'Regular'}.ttf`;

  /* text -> blocks: { type: 'h', level, text } | { type: 'p', lines: [] } | { type: 'li', marker, text, ordered } | { type: 'gap' } */
  function parseText(text, auto, keepBreaks) {
    const lines = String(text).replace(/\r\n?/g, '\n').replace(/\t/g, '    ').replace(/ /g, ' ').split('\n');
    const blocks = [];
    let para = null;
    const flush = () => { if (para) { blocks.push(para); para = null; } };
    const BULLET = /^\s*[-–—•●▪◦*]\s+(.*)$/, NUM = /^\s*((?:\d{1,3}|[a-zA-Z])[.)])\s+(.*)$/;
    const blank = i => i < 0 || i >= lines.length || !lines[i].trim();
    const listy = i => !blank(i) && (BULLET.test(lines[i]) || NUM.test(lines[i]));
    const headingLike = (t, i) => {
      if (t.length > 90 || t.split(/\s+/).length > 14) return false;
      if (/[.,;!?।॥…]$/.test(t)) return false;
      if (/:$/.test(t)) return true;                                       // "Highlights:"
      const caps = t.replace(/[^A-Za-z]/g, '');
      if (caps.length >= 3 && caps === caps.toUpperCase()) return true;   // "SUMMARY"
      if (blank(i - 1) && !blank(i + 1) && !listy(i)) return true;        // a short line that starts a section
      return lines.slice(0, i).every(l => !l.trim()) && t.split(/\s+/).length <= 10;   // the first line: the title
    };
    lines.forEach((raw, i) => {
      const t = raw.trim();
      if (!t) { flush(); if (blocks.length && blocks[blocks.length - 1].type !== 'gap') blocks.push({ type: 'gap' }); return; }
      if (auto) {
        let m = /^(#{1,3})\s+(.+)$/.exec(t);                                // Markdown headings
        if (m) { flush(); blocks.push({ type: 'h', level: m[1].length, text: m[2].replace(/\s*#+$/, '') }); return; }
        m = BULLET.exec(raw);
        if (m && m[1].trim()) { flush(); blocks.push({ type: 'li', marker: '•', text: m[1].trim(), depth: /^\s{2,}/.test(raw) ? 1 : 0 }); return; }
        m = NUM.exec(raw);
        if (m && m[2].trim() && (listy(i - 1) || listy(i + 1) || !headingLike(m[2].trim(), i))) { flush(); blocks.push({ type: 'li', marker: m[1], text: m[2].trim(), ordered: true, depth: /^\s{2,}/.test(raw) ? 1 : 0 }); return; }
        if (!para && headingLike(t, i)) { flush(); blocks.push({ type: 'h', level: 0, text: t.replace(/:$/, '') }); return; }
      }
      if (!para) para = { type: 'p', lines: [t] };
      else if (keepBreaks || !auto) para.lines.push(t);
      else para.lines[para.lines.length - 1] += ' ' + t;
    });
    flush();
    /* the first heading of the document is its title when it comes first */
    const first = blocks.find(b => b.type !== 'gap');
    blocks.forEach(b => { if (b.type === 'h' && !b.level) b.level = b === first ? 1 : 2; });
    while (blocks.length && blocks[blocks.length - 1].type === 'gap') blocks.pop();
    return blocks;
  }

  async function textToPdf(text, o, ctx) {
    const PDFLib = await E.h.lib('pdflib'), fontkit = await E.h.lib('fontkit');
    const { PDFDocument, rgb, PDFHexString, PDFName, PDFOperator, pushGraphicsState, popGraphicsState, beginText, endText, setFontAndSize, setTextMatrix, showText, setFillingRgbColor } = PDFLib;
    const blocks = parseText(text, o.auto !== false, !!o.breaks);
    if (!blocks.length) throw new E.h.UserError('Type or paste some text first.');
    /* which scripts are used, so only those fonts load */
    const used = new Set(['Latin']);
    for (const ch of text) { const s = scriptOf(ch.codePointAt(0)); if (s) used.add(s); }
    ctx.progress(.08, 'Loading fonts');
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const fonts = {};
    let hb = null;
    if ([...used].some(s => s !== 'Latin')) hb = await E.h.lib('hb');
    for (const s of used) {
      for (const bold of [false, true]) {
        const bytes = await E.h.fontBytes(fontFile(s, bold));
        const latin = s === 'Latin';
        /* Latin: a subset, drawn by pdf-lib. Indian scripts: the whole font, so HarfBuzz's glyph
           numbers can be written as they are (Identity encoding). */
        const pf = await doc.embedFont(bytes, { subset: latin });
        const f = { pdf: pf, fk: pf.embedder.font, upem: pf.embedder.font.unitsPerEm, extra: new Map() };
        if (!latin) { const blob = new hb.Blob(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)); f.hbFace = new hb.Face(blob, 0); f.hbFont = new hb.Font(f.hbFace); }
        fonts[s + (bold ? 'B' : 'R')] = f;
      }
    }
    ctx.progress(.2, 'Arranging the text');
    const [PW, PH] = TPAGE[o.page] || TPAGE.a4, M = TMARGIN[o.margin] || 60;
    const base = +o.size || 12;
    const indic = used.size > 1;
    let missing = 0;
    /* a run of one script -> { w, draw(page, x, y) } */
    const latinOk = (f, ch) => f.fk.hasGlyphForCodePoint(ch.codePointAt(0));
    function shapeRun(str, script, bold, size) {
      const f = fonts[script + (bold ? 'B' : 'R')];
      if (script === 'Latin') {
        let clean = '';
        for (const ch of str) { if (latinOk(f, ch)) clean += ch; else { clean += '?'; missing++; } }
        const w = f.pdf.widthOfTextAtSize(clean, size);
        return { w, draw: (page, x, y, color) => page.drawText(clean, { x, y, size, font: f.pdf, color }) };
      }
      size *= SCALE[script] || 1;
      const buf = new hb.Buffer();
      buf.addText(str); buf.guessSegmentProperties();
      hb.shape(f.hbFont, buf);
      const infos = buf.getGlyphInfos(), pos = buf.getGlyphPositions();
      if (buf.destroy) buf.destroy();
      const k = size / f.upem;
      /* cluster -> its characters, for copying text out of the PDF (ToUnicode) */
      const starts = [...new Set(infos.map(g => g.cluster))].sort((a, b) => a - b);
      const seen = new Set();
      const glyphs = infos.map((g, i) => {
        const p = pos[i], gid = g.codepoint;
        const xa = p.xAdvance ?? p.x_advance ?? 0, xo = p.xOffset ?? p.x_offset ?? 0, yo = p.yOffset ?? p.y_offset ?? 0;
        if (!seen.has(g.cluster)) {
          seen.add(g.cluster);
          const end = starts[starts.indexOf(g.cluster) + 1] ?? str.length;
          const cps = [...str.slice(g.cluster, end)].map(c => c.codePointAt(0));
          if (gid && !f.extra.has(gid)) f.extra.set(gid, { id: gid, codePoints: cps, advanceWidth: xa, name: '' });
        }
        if (!gid) missing++;
        return { gid, xa: xa * k, xo: xo * k, yo: yo * k };
      });
      const w = glyphs.reduce((t, g) => t + g.xa, 0);
      return {
        w,
        draw(page, x, y, color, gap) {
          const key = page.node.newFontDictionary(f.pdf.name, f.pdf.ref);
          /* /Span with /ActualText: PDF readers copy and search the real letters in reading order
             (the glyphs of Indian scripts are often drawn in another order than they are typed) */
          const span = PDFOperator.of('BDC', [PDFName.of('Span'), doc.context.obj({ ActualText: PDFHexString.fromText(gap ? str + ' ' : str) })]);
          const ops = [pushGraphicsState(), setFillingRgbColor(color.red, color.green, color.blue), beginText(), setFontAndSize(key, size), setTextMatrix(1, 0, 0, 1, x, y), span];
          let pen = x;
          for (const g of glyphs) {
            ops.push(setTextMatrix(1, 0, 0, 1, pen + g.xo, y + g.yo), showText(PDFHexString.of(g.gid.toString(16).padStart(4, '0'))));
            pen += g.xa;
          }
          ops.push(PDFOperator.of('EMC'), endText(), popGraphicsState());
          page.pushOperators(...ops);
        }
      };
    }
    /* a word -> runs by script (characters like ZWJ, combining marks join the run before them) */
    function shapeWord(word, bold, size) {
      const runs = [];
      let cur = null;
      for (const ch of word) {
        const s = scriptOf(ch.codePointAt(0)) || (cur ? cur.s : 'Latin');
        if (cur && cur.s === s) cur.t += ch; else { cur = { s, t: ch }; runs.push(cur); }
      }
      const parts = runs.map(r => shapeRun(r.t, r.s, bold, size));
      return { w: parts.reduce((t, p) => t + p.w, 0), parts };
    }
    const INK = rgb(0.09, 0.1, 0.16), MUTED = rgb(0.42, 0.44, 0.52);
    const pages = [];
    let page = null, y = 0;
    const newPage = () => { page = doc.addPage([PW, PH]); pages.push(page); y = PH - M; };
    newPage();
    const lh = s => s * (indic ? 1.62 : 1.42);
    /* lays out words in lines inside [x0, x1]; first line may start after a marker */
    function paragraph(words, { x0, size, bold, color, keepLines }) {
      const space = fonts.LatinR.pdf.widthOfTextAtSize(' ', size);
      const maxW = PW - M - x0;
      const lines = [];
      let line = [], w = 0;
      for (const wd of words) {
        if (wd === '\n') { lines.push(line); line = []; w = 0; continue; }
        const s = shapeWord(wd, bold, size);
        if (line.length && w + space + s.w > maxW) { lines.push(line); line = []; w = 0; }
        line.push(s); w += (line.length > 1 ? space : 0) + s.w;
      }
      if (line.length || !lines.length) lines.push(line);
      return { lines, space, h: lh(size), draw(first) {
        lines.forEach((ln, i) => {
          if (y - lh(size) < M) newPage();
          y -= lh(size);
          let x = x0;
          ln.forEach((s, k) => { s.parts.forEach((p, j) => { p.draw(page, x, y + size * 0.28, color, k < ln.length - 1 && j === s.parts.length - 1); x += p.w; }); x += space; });
          if (i === 0 && first) first(y + size * 0.28);
        });
      } };
    }
    const words = t => t.split(/\s+/).filter(Boolean);
    let n = 0;
    for (const b of blocks) {
      if (++n % 20 === 0) ctx.progress(.2 + .65 * n / blocks.length, 'Arranging the text');
      if (b.type === 'gap') { y -= base * 0.35; continue; }
      if (b.type === 'h') {
        const size = b.level === 1 ? base * 1.6 : b.level === 2 ? base * 1.3 : base * 1.12;
        const p = paragraph(words(b.text), { x0: M, size, bold: true, color: INK });
        /* keep a heading with the first lines after it */
        if (y - p.lines.length * p.h - lh(base) * 2 - size * 0.6 < M && y < PH - M - 1) newPage();
        if (y < PH - M - 1) y -= size * (b.level === 1 ? 0.2 : 0.55);
        p.draw();
        y -= size * 0.35;
        continue;
      }
      if (b.type === 'li') {
        const size = base, indent = M + 4 + (b.depth || 0) * 18;
        const markW = b.ordered ? Math.max(18, fonts.LatinR.pdf.widthOfTextAtSize(b.marker, size) + 8) : 16;
        const p = paragraph(words(b.text), { x0: indent + markW, size, bold: false, color: INK });
        p.draw(yy => {
          if (b.ordered) page.drawText(b.marker, { x: indent, y: yy, size, font: fonts.LatinR.pdf, color: INK });
          else page.drawCircle({ x: indent + 4, y: yy + size * 0.33, size: size * 0.16, color: INK });
        });
        y -= base * 0.18;
        continue;
      }
      /* paragraph */
      const ws = [];
      b.lines.forEach((ln, i) => { if (i) ws.push('\n'); ws.push(...words(ln)); });
      paragraph(ws, { x0: M, size: base, bold: false, color: INK }).draw();
      y -= base * 0.55;
    }
    if (o.numbers !== false && pages.length > 0) {
      pages.forEach((pg, i) => {
        const label = `${i + 1} / ${pages.length}`, s = 9;
        pg.drawText(label, { x: (PW - fonts.LatinR.pdf.widthOfTextAtSize(label, s)) / 2, y: M / 2 - 3, size: s, font: fonts.LatinR.pdf, color: MUTED });
      });
    }
    /* copy & search: glyphs HarfBuzz made (conjuncts, reordered signs) map back to their letters */
    Object.values(fonts).forEach(f => {
      if (!f.extra.size) return;
      const list = f.pdf.embedder.glyphCache.access();
      const have = new Set(list.map(g => g.id));
      f.extra.forEach((g, id) => { if (!have.has(id)) list.push(g); });
      list.sort((a, b) => a.id - b.id);
    });
    ctx.progress(.92, 'Saving the PDF');
    const title = (blocks.find(b => b.type === 'h') || {}).text || '';
    if (title) doc.setTitle(title.slice(0, 120));
    doc.setProducer('Fileora'); doc.setCreator('Fileora Text to PDF');
    const bytes = await doc.save();
    const notes = [`${pages.length} page${pages.length > 1 ? 's' : ''}`];
    if (missing) notes.push(`${missing} character${missing > 1 ? 's' : ''} this tool can't print yet became “?”`);
    return { bytes, note: notes.join(', ') };
  }

  function textView(main, WS, api) {
    if (!WS.opts.html && tstore.get()) WS.opts.html = tstore.get();
    main.innerHTML = `<div class="fo-code fo-textin">
      <div class="fo-code-bar">
        <button type="button" class="fo-btn fo-btn-line fo-btn-sm" data-c="open">${icon('upload', 'fo-ic fo-ic-sm')}Open a .txt file</button>
        <button type="button" class="fo-btn fo-btn-quiet fo-btn-sm" data-c="example">Insert an example</button>
        <button type="button" class="fo-btn fo-btn-quiet fo-btn-sm" data-c="clear">Clear</button>
        <span class="fo-code-size" aria-live="polite"></span>
        <input type="file" accept=".txt,.text,.md,text/plain" hidden>
      </div>
      <label class="fo-opt-l" for="${WS.root.id || 'fo'}-text">Your text</label>
      <textarea id="${WS.root.id || 'fo'}-text" class="fo-code-ta fo-text-ta" spellcheck="true" placeholder="Type or paste your text. Hindi, Tamil and English all work.&#10;&#10;A short line becomes a heading. Lines starting with - become bullet points."></textarea>
      <small class="fo-muted">Headings are made bold, lines starting with “-” become bullet points and the rest becomes paragraphs. Turn this off with “Format automatically”.</small>
    </div>`;
    const ta = $('textarea', main), size = $('.fo-code-size', main), file = $('input[type=file]', main);
    ta.value = WS.opts.html || '';
    const count = () => { const v = WS.opts.html || ''; const n = new Blob([v]).size; size.textContent = v ? `${[...v].length.toLocaleString()} characters` + (n > TXT_MAXB ? ' – over the 2 MB limit' : '') : ''; size.classList.toggle('err', n > TXT_MAXB); };
    const set = v => { WS.opts.html = v; if (ta.value !== v) ta.value = v; tstore.set(v); api.update(); count(); };
    WS.codeSet = set;
    ta.addEventListener('input', () => set(ta.value));
    main.addEventListener('click', e => {
      const b = e.target.closest('[data-c]'); if (!b) return;
      if (b.dataset.c === 'open') file.click();
      if (b.dataset.c === 'example') set(TEXT_EXAMPLE);
      if (b.dataset.c === 'clear') { set(''); ta.focus(); }
    });
    file.addEventListener('change', () => { const f = file.files[0]; file.value = ''; if (f) loadText(f, WS, set); });
    count();
  }
  function loadText(f, WS, set) {
    if (f.size > TXT_MAXB) { toast(`${f.name} is larger than 2 MB.`, 'error'); return; }
    f.text().then(t => { (set || (v => { WS.opts.html = v; tstore.set(v); }))(t.replace(/^﻿/, '')); toast(`Opened ${f.name}`, 'ok'); }, () => toast(`${f.name} couldn’t be read.`, 'error'));
  }
  E.register({ id: 'txt2pdf', accept: 'html', multi: false, cta: 'Convert to PDF', verb: 'Making your PDF',
    tip: 'Type or paste text in English or 10 Indian languages, including Hindi and Tamil. Headings, bullet points and paragraphs are formatted for you.',
    code: { step: 'Add text', hint: 'Type or paste your text to start.', edit: 'Edit the text', back: 'Back to my text', max: TXT_MAXB,
      label: 'Your text', open: 'Open a .txt file', ext: '\\.(txt|text|md)$', pick: 'text', placeholder: 'Type or paste your text. Hindi, Tamil and English all work.' },
    localOpts: ['html'],
    codeView: textView,
    onFiles: (list, WS) => { const f = list.find(x => /\.(txt|text|md)$/i.test(x.name) || x.type === 'text/plain'); if (f) loadText(f, WS, WS.codeSet); else toast('Drop a .txt file here.', 'error'); },
    codeFile: WS => new File([WS.opts.html || ''], 'text.txt', { type: 'text/plain' }),
    opts: [
      { id: 'auto', type: 'toggle', label: 'Format automatically', value: true, help: o => o.auto ? 'Short lines become bold headings, “-” lines become bullet points, the rest becomes paragraphs.' : 'Every line is printed as it is.' },
      { id: 'breaks', type: 'toggle', label: 'Keep my line breaks', value: false, show: o => o.auto, help: 'On: lines inside a paragraph stay on their own line (poems, addresses).' },
      { id: 'size', type: 'seg', label: 'Text size', value: '12', choices: [['10', 'Small'], ['12', 'Normal'], ['14', 'Large']] },
      { id: 'page', type: 'seg', label: 'Page size', value: 'a4', choices: [['a4', 'A4'], ['letter', 'US Letter']] },
      { id: 'margin', type: 'seg', label: 'Margins', value: 'normal', choices: [['narrow', 'Narrow'], ['normal', 'Normal'], ['wide', 'Wide']] },
      { id: 'numbers', type: 'toggle', label: 'Page numbers', value: true },
      { id: 'name', type: 'text', label: 'File name', value: '', placeholder: 'document', maxlength: 80 }
    ],
    async run(items, o, ctx) {
      const text = await items[0].file.text();
      if (!text.trim()) throw new E.h.UserError('Type or paste some text first.');
      const { bytes, note } = await textToPdf(text, o, ctx);
      const name = (String(o.name || '').trim().replace(/[\\/:*?"<>|]+/g, '').replace(/\.pdf$/i, '') || 'document') + '.pdf';
      return [{ name, blob: new Blob([bytes], { type: 'application/pdf' }), note }];
    } });
})(window.FileoraEngine);
