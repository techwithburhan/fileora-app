/*! Fileora tool engine for the app. Built 2026-11-18 by scripts/build-engine.sh from the website's public/js/src and engine/app-bridge.js. */
(function () {
'use strict';

/* ---- 10-helpers.js ---- */
/* =====================================================================
   Fileora tool engine
   ---------------------------------------------------------------------
   Turns every <div class="fo-app" data-fo-tool="ID"> into a working tool.
   Tool behaviour comes from the module scripts (modules/<module>/*.js),
   which call FileoraEngine.register({...}). Names, descriptions and where
   a tool runs come from WordPress (window.FileoraConfig).

   Browser tools run here with pdf-lib, pdf.js and canvas; files never
   leave the device. Server tools are sent to WordPress, which forwards
   them to the Fileora processing server:
       POST {rest}/jobs/{tool}   multipart files[], options (JSON), url -> 202 {job, token}
       GET  {rest}/jobs/{job}    header X-Fileora-Token -> {status, ahead, kind, name, size, text, error}
       GET  {rest}/jobs/{job}/file
   ===================================================================== */
const CFG = Object.assign({ rest: '', nonce: '', maxFileMB: 100, maxFiles: 20, backend: false, deletionText: 'within 1 hour', tools: {}, catalog: [] }, window.FileoraConfig || {});
const DEFS = {};

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = (n, cls = 'fo-ic') => `<svg class="${cls}" aria-hidden="true" focusable="false"><use href="#i-${n}"/></svg>`;
const HAS_GSAP = () => typeof window.gsap !== 'undefined';
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const store = {
  get(k, d) { try { const v = localStorage.getItem('fileora.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('fileora.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
};
function fmtSize(b) { if (b < 1024) return b + ' B'; if (b < 1048576) return (b / 1024).toFixed(b < 10240 ? 1 : 0) + ' KB'; return (b / 1048576).toFixed(b < 10485760 ? 2 : 1) + ' MB'; }
function baseName(n) { return String(n).replace(/\.[^.]+$/, '') || 'file'; }
function extOf(n) { const m = /\.([^.]+)$/.exec(n || ''); return m ? m[1].toLowerCase() : ''; }
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const sleep = ms => new Promise(r => setTimeout(r, ms));

class UserError extends Error {}
class NoServer extends Error {}

/* accepted inputs */
const ACCEPT = {
  pdf: { ext: ['pdf'], input: '.pdf,application/pdf', noun: 'PDF', nouns: 'PDF files', kinds: ['pdf'] },
  image: { ext: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif'], input: 'image/*', noun: 'image', nouns: 'images', kinds: ['image'] },
  pdfimage: { ext: ['pdf', 'jpg', 'jpeg', 'png', 'webp'], input: '.pdf,application/pdf,image/*', noun: 'PDF or image', nouns: 'PDF or images', kinds: ['pdf', 'image'] },
  heic: { ext: ['heic', 'heif', 'jpg', 'jpeg', 'png', 'webp'], input: '.heic,.heif,image/heic,image/heif', noun: 'HEIC photo', nouns: 'HEIC photos', kinds: ['heic', 'image'] },
  svg: { ext: ['svg'], input: '.svg,image/svg+xml', noun: 'SVG file', nouns: 'SVG files', kinds: ['svg'] },
  word: { ext: ['doc', 'docx', 'odt', 'rtf', 'txt'], input: '.doc,.docx,.odt,.rtf,.txt', noun: 'Word file', nouns: 'Word files', kinds: ['word'] },
  ppt: { ext: ['ppt', 'pptx', 'pps', 'ppsx', 'odp'], input: '.ppt,.pptx,.pps,.ppsx,.odp', noun: 'PowerPoint file', nouns: 'PowerPoint files', kinds: ['ppt'] },
  excel: { ext: ['xls', 'xlsx', 'ods', 'csv'], input: '.xls,.xlsx,.ods,.csv', noun: 'spreadsheet', nouns: 'spreadsheets', kinds: ['excel'] },
  url: { ext: [], input: '', noun: 'web address', nouns: 'web addresses', kinds: [] },
  html: { ext: ['html', 'htm'], input: '.html,.htm,text/html', noun: 'HTML file', nouns: 'HTML files', kinds: ['html'] }
};
function kindOf(f) {
  const e = extOf(f.name);
  if (e === 'pdf' || f.type === 'application/pdf') return 'pdf';
  if (e === 'svg' || f.type === 'image/svg+xml') return 'svg';
  if (e === 'heic' || e === 'heif' || /^image\/hei[cf]/.test(f.type)) return 'heic';
  if (ACCEPT.image.ext.includes(e) || /^image\//.test(f.type)) return 'image';
  for (const k of ['word', 'ppt', 'excel', 'html']) if (ACCEPT[k].ext.includes(e)) return k;
  return 'other';
}

const LANGS = [['en', 'English'], ['hi', 'Hindi'], ['bn', 'Bengali'], ['ta', 'Tamil'], ['te', 'Telugu'], ['mr', 'Marathi'], ['gu', 'Gujarati'], ['kn', 'Kannada'], ['ml', 'Malayalam'], ['pa', 'Punjabi'], ['ur', 'Urdu'], ['ar', 'Arabic'], ['zh', 'Chinese (Simplified)'], ['ja', 'Japanese'], ['ko', 'Korean'], ['fr', 'French'], ['de', 'German'], ['es', 'Spanish'], ['pt', 'Portuguese'], ['it', 'Italian'], ['ru', 'Russian'], ['tr', 'Turkish'], ['id', 'Indonesian']];
const pageSizeOpt = (v = 'a4') => ({ id: 'size', type: 'seg', label: 'Page size', value: v, choices: [['fit', 'Fit image'], ['a4', 'A4'], ['letter', 'US Letter']] });
const orientOpt = { id: 'orient', type: 'seg', label: 'Orientation', value: 'auto', choices: [['auto', 'Auto'], ['portrait', 'Portrait'], ['landscape', 'Landscape']], show: o => o.size !== 'fit' };
const marginOpt = { id: 'margin', type: 'seg', label: 'Margin', value: 'small', choices: [['none', 'None'], ['small', 'Small'], ['large', 'Large']] };

/* toasts */
function toast(msg, kind = 'info') {
  let box = $('.fo-toasts');
  if (!box) { box = document.createElement('div'); box.className = 'fo-toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
  const el = document.createElement('div');
  el.className = 'fo-toast' + (kind === 'error' ? ' err' : '');
  el.innerHTML = icon(kind === 'error' ? 'alert' : kind === 'ok' ? 'check' : 'info') + `<span>${esc(msg)}</span>`;
  box.appendChild(el);
  if (HAS_GSAP() && !REDUCED) gsap.from(el, { y: 16, opacity: 0, duration: .3, ease: 'power2.out' });
  setTimeout(() => {
    if (HAS_GSAP() && !REDUCED) gsap.to(el, { opacity: 0, y: 8, duration: .25, onComplete: () => el.remove() }); else el.remove();
  }, kind === 'error' ? 5200 : 3200);
}

/* analytics (fileora-track.js) */
function track(e) { try { if (window.FileoraTrack) window.FileoraTrack.event(e); } catch (er) { /* ignore */ } }

/* files handed from one tool to the next (or from the homepage), kept briefly in IndexedDB */
const Handoff = {
  open() {
    return new Promise((res, rej) => {
      if (!window.indexedDB) return rej(new Error('no idb'));
      const r = indexedDB.open('fileora', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('handoff');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  },
  async put(files) {
    const db = await this.open();
    await new Promise((res, rej) => { const tx = db.transaction('handoff', 'readwrite'); tx.objectStore('handoff').put({ files, ts: Date.now() }, 'next'); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    db.close();
  },
  async take() {
    const db = await this.open();
    const v = await new Promise((res, rej) => { const tx = db.transaction('handoff', 'readwrite'); const st = tx.objectStore('handoff'); const g = st.get('next'); g.onsuccess = () => { st.delete('next'); res(g.result); }; g.onerror = () => rej(g.error); });
    db.close();
    return v && Date.now() - v.ts < 15 * 60000 ? v.files : null;
  }
};
async function goToTool(id, files) {
  const t = CFG.catalog.find(x => x.id === id);
  if (!t) return;
  let ok = false;
  if (files && files.length) { try { await Handoff.put(files); ok = true; } catch (e) { /* private mode: open the tool without files */ } }
  location.href = t.url + (ok ? (t.url.includes('?') ? '&' : '?') + 'fo_handoff=1' : '');
}

/* ---- 20-media.js ---- */
/* ---------------- on-demand libraries ---------------- */
/* Libraries are served from this site (public/vendor), so no third party sees the visitor;
   public CDNs are only a fallback if the local copy can't load. */
const VENDOR = (CFG.vendor || '').replace(/\/?$/, '/');
const LIBS = {
  pdflib: [VENDOR + 'pdf-lib.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js'],
  pdfjs: [VENDOR + 'pdf.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'],
  jszip: [VENDOR + 'jszip.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'],
  heic2any: [VENDOR + 'heic2any.min.js', 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js'],
  imagetracer: [VENDOR + 'imagetracer.min.js', 'https://cdn.jsdelivr.net/npm/imagetracerjs@1.2.6/imagetracer_v1.2.6.js'],
  /* 2.18: built for Fileora (WebAssembly inside the file, so they also load from an app's files) */
  avifenc: [VENDOR + 'avifenc.min.js'], avifdec: [VENDOR + 'avifdec.min.js'], webpenc: [VENDOR + 'webp.min.js'],
  psd: [VENDOR + 'psd.min.js'], hb: [VENDOR + 'hb.min.js'],
  fontkit: [VENDOR + 'fontkit.min.js', 'https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js']
};
const libCache = {};
const fontCache = {};
/* A font from public/vendor/fonts (Noto, SIL Open Font License) as bytes. Fonts come as small
   scripts (base64), so they load the same way from the website and from an app's own files. */
function fontBytes(file) {
  if (!fontCache[file]) {
    fontCache[file] = (async () => {
      const data = () => (window.FileoraFontData || {})[file];
      if (!data()) await loadScript(VENDOR + 'fonts/' + file.replace(/\.ttf$/, '.js')).catch(() => { throw new Error('offline'); });
      const b64 = data(); if (!b64) throw new Error('offline');
      const bin = atob(b64), out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      delete window.FileoraFontData[file];   // keep only the bytes
      return out;
    })().catch(e => { delete fontCache[file]; throw e; });
  }
  return fontCache[file];
}
/* Full address of a library on this site (for Web Workers), or '' when there is no local copy. */
function libUrl(name) { return VENDOR === '/' ? '' : new URL(LIBS[name][0], location.href).href; }
function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.async = true; if (!src.startsWith(VENDOR)) s.crossOrigin = 'anonymous';
    s.onload = () => res(src);
    s.onerror = () => { s.remove(); rej(new Error('load failed')); };
    document.head.appendChild(s);
  });
}
function lib(name) {
  if (!libCache[name]) {
    libCache[name] = (async () => {
      let used = null;
      const urls = VENDOR === '/' ? LIBS[name].slice(1) : LIBS[name];
      for (const u of urls) { try { used = await loadScript(u); break; } catch (e) { /* try next */ } }
      if (!used) throw new Error('offline');
      if (name === 'pdfjs') window.pdfjsLib.GlobalWorkerOptions.workerSrc = used.replace('pdf.min.js', 'pdf.worker.min.js');
      if (name === 'hb') return window.FileoraHB.load();
      return { pdflib: window.PDFLib, pdfjs: window.pdfjsLib, jszip: window.JSZip, heic2any: window.heic2any, imagetracer: window.ImageTracer,
        avifenc: window.FileoraAvifEnc, avifdec: window.FileoraAvifDec, webpenc: window.FileoraWebp, psd: window.FileoraPsd, fontkit: window.fontkit }[name];
    })().catch(e => { delete libCache[name]; throw e; });
  }
  return libCache[name];
}

/* ---------------- PDF helpers ---------------- */
async function pdfjsDoc(file, password) {
  const pdfjs = await lib('pdfjs');
  const data = new Uint8Array(await file.arrayBuffer());
  return pdfjs.getDocument({ data, isEvalSupported: false, password: password || undefined }).promise;
}
async function renderPage(page, scale, opts = {}) {
  let vp = page.getViewport({ scale });
  const max = opts.maxPixels || 16e6;
  if (vp.width * vp.height > max) { scale *= Math.sqrt(max / (vp.width * vp.height)); vp = page.getViewport({ scale }); }
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.floor(vp.width)); c.height = Math.max(1, Math.floor(vp.height));
  const g = c.getContext('2d', { willReadFrequently: !!opts.read });
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: g, viewport: vp }).promise;
  return c;
}
const canvasToBlob = (c, type, q) => new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('canvas')), type, q));
const pdfOut = (name, bytes, note) => ({ name, blob: new Blob([bytes], { type: 'application/pdf' }), note });
async function loadPdf(it, opts = {}) {
  const { PDFDocument } = await lib('pdflib');
  let doc;
  try { doc = await PDFDocument.load(await it.file.arrayBuffer(), { ignoreEncryption: true, updateMetadata: opts.updateMetadata !== false }); }
  catch (e) { throw new UserError(`${it.name} couldn’t be opened. It may be damaged, so try Repair PDF first.`); }
  if (doc.isEncrypted) throw new UserError(`${it.name} is password-protected. Unlock it first, then try again.`);
  return doc;
}
async function savePdf(doc, opts = {}) { if (opts.brand !== false) { doc.setProducer('Fileora'); doc.setCreator('Fileora'); } return doc.save(); }
function friendly(e) {
  const m = String(e && (e.message || e.name) || '');
  if (m === 'offline') return 'The PDF engine couldn’t load. Check your internet connection and try again.';
  if (/password|encrypt/i.test(m)) return 'This PDF is password-protected. Unlock it first, then try again.';
  if (/memory|allocation|too large/i.test(m)) return 'This file is too large for your device’s memory. Try a smaller file or a computer.';
  return 'Something went wrong while processing the file. If it may be damaged, try Repair PDF first.';
}
/* visual page geometry that respects /Rotate */
function vis(page) {
  const r = ((page.getRotation().angle % 360) + 360) % 360;
  const b = page.getCropBox();
  const W = b.width, H = b.height;
  const map = (u, v) => r === 90 ? { x: b.x + W - v, y: b.y + u } : r === 180 ? { x: b.x + W - u, y: b.y + H - v } : r === 270 ? { x: b.x + v, y: b.y + H - u } : { x: b.x + u, y: b.y + v };
  return { W: r % 180 ? H : W, H: r % 180 ? W : H, r, map, box: b };
}
/* an unrotated rectangle {x,y,width,height} for a visual rectangle (u0,v0)-(u1,v1) */
function visRect(V, u0, v0, u1, v1) {
  const a = V.map(u0, v0), b = V.map(u1, v1);
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) };
}
function parseRanges(str, n) {
  const groups = [];
  for (const raw of String(str || '').split(/[,;]+/)) {
    const s = raw.trim().toLowerCase().replace(/\s+/g, '');
    if (!s) continue;
    let m, a, b;
    if ((m = /^(\d+)$/.exec(s))) { a = b = +m[1]; }
    else if ((m = /^(\d*)-(\d*|end|last)$/.exec(s))) { a = m[1] ? +m[1] : 1; b = (!m[2] || m[2] === 'end' || m[2] === 'last') ? n : +m[2]; }
    else throw new UserError(`“${raw.trim()}” isn’t a page range. Use something like 1-3, 5.`);
    if (a < 1 || b > n || a > b) throw new UserError(`Pages ${a}${a !== b ? '-' + b : ''} don’t exist. This PDF has ${n} page${n > 1 ? 's' : ''}.`);
    groups.push(Array.from({ length: b - a + 1 }, (_, i) => a - 1 + i));
  }
  return groups;
}
const rangeLabel = g => g.length === 1 ? `page-${g[0] + 1}` : (g[g.length - 1] - g[0] === g.length - 1 ? `pages-${g[0] + 1}-${g[g.length - 1] + 1}` : `part`);
const PAGE = { a4: [595.28, 841.89], letter: [612, 792], a3: [841.89, 1190.55], a5: [419.53, 595.28], legal: [612, 1008] };
const MM = 72 / 25.4;

/* ---------------- images ---------------- */
const isAvif = f => f.type === 'image/avif' || /\.avif$/i.test(f.name || '');
async function decodeImage(file) {
  try { const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); return { src: bmp, w: bmp.width, h: bmp.height, done: () => bmp.close() }; }
  catch (e) {
    const url = URL.createObjectURL(file); const img = new Image(); img.src = url;
    try { await img.decode(); } catch (er) {
      URL.revokeObjectURL(url);
      /* AVIF in a browser that can't show it (older Safari / iPhone): decode it here */
      if (isAvif(file)) {
        try {
          const A = await lib('avifdec'), id = await A.decode(await file.arrayBuffer());
          const c = document.createElement('canvas'); c.width = id.width; c.height = id.height;
          c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(id.data.buffer, id.data.byteOffset, id.data.byteLength), id.width, id.height), 0, 0);
          return { src: c, w: c.width, h: c.height, done: () => { c.width = c.height = 0; } };
        } catch (er2) { if (er2 && er2.message === 'offline') throw er2; }
      }
      throw new UserError(`${file.name} couldn’t be read as an image.`);
    }
    return { src: img, w: img.naturalWidth, h: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
  }
}
function canvasOf(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
/* the whole image on a canvas (EXIF rotation applied), optionally capped to maxSide */
async function imageCanvas(file, maxSide, background) {
  const d = await decodeImage(file);
  const s = maxSide ? Math.min(1, maxSide / Math.max(d.w, d.h)) : 1;
  const c = canvasOf(d.w * s, d.h * s), g = c.getContext('2d');
  if (background) { g.fillStyle = background; g.fillRect(0, 0, c.width, c.height); }
  g.imageSmoothingQuality = 'high';
  g.drawImage(d.src, 0, 0, c.width, c.height); d.done();
  return c;
}
function filterPixels(g, w, h, mode) {
  const d = g.getImageData(0, 0, w, h), px = d.data, n = px.length;
  const lum = new Float32Array(n / 4);
  const hist = new Uint32Array(256);
  for (let i = 0, k = 0; i < n; i += 4, k++) { const l = px[i] * .299 + px[i + 1] * .587 + px[i + 2] * .114; lum[k] = l; hist[l | 0]++; }
  const total = n / 4; let acc = 0, lo = 0, hi = 255;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > total * .02) { lo = v; break; } }
  acc = 0; for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > total * .08) { hi = v; break; } }
  const span = Math.max(24, hi - lo);
  for (let i = 0, k = 0; i < n; i += 4, k++) {
    let v = (lum[k] - lo) / span; v = v < 0 ? 0 : v > 1 ? 1 : v;
    if (mode === 'doc') v = 1 / (1 + Math.exp(-11 * (v - .52)));
    else v = Math.pow(v, .92);
    const o = v * 255; px[i] = px[i + 1] = px[i + 2] = o;
  }
  g.putImageData(d, 0, 0);
}
async function imageForPdf(file, filter) {
  const d = await decodeImage(file);
  const s = Math.min(1, 4200 / Math.max(d.w, d.h));
  const w = Math.max(1, Math.round(d.w * s)), h = Math.max(1, Math.round(d.h * s));
  const png = (file.type === 'image/png' || extOf(file.name) === 'png') && (!filter || filter === 'none');
  const c = canvasOf(w, h);
  const g = c.getContext('2d', { willReadFrequently: !!filter && filter !== 'none' });
  if (!png) { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); }
  g.drawImage(d.src, 0, 0, w, h); d.done();
  if (filter && filter !== 'none') filterPixels(g, w, h, filter);
  const blob = await canvasToBlob(c, png ? 'image/png' : 'image/jpeg', .9);
  c.width = c.height = 0;
  return { bytes: await blob.arrayBuffer(), w, h, png };
}
/* embeds any canvas as JPEG (opaque) or PNG (with transparency) */
async function embedCanvas(doc, c, png, q = .9) {
  const blob = await canvasToBlob(c, png ? 'image/png' : 'image/jpeg', q);
  const bytes = await blob.arrayBuffer();
  return png ? doc.embedPng(bytes) : doc.embedJpg(bytes);
}
async function imagesToPdf(items, o, ctx, filter) {
  const { PDFDocument } = await lib('pdflib');
  const doc = await PDFDocument.create();
  const margin = { none: 0, small: 20, large: 42 }[o.margin] ?? 20;
  for (let i = 0; i < items.length; i++) {
    ctx.progress(i / items.length, `Image ${i + 1} of ${items.length}`);
    const im = await imageForPdf(items[i].file, filter);
    const img = im.png ? await doc.embedPng(im.bytes) : await doc.embedJpg(im.bytes);
    let pw, ph;
    if (o.size === 'fit') { pw = im.w * .75 + margin * 2; ph = im.h * .75 + margin * 2; }
    else {
      [pw, ph] = PAGE[o.size] || PAGE.a4;
      const land = o.orient === 'landscape' || (o.orient !== 'portrait' && im.w > im.h);
      if (land) [pw, ph] = [ph, pw];
    }
    const bw = pw - margin * 2, bh = ph - margin * 2, sc = Math.min(bw / im.w, bh / im.h);
    const dw = im.w * sc, dh = im.h * sc;
    doc.addPage([pw, ph]).drawImage(img, { x: (pw - dw) / 2, y: (ph - dh) / 2, width: dw, height: dh });
  }
  ctx.progress(.96, 'Saving');
  return savePdf(doc);
}
/* every page as an image; transform(g, w, h) may change the pixels */
async function rasterize(file, dpi, q, prog, transform) {
  const pdf = await pdfjsDoc(file);
  const { PDFDocument } = await lib('pdflib');
  const out = await PDFDocument.create();
  const n = pdf.numPages;
  for (let i = 1; i <= n; i++) {
    prog && prog((i - 1) / n, `Page ${i} of ${n}`);
    const page = await pdf.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    const c = await renderPage(page, dpi / 72, { read: !!transform });
    if (transform) transform(c.getContext('2d', { willReadFrequently: true }), c.width, c.height);
    const img = await embedCanvas(out, c, false, q);
    c.width = c.height = 0;
    out.addPage([vp.width, vp.height]).drawImage(img, { x: 0, y: 0, width: vp.width, height: vp.height });
    page.cleanup();
  }
  await pdf.destroy();
  return savePdf(out);
}
async function textPng(text, color, weight = 700) {
  try { await document.fonts.load(`${weight} 120px Geist`); } catch (e) { /* fallback font */ }
  const px = 120, font = `${weight} ${px}px Geist, 'Helvetica Neue', Arial, 'Noto Sans', 'Noto Sans Devanagari', sans-serif`;
  const c = document.createElement('canvas'), g = c.getContext('2d');
  g.font = font;
  const w = Math.ceil(g.measureText(text).width + px * .24), h = Math.ceil(px * 1.32);
  c.width = w; c.height = h;
  g.font = font; g.fillStyle = color; g.textBaseline = 'middle';
  g.fillText(text, px * .12, h / 2 + px * .04);
  const blob = await canvasToBlob(c, 'image/png');
  return { bytes: await blob.arrayBuffer(), w, h, px };
}
let measureCtx;
function textWidth(text, size) { measureCtx = measureCtx || document.createElement('canvas').getContext('2d'); measureCtx.font = `700 ${size}px Geist, 'Helvetica Neue', Arial, sans-serif`; return measureCtx.measureText(text).width; }

/* text lines from a PDF (pdf.js) */
async function pdfLines(file, prog, label) {
  const pdf = await pdfjsDoc(file);
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    prog && prog((i - 1) / pdf.numPages, `${label} page ${i} of ${pdf.numPages}`);
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    const lines = [];
    for (const it of tc.items) {
      if (typeof it.str !== 'string' || !it.str) continue;
      const tr = it.transform, size = Math.hypot(tr[2], tr[3]) || it.height || 10, x = tr[4], y = tr[5];
      let ln = null;
      for (let k = lines.length - 1; k >= Math.max(0, lines.length - 8); k--) if (Math.abs(lines[k].y - y) < size * .45) { ln = lines[k]; break; }
      if (!ln) { ln = { y, x, parts: [] }; lines.push(ln); }
      ln.parts.push({ x, s: it.str, w: it.width, size });
    }
    for (const ln of lines) {
      ln.parts.sort((a, b) => a.x - b.x);
      let txt = '', end = null;
      for (const p of ln.parts) { if (end !== null && p.x - end > p.size * .22 && !/\s$/.test(txt) && !/^\s/.test(p.s)) txt += ' '; txt += p.s; end = p.x + p.w; }
      ln.text = txt.replace(/\s+/g, ' ').trim();
      ln.size = Math.max(...ln.parts.map(p => p.size));
      ln.x = ln.parts[0].x;
    }
    pages.push(lines.filter(l => l.text).sort((a, b) => b.y - a.y));
    page.cleanup();
  }
  await pdf.destroy();
  return pages;
}
function toMarkdown(pages, breaks) {
  const hist = new Map();
  pages.flat().forEach(l => { const k = Math.round(l.size * 2) / 2; hist.set(k, (hist.get(k) || 0) + l.text.length); });
  let body = 11, best = 0;
  hist.forEach((v, k) => { if (v > best) { best = v; body = k; } });
  const blocks = [];
  pages.forEach((lines, pi) => {
    if (pi && breaks) blocks.push({ t: 'hr' });
    let prev = null;
    for (const l of lines) {
      const r = l.size / body, gap = prev ? prev.y - l.y : 0, last = blocks[blocks.length - 1];
      const near = prev && gap < Math.max(l.size, prev.size) * 1.75;
      const bul = /^[•●▪◦‣∙·■□▸►\-–*]\s*(.+)/.exec(l.text), num = /^(\d{1,3}|[a-z])[.)]\s+.+/i.exec(l.text);
      if (r >= 1.18 && l.text.length < 140 && !bul) {
        const lvl = r >= 1.75 ? 1 : r >= 1.38 ? 2 : 3;
        if (last && last.t === 'h' && last.lvl === lvl && near) last.text += ' ' + l.text; else blocks.push({ t: 'h', lvl, text: l.text });
      } else if (bul) blocks.push({ t: 'li', text: bul[1] });
      else if (num && l.text.length > 3) blocks.push({ t: 'ol', text: l.text });
      else if (last && (last.t === 'p' || last.t === 'li' || last.t === 'ol') && near && pi === last.page) {
        last.text = /[A-Za-z]-$/.test(last.text) && /^[a-z]/.test(l.text) ? last.text.slice(0, -1) + l.text : last.text + ' ' + l.text;
      } else blocks.push({ t: 'p', text: l.text });
      const nb = blocks[blocks.length - 1]; if (nb) nb.page = pi;
      prev = l;
    }
  });
  const out = [];
  blocks.forEach((b, i) => {
    const nx = blocks[i + 1];
    if (b.t === 'h') out.push('#'.repeat(b.lvl) + ' ' + b.text, '');
    else if (b.t === 'hr') out.push('---', '');
    else if (b.t === 'li' || b.t === 'ol') { out.push((b.t === 'li' ? '- ' : '') + b.text); if (!nx || (nx.t !== 'li' && nx.t !== 'ol')) out.push(''); }
    else out.push(b.text, '');
  });
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
function diffLines(a, b) {
  let s = 0; while (s < a.length && s < b.length && a[s] === b[s]) s++;
  let ea = a.length, eb = b.length; while (ea > s && eb > s && a[ea - 1] === b[eb - 1]) { ea--; eb--; }
  const ops = [];
  for (let i = 0; i < s; i++) ops.push(['=', i, i]);
  const A = a.slice(s, ea), B = b.slice(s, eb), n = A.length, m = B.length;
  if (n * m > 9e6) { for (let i = 0; i < n; i++) ops.push(['-', s + i, -1]); for (let j = 0; j < m; j++) ops.push(['+', -1, s + j]); }
  else {
    const W = m + 1, L = new Uint16Array((n + 1) * W);
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i * W + j] = A[i] === B[j] ? L[(i + 1) * W + j + 1] + 1 : Math.max(L[(i + 1) * W + j], L[i * W + j + 1]);
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (A[i] === B[j]) { ops.push(['=', s + i, s + j]); i++; j++; }
      else if (L[(i + 1) * W + j] >= L[i * W + j + 1]) { ops.push(['-', s + i, -1]); i++; }
      else { ops.push(['+', -1, s + j]); j++; }
    }
    while (i < n) { ops.push(['-', s + i, -1]); i++; }
    while (j < m) { ops.push(['+', -1, s + j]); j++; }
  }
  for (let k = 0; k < a.length - ea; k++) ops.push(['=', ea + k, eb + k]);
  return ops;
}

/* ---------------- image tool helpers ---------------- */
const MIME_PSD = 'image/vnd.adobe.photoshop';
/* Canvas -> AVIF, WebP or PSD (formats a canvas can't always write), else the canvas's own encoder.
   q: 0..1. AVIF uses jSquash (libaom); WebP falls back to jSquash when the browser writes PNG instead
   (Safari, iPhone); PSD (ag-psd) keeps transparency in one layer, like Photoshop's own "Layer 0". */
async function encodeCanvas(c, type, q = 0.9, opts = {}) {
  if (type === 'image/avif') {
    const A = await lib('avifenc');
    const id = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height);
    const speed = c.width * c.height > 8e6 ? 8 : 6;
    const buf = await A.encode(id, { quality: Math.round(Math.max(1, Math.min(100, q * 100))), speed, lossless: !!opts.lossless });
    return new Blob([buf], { type: 'image/avif' });
  }
  if (type === 'image/webp') {
    const b = await canvasToBlob(c, 'image/webp', q);
    if (b.type === 'image/webp') return b;
    const W = await lib('webpenc');
    const id = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height);
    return new Blob([await W.encode(id, { quality: Math.round(q * 100) })], { type: 'image/webp' });
  }
  if (type === MIME_PSD) {
    const P = await lib('psd');
    const buf = P.writePsd({ width: c.width, height: c.height, canvas: c, children: [{ name: opts.layer || 'Layer 0', canvas: c }] }, { generateThumbnail: false });
    return new Blob([buf], { type: MIME_PSD });
  }
  return canvasToBlob(c, type, type === 'image/png' ? undefined : q);
}
const IMG_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const OUT_EXT = Object.assign({ 'image/avif': 'avif', [MIME_PSD]: 'psd' }, IMG_EXT);
const sameType = file => IMG_EXT[file.type] ? file.type : 'image/jpeg';
const renameImg = (name, type, suffix) => baseName(name) + (suffix || '') + '.' + (OUT_EXT[type] || 'jpg');
const Img = {
  /* Draw an image region onto a canvas of the target size and encode it. */
  async render(file, { sx = 0, sy = 0, sw, sh, width, height, type, quality = 0.9, suffix }) {
    const img = await decodeImage(file);
    sw = sw || img.w; sh = sh || img.h;
    width = width || sw; height = height || sh;
    const c = canvasOf(width, height), g = c.getContext('2d');
    if (type === 'image/jpeg') { g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); }
    g.imageSmoothingQuality = 'high';
    g.drawImage(img.src, sx, sy, sw, sh, 0, 0, c.width, c.height);
    img.done();
    const blob = await encodeCanvas(c, type, quality);
    return { blob, name: renameImg(file.name, type, suffix), width: c.width, height: c.height };
  },
  async compress(file, { quality = 0.72, maxSide = 0, type } = {}) {
    const img = await decodeImage(file); const w = img.w, h = img.h; img.done();
    const scale = maxSide ? Math.min(1, maxSide / Math.max(w, h)) : 1;
    const outType = type || (file.type === 'image/png' ? 'image/webp' : sameType(file));
    const out = await Img.render(file, { width: w * scale, height: h * scale, type: outType, quality, suffix: '-compressed' });
    if (out.blob.size >= file.size && scale === 1) return { blob: file, name: file.name, width: w, height: h, note: 'Already optimized, so we kept the original' };
    return out;
  },
  async resize(file, { width, height, percent, type } = {}) {
    const img = await decodeImage(file); const w = img.w, h = img.h; img.done();
    if (percent) { width = w * percent / 100; height = h * percent / 100; }
    else if (width && !height) height = h * width / w;
    else if (height && !width) width = w * height / h;
    if (!width || !height) throw new UserError('Give a width, a height or a percentage.');
    return Img.render(file, { width, height, type: type || sameType(file), quality: 0.92, suffix: '-' + Math.round(width) + 'x' + Math.round(height) });
  },
  async convert(file, type, { quality = 0.92 } = {}) {
    if (!OUT_EXT[type]) throw new UserError('Choose JPG, PNG, WebP or AVIF.');
    return Img.render(file, { type, quality });
  },
  async crop(file, { x, y, width, height, type } = {}) {
    const img = await decodeImage(file); const w = img.w, h = img.h; img.done();
    x = Math.max(0, Math.round(x || 0)); y = Math.max(0, Math.round(y || 0));
    width = Math.min(w - x, Math.round(width)); height = Math.min(h - y, Math.round(height));
    if (!(width > 0 && height > 0)) throw new UserError('The crop area is outside the image.');
    return Img.render(file, { sx: x, sy: y, sw: width, sh: height, type: type || sameType(file), quality: 0.92, suffix: '-cropped' });
  }
};
function cropRect(w, h, o) {
  const ratio = { '1:1': 1, '4:5': 4 / 5, '4:3': 4 / 3, '3:2': 3 / 2, '16:9': 16 / 9, '9:16': 9 / 16 }[o.ratio] || w / h;
  let cw = w, ch = w / ratio;
  if (ch > h) { ch = h; cw = h * ratio; }
  const s = Math.max(.2, Math.min(1, (+o.size || 100) / 100));
  cw *= s; ch *= s;
  const col = (o.pos || 'mc')[1], row = (o.pos || 'mc')[0];
  return { x: Math.round(col === 'l' ? 0 : col === 'r' ? w - cw : (w - cw) / 2), y: Math.round(row === 't' ? 0 : row === 'b' ? h - ch : (h - ch) / 2), width: Math.round(cw), height: Math.round(ch) };
}
function imageNote(out, file) {
  if (out.note) return out.note;
  const dims = `${out.width} × ${out.height} px`;
  return out.blob.size < file.size ? `${dims}, ${Math.round((1 - out.blob.size / file.size) * 100)}% smaller (${fmtSize(file.size)} to ${fmtSize(out.blob.size)})` : `${dims}, ${fmtSize(out.blob.size)}`;
}
async function eachImage(items, ctx, fn) {
  const outs = [];
  for (let i = 0; i < items.length; i++) {
    ctx.progress(i / items.length, `Image ${i + 1} of ${items.length}`);
    const out = await fn(items[i].file, items[i], i);
    outs.push({ name: out.name, blob: out.blob, note: imageNote(out, items[i].file), good: out.blob.size < items[i].file.size });
  }
  return outs;
}
/*
 * Encodes a canvas as JPEG (or WebP) no bigger than maxBytes, as close to it as possible.
 * Lowers quality first; if the smallest quality is still too big and shrink is allowed,
 * scales the image down. Returns { blob, quality, width, height }.
 */
async function encodeToSize(src, maxBytes, { type = 'image/jpeg', minQ = 0.08, shrink = true } = {}) {
  let c = src;
  for (let round = 0; round < 12; round++) {
    let lo = minQ, hi = 0.95, best = null;
    const top = await canvasToBlob(c, type, hi);
    if (top.size <= maxBytes) return { blob: top, quality: hi, width: c.width, height: c.height };
    for (let i = 0; i < 8; i++) {
      const q = (lo + hi) / 2, b = await canvasToBlob(c, type, q);
      if (b.size <= maxBytes) { best = { blob: b, quality: q }; lo = q; } else hi = q;
    }
    if (!best) { const b = await canvasToBlob(c, type, minQ); if (b.size <= maxBytes) best = { blob: b, quality: minQ }; }
    if (best) return { ...best, width: c.width, height: c.height };
    if (!shrink || c.width < 24 || c.height < 24) break;
    const small = await canvasToBlob(c, type, minQ);
    const f = Math.max(.5, Math.min(.92, Math.sqrt(maxBytes / small.size) * .95));
    const n = canvasOf(c.width * f, c.height * f), g = n.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, n.width, n.height); g.imageSmoothingQuality = 'high';
    g.drawImage(c, 0, 0, n.width, n.height);
    c = n;
  }
  return null;
}
/* Pads a JPEG with a comment segment so it reaches minBytes (the picture doesn't change). */
async function padJpeg(blob, minBytes) {
  if (blob.size >= minBytes) return blob;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let need = minBytes - bytes.length;
  const segs = [];
  while (need > 0) {
    const len = Math.min(65533, Math.max(1, need - 4));
    const seg = new Uint8Array(len + 4);
    seg[0] = 0xFF; seg[1] = 0xFE; seg[2] = (len + 2) >> 8; seg[3] = (len + 2) & 255;
    segs.push(seg); need -= seg.length;
  }
  return new Blob([bytes.slice(0, 2), ...segs, bytes.slice(2)], { type: 'image/jpeg' });
}

/* ---- 30-options.js ---- */
/* ---------------- options panel ----------------
   Field types: seg, select, text, password, textarea, number, range, toggle,
   color, pos, margins, signature, image (pick a picture), note (static text).
   A field may have show(o) to appear conditionally and help (string or fn). */
let optUid = 0;
const POS_LABEL = { tl: 'Top left', tc: 'Top centre', tr: 'Top right', ml: 'Middle left', mc: 'Centre', mr: 'Middle right', bl: 'Bottom left', bc: 'Bottom centre', br: 'Bottom right' };
const LABELLED = ['text', 'password', 'textarea', 'select', 'number', 'range'];
function optHtml(f, v, uid) {
  const id = uid + '-' + f.id;
  const tag = LABELLED.includes(f.type) ? 'label' : 'span';
  const lab = f.label && f.type !== 'toggle' && f.type !== 'note' ? `<${tag}${tag === 'label' ? ` for="${id}"` : ''} class="fo-opt-l">${esc(f.label)}</${tag}>` : '';
  switch (f.type) {
    case 'seg': return lab + `<div class="fo-seg${f.choices.length > 3 ? ' wrapit' : ''}" role="group" aria-label="${esc(f.label)}">${f.choices.map(([val, l]) => `<button type="button" data-val="${esc(val)}" aria-pressed="${String(v) === String(val)}">${esc(l)}</button>`).join('')}</div>`;
    case 'select': return lab + `<select class="fo-sel" id="${id}">${f.choices.map(([val, l]) => `<option value="${esc(val)}"${String(v) === String(val) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    case 'text': case 'password': return lab + `<input class="fo-inp" id="${id}" type="${f.type}" value="${esc(v || '')}" placeholder="${esc(f.placeholder || '')}" autocomplete="${f.type === 'password' ? 'new-password' : 'off'}" spellcheck="false"${f.maxlength ? ` maxlength="${f.maxlength}"` : ''}>`;
    case 'textarea': return lab + `<textarea class="fo-ta" id="${id}" placeholder="${esc(f.placeholder || '')}">${esc(v || '')}</textarea>`;
    case 'number': return lab + `<div class="fo-num"><input class="fo-inp" id="${id}" type="number" inputmode="decimal" value="${esc(v)}" min="${f.min ?? ''}" max="${f.max ?? ''}" step="${f.step ?? 'any'}">${f.suffix ? `<span>${esc(f.suffix)}</span>` : ''}</div>`;
    case 'range': return lab + `<div class="fo-rng"><input id="${id}" type="range" min="${f.min}" max="${f.max}" step="${f.step || 1}" value="${esc(v)}"><output>${esc(v)}${esc(f.suffix || '')}</output></div>`;
    case 'toggle': return `<label class="fo-sw"><span>${esc(f.label)}</span><input type="checkbox"${v ? ' checked' : ''}></label>`;
    case 'color': return lab + `<div class="fo-swatches" role="group" aria-label="${esc(f.label)}">${f.choices.map(c => `<button type="button" data-val="${c}" style="background:${c}" aria-pressed="${c === v}" aria-label="Colour ${c}"></button>`).join('')}${f.custom ? `<label class="fo-swatch-custom" title="Pick any colour"><input type="color" value="${esc(f.choices.includes(v) ? '#888888' : v)}" aria-label="Pick any colour"></label>` : ''}</div>`;
    case 'pos': { const cells = f.cells || ['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br']; return lab + `<div class="fo-posgrid" role="group" aria-label="${esc(f.label)}">${cells.map(c => `<button type="button" data-val="${c}" aria-pressed="${c === v}" aria-label="${POS_LABEL[c]}" title="${POS_LABEL[c]}"><i></i></button>`).join('')}</div>`; }
    case 'margins': return lab + `<div class="fo-margins">${['top', 'right', 'bottom', 'left'].map(s => `<label>${s[0].toUpperCase() + s.slice(1)}<input class="fo-inp" type="number" min="0" max="300" inputmode="decimal" data-side="${s}" value="${esc(v[s])}"></label>`).join('')}</div>`;
    case 'image': return lab + `<div class="fo-imgpick"><div class="fo-imgpick-prev">${v && v.url ? `<img src="${v.url}" alt="">` : icon('image')}</div><div><button type="button" class="fo-btn fo-btn-line fo-btn-sm" data-imgpick>${v ? 'Change picture' : 'Choose a picture'}</button><small>${v ? esc(v.name) : 'PNG or JPG. Transparent PNG works best for logos and stamps.'}</small></div><input type="file" accept="image/png,image/jpeg,image/webp" hidden></div>`;
    case 'note': return `<div class="fo-note">${icon('info')}<span>${f.html ? f.html : esc(f.text)}</span></div>`;
    case 'signature': return lab + `<div class="fo-seg fo-sig-tabs" role="group" aria-label="Signature type"><button type="button" data-sigmode="draw" aria-pressed="true">Draw</button><button type="button" data-sigmode="type" aria-pressed="false">Type</button><button type="button" data-sigmode="upload" aria-pressed="false">Upload</button></div>
      <div class="fo-sig-draw"><div class="fo-sig-pad"><canvas aria-label="Signature pad. Draw your signature with a mouse, finger or stylus."></canvas><div class="hintline"></div><span class="ph">Sign above the line</span></div></div>
      <div class="fo-sig-typewrap" hidden><input class="fo-inp fo-sig-type" type="text" placeholder="Type your name" aria-label="Type your name" maxlength="40"></div>
      <div class="fo-sig-upwrap" hidden><button type="button" class="fo-btn fo-btn-line fo-btn-sm" data-sigup>Choose a picture of your signature</button><small>A photo or scan on white paper works. The white background is removed.</small><input type="file" accept="image/*" hidden></div>
      <div class="fo-sig-row"><div class="fo-swatches" role="group" aria-label="Ink colour"><button type="button" data-ink="#16182F" style="background:#16182F" aria-pressed="true" aria-label="Black ink"></button><button type="button" data-ink="#2337B8" style="background:#2337B8" aria-pressed="false" aria-label="Blue ink"></button></div><button type="button" class="fo-btn fo-btn-quiet fo-btn-sm" data-sigclear>Clear</button></div>`;
    default: return '';
  }
}
function renderOpts(box, fields, vals, onChange) {
  const uid = 'fo' + (++optUid);
  box.innerHTML = fields.map(f => `<div class="fo-opt" data-f="${f.id}">${optHtml(f, vals[f.id], uid)}${f.help ? '<p class="fo-opt-help"></p>' : ''}</div>`).join('');
  const refresh = () => fields.forEach(f => {
    const w = box.querySelector(`.fo-opt[data-f="${f.id}"]`); if (!w) return;
    if (f.show) w.hidden = !f.show(vals);
    const h = w.querySelector('.fo-opt-help'); if (h) h.textContent = typeof f.help === 'function' ? f.help(vals) : f.help;
  });
  fields.forEach(f => {
    const w = box.querySelector(`.fo-opt[data-f="${f.id}"]`); if (!w) return;
    const set = v => { vals[f.id] = v; refresh(); onChange && onChange(f.id, v); };
    switch (f.type) {
      case 'seg': case 'pos':
        w.addEventListener('click', e => { const b = e.target.closest('[data-val]'); if (!b) return; $$('[data-val]', w).forEach(x => x.setAttribute('aria-pressed', x === b)); set(b.dataset.val); }); break;
      case 'color':
        w.addEventListener('click', e => { const b = e.target.closest('[data-val]'); if (!b) return; $$('[data-val]', w).forEach(x => x.setAttribute('aria-pressed', x === b)); set(b.dataset.val); });
        w.addEventListener('input', e => { if (e.target.type === 'color') { $$('[data-val]', w).forEach(x => x.setAttribute('aria-pressed', 'false')); set(e.target.value); } }); break;
      case 'select': w.querySelector('select').addEventListener('change', e => set(e.target.value)); break;
      case 'text': case 'password': case 'textarea': w.querySelector('input,textarea').addEventListener('input', e => set(e.target.value)); break;
      case 'number': w.querySelector('input').addEventListener('input', e => { const n = parseFloat(e.target.value); if (!isNaN(n)) set(Math.min(f.max ?? Infinity, Math.max(f.min ?? -Infinity, n))); }); break;
      case 'range': { const inp = w.querySelector('input'), out = w.querySelector('output'); inp.addEventListener('input', () => { out.textContent = inp.value + (f.suffix || ''); set(+inp.value); }); break; }
      case 'toggle': w.querySelector('input').addEventListener('change', e => set(e.target.checked)); break;
      case 'margins': w.addEventListener('input', e => { const s = e.target.dataset.side; if (!s) return; set({ ...vals[f.id], [s]: Math.max(0, parseFloat(e.target.value) || 0) }); }); break;
      case 'image': initImagePick(w, f, vals, set); break;
      case 'signature': initSignature(w, set); break;
    }
  });
  refresh();
  return refresh;
}
function initImagePick(w, f, vals, set) {
  const inp = $('input[type=file]', w);
  w.addEventListener('click', e => { if (e.target.closest('[data-imgpick]')) { inp.value = ''; inp.click(); } });
  inp.addEventListener('change', async () => {
    const file = inp.files[0]; if (!file) return;
    if (kindOf(file) !== 'image') return toast('Choose a PNG, JPG or WebP picture.', 'error');
    try {
      const d = await decodeImage(file);
      const c = canvasOf(Math.min(d.w, 3000 * d.w / Math.max(d.w, d.h)), Math.min(d.h, 3000 * d.h / Math.max(d.w, d.h)));
      c.getContext('2d').drawImage(d.src, 0, 0, c.width, c.height); d.done();
      const png = await canvasToBlob(c, 'image/png');
      const prev = vals[f.id]; if (prev && prev.url) URL.revokeObjectURL(prev.url);
      const v = { name: file.name, bytes: await png.arrayBuffer(), w: c.width, h: c.height, url: URL.createObjectURL(png) };
      $('.fo-imgpick-prev', w).innerHTML = `<img src="${v.url}" alt="">`;
      $('[data-imgpick]', w).textContent = 'Change picture';
      $('small', w).textContent = file.name;
      set(v);
    } catch (e) { toast(e instanceof UserError ? e.message : 'That picture couldn’t be opened.', 'error'); }
  });
}
function initSignature(w, set) {
  const cv = $('canvas', w), pad = $('.fo-sig-pad', w), ph = $('.ph', w), typeIn = $('.fo-sig-type', w), upIn = $('.fo-sig-upwrap input', w);
  let mode = 'draw', ink = '#16182F', strokes = [], cur = null, dpr = 1, upload = null;
  const g = cv.getContext('2d');
  const size = () => { dpr = Math.min(2, devicePixelRatio || 1); const r = pad.getBoundingClientRect(); if (!r.width) return; cv.width = r.width * dpr; cv.height = r.height * dpr; redraw(); };
  const redraw = () => {
    g.clearRect(0, 0, cv.width, cv.height); g.lineCap = g.lineJoin = 'round'; g.strokeStyle = ink; g.lineWidth = 2.6 * dpr;
    for (const s of strokes) { g.beginPath(); s.forEach((p, i) => { if (!i) g.moveTo(p[0] * dpr, p[1] * dpr); else { const q = s[i - 1]; g.quadraticCurveTo(q[0] * dpr, q[1] * dpr, (p[0] + q[0]) / 2 * dpr, (p[1] + q[1]) / 2 * dpr); } }); if (s.length === 1) g.lineTo(s[0][0] * dpr + .1, s[0][1] * dpr); g.stroke(); }
    ph.hidden = strokes.length > 0;
  };
  const exportDraw = async () => {
    if (!strokes.length) return set(null);
    const pts = strokes.flat(), pd = 6;
    const x0 = Math.max(0, Math.min(...pts.map(p => p[0])) - pd), y0 = Math.max(0, Math.min(...pts.map(p => p[1])) - pd);
    const x1 = Math.max(...pts.map(p => p[0])) + pd, y1 = Math.max(...pts.map(p => p[1])) + pd;
    const sc = 3, c = canvasOf((x1 - x0) * sc, (y1 - y0) * sc);
    const k = c.getContext('2d'); k.lineCap = k.lineJoin = 'round'; k.strokeStyle = ink; k.lineWidth = 2.6 * sc;
    for (const s of strokes) { k.beginPath(); s.forEach((p, i) => { const X = (p[0] - x0) * sc, Y = (p[1] - y0) * sc; if (!i) k.moveTo(X, Y); else { const q = s[i - 1]; k.quadraticCurveTo((q[0] - x0) * sc, (q[1] - y0) * sc, ((p[0] + q[0]) / 2 - x0) * sc, ((p[1] + q[1]) / 2 - y0) * sc); } }); if (s.length === 1) k.lineTo((s[0][0] - x0) * sc + .1, (s[0][1] - y0) * sc); k.stroke(); }
    set({ bytes: await (await canvasToBlob(c, 'image/png')).arrayBuffer(), w: c.width, h: c.height });
  };
  const exportType = async () => {
    const t = typeIn.value.trim(); if (!t) return set(null);
    try { await document.fonts.load('600 110px Caveat'); } catch (e) { /* fallback */ }
    const c = document.createElement('canvas'), k = c.getContext('2d'), font = "600 110px Caveat, 'Segoe Script', 'Brush Script MT', cursive";
    k.font = font; const tw = k.measureText(t).width; c.width = Math.ceil(tw + 40); c.height = 150;
    k.font = font; k.fillStyle = ink; k.textBaseline = 'middle'; k.fillText(t, 20, 78);
    set({ bytes: await (await canvasToBlob(c, 'image/png')).arrayBuffer(), w: c.width, h: c.height });
  };
  /* a photo of a signature: make the paper transparent and trim it */
  const exportUpload = async () => {
    if (!upload) return set(null);
    const c = await imageCanvas(upload, 1600), k = c.getContext('2d', { willReadFrequently: true });
    const d = k.getImageData(0, 0, c.width, c.height), px = d.data;
    let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
    for (let i = 0; i < px.length; i += 4) {
      const l = px[i] * .299 + px[i + 1] * .587 + px[i + 2] * .114;
      const a = l > 200 ? 0 : l < 120 ? 255 : Math.round((200 - l) / 80 * 255);
      px[i + 3] = a;
      if (a > 40) { const p = i / 4, x = p % c.width, y = (p / c.width) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 <= x0 || y1 <= y0) { toast('No signature found in that picture. Use dark ink on white paper.', 'error'); return set(null); }
    k.putImageData(d, 0, 0);
    const o = canvasOf(x1 - x0 + 12, y1 - y0 + 12); o.getContext('2d').drawImage(c, x0 - 6, y0 - 6, o.width, o.height, 0, 0, o.width, o.height);
    set({ bytes: await (await canvasToBlob(o, 'image/png')).arrayBuffer(), w: o.width, h: o.height });
  };
  const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.addEventListener('pointerdown', e => { e.preventDefault(); cv.setPointerCapture(e.pointerId); cur = [pos(e)]; strokes.push(cur); redraw(); });
  cv.addEventListener('pointermove', e => { if (!cur) return; const p = pos(e), q = cur[cur.length - 1]; if (Math.hypot(p[0] - q[0], p[1] - q[1]) > 1.2) { cur.push(p); redraw(); } });
  const end = () => { if (cur) { cur = null; exportDraw(); } };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  typeIn.addEventListener('input', exportType);
  upIn.addEventListener('change', () => { upload = upIn.files[0] || null; $('.fo-sig-upwrap small', w).textContent = upload ? upload.name : ''; exportUpload(); });
  w.addEventListener('click', e => {
    const m = e.target.closest('[data-sigmode]');
    if (m) {
      mode = m.dataset.sigmode; $$('[data-sigmode]', w).forEach(b => b.setAttribute('aria-pressed', b === m));
      $('.fo-sig-draw', w).hidden = mode !== 'draw'; $('.fo-sig-typewrap', w).hidden = mode !== 'type'; $('.fo-sig-upwrap', w).hidden = mode !== 'upload';
      $('.fo-sig-row .fo-swatches', w).hidden = mode === 'upload';
      if (mode === 'draw') { size(); exportDraw(); } else if (mode === 'type') { typeIn.focus(); exportType(); } else exportUpload();
    }
    if (e.target.closest('[data-sigup]')) { upIn.value = ''; upIn.click(); }
    const i = e.target.closest('[data-ink]');
    if (i) { ink = i.dataset.ink; $$('[data-ink]', w).forEach(b => b.setAttribute('aria-pressed', b === i)); typeIn.style.color = ink; redraw(); mode === 'draw' ? exportDraw() : mode === 'type' ? exportType() : 0; }
    if (e.target.closest('[data-sigclear]')) { strokes = []; typeIn.value = ''; upload = null; redraw(); set(null); }
  });
  new ResizeObserver(size).observe(pad);
}

/* ---- 40-regions.js ---- */
/* ---------------- region editor ----------------
   Draggable, resizable boxes over a picture (ID card print, passport photo,
   blur). Coordinates are fractions (0..1) of the picture.
     regionEditor(host, { src, w, h, rects:[{id,label,x,y,w,h,ratio}], multi, onChange })
   ratio = width / height in picture pixels, locked while resizing.
   Keyboard: arrows move a box, Shift+arrows resize it, Delete removes it (multi). */
function regionEditor(host, cfg) {
  const st = { rects: cfg.rects.map(r => ({ ...r })), active: cfg.rects.length ? cfg.rects[0].id : null };
  const W = cfg.w, H = cfg.h, ar = W / H;
  host.innerHTML = `<div class="fo-reg" style="aspect-ratio:${W} / ${H}"><img src="${cfg.src}" alt="" draggable="false"><div class="fo-reg-layer"></div></div>
    <p class="fo-reg-help">${cfg.multi ? 'Drag on the picture to mark an area. Drag a box to move it, or its corner to resize it.' : 'Drag the boxes to move them, and their corners to resize them.'} With the keyboard: arrow keys move the selected box, Shift + arrows resize it${cfg.multi ? ', Delete removes it' : ''}.</p>`;
  const reg = $('.fo-reg', host), layer = $('.fo-reg-layer', host);
  const norm = r => {
    r.w = clamp(r.w, .02, 1); r.h = clamp(r.h, .02, 1);
    r.x = clamp(r.x, 0, 1 - r.w); r.y = clamp(r.y, 0, 1 - r.h);
    return r;
  };
  const fitRatio = (r, keep = 'w') => {
    if (!r.ratio) return r;
    const k = r.ratio / ar; /* normalized w/h for the pixel ratio */
    if (keep === 'w') r.h = r.w / k; else r.w = r.h * k;
    if (r.h > 1) { r.h = 1; r.w = k; } if (r.w > 1) { r.w = 1; r.h = 1 / k; }
    return r;
  };
  st.rects.forEach(r => norm(fitRatio(r)));
  const draw = () => {
    layer.innerHTML = st.rects.map(r => `<div class="fo-reg-box${r.id === st.active ? ' on' : ''}" data-id="${esc(r.id)}" tabindex="0" role="button" aria-label="${esc(r.label || 'Area')}: drag, or use the arrow keys to move it and Shift + arrow keys to resize it${cfg.multi ? '; Delete removes it' : ''}" style="left:${r.x * 100}%;top:${r.y * 100}%;width:${r.w * 100}%;height:${r.h * 100}%">
      ${r.label ? `<span class="fo-reg-lbl">${esc(r.label)}</span>` : ''}${cfg.multi ? `<button type="button" class="fo-reg-x" data-rm aria-label="Remove this area">${icon('x')}</button>` : ''}
      <i data-h="nw"></i><i data-h="ne"></i><i data-h="sw"></i><i data-h="se"></i></div>`).join('');
  };
  const emit = () => cfg.onChange && cfg.onChange(st.rects.map(r => ({ ...r })));
  draw();
  let drag = null;
  const pt = e => { const b = reg.getBoundingClientRect(); return { x: (e.clientX - b.left) / b.width, y: (e.clientY - b.top) / b.height }; };
  reg.addEventListener('pointerdown', e => {
    if (e.target.closest('[data-rm]')) return;
    const box = e.target.closest('.fo-reg-box'), p = pt(e);
    if (box) {
      const r = st.rects.find(x => x.id === box.dataset.id); st.active = r.id;
      drag = { r, mode: e.target.dataset.h || 'move', p0: p, r0: { ...r } };
    } else if (cfg.multi) {
      const r = { id: 'r' + Date.now().toString(36), x: p.x, y: p.y, w: .02, h: .02 };
      st.rects.push(r); st.active = r.id;
      drag = { r, mode: 'se', p0: p, r0: { ...r }, fresh: true };
    } else return;
    e.preventDefault(); reg.setPointerCapture(e.pointerId); draw();
  });
  reg.addEventListener('pointermove', e => {
    if (!drag) return;
    const p = pt(e), dx = p.x - drag.p0.x, dy = p.y - drag.p0.y, r = drag.r, o = drag.r0;
    if (drag.mode === 'move') { r.x = clamp(o.x + dx, 0, 1 - r.w); r.y = clamp(o.y + dy, 0, 1 - r.h); }
    else {
      const m = drag.mode;
      let x0 = o.x, y0 = o.y, x1 = o.x + o.w, y1 = o.y + o.h;
      if (m.includes('w')) x0 = clamp(o.x + dx, 0, x1 - .02); else x1 = clamp(x1 + dx, x0 + .02, 1);
      if (m.includes('n')) y0 = clamp(o.y + dy, 0, y1 - .02); else y1 = clamp(y1 + dy, y0 + .02, 1);
      r.x = x0; r.y = y0; r.w = x1 - x0; r.h = y1 - y0;
      if (r.ratio) { fitRatio(r, Math.abs(dx) * ar >= Math.abs(dy) ? 'w' : 'h'); if (m.includes('n')) r.y = y1 - r.h; if (m.includes('w')) r.x = x1 - r.w; }
      norm(r);
    }
    const el = $(`.fo-reg-box[data-id="${CSS.escape(r.id)}"]`, layer);
    if (el) Object.assign(el.style, { left: r.x * 100 + '%', top: r.y * 100 + '%', width: r.w * 100 + '%', height: r.h * 100 + '%' });
  });
  const end = () => {
    if (!drag) return;
    if (drag.fresh && (drag.r.w < .03 || drag.r.h < .03)) st.rects = st.rects.filter(x => x !== drag.r);
    drag = null; draw(); emit();
  };
  reg.addEventListener('pointerup', end); reg.addEventListener('pointercancel', end);
  reg.addEventListener('click', e => {
    const rm = e.target.closest('[data-rm]');
    if (rm) { const id = rm.closest('.fo-reg-box').dataset.id; st.rects = st.rects.filter(x => x.id !== id); draw(); emit(); }
  });
  reg.addEventListener('keydown', e => {
    const box = e.target.closest('.fo-reg-box'); if (!box) return;
    const r = st.rects.find(x => x.id === box.dataset.id); if (!r) return;
    const step = e.altKey ? .002 : .01; // Alt = fine steps
    const k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (k) {
      e.preventDefault();
      if (e.shiftKey) { r.w += k[0] * step * 2; r.h += k[1] * step * 2; if (r.ratio) fitRatio(r, k[0] ? 'w' : 'h'); }
      else { r.x += k[0] * step; r.y += k[1] * step; }
      norm(r); st.active = r.id; draw(); $(`.fo-reg-box[data-id="${CSS.escape(r.id)}"]`, layer).focus(); emit();
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && cfg.multi) {
      e.preventDefault(); st.rects = st.rects.filter(x => x !== r); draw(); emit();
    }
  });
  return { get: () => st.rects.map(r => ({ ...r })), set: rects => { st.rects = rects.map(r => norm(fitRatio({ ...r }))); draw(); emit(); } };
}
/* Crops a normalized rectangle out of a canvas into a new canvas. */
function cropCanvas(src, r, outW, outH) {
  const sx = r.x * src.width, sy = r.y * src.height, sw = r.w * src.width, sh = r.h * src.height;
  const c = canvasOf(outW || sw, outH || sh), g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(src, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return c;
}

/* ---- 50-workspace.js ---- */
/* ---------------- workspace ----------------
   One per .fo-app element. A tool definition (registered by a module) says
   what the tool accepts and does:
     { id, accept, multi, min, max, ordered, camera, pages, cta, verb, tip,
       opts, validate(o, items, ws), run(items, o, ctx), server,
       overlay(it, o, ws), regions: { source, rects, multi }, onItems(ws),
       resultHtml(result, ws), thumbStyle(o),
       codeView(main, ws, api), onFiles(list, ws), codeFile(ws), localOpts }
   accept 'html' is the code mode: the tool shows its own editor (codeView) instead of a
   file drop zone, and codeFile(ws) turns the code into the File that is sent to the server.
   ctx passed to run(): { progress(f, label), pages, regions, source, result, alive(), ws }. */
let itemSeq = 0;
const PHASE_STEP = { empty: 1, ready: 2, working: 3, done: 4, error: 2, server: 2, unavailable: 1 };

function defaults(def) {
  const o = {};
  (def.opts || []).forEach(f => { if (f.id && 'value' in f) o[f.id] = f.value && typeof f.value === 'object' ? { ...f.value } : f.value; });
  return o;
}

function mountTool(root) {
  const id = root.dataset.foTool;
  const def = DEFS[id];
  const meta = CFG.tools[id] || {};
  if (!def) return null;
  const T = Object.assign({ min: 1, multi: false, opts: [], cta: 'Run', verb: 'Working', name: meta.name || id, desc: meta.desc || '' }, def, { name: meta.name || def.name || id, desc: meta.desc || def.desc || '' });
  const useServer = !!def.server && (!def.run || meta.runs === 'server');
  const accept = ACCEPT[T.accept] || ACCEPT.pdf;
  const maxFiles = T.max || (useServer && meta.maxFiles ? meta.maxFiles : 0);
  /* Server tools on PDFs get a "PDF password" field. It appears when an added PDF is locked (or the
     server said it needs its password); the server opens the file with it for this task only. */
  const askPw = useServer && T.accept === 'pdf' && id !== 'unlock';
  if (askPw) {
    T.opts = (T.opts || []).concat([{ id: 'opw', type: 'password', value: '', label: id === 'protect' ? 'Current PDF password' : 'PDF password', placeholder: 'The password that opens the PDF',
      help: id === 'protect' ? 'This PDF already has a password. Type it, and the new password replaces it.' : 'This PDF is locked. Type the password that opens it. It is used for this task only and is not stored.',
      show: () => !!(WS.needPw || WS.items.some(i => i.locked)) }]);
    const v0 = T.validate;
    T.validate = (o, list, ws) => (list && list.some(i => i.locked) && !o.opw ? 'Type the password that opens the PDF.' : '') || (v0 ? v0(o, list, ws) : '');
  }
  /* code mode (accept 'html'): its words come from the tool (Text to PDF uses "text") */
  const CODE = T.accept === 'html' ? Object.assign({ step: 'Add code', hint: 'Paste or type your HTML code to start.', edit: 'Edit the code', back: 'Back to my code', max: 5242880 }, T.code || {}) : null;
  /* what visitors see while the tool works (App Center → Manage → Processing screen): detailed, simple or off */
  const progressMode = ((CFG.progress || {})[useServer ? 'server' : 'browser']) || 'detailed';
  const WS = { root, tool: T, def, meta, useServer, items: [], pages: null, allPages: null, opts: defaults(T), phase: 'empty', outputs: [], result: null, error: '', urls: [], seq: 0, queue: Promise.resolve(), sigUrl: null, source: null, regions: null, refreshOpts: null, started: 0, needPw: false };
  /* settings the page asks the tool to open with (data-fo-preset): { opts: {…} } or a tool's own preset hook */
  let preset = null;
  try { preset = root.dataset.foPreset ? JSON.parse(root.dataset.foPreset) : null; } catch (e) { preset = null; }
  if (preset) {
    if (typeof def.preset === 'function') { T.opts = (T.opts || []).map(f => ({ ...f })); def.preset(preset, WS, T); }
    else if (preset.opts) Object.keys(preset.opts).forEach(k => { if (k in WS.opts) WS.opts[k] = preset.opts[k]; });
    if (preset.tip) T.tip = preset.tip;
  }
  root.dataset.cat = meta.color || root.dataset.cat || 'organize';
  root.innerHTML = `<div class="fo-ws">
    <div class="fo-ws-top">
      <ol class="fo-ws-steps" aria-label="Progress"><li data-step="1"><i>1</i>${T.accept === 'url' ? 'Enter address' : CODE ? esc(CODE.step) : 'Add files'}</li><li class="sep" aria-hidden="true"></li><li data-step="2"><i>2</i>Set options</li><li class="sep" aria-hidden="true"></li><li data-step="3"><i>3</i>Download</li></ol>
      <span class="fo-priv${useServer ? ' srv' : ''}" title="${useServer ? `Files are sent over HTTPS and deleted ${esc(CFG.deletionText)}` : 'Your files never leave this device'}">${useServer ? icon('shield') + '<span>Encrypted server processing</span>' : icon('device') + '<span>Runs in your browser</span>'}</span>
    </div>
    <div class="fo-ws-body">
      <section class="fo-ws-main" aria-live="polite"></section>
      <div class="fo-ws-side">
        <div class="fo-ws-opts"><h2></h2><p class="fo-ws-about"></p><div class="fo-opts"></div></div>
        <div class="fo-ws-cta"><button type="button" class="fo-btn fo-btn-ink fo-btn-lg fo-run" disabled>${esc(T.cta)}</button><p class="fo-ws-hint"></p></div>
      </div>
    </div>
    <input type="file" class="fo-file-in" multiple hidden><input type="file" class="fo-cam-in" accept="image/*" capture="environment" hidden>
  </div>`;
  const main = $('.fo-ws-main', root), runBtn = $('.fo-run', root), hint = $('.fo-ws-hint', root);
  WS.main = main;

  /* ---- state helpers ---- */
  const goodItems = () => WS.items.filter(i => !i.err);
  const mkItem = file => ({ id: 'f' + (++itemSeq), file, name: file.name, size: file.size, kind: kindOf(file), pages: null, thumb: null, err: null, note: '' });
  function clearOutputs() { WS.outputs.forEach(o => URL.revokeObjectURL(o.url)); WS.outputs = []; WS.result = null; }
  function clearItems() { WS.items = []; WS.pages = null; WS.allPages = null; WS.source = null; WS.regions = null; WS.seq++; WS.queue = Promise.resolve(); clearOutputs(); }
  function setPhase(p) {
    const keep = p === 'working' && progressMode === 'off';   /* hidden processing screen: the files stay, locked */
    WS.phase = p; root.classList.toggle('is-done', p === 'done'); root.classList.toggle('is-busy', p === 'working');
    root.setAttribute('aria-busy', p === 'working' ? 'true' : 'false');
    if (!keep) renderMain();
    updateSteps(); updateCta();
  }
  function updateSteps() {
    const st = PHASE_STEP[WS.phase] || 1;
    $$('.fo-ws-steps li[data-step]', root).forEach(li => { const n = +li.dataset.step; li.className = n < st ? 'done' : n === st ? 'on' : ''; });
  }
  const isUrl = v => { try { const u = new URL(/^https?:\/\//i.test(v) ? v : 'https://' + v); return /\./.test(u.hostname); } catch (e) { return false; } };
  function updateCta() {
    let ok = false, h = '';
    if (WS.phase === 'working') { runBtn.disabled = true; runBtn.innerHTML = `<span class="fo-spin-sm" aria-hidden="true"></span>${esc(T.verb)}…`; hint.textContent = 'Keep this page open until it finishes.'; return; }
    if (WS.phase === 'unavailable') { runBtn.disabled = true; runBtn.textContent = T.cta; hint.textContent = 'This tool is temporarily unavailable.'; return; }
    if (T.accept === 'url') { ok = isUrl(WS.opts.url || ''); h = ok ? '' : 'Enter a web address to continue.'; }
    else if (CODE) { const n = (WS.opts.html || '').length; ok = !!(WS.opts.html || '').trim() && n <= CODE.max; h = !n || ok ? (ok ? '' : CODE.hint) : `That is larger than ${Math.round(CODE.max / 1048576)} MB.`; }
    else {
      const n = goodItems().length;
      const regOk = !T.regions || (T.regions.skip && T.regions.skip(WS)) || !!(WS.source && WS.source.url);
      ok = n >= T.min && (!T.pages || (WS.pages && WS.pages.length)) && regOk;
      if (!n) h = T.min > 1 ? `Add at least ${T.min} ${accept.nouns} to start.` : `Add ${T.multi ? accept.nouns : 'a ' + accept.noun} to start.`;
      else if (n < T.min) h = `Add ${T.min - n} more ${T.min - n === 1 ? accept.noun : accept.nouns}.`;
      else if (T.pages && !WS.pages) h = 'Loading pages…';
      else if (T.pages && !WS.pages.length) h = 'Keep at least one page.';
      else if (!regOk) h = WS.source && WS.source.err ? WS.source.err : 'Loading the preview…';
    }
    if (ok && T.validate) { const v = T.validate(WS.opts, goodItems(), WS); if (v) { h = v; ok = false; } }
    const done = WS.phase === 'done';
    runBtn.disabled = !ok;
    runBtn.className = 'fo-btn fo-btn-lg fo-run ' + (done ? 'fo-btn-line' : 'fo-btn-ink');
    runBtn.textContent = done ? 'Run again' : T.cta;
    hint.textContent = h || (done ? (T.opts.length ? 'Change an option, then run again.' : 'Runs the tool again on the same files.') : useServer ? `Files are deleted from the server ${CFG.deletionText}.` : 'Processed on your device. Nothing is uploaded.');
  }
  function setProgress(f, label) {
    const bar = $('.fo-pbar', main); if (!bar) return;
    bar.classList.toggle('indet', f < 0);
    if (f >= 0) bar.firstElementChild.style.width = Math.round(Math.min(1, f) * 100) + '%';
    if (label) $('.fo-plabel', main).textContent = label;
  }

  /* ---- options ---- */
  function renderOptsPanel() {
    $('.fo-ws-opts h2', root).textContent = T.opts.length ? 'Options' : 'About this tool';
    $('.fo-ws-about', root).textContent = T.tip || T.desc;
    const real = T.opts.filter(f => f.id !== 'opw');
    if (!real.length) {
      $('.fo-ws-opts h2', root).textContent = 'About this tool';
      $('.fo-opts', root).innerHTML = `<div class="fo-note">${icon('info')}<span>No settings needed. Add your files and press “${esc(T.cta)}”.</span></div>${T.opts.length ? '<div class="fo-opts-pw"></div>' : ''}`;
      if (T.opts.length) WS.refreshOpts = renderOpts($('.fo-opts-pw', root), T.opts, WS.opts, onOptChange);
      return;
    }
    WS.refreshOpts = renderOpts($('.fo-opts', root), T.opts, WS.opts, onOptChange);
  }
  function onOptChange(fid) {
    updateCta();
    if (fid === 'signature') { if (WS.sigUrl) URL.revokeObjectURL(WS.sigUrl); WS.sigUrl = WS.opts.signature ? URL.createObjectURL(new Blob([WS.opts.signature.bytes], { type: 'image/png' })) : null; }
    if (T.overlay) refreshOverlays();
    if (T.thumbStyle) applyThumbStyle();
    if (T.reloadOn && T.reloadOn.includes(fid)) reloadMeta();
    if (T.onOpt) T.onOpt(fid, WS);
  }
  /* re-render the options panel with new values (e.g. after reading a file's metadata) */
  WS.setOpts = vals => { Object.assign(WS.opts, vals); renderOptsPanel(); updateCta(); };

  /* ---- previews ---- */
  function thumbHtml(it) {
    const ext = (extOf(it.name) || 'file').toUpperCase().slice(0, 4);
    const cat = it.kind === 'pdf' ? 'from' : it.kind === 'image' || it.kind === 'heic' || it.kind === 'svg' ? 'image' : it.kind === 'word' ? 'organize' : it.kind === 'excel' ? 'optimize' : 'to';
    const tag = `<span class="fo-ext" style="--c:var(--fo-c-${cat})">${esc(ext)}</span>`;
    if (!it.thumb) return icon(it.kind === 'image' ? 'image' : 'file') + tag;
    if (it.pw && T.overlay) {
      const r = it.pw / it.ph, c = .75;
      const sz = !T.multi ? '' : r < c ? `height:100%;width:${r / c * 100}%` : `width:100%;height:${c / r * 100}%`;
      return `<div class="fo-pg" style="${sz}"><img src="${it.thumb}" alt=""><div class="fo-ovl">${overlayHtml(it)}</div></div>${tag}`;
    }
    return `<img src="${it.thumb}" alt="">${tag}`;
  }
  function overlayHtml(it) { try { return T.overlay ? T.overlay(it, WS.opts, WS) || '' : ''; } catch (e) { return ''; } }
  function refreshOverlays() { WS.items.forEach(it => { const el = $(`[data-iid="${it.id}"] .fo-ovl`, main); if (el) el.innerHTML = overlayHtml(it); }); }
  function applyThumbStyle() { const g = $('.fo-files', main); if (g && T.thumbStyle) g.style.cssText = T.thumbStyle(WS.opts) || ''; }
  const metaText = it => it.err || [fmtSize(it.size), it.pages ? `${it.pages} page${it.pages > 1 ? 's' : ''}` : '', it.note].filter(Boolean).join(', ');
  const ordered = () => T.ordered || (T.multi && T.min > 1);
  function fileCard(it, i, ord) {
    const label = T.slots ? `<div class="fo-slot-label">${esc(T.slots[i] || '')}</div>` : '';
    return `<div class="fo-file" data-iid="${it.id}"${ord ? ' draggable="true"' : ''}>${label}
      ${ord && !T.slots ? `<span class="fo-ord">${i + 1}</span>` : ''}
      <button type="button" class="fo-file-x" data-remove="${it.id}" aria-label="Remove ${esc(it.name)}">${icon('x')}</button>
      <div class="fo-thumb"${it.pw && !T.multi ? ` style="--ar:${it.pw / it.ph}"` : ''}>${thumbHtml(it)}</div>
      <div class="fo-file-name" title="${esc(it.name)}">${esc(it.name)}</div>
      <div class="fo-file-meta${it.err ? ' err' : ''}">${esc(metaText(it))}</div>
      ${ord ? `<div class="fo-file-acts"><button type="button" data-move="-1" ${i === 0 ? 'disabled' : ''} aria-label="Move ${esc(it.name)} earlier">${icon('chev-left')}</button><button type="button" data-move="1" ${i === WS.items.length - 1 ? 'disabled' : ''} aria-label="Move ${esc(it.name)} later">${icon('chev-right')}</button></div>` : ''}
    </div>`;
  }
  const rotStyle = r => `transform:rotate(${r}deg) scale(${r % 180 ? .74 : 1})`;
  function pageCard(p, k) {
    return `<div class="fo-file" data-pkey="${p.key}" draggable="true">
      <span class="fo-ord">${k + 1}</span>
      <div class="fo-thumb">${p.thumb ? `<img src="${p.thumb}" alt="" style="${rotStyle(p.rot)}">` : icon('file')}</div>
      <div class="fo-file-name">Page ${p.i + 1}${p.rot ? `, turned ${p.rot}°` : ''}</div>
      <div class="fo-file-acts"><button type="button" data-pmove="-1" ${k === 0 ? 'disabled' : ''} aria-label="Move page ${p.i + 1} earlier">${icon('chev-left')}</button><button type="button" data-prot aria-label="Rotate page ${p.i + 1}">${icon('rotate-cw')}</button><button type="button" data-pdel aria-label="Delete page ${p.i + 1}">${icon('trash')}</button><button type="button" data-pmove="1" ${k === WS.pages.length - 1 ? 'disabled' : ''} aria-label="Move page ${p.i + 1} later">${icon('chev-right')}</button></div>
    </div>`;
  }
  const tile = () => `<span class="fo-tile fo-tile-lg">${icon(meta.icon || 'file')}</span>`;

  function renderMain() {
    if (WS.phase === 'unavailable') {
      main.innerHTML = `<div class="fo-state">${tile()}<h2>${esc(T.name)} is temporarily unavailable</h2><p>The processing server can’t run this tool right now. Please try again later.</p>${altsHtml()}</div>`;
    } else if ((WS.phase === 'empty' || WS.phase === 'ready') && T.accept === 'html' && T.codeView) {
      T.codeView(main, WS, { update: updateCta, run: () => { if (!runBtn.disabled) runTool(); } });
    } else if (WS.phase === 'empty' && T.accept === 'url') {
      main.innerHTML = `<div class="fo-dz">${tile()}<h2>Which page should we save?</h2><p>${esc(T.desc)}</p>
        <form class="fo-url-form"><label class="fo-opt-l" for="${root.id}-url">Web address</label><input class="fo-inp" id="${root.id}-url" type="url" inputmode="url" autocomplete="url" placeholder="https://example.com/article" value="${esc(WS.opts.url || '')}"><small>We open the page on our server and save it exactly as it looks.</small></form></div>`;
      const inp = $('input', main);
      inp.addEventListener('input', e => { WS.opts.url = e.target.value.trim(); updateCta(); });
      $('form', main).addEventListener('submit', e => { e.preventDefault(); if (!runBtn.disabled) runTool(); });
    } else if (WS.phase === 'empty') {
      const what = T.slots ? T.slots.length + ' ' + accept.nouns : T.multi ? accept.nouns : 'a ' + accept.noun;
      main.innerHTML = `<div class="fo-dz">${tile()}<h2>Drop ${esc(T.dropText || what)} here</h2><p>${esc(T.desc)}</p>
        <div class="fo-dz-actions"><button type="button" class="fo-btn fo-btn-ink fo-btn-lg" data-pick>${icon('upload')}Choose ${esc(T.multi ? accept.nouns : accept.noun)}</button>${T.camera ? `<button type="button" class="fo-btn fo-btn-line fo-btn-lg" data-cam>${icon('camera')}Take a photo</button>` : ''}</div>
        <small>${useServer ? `Up to ${CFG.maxFileMB} MB per file. Encrypted, and deleted from the server ${esc(CFG.deletionText)}.` : 'Processed on your device. Nothing is uploaded.'}</small></div>`;
    } else if (WS.phase === 'ready') {
      if (T.pages) {
        const it = WS.items[0];
        main.innerHTML = `<div class="fo-files-head"><h2>${esc(it.name)} <span>${WS.pages ? `${WS.pages.length} of ${it.pages} pages kept` : ''}</span></h2>
          <button type="button" class="fo-btn fo-btn-quiet fo-btn-sm" data-preset>${icon('rotate-ccw', 'fo-ic fo-ic-sm')}Reset pages</button><button type="button" class="fo-btn fo-btn-line fo-btn-sm" data-pick>Change file</button></div>
          ${WS.pages ? `<div class="fo-files">${WS.pages.map(pageCard).join('')}</div>` : `<div class="fo-files">${fileCard(it, 0, false)}</div><p class="fo-plabel">${it.err ? '' : 'Loading pages…'}</p>`}`;
      } else if (T.regions && WS.items.length) {
        main.innerHTML = `<div class="fo-files-head"><h2>${esc(WS.items.map(i => i.name).join(', '))}</h2>
          ${T.multi && (!maxFiles || WS.items.length < maxFiles) ? `<button type="button" class="fo-btn fo-btn-line fo-btn-sm" data-pick>${icon('plus', 'fo-ic fo-ic-sm')}Add another</button>` : ''}
          <button type="button" class="fo-btn fo-btn-quiet fo-btn-sm" data-clear>Remove</button></div><div class="fo-reg-host"></div>`;
        renderRegions();
      } else {
        const ord = ordered(), n = WS.items.length, total = WS.items.reduce((s, i) => s + i.size, 0);
        const canAdd = T.multi && (!maxFiles || n < maxFiles);
        main.innerHTML = `<div class="fo-files-head"><h2>${n} ${n === 1 ? accept.noun : accept.nouns} <span>(${fmtSize(total)})</span></h2>
          ${ord && n > 1 && !T.slots ? `<button type="button" class="fo-btn fo-btn-quiet fo-btn-sm" data-sort>${icon('sort', 'fo-ic fo-ic-sm')}Sort A to Z</button>` : ''}
          ${T.slots && n === 2 ? `<button type="button" class="fo-btn fo-btn-quiet fo-btn-sm" data-swap>${icon('rotate-cw', 'fo-ic fo-ic-sm')}Swap order</button>` : ''}
          ${canAdd ? `<button type="button" class="fo-btn fo-btn-line fo-btn-sm" data-pick>${icon('plus', 'fo-ic fo-ic-sm')}Add more</button>` : !T.multi ? `<button type="button" class="fo-btn fo-btn-line fo-btn-sm" data-pick>Change file</button>` : ''}
          <button type="button" class="fo-btn fo-btn-quiet fo-btn-sm" data-clear>${T.multi ? 'Remove all' : 'Remove'}</button></div>
          <div class="fo-files${T.multi ? '' : ' single'}">${WS.items.map((it, i) => fileCard(it, i, ord)).join('')}
          ${canAdd ? `<button type="button" class="fo-add-tile" data-pick>${icon('plus', 'fo-ic fo-ic-lg')}${T.slots ? esc(T.slots[n] ? 'Add: ' + T.slots[n] : 'Add more files') : 'Add more files'}</button>` : ''}</div>
          ${T.camera ? `<p class="fo-mt"><button type="button" class="fo-btn fo-btn-line fo-btn-sm" data-cam>${icon('camera', 'fo-ic fo-ic-sm')}Take another photo</button></p>` : ''}`;
        applyThumbStyle();
      }
    } else if (WS.phase === 'working') {
      const sub = useServer ? 'Your files are processed securely, then deleted.' : 'This happens on your device, so it depends on its speed.';
      main.innerHTML = progressMode === 'simple'
        ? `<div class="fo-state" role="status">${tile()}<h2>${esc(T.verb)}…</h2><div class="fo-spin" aria-hidden="true"></div><p>${sub}</p></div>`
        : `<div class="fo-state" role="status">${tile()}<h2>${esc(T.verb)}…</h2><p>${sub}</p><div class="fo-pbar"><i></i></div><p class="fo-plabel">Getting ready</p></div>`;
    } else if (WS.phase === 'done') {
      main.innerHTML = resultHtml();
    } else if (WS.phase === 'error') {
      const repair = T.accept === 'pdf' && id !== 'repair' && CFG.catalog.some(x => x.id === 'repair') && /damaged|opened|read/i.test(WS.error);
      main.innerHTML = `<div class="fo-state"><span class="fo-ok fo-err">${icon('alert')}</span><h2>That didn’t work</h2><p>${esc(WS.error)}</p>
        <div class="fo-res-actions"><button type="button" class="fo-btn fo-btn-ink" data-retry>Try again</button><button type="button" class="fo-btn fo-btn-line" data-again>${CODE ? esc(CODE.edit) : 'Choose other files'}</button>${repair ? `<button type="button" class="fo-btn fo-btn-quiet" data-next="repair">Repair the PDF</button>` : ''}</div></div>`;
    } else if (WS.phase === 'server') {
      main.innerHTML = `<div class="fo-state"><span class="fo-tile fo-tile-lg">${icon('server')}</span><h2>${esc(T.name)} needs the processing server</h2>
        <p>This tool runs on a processing server, and this website isn’t connected to one yet. Nothing was uploaded.</p>${altsHtml()}
        <div class="fo-res-actions"><button type="button" class="fo-btn fo-btn-line" data-retry>${CODE ? esc(CODE.back) : 'Back to my files'}</button></div></div>`;
    }
  }
  function altsHtml() {
    const alts = CFG.catalog.filter(x => x.runs === 'browser' && x.ready && x.id !== id && (x.accept === T.accept || (T.accept === 'url' && x.accept === 'pdf'))).slice(0, 6);
    return alts.length ? `<div class="fo-next"><h4>These tools work right now, in your browser</h4><div>${alts.map(x => `<a class="fo-chip" data-cat="${esc(x.color)}" href="${esc(x.url)}">${icon(x.icon)}${esc(x.name)}</a>`).join('')}</div></div>` : '';
  }

  /* ---- region editor (ID cards, passport photos, blur) ---- */
  async function ensureSource() {
    if (!T.regions || WS.source || !goodItems().length || (T.regions.skip && T.regions.skip(WS))) return;
    const seq = WS.seq;
    WS.source = { loading: true };
    try {
      const src = await T.regions.source(WS);
      if (seq !== WS.seq) return;
      const url = URL.createObjectURL(await canvasToBlob(src.canvas, 'image/jpeg', .88)); WS.urls.push(url);
      WS.source = { canvas: src.canvas, url, w: src.canvas.width, h: src.canvas.height, info: src.info || null };
      WS.regions = T.regions.rects(WS, WS.source);
    } catch (e) {
      if (seq !== WS.seq) return;
      WS.source = { err: e instanceof UserError ? e.message : 'The preview couldn’t be made from this file.' };
    }
    if (WS.phase === 'ready') renderMain();
    updateCta();
  }
  function renderRegions() {
    const host = $('.fo-reg-host', main); if (!host) return;
    if (T.regions.skip && T.regions.skip(WS)) { host.innerHTML = `<div class="fo-files">${WS.items.map((it, i) => fileCard(it, i, false)).join('')}</div>${T.regions.skipNote ? `<p class="fo-plabel">${esc(T.regions.skipNote)}</p>` : ''}`; return; }
    if (!WS.source || WS.source.loading) { host.innerHTML = `<div class="fo-state fo-state-sm"><div class="fo-pbar indet"><i></i></div><p class="fo-plabel">Preparing the preview…</p></div>`; ensureSource(); return; }
    if (WS.source.err) { host.innerHTML = `<div class="fo-note fo-note-err">${icon('alert')}<span>${esc(WS.source.err)}</span></div>`; return; }
    regionEditor(host, { src: WS.source.url, w: WS.source.w, h: WS.source.h, rects: WS.regions || [], multi: !!T.regions.multi, onChange: r => { WS.regions = r; updateCta(); } });
    if (T.regions.after) host.insertAdjacentHTML('beforeend', T.regions.after(WS));
  }

  /* ---- results ---- */
  function resultHtml() {
    const outs = WS.outputs, r = WS.result || {};
    const title = r.title || (outs.length > 1 ? `${outs.length} files are ready` : 'Your file is ready');
    const isPdf = o => /\.pdf$/i.test(o.name), isImg = o => /\.(jpe?g|png|webp|gif|ico|svg)$/i.test(o.name), isRaster = o => /\.(jpe?g|png|webp|gif|ico)$/i.test(o.name);
    const iconFor = o => isPdf(o) ? ['file', 'from'] : isImg(o) ? ['image', 'image'] : /\.(md|txt)$/i.test(o.name) ? ['text', 'from'] : /\.zip$/i.test(o.name) ? ['zip', 'organize'] : ['file', 'organize'];
    const rows = outs.length > 1 ? `<div class="fo-outs">${outs.slice(0, 80).map(o => { const [ic, c] = iconFor(o); return `<div class="fo-out"><span class="fo-tile fo-tile-sm" data-cat="${c}">${icon(ic)}</span><div><b>${esc(o.name)}</b><small class="${o.good ? 'good' : ''}">${esc(o.note || fmtSize(o.blob.size))}</small></div>${isPdf(o) || isImg(o) ? `<a class="fo-icon-btn" href="${o.url}" target="_blank" rel="noopener" aria-label="Preview ${esc(o.name)}">${icon('eye', 'fo-ic fo-ic-sm')}</a>` : ''}<a class="fo-btn fo-btn-line fo-btn-sm" href="${o.url}" download="${esc(o.name)}">${icon('download', 'fo-ic fo-ic-sm')}Save</a></div>`; }).join('')}${outs.length > 80 ? `<p class="fo-plabel">And ${outs.length - 80} more in the ZIP file.</p>` : ''}</div>` : '';
    const o1 = outs[0];
    const sub = !o1 ? '' : outs.length === 1 ? `<p><b>${esc(o1.name)}</b><br><span class="${o1.good ? 'fo-good' : ''}">${esc(o1.note ? o1.note + ', ' + fmtSize(o1.blob.size) : fmtSize(o1.blob.size))}</span></p>` : `<p>${fmtSize(outs.reduce((s, o) => s + o.blob.size, 0))} in total.</p>`;
    const mainBtn = !o1 ? '' : outs.length === 1
      ? `<a class="fo-btn fo-btn-ink fo-btn-lg" href="${o1.url}" download="${esc(o1.name)}">${icon('download')}Download ${esc(extOf(o1.name).toUpperCase() || 'file')}</a>${isPdf(o1) || isImg(o1) ? `<a class="fo-btn fo-btn-line fo-btn-lg" href="${o1.url}" target="_blank" rel="noopener">${icon('eye')}Preview</a>` : ''}`
      : `<button type="button" class="fo-btn fo-btn-ink fo-btn-lg" data-zip>${icon('zip')}Download all as ZIP</button>`;
    const copyText = r.md || r.text;
    let extra = '';
    if (copyText) extra += (r.textNote ? `<p class="fo-plabel">${esc(r.textNote)}</p>` : '') + `<pre class="fo-md">${esc(copyText.length > 20000 ? copyText.slice(0, 20000) + '\n…' : copyText)}</pre>`;
    if (r.diff) extra += diffHtml(r);
    if (T.resultHtml) extra += T.resultHtml(r, WS) || '';
    const nextIds = (outs.length && outs.every(isPdf) ? ['compress', 'merge', 'sign', 'watermark', 'pagenum', 'protect', 'split'] : outs.length && outs.every(isRaster) ? ['imgcompress', 'imgkb', 'imgresize', 'imgcrop', 'jpg2pdf'] : [])
      .filter(x => x !== id && CFG.catalog.some(c => c.id === x && c.ready)).slice(0, 6);
    return `<div class="fo-state"><span class="fo-ok">${icon('check')}</span><h2>${esc(title)}</h2>${sub}
      <div class="fo-res-actions">${mainBtn}${copyText ? `<button type="button" class="fo-btn fo-btn-line fo-btn-lg" data-copy>${icon('copy')}Copy text</button>` : ''}</div>
      ${extra}${rows}
      ${nextIds.length ? `<div class="fo-next"><h4>Keep going with ${outs.length > 1 ? 'these files' : 'this file'}</h4><div>${nextIds.map(x => { const c = CFG.catalog.find(k => k.id === x); return `<button type="button" class="fo-chip" data-cat="${esc(c.color)}" data-next="${x}">${icon(c.icon)}${esc(c.name)}</button>`; }).join('')}</div></div>` : ''}
      <div class="fo-res-actions"><button type="button" class="fo-btn fo-btn-quiet" data-again>${icon('rotate-ccw', 'fo-ic fo-ic-sm')}Start over</button></div></div>`;
  }
  function diffHtml(r) {
    const rows = r.diff, show = new Array(rows.length).fill(false);
    rows.forEach((x, i) => { if (x.k !== 'ctx') for (let k = Math.max(0, i - 2); k <= Math.min(rows.length - 1, i + 2); k++) show[k] = true; });
    if (!r.add && !r.del) return `<div class="fo-diff"><div class="fo-diff-stats"><span>The text in both files is identical.</span><span>${esc(r.a)} and ${esc(r.b)}</span></div></div>`;
    let html = '', i = 0;
    const line = x => `<div class="fo-dl ${x.k}"><span class="pg">p${x.p}</span><span class="sg">${x.k === 'add' ? '+' : x.k === 'del' ? '−' : ''}</span><span>${esc(x.t)}</span></div>`;
    while (i < rows.length) {
      if (show[i]) { html += line(rows[i]); i++; continue; }
      let j = i; while (j < rows.length && !show[j]) j++;
      html += `<button type="button" class="fo-dl-skip" data-expand="${i}-${j}">Show ${j - i} unchanged line${j - i > 1 ? 's' : ''}</button>`;
      i = j;
    }
    return `<div class="fo-diff"><div class="fo-diff-stats"><span class="a">+${r.add} added</span><span class="r">−${r.del} removed</span><span>Original: ${esc(r.a)}</span></div><div class="fo-diff-body">${html}</div></div>`;
  }

  /* ---- adding files and reading them ---- */
  function accepts(f) { return accept.kinds.includes(kindOf(f)) || (T.acceptAlso && T.acceptAlso(f)); }
  function addFiles(list) {
    if (T.accept === 'url' || WS.phase === 'working' || WS.phase === 'unavailable') return;
    if (T.accept === 'html') { if (T.onFiles) { if (WS.phase !== 'empty') setPhase('empty'); T.onFiles([...list], WS); } return; }
    if (['done', 'error', 'server'].includes(WS.phase)) clearItems();
    let files = [...list];
    const bad = files.filter(f => !accepts(f));
    files = files.filter(accepts);
    if (bad.length) toast(`${T.name} works with ${accept.nouns}. Skipped ${bad.length === 1 ? bad[0].name : bad.length + ' files'}.`, 'error');
    if (useServer) {
      const big = files.filter(f => f.size > CFG.maxFileMB * 1048576);
      if (big.length) { toast(`${big[0].name} is larger than ${CFG.maxFileMB} MB.`, 'error'); files = files.filter(f => !big.includes(f)); }
    }
    if (!files.length) { if (WS.phase !== 'ready') setPhase(WS.items.length ? 'ready' : 'empty'); return; }
    if (!T.multi) { if (files.length > 1) toast(`${T.name} works on one file at a time, so we used ${files[0].name}.`); clearItems(); files = [files[0]]; }
    if (maxFiles) { const room = maxFiles - WS.items.length; if (files.length > room) { toast(`${T.name} takes up to ${maxFiles} files at a time.`); files = files.slice(0, Math.max(0, room)); } }
    if (T.regions) { WS.source = null; WS.regions = null; }
    const seq = WS.seq, items = files.map(mkItem);
    WS.items.push(...items);
    setPhase('ready');
    items.forEach(it => { WS.queue = WS.queue.then(() => loadMeta(it, seq)).catch(e => console.warn(e)); });
    WS.queue = WS.queue.then(() => { if (seq === WS.seq && T.onItems) return T.onItems(WS); }).catch(e => console.warn(e));
  }
  WS.addFiles = addFiles;
  function refreshItem(it) {
    const el = $(`[data-iid="${it.id}"]`, main); if (!el) return;
    const th = $('.fo-thumb', el);
    th.innerHTML = thumbHtml(it);
    if (it.pw && !T.multi) th.style.setProperty('--ar', it.pw / it.ph);
    const mt = $('.fo-file-meta', el); mt.textContent = metaText(it); mt.classList.toggle('err', !!it.err);
  }
  let warnedOffline = false;
  async function loadMeta(it, seq) {
    if (seq !== WS.seq) return;
    if (it.kind === 'image' || it.kind === 'svg') {
      it.thumb = URL.createObjectURL(it.file); WS.urls.push(it.thumb);
      try {
        if (it.kind === 'svg') { const d = await decodeImage(it.file); it.pw = d.w; it.ph = d.h; d.done(); }
        else { const b = await createImageBitmap(it.file, { imageOrientation: 'from-image' }); it.pw = b.width; it.ph = b.height; b.close(); }
        it.note = `${it.pw} × ${it.ph} px`;
      } catch (e) { if (isAvif(it.file)) it.note = 'AVIF image'; else it.err = useServer ? null : 'This image can’t be opened in this browser.'; }
      refreshItem(it); updateCta();
      if (T.regions && seq === WS.seq) ensureSource();
      return;
    }
    if (it.kind === 'heic') { it.note = 'HEIC photo'; refreshItem(it); updateCta(); return; }
    if (it.kind !== 'pdf') return;
    let pdf;
    try { pdf = await pdfjsDoc(it.file, WS.opts.pw || WS.opts.opw); }
    catch (e) {
      if (seq !== WS.seq) return;
      if (e && e.message === 'offline') { if (!warnedOffline) { warnedOffline = true; toast('Previews need an internet connection the first time.', 'error'); } }
      else if (e && e.name === 'PasswordException') { it.locked = true; it.note = WS.opts.pw || WS.opts.opw ? 'Wrong password' : 'Password-protected'; if (!useServer && !T.passwords) it.err = 'Password-protected. Unlock it first.'; if (askPw && WS.refreshOpts) WS.refreshOpts(); }
      else if (id === 'repair') it.note = 'Damaged file';
      else if (!useServer) it.err = 'This file can’t be read as a PDF.';
      refreshItem(it); updateCta();
      if (T.pages && WS.items[0] === it) { WS.pages = null; renderMain(); }
      if (T.regions && seq === WS.seq) ensureSource();
      return;
    }
    try {
      if (seq !== WS.seq) return;
      it.locked = false;
      it.pages = pdf.numPages; refreshItem(it);
      const page = await pdf.getPage(1), vp1 = page.getViewport({ scale: 1 });
      it.pw = vp1.width; it.ph = vp1.height;
      const c = await renderPage(page, (T.multi ? 260 : 640) / vp1.width);
      if (seq !== WS.seq) return;
      const u = URL.createObjectURL(await canvasToBlob(c, 'image/jpeg', .82)); WS.urls.push(u); c.width = c.height = 0;
      it.thumb = u; refreshItem(it);
      page.cleanup();
      if (T.pages && WS.items[0] === it) await loadPages(it, pdf, seq);
    } catch (e) { console.warn(e); }
    finally { pdf.destroy(); updateCta(); if (T.regions && seq === WS.seq) ensureSource(); }
  }
  async function loadPages(it, pdf, seq) {
    WS.pages = Array.from({ length: pdf.numPages }, (_, i) => ({ i, rot: 0, thumb: null, key: 'p' + i }));
    WS.allPages = WS.pages.slice();
    renderMain(); updateCta();
    for (let i = 0; i < pdf.numPages; i++) {
      if (seq !== WS.seq) return;
      const page = await pdf.getPage(i + 1);
      const c = await renderPage(page, 170 / page.getViewport({ scale: 1 }).width);
      const url = URL.createObjectURL(await canvasToBlob(c, 'image/jpeg', .75)); WS.urls.push(url); c.width = c.height = 0;
      page.cleanup();
      if (seq !== WS.seq) return;
      const p = WS.allPages[i]; p.thumb = url;
      const el = $(`[data-pkey="${p.key}"] .fo-thumb`, main);
      if (el) el.innerHTML = `<img src="${url}" alt="" style="${rotStyle(p.rot)}">`;
    }
  }
  /* reads the files again (after a password was typed) */
  function reloadMeta() {
    clearTimeout(WS.reloadT);
    WS.reloadT = setTimeout(() => {
      if (!WS.items.length || WS.phase !== 'ready') return;
      const files = WS.items.map(i => i.file);
      clearItems(); addFiles(files);
    }, 450);
  }

  /* ---- running ---- */
  async function runTool() {
    if (WS.phase === 'working' || runBtn.disabled) return;
    const v = T.validate && T.validate(WS.opts, goodItems(), WS);
    if (v) { toast(v, 'error'); return; }
    const items = T.accept === 'html' && T.codeFile ? [mkItem(T.codeFile(WS))] : goodItems();
    clearOutputs(); WS.error = '';
    const seq = WS.seq;
    setPhase('working');
    WS.started = performance.now();
    const ctx = { progress: setProgress, pages: WS.pages && WS.pages.map(p => ({ i: p.i, rot: p.rot })), regions: WS.regions, source: WS.source, result: null, alive: () => seq === WS.seq, ws: WS };
    const exec = useServer ? 'server' : 'browser';
    try {
      const outs = useServer ? await serverRun(T, items, WS.opts, ctx) : await T.run(items, WS.opts, ctx);
      if (seq !== WS.seq) return;
      setProgress(1, 'Done');
      WS.outputs = (outs || []).map(o => ({ ...o, url: URL.createObjectURL(o.blob) }));
      WS.result = ctx.result;
      setPhase('done');
      track({ type: 'tool_run', tool: id, exec, status: 'done', ms: Math.round(performance.now() - WS.started), files: items.length, name: runName(items) });
      if (HAS_GSAP() && !REDUCED) gsap.from($('.fo-ok', main), { scale: .6, opacity: 0, duration: .45, ease: 'back.out(2.2)' });
      const top = root.getBoundingClientRect().top;
      if (top < 0) root.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
    } catch (e) {
      if (seq !== WS.seq) return;
      if (e instanceof NoServer) return setPhase('server');
      if (!(e instanceof UserError)) console.error(e);
      WS.error = e instanceof UserError ? e.message : friendly(e);
      if (e && e.need === 'password' && askPw) { WS.needPw = true; if (WS.refreshOpts) WS.refreshOpts(); }
      setPhase('error');
      track({ type: 'tool_run', tool: id, exec, status: 'failed', ms: Math.round(performance.now() - WS.started), files: items.length, name: runName(items) });
    }
  }
  /* what the report shows as the file: the first file's name (+ how many more), or the web address's host */
  function runName(list) {
    if (list && list.length) return list[0].name + (list.length > 1 ? ' (+' + (list.length - 1) + ')' : '');
    try { return WS.opts.url ? new URL(/^https?:/i.test(WS.opts.url) ? WS.opts.url : 'https://' + WS.opts.url).host : ''; } catch (e) { return ''; }
  }
  async function downloadZip(btn) {
    btn.disabled = true; const old = btn.innerHTML; btn.textContent = 'Preparing ZIP…';
    try {
      const JSZip = await lib('jszip'), zip = new JSZip();
      const used = {};
      WS.outputs.forEach(o => { let n = o.name; if (used[n]) n = baseName(n) + '-' + (++used[n]) + (extOf(n) ? '.' + extOf(n) : ''); else used[n] = 1; zip.file(n, o.blob); });
      const blob = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `fileora-${id}.zip`; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch (e) { toast('The ZIP file couldn’t be created. Save the files one by one instead.', 'error'); }
    btn.disabled = false; btn.innerHTML = old;
  }
  function pickFiles(camera) {
    const inp = camera ? $('.fo-cam-in', root) : $('.fo-file-in', root);
    if (!camera) { inp.accept = accept.input; inp.multiple = !!T.multi; }
    inp.value = ''; inp.click();
  }
  const move = (arr, from, to) => { if (to < 0 || to >= arr.length || from === to) return; const [x] = arr.splice(from, 1); arr.splice(to, 0, x); };

  /* ---- events ---- */
  ['.fo-file-in', '.fo-cam-in'].forEach(s => $(s, root).addEventListener('change', e => { const f = [...e.target.files]; e.target.value = ''; if (f.length) addFiles(f); }));
  runBtn.addEventListener('click', runTool);
  main.addEventListener('click', e => {
    const b = e.target.closest('button, a'); if (!b || !main.contains(b)) return;
    const d = b.dataset;
    if ('pick' in d) return pickFiles(false);
    if ('cam' in d) return pickFiles(true);
    if ('clear' in d || 'again' in d) { clearItems(); return setPhase('empty'); }
    if ('retry' in d) return setPhase(WS.items.length ? 'ready' : 'empty');
    if ('sort' in d) { WS.items.sort((a, c) => a.name.localeCompare(c.name, undefined, { numeric: true })); return renderMain(); }
    if ('swap' in d) { WS.items.reverse(); return renderMain(); }
    if ('zip' in d) return downloadZip(b);
    if ('copy' in d) { const t = (WS.result && (WS.result.md || WS.result.text)) || ''; navigator.clipboard.writeText(t).then(() => toast('Copied to the clipboard', 'ok'), () => toast('Copy isn’t allowed here. Download the file instead.', 'error')); return; }
    if ('copyval' in d) { navigator.clipboard.writeText(d.copyval).then(() => toast(`Copied ${d.copyval}`, 'ok'), () => {}); return; }
    if ('next' in d) { e.preventDefault(); const files = WS.outputs.length ? WS.outputs.map(o => new File([o.blob], o.name, { type: o.blob.type || 'application/octet-stream' })) : WS.items.map(i => i.file); return goToTool(d.next, files); }
    if ('expand' in d) { const [a, c] = d.expand.split('-').map(Number); const rows = WS.result.diff.slice(a, c); b.outerHTML = rows.map(x => `<div class="fo-dl ctx"><span class="pg">p${x.p}</span><span class="sg"></span><span>${esc(x.t)}</span></div>`).join(''); return; }
    if ('remove' in d) { WS.items = WS.items.filter(i => i.id !== d.remove); if (T.regions) { WS.source = null; WS.regions = null; } if (!WS.items.length) { clearItems(); return setPhase('empty'); } renderMain(); return updateCta(); }
    if ('move' in d) { const el = b.closest('[data-iid]'), i = WS.items.findIndex(x => x.id === el.dataset.iid); move(WS.items, i, i + +d.move); renderMain(); const nb = $(`[data-iid="${el.dataset.iid}"] [data-move="${d.move}"]`, main); (nb && !nb.disabled ? nb : $(`[data-iid="${el.dataset.iid}"] [data-move]:not([disabled])`, main))?.focus(); return; }
    if ('preset' in d) { if (WS.allPages) { WS.pages = WS.allPages.map(p => (p.rot = 0, p)); renderMain(); updateCta(); } return; }
    const pel = b.closest('[data-pkey]');
    if (pel && WS.pages) {
      const k = WS.pages.findIndex(p => p.key === pel.dataset.pkey), p = WS.pages[k];
      if ('pmove' in d) { move(WS.pages, k, k + +d.pmove); renderMain(); $(`[data-pkey="${p.key}"] [data-pmove="${d.pmove}"]`, main)?.focus(); }
      else if ('prot' in d) { p.rot = (p.rot + 90) % 360; const img = $('.fo-thumb img', pel); if (img) img.style.cssText = rotStyle(p.rot); $('.fo-file-name', pel).textContent = `Page ${p.i + 1}${p.rot ? `, turned ${p.rot}°` : ''}`; }
      else if ('pdel' in d) { WS.pages.splice(k, 1); renderMain(); updateCta(); }
    }
  });
  /* drag to reorder (files and pages) */
  let dragKey = null;
  const keyOf = el => el.dataset.iid || el.dataset.pkey;
  main.addEventListener('dragstart', e => { const el = e.target.closest('.fo-file[draggable="true"]'); if (!el) return; dragKey = keyOf(el); el.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragKey); });
  main.addEventListener('dragover', e => {
    if (!dragKey) return;
    const el = e.target.closest('.fo-file[draggable="true"]'); e.preventDefault();
    $$('.drop-before,.drop-after', main).forEach(x => x.classList.remove('drop-before', 'drop-after'));
    if (!el || keyOf(el) === dragKey) return;
    const r = el.getBoundingClientRect(); el.classList.add(e.clientX < r.left + r.width / 2 ? 'drop-before' : 'drop-after');
  });
  main.addEventListener('drop', e => {
    if (!dragKey) return;
    e.preventDefault(); e.stopPropagation();
    const el = e.target.closest('.fo-file[draggable="true"]');
    if (el && keyOf(el) !== dragKey) {
      const arr = WS.pages && T.pages ? WS.pages : WS.items, kf = x => x.id || x.key;
      const from = arr.findIndex(x => kf(x) === dragKey);
      const [x] = arr.splice(from, 1);
      let to = arr.findIndex(y => kf(y) === keyOf(el));
      if (el.classList.contains('drop-after')) to++;
      arr.splice(to, 0, x);
    }
    dragKey = null; renderMain();
  });
  main.addEventListener('dragend', () => { dragKey = null; $$('.dragging,.drop-before,.drop-after', main).forEach(x => x.classList.remove('dragging', 'drop-before', 'drop-after')); });
  /* files dropped from the computer */
  root.addEventListener('dragover', e => { if (!dragKey && e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files')) { e.preventDefault(); root.classList.add('is-over'); } });
  root.addEventListener('dragleave', e => { if (!root.contains(e.relatedTarget)) root.classList.remove('is-over'); });
  root.addEventListener('drop', e => { root.classList.remove('is-over'); if (dragKey || !e.dataTransfer || !e.dataTransfer.files.length) return; e.preventDefault(); e.stopPropagation(); addFiles(e.dataTransfer.files); });

  /* ---- start ---- */
  renderOptsPanel();
  const unavailable = useServer && meta.available === false;
  setPhase(unavailable ? 'unavailable' : 'empty');
  if (useServer && !CFG.backend && !unavailable) WS.noBackend = true;
  root.classList.add('is-ready');
  return WS;
}

/* ---- 60-server.js ---- */
/* ---------------- server tools (job API through WordPress) ---------------- */
const apiUrl = path => CFG.rest.replace(/\/$/, '') + path;
const apiHeaders = extra => Object.assign(CFG.nonce ? { 'X-WP-Nonce': CFG.nonce } : {}, extra || {});
function uploadForm(url, fd, onProgress) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('POST', url);
    Object.entries(apiHeaders()).forEach(([k, v]) => x.setRequestHeader(k, v));
    x.upload.onprogress = e => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    x.onload = () => { let body = {}; try { body = JSON.parse(x.responseText); } catch (e) { /* not JSON */ } resolve({ status: x.status, body }); };
    x.onerror = () => reject(new UserError('We couldn’t reach the server. Check your connection and try again.'));
    x.send(fd);
  });
}
async function serverRun(t, items, o, ctx) {
  if (!CFG.rest || !CFG.backend) throw new NoServer();
  const fd = new FormData();
  items.forEach(it => fd.append('files[]', it.file, it.name));
  const rest = {};
  Object.entries(o).forEach(([k, v]) => { if ((!v || typeof v !== 'object') && !(t.localOpts && t.localOpts.includes(k))) rest[k] = v; });
  if (o.url) fd.append('url', /^https?:\/\//i.test(o.url) ? o.url : 'https://' + o.url);
  fd.append('options', JSON.stringify(rest));
  try { if (window.FileoraTrack && FileoraTrack.sid()) fd.append('fo_sid', FileoraTrack.sid()); } catch (e) { /* analytics off */ }
  /* A first connection can fail (the website couldn't reach the processing server in time, or the
     visitor's network dropped): try again by itself, twice, before showing an error. */
  let up;
  for (let attempt = 1; ; attempt++) {
    try {
      up = await uploadForm(apiUrl('/jobs/' + t.id), fd, f => ctx.progress(f * .3, items.length ? `Uploading ${Math.round(f * 100)}%` : 'Sending'));
    } catch (e) {
      if (attempt >= 3 || (ctx.alive && !ctx.alive())) throw e;
      up = null;
    }
    if (up && !(up.status === 502 || up.status === 504 || up.status === 0)) break;
    if (attempt >= 3) break;
    ctx.progress(-1, 'Connecting to the server again…');
    await sleep(1500 * attempt);
    if (ctx.alive && !ctx.alive()) throw new Error('cancelled');
  }
  if (up.status === 503 && /connected/i.test(up.body.error || '')) throw new NoServer();
  if (up.status !== 202) throw new UserError(up.body.error || up.body.message || `The server couldn’t accept this request (error ${up.status}).`);
  const { job, token } = up.body;
  const headers = apiHeaders({ 'X-Fileora-Token': token || '' });
  const started = Date.now();
  let st = {}, wait = 800, misses = 0;
  for (;;) {
    await sleep(wait);
    wait = Math.min(3000, wait + 300);
    if (ctx.alive && !ctx.alive()) throw new Error('cancelled');
    let r;
    try { r = await fetch(apiUrl('/jobs/' + job + '?t=' + Date.now()), { headers, cache: 'no-store' }); }
    catch (e) { if (++misses > 20) throw new UserError('We lost the connection to the server. Please run the task again.'); continue; } /* brief network hiccup: keep polling */
    st = await r.json().catch(() => ({}));
    if (r.status === 502 && ++misses <= 20) continue;
    if (!r.ok) throw new UserError(st.error || 'We lost track of this task. Please run it again.');
    misses = 0;
    if (st.status === 'done') break;
    if (st.status === 'failed') { const err = new UserError(st.error || 'The server couldn’t process this file.'); err.need = st.need || ''; throw err; }
    ctx.progress(.32 + Math.min(.55, (Date.now() - started) / 90000), st.status === 'queued' ? (st.ahead ? `Waiting in line, ${st.ahead} ahead of you` : 'Waiting in line') : `${t.verb} on the server`);
    if (Date.now() - started > 30 * 60000) throw new UserError('This is taking too long. Try a smaller file.');
  }
  if (st.kind === 'text') {
    ctx.result = { md: st.text, title: t.textTitle || 'Your text is ready' };
    return [{ name: st.name || 'fileora.txt', blob: new Blob([st.text], { type: 'text/plain' }) }];
  }
  ctx.progress(.92, 'Downloading the result');
  const r = await fetch(apiUrl('/jobs/' + job + '/file'), { headers, cache: 'no-store' });
  if (!r.ok) { const b = await r.json().catch(() => ({})); throw new UserError(b.error || 'The result couldn’t be downloaded. Please run the task again.'); }
  return [{ name: st.name, blob: await r.blob(), note: st.note || '' }];
}

/* ---- 90-boot.js ---- */
/* ---------------- public API and start-up ---------------- */
const API = {
  version: '2.0.0',
  /* Modules call this once per tool. */
  register(def) { if (def && def.id) { DEFS[def.id] = def; if (booted) boot(); } },
  defs: DEFS,
  config: CFG,
  goToTool,
  handoff: Handoff,
  instances: [],
  /* helpers for module scripts */
  h: {
    $, $$, esc, icon, fmtSize, baseName, extOf, clamp, sleep, toast, UserError,
    lib, libUrl, pdfjsDoc, renderPage, canvasToBlob, pdfOut, loadPdf, savePdf, vis, visRect, parseRanges, rangeLabel, PAGE, MM,
    decodeImage, canvasOf, imageCanvas, filterPixels, imageForPdf, embedCanvas, imagesToPdf, rasterize, textPng, textWidth,
    pdfLines, toMarkdown, diffLines, Img, IMG_EXT, OUT_EXT, MIME_PSD, encodeCanvas, fontBytes, isAvif, sameType, renameImg, cropRect, imageNote, eachImage, encodeToSize, padJpeg,
    cropCanvas, LANGS, pageSizeOpt, orientOpt, marginOpt, kindOf
  }
};
window.FileoraEngine = API;

let booted = false, extrasDone = false;
function boot() {
  booted = true;
  $$('.fo-app[data-fo-tool]').forEach(root => {
    if (root.dataset.foMounted || !DEFS[root.dataset.foTool]) return;
    root.dataset.foMounted = '1';
    const ws = mountTool(root);
    if (ws) API.instances.push(ws);
  });
  if (extrasDone || !API.instances.length) return;
  extrasDone = true;
  /* files handed over from another tool or the homepage */
  if (/[?&]fo_handoff=1/.test(location.search) && API.instances[0]) {
    Handoff.take().then(files => { if (files && files.length) API.instances[0].addFiles(files); }).catch(() => {});
    try { history.replaceState(null, '', location.pathname + location.search.replace(/[?&]fo_handoff=1/, '').replace(/^&/, '?') + location.hash); } catch (e) { /* ignore */ }
  }
  /* a file dropped anywhere on a tool page goes into the tool */
  if (API.instances.length === 1) {
    const ws = API.instances[0];
    addEventListener('dragover', e => { if (e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files')) e.preventDefault(); });
    addEventListener('drop', e => { if (!e.dataTransfer || !e.dataTransfer.files.length || ws.root.contains(e.target)) return; e.preventDefault(); ws.addFiles(e.dataTransfer.files); ws.root.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' }); });
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
/* a tool whose module never loaded (blocked by an extension or offline) */
addEventListener('load', () => setTimeout(() => {
  $$('.fo-app[data-fo-tool]:not([data-fo-mounted])').forEach(root => { root.innerHTML = '<div class="fo-state"><h2>This tool couldn’t load</h2><p>Please reload the page. If it keeps happening, an ad blocker or a slow connection may be stopping it.</p></div>'; });
}, 4000));

/* ---- app-bridge.js ---- */
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
})();
