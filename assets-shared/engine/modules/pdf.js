/* Fileora module: PDF Tools (30 tools, all in the browser). */
(function (E) {
  'use strict';
  if (!E) return;
  const { esc, fmtSize, baseName, tagName, clamp, UserError, lib, pdfjsDoc, renderPage, canvasToBlob, pdfOut, loadPdf, savePdf, vis, visRect, parseRanges, rangeLabel, PAGE, MM, decodeImage, canvasOf, imageCanvas, embedCanvas, imagesToPdf, rasterize, textPng, textWidth, pdfLines, toMarkdown, diffLines, cropCanvas, pageSizeOpt, orientOpt, marginOpt, kindOf } = E.h;
  const R = def => E.register(def);
  const pc = (v, d) => (v / d * 100).toFixed(3) + '%';
  const dateText = () => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  /* ---------------- organize ---------------- */
  R({ id: 'merge', accept: 'pdf', multi: true, min: 2, ordered: true, cta: 'Merge PDF', verb: 'Merging', tip: 'Drag the files to change their order. The file marked 1 comes first.', opts: [],
    async run(items, o, ctx) {
      const { PDFDocument } = await lib('pdflib');
      const out = await PDFDocument.create();
      for (let i = 0; i < items.length; i++) {
        ctx.progress(i / items.length, `Adding ${items[i].name}`);
        const src = await loadPdf(items[i]);
        (await out.copyPages(src, src.getPageIndices())).forEach(p => out.addPage(p));
      }
      ctx.progress(.95, 'Saving');
      return [pdfOut('fileora-merged.pdf', await savePdf(out), `${out.getPageCount()} pages from ${items.length} files`)];
    } });

  R({ id: 'split', accept: 'pdf', cta: 'Split PDF', verb: 'Splitting',
    opts: [
      { id: 'mode', type: 'seg', label: 'Split by', value: 'ranges', choices: [['ranges', 'Page ranges'], ['all', 'Every page'], ['chunk', 'Fixed size']] },
      { id: 'ranges', type: 'text', label: 'Pages to extract', value: '1-2', placeholder: 'For example: 1-3, 5, 8-', help: 'Use commas between ranges. “8-” means page 8 to the end.', show: o => o.mode === 'ranges' },
      { id: 'together', type: 'toggle', label: 'Put all ranges in one PDF', value: false, show: o => o.mode === 'ranges' },
      { id: 'chunk', type: 'number', label: 'Pages per file', value: 2, min: 1, max: 999, suffix: 'pages', show: o => o.mode === 'chunk' }
    ],
    validate: o => o.mode === 'ranges' && !String(o.ranges || '').trim() ? 'Enter the pages to extract, like 1-3, 5.' : '',
    async run(items, o, ctx) {
      const { PDFDocument } = await lib('pdflib');
      const it = items[0], src = await loadPdf(it), n = src.getPageCount(), b = baseName(it.name);
      let groups;
      if (o.mode === 'all') groups = Array.from({ length: n }, (_, i) => [i]);
      else if (o.mode === 'chunk') { const k = Math.max(1, Math.floor(+o.chunk || 1)); groups = []; for (let i = 0; i < n; i += k) groups.push(Array.from({ length: Math.min(k, n - i) }, (_, j) => i + j)); }
      else { groups = parseRanges(o.ranges, n); if (!groups.length) throw new UserError('Enter at least one page range, like 1-3, 5.'); if (o.together) groups = [groups.flat()]; }
      const outs = [];
      for (let g = 0; g < groups.length; g++) {
        ctx.progress(g / groups.length, `Creating file ${g + 1} of ${groups.length}`);
        const d = await PDFDocument.create();
        (await d.copyPages(src, groups[g])).forEach(p => d.addPage(p));
        const lab = groups.length === 1 && o.together ? 'extract' : rangeLabel(groups[g]);
        outs.push(pdfOut(`${b}-${lab}${outs.some(x => x.name.includes(lab)) ? '-' + (g + 1) : ''}.pdf`, await savePdf(d), `${groups[g].length} page${groups[g].length > 1 ? 's' : ''}`));
      }
      return outs;
    } });

  R({ id: 'organize', accept: 'pdf', pages: true, cta: 'Save PDF', verb: 'Saving', tip: 'Drag pages to reorder them. Use the buttons under each page to rotate or delete it.', opts: [],
    async run(items, o, ctx) {
      const { PDFDocument, degrees } = await lib('pdflib');
      if (!ctx.pages || !ctx.pages.length) throw new UserError('Keep at least one page.');
      const src = await loadPdf(items[0]);
      const d = await PDFDocument.create();
      const copied = await d.copyPages(src, ctx.pages.map(p => p.i));
      copied.forEach((p, k) => { const r = ctx.pages[k].rot; if (r) p.setRotation(degrees((p.getRotation().angle + r) % 360)); d.addPage(p); });
      ctx.progress(.9, 'Saving');
      return [pdfOut(tagName(items[0].name, '-organized', 'pdf'), await savePdf(d), `${copied.length} pages`)];
    } });

  R({ id: 'rotate', accept: 'pdf', multi: true, cta: 'Rotate PDF', verb: 'Rotating',
    opts: [
      { id: 'angle', type: 'seg', label: 'Rotate', value: '90', choices: [['90', '90° right'], ['180', '180°'], ['270', '90° left']] },
      { id: 'which', type: 'seg', label: 'Pages', value: 'all', choices: [['all', 'All'], ['odd', 'Odd'], ['even', 'Even']] }
    ],
    thumbStyle: o => `--rot:${o.angle}deg;--rs:${(+o.angle) % 180 ? .74 : 1}`,
    async run(items, o, ctx) {
      const { degrees } = await lib('pdflib');
      const outs = [];
      for (let i = 0; i < items.length; i++) {
        ctx.progress(i / items.length, `Rotating ${items[i].name}`);
        const doc = await loadPdf(items[i]);
        doc.getPages().forEach((p, k) => {
          if ((o.which === 'odd' && k % 2) || (o.which === 'even' && !(k % 2))) return;
          p.setRotation(degrees((p.getRotation().angle + +o.angle) % 360));
        });
        outs.push(pdfOut(tagName(items[i].name, '-rotated', 'pdf'), await savePdf(doc)));
      }
      return outs;
    } });

  R({ id: 'crop', accept: 'pdf', cta: 'Crop PDF', verb: 'Cropping',
    opts: [{ id: 'm', type: 'margins', label: 'Trim from each edge (mm)', value: { top: 10, right: 10, bottom: 10, left: 10 } }],
    overlay(it, o) {
      const W = it.pw, H = it.ph, m = o.m || {}, cl = k => Math.min(49, (+m[k] || 0) * MM / (k === 'left' || k === 'right' ? W : H) * 100);
      return `<div class="fo-cr" style="left:${cl('left')}%;right:${cl('right')}%;top:${cl('top')}%;bottom:${cl('bottom')}%"></div>`;
    },
    async run(items, o, ctx) {
      const m = o.m || {};
      const [t, r, b, l] = ['top', 'right', 'bottom', 'left'].map(k => Math.max(0, +m[k] || 0) * MM);
      const doc = await loadPdf(items[0]);
      doc.getPages().forEach(p => {
        const rot = ((p.getRotation().angle % 360) + 360) % 360;
        const [L, Rr, T, B] = rot === 90 ? [t, b, r, l] : rot === 180 ? [r, l, b, t] : rot === 270 ? [b, t, l, r] : [l, r, t, b];
        const box = p.getCropBox(), nw = box.width - L - Rr, nh = box.height - T - B;
        if (nw < 20 || nh < 20) throw new UserError('Those margins are bigger than the page. Use smaller numbers.');
        p.setMediaBox(box.x + L, box.y + B, nw, nh);
        p.setCropBox(box.x + L, box.y + B, nw, nh);
      });
      ctx.progress(.9, 'Saving');
      return [pdfOut(tagName(items[0].name, '-cropped', 'pdf'), await savePdf(doc))];
    } });

  /* ---------------- edit and sign ---------------- */
  const pageLabel = (fmt, n, total) => ({ n: `${n}`, page: `Page ${n}`, of: `${n} of ${total}`, pageof: `Page ${n} of ${total}` }[fmt] || `${n}`);
  R({ id: 'pagenum', accept: 'pdf', multi: true, cta: 'Add page numbers', verb: 'Numbering',
    opts: [
      { id: 'pos', type: 'pos', label: 'Position', value: 'bc', cells: ['tl', 'tc', 'tr', 'bl', 'bc', 'br'] },
      { id: 'fmt', type: 'select', label: 'Format', value: 'n', choices: [['n', '1'], ['page', 'Page 1'], ['of', '1 of 12'], ['pageof', 'Page 1 of 12']] },
      { id: 'start', type: 'number', label: 'Start at', value: 1, min: 0, max: 9999 },
      { id: 'fsize', type: 'range', label: 'Text size', value: 11, min: 7, max: 24, step: 1, suffix: 'pt' },
      { id: 'skipFirst', type: 'toggle', label: 'Skip the first page (cover)', value: false }
    ],
    overlay(it, o) {
      if (o.skipFirst) return '';
      const W = it.pw, H = it.ph, n = Math.floor(+o.start || 0), total = (it.pages || 1) + n - 1, size = +o.fsize, m = 26;
      const v = o.pos[0] === 't' ? `top:${pc(m, H)}` : `bottom:${pc(m, H)}`;
      const u = o.pos[1] === 'l' ? `left:${pc(m, W)}` : o.pos[1] === 'r' ? `right:${pc(m, W)}` : 'left:50%;transform:translateX(-50%)';
      return `<span class="fo-pn" style="${v};${u};font-size:${(size / W * 100).toFixed(3)}cqw">${esc(pageLabel(o.fmt, n, total))}</span>`;
    },
    async run(items, o, ctx) {
      const { StandardFonts, rgb, degrees } = await lib('pdflib');
      const outs = [];
      for (let f = 0; f < items.length; f++) {
        ctx.progress(f / items.length, `Numbering ${items[f].name}`);
        const doc = await loadPdf(items[f]);
        const font = await doc.embedFont(StandardFonts.Helvetica);
        const pages = doc.getPages(), skip = o.skipFirst ? 1 : 0, start = Math.floor(+o.start || 0), total = pages.length - skip + start - 1, size = +o.fsize;
        pages.forEach((p, i) => {
          if (i < skip) return;
          const label = pageLabel(o.fmt, i - skip + start, total);
          const V = vis(p), tw = font.widthOfTextAtSize(label, size), m = 26;
          const u = o.pos[1] === 'l' ? m : o.pos[1] === 'c' ? (V.W - tw) / 2 : V.W - m - tw;
          const v = o.pos[0] === 't' ? V.H - m - size * .72 : m;
          const pt = V.map(u, v);
          p.drawText(label, { x: pt.x, y: pt.y, size, font, color: rgb(.2, .21, .3), rotate: degrees(V.r) });
        });
        outs.push(pdfOut(tagName(items[f].name, '-numbered', 'pdf'), await savePdf(doc)));
      }
      return outs;
    } });

  const wmCentres = (W, H, w, h, angle, layout) => {
    const th = angle * Math.PI / 180, cos = Math.cos(th), sin = Math.sin(th), out = [];
    if (layout === 'tile') {
      const sx = Math.abs(w * cos) + Math.abs(h * sin) + 70, sy = Math.abs(w * sin) + Math.abs(h * cos) + 60;
      for (let r = 0, cy = sy / 2; cy < H + sy && out.length < 400; cy += sy, r++) for (let cx = (r % 2 ? sx / 2 : 0); cx < W + sx; cx += sx) out.push([cx, cy]);
    } else out.push([W / 2, H / 2]);
    return out;
  };
  R({ id: 'watermark', accept: 'pdf', multi: true, cta: 'Add watermark', verb: 'Stamping',
    opts: [
      { id: 'text', type: 'text', label: 'Watermark text', value: 'CONFIDENTIAL', placeholder: 'For example: DRAFT' },
      { id: 'layout', type: 'seg', label: 'Layout', value: 'center', choices: [['center', 'Centred'], ['tile', 'Tiled']] },
      { id: 'angle', type: 'seg', label: 'Angle', value: '45', choices: [['0', '0°'], ['45', '45°'], ['-45', '−45°']] },
      { id: 'fsize', type: 'range', label: 'Text size', value: 60, min: 16, max: 140, step: 2, suffix: 'pt' },
      { id: 'opacity', type: 'range', label: 'Opacity', value: 20, min: 5, max: 100, step: 5, suffix: '%' },
      { id: 'color', type: 'color', label: 'Colour', value: '#E0464C', choices: ['#E0464C', '#16182F', '#2F6BF3', '#0E9F57', '#8C90A8'] }
    ],
    validate: o => String(o.text || '').trim() ? '' : 'Type the watermark text to continue.',
    overlay(it, o) {
      const text = String(o.text || '').trim(); if (!text) return '';
      const W = it.pw, H = it.ph, fs = +o.fsize, w = textWidth(text, fs) + fs * .24, h = fs * 1.32;
      return wmCentres(W, H, w, h, +o.angle, o.layout).slice(0, 80).map(([cx, cy]) => `<span class="fo-wm" style="left:${pc(cx, W)};top:${pc(H - cy, H)};font-size:${(fs / W * 100).toFixed(3)}cqw;color:${o.color};opacity:${+o.opacity / 100};transform:translate(-50%,-50%) rotate(${-o.angle}deg)">${esc(text)}</span>`).join('');
    },
    async run(items, o, ctx) {
      const { degrees } = await lib('pdflib');
      const text = String(o.text || '').trim();
      const tp = await textPng(text, o.color);
      const outs = [];
      for (let f = 0; f < items.length; f++) {
        ctx.progress(f / items.length, `Stamping ${items[f].name}`);
        const doc = await loadPdf(items[f]);
        const img = await doc.embedPng(tp.bytes);
        const sc = +o.fsize / tp.px, w = tp.w * sc, h = tp.h * sc, th = (+o.angle) * Math.PI / 180, cos = Math.cos(th), sin = Math.sin(th);
        for (const p of doc.getPages()) {
          const V = vis(p);
          for (const [cx, cy] of wmCentres(V.W, V.H, w, h, +o.angle, o.layout)) {
            const u = cx - (w / 2) * cos + (h / 2) * sin, v = cy - (w / 2) * sin - (h / 2) * cos;
            const pt = V.map(u, v);
            p.drawImage(img, { x: pt.x, y: pt.y, width: w, height: h, rotate: degrees(V.r + +o.angle), opacity: +o.opacity / 100 });
          }
        }
        outs.push(pdfOut(tagName(items[f].name, '-watermarked', 'pdf'), await savePdf(doc)));
      }
      return outs;
    } });

  /* draws an embedded page into a visual box, applying the source page's /Rotate */
  const drawRotated = (sheet, ep, V, bx, by, bw, bh, degrees) => {
    const r = V.r, W0 = r % 180 ? bh : bw, H0 = r % 180 ? bw : bh;
    const pos = r === 90 ? [bx, by + bh] : r === 180 ? [bx + bw, by + bh] : r === 270 ? [bx + bw, by] : [bx, by];
    sheet.drawPage(ep, { x: pos[0], y: pos[1], width: W0, height: H0, rotate: degrees(-r) });
  };
  const placeBox = (W, H, w, h, pos, m, bottomExtra = 0) => {
    const row = pos[0], col = pos[1];
    return { u: col === 'l' ? m : col === 'c' ? (W - w) / 2 : W - m - w, v: row === 't' ? H - m - h : row === 'm' ? (H - h) / 2 : m + bottomExtra };
  };
  R({ id: 'sign', accept: 'pdf', cta: 'Sign PDF', verb: 'Signing',
    opts: [
      { id: 'signature', type: 'signature', label: 'Your signature', value: null },
      { id: 'where', type: 'seg', label: 'Pages', value: 'last', choices: [['first', 'First'], ['last', 'Last'], ['all', 'All']] },
      { id: 'pos', type: 'pos', label: 'Position on the page', value: 'br' },
      { id: 'width', type: 'range', label: 'Size', value: 28, min: 12, max: 60, step: 1, suffix: '%' },
      { id: 'date', type: 'toggle', label: 'Add today’s date under it', value: true }
    ],
    validate: o => o.signature ? '' : 'Draw, type or upload your signature to continue.',
    overlay(it, o, ws) {
      const W = it.pw, H = it.ph, sg = o.signature, ratio = sg ? sg.h / sg.w : .36, w = W * (+o.width / 100), h = w * ratio;
      const { u, v } = placeBox(W, H, w, h, o.pos, Math.min(W, H) * .06, o.date ? 14 : 0);
      return `<div class="fo-sgb" style="left:${pc(u, W)};bottom:${pc(v, H)};width:${pc(w, W)};height:${pc(h, H)}">${sg && ws.sigUrl ? `<img src="${ws.sigUrl}" alt="">` : '<span>Signature</span>'}</div>`;
    },
    async run(items, o, ctx) {
      const { StandardFonts, rgb, degrees } = await lib('pdflib');
      const sg = o.signature;
      const doc = await loadPdf(items[0]);
      const png = await doc.embedPng(sg.bytes);
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const pages = doc.getPages();
      const targets = o.where === 'first' ? [pages[0]] : o.where === 'all' ? pages : [pages[pages.length - 1]];
      const date = dateText();
      for (const p of targets) {
        const V = vis(p), w = V.W * (+o.width / 100), h = w * sg.h / sg.w;
        const { u, v } = placeBox(V.W, V.H, w, h, o.pos, Math.min(V.W, V.H) * .06, o.date ? 14 : 0);
        let pt = V.map(u, v);
        p.drawImage(png, { x: pt.x, y: pt.y, width: w, height: h, rotate: degrees(V.r) });
        if (o.date) { pt = V.map(u + 2, v - 11); p.drawText(date, { x: pt.x, y: pt.y, size: 9, font, color: rgb(.3, .32, .45), rotate: degrees(V.r) }); }
      }
      ctx.progress(.9, 'Saving');
      return [pdfOut(tagName(items[0].name, '-signed', 'pdf'), await savePdf(doc), `Signed on ${targets.length} page${targets.length > 1 ? 's' : ''}`)];
    } });

  /* ---------------- convert ---------------- */
  R({ id: 'pdf2jpg', accept: 'pdf', multi: true, cta: 'Convert to images', verb: 'Rendering pages',
    opts: [
      { id: 'format', type: 'seg', label: 'Format', value: 'jpg', choices: [['jpg', 'JPG'], ['png', 'PNG']] },
      { id: 'dpi', type: 'seg', label: 'Quality', value: '150', choices: [['96', 'Screen'], ['150', 'High'], ['300', 'Print']], help: o => `${o.dpi} dpi` }
    ],
    async run(items, o, ctx) {
      const outs = [], ext = o.format === 'png' ? 'png' : 'jpg';
      for (let f = 0; f < items.length; f++) {
        const pdf = await pdfjsDoc(items[f].file), n = pdf.numPages, b = baseName(items[f].name);
        for (let i = 1; i <= n; i++) {
          ctx.progress((f + (i - 1) / n) / items.length, `Page ${i} of ${n}`);
          const page = await pdf.getPage(i);
          const c = await renderPage(page, +o.dpi / 72);
          const blob = await canvasToBlob(c, ext === 'png' ? 'image/png' : 'image/jpeg', .9);
          outs.push({ name: `${b}-page-${String(i).padStart(String(n).length, '0')}.${ext}`, blob, note: `${c.width} × ${c.height} px, ${fmtSize(blob.size)}` });
          c.width = c.height = 0; page.cleanup();
        }
        await pdf.destroy();
      }
      return outs;
    } });

  R({ id: 'jpg2pdf', accept: 'image', multi: true, ordered: true, cta: 'Convert to PDF', verb: 'Converting', tip: 'Drag images to change their order. Each image becomes one page.',
    opts: [pageSizeOpt('a4'), orientOpt, marginOpt],
    async run(items, o, ctx) { return [pdfOut(items.length === 1 ? baseName(items[0].name) + '.pdf' : 'fileora-images.pdf', await imagesToPdf(items, o, ctx, 'none'), `${items.length} page${items.length > 1 ? 's' : ''}`)]; } });

  R({ id: 'scan', accept: 'image', multi: true, ordered: true, camera: true, cta: 'Create PDF', verb: 'Building your scan',
    opts: [
      { id: 'filter', type: 'seg', label: 'Look', value: 'doc', choices: [['none', 'Original'], ['gray', 'Greyscale'], ['doc', 'Document']], help: o => ({ none: 'Keeps the photo as it is.', gray: 'Removes colour casts from lighting.', doc: 'High contrast black and white, best for text.' }[o.filter]) },
      pageSizeOpt('a4'), orientOpt, marginOpt
    ],
    async run(items, o, ctx) { return [pdfOut('fileora-scan.pdf', await imagesToPdf(items, o, ctx, o.filter), `${items.length} page${items.length > 1 ? 's' : ''}`)]; } });

  R({ id: 'pdf2md', accept: 'pdf', cta: 'Convert to Markdown', verb: 'Reading the text',
    opts: [{ id: 'breaks', type: 'toggle', label: 'Mark page breaks', value: false }],
    async run(items, o, ctx) {
      const pages = await pdfLines(items[0].file, (f, l) => ctx.progress(f * .9, l), 'Reading');
      const md = toMarkdown(pages, o.breaks);
      if (md.trim().length < 2) throw new UserError('We couldn’t find any text in this PDF. If it’s a scan, run OCR PDF first.');
      ctx.result = { md, title: 'Your Markdown is ready' };
      return [{ name: baseName(items[0].name) + '.md', blob: new Blob([md], { type: 'text/markdown' }), note: `${md.split(/\s+/).filter(Boolean).length.toLocaleString()} words` }];
    } });

  R({ id: 'pdf2txt', accept: 'pdf', cta: 'Extract text', verb: 'Reading the text',
    opts: [
      { id: 'breaks', type: 'toggle', label: 'Mark where each page starts', value: true },
      { id: 'join', type: 'toggle', label: 'Join lines into paragraphs', value: false }
    ],
    async run(items, o, ctx) {
      const pages = await pdfLines(items[0].file, (f, l) => ctx.progress(f * .9, l), 'Reading');
      const parts = pages.map((lines, i) => {
        let body = lines.map(l => l.text).join('\n');
        if (o.join) body = body.replace(/([^\n.!?:;])\n(?=[a-z0-9(])/g, '$1 ').replace(/-\n(?=[a-z])/g, '');
        return (o.breaks ? `--- Page ${i + 1} ---\n` : '') + body;
      });
      const text = parts.join('\n\n').trim() + '\n';
      if (text.replace(/--- Page \d+ ---/g, '').trim().length < 2) throw new UserError('We couldn’t find any text in this PDF. If it’s a scan, run OCR PDF first.');
      ctx.result = { text, title: 'Your text is ready' };
      return [{ name: baseName(items[0].name) + '.txt', blob: new Blob([text], { type: 'text/plain;charset=utf-8' }), note: `${text.split(/\s+/).filter(Boolean).length.toLocaleString()} words from ${pages.length} page${pages.length > 1 ? 's' : ''}` }];
    } });

  R({ id: 'compare', accept: 'pdf', multi: true, min: 2, max: 2, slots: ['Original', 'Changed version'], cta: 'Compare files', verb: 'Comparing', tip: 'Add the original first, then the changed version.',
    opts: [{ id: 'ignoreCase', type: 'toggle', label: 'Ignore upper and lower case', value: false }],
    async run(items, o, ctx) {
      const [A, B] = items;
      const pa = await pdfLines(A.file, (f, l) => ctx.progress(f * .45, l), 'Reading the original,');
      const pb = await pdfLines(B.file, (f, l) => ctx.progress(.45 + f * .45, l), 'Reading the changed version,');
      const la = pa.flatMap((ls, i) => ls.map(l => ({ t: l.text, p: i + 1 }))), lb = pb.flatMap((ls, i) => ls.map(l => ({ t: l.text, p: i + 1 })));
      if (!la.length && !lb.length) throw new UserError('Neither file contains selectable text. Run OCR PDF on scans first.');
      ctx.progress(.92, 'Finding the differences');
      const norm = s => (o.ignoreCase ? s.toLowerCase() : s).replace(/\s+/g, ' ').trim();
      const ops = diffLines(la.map(x => norm(x.t)), lb.map(x => norm(x.t)));
      const rows = ops.map(([k, i, j]) => k === '=' ? { k: 'ctx', t: lb[j].t, p: lb[j].p } : k === '-' ? { k: 'del', t: la[i].t, p: la[i].p } : { k: 'add', t: lb[j].t, p: lb[j].p });
      const add = rows.filter(r => r.k === 'add').length, del = rows.filter(r => r.k === 'del').length;
      ctx.result = { diff: rows, add, del, a: A.name, b: B.name, title: add + del ? `${add + del} changed line${add + del > 1 ? 's' : ''} found` : 'No differences found' };
      const report = [`Comparison`, `Original: ${A.name}`, `Changed:  ${B.name}`, `${add} lines added, ${del} lines removed`, '', ...rows.filter(r => r.k !== 'ctx').map(r => `${r.k === 'add' ? '+' : '-'} [p${r.p}] ${r.t}`)].join('\n');
      return [{ name: 'fileora-comparison.txt', blob: new Blob([report], { type: 'text/plain' }), note: `${add} added, ${del} removed` }];
    } });

  /* ---------------- ID cards (Aadhaar, voter ID, PAN, licence) ---------------- */
  const CARD_MM = [85.6, 53.98];
  async function cardSource(ws) {
    const it = ws.items.find(i => !i.err);
    if (!it) throw new UserError('Add the card first.');
    if (it.kind === 'pdf') {
      let pdf;
      try { pdf = await pdfjsDoc(it.file, ws.opts.pw); }
      catch (e) {
        if (e && e.name === 'PasswordException') throw new UserError(ws.opts.pw ? 'That password doesn’t open this PDF. Check capital letters and the year.' : 'This PDF is password-protected. Type its password in the options to see it.');
        throw e;
      }
      const n = clamp(Math.round(+ws.opts.page || 1), 1, pdf.numPages);
      const page = await pdf.getPage(n);
      const c = await renderPage(page, 2400 / page.getViewport({ scale: 1 }).width);
      page.cleanup(); await pdf.destroy();
      return { canvas: c, info: { pdf: true } };
    }
    return { canvas: await imageCanvas(it.file, 3200, '#fff'), info: { pdf: false } };
  }
  function cardRects(ws, src, aadhaar) {
    const ratio = CARD_MM[0] / CARD_MM[1];
    if (src.info && src.info.pdf && aadhaar) {
      /* e-Aadhaar: the cut-out card is in the lower part of page 1, front left and back right. Adjust if needed. */
      return [{ id: 'front', label: 'Front', x: .05, y: .66, w: .43, h: .43 / ratio * src.w / src.h, ratio }, { id: 'back', label: 'Back', x: .52, y: .66, w: .43, h: .43 / ratio * src.w / src.h, ratio }];
    }
    if (ws.items.length >= 2) return [{ id: 'front', label: 'Front', x: .02, y: .02, w: .96, h: .96, ratio }];
    return [{ id: 'front', label: 'Front', x: .05, y: .08, w: .42, h: .42 / ratio * src.w / src.h, ratio }, { id: 'back', label: 'Back', x: .53, y: .08, w: .42, h: .42 / ratio * src.w / src.h, ratio }];
  }
  /* two separate pictures (front and back) don't need boxes */
  const twoImages = ws => ws.items.filter(i => !i.err).length >= 2 && ws.items.every(i => i.kind === 'image');
  async function cardRun(items, o, ctx, aadhaar) {
    const { PDFDocument, rgb } = await lib('pdflib');
    let faces = [];
    if (twoImages(ctx.ws)) {
      ctx.progress(.1, 'Reading the pictures');
      for (const it of items.slice(0, 2)) faces.push(await imageCanvas(it.file, 2400, '#fff'));
    } else {
      const src = ctx.source && ctx.source.canvas;
      if (!src) throw new UserError('The preview isn’t ready yet. Please wait a moment.');
      const rects = (ctx.regions || []).filter(r => r.w > 0 && r.h > 0);
      if (!rects.length) throw new UserError('Mark the card on the picture first.');
      const pxW = 1012; /* 300 dpi at 85.6 mm */
      faces = rects.slice(0, 2).map(r => cropCanvas(src, r, pxW, Math.round(pxW / (CARD_MM[0] / CARD_MM[1]))));
    }
    ctx.progress(.5, 'Placing the card at real size');
    const doc = await PDFDocument.create();
    let [pw, ph] = PAGE[o.paper] || PAGE.a4;
    const page = doc.addPage([pw, ph]);
    const cw = CARD_MM[0] * MM, ch = CARD_MM[1] * MM, gap = 8 * MM, top = 16 * MM;
    const imgs = [];
    for (const f of faces) imgs.push(await embedCanvas(doc, f, false, .92));
    const rows = clamp(+o.copies || 1, 1, 4);
    const side = o.layout === 'side' && imgs.length > 1;
    const blockW = side ? cw * 2 + gap : cw, blockH = side ? ch : imgs.length * ch + (imgs.length - 1) * gap;
    const x0 = (pw - blockW) / 2;
    for (let r = 0; r < rows; r++) {
      const y0 = ph - top - r * (blockH + gap * 1.6) - blockH;
      if (y0 < 10 * MM) break;
      imgs.forEach((img, k) => {
        const x = side ? x0 + k * (cw + gap) : x0, y = side ? y0 : y0 + (imgs.length - 1 - k) * (ch + gap);
        page.drawImage(img, { x, y, width: cw, height: ch });
        if (o.cut) page.drawRectangle({ x: x - .6, y: y - .6, width: cw + 1.2, height: ch + 1.2, borderColor: rgb(.55, .57, .65), borderWidth: .6, borderDashArray: [3, 2] });
      });
    }
    ctx.progress(.9, 'Saving');
    const name = (aadhaar ? 'aadhaar' : 'id-card') + '-print.pdf';
    return [pdfOut(name, await savePdf(doc), `${imgs.length === 2 ? 'Front and back' : 'One side'} at ${CARD_MM[0]} × ${CARD_MM[1]} mm on ${o.paper === 'letter' ? 'US Letter' : 'A4'}. Print at 100% (actual size).`)];
  }
  const cardOpts = aadhaar => [
    { id: 'pw', type: 'password', label: aadhaar ? 'e-Aadhaar password' : 'PDF password', value: '', placeholder: aadhaar ? 'For example: RAHU1990' : 'Only if the PDF has one',
      help: aadhaar ? 'The e-Aadhaar password is the first 4 letters of your name in CAPITALS followed by your year of birth.' : 'Needed only for password-protected PDFs.' },
    { id: 'page', type: 'number', label: 'Page with the card', value: 1, min: 1, max: 50, show: () => true },
    { id: 'layout', type: 'seg', label: 'Layout', value: 'side', choices: [['side', 'Side by side'], ['stack', 'One above the other']] },
    { id: 'copies', type: 'seg', label: 'Copies on the page', value: '1', choices: [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']] },
    { id: 'paper', type: 'seg', label: 'Paper', value: 'a4', choices: [['a4', 'A4'], ['letter', 'US Letter']] },
    { id: 'cut', type: 'toggle', label: 'Dashed cutting lines', value: true }
  ];
  for (const aadhaar of [true, false]) {
    R({ id: aadhaar ? 'aadhaar' : 'idcard', accept: 'pdfimage', multi: true, max: 2, passwords: true, reloadOn: ['pw', 'page'],
      cta: 'Create print page', verb: 'Preparing the print page', dropText: aadhaar ? 'your e-Aadhaar PDF' : 'your card',
      tip: aadhaar ? 'Add your e-Aadhaar PDF (or photos of the front and back). Move the two boxes over the front and back of the card, then create the print page.' : 'Add a PDF or photo with both sides, or two photos (front, then back). Move the boxes over each side of the card.',
      opts: cardOpts(aadhaar),
      regions: { source: cardSource, rects: (ws, src) => cardRects(ws, src, aadhaar), skip: twoImages, skipNote: 'The first picture is the front, the second the back. Each fills the whole card.' },
      validate: (o, items) => items.length > 1 && items.some(i => i.kind === 'pdf') ? 'Use one PDF, or two photos (front and back).' : '',
      run: (items, o, ctx) => cardRun(items, o, ctx, aadhaar) });
  }

  /* ---------------- page layout ---------------- */
  R({ id: 'interleave', accept: 'pdf', multi: true, min: 2, max: 2, slots: ['Front sides (pages 1, 3, 5…)', 'Back sides (pages 2, 4, 6…)'], cta: 'Interleave pages', verb: 'Shuffling the pages together',
    tip: 'For double-sided paper scanned in two passes: first the fronts, then the backs.',
    opts: [{ id: 'reverse', type: 'toggle', label: 'The back sides are in reverse order', value: true, help: 'Usual when you turn the whole stack over to scan the backs.' }],
    async run(items, o, ctx) {
      const { PDFDocument } = await lib('pdflib');
      const A = await loadPdf(items[0]), B = await loadPdf(items[1]);
      const na = A.getPageCount(), nb = B.getPageCount();
      const out = await PDFDocument.create();
      const pa = await out.copyPages(A, A.getPageIndices());
      let bi = B.getPageIndices(); if (o.reverse) bi = bi.reverse();
      const pb = await out.copyPages(B, bi);
      for (let i = 0; i < Math.max(na, nb); i++) { if (pa[i]) out.addPage(pa[i]); if (pb[i]) out.addPage(pb[i]); }
      ctx.progress(.9, 'Saving');
      return [pdfOut(tagName(items[0].name, '-interleaved', 'pdf'), await savePdf(out), `${out.getPageCount()} pages${na !== nb ? ` (the files had ${na} and ${nb} pages, so the extra pages are at the end)` : ''}`)];
    } });

  R({ id: 'splithalf', accept: 'pdf', cta: 'Split pages', verb: 'Cutting the pages',
    opts: [
      { id: 'dir', type: 'seg', label: 'Cut', value: 'v', choices: [['v', 'Down the middle'], ['h', 'Across the middle']] },
      { id: 'rtl', type: 'toggle', label: 'Right page first (Arabic, Urdu, Japanese books)', value: false, show: o => o.dir === 'v' },
      { id: 'skipFirst', type: 'toggle', label: 'Keep the first page whole (cover)', value: false },
      { id: 'skipLast', type: 'toggle', label: 'Keep the last page whole (back cover)', value: false }
    ],
    overlay: (it, o) => `<div class="fo-cutline ${o.dir === 'h' ? 'h' : 'v'}"></div>`,
    async run(items, o, ctx) {
      const { PDFDocument } = await lib('pdflib');
      const src = await loadPdf(items[0]), n = src.getPageCount();
      const out = await PDFDocument.create();
      for (let i = 0; i < n; i++) {
        ctx.progress(i / n, `Page ${i + 1} of ${n}`);
        const whole = (o.skipFirst && i === 0) || (o.skipLast && i === n - 1 && n > 1);
        if (whole) { const [p] = await out.copyPages(src, [i]); out.addPage(p); continue; }
        const [p1, p2] = await out.copyPages(src, [i, i]);
        const V = vis(p1);
        let halves = o.dir === 'h' ? [[0, V.H / 2, V.W, V.H], [0, 0, V.W, V.H / 2]] : [[0, 0, V.W / 2, V.H], [V.W / 2, 0, V.W, V.H]];
        if (o.dir === 'v' && o.rtl) halves = halves.reverse();
        [p1, p2].forEach((p, k) => {
          const r = visRect(vis(p), ...halves[k]);
          p.setMediaBox(r.x, r.y, r.width, r.height); p.setCropBox(r.x, r.y, r.width, r.height);
          out.addPage(p);
        });
      }
      ctx.progress(.95, 'Saving');
      return [pdfOut(tagName(items[0].name, '-split-pages', 'pdf'), await savePdf(out), `${n} pages became ${out.getPageCount()}`)];
    } });

  R({ id: 'removeblank', accept: 'pdf', cta: 'Remove blank pages', verb: 'Looking for blank pages',
    opts: [{ id: 'sens', type: 'seg', label: 'Count a page as blank when it is', value: 'normal', choices: [['strict', 'Completely empty'], ['normal', 'Almost empty'], ['loose', 'Mostly empty']], help: o => ({ strict: 'Only pages with no marks at all.', normal: 'Also pages with a little scanner noise or a page number.', loose: 'Also pages with a few short lines. Check the result.' }[o.sens]) }],
    async run(items, o, ctx) {
      const { PDFDocument } = await lib('pdflib');
      const limit = { strict: .0004, normal: .003, loose: .012 }[o.sens] || .003;
      const pdf = await pdfjsDoc(items[0].file), n = pdf.numPages, keep = [], removed = [];
      for (let i = 1; i <= n; i++) {
        ctx.progress((i - 1) / n * .85, `Checking page ${i} of ${n}`);
        const page = await pdf.getPage(i);
        const c = await renderPage(page, 60 / 72, { read: true });
        const g = c.getContext('2d', { willReadFrequently: true });
        const bx = Math.round(c.width * .03), by = Math.round(c.height * .03);
        const d = g.getImageData(bx, by, Math.max(1, c.width - bx * 2), Math.max(1, c.height - by * 2)).data;
        let ink = 0;
        for (let k = 0; k < d.length; k += 4) if (d[k] * .299 + d[k + 1] * .587 + d[k + 2] * .114 < 215) ink++;
        (ink / (d.length / 4) <= limit ? removed : keep).push(i - 1);
        c.width = c.height = 0; page.cleanup();
      }
      await pdf.destroy();
      if (!removed.length) throw new UserError('No blank pages found. Try “Mostly empty” if you expected some.');
      if (!keep.length) throw new UserError('Every page looks blank, so nothing was removed. Try “Completely empty”.');
      const src = await loadPdf(items[0]), out = await PDFDocument.create();
      (await out.copyPages(src, keep)).forEach(p => out.addPage(p));
      ctx.progress(.95, 'Saving');
      const list = removed.map(i => i + 1);
      return [pdfOut(tagName(items[0].name, '-no-blank-pages', 'pdf'), await savePdf(out), `Removed ${removed.length} of ${n} pages (page${list.length > 1 ? 's' : ''} ${list.slice(0, 12).join(', ')}${list.length > 12 ? '…' : ''})`)];
    } });

  R({ id: 'nup', accept: 'pdf', cta: 'Arrange pages', verb: 'Arranging pages',
    opts: [
      { id: 'n', type: 'seg', label: 'Pages per sheet', value: '2', choices: [['2', '2'], ['4', '4'], ['6', '6'], ['9', '9']] },
      { id: 'paper', type: 'seg', label: 'Sheet', value: 'a4', choices: [['a4', 'A4'], ['letter', 'US Letter'], ['a3', 'A3']] },
      { id: 'border', type: 'toggle', label: 'Thin border around each page', value: true },
      { id: 'order', type: 'seg', label: 'Order', value: 'row', choices: [['row', 'Across, then down'], ['col', 'Down, then across']] }
    ],
    async run(items, o, ctx) {
      const { PDFDocument, rgb, degrees } = await lib('pdflib');
      const bytes = await items[0].file.arrayBuffer();
      const src = await loadPdf(items[0]);
      const n = +o.n, total = src.getPageCount();
      const out = await PDFDocument.create();
      const embedded = await out.embedPdf(bytes, src.getPageIndices());
      const first = src.getPage(0), fv = vis(first);
      const landscapeSrc = fv.W > fv.H;
      const grid = { 2: [2, 1], 4: [2, 2], 6: [3, 2], 9: [3, 3] }[n];
      let [cols, rows] = grid;
      let [pw, ph] = PAGE[o.paper] || PAGE.a4;
      const sheetLand = (n === 2 || n === 6) ? !landscapeSrc : landscapeSrc;
      if (sheetLand) [pw, ph] = [ph, pw];
      if (n === 2 && landscapeSrc) [cols, rows] = [1, 2];
      if (n === 6 && landscapeSrc) [cols, rows] = [2, 3];
      const m = 18, gap = 10, cw = (pw - 2 * m - (cols - 1) * gap) / cols, chh = (ph - 2 * m - (rows - 1) * gap) / rows;
      for (let s = 0; s < total; s += n) {
        ctx.progress(s / total, `Sheet ${s / n + 1} of ${Math.ceil(total / n)}`);
        const sheet = out.addPage([pw, ph]);
        for (let k = 0; k < n && s + k < total; k++) {
          const ep = embedded[s + k], V = vis(src.getPage(s + k));
          const col = o.order === 'col' ? Math.floor(k / rows) : k % cols, row = o.order === 'col' ? k % rows : Math.floor(k / cols);
          const sc = Math.min(cw / V.W, chh / V.H), w = V.W * sc, h = V.H * sc;
          const x = m + col * (cw + gap) + (cw - w) / 2, y = ph - m - (row + 1) * chh - row * gap + (chh - h) / 2;
          drawRotated(sheet, ep, V, x, y, w, h, degrees);
          if (o.border) sheet.drawRectangle({ x, y, width: w, height: h, borderColor: rgb(.75, .76, .82), borderWidth: .5 });
        }
      }
      ctx.progress(.95, 'Saving');
      return [pdfOut(baseName(items[0].name) + `-${n}-up.pdf`, await savePdf(out), `${total} pages on ${out.getPageCount()} sheet${out.getPageCount() > 1 ? 's' : ''}`)];
    } });

  R({ id: 'booklet', accept: 'pdf', cta: 'Make booklet', verb: 'Arranging the booklet',
    tip: 'Print the result double-sided, flipping on the short edge, then fold the stack in half.',
    opts: [
      { id: 'paper', type: 'seg', label: 'Print on', value: 'a4', choices: [['a4', 'A4 (pages shrink to A5)'], ['letter', 'US Letter'], ['double', 'Twice the page size']] },
      { id: 'rtl', type: 'toggle', label: 'Right-to-left booklet', value: false }
    ],
    async run(items, o, ctx) {
      const { PDFDocument, degrees } = await lib('pdflib');
      const bytes = await items[0].file.arrayBuffer();
      const src = await loadPdf(items[0]);
      const n0 = src.getPageCount(), n = Math.ceil(n0 / 4) * 4;
      const out = await PDFDocument.create();
      const emb = await out.embedPdf(bytes, src.getPageIndices());
      const V0 = vis(src.getPage(0));
      let pw, ph;
      if (o.paper === 'double') { pw = V0.W * 2; ph = V0.H; } else { [ph, pw] = PAGE[o.paper] || PAGE.a4; }
      const half = pw / 2;
      const put = (sheet, idx, left) => {
        if (idx >= n0) return;
        const V = vis(src.getPage(idx)), sc = Math.min(half / V.W, ph / V.H), w = V.W * sc, h = V.H * sc;
        drawRotated(sheet, emb[idx], V, (left ? 0 : half) + (half - w) / 2, (ph - h) / 2, w, h, degrees);
      };
      for (let i = 0; i < n / 4; i++) {
        ctx.progress(i / (n / 4), `Sheet ${i + 1} of ${n / 4}`);
        let front = [n - 1 - 2 * i, 2 * i], back = [2 * i + 1, n - 2 - 2 * i];
        if (o.rtl) { front = front.reverse(); back = back.reverse(); }
        const f = out.addPage([pw, ph]); put(f, front[0], true); put(f, front[1], false);
        const b = out.addPage([pw, ph]); put(b, back[0], true); put(b, back[1], false);
      }
      ctx.progress(.95, 'Saving');
      return [pdfOut(tagName(items[0].name, '-booklet', 'pdf'), await savePdf(out), `${n0} pages on ${n / 4} sheet${n / 4 > 1 ? 's' : ''}${n > n0 ? `, ${n - n0} blank page${n - n0 > 1 ? 's' : ''} added at the end` : ''}`)];
    } });

  /* ---------------- stamping text ---------------- */
  const placeText = (V, tw, size, pos, m) => ({ u: pos[1] === 'l' ? m : pos[1] === 'c' ? (V.W - tw) / 2 : V.W - m - tw, v: pos[0] === 't' ? V.H - m - size * .72 : m });
  const batesLabel = (o, n) => `${o.prefix || ''}${String(n).padStart(clamp(+o.digits || 6, 1, 12), '0')}${o.suffix || ''}`;
  R({ id: 'bates', accept: 'pdf', multi: true, ordered: true, cta: 'Add Bates numbers', verb: 'Numbering',
    tip: 'Numbers continue from one file to the next, in the order shown.',
    opts: [
      { id: 'prefix', type: 'text', label: 'Prefix', value: 'ABC-', placeholder: 'For example: SMITH-' },
      { id: 'start', type: 'number', label: 'First number', value: 1, min: 0, max: 99999999 },
      { id: 'digits', type: 'number', label: 'Digits', value: 6, min: 1, max: 12, help: '6 digits gives 000001.' },
      { id: 'suffix', type: 'text', label: 'Suffix', value: '', placeholder: 'Optional' },
      { id: 'pos', type: 'pos', label: 'Position', value: 'br', cells: ['tl', 'tc', 'tr', 'bl', 'bc', 'br'] },
      { id: 'fsize', type: 'range', label: 'Text size', value: 10, min: 7, max: 18, step: 1, suffix: 'pt' }
    ],
    overlay(it, o) {
      const W = it.pw, H = it.ph, m = 22, size = +o.fsize;
      const v = o.pos[0] === 't' ? `top:${pc(m, H)}` : `bottom:${pc(m, H)}`;
      const u = o.pos[1] === 'l' ? `left:${pc(m, W)}` : o.pos[1] === 'r' ? `right:${pc(m, W)}` : 'left:50%;transform:translateX(-50%)';
      return `<span class="fo-pn" style="${v};${u};font-size:${(size / W * 100).toFixed(3)}cqw;font-weight:700">${esc(batesLabel(o, Math.floor(+o.start || 0)))}</span>`;
    },
    async run(items, o, ctx) {
      const { StandardFonts, rgb, degrees } = await lib('pdflib');
      let n = Math.floor(+o.start || 0);
      const first = n, outs = [];
      for (let f = 0; f < items.length; f++) {
        ctx.progress(f / items.length, `Numbering ${items[f].name}`);
        const doc = await loadPdf(items[f]);
        const font = await doc.embedFont(StandardFonts.HelveticaBold);
        const size = +o.fsize, startHere = n;
        for (const p of doc.getPages()) {
          const label = batesLabel(o, n++), V = vis(p), tw = font.widthOfTextAtSize(label, size);
          const { u, v } = placeText(V, tw, size, o.pos, 22);
          const pt = V.map(u, v);
          p.drawText(label, { x: pt.x, y: pt.y, size, font, color: rgb(0, 0, 0), rotate: degrees(V.r) });
        }
        outs.push(pdfOut(tagName(items[f].name, '-bates', 'pdf'), await savePdf(doc), `${batesLabel(o, startHere)} to ${batesLabel(o, n - 1)}`));
      }
      if (outs.length > 1) outs[0].note += ` (all files: ${batesLabel(o, first)} to ${batesLabel(o, n - 1)})`;
      return outs;
    } });

  const fillTokens = (s, ctx) => String(s || '').replace(/\{page\}/gi, ctx.page).replace(/\{pages\}/gi, ctx.pages).replace(/\{date\}/gi, ctx.date).replace(/\{file\}/gi, ctx.file);
  R({ id: 'headerfooter', accept: 'pdf', multi: true, cta: 'Add header and footer', verb: 'Adding text',
    opts: [
      { id: 'header', type: 'text', label: 'Header', value: '{file}', placeholder: 'Leave empty for none' },
      { id: 'halign', type: 'seg', label: 'Header position', value: 'l', choices: [['l', 'Left'], ['c', 'Centre'], ['r', 'Right']] },
      { id: 'footer', type: 'text', label: 'Footer', value: 'Page {page} of {pages}', placeholder: 'Leave empty for none' },
      { id: 'falign', type: 'seg', label: 'Footer position', value: 'c', choices: [['l', 'Left'], ['c', 'Centre'], ['r', 'Right']] },
      { id: 'tokens', type: 'note', text: 'You can use {page}, {pages}, {date} and {file} in the text.' },
      { id: 'fsize', type: 'range', label: 'Text size', value: 9, min: 6, max: 16, step: 1, suffix: 'pt' },
      { id: 'skipFirst', type: 'toggle', label: 'Skip the first page', value: false }
    ],
    validate: o => String(o.header || '').trim() || String(o.footer || '').trim() ? '' : 'Type a header or a footer.',
    overlay(it, o) {
      const W = it.pw, H = it.ph, m = 24, size = +o.fsize, c = { page: 1, pages: it.pages || 1, date: dateText(), file: baseName(it.name) };
      const span = (txt, top, al) => txt ? `<span class="fo-pn" style="${top ? `top:${pc(m - size * .2, H)}` : `bottom:${pc(m, H)}`};${al === 'l' ? `left:${pc(m, W)}` : al === 'r' ? `right:${pc(m, W)}` : 'left:50%;transform:translateX(-50%)'};font-size:${(size / W * 100).toFixed(3)}cqw">${esc(fillTokens(txt, c))}</span>` : '';
      return o.skipFirst ? '' : span(o.header, true, o.halign) + span(o.footer, false, o.falign);
    },
    async run(items, o, ctx) {
      const { StandardFonts, rgb, degrees } = await lib('pdflib');
      const outs = [];
      for (let f = 0; f < items.length; f++) {
        ctx.progress(f / items.length, `Adding text to ${items[f].name}`);
        const doc = await loadPdf(items[f]);
        const font = await doc.embedFont(StandardFonts.Helvetica);
        const pages = doc.getPages(), size = +o.fsize, date = dateText();
        const safe = s => s.replace(/[^\x20-\x7E -ÿ]/g, '?');
        pages.forEach((p, i) => {
          if (o.skipFirst && i === 0) return;
          const c = { page: i + 1, pages: pages.length, date, file: baseName(items[f].name) }, V = vis(p);
          [[o.header, 't', o.halign], [o.footer, 'b', o.falign]].forEach(([txt, row, al]) => {
            const label = safe(fillTokens(txt, c).trim()); if (!label) return;
            const tw = font.widthOfTextAtSize(label, size), { u, v } = placeText(V, tw, size, row + al, 24);
            const pt = V.map(u, v);
            p.drawText(label, { x: pt.x, y: pt.y, size, font, color: rgb(.2, .21, .3), rotate: degrees(V.r) });
          });
        });
        outs.push(pdfOut(tagName(items[f].name, '-header-footer', 'pdf'), await savePdf(doc)));
      }
      return outs;
    } });

  /* ---------------- metadata, flatten ---------------- */
  const META = [['title', 'Title'], ['author', 'Author'], ['subject', 'Subject'], ['keywords', 'Keywords'], ['creator', 'Created with'], ['producer', 'PDF producer']];
  R({ id: 'metadata', accept: 'pdf', cta: 'Save PDF', verb: 'Saving',
    tip: 'Shows the details stored inside the PDF. Change them, or remove them all before sharing.',
    opts: [
      { id: 'mode', type: 'seg', label: 'What to do', value: 'edit', choices: [['edit', 'Edit details'], ['clear', 'Remove all details']] },
      ...META.map(([k, l]) => ({ id: k, type: 'text', label: l, value: '', show: o => o.mode === 'edit' })),
      { id: 'clearnote', type: 'note', text: 'Removes the title, author, subject, keywords, software names, dates and XMP metadata. The pages don’t change.', show: o => o.mode === 'clear' }
    ],
    async onItems(ws) {
      const it = ws.items[0]; if (!it || it.err) return;
      try {
        const doc = await loadPdf(it, { updateMetadata: false });
        const kw = doc.getKeywords();
        ws.setOpts({ title: doc.getTitle() || '', author: doc.getAuthor() || '', subject: doc.getSubject() || '', keywords: Array.isArray(kw) ? kw.join(', ') : (kw || ''), creator: doc.getCreator() || '', producer: doc.getProducer() || '' });
      } catch (e) { /* shown when running */ }
    },
    async run(items, o, ctx) {
      const { PDFName } = await lib('pdflib');
      const doc = await loadPdf(items[0], { updateMetadata: false });
      if (o.mode === 'clear') {
        const info = doc.getInfoDict();
        ['Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer', 'CreationDate', 'ModDate', 'Trapped'].forEach(k => info.delete(PDFName.of(k)));
        doc.catalog.delete(PDFName.of('Metadata'));
      } else {
        doc.setTitle(o.title || ''); doc.setAuthor(o.author || ''); doc.setSubject(o.subject || '');
        doc.setKeywords(String(o.keywords || '').split(',').map(s => s.trim()).filter(Boolean));
        doc.setCreator(o.creator || ''); doc.setProducer(o.producer || ''); doc.setModificationDate(new Date());
      }
      ctx.progress(.9, 'Saving');
      return [pdfOut(baseName(items[0].name) + (o.mode === 'clear' ? '-clean.pdf' : '.pdf'), await doc.save(), o.mode === 'clear' ? 'All document details removed' : 'Details updated')];
    } });

  R({ id: 'flatten', accept: 'pdf', multi: true, cta: 'Flatten PDF', verb: 'Flattening',
    opts: [
      { id: 'mode', type: 'seg', label: 'Flatten', value: 'forms', choices: [['forms', 'Form fields'], ['all', 'Everything']], help: o => o.mode === 'forms' ? 'Turns filled-in fields into normal page content. Text stays selectable.' : 'Turns every page into an image, including comments and stamps. Text is no longer selectable.' },
      { id: 'dpi', type: 'seg', label: 'Quality', value: '150', choices: [['110', 'Smaller'], ['150', 'Balanced'], ['220', 'Sharp']], show: o => o.mode === 'all' }
    ],
    async run(items, o, ctx) {
      const outs = [];
      for (let f = 0; f < items.length; f++) {
        const it = items[f], prog = (x, l) => ctx.progress((f + x) / items.length, `${items.length > 1 ? it.name + ': ' : ''}${l}`);
        if (o.mode === 'all') { outs.push(pdfOut(tagName(it.name, '-flat', 'pdf'), await rasterize(it.file, +o.dpi, .86, prog), 'Every page is now an image')); continue; }
        prog(.2, 'Locking the fields');
        const doc = await loadPdf(it);
        const form = doc.getForm(), n = form.getFields().length;
        if (!n) throw new UserError(`${it.name} has no form fields. Use “Everything” to flatten comments and stamps.`);
        try { form.updateFieldAppearances(); } catch (e) { /* keep existing appearances */ }
        try { form.flatten(); } catch (e) { throw new UserError(`The form in ${it.name} couldn’t be flattened this way. Try “Everything”.`); }
        outs.push(pdfOut(tagName(it.name, '-flat', 'pdf'), await savePdf(doc), `${n} field${n > 1 ? 's' : ''} locked`));
      }
      return outs;
    } });

  /* ---------------- images from PDFs ---------------- */
  R({ id: 'extractimg', accept: 'pdf', cta: 'Extract images', verb: 'Finding images',
    opts: [
      { id: 'format', type: 'seg', label: 'Save as', value: 'png', choices: [['png', 'PNG (exact)'], ['jpg', 'JPG (smaller)']] },
      { id: 'min', type: 'seg', label: 'Skip images smaller than', value: '64', choices: [['16', '16 px'], ['64', '64 px'], ['200', '200 px']] }
    ],
    async run(items, o, ctx) {
      const pdfjs = await lib('pdfjs');
      const pdf = await pdfjsDoc(items[0].file), n = pdf.numPages, b = baseName(items[0].name), outs = [], seen = new Set();
      const ops = [pdfjs.OPS.paintImageXObject, pdfjs.OPS.paintImageXObjectRepeat, pdfjs.OPS.paintJpegXObject].filter(x => x !== undefined);
      const getObj = (page, name) => new Promise(res => { const store = name.startsWith('g_') ? page.commonObjs : page.objs; try { store.get(name, res); } catch (e) { res(null); } setTimeout(() => res(null), 8000); });
      for (let i = 1; i <= n; i++) {
        ctx.progress((i - 1) / n, `Page ${i} of ${n}`);
        const page = await pdf.getPage(i);
        const list = await page.getOperatorList();
        let k = 0;
        for (let j = 0; j < list.fnArray.length; j++) {
          if (!ops.includes(list.fnArray[j])) continue;
          const name = list.argsArray[j][0];
          if (typeof name !== 'string' || seen.has(name)) continue;
          seen.add(name);
          const img = await getObj(page, name);
          if (!img || (img.width || 0) < +o.min || (img.height || 0) < +o.min) continue;
          const c = canvasOf(img.width, img.height), g = c.getContext('2d');
          if (img.bitmap) g.drawImage(img.bitmap, 0, 0);
          else if (img.data) {
            const id = g.createImageData(img.width, img.height), dst = id.data, src = img.data;
            if (src.length === img.width * img.height * 4) dst.set(src);
            else if (src.length === img.width * img.height * 3) { for (let p = 0, q = 0; p < src.length; p += 3, q += 4) { dst[q] = src[p]; dst[q + 1] = src[p + 1]; dst[q + 2] = src[p + 2]; dst[q + 3] = 255; } }
            else if (img.kind === 1) { const rowBytes = (img.width + 7) >> 3; for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) { const bit = (src[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1, q = (y * img.width + x) * 4, v = bit ? 255 : 0; dst[q] = dst[q + 1] = dst[q + 2] = v; dst[q + 3] = 255; } }
            else continue;
            g.putImageData(id, 0, 0);
          } else continue;
          k++;
          const blob = await canvasToBlob(c, o.format === 'jpg' ? 'image/jpeg' : 'image/png', .9);
          outs.push({ name: `${b}-page${i}-image${k}.${o.format === 'jpg' ? 'jpg' : 'png'}`, blob, note: `${img.width} × ${img.height} px, ${fmtSize(blob.size)}` });
          c.width = c.height = 0;
        }
        page.cleanup();
      }
      await pdf.destroy();
      if (!outs.length) throw new UserError('No images found in this PDF (or they are all smaller than the size you chose). Scanned pages are often one image: use PDF to JPG for those.');
      return outs;
    } });

  R({ id: 'resizepages', accept: 'pdf', multi: true, cta: 'Resize pages', verb: 'Resizing pages',
    opts: [
      { id: 'size', type: 'seg', label: 'New page size', value: 'a4', choices: [['a4', 'A4'], ['letter', 'Letter'], ['a3', 'A3'], ['a5', 'A5'], ['legal', 'Legal']] },
      { id: 'orient', type: 'seg', label: 'Orientation', value: 'keep', choices: [['keep', 'Same as each page'], ['portrait', 'Portrait'], ['landscape', 'Landscape']] },
      { id: 'margin', type: 'seg', label: 'Margin', value: 'none', choices: [['none', 'None'], ['small', 'Small'], ['large', 'Large']] }
    ],
    async run(items, o, ctx) {
      const { PDFDocument, degrees } = await lib('pdflib');
      const outs = [];
      for (let f = 0; f < items.length; f++) {
        ctx.progress(f / items.length, `Resizing ${items[f].name}`);
        const bytes = await items[f].file.arrayBuffer();
        const src = await loadPdf(items[f]), out = await PDFDocument.create();
        const emb = await out.embedPdf(bytes, src.getPageIndices());
        const m = { none: 0, small: 18, large: 40 }[o.margin] || 0;
        src.getPages().forEach((p, i) => {
          const V = vis(p);
          let [pw, ph] = PAGE[o.size] || PAGE.a4;
          const land = o.orient === 'landscape' || (o.orient === 'keep' && V.W > V.H);
          if (land) [pw, ph] = [ph, pw];
          const sheet = out.addPage([pw, ph]);
          const sc = Math.min((pw - 2 * m) / V.W, (ph - 2 * m) / V.H), w = V.W * sc, h = V.H * sc;
          drawRotated(sheet, emb[i], V, (pw - w) / 2, (ph - h) / 2, w, h, degrees);
        });
        outs.push(pdfOut(`${baseName(items[f].name)}-${o.size}.pdf`, await savePdf(out), `${src.getPageCount()} pages, ${o.size.toUpperCase()}. Links and form fields are not kept.`));
      }
      return outs;
    } });

  R({ id: 'pageops', accept: 'pdf', cta: 'Save PDF', verb: 'Rearranging',
    opts: [
      { id: 'mode', type: 'seg', label: 'What to do', value: 'reverse', choices: [['reverse', 'Reverse order'], ['duplicate', 'Duplicate'], ['blank', 'Add blank pages']] },
      { id: 'copies', type: 'number', label: 'Copies of each page', value: 2, min: 2, max: 20, show: o => o.mode === 'duplicate' },
      { id: 'collate', type: 'seg', label: 'Order', value: 'each', choices: [['each', '1, 1, 2, 2, 3, 3'], ['set', '1, 2, 3, 1, 2, 3']], show: o => o.mode === 'duplicate' },
      { id: 'where', type: 'seg', label: 'Where', value: 'after', choices: [['after', 'After every page'], ['every', 'After every N pages'], ['start', 'At the start'], ['end', 'At the end']], show: o => o.mode === 'blank' },
      { id: 'every', type: 'number', label: 'Every', value: 2, min: 1, max: 999, suffix: 'pages', show: o => o.mode === 'blank' && o.where === 'every' },
      { id: 'count', type: 'number', label: 'Blank pages each time', value: 1, min: 1, max: 20, show: o => o.mode === 'blank' }
    ],
    async run(items, o, ctx) {
      const { PDFDocument } = await lib('pdflib');
      const src = await loadPdf(items[0]), n = src.getPageCount(), idx = src.getPageIndices();
      const out = await PDFDocument.create();
      const size = i => { const V = vis(src.getPage(Math.min(n - 1, Math.max(0, i)))); return [V.W, V.H]; };
      const blank = (i, k) => { for (let c = 0; c < k; c++) out.addPage(size(i)); };
      let note = '';
      if (o.mode === 'reverse') { (await out.copyPages(src, idx.reverse())).forEach(p => out.addPage(p)); note = 'Page order reversed'; }
      else if (o.mode === 'duplicate') {
        const k = clamp(+o.copies || 2, 2, 20);
        const order = o.collate === 'set' ? Array.from({ length: k }, () => idx).flat() : idx.flatMap(i => Array(k).fill(i));
        (await out.copyPages(src, order)).forEach(p => out.addPage(p)); note = `${k} copies of every page`;
      } else {
        const k = clamp(+o.count || 1, 1, 20), every = clamp(+o.every || 1, 1, 999);
        const pages = await out.copyPages(src, idx);
        if (o.where === 'start') blank(0, k);
        pages.forEach((p, i) => { out.addPage(p); if ((o.where === 'after' && i < n - 1) || (o.where === 'every' && (i + 1) % every === 0 && i < n - 1)) blank(i, k); });
        if (o.where === 'end') blank(n - 1, k);
        note = `${out.getPageCount() - n} blank page${out.getPageCount() - n === 1 ? '' : 's'} added`;
      }
      ctx.progress(.9, 'Saving');
      return [pdfOut(baseName(items[0].name) + '-' + o.mode + '.pdf', await savePdf(out), `${note}, ${out.getPageCount()} pages`)];
    } });

  /* dark mode and greyscale */
  const hueRotate180 = (r, g, b) => {
    /* standard hue-rotate(180deg) matrix */
    const m = [-0.574, 1.43, 0.144, 0.426, 0.43, 0.144, 0.426, 1.43, -0.856];
    return [m[0] * r + m[1] * g + m[2] * b, m[3] * r + m[4] * g + m[5] * b, m[6] * r + m[7] * g + m[8] * b];
  };
  R({ id: 'invert', accept: 'pdf', cta: 'Convert pages', verb: 'Converting pages',
    opts: [
      { id: 'mode', type: 'seg', label: 'Look', value: 'dark', choices: [['dark', 'Dark mode'], ['invert', 'Negative'], ['gray', 'Greyscale']], help: o => ({ dark: 'White paper becomes black and black text becomes white. Colours keep roughly their hue.', invert: 'Every colour is inverted, like a photo negative.', gray: 'Removes all colour, for cheaper printing.' }[o.mode]) },
      { id: 'dpi', type: 'seg', label: 'Quality', value: '150', choices: [['110', 'Smaller'], ['150', 'Balanced'], ['220', 'Sharp']] },
      { id: 'warn', type: 'note', text: 'Pages become images, so the text is no longer selectable.' }
    ],
    thumbStyle: o => `--fo-filter:${o.mode === 'gray' ? 'grayscale(1)' : o.mode === 'invert' ? 'invert(1)' : 'invert(1) hue-rotate(180deg)'}`,
    async run(items, o, ctx) {
      const transform = (g, w, h) => {
        const d = g.getImageData(0, 0, w, h), px = d.data;
        for (let i = 0; i < px.length; i += 4) {
          let r = px[i], gg = px[i + 1], b = px[i + 2];
          if (o.mode === 'gray') { const l = r * .299 + gg * .587 + b * .114; px[i] = px[i + 1] = px[i + 2] = l; continue; }
          r = 255 - r; gg = 255 - gg; b = 255 - b;
          if (o.mode === 'dark') [r, gg, b] = hueRotate180(r, gg, b);
          px[i] = r; px[i + 1] = gg; px[i + 2] = b;
        }
        g.putImageData(d, 0, 0);
      };
      const bytes = await rasterize(items[0].file, +o.dpi, .85, (f, l) => ctx.progress(f * .95, l), transform);
      return [pdfOut(baseName(items[0].name) + '-' + o.mode + '.pdf', bytes, { dark: 'Dark mode', invert: 'Negative', gray: 'Greyscale' }[o.mode])];
    } });

  R({ id: 'stamp', accept: 'pdf', multi: true, cta: 'Add image', verb: 'Placing the image',
    opts: [
      { id: 'image', type: 'image', label: 'Image, logo or stamp', value: null },
      { id: 'where', type: 'seg', label: 'Pages', value: 'all', choices: [['first', 'First'], ['last', 'Last'], ['all', 'All']] },
      { id: 'pos', type: 'pos', label: 'Position', value: 'br' },
      { id: 'width', type: 'range', label: 'Size', value: 22, min: 5, max: 90, step: 1, suffix: '%' },
      { id: 'opacity', type: 'range', label: 'Opacity', value: 100, min: 10, max: 100, step: 5, suffix: '%' }
    ],
    validate: o => o.image ? '' : 'Choose the image to add.',
    overlay(it, o) {
      if (!o.image) return '';
      const W = it.pw, H = it.ph, w = W * (+o.width / 100), h = w * o.image.h / o.image.w;
      const { u, v } = placeBox(W, H, w, h, o.pos, Math.min(W, H) * .05);
      return `<div class="fo-sgb fo-stampb" style="left:${pc(u, W)};bottom:${pc(v, H)};width:${pc(w, W)};height:${pc(h, H)};opacity:${+o.opacity / 100}"><img src="${o.image.url}" alt=""></div>`;
    },
    async run(items, o, ctx) {
      const { degrees } = await lib('pdflib');
      const outs = [];
      for (let f = 0; f < items.length; f++) {
        ctx.progress(f / items.length, `Adding the image to ${items[f].name}`);
        const doc = await loadPdf(items[f]);
        const img = await doc.embedPng(o.image.bytes);
        const pages = doc.getPages();
        const targets = o.where === 'first' ? [pages[0]] : o.where === 'last' ? [pages[pages.length - 1]] : pages;
        for (const p of targets) {
          const V = vis(p), w = V.W * (+o.width / 100), h = w * o.image.h / o.image.w;
          const { u, v } = placeBox(V.W, V.H, w, h, o.pos, Math.min(V.W, V.H) * .05);
          const pt = V.map(u, v);
          p.drawImage(img, { x: pt.x, y: pt.y, width: w, height: h, rotate: degrees(V.r), opacity: +o.opacity / 100 });
        }
        outs.push(pdfOut(tagName(items[f].name, '-stamped', 'pdf'), await savePdf(doc), `Added on ${targets.length} page${targets.length > 1 ? 's' : ''}`));
      }
      return outs;
    } });
})(window.FileoraEngine);
