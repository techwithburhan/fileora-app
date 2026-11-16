/* Fileora module: Image Tools (21 tools, all in the browser). */
(function (E) {
  'use strict';
  if (!E) return;
  const { esc, fmtSize, baseName, extOf, clamp, UserError, lib, libUrl, canvasToBlob, decodeImage, canvasOf, imageCanvas, Img, IMG_EXT, sameType, renameImg, cropRect, imageNote, eachImage, encodeToSize, padJpeg, cropCanvas, textWidth } = E.h;
  const R = def => E.register(def);
  const pc = (v, d) => (v / d * 100).toFixed(3) + '%';
  const COLORS = ['#FFFFFF', '#16182F', '#E0464C', '#2F6BF3', '#0E9F57', '#FFD43B'];
  const outType = (file, want) => want && want !== 'same' ? want : sameType(file);
  async function encode(c, type, q = .92) { return canvasToBlob(c, type, type === 'image/png' ? undefined : q); }
  const done = (file, c, blob, type, suffix, note) => ({ blob, name: renameImg(file.name, type, suffix), width: c.width, height: c.height, note });

  /* JPEG resolution (dots per inch) in the JFIF header, so prints come out at the right size */
  async function setJpegDpi(blob, dpi) {
    const b = new Uint8Array(await blob.arrayBuffer());
    if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF && b[3] === 0xE0 && String.fromCharCode(b[6], b[7], b[8], b[9]) === 'JFIF') {
      b[13] = 1; b[14] = dpi >> 8; b[15] = dpi & 255; b[16] = dpi >> 8; b[17] = dpi & 255;
    }
    return new Blob([b], { type: 'image/jpeg' });
  }

  /* ---------------- the basics ---------------- */
  R({ id: 'imgcompress', accept: 'image', multi: true, cta: 'Compress images', verb: 'Compressing',
    opts: [
      { id: 'quality', type: 'range', label: 'Quality', value: 72, min: 30, max: 95, step: 1, suffix: '%', help: 'Lower quality gives a smaller file. 70 to 80% looks the same to most people.' },
      { id: 'maxSide', type: 'select', label: 'Largest side', value: '0', choices: [['0', 'Keep the size'], ['3840', '3840 px (4K)'], ['2560', '2560 px'], ['1920', '1920 px (Full HD)'], ['1280', '1280 px'], ['800', '800 px']] },
      { id: 'format', type: 'seg', label: 'Save as', value: 'same', choices: [['same', 'Same type'], ['image/jpeg', 'JPG'], ['image/webp', 'WebP']] }
    ],
    run: (items, o, ctx) => eachImage(items, ctx, f => Img.compress(f, { quality: +o.quality / 100, maxSide: +o.maxSide || 0, type: o.format === 'same' ? undefined : o.format })) });

  R({ id: 'imgresize', accept: 'image', multi: true, cta: 'Resize images', verb: 'Resizing',
    opts: [
      { id: 'mode', type: 'seg', label: 'Resize by', value: 'px', choices: [['px', 'Pixels'], ['pct', 'Percentage']] },
      { id: 'width', type: 'number', label: 'Width', value: 1080, min: 1, max: 20000, suffix: 'px', show: o => o.mode === 'px' },
      { id: 'height', type: 'number', label: 'Height', value: 0, min: 0, max: 20000, suffix: 'px', help: 'Leave at 0 to keep the proportions.', show: o => o.mode === 'px' },
      { id: 'percent', type: 'range', label: 'Size', value: 50, min: 5, max: 200, step: 5, suffix: '%', show: o => o.mode === 'pct' }
    ],
    run: (items, o, ctx) => eachImage(items, ctx, f => Img.resize(f, o.mode === 'pct' ? { percent: +o.percent } : { width: +o.width || undefined, height: +o.height || undefined })) });

  R({ id: 'imgconvert', accept: 'image', multi: true, cta: 'Convert images', verb: 'Converting',
    opts: [
      { id: 'to', type: 'seg', label: 'Convert to', value: 'image/png', choices: [['image/jpeg', 'JPG'], ['image/png', 'PNG'], ['image/webp', 'WebP']] },
      { id: 'quality', type: 'range', label: 'Quality', value: 90, min: 40, max: 100, step: 1, suffix: '%', show: o => o.to !== 'image/png' }
    ],
    run: (items, o, ctx) => eachImage(items, ctx, f => Img.convert(f, o.to, { quality: +o.quality / 100 })) });

  R({ id: 'imgcrop', accept: 'image', cta: 'Crop image', verb: 'Cropping',
    opts: [
      { id: 'ratio', type: 'select', label: 'Shape', value: '1:1', choices: [['orig', 'Original shape'], ['1:1', 'Square (1:1)'], ['4:5', 'Portrait (4:5)'], ['9:16', 'Story (9:16)'], ['4:3', 'Landscape (4:3)'], ['3:2', 'Photo (3:2)'], ['16:9', 'Widescreen (16:9)']] },
      { id: 'size', type: 'range', label: 'Crop size', value: 100, min: 20, max: 100, step: 1, suffix: '%' },
      { id: 'pos', type: 'pos', label: 'Keep this part', value: 'mc' }
    ],
    overlay(it, o) {
      const r = cropRect(it.pw, it.ph, o), W = it.pw, H = it.ph;
      return `<div class="fo-cr" style="left:${pc(r.x, W)};top:${pc(r.y, H)};right:${pc(W - r.x - r.width, W)};bottom:${pc(H - r.y - r.height, H)}"></div>`;
    },
    async run(items, o, ctx) {
      const d = await decodeImage(items[0].file); const w = d.w, h = d.h; d.done();
      return eachImage(items, ctx, f => Img.crop(f, cropRect(w, h, o)));
    } });

  R({ id: 'jpg2png', accept: 'image', multi: true, cta: 'Convert to PNG', verb: 'Converting', opts: [],
    run: (items, o, ctx) => eachImage(items, ctx, f => Img.convert(f, 'image/png')) });

  R({ id: 'png2jpg', accept: 'image', multi: true, cta: 'Convert to JPG', verb: 'Converting',
    opts: [{ id: 'quality', type: 'range', label: 'Quality', value: 90, min: 40, max: 100, step: 1, suffix: '%' }],
    run: (items, o, ctx) => eachImage(items, ctx, f => Img.convert(f, 'image/jpeg', { quality: +o.quality / 100 })) });

  /* ---------------- exact sizes for online forms ---------------- */
  R({ id: 'imgkb', accept: 'image', multi: true, cta: 'Compress to size', verb: 'Finding the best quality',
    opts: [
      { id: 'target', type: 'seg', label: 'Target size', value: '50', choices: [['20', '20 KB'], ['50', '50 KB'], ['100', '100 KB'], ['200', '200 KB'], ['500', '500 KB'], ['custom', 'Other']] },
      { id: 'custom', type: 'number', label: 'Target', value: 30, min: 2, max: 20000, suffix: 'KB', show: o => o.target === 'custom' },
      { id: 'format', type: 'seg', label: 'Save as', value: 'image/jpeg', choices: [['image/jpeg', 'JPG'], ['image/webp', 'WebP']] },
      { id: 'shrink', type: 'toggle', label: 'Make the picture smaller if needed', value: true, help: 'If the lowest good quality is still too big, the width and height are reduced until it fits.' }
    ],
    async run(items, o, ctx) {
      const kb = o.target === 'custom' ? +o.custom : +o.target, max = Math.floor(kb * 1024);
      if (!(kb >= 1)) throw new UserError('Enter a target size in KB.');
      return eachImage(items, ctx, async f => {
        const c = await imageCanvas(f, 6000, '#fff');
        const r = await encodeToSize(c, max, { type: o.format, shrink: o.shrink, minQ: .2 });
        if (!r) throw new UserError(`${f.name} can’t get down to ${kb} KB${o.shrink ? '' : ' without making it smaller. Turn on “Make the picture smaller if needed”'}.`);
        return { blob: r.blob, name: renameImg(f.name, o.format, `-${kb}kb`), width: r.width, height: r.height, note: `${fmtSize(r.blob.size)} (target ${kb} KB), ${r.width} × ${r.height} px, quality ${Math.round(r.quality * 100)}%` };
      });
    } });

  const EXAM = { photo: { w: 200, h: 230, min: 20, max: 50 }, sign: { w: 140, h: 60, min: 10, max: 20 } };
  R({ id: 'examphoto', accept: 'image', cta: 'Resize for the form', verb: 'Resizing',
    tip: 'Every exam publishes its own photo and signature sizes. Check the notification and type them in if they differ from these.',
    opts: [
      { id: 'preset', type: 'seg', label: 'This is a', value: 'photo', choices: [['photo', 'Photo'], ['sign', 'Signature'], ['custom', 'Custom']] },
      { id: 'w', type: 'number', label: 'Width', value: 200, min: 20, max: 4000, suffix: 'px' },
      { id: 'h', type: 'number', label: 'Height', value: 230, min: 20, max: 4000, suffix: 'px' },
      { id: 'min', type: 'number', label: 'Smallest file size', value: 20, min: 0, max: 5000, suffix: 'KB' },
      { id: 'max', type: 'number', label: 'Largest file size', value: 50, min: 2, max: 5000, suffix: 'KB' },
      { id: 'fit', type: 'seg', label: 'Fit', value: 'crop', choices: [['crop', 'Fill (crop edges)'], ['pad', 'Fit (white edges)']] },
      { id: 'pos', type: 'pos', label: 'Keep this part', value: 'mc', show: o => o.fit === 'crop' }
    ],
    onOpt(fid, ws) {
      const map = ws.presetMap || EXAM;
      if (fid === 'preset' && map[ws.opts.preset]) { const p = map[ws.opts.preset]; ws.setOpts({ w: p.w, h: p.h, min: p.min, max: p.max }); }
    },
    /* an exam page passes its own sizes: { choices: { photo: { label, w, h, min, max }, sign: {…}, … }, tip } */
    preset(pre, ws, T) {
      const keys = Object.keys(pre.choices || {});
      if (!keys.length) return;
      ws.presetMap = pre.choices;
      T.opts = T.opts.map(f => f.id === 'preset' ? { ...f, value: keys[0], choices: keys.map(k => [k, pre.choices[k].label || k]).concat([['custom', 'Custom']]) } : f);
      const p = pre.choices[keys[0]];
      Object.assign(ws.opts, { preset: keys[0], w: p.w, h: p.h, min: p.min, max: p.max });
    },
    validate: o => +o.min >= +o.max ? 'The smallest size must be below the largest size.' : '',
    overlay(it, o) {
      if (o.fit !== 'crop') return '';
      const ratio = (+o.w || 1) / (+o.h || 1), W = it.pw, H = it.ph;
      let cw = W, ch = W / ratio; if (ch > H) { ch = H; cw = H * ratio; }
      const x = o.pos[1] === 'l' ? 0 : o.pos[1] === 'r' ? W - cw : (W - cw) / 2, y = o.pos[0] === 't' ? 0 : o.pos[0] === 'b' ? H - ch : (H - ch) / 2;
      return `<div class="fo-cr" style="left:${pc(x, W)};top:${pc(y, H)};right:${pc(W - x - cw, W)};bottom:${pc(H - y - ch, H)}"></div>`;
    },
    async run(items, o, ctx) {
      const f = items[0].file, W = Math.round(+o.w), H = Math.round(+o.h), minB = Math.floor(+o.min * 1024), maxB = Math.floor(+o.max * 1024);
      const d = await decodeImage(f);
      const c = canvasOf(W, H), g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.imageSmoothingQuality = 'high';
      if (o.fit === 'pad') { const s = Math.min(W / d.w, H / d.h), w = d.w * s, h = d.h * s; g.drawImage(d.src, (W - w) / 2, (H - h) / 2, w, h); }
      else {
        const ratio = W / H; let cw = d.w, ch = d.w / ratio; if (ch > d.h) { ch = d.h; cw = d.h * ratio; }
        const x = o.pos[1] === 'l' ? 0 : o.pos[1] === 'r' ? d.w - cw : (d.w - cw) / 2, y = o.pos[0] === 't' ? 0 : o.pos[0] === 'b' ? d.h - ch : (d.h - ch) / 2;
        g.drawImage(d.src, x, y, cw, ch, 0, 0, W, H);
      }
      d.done();
      ctx.progress(.4, 'Fitting the file size');
      const r = await encodeToSize(c, maxB, { shrink: false, minQ: .1 });
      if (!r) throw new UserError(`At ${W} × ${H} px the photo can’t be made smaller than ${o.max} KB. Increase the largest size.`);
      let blob = r.blob;
      if (blob.size < minB) {
        const best = await canvasToBlob(c, 'image/jpeg', 1);
        blob = best.size <= maxB && best.size > blob.size ? best : blob;
        blob = await padJpeg(blob, minB + 64);
      }
      return [{ name: `${baseName(f.name)}-${W}x${H}.jpg`, blob, note: `${W} × ${H} px, ${fmtSize(blob.size)} (allowed ${o.min}–${o.max} KB)`, good: true }];
    } });

  /* ---------------- passport photos ---------------- */
  const PASS = { '35x45': [35, 45], '51x51': [50.8, 50.8], '30x40': [30, 40], '25x35': [25, 35] };
  R({ id: 'passport', accept: 'image', cta: 'Make passport photos', verb: 'Making the sheet', reloadOn: ['size'],
    tip: 'Move and resize the box so the head is centred with a little space above it. Use a photo taken against a plain, light background.',
    opts: [
      { id: 'size', type: 'select', label: 'Photo size', value: '35x45', choices: [['35x45', '35 × 45 mm'], ['51x51', '2 × 2 in (51 × 51 mm)'], ['30x40', '30 × 40 mm'], ['25x35', '25 × 35 mm']] },
      { id: 'sheet', type: 'seg', label: 'Print on', value: '4x6', choices: [['4x6', '4 × 6 in photo'], ['a4', 'A4 paper'], ['single', 'Just one photo']] },
      { id: 'copies', type: 'select', label: 'Copies', value: 'max', choices: [['max', 'As many as fit'], ['2', '2'], ['4', '4'], ['6', '6'], ['8', '8'], ['12', '12']], show: o => o.sheet !== 'single' },
      { id: 'cut', type: 'toggle', label: 'Thin cutting lines', value: true, show: o => o.sheet !== 'single' }
    ],
    regions: {
      source: async ws => ({ canvas: await imageCanvas(ws.items[0].file, 2400, '#fff') }),
      rects(ws, src) {
        const [mw, mh] = PASS[ws.opts.size] || PASS['35x45'], ratio = mw / mh;
        let h = .8, w = h * ratio * src.h / src.w; if (w > .9) { w = .9; h = w / ratio * src.w / src.h; }
        return [{ id: 'photo', label: 'Photo', x: (1 - w) / 2, y: (1 - h) / 2, w, h, ratio }];
      }
    },
    async run(items, o, ctx) {
      const [mw, mh] = PASS[o.size] || PASS['35x45'], DPI = 300, px = mm => Math.round(mm / 25.4 * DPI);
      const r = (ctx.regions || [])[0]; if (!r) throw new UserError('Mark the photo area first.');
      ctx.progress(.15, 'Cropping the photo');
      const full = await imageCanvas(items[0].file, 6000, '#fff');
      const one = cropCanvas(full, r, px(mw), px(mh));
      const b = baseName(items[0].name), outs = [];
      const single = await setJpegDpi(await canvasToBlob(one, 'image/jpeg', .95), DPI);
      if (o.sheet !== 'single') {
        ctx.progress(.5, 'Placing the copies');
        const [SW, SH] = o.sheet === 'a4' ? [px(210), px(297)] : [px(152.4), px(101.6)];
        const gap = px(2), m = px(4), pw = one.width, ph = one.height;
        const cols = Math.max(1, Math.floor((SW - 2 * m + gap) / (pw + gap))), rows = Math.max(1, Math.floor((SH - 2 * m + gap) / (ph + gap)));
        const max = cols * rows, n = o.copies === 'max' ? max : Math.min(max, +o.copies);
        const sheet = canvasOf(SW, SH), g = sheet.getContext('2d');
        g.fillStyle = '#fff'; g.fillRect(0, 0, SW, SH);
        const usedCols = Math.min(cols, n), usedRows = Math.ceil(n / cols);
        const ox = Math.round((SW - (usedCols * pw + (usedCols - 1) * gap)) / 2), oy = Math.round((SH - (usedRows * ph + (usedRows - 1) * gap)) / 2);
        for (let k = 0; k < n; k++) {
          const x = ox + (k % cols) * (pw + gap), y = oy + Math.floor(k / cols) * (ph + gap);
          g.drawImage(one, x, y);
          if (o.cut) { g.strokeStyle = '#B9BCCB'; g.lineWidth = 2; g.strokeRect(x - 1, y - 1, pw + 2, ph + 2); }
        }
        const blob = await setJpegDpi(await canvasToBlob(sheet, 'image/jpeg', .95), DPI);
        outs.push({ name: `${b}-passport-${o.sheet}.jpg`, blob, note: `${n} photos of ${mw} × ${mh} mm on ${o.sheet === 'a4' ? 'A4' : '4 × 6 in'}. Print at 100% (actual size).`, good: true });
      }
      outs.push({ name: `${b}-passport-${o.size}.jpg`, blob: single, note: `One photo, ${one.width} × ${one.height} px (${mw} × ${mh} mm at 300 dpi)` });
      return outs;
    } });

  /* ---------------- HEIC ---------------- */
  R({ id: 'heic2jpg', accept: 'heic', multi: true, cta: 'Convert photos', verb: 'Converting',
    opts: [
      { id: 'to', type: 'seg', label: 'Convert to', value: 'image/jpeg', choices: [['image/jpeg', 'JPG'], ['image/png', 'PNG']] },
      { id: 'quality', type: 'range', label: 'Quality', value: 90, min: 50, max: 100, step: 1, suffix: '%', show: o => o.to === 'image/jpeg' }
    ],
    async run(items, o, ctx) {
      return eachImage(items, ctx, async f => {
        let c = null;
        try { c = await imageCanvas(f, 0, o.to === 'image/jpeg' ? '#fff' : null); } catch (e) { /* this browser can't open HEIC itself */ }
        if (!c) {
          const heic2any = await lib('heic2any');
          let res;
          try { res = await heic2any({ blob: f, toType: 'image/png' }); } catch (e) { throw new UserError(`${f.name} couldn’t be read as a HEIC photo.`); }
          const png = Array.isArray(res) ? res[0] : res;
          c = await imageCanvas(new File([png], 'x.png', { type: 'image/png' }), 0, o.to === 'image/jpeg' ? '#fff' : null);
        }
        const blob = await encode(c, o.to, +o.quality / 100);
        return done(f, c, blob, o.to, '', `${c.width} × ${c.height} px, ${fmtSize(blob.size)}`);
      });
    } });

  /* ---------------- privacy: remove EXIF / GPS ---------------- */
  function readExif(bytes) {
    const info = { exif: false, gps: false, make: '', model: '', date: '', orientation: 1 };
    if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) return info;
    let p = 2;
    while (p + 4 < bytes.length && bytes[p] === 0xFF) {
      const m = bytes[p + 1], len = (bytes[p + 2] << 8) | bytes[p + 3];
      if (m === 0xDA) break;
      if (m === 0xE1 && String.fromCharCode(...bytes.subarray(p + 4, p + 8)) === 'Exif') {
        info.exif = true;
        const t = p + 10, le = bytes[t] === 0x49;
        const u16 = o => le ? bytes[t + o] | (bytes[t + o + 1] << 8) : (bytes[t + o] << 8) | bytes[t + o + 1];
        const u32 = o => le ? (bytes[t + o] | (bytes[t + o + 1] << 8) | (bytes[t + o + 2] << 16) | (bytes[t + o + 3] << 24)) >>> 0 : ((bytes[t + o] << 24) | (bytes[t + o + 1] << 16) | (bytes[t + o + 2] << 8) | bytes[t + o + 3]) >>> 0;
        const str = (o, n) => { let s = ''; for (let i = 0; i < n && t + o + i < bytes.length; i++) { const c = bytes[t + o + i]; if (!c) break; s += String.fromCharCode(c); } return s.trim(); };
        const ifd = (off, sub) => {
          if (off + 2 > len) return;
          const n = u16(off);
          for (let i = 0; i < n; i++) {
            const e = off + 2 + i * 12, tag = u16(e), type = u16(e + 2), cnt = u32(e + 4), val = e + 8;
            const at = cnt > 4 && type === 2 ? u32(val) : val;
            if (tag === 0x8825) info.gps = true;
            else if (tag === 0x010F && type === 2) info.make = str(at, cnt);
            else if (tag === 0x0110 && type === 2) info.model = str(at, cnt);
            else if ((tag === 0x9003 || tag === 0x0132) && type === 2 && !info.date) info.date = str(at, cnt);
            else if (tag === 0x0112) info.orientation = u16(val);
            else if (tag === 0x8769 && !sub) ifd(u32(val), true);
          }
        };
        try { ifd(u32(4), false); } catch (e) { /* damaged EXIF */ }
      }
      p += 2 + len;
    }
    return info;
  }
  /* drops EXIF, XMP, IPTC/Photoshop and comment segments; keeps the colour profile */
  function stripJpeg(bytes) {
    const parts = [bytes.subarray(0, 2)];
    let p = 2;
    while (p + 4 <= bytes.length && bytes[p] === 0xFF) {
      const m = bytes[p + 1];
      if (m === 0xDA) { parts.push(bytes.subarray(p)); return new Blob(parts, { type: 'image/jpeg' }); }
      const len = (bytes[p + 2] << 8) | bytes[p + 3];
      const seg = bytes.subarray(p, p + 2 + len);
      const isIcc = m === 0xE2 && String.fromCharCode(...bytes.subarray(p + 4, p + 15)) === 'ICC_PROFILE';
      const drop = (m === 0xE1 || m === 0xED || m === 0xFE || (m >= 0xE3 && m <= 0xEF) || (m === 0xE2 && !isIcc));
      if (!drop) parts.push(seg);
      p += 2 + len;
    }
    return null;
  }
  function stripPng(bytes) {
    if (bytes[0] !== 0x89 || bytes[1] !== 0x50) return null;
    const parts = [bytes.subarray(0, 8)]; let p = 8, removed = 0;
    while (p + 12 <= bytes.length) {
      const len = ((bytes[p] << 24) | (bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3]) >>> 0;
      const type = String.fromCharCode(...bytes.subarray(p + 4, p + 8));
      const chunk = bytes.subarray(p, p + 12 + len);
      if (['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME'].includes(type)) removed++; else parts.push(chunk);
      p += 12 + len;
      if (type === 'IEND') break;
    }
    return { blob: new Blob(parts, { type: 'image/png' }), removed };
  }
  R({ id: 'exif', accept: 'image', multi: true, cta: 'Remove hidden data', verb: 'Cleaning',
    tip: 'Photos from phones often store where and when they were taken, and with which camera. This removes it without changing how the photo looks.',
    opts: [],
    async run(items, o, ctx) {
      const outs = [];
      for (let i = 0; i < items.length; i++) {
        ctx.progress(i / items.length, `Cleaning ${items[i].name}`);
        const f = items[i].file, bytes = new Uint8Array(await f.arrayBuffer()), ext = extOf(f.name);
        let blob = null, note = '';
        if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
          const info = readExif(bytes);
          const found = [info.gps ? 'GPS location' : '', info.make || info.model ? `camera (${[info.make, info.model].filter(Boolean).join(' ')})` : '', info.date ? 'date taken' : ''].filter(Boolean);
          if (info.orientation !== 1) {
            const c = await imageCanvas(f, 0, '#fff'); blob = await canvasToBlob(c, 'image/jpeg', .95);
            note = 'Rotation applied and all hidden data removed';
          } else {
            blob = stripJpeg(bytes) || await canvasToBlob(await imageCanvas(f, 0, '#fff'), 'image/jpeg', .95);
            note = info.exif ? 'Removed ' + (found.length ? found.join(', ') : 'camera data') : 'No hidden photo data found, kept clean';
          }
          outs.push({ name: baseName(f.name) + '-clean.' + (ext === 'jpeg' ? 'jpeg' : 'jpg'), blob, note, good: info.gps });
        } else if (bytes[0] === 0x89 && bytes[1] === 0x50) {
          const r = stripPng(bytes);
          outs.push({ name: baseName(f.name) + '-clean.png', blob: r.blob, note: r.removed ? `Removed ${r.removed} text or data block${r.removed > 1 ? 's' : ''}` : 'No hidden data found, kept clean' });
        } else {
          const type = f.type === 'image/webp' ? 'image/webp' : 'image/png';
          const c = await imageCanvas(f, 0); blob = await canvasToBlob(c, type, .95);
          outs.push({ name: renameImg(f.name, type, '-clean'), blob, note: 'Saved again without hidden data' });
        }
      }
      return outs;
    } });

  /* ---------------- watermark, rotate, blur ---------------- */
  R({ id: 'imgwatermark', accept: 'image', multi: true, cta: 'Add watermark', verb: 'Stamping',
    opts: [
      { id: 'text', type: 'text', label: 'Watermark text', value: '© Your name', placeholder: 'For example: © Fileora' },
      { id: 'layout', type: 'seg', label: 'Layout', value: 'one', choices: [['one', 'Once'], ['tile', 'Tiled']] },
      { id: 'pos', type: 'pos', label: 'Position', value: 'br', show: o => o.layout === 'one' },
      { id: 'size', type: 'range', label: 'Text size', value: 5, min: 2, max: 20, step: 1, suffix: '% of width' },
      { id: 'opacity', type: 'range', label: 'Opacity', value: 60, min: 10, max: 100, step: 5, suffix: '%' },
      { id: 'angle', type: 'seg', label: 'Angle', value: '0', choices: [['0', '0°'], ['-30', '−30°'], ['30', '30°']], show: o => o.layout === 'tile' },
      { id: 'color', type: 'color', label: 'Colour', value: '#FFFFFF', choices: COLORS, custom: true }
    ],
    validate: o => String(o.text || '').trim() ? '' : 'Type the watermark text.',
    overlay(it, o) {
      const text = String(o.text || '').trim(); if (!text) return '';
      const style = `font-size:${o.size}cqw;color:${o.color};opacity:${+o.opacity / 100};text-shadow:0 0 .12em rgba(0,0,0,.35)`;
      if (o.layout === 'tile') return `<div class="fo-wm-tile" style="transform:rotate(${o.angle}deg)">${Array.from({ length: 24 }, () => `<span style="${style}">${esc(text)}</span>`).join('')}</div>`;
      const v = o.pos[0] === 't' ? 'top:3%' : o.pos[0] === 'm' ? 'top:50%' : 'bottom:3%', h = o.pos[1] === 'l' ? 'left:3%' : o.pos[1] === 'c' ? 'left:50%' : 'right:3%';
      const tr = `${o.pos[1] === 'c' ? 'translateX(-50%)' : ''} ${o.pos[0] === 'm' ? 'translateY(-50%)' : ''}`;
      return `<span class="fo-wm" style="${v};${h};${style};transform:${tr}">${esc(text)}</span>`;
    },
    run: (items, o, ctx) => eachImage(items, ctx, async f => {
      const type = sameType(f), c = await imageCanvas(f, 0, type === 'image/jpeg' ? '#fff' : null), g = c.getContext('2d');
      const text = String(o.text).trim(), size = Math.max(8, c.width * +o.size / 100);
      g.font = `700 ${size}px Geist, 'Helvetica Neue', Arial, sans-serif`; g.fillStyle = o.color; g.globalAlpha = +o.opacity / 100;
      g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = size * .12; g.textBaseline = 'middle';
      const tw = g.measureText(text).width, m = c.width * .03;
      if (o.layout === 'tile') {
        g.save(); g.translate(c.width / 2, c.height / 2); g.rotate(+o.angle * Math.PI / 180);
        const sx = tw + size * 2, sy = size * 3, R2 = Math.hypot(c.width, c.height);
        for (let y = -R2, r = 0; y < R2; y += sy, r++) for (let x = -R2 + (r % 2) * sx / 2; x < R2; x += sx) g.fillText(text, x, y);
        g.restore();
      } else {
        const x = o.pos[1] === 'l' ? m : o.pos[1] === 'c' ? (c.width - tw) / 2 : c.width - m - tw;
        const y = o.pos[0] === 't' ? m + size / 2 : o.pos[0] === 'm' ? c.height / 2 : c.height - m - size / 2;
        g.fillText(text, x, y);
      }
      const blob = await encode(c, type, .92);
      return done(f, c, blob, type, '-watermarked');
    }) });

  R({ id: 'imgrotate', accept: 'image', multi: true, cta: 'Rotate images', verb: 'Rotating',
    opts: [
      { id: 'angle', type: 'seg', label: 'Rotate', value: '90', choices: [['0', 'None'], ['90', '90° right'], ['180', '180°'], ['270', '90° left']] },
      { id: 'flipH', type: 'toggle', label: 'Mirror left to right', value: false },
      { id: 'flipV', type: 'toggle', label: 'Flip upside down', value: false }
    ],
    validate: o => o.angle === '0' && !o.flipH && !o.flipV ? 'Choose a rotation or a flip.' : '',
    thumbStyle: o => `--rot:${o.angle}deg;--rs:${(+o.angle) % 180 ? .74 : 1};--sx:${o.flipH ? -1 : 1};--sy:${o.flipV ? -1 : 1}`,
    run: (items, o, ctx) => eachImage(items, ctx, async f => {
      const type = sameType(f), d = await decodeImage(f), a = +o.angle, sw = a % 180 ? d.h : d.w, sh = a % 180 ? d.w : d.h;
      const c = canvasOf(sw, sh), g = c.getContext('2d');
      if (type === 'image/jpeg') { g.fillStyle = '#fff'; g.fillRect(0, 0, sw, sh); }
      g.translate(sw / 2, sh / 2); g.rotate(a * Math.PI / 180); g.scale(o.flipH ? -1 : 1, o.flipV ? -1 : 1);
      g.drawImage(d.src, -d.w / 2, -d.h / 2); d.done();
      const blob = await encode(c, type, .95);
      return done(f, c, blob, type, '-rotated');
    }) });

  R({ id: 'imgblur', accept: 'image', cta: 'Blur the areas', verb: 'Blurring',
    tip: 'Drag on the picture to mark each area to hide: faces, number plates, addresses. Add as many as you need.',
    opts: [
      { id: 'mode', type: 'seg', label: 'Effect', value: 'pixel', choices: [['pixel', 'Pixelate'], ['blur', 'Blur'], ['black', 'Black box']] },
      { id: 'strength', type: 'range', label: 'Strength', value: 60, min: 10, max: 100, step: 5, suffix: '%', show: o => o.mode !== 'black' }
    ],
    regions: {
      multi: true,
      source: async ws => ({ canvas: await imageCanvas(ws.items[0].file, 2400) }),
      rects: () => [{ id: 'a1', x: .35, y: .3, w: .3, h: .25 }],
      after: () => '<p class="fo-plabel">Tip: the box on the picture is only an example. Move it, or remove it with its × button.</p>'
    },
    validate: (o, items, ws) => ws.regions && ws.regions.length ? '' : 'Drag on the picture to mark an area.',
    async run(items, o, ctx) {
      const f = items[0].file, type = sameType(f), c = await imageCanvas(f, 0, type === 'image/jpeg' ? '#fff' : null), g = c.getContext('2d');
      for (const r of ctx.regions) {
        const x = Math.round(r.x * c.width), y = Math.round(r.y * c.height), w = Math.max(2, Math.round(r.w * c.width)), h = Math.max(2, Math.round(r.h * c.height));
        if (o.mode === 'black') { g.fillStyle = '#000'; g.fillRect(x, y, w, h); continue; }
        const k = Math.max(2, Math.round(Math.min(w, h) * (+o.strength / 100) / (o.mode === 'pixel' ? 6 : 4)));
        const sw = Math.max(1, Math.round(w / k)), sh = Math.max(1, Math.round(h / k));
        const t = canvasOf(sw, sh), tg = t.getContext('2d');
        tg.imageSmoothingEnabled = o.mode !== 'pixel'; tg.imageSmoothingQuality = 'high';
        tg.drawImage(c, x, y, w, h, 0, 0, sw, sh);
        if (o.mode === 'blur') { const t2 = canvasOf(Math.max(1, sw / 2), Math.max(1, sh / 2)); t2.getContext('2d').drawImage(t, 0, 0, t2.width, t2.height); tg.clearRect(0, 0, sw, sh); tg.drawImage(t2, 0, 0, sw, sh); }
        g.save(); g.imageSmoothingEnabled = o.mode !== 'pixel'; g.imageSmoothingQuality = 'high';
        g.drawImage(t, 0, 0, sw, sh, x, y, w, h); g.restore();
      }
      const blob = await encode(c, type, .92);
      return [{ name: renameImg(f.name, type, '-hidden'), blob, note: `${ctx.regions.length} area${ctx.regions.length > 1 ? 's' : ''} hidden, ${c.width} × ${c.height} px` }];
    } });

  /* ---------------- combine images ---------------- */
  R({ id: 'collage', accept: 'image', multi: true, min: 2, max: 12, ordered: true, cta: 'Combine images', verb: 'Combining',
    tip: 'Drag the pictures to change their order.',
    opts: [
      { id: 'layout', type: 'seg', label: 'Layout', value: 'row', choices: [['row', 'Side by side'], ['col', 'One above another'], ['grid', 'Grid']] },
      { id: 'cover', type: 'toggle', label: 'Crop to fill each grid cell', value: true, show: o => o.layout === 'grid' },
      { id: 'gap', type: 'range', label: 'Spacing', value: 12, min: 0, max: 80, step: 2, suffix: 'px' },
      { id: 'bg', type: 'color', label: 'Background', value: '#FFFFFF', choices: COLORS, custom: true },
      { id: 'size', type: 'select', label: 'Picture size', value: '1200', choices: [['800', 'Small (800 px)'], ['1200', 'Medium (1200 px)'], ['2000', 'Large (2000 px)']] },
      { id: 'format', type: 'seg', label: 'Save as', value: 'image/jpeg', choices: [['image/jpeg', 'JPG'], ['image/png', 'PNG']] }
    ],
    async run(items, o, ctx) {
      const ims = [];
      for (let i = 0; i < items.length; i++) { ctx.progress(i / items.length * .6, `Reading picture ${i + 1}`); ims.push(await decodeImage(items[i].file)); }
      const gap = +o.gap, S = +o.size; let c;
      if (o.layout === 'row' || o.layout === 'col') {
        const row = o.layout === 'row';
        const sizes = ims.map(d => row ? [d.w * S / d.h, S] : [S, d.h * S / d.w]);
        const W = row ? sizes.reduce((s, z) => s + z[0], 0) + gap * (ims.length + 1) : S + gap * 2;
        const H = row ? S + gap * 2 : sizes.reduce((s, z) => s + z[1], 0) + gap * (ims.length + 1);
        const k = Math.min(1, 16000 / Math.max(W, H));
        c = canvasOf(W * k, H * k); const g = c.getContext('2d'); g.fillStyle = o.bg; g.fillRect(0, 0, c.width, c.height); g.imageSmoothingQuality = 'high';
        let p = gap;
        ims.forEach((d, i) => { const [w, h] = sizes[i]; if (row) g.drawImage(d.src, p * k, gap * k, w * k, h * k); else g.drawImage(d.src, gap * k, p * k, w * k, h * k); p += (row ? w : h) + gap; });
      } else {
        const n = ims.length, cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols), cell = Math.round(S / cols * 1.4);
        c = canvasOf(cols * cell + (cols + 1) * gap, rows * cell + (rows + 1) * gap); const g = c.getContext('2d');
        g.fillStyle = o.bg; g.fillRect(0, 0, c.width, c.height); g.imageSmoothingQuality = 'high';
        ims.forEach((d, i) => {
          const x = gap + (i % cols) * (cell + gap), y = gap + Math.floor(i / cols) * (cell + gap);
          if (o.cover) { const s = Math.max(cell / d.w, cell / d.h), sw = cell / s, sh = cell / s; g.drawImage(d.src, (d.w - sw) / 2, (d.h - sh) / 2, sw, sh, x, y, cell, cell); }
          else { const s = Math.min(cell / d.w, cell / d.h), w = d.w * s, h = d.h * s; g.drawImage(d.src, x + (cell - w) / 2, y + (cell - h) / 2, w, h); }
        });
      }
      ims.forEach(d => d.done());
      ctx.progress(.9, 'Saving');
      const blob = await encode(c, o.format, .9);
      return [{ name: 'fileora-combined.' + IMG_EXT[o.format], blob, note: `${items.length} pictures, ${c.width} × ${c.height} px, ${fmtSize(blob.size)}` }];
    } });

  /* ---------------- favicon ---------------- */
  function icoFromPngs(pngs) {
    const n = pngs.length, head = new Uint8Array(6 + 16 * n), dv = new DataView(head.buffer);
    dv.setUint16(2, 1, true); dv.setUint16(4, n, true);
    let off = head.length;
    pngs.forEach((p, i) => {
      const e = 6 + 16 * i;
      head[e] = p.size >= 256 ? 0 : p.size; head[e + 1] = p.size >= 256 ? 0 : p.size;
      dv.setUint16(e + 4, 1, true); dv.setUint16(e + 6, 32, true);
      dv.setUint32(e + 8, p.bytes.length, true); dv.setUint32(e + 12, off, true);
      off += p.bytes.length;
    });
    return new Blob([head, ...pngs.map(p => p.bytes)], { type: 'image/x-icon' });
  }
  R({ id: 'favicon', accept: 'image', cta: 'Create icons', verb: 'Creating icons',
    tip: 'Use a square logo of at least 512 × 512 px for the sharpest result.',
    opts: [
      { id: 'fit', type: 'seg', label: 'Shape', value: 'pad', choices: [['pad', 'Fit inside'], ['crop', 'Crop to square']] },
      { id: 'bg', type: 'seg', label: 'Background', value: 'none', choices: [['none', 'Transparent'], ['white', 'White'], ['dark', 'Dark']] },
      { id: 'radius', type: 'range', label: 'Rounded corners', value: 0, min: 0, max: 50, step: 5, suffix: '%' },
      { id: 'name', type: 'text', label: 'Site name (for the app manifest)', value: '', placeholder: 'My website' }
    ],
    async run(items, o, ctx) {
      const d = await decodeImage(items[0].file);
      const square = size => {
        const c = canvasOf(size, size), g = c.getContext('2d'), r = size * +o.radius / 100;
        g.imageSmoothingQuality = 'high';
        if (r) { g.beginPath(); g.roundRect ? g.roundRect(0, 0, size, size, r) : g.rect(0, 0, size, size); g.clip(); }
        if (o.bg !== 'none') { g.fillStyle = o.bg === 'white' ? '#FFFFFF' : '#16182F'; g.fillRect(0, 0, size, size); }
        if (o.fit === 'crop') { const s = Math.min(d.w, d.h); g.drawImage(d.src, (d.w - s) / 2, (d.h - s) / 2, s, s, 0, 0, size, size); }
        else { const s = Math.min(size / d.w, size / d.h) * (o.bg === 'none' ? 1 : .86), w = d.w * s, h = d.h * s; g.drawImage(d.src, (size - w) / 2, (size - h) / 2, w, h); }
        return c;
      };
      const png = async size => new Uint8Array(await (await canvasToBlob(square(size), 'image/png')).arrayBuffer());
      const outs = [];
      ctx.progress(.2, 'Drawing every size');
      const ico = [];
      for (const s of [16, 32, 48]) ico.push({ size: s, bytes: await png(s) });
      outs.push({ name: 'favicon.ico', blob: icoFromPngs(ico), note: '16, 32 and 48 px in one file' });
      for (const [s, name] of [[16, 'favicon-16x16.png'], [32, 'favicon-32x32.png'], [180, 'apple-touch-icon.png'], [192, 'android-chrome-192x192.png'], [512, 'android-chrome-512x512.png']]) {
        outs.push({ name, blob: new Blob([await png(s)], { type: 'image/png' }), note: `${s} × ${s} px` });
      }
      d.done();
      const site = String(o.name || '').trim() || 'My website';
      const manifest = JSON.stringify({ name: site, short_name: site.slice(0, 12), icons: [{ src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' }, { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' }], theme_color: '#ffffff', background_color: '#ffffff', display: 'standalone' }, null, 2);
      outs.push({ name: 'site.webmanifest', blob: new Blob([manifest], { type: 'application/manifest+json' }), note: 'App manifest' });
      const html = '<link rel="icon" href="/favicon.ico" sizes="any">\n<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">\n<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">\n<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">\n<link rel="manifest" href="/site.webmanifest">';
      ctx.result = { text: html, title: 'Your icons are ready', textNote: 'Put the files in your website’s main folder and add these lines inside <head>:' };
      return outs;
    } });

  /* ---------------- SVG to PNG ---------------- */
  async function svgSize(file) {
    const t = await file.text();
    const tag = (/<svg\b[^>]*>/i.exec(t) || [''])[0];
    const num = a => { const m = new RegExp(a + '\\s*=\\s*["\']\\s*([\\d.]+)(px)?\\s*["\']', 'i').exec(tag); return m ? parseFloat(m[1]) : 0; };
    let w = num('width'), h = num('height');
    const vb = /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(tag);
    if ((!w || !h) && vb) { const vw = +vb[1], vh = +vb[2]; if (w && !h) h = w * vh / vw; else if (h && !w) w = h * vw / vh; else { w = vw; h = vh; } }
    return { w: w || 300, h: h || 150, text: t };
  }
  R({ id: 'svg2png', accept: 'svg', multi: true, cta: 'Convert to PNG', verb: 'Drawing',
    opts: [
      { id: 'mode', type: 'seg', label: 'Size', value: 'scale', choices: [['scale', 'Scale'], ['width', 'Exact width']] },
      { id: 'scale', type: 'seg', label: 'Scale', value: '2', choices: [['1', '1×'], ['2', '2×'], ['4', '4×'], ['8', '8×']], show: o => o.mode === 'scale' },
      { id: 'width', type: 'number', label: 'Width', value: 1024, min: 16, max: 10000, suffix: 'px', show: o => o.mode === 'width' },
      { id: 'bg', type: 'seg', label: 'Background', value: 'none', choices: [['none', 'Transparent'], ['#FFFFFF', 'White'], ['#000000', 'Black']] }
    ],
    run: (items, o, ctx) => eachImage(items, ctx, async f => {
      const s = await svgSize(f);
      const k = o.mode === 'width' ? +o.width / s.w : +o.scale, W = Math.round(s.w * k), H = Math.round(s.h * k);
      if (W * H > 1.2e8) throw new UserError('That size is too large. Choose a smaller scale.');
      const url = URL.createObjectURL(new Blob([s.text], { type: 'image/svg+xml' }));
      const img = new Image(); img.src = url;
      try { await img.decode(); } catch (e) { URL.revokeObjectURL(url); throw new UserError(`${f.name} couldn’t be drawn. It may use fonts or images from other websites.`); }
      const c = canvasOf(W, H), g = c.getContext('2d');
      if (o.bg !== 'none') { g.fillStyle = o.bg; g.fillRect(0, 0, W, H); }
      g.drawImage(img, 0, 0, W, H); URL.revokeObjectURL(url);
      const blob = await canvasToBlob(c, 'image/png');
      return { blob, name: baseName(f.name) + '.png', width: W, height: H, note: `${W} × ${H} px, ${fmtSize(blob.size)}` };
    }) });

  /* ---------------- PNG / JPG to SVG (tracing with ImageTracer.js, public domain) ----------------
     The picture is redrawn as vector shapes: sharp at any size. Best for logos, icons,
     signatures, stamps and line art; photos give large, blotchy files. Tracing runs in a
     Web Worker so the page stays responsive; if workers aren't available it runs here. */
  function traceJob(IT, m) {
    const opts = { numberofcolors: m.colors, colorsampling: m.bw ? 0 : 2, colorquantcycles: m.bw ? 1 : 3, mincolorratio: 0,
      pathomit: m.pathomit, ltres: m.tres, qtres: m.tres, blurradius: 0, strokewidth: 1, roundcoords: 1, viewbox: true, layering: 0 };
    if (m.bw) opts.pal = [{ r: m.ink[0], g: m.ink[1], b: m.ink[2], a: 255 }, { r: 255, g: 255, b: 255, a: 255 }];
    const td = IT.imagedataToTracedata({ width: m.width, height: m.height, data: m.data }, opts);
    let drop = -1;
    td.palette.forEach((c, i) => { if (c.a < 128) td.layers[i] = []; });
    if (m.removeBg) {
      if (m.bw) drop = 1;
      else if (m.bg) {
        let best = Infinity;
        td.palette.forEach((c, i) => { const d = (c.r - m.bg[0]) ** 2 + (c.g - m.bg[1]) ** 2 + (c.b - m.bg[2]) ** 2; if (c.a >= 128 && d < best) { best = d; drop = i; } });
      }
      if (drop >= 0) td.layers[drop] = [];
    }
    let paths = 0, used = 0;
    td.layers.forEach(l => { const n = l.filter(p => !p.isholepath).length; paths += n; if (n) used++; });
    return { svg: IT.getsvgstring(td, opts), paths, colors: used };
  }
  let traceWorker = null;
  function trace(msg) {
    const url = libUrl('imagetracer');
    if (url && window.Worker && !traceWorker) {
      try {
        const src = `importScripts(${JSON.stringify(url)});const traceJob=${traceJob.toString()};onmessage=e=>{try{postMessage({ok:traceJob(self.ImageTracer,e.data)})}catch(x){postMessage({err:String(x&&x.message||x)})}};`;
        traceWorker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      } catch (e) { traceWorker = false; }
    }
    if (traceWorker) {
      return new Promise((res, rej) => {
        traceWorker.onmessage = e => e.data.ok ? res(e.data.ok) : rej(new Error(e.data.err));
        traceWorker.onerror = ev => { ev.preventDefault(); traceWorker.terminate(); traceWorker = false; trace(msg).then(res, rej); };
        traceWorker.postMessage(msg); // copied, not transferred, so the fallback can still use it
      });
    }
    return lib('imagetracer').then(IT => new Promise(r => setTimeout(r, 30)).then(() => traceJob(IT, msg)));
  }
  /* Otsu threshold: the darkness level that best splits ink from paper. */
  function otsu(lum) {
    const hist = new Float64Array(256); lum.forEach(v => hist[v | 0]++);
    const n = lum.length; let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
    let wB = 0, sB = 0, best = 0, t = 128;
    for (let i = 0; i < 256; i++) {
      wB += hist[i]; if (!wB) continue; const wF = n - wB; if (!wF) break;
      sB += i * hist[i]; const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) ** 2;
      if (v > best) { best = v; t = i; }
    }
    return t;
  }
  const INK = { black: [0, 0, 0], blue: [16, 42, 140], orig: null };
  const DETAIL = { low: [700, 16, 1], medium: [1100, 8, 1], high: [1700, 3, 0.5] };
  R({ id: 'img2svg', accept: 'image', multi: true, cta: 'Convert to SVG', verb: 'Tracing',
    opts: [
      { id: 'mode', type: 'seg', label: 'Picture type', value: 'color', choices: [['color', 'Logo / icon (colour)'], ['bw', 'Black & white (signature, stamp, line art)']] },
      { id: 'colors', type: 'range', label: 'Colours', value: 8, min: 2, max: 32, step: 1, help: 'Fewer colours give cleaner shapes and a smaller file. Logos usually need 2 to 8.', show: o => o.mode === 'color' },
      { id: 'auto', type: 'toggle', label: 'Find the darkness level automatically', value: true, show: o => o.mode === 'bw' },
      { id: 'threshold', type: 'range', label: 'Darkness level', value: 50, min: 5, max: 95, step: 1, suffix: '%', help: 'Higher keeps lighter strokes; lower keeps only the darkest parts.', show: o => o.mode === 'bw' && !o.auto },
      { id: 'ink', type: 'seg', label: 'Ink colour', value: 'black', choices: [['black', 'Black'], ['blue', 'Dark blue']], show: o => o.mode === 'bw' },
      { id: 'detail', type: 'seg', label: 'Detail', value: 'medium', choices: [['low', 'Low (smoothest)'], ['medium', 'Medium'], ['high', 'High']], help: 'Higher detail keeps small parts but makes a bigger file and takes longer.' },
      { id: 'bg', type: 'toggle', label: 'Remove the background (transparent)', value: true, help: 'Leaves out the colour around the edges of the picture, usually white paper or a plain background.' }
    ],
    resultHtml: (r, ws) => ws.outputs && ws.outputs.length === 1 && /\.svg$/i.test(ws.outputs[0].name) ? `<div class="fo-svgprev"><img src="${ws.outputs[0].url}" alt="Preview of the SVG"></div><p class="fo-plabel">The checked pattern shows transparent areas. Not happy? Change the colours or the detail level and press Run again.</p>` : '',
    run: (items, o, ctx) => eachImage(items, ctx, async f => {
      const d = await decodeImage(f);
      const [maxSide, pathomit, tres] = DETAIL[o.detail] || DETAIL.medium;
      const big = Math.max(d.w, d.h);
      // Small pictures are enlarged first (smoother curves), large ones reduced (speed).
      const k = big > maxSide ? maxSide / big : big < 500 ? Math.min(4, 800 / big) : 1;
      const W = Math.max(1, Math.round(d.w * k)), H = Math.max(1, Math.round(d.h * k));
      const c = canvasOf(W, H), g = c.getContext('2d', { willReadFrequently: true });
      g.imageSmoothingQuality = 'high'; g.drawImage(d.src, 0, 0, W, H); d.done();
      const img = g.getImageData(0, 0, W, H), px = img.data;
      // background colour: average of the opaque pixels along the edges
      let br = 0, bgc = 0, bb = 0, bn = 0;
      const edge = (x, y) => { const i = (y * W + x) * 4; if (px[i + 3] > 200) { br += px[i]; bgc += px[i + 1]; bb += px[i + 2]; bn++; } };
      for (let x = 0; x < W; x++) { edge(x, 0); edge(x, H - 1); }
      for (let y = 0; y < H; y++) { edge(0, y); edge(W - 1, y); }
      const bg = bn ? [br / bn, bgc / bn, bb / bn] : null;
      const bw = o.mode === 'bw';
      if (bw) {
        const lum = new Float32Array(W * H);
        for (let i = 0, j = 0; i < px.length; i += 4, j++) lum[j] = px[i + 3] < 128 ? 255 : px[i] * .299 + px[i + 1] * .587 + px[i + 2] * .114;
        const t = o.auto ? otsu(lum) : 255 * (+o.threshold / 100);
        const ink = INK[o.ink] || INK.black;
        for (let i = 0, j = 0; i < px.length; i += 4, j++) {
          const on = lum[j] < t;
          px[i] = on ? ink[0] : 255; px[i + 1] = on ? ink[1] : 255; px[i + 2] = on ? ink[2] : 255; px[i + 3] = 255;
        }
      }
      if (W * H > 4e6) throw new UserError('This picture is too large to trace. Choose a lower detail level.');
      let res;
      try {
        res = await trace({ width: W, height: H, data: px, colors: bw ? 2 : +o.colors, bw, ink: INK[o.ink] || INK.black, pathomit, tres, removeBg: !!o.bg, bg });
      } catch (e) {
        if (e && e.message === 'offline') throw e;
        throw new UserError(`${f.name} couldn’t be traced. Try a lower detail level or fewer colours.`);
      }
      if (!res.paths) throw new UserError(bw ? 'No dark shapes were found. Turn off automatic darkness and raise the darkness level.' : 'No shapes were found in this picture.');
      // real size of the original picture, drawing scaled to fit
      const ow = Math.round(W / k), oh = Math.round(H / k);
      const svg = res.svg.replace(/^<svg[^>]*>/, `<svg xmlns="http://www.w3.org/2000/svg" width="${ow}" height="${oh}" viewBox="0 0 ${W} ${H}">`)
        .replace(/ opacity="1"/g, '').replace(/ stroke-width="1"/g, ' stroke-width="1" stroke-linejoin="round"');
      const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n`, svg], { type: 'image/svg+xml' });
      return { blob, name: baseName(f.name) + '.svg', width: ow, height: oh, note: `${ow} × ${oh} px, ${res.colors} colour${res.colors === 1 ? '' : 's'}, ${res.paths.toLocaleString()} shape${res.paths === 1 ? '' : 's'}${res.paths > 4000 ? ' (a lot: try fewer colours or lower detail for a lighter file)' : ''}` };
    }) });

  /* ---------------- colour palette ---------------- */
  const hex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
  function kmeans(px, k) {
    const n = px.length / 3, cent = [];
    cent.push([px[0], px[1], px[2]]);
    const d2 = new Float64Array(n).fill(Infinity);
    while (cent.length < k) {
      const c = cent[cent.length - 1]; let sum = 0;
      for (let i = 0; i < n; i++) { const dx = px[i * 3] - c[0], dy = px[i * 3 + 1] - c[1], dz = px[i * 3 + 2] - c[2], d = dx * dx + dy * dy + dz * dz; if (d < d2[i]) d2[i] = d; sum += d2[i]; }
      let r = Math.random() * sum, pick = 0;
      for (let i = 0; i < n; i++) { r -= d2[i]; if (r <= 0) { pick = i; break; } }
      cent.push([px[pick * 3], px[pick * 3 + 1], px[pick * 3 + 2]]);
    }
    const lab = new Uint8Array(n);
    for (let it = 0; it < 12; it++) {
      const acc = cent.map(() => [0, 0, 0, 0]);
      for (let i = 0; i < n; i++) {
        let best = 0, bd = Infinity;
        for (let j = 0; j < k; j++) { const c = cent[j], dx = px[i * 3] - c[0], dy = px[i * 3 + 1] - c[1], dz = px[i * 3 + 2] - c[2], d = dx * dx + dy * dy + dz * dz; if (d < bd) { bd = d; best = j; } }
        lab[i] = best; const a = acc[best]; a[0] += px[i * 3]; a[1] += px[i * 3 + 1]; a[2] += px[i * 3 + 2]; a[3]++;
      }
      acc.forEach((a, j) => { if (a[3]) cent[j] = [a[0] / a[3], a[1] / a[3], a[2] / a[3]]; });
    }
    const count = new Array(k).fill(0); for (let i = 0; i < n; i++) count[lab[i]]++;
    return cent.map((c, j) => ({ rgb: c, n: count[j] })).filter(c => c.n).sort((a, b) => b.n - a.n);
  }
  R({ id: 'palette', accept: 'image', cta: 'Find colours', verb: 'Finding the colours',
    opts: [{ id: 'k', type: 'seg', label: 'Number of colours', value: '6', choices: [['4', '4'], ['6', '6'], ['8', '8'], ['10', '10']] }],
    resultHtml: r => r.palette ? `<div class="fo-palette">${r.palette.map(c => `<button type="button" class="fo-swatch-card" data-copyval="${c.hex}" title="Copy ${c.hex}"><span style="background:${c.hex}"></span><b>${c.hex}</b><small>rgb(${c.rgb.map(Math.round).join(', ')}) · ${c.pct}%</small></button>`).join('')}</div><p class="fo-plabel">Click a colour to copy its code.</p>` : '',
    async run(items, o, ctx) {
      const c = await imageCanvas(items[0].file, 160), g = c.getContext('2d', { willReadFrequently: true });
      const d = g.getImageData(0, 0, c.width, c.height).data, px = [];
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) px.push(d[i], d[i + 1], d[i + 2]);
      if (px.length < 30) throw new UserError('This picture has almost no visible pixels.');
      const pal = kmeans(Float32Array.from(px), +o.k), total = pal.reduce((s, x) => s + x.n, 0);
      const list = pal.map(x => ({ hex: hex(x.rgb), rgb: x.rgb, pct: Math.round(x.n / total * 100) }));
      const sw = canvasOf(160 * list.length, 220), sg = sw.getContext('2d');
      sg.fillStyle = '#fff'; sg.fillRect(0, 0, sw.width, sw.height);
      list.forEach((x, i) => { sg.fillStyle = x.hex; sg.fillRect(i * 160, 0, 160, 160); sg.fillStyle = '#16182F'; sg.font = '600 20px Geist, Arial, sans-serif'; sg.fillText(x.hex, i * 160 + 14, 196); });
      const text = list.map(x => `${x.hex}  rgb(${x.rgb.map(Math.round).join(', ')})  ${x.pct}%`).join('\n') + '\n\n:root {\n' + list.map((x, i) => `  --color-${i + 1}: ${x.hex};`).join('\n') + '\n}\n';
      ctx.result = { palette: list, title: `${list.length} main colours` };
      return [{ name: baseName(items[0].name) + '-palette.png', blob: await canvasToBlob(sw, 'image/png'), note: 'Swatches with their codes' }, { name: baseName(items[0].name) + '-palette.txt', blob: new Blob([text], { type: 'text/plain' }), note: 'HEX, RGB and CSS variables' }];
    } });

  /* ---------------- Base64 ---------------- */
  R({ id: 'base64', accept: 'image', cta: 'Encode image', verb: 'Encoding',
    opts: [{ id: 'fmt', type: 'seg', label: 'Output', value: 'uri', choices: [['uri', 'Data URI'], ['raw', 'Base64 only'], ['css', 'CSS'], ['html', 'HTML <img>']] }],
    async run(items, o, ctx) {
      const f = items[0].file;
      const uri = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new UserError('The file couldn’t be read.')); r.readAsDataURL(f); });
      const raw = uri.slice(uri.indexOf(',') + 1);
      const text = { uri, raw, css: `background-image: url("${uri}");`, html: `<img src="${uri}" alt="">` }[o.fmt];
      ctx.result = { text, title: 'Your Base64 code is ready' };
      return [{ name: baseName(f.name) + '-base64.txt', blob: new Blob([text], { type: 'text/plain' }), note: `${fmtSize(text.length)} of text${f.size > 1048576 ? '. That’s large: images over 1 MB slow pages down when embedded.' : ''}` }];
    } });

  /* ---------------- border and corners ---------------- */
  R({ id: 'imgborder', accept: 'image', multi: true, cta: 'Add border', verb: 'Adding the border',
    opts: [
      { id: 'width', type: 'range', label: 'Border', value: 4, min: 0, max: 20, step: 1, suffix: '% of the shorter side' },
      { id: 'color', type: 'color', label: 'Border colour', value: '#FFFFFF', choices: COLORS, custom: true },
      { id: 'radius', type: 'range', label: 'Rounded corners', value: 6, min: 0, max: 50, step: 1, suffix: '%' },
      { id: 'outside', type: 'seg', label: 'Outside the corners', value: 'none', choices: [['none', 'Transparent'], ['#FFFFFF', 'White']], show: o => +o.radius > 0 }
    ],
    validate: o => +o.width === 0 && +o.radius === 0 ? 'Choose a border or rounded corners.' : '',
    thumbStyle: o => `--fo-bd:${o.color};--fo-bw:${o.width}cqmin;--fo-rad:${o.radius}%`,
    run: (items, o, ctx) => eachImage(items, ctx, async f => {
      const d = await decodeImage(f), bw = Math.round(Math.min(d.w, d.h) * +o.width / 100);
      const W = d.w + bw * 2, H = d.h + bw * 2, r = Math.min(W, H) * +o.radius / 100;
      const transparent = +o.radius > 0 && o.outside === 'none';
      const type = transparent ? 'image/png' : sameType(f);
      const c = canvasOf(W, H), g = c.getContext('2d');
      if (!transparent && +o.radius > 0) { g.fillStyle = o.outside; g.fillRect(0, 0, W, H); }
      g.save(); g.beginPath(); if (r > 0 && g.roundRect) g.roundRect(0, 0, W, H, r); else g.rect(0, 0, W, H); g.clip();
      g.fillStyle = o.color; g.fillRect(0, 0, W, H);
      g.save(); g.beginPath(); const ri = Math.max(0, r - bw); if (ri > 0 && g.roundRect) g.roundRect(bw, bw, d.w, d.h, ri); else g.rect(bw, bw, d.w, d.h); g.clip();
      g.drawImage(d.src, bw, bw); g.restore(); g.restore(); d.done();
      const blob = await encode(c, type, .92);
      return done(f, c, blob, type, '-border', `${W} × ${H} px, ${fmtSize(blob.size)}`);
    }) });
})(window.FileoraEngine);
