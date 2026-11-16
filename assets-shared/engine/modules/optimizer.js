/* Fileora module: File Optimizer.
   Compress and Repair use the processing server when it can run them and
   fall back to these browser versions otherwise. OCR and PDF/A need the server. */
(function (E) {
  'use strict';
  if (!E) return;
  const { baseName, fmtSize, UserError, lib, pdfOut, loadPdf, savePdf, rasterize, LANGS } = E.h;
  const server = () => (E.config.tools.compress || {}).runs === 'server';

  E.register({ id: 'compress', server: true, accept: 'pdf', multi: true, cta: 'Compress PDF', verb: 'Compressing',
    opts: [{ id: 'level', type: 'seg', label: 'Compression', value: 'balanced', choices: [['light', 'Light'], ['balanced', 'Balanced'], ['strong', 'Strong']],
      help: o => (server()
        ? { light: 'Best quality, smaller savings.', balanced: 'Good quality at a much smaller size. Text stays selectable.', strong: 'Smallest file for email. Images get lower resolution.' }
        : { light: 'Lossless clean-up. Text stays selectable; savings are smaller.', balanced: 'Good quality at a much smaller size. Pages become images.', strong: 'Smallest file for email. Pages become lower-resolution images.' })[o.level] }],
    async run(items, o, ctx) {
      const outs = [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const prog = (f, l) => ctx.progress((i + f) / items.length, `${items.length > 1 ? it.name + ': ' : ''}${l}`);
        let bytes;
        if (o.level === 'light') { prog(.3, 'Cleaning up the file'); const doc = await loadPdf(it); bytes = await doc.save({ useObjectStreams: true }); }
        else bytes = await rasterize(it.file, o.level === 'strong' ? 72 : 110, o.level === 'strong' ? .5 : .66, prog);
        let blob = new Blob([bytes], { type: 'application/pdf' }), note, good = false;
        if (blob.size >= it.size) { blob = it.file; note = 'Already well optimized, so we kept the original size'; }
        else { note = `${Math.round((1 - blob.size / it.size) * 100)}% smaller (${fmtSize(it.size)} to ${fmtSize(blob.size)})`; good = true; }
        outs.push({ name: baseName(it.name) + '-compressed.pdf', blob, note, good });
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
