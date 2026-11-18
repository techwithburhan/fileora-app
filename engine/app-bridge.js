/* ---------------- Fileora app bridge ----------------
   Built into the app's copy of the engine (scripts/build-engine.sh puts this file inside the
   engine's function scope, after the website's own files, which stay unchanged).

   The app shows its own native screens; this page has no visible UI. It keeps one "session"
   per open tool that stands in for the website's workspace (WS), so every tool's own hooks
   (validate, show, help, onOpt, onItems, preset, regions, pages, slots, passwords, reloadOn,
   setOpts, codeFile) behave exactly as on the website.

   App → page:   FileoraApp.recv({ id, cmd, ...args })          (injectJavaScript)
   Page → app:   ReactNativeWebView.postMessage(JSON)           { re: id, ok, data | error }
                 events                                         { ev: 'ready' | 'state' | 'thumb' | 'progress', sid, … }
   Files travel as base64 chunks both ways (fileBegin / fileChunk / fileEnd, outRead). */
const APP_PROTOCOL = 1;
const appSend = m => {
  const s = JSON.stringify(m);
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s);
  else if (window.__foSink) window.__foSink(s); /* tests */
};
const APPF = {}; /* fid → { name, type, size, parts, file } */
const APPO = {}; /* oid → Blob */
const APPS = {}; /* sid → session */
let appSeq = 0;
const appId = p => p + (++appSeq).toString(36);
const b64Bytes = b => { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
const blobB64 = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(r.error || new Error('read')); r.readAsDataURL(blob); });
const jpegUrl = (c, q = 0.8) => c.toDataURL('image/jpeg', q);
const putOut = blob => { const oid = appId('o'); APPO[oid] = blob; return oid; };
/* A Web Worker started from this page (a file in the app) can't load the library files, so
   tools that use one (Image to SVG) run on the page instead: libUrl '' means "no worker".
   Set before the tool modules load, as they read FileoraEngine.h when they start. */
API.h.libUrl = () => '';

/* a tool definition as plain data for the native form */
const OPT_KEYS = ['id', 'type', 'label', 'value', 'choices', 'min', 'max', 'step', 'suffix', 'placeholder', 'maxlength', 'cells', 'custom', 'text'];
function optJson(f) {
  const x = {};
  OPT_KEYS.forEach(k => { if (f[k] !== undefined && typeof f[k] !== 'function') x[k] = f[k]; });
  if (f.html) x.text = String(f.html).replace(/<[^>]+>/g, '');
  if (f.type === 'image' || f.type === 'signature') x.value = null;
  x.dyn = !!(f.show || typeof f.help === 'function');
  return x;
}
function describe(S) {
  const T = S.tool, acc = ACCEPT[T.accept] || ACCEPT.pdf;
  return {
    id: T.id, name: T.name, accept: T.accept, noun: acc.noun, nouns: acc.nouns, exts: acc.ext, kinds: acc.kinds,
    multi: !!T.multi, min: T.min, max: T.max || (S.useServer && S.meta.maxFiles ? S.meta.maxFiles : 0), ordered: !!(T.ordered || (T.multi && T.min > 1)),
    camera: !!T.camera, pages: !!T.pages, cta: T.cta, verb: T.verb, tip: T.tip || '', slots: T.slots || null, dropText: T.dropText || '',
    server: S.useServer, passwords: !!T.passwords, regions: T.regions ? { multi: !!T.regions.multi, after: T.regions.after ? String(T.regions.after(S) || '').replace(/<[^>]+>/g, '') : '' } : null,
    code: T.accept === 'html', codeText: T.accept === 'html' ? codeOf(T) : null, textTitle: T.textTitle || '', opts: (T.opts || []).map(optJson)
  };
}

/* code mode words (HTML Code to PDF, Text to PDF): the website's T.code, with HTML defaults */
function codeOf(T) {
  return Object.assign({ step: 'Add code', hint: 'Paste or type your HTML code to start.', edit: 'Edit the code', back: 'Back to my code', max: 5242880,
    label: 'Your HTML code', open: 'Open an .html file', ext: '\\.html?$', pick: 'html', placeholder: '<!doctype html>\n<h1>Hello</h1>' }, T.code || {});
}

/* option values for the app (pictures go as a small preview) */
function plainOpts(o) {
  const out = {};
  Object.keys(o).forEach(k => {
    const v = o[k];
    if (v && typeof v === 'object' && 'bytes' in v) out[k] = { name: v.name || '', w: v.w, h: v.h, preview: v.preview || '' };
    else out[k] = v;
  });
  return out;
}
const goodOf = S => S.items.filter(i => !i.err);
const aN = w => (/^[aeiou]/i.test(w) ? 'an ' : 'a ') + w;
const isUrlish = v => { try { const u = new URL(/^https?:\/\//i.test(v) ? v : 'https://' + v); return /\./.test(u.hostname); } catch (e) { return false; } };
/* the website's updateCta(), without the DOM */
function ctaOf(S) {
  const T = S.tool, acc = ACCEPT[T.accept] || ACCEPT.pdf;
  let ok = false, h = '';
  if (T.accept === 'url') { ok = isUrlish(S.opts.url || ''); h = ok ? '' : 'Enter a web address to continue.'; }
  else if (T.accept === 'html') { const C = codeOf(T), n = (S.opts.html || '').length; ok = !!(S.opts.html || '').trim() && n <= C.max; h = !n || ok ? (ok ? '' : C.hint) : `That is larger than ${Math.round(C.max / 1048576)} MB.`; }
  else {
    const n = goodOf(S).length;
    const skip = T.regions && T.regions.skip && T.regions.skip(S);
    const regOk = !T.regions || skip || !!(S.source && S.source.canvas);
    ok = n >= T.min && (!T.pages || (S.pages && S.pages.length)) && regOk;
    if (!n) h = T.min > 1 ? `Add at least ${T.min} ${acc.nouns} to start.` : `Add ${T.multi ? acc.nouns : aN(acc.noun)} to start.`;
    else if (n < T.min) h = `Add ${T.min - n} more ${T.min - n === 1 ? acc.noun : acc.nouns}.`;
    else if (T.pages && !S.pages) h = 'Loading pages…';
    else if (T.pages && !S.pages.length) h = 'Keep at least one page.';
    else if (!regOk) h = S.source && S.source.err ? S.source.err : 'Loading the preview…';
  }
  if (ok && T.validate) { try { const v = T.validate(S.opts, goodOf(S), S); if (v) { h = v; ok = false; } } catch (e) { /* treat as valid */ } }
  return { ok, hint: h };
}
const metaText = it => it.err || [fmtSize(it.size), it.pages ? `${it.pages} page${it.pages > 1 ? 's' : ''}` : '', it.note].filter(Boolean).join(', ');
function stateOf(S) {
  const T = S.tool, o = S.opts, show = {}, help = {};
  (T.opts || []).forEach(f => {
    if (!f.id) return;
    try { show[f.id] = f.show ? !!f.show(o) : true; } catch (e) { show[f.id] = true; }
    if (f.help) { try { help[f.id] = typeof f.help === 'function' ? f.help(o) : f.help; } catch (e) { /* none */ } }
  });
  let thumbStyle = '';
  if (T.thumbStyle) { try { thumbStyle = T.thumbStyle(o) || ''; } catch (e) { /* none */ } }
  const skip = !!(T.regions && T.regions.skip && T.regions.skip(S));
  return Object.assign({
    sid: S.sid, rev: S.rev, opts: plainOpts(o), show, help, thumbStyle,
    items: S.items.map(it => ({ id: it.id, fid: it.fid, name: it.name, size: it.size, kind: it.kind, pages: it.pages, pw: it.pw || 0, ph: it.ph || 0, err: it.err || '', note: it.note || '', locked: !!it.locked, meta: metaText(it), ready: !!it.ready })),
    pages: S.pages ? S.pages.map(p => ({ key: p.key, i: p.i, rot: p.rot })) : null,
    pageCount: S.allPages ? S.allPages.length : 0,
    source: S.source ? { w: S.source.w || 0, h: S.source.h || 0, err: S.source.err || '', loading: !!S.source.loading, ready: !!S.source.canvas } : null,
    regions: S.regions || null, regionsSkip: skip, regionsNote: skip && T.regions.skipNote ? T.regions.skipNote : ''
  }, ctaOf(S));
}
const pushState = S => { if (APPS[S.sid] === S) appSend({ ev: 'state', sid: S.sid, state: stateOf(S) }); };
const pushThumb = (S, key, url) => { if (APPS[S.sid] === S) appSend({ ev: 'thumb', sid: S.sid, key, url }); };

/* ---- sessions (one per open tool screen) ---- */
function openSession({ tool, name, desc, runs, maxFiles, maxFileMB, preset }) {
  const def = DEFS[tool];
  if (!def) throw new UserError('This tool isn’t in the app’s engine yet.');
  const meta = { name, desc, runs, maxFiles, maxFileMB };
  const T = Object.assign({ min: 1, multi: false, opts: [], cta: 'Run', verb: 'Working' }, def, { name: name || def.name || tool, desc: desc || def.desc || '' });
  T.opts = (T.opts || []).map(f => ({ ...f }));
  const S = {
    sid: appId('s'), root: null, main: null, tool: T, def, meta, useServer: !!def.server && (!def.run || runs === 'server'),
    items: [], pages: null, allPages: null, opts: defaults(T), phase: 'ready', outputs: [], result: null, source: null, regions: null,
    seq: 0, run: 0, rev: 0, queue: Promise.resolve(), urls: [], reloadT: 0
  };
  /* tool hooks call ws.setOpts(...) — e.g. PDF metadata fills the fields from the file */
  S.setOpts = vals => { Object.assign(S.opts, vals); S.rev++; pushState(S); };
  /* code mode (HTML to PDF): the app's editor sets opts.html */
  S.codeSet = text => { S.opts.html = text; S.rev++; pushState(S); };
  if (preset) {
    if (typeof def.preset === 'function') def.preset(preset, S, T);
    else if (preset.opts) Object.keys(preset.opts).forEach(k => { if (k in S.opts) S.opts[k] = preset.opts[k]; });
    if (preset.tip) T.tip = preset.tip;
  }
  APPS[S.sid] = S;
  return { sid: S.sid, def: describe(S), state: stateOf(S) };
}
function sess(sid) { const S = APPS[sid]; if (!S) throw new UserError('This tool was closed. Open it again.'); return S; }
function clearItems(S) { S.items = []; S.pages = null; S.allPages = null; S.source = null; S.regions = null; S.seq++; S.queue = Promise.resolve(); }

function fileOf(fid) {
  const f = APPF[fid];
  if (!f || !f.file) throw new UserError('A file didn’t reach the tool. Please add it again.');
  return f.file;
}
function accepts(S, f) { const acc = ACCEPT[S.tool.accept] || ACCEPT.pdf; return acc.kinds.includes(kindOf(f)) || (S.tool.acceptAlso && S.tool.acceptAlso(f)); }
/* the website's addFiles(), without the DOM; returns notes for the app to show */
function addFiles(S, fids) {
  const T = S.tool, acc = ACCEPT[T.accept] || ACCEPT.pdf, notes = [];
  let files = fids.map(fid => ({ fid, file: fileOf(fid) }));
  if (T.accept === 'url') return notes;
  if (T.accept === 'html') {
    const C = codeOf(T), re = new RegExp(C.ext, 'i');
    const f = files.find(x => re.test(x.file.name) || (C.pick === 'html' ? x.file.type === 'text/html' : x.file.type === 'text/plain'));
    if (!f) notes.push(C.pick === 'html' ? 'Choose an .html or .htm file.' : 'Choose a .txt file.');
    else if (f.file.size > C.max) notes.push(`${f.file.name} is larger than ${Math.round(C.max / 1048576)} MB.`);
    else return f.file.text().then(t => { S.codeSet(t); return [`Opened ${f.file.name}`]; });
    return notes;
  }
  const bad = files.filter(x => !accepts(S, x.file));
  files = files.filter(x => accepts(S, x.file));
  if (bad.length) notes.push(`${T.name} works with ${acc.nouns}. Skipped ${bad.length === 1 ? bad[0].file.name : bad.length + ' files'}.`);
  if (S.useServer && S.meta.maxFileMB) {
    const big = files.filter(x => x.file.size > S.meta.maxFileMB * 1048576 || (APPF[x.fid].size || 0) > S.meta.maxFileMB * 1048576);
    if (big.length) { notes.push(`${big[0].file.name} is larger than ${S.meta.maxFileMB} MB.`); files = files.filter(x => !big.includes(x)); }
  }
  if (!files.length) return notes;
  if (!T.multi) { if (files.length > 1) notes.push(`${T.name} works on one file at a time, so we used ${files[0].file.name}.`); clearItems(S); files = [files[0]]; }
  const maxFiles = T.max || (S.useServer && S.meta.maxFiles ? S.meta.maxFiles : 0);
  if (maxFiles) { const room = maxFiles - S.items.length; if (files.length > room) { notes.push(`${T.name} takes up to ${maxFiles} files at a time.`); files = files.slice(0, Math.max(0, room)); } }
  if (T.regions) { S.source = null; S.regions = null; }
  const seq = S.seq;
  const items = files.map(x => ({ id: 'f' + (++itemSeq), fid: x.fid, file: x.file, name: x.file.name, size: APPF[x.fid].size || x.file.size, kind: kindOf(x.file), pages: null, err: null, note: '', ready: false }));
  S.items.push(...items);
  items.forEach(it => { S.queue = S.queue.then(() => loadMeta(S, it, seq)).catch(e => console.warn(e)); });
  S.queue = S.queue.then(() => { if (seq === S.seq && T.onItems) return T.onItems(S); }).catch(e => console.warn(e)).then(() => pushState(S));
  return notes;
}
/* the website's loadMeta(): size, pages, first-page preview, password state */
async function loadMeta(S, it, seq) {
  const T = S.tool;
  if (seq !== S.seq) return;
  const done = () => { it.ready = true; pushState(S); };
  if (it.stub) { it.note = it.note || ''; done(); return; }
  if (it.kind === 'image' || it.kind === 'svg') {
    try {
      const d = await decodeImage(it.file);
      it.pw = d.w; it.ph = d.h;
      const s = Math.min(1, (T.multi ? 360 : 720) / Math.max(d.w, d.h)), c = canvasOf(d.w * s, d.h * s), g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(d.src, 0, 0, c.width, c.height); d.done();
      pushThumb(S, it.id, jpegUrl(c, 0.82)); c.width = c.height = 0;
      it.note = `${it.pw} × ${it.ph} px`;
    } catch (e) { it.err = S.useServer ? null : 'This image can’t be opened on this phone.'; }
    done();
    if (T.regions && seq === S.seq) ensureSource(S);
    return;
  }
  if (it.kind === 'heic') { it.note = 'HEIC photo'; done(); return; }
  if (it.kind !== 'pdf') { done(); return; }
  let pdf;
  try { pdf = await pdfjsDoc(it.file, S.opts.pw); }
  catch (e) {
    if (seq !== S.seq) return;
    if (e && e.name === 'PasswordException') { it.locked = true; it.note = S.opts.pw ? 'Wrong password' : 'Password-protected'; if (!S.useServer && !T.passwords) it.err = 'Password-protected. Unlock it first.'; }
    else if (T.id === 'repair') it.note = 'Damaged file';
    else if (!S.useServer) it.err = 'This file can’t be read as a PDF.';
    if (T.pages && S.items[0] === it) S.pages = null;
    done();
    if (T.regions && seq === S.seq) ensureSource(S);
    return;
  }
  try {
    if (seq !== S.seq) return;
    it.locked = false; it.pages = pdf.numPages;
    const page = await pdf.getPage(1), vp1 = page.getViewport({ scale: 1 });
    it.pw = vp1.width; it.ph = vp1.height;
    const c = await renderPage(page, (T.multi ? 300 : 640) / vp1.width);
    if (seq !== S.seq) return;
    pushThumb(S, it.id, jpegUrl(c, 0.8)); c.width = c.height = 0;
    page.cleanup();
    if (T.pages && S.items[0] === it) await loadPages(S, it, pdf, seq);
  } catch (e) { console.warn(e); }
  finally { pdf.destroy(); done(); if (T.regions && seq === S.seq) ensureSource(S); }
}
async function loadPages(S, it, pdf, seq) {
  S.pages = Array.from({ length: pdf.numPages }, (_, i) => ({ i, rot: 0, key: 'p' + i }));
  S.allPages = S.pages.slice();
  pushState(S);
  for (let i = 0; i < pdf.numPages; i++) {
    if (seq !== S.seq) return;
    const page = await pdf.getPage(i + 1);
    const c = await renderPage(page, 200 / page.getViewport({ scale: 1 }).width);
    page.cleanup();
    if (seq !== S.seq) return;
    pushThumb(S, S.allPages[i].key, jpegUrl(c, 0.72)); c.width = c.height = 0;
  }
}
function reloadMeta(S) {
  clearTimeout(S.reloadT);
  S.reloadT = setTimeout(() => {
    if (!S.items.length) return;
    const fids = S.items.map(i => i.fid);
    clearItems(S); addFiles(S, fids); pushState(S);
  }, 450);
}
/* region editor source (ID cards, passport photo, blur) */
function ensureSource(S) {
  const T = S.tool;
  if (S.source && S.source.loading && S.sourceP) return S.sourceP; /* already being made */
  if (!T.regions || S.source || !goodOf(S).length || (T.regions.skip && T.regions.skip(S))) return Promise.resolve();
  const seq = S.seq;
  S.source = { loading: true };
  pushState(S);
  S.sourceP = (async () => {
    try {
      const src = await T.regions.source(S);
      if (seq !== S.seq) return;
      const c = src.canvas, s = Math.min(1, 1400 / Math.max(c.width, c.height));
      let url;
      if (s < 1) { const p = canvasOf(c.width * s, c.height * s); p.getContext('2d').drawImage(c, 0, 0, p.width, p.height); url = jpegUrl(p, 0.85); p.width = p.height = 0; }
      else url = jpegUrl(c, 0.88);
      S.source = { canvas: c, url, w: c.width, h: c.height, info: src.info || null };
      S.regions = T.regions.rects(S, S.source);
      pushThumb(S, 'source', url);
    } catch (e) {
      if (seq !== S.seq) return;
      console.warn(e);
      S.source = { err: e instanceof UserError ? e.message : 'The preview couldn’t be made from this file.' };
    }
    pushState(S);
  })();
  return S.sourceP;
}

/* ---- picture options: image (logo, stamp) and signature ---- */
async function setImageOpt(S, fid, file) {
  if (kindOf(file) !== 'image') throw new UserError('Choose a PNG, JPG or WebP picture.');
  const d = await decodeImage(file);
  const c = canvasOf(Math.min(d.w, 3000 * d.w / Math.max(d.w, d.h)), Math.min(d.h, 3000 * d.h / Math.max(d.w, d.h)));
  c.getContext('2d').drawImage(d.src, 0, 0, c.width, c.height); d.done();
  const png = await canvasToBlob(c, 'image/png');
  const old = S.opts[fid]; if (old && old.url) URL.revokeObjectURL(old.url);
  S.opts[fid] = { name: file.name, bytes: await png.arrayBuffer(), w: c.width, h: c.height, url: URL.createObjectURL(png), preview: previewOf(c) };
  c.width = c.height = 0;
}
function previewOf(c) {
  const s = Math.min(1, 360 / Math.max(c.width, c.height)), p = canvasOf(c.width * s, c.height * s);
  p.getContext('2d').drawImage(c, 0, 0, p.width, p.height);
  const u = p.toDataURL('image/png'); p.width = p.height = 0; return u;
}
async function sigSet(S, fid, c) {
  S.opts[fid] = { bytes: await (await canvasToBlob(c, 'image/png')).arrayBuffer(), w: c.width, h: c.height, preview: previewOf(c) };
}
/* drawn signature: strokes in pad points, same pen as the website (2.6 px, drawn at 3×) */
async function sigDraw(S, fid, strokes, ink) {
  if (!strokes || !strokes.length) { S.opts[fid] = null; return; }
  const pts = strokes.flat(), pd = 6;
  const x0 = Math.max(0, Math.min(...pts.map(p => p[0])) - pd), y0 = Math.max(0, Math.min(...pts.map(p => p[1])) - pd);
  const x1 = Math.max(...pts.map(p => p[0])) + pd, y1 = Math.max(...pts.map(p => p[1])) + pd;
  const sc = 3, c = canvasOf((x1 - x0) * sc, (y1 - y0) * sc);
  const k = c.getContext('2d'); k.lineCap = k.lineJoin = 'round'; k.strokeStyle = ink; k.lineWidth = 2.6 * sc;
  for (const s of strokes) {
    k.beginPath();
    s.forEach((p, i) => { const X = (p[0] - x0) * sc, Y = (p[1] - y0) * sc; if (!i) k.moveTo(X, Y); else { const q = s[i - 1]; k.quadraticCurveTo((q[0] - x0) * sc, (q[1] - y0) * sc, ((p[0] + q[0]) / 2 - x0) * sc, ((p[1] + q[1]) / 2 - y0) * sc); } });
    if (s.length === 1) k.lineTo((s[0][0] - x0) * sc + 0.1, (s[0][1] - y0) * sc);
    k.stroke();
  }
  await sigSet(S, fid, c);
}
async function sigType(S, fid, text, ink) {
  const t = String(text || '').trim();
  if (!t) { S.opts[fid] = null; return; }
  try { await document.fonts.load('600 110px Caveat'); } catch (e) { /* fallback */ }
  const c = document.createElement('canvas'), k = c.getContext('2d'), font = "600 110px Caveat, 'Segoe Script', 'Brush Script MT', cursive";
  k.font = font; const tw = k.measureText(t).width; c.width = Math.ceil(tw + 40); c.height = 150;
  k.font = font; k.fillStyle = ink; k.textBaseline = 'middle'; k.fillText(t, 20, 78);
  await sigSet(S, fid, c);
}
/* a photo of a signature: the paper becomes transparent and the ink is trimmed */
async function sigUpload(S, fid, file) {
  const c = await imageCanvas(file, 1600), k = c.getContext('2d', { willReadFrequently: true });
  const d = k.getImageData(0, 0, c.width, c.height), px = d.data;
  let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
  for (let i = 0; i < px.length; i += 4) {
    const l = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
    const a = l > 200 ? 0 : l < 120 ? 255 : Math.round((200 - l) / 80 * 255);
    px[i + 3] = a;
    if (a > 40) { const p = i / 4, x = p % c.width, y = (p / c.width) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 <= x0 || y1 <= y0) { S.opts[fid] = null; throw new UserError('No signature found in that picture. Use dark ink on white paper.'); }
  k.putImageData(d, 0, 0);
  const o = canvasOf(x1 - x0 + 12, y1 - y0 + 12); o.getContext('2d').drawImage(c, x0 - 6, y0 - 6, o.width, o.height, 0, 0, o.width, o.height);
  await sigSet(S, fid, o);
}

/* ---- running ---- */
function resultJson(r) {
  if (!r) return null;
  const x = {};
  ['title', 'md', 'text', 'textNote', 'add', 'del', 'a', 'b'].forEach(k => { if (r[k] !== undefined) x[k] = r[k]; });
  if (Array.isArray(r.diff)) x.diff = r.diff.map(d => ({ k: d.k, p: d.p, t: d.t }));
  if (Array.isArray(r.palette)) x.palette = r.palette.map(c => ({ hex: c.hex, pct: c.pct }));
  return x;
}
async function runSession(S) {
  const T = S.tool, c = ctaOf(S);
  if (!c.ok) throw new UserError(c.hint || 'Add your files first.');
  const items = T.accept === 'html' && T.codeFile ? (f => [{ id: 'code', file: f, name: f.name }])(T.codeFile(S)) : goodOf(S);
  const run = ++S.run;
  if (S.useServer) {
    /* the app uploads its own copies of the files to the processing server */
    const rest = {};
    Object.entries(S.opts).forEach(([k, v]) => { if ((!v || typeof v !== 'object') && !(T.localOpts && T.localOpts.includes(k))) rest[k] = v; });
    const out = { server: true, options: rest, fids: items.filter(it => it.fid).map(it => it.fid), textTitle: T.textTitle || '' };
    if (S.opts.url) out.url = /^https?:\/\//i.test(S.opts.url) ? S.opts.url : 'https://' + S.opts.url;
    if (T.accept === 'html' && T.codeFile) { const f = items[0].file; out.upload = [{ oid: putOut(f), name: f.name, type: f.type || 'text/html', size: f.size }]; }
    return out;
  }
  const ctx = {
    progress: (f, label) => { if (S.run === run) appSend({ ev: 'progress', sid: S.sid, f, label: label || '' }); },
    pages: S.pages && S.pages.map(p => ({ i: p.i, rot: p.rot })), regions: S.regions, source: S.source, result: null,
    alive: () => S.run === run && APPS[S.sid] === S, ws: S
  };
  S.outputs.forEach(o => { delete APPO[o.oid]; if (o.url) URL.revokeObjectURL(o.url); });
  const outs = await T.run(items, S.opts, ctx);
  if (!ctx.alive()) throw new Error('cancelled');
  S.outputs = (outs || []).map(o => ({ ...o, oid: putOut(o.blob), url: URL.createObjectURL(o.blob) }));
  S.result = ctx.result;
  return { outputs: S.outputs.map(o => ({ oid: o.oid, name: o.name, size: o.blob.size, type: o.blob.type || '', note: o.note || '', good: !!o.good })), result: resultJson(ctx.result) };
}

/* ---- commands ---- */
/* App 1.0: a short, soft "party popper" when a file is ready, made here with Web Audio (no sound
   file): a quick filtered pop, then a few light high notes. volume 0..1 (the app passes about 0.35). */
let audioCtx = null;
function popper(volume) {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  if (!audioCtx) audioCtx = new AC();
  const ctx = audioCtx;
  if (ctx.state === 'suspended') ctx.resume();
  const t = ctx.currentTime + 0.02, out = ctx.createGain();
  out.gain.value = Math.max(0, Math.min(1, +volume || 0.35)) * 0.5;
  out.connect(ctx.destination);
  // the pop: a 60 ms burst of noise through a band-pass filter
  const len = Math.floor(ctx.sampleRate * 0.06), buf = ctx.createBuffer(1, len, ctx.sampleRate), ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const noise = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), ng = ctx.createGain();
  noise.buffer = buf; bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.8;
  ng.gain.setValueAtTime(0.9, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  noise.connect(bp); bp.connect(ng); ng.connect(out); noise.start(t);
  // the sparkle: four soft bell notes going up
  [1318.5, 1568, 2093, 2637].forEach((f, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain(), s = t + 0.07 + i * 0.055;
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.22, s + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.32);
    o.connect(g); g.connect(out); o.start(s); o.stop(s + 0.35);
  });
  return true;
}

const CMDS = {
  ping: () => ({ protocol: APP_PROTOCOL, engine: API.version, tools: Object.keys(DEFS) }),
  sound: a => ({ played: popper(a && a.volume) }),
  open: a => openSession(a),
  close: ({ sid }) => { const S = APPS[sid]; if (S) { S.seq++; S.run++; S.outputs.forEach(o => { delete APPO[o.oid]; if (o.url) URL.revokeObjectURL(o.url); }); S.items.forEach(it => { if (it.fid) delete APPF[it.fid]; }); delete APPS[sid]; } return true; },
  state: ({ sid }) => stateOf(sess(sid)),
  describe: ({ sid }) => describe(sess(sid)),
  fileBegin: ({ fid, name, type, size, stub }) => { APPF[fid] = { name, type: type || '', size: size || 0, parts: [], stub: !!stub, file: stub ? new File([], name, { type: type || '' }) : null }; return true; },
  fileChunk: ({ fid, b64 }) => { const f = APPF[fid]; if (!f) throw new UserError('File transfer was interrupted.'); f.parts.push(b64Bytes(b64)); return f.parts.length; },
  fileEnd: ({ fid }) => { const f = APPF[fid]; if (!f) throw new UserError('File transfer was interrupted.'); if (!f.stub) f.file = new File(f.parts, f.name, { type: f.type }); f.parts = []; return f.stub ? f.size : f.file.size; },
  fileFree: ({ fids }) => { (fids || []).forEach(fid => delete APPF[fid]); return true; },
  addFiles: async ({ sid, fids }) => {
    const S = sess(sid);
    const notes = await addFiles(S, fids);
    S.items.forEach(it => { if (APPF[it.fid] && APPF[it.fid].stub) it.stub = true; });
    return { notes, state: stateOf(S) };
  },
  /* reorder or remove files: the app sends the item ids it keeps, in order */
  setItems: ({ sid, order }) => {
    const S = sess(sid), had = S.items.length;
    S.items = order.map(id => S.items.find(i => i.id === id)).filter(Boolean);
    if (S.tool.regions && S.items.length !== had) { S.source = null; S.regions = null; ensureSource(S); }
    if (!S.items.length) clearItems(S);
    return stateOf(S);
  },
  setOpt: ({ sid, fid, value }) => {
    const S = sess(sid), T = S.tool;
    S.opts[fid] = value;
    if (T.reloadOn && T.reloadOn.includes(fid)) reloadMeta(S);
    if (T.onOpt) { try { T.onOpt(fid, S); } catch (e) { console.warn(e); } }
    return stateOf(S);
  },
  setImage: async ({ sid, fid, file }) => { const S = sess(sid); if (file) await setImageOpt(S, fid, fileOf(file)); else S.opts[fid] = null; if (S.tool.onOpt) S.tool.onOpt(fid, S); return stateOf(S); },
  signature: async ({ sid, fid, mode, strokes, ink, text, file }) => {
    const S = sess(sid);
    if (mode === 'draw') await sigDraw(S, fid, strokes, ink || '#16182F');
    else if (mode === 'type') await sigType(S, fid, text, ink || '#16182F');
    else if (mode === 'upload' && file) await sigUpload(S, fid, fileOf(file));
    else S.opts[fid] = null;
    return stateOf(S);
  },
  setPages: ({ sid, pages }) => {
    const S = sess(sid);
    if (!S.allPages) return stateOf(S);
    S.pages = (pages || []).map(p => { const a = S.allPages.find(x => x.key === p.key); return a ? { ...a, rot: ((+p.rot || 0) % 360 + 360) % 360 } : null; }).filter(Boolean);
    return stateOf(S);
  },
  setRegions: ({ sid, regions }) => { const S = sess(sid); S.regions = regions; return stateOf(S); },
  source: async ({ sid }) => { const S = sess(sid); await ensureSource(S); return { url: S.source && S.source.url || '', state: stateOf(S) }; },
  run: async ({ sid }) => runSession(sess(sid)),
  cancel: ({ sid }) => { const S = APPS[sid]; if (S) S.run++; return true; },
  /* an output, in pieces: start and length in bytes */
  outRead: async ({ oid, start, len }) => {
    const b = APPO[oid]; if (!b) throw new UserError('The result is no longer available. Please run the tool again.');
    const end = Math.min(b.size, start + len);
    return { b64: await blobB64(b.slice(start, end)), end, size: b.size };
  },
  outFree: ({ oids }) => { (oids || []).forEach(o => delete APPO[o]); return true; },
  /* Self-test (CI and support): runs a set of tools on pictures and PDFs made right here. */
  selftest: async () => {
    const t0 = performance.now(), res = [];
    const pic = async (w, h, hue) => { const c = canvasOf(w, h), g = c.getContext('2d'); g.fillStyle = `hsl(${hue},70%,55%)`; g.fillRect(0, 0, w, h); g.fillStyle = '#16182F'; g.font = '700 48px Geist, sans-serif'; g.fillText('Fileora ' + hue, 30, h / 2); g.fillStyle = '#fff'; g.fillRect(w * .6, h * .2, w * .25, h * .3); const b = await canvasToBlob(c, 'image/png'); c.width = c.height = 0; return new File([b], `test-${hue}.png`, { type: 'image/png' }); };
    const put = f => { const fid = appId('t'); APPF[fid] = { name: f.name, type: f.type, size: f.size, parts: [], file: f }; return fid; };
    const one = async (tool, files, opts) => {
      const t = performance.now();
      const o = openSession({ tool, name: tool });
      const S = APPS[o.sid];
      try {
        Object.assign(S.opts, opts || {});
        await addFiles(S, files.map(put));
        await S.queue;
        if (S.tool.regions && !(S.tool.regions.skip && S.tool.regions.skip(S))) await ensureSource(S);
        const r = await runSession(S);
        const outs = S.outputs.map(x => new File([x.blob], x.name, { type: x.blob.type }));
        res.push({ tool, ok: true, ms: Math.round(performance.now() - t), files: r.outputs.length, bytes: r.outputs.reduce((n, x) => n + x.size, 0) });
        return outs;
      } catch (e) {
        res.push({ tool, ok: false, ms: Math.round(performance.now() - t), error: String(e && e.message || e) });
        return [];
      } finally { CMDS.close({ sid: o.sid }); }
    };
    const a = await pic(1200, 800, 210), b = await pic(900, 1200, 30);
    const textPdf = async (name, extra) => { const L = await lib('pdflib'), d = await L.PDFDocument.create(), f = await d.embedFont(L.StandardFonts.Helvetica); for (let p = 0; p < 2; p++) { const pg = d.addPage([595, 842]); for (let i = 0; i < 8; i++) pg.drawText(`Line ${i + 1} on page ${p + 1}${i === 3 ? extra : ''}`, { x: 60, y: 760 - i * 22, size: 12, font: f }); } return new File([await d.save()], name, { type: 'application/pdf' }); };
    const t1 = await textPdf('text-a.pdf', ''), t2 = await textPdf('text-b.pdf', ' changed');
    const [pdf1] = await one('jpg2pdf', [a, b]);
    if (pdf1) {
      const [merged] = await one('merge', [pdf1, pdf1]);
      await one('split', [merged || pdf1]);
      await one('rotate', [pdf1]);
      await one('pagenum', [pdf1]);
      await one('watermark', [pdf1], { text: 'TEST' });
      await one('compress', [pdf1]);
      await one('pdf2jpg', [pdf1]);
      await one('organize', [pdf1]);
      await one('nup', [merged || pdf1]);
    }
    await one('compare', [t1, t2]);
    await one('pdf2txt', [t1]);
    await one('imgcompress', [a]);
    await one('imgresize', [b]);
    await one('imgconvert', [a]);
    await one('passport', [b]);
    await one('palette', [a]);
    await one('img2svg', [a]);
    await one('favicon', [a]);
    /* app 1.0: WebP, AVIF (WebAssembly encoder) and Photoshop output, AVIF back to JPG, and Text to PDF with Hindi and Tamil (HarfBuzz) */
    await one('jpg2webp', [a]);
    const [avif] = await one('png2avif', [b]);
    if (avif) await one('avif2jpg', [avif]);
    await one('png2psd', [a]);
    await one('txt2pdf', [], { html: 'Fileora self-test\n\nहिंदी में संयुक्ताक्षर: क्ष त्र ज्ञ श्र\n- தமிழ் சோதனை கொண்டு\n- English line' });
    const fonts = { geist: document.fonts.check('700 20px Geist'), caveat: document.fonts.check('600 20px Caveat') };
    return { ok: res.every(r => r.ok), passed: res.filter(r => r.ok).length, total: res.length, ms: Math.round(performance.now() - t0), tools: Object.keys(DEFS).length, fonts, results: res, ua: navigator.userAgent };
  },
  /* several results as one ZIP */
  zip: async ({ oids, names }) => {
    const JSZip = await lib('jszip'), zip = new JSZip(), used = {};
    oids.forEach((o, i) => { let n = names[i] || 'file'; if (used[n]) n = baseName(n) + '-' + (++used[n]) + (extOf(n) ? '.' + extOf(n) : ''); else used[n] = 1; zip.file(n, APPO[o]); });
    const blob = await zip.generateAsync({ type: 'blob' });
    return { oid: putOut(blob), size: blob.size };
  }
};
window.FileoraApp = {
  protocol: APP_PROTOCOL,
  recv(msg) {
    const id = msg && msg.id, fn = msg && CMDS[msg.cmd];
    if (!fn) { appSend({ re: id, ok: false, error: 'Unknown command' }); return; }
    Promise.resolve().then(() => fn(msg)).then(
      data => appSend({ re: id, ok: true, data: data === undefined ? null : data }),
      e => { if (!(e instanceof UserError)) console.error(e); appSend({ re: id, ok: false, error: e instanceof UserError ? e.message : e && e.message === 'cancelled' ? 'cancelled' : friendly(e), user: e instanceof UserError }); }
    );
  }
};
/* the app waits for this before it sends anything */
const appReady = () => appSend({ ev: 'ready', protocol: APP_PROTOCOL, tools: Object.keys(DEFS) });
if (document.readyState === 'complete') setTimeout(appReady, 0); else addEventListener('load', () => setTimeout(appReady, 0));
