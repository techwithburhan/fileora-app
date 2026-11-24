/* Fileora module: File Optimizer.
   Compress and Repair use the processing server when it can run them and
   fall back to these browser versions otherwise. OCR and PDF/A need the server. */
(function (E) {
  'use strict';
  if (!E) return;
  const { baseName, tagName, fmtSize, UserError, lib, pdfOut, loadPdf, savePdf, rasterize, LANGS } = E.h;
  const server = () => (E.config.tools.compress || {}).runs === 'server';

  /* ---- browser compression (used when the processing server can't run Compress PDF) ----
     2.21: images inside the PDF are made smaller (resampled and saved as JPEG) while text, links and
     vector drawings stay as they are, so text stays selectable. Before, "Balanced" and "Strong" turned
     every page into a picture, and "Light" only re-saved the file (0–4% smaller). */
  const LEVELS = { light: null, balanced: { dim: 1700, q: .72, need: .9 }, strong: { dim: 1150, q: .52, need: .95 } };

  async function inflate(bytes) {
    if (typeof DecompressionStream === 'undefined') throw new Error('no inflate');
    const ds = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
    return new Uint8Array(await new Response(ds).arrayBuffer());
  }
  /* PNG predictors (DecodeParms /Predictor 10–15) */
  function unpredict(data, w, colors, bpc) {
    const bpp = Math.max(1, (colors * bpc) >> 3), row = (w * colors * bpc + 7) >> 3, rows = Math.floor(data.length / (row + 1));
    const out = new Uint8Array(rows * row);
    for (let y = 0; y < rows; y++) {
      const t = data[y * (row + 1)], src = y * (row + 1) + 1, dst = y * row;
      for (let x = 0; x < row; x++) {
        const a = x >= bpp ? out[dst + x - bpp] : 0, b = y ? out[dst - row + x] : 0, c = y && x >= bpp ? out[dst - row + x - bpp] : 0;
        let v = data[src + x];
        if (t === 1) v += a; else if (t === 2) v += b; else if (t === 3) v += (a + b) >> 1;
        else if (t === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
        out[dst + x] = v & 255;
      }
    }
    return out;
  }
  function canvasOf(w, h) {
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
    const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
  }
  const toJpeg = (c, q) => c.convertToBlob ? c.convertToBlob({ type: 'image/jpeg', quality: q }) : new Promise(r => c.toBlob(r, 'image/jpeg', q));

  async function shrinkImages(doc, lvl, prog) {
    const P = await lib('pdflib');
    const { PDFName, PDFRawStream, PDFArray, PDFRef, PDFNumber, PDFDict } = P;
    const N = n => PDFName.of(n), ctxp = doc.context;
    const num = v => (v instanceof PDFNumber ? v.asNumber() : 0);
    const list = ctxp.enumerateIndirectObjects().filter(([, o]) => o instanceof PDFRawStream && o.dict.get(N('Subtype')) === N('Image'));
    let changed = 0;
    for (let k = 0; k < list.length; k++) {
      const [ref, obj] = list[k], d = obj.dict;
      prog && prog(k / Math.max(1, list.length), `Image ${k + 1} of ${list.length}`);
      try {
        if (obj.contents.length < 24000 || d.get(N('ImageMask')) || d.get(N('Mask')) || d.get(N('Decode'))) continue;
        let f = d.get(N('Filter'));
        if (f instanceof PDFArray) f = f.size() === 1 ? f.get(0) : null;
        const filter = f instanceof PDFName ? f.asString() : '';
        let cs = d.get(N('ColorSpace')), comps = 0, keepCs = null;
        if (cs instanceof PDFRef) cs = ctxp.lookup(cs);
        if (cs instanceof PDFName) comps = { '/DeviceRGB': 3, '/DeviceGray': 1 }[cs.asString()] || 0;
        else if (cs instanceof PDFArray && cs.get(0) === N('ICCBased')) {
          const icc = ctxp.lookup(cs.get(1));
          comps = icc && icc.dict ? num(icc.dict.get(N('N'))) : 0;
          if (comps === 3) keepCs = d.get(N('ColorSpace'));
        }
        if (comps !== 1 && comps !== 3) continue;   // CMYK, Lab, indexed: left as they are
        const w = num(d.get(N('Width'))), h = num(d.get(N('Height'))), bpc = num(d.get(N('BitsPerComponent'))) || 8;
        if (!w || !h || w * h > 40e6) continue;
        let source;
        if (filter === '/DCTDecode') {
          source = await createImageBitmap(new Blob([obj.contents], { type: 'image/jpeg' }));
        } else if ((filter === '/FlateDecode' || (!filter && !d.get(N('Filter')))) && bpc === 8) {
          let px = filter ? await inflate(obj.contents) : obj.contents;   // Flate, or raw pixels with no filter
          let parms = d.get(N('DecodeParms'));
          if (parms instanceof PDFArray) parms = parms.get(0);
          if (parms instanceof PDFRef) parms = ctxp.lookup(parms);
          const pred = parms instanceof PDFDict ? num(parms.get(N('Predictor'))) : 0;
          if (pred >= 10) px = unpredict(px, w, comps, 8); else if (pred > 1) continue;
          if (px.length < w * h * comps) continue;
          const rgba = new Uint8ClampedArray(w * h * 4);
          for (let i = 0, j = 0; i < w * h; i++, j += comps) {
            rgba[i * 4] = px[j]; rgba[i * 4 + 1] = px[comps === 3 ? j + 1 : j]; rgba[i * 4 + 2] = px[comps === 3 ? j + 2 : j]; rgba[i * 4 + 3] = 255;
          }
          source = await createImageBitmap(new ImageData(rgba, w, h));
        } else continue;
        const scale = Math.min(1, lvl.dim / Math.max(w, h));
        const nw = Math.max(1, Math.round(w * scale)), nh = Math.max(1, Math.round(h * scale));
        const c = canvasOf(nw, nh), g = c.getContext('2d');
        g.imageSmoothingQuality = 'high';
        g.drawImage(source, 0, 0, nw, nh);
        if (source.close) source.close();
        const out = new Uint8Array(await (await toJpeg(c, lvl.q)).arrayBuffer());
        if (out.length >= obj.contents.length * (filter === '/DCTDecode' ? lvl.need : .5)) continue;   // not worth it
        const nd = { Type: 'XObject', Subtype: 'Image', Width: nw, Height: nh, BitsPerComponent: 8, Filter: 'DCTDecode',
          ColorSpace: keepCs || 'DeviceRGB' };
        const sm = d.get(N('SMask')); if (sm) nd.SMask = sm;          // transparency stays (it may have its own size)
        const intent = d.get(N('Intent')); if (intent) nd.Intent = intent;
        ctxp.assign(ref, ctxp.stream(out, nd));
        changed++;
      } catch (e) { /* this image stays as it is */ }
    }
    return changed;
  }

  E.register({ id: 'compress', server: true, accept: 'pdf', multi: true, cta: 'Compress PDF', verb: 'Compressing',
    opts: [{ id: 'level', type: 'seg', label: 'Compression', value: 'balanced', choices: [['light', 'Light'], ['balanced', 'Balanced'], ['strong', 'Strong']],
      help: o => (server()
        ? { light: 'Best quality, smaller savings.', balanced: 'Good quality at a much smaller size. Text stays selectable.', strong: 'Smallest file for email. Images get lower resolution.' }
        : { light: 'Lossless clean-up. Text stays selectable; savings are smaller.', balanced: 'Images get smaller, text stays selectable. Good quality.', strong: 'Smallest file for email. Images get lower quality; text stays selectable.' })[o.level] }],
    async run(items, o, ctx) {
      const outs = [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const prog = (f, l) => ctx.progress((i + f) / items.length, `${items.length > 1 ? it.name + ': ' : ''}${l}`);
        prog(.05, 'Reading the file');
        const doc = await loadPdf(it, { updateMetadata: false });
        const lvl = LEVELS[o.level] || null;
        let images = 0;
        if (lvl) images = await shrinkImages(doc, lvl, (f, l) => prog(.1 + f * .75, l));
        prog(.9, 'Saving');
        let bytes = await doc.save({ useObjectStreams: true });
        /* "Strong" on a scan whose pages can't be made smaller another way: pages as lower-resolution images */
        if (o.level === 'strong' && !images && bytes.length > it.size * .85) {
          try { const r = await rasterize(it.file, 96, .5, (f, l) => prog(.9 + f * .09, l)); if (r.length < bytes.length * .8) bytes = r; } catch (e) { /* keep the first result */ }
        }
        let blob = new Blob([bytes], { type: 'application/pdf' }), note, good = false;
        if (blob.size >= it.size * .98) { blob = it.file; note = 'Already well optimized, so we kept the original size'; }
        else { note = `${Math.max(1, Math.min(99, Math.floor((1 - blob.size / it.size) * 100)))}% smaller (${fmtSize(it.size)} to ${fmtSize(blob.size)})`; good = true; }
        outs.push({ name: tagName(it.name, '-compressed', 'pdf'), blob, note, good });
      }
      return outs;
    } });

  E.register({ id: 'repair', server: true, accept: 'pdf', cta: 'Repair PDF', verb: 'Repairing', opts: [],
    async run(items, o, ctx) {
      const it = items[0], b = baseName(it.name);
      try {
        ctx.progress(.2, 'Rebuilding the file structure');
        const { PDFDocument } = await lib('pdflib');
        const doc = await PDFDocument.load(await it.file.arrayBuffer(), { ignoreEncryption: true, throwOnInvalidObject: false });
        if (doc.isEncrypted) throw new UserError(`${it.name} is password-protected. Unlock it first.`);
        if (!doc.getPageCount()) throw new Error('no pages');
        return [pdfOut(b + '-repaired.pdf', await savePdf(doc), `Rebuilt structure, ${doc.getPageCount()} pages recovered`)];
      } catch (e) {
        if (e instanceof UserError) throw e;
        try { return [pdfOut(b + '-repaired.pdf', await rasterize(it.file, 150, .85, (f, l) => ctx.progress(.3 + f * .65, 'Recovering ' + l.toLowerCase())), 'Rebuilt from page images. Text may no longer be selectable.')]; }
        catch (e2) { throw new UserError(`We couldn’t recover ${it.name}. The file is too damaged, or it isn’t a PDF.`); }
      }
    } });

  E.register({ id: 'ocr', server: true, accept: 'pdf', multi: true, cta: 'Run OCR', verb: 'Recognizing text',
    opts: [
      { id: 'lang', type: 'select', label: 'Document language', value: 'en', choices: LANGS },
      { id: 'out', type: 'seg', label: 'Output', value: 'pdf', choices: [['pdf', 'Searchable PDF'], ['txt', 'Text file']] }
    ] });

  E.register({ id: 'pdfa', server: true, accept: 'pdf', multi: true, cta: 'Convert to PDF/A', verb: 'Converting',
    opts: [{ id: 'level', type: 'select', label: 'Conformance level', value: '2b', choices: [['1b', 'PDF/A-1b'], ['2b', 'PDF/A-2b (recommended)'], ['3b', 'PDF/A-3b']] }] });
})(window.FileoraEngine);
