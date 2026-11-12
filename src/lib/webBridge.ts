/**
 * JavaScript put into fileora.in pages shown inside the app:
 *  - hides the website's own header, footer, drawer and floating buttons (the app has its own);
 *  - uses the app's light/dark mode (the theme reads localStorage "fileora.theme");
 *  - saves downloads: the tools create files as blob: links (a[download]); Android's WebView can't
 *    save those, so the file is read in the page and sent to the app in pieces (base64).
 */
export function injectedScript(dark: boolean): string {
  return `(function () {
  try { localStorage.setItem('fileora.theme', JSON.stringify('${dark ? 'dark' : 'light'}')); } catch (e) {}
  var css = '.hdr,.ftr,.skip,.totop,.a11y-fab,#drawer,.drawer{display:none!important}body{padding-top:0!important}';
  function addCss() {
    if (document.getElementById('fo-app-css')) return;
    var s = document.createElement('style'); s.id = 'fo-app-css'; s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }
  addCss(); document.addEventListener('DOMContentLoaded', addCss);

  var blobs = {};
  var origCreate = URL.createObjectURL.bind(URL);
  URL.createObjectURL = function (o) {
    var u = origCreate(o);
    if (o instanceof Blob) { blobs[u] = o; setTimeout(function () { delete blobs[u]; }, 120000); }
    return u;
  };
  function post(o) { window.ReactNativeWebView.postMessage(JSON.stringify(o)); }
  var seq = 0, PART = 3 * 256 * 1024;
  function send(blob, name) {
    var id = 'd' + (++seq) + '-' + Date.now(), off = 0;
    post({ type: 'dl-start', id: id, name: name || 'fileora-download', mime: blob.type || 'application/octet-stream', size: blob.size });
    (function next() {
      if (off >= blob.size) { post({ type: 'dl-end', id: id }); return; }
      var r = new FileReader();
      r.onload = function () { var s = String(r.result); post({ type: 'dl-chunk', id: id, data: s.slice(s.indexOf(',') + 1) }); setTimeout(next, 0); };
      r.onerror = function () { post({ type: 'dl-error', id: id }); };
      r.readAsDataURL(blob.slice(off, off + PART));
      off += PART;
    })();
  }
  function handle(a) {
    var href = a.href || '', name = a.getAttribute('download') || '';
    if (!/^(blob:|data:)/.test(href)) return false;
    if (blobs[href]) { send(blobs[href], name); return true; }
    fetch(href).then(function (r) { return r.blob(); }).then(function (b) { send(b, name); })
      .catch(function () { post({ type: 'dl-error', id: '' }); });
    return true;
  }
  var origClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.hasAttribute('download') && handle(this)) return;
    return origClick.apply(this, arguments);
  };
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[download]');
    if (a && handle(a)) { e.preventDefault(); e.stopPropagation(); }
  }, true);
})(); true;`;
}

/**
 * Puts files into the tool page's file chooser (the website's ".fo-file-in" input), exactly as if
 * they had been picked with "Choose files". Waits up to 10 s for the tool to appear.
 */
export function fileInjection(files: { name: string; mime: string; data: string }[]): string {
  return `(function (files) {
  function toFile(f) {
    var bin = atob(f.data), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return new File([u], f.name, { type: f.mime });
  }
  var tries = 0;
  (function attempt() {
    var input = document.querySelector('.fo-file-in') || document.querySelector('input[type=file]:not([capture])');
    if (!input) { if (++tries < 40) { setTimeout(attempt, 250); } else { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'inject-fail' })); } return; }
    try {
      var dt = new DataTransfer();
      files.forEach(function (f) { dt.items.add(toFile(f)); });
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'inject-ok', n: files.length }));
    } catch (e) { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'inject-fail' })); }
  })();
})(${JSON.stringify(files)}); true;`;
}
