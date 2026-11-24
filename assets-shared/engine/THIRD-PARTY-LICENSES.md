# Third-party components in Fileora Core

| Component | Version | Where | Licence |
|---|---|---|---|
| pdf-lib | 1.17.1 | `public/vendor/pdf-lib.min.js` | MIT |
| PDF.js (pdfjs-dist) | 3.11.174 | `public/vendor/pdf.min.js`, `pdf.worker.min.js` | Apache License 2.0 |
| JSZip | 3.10.1 | `public/vendor/jszip.min.js` | MIT (dual-licensed MIT / GPLv3; used under MIT) |
| heic2any | 0.0.4 | `public/vendor/heic2any.min.js` | MIT |
| ImageTracer.js | 1.2.6 | `public/vendor/imagetracer.min.js` (minified, unchanged) | The Unlicense (public domain), https://github.com/jankovicsandras/imagetracerjs |
| Chart.js | 4.5.1 | `admin/assets/vendor/chart.umd.min.js` (admin only) | MIT, see `chart.js-LICENSE.md` |
| MaxMind DB Reader (PHP) | current | `includes/lib/MaxMind/` | Apache License 2.0, see `includes/lib/MaxMind/LICENSE` |
| @pdf-lib/fontkit (2.18) | 1.1.1 | `public/vendor/fontkit.min.js` (Text to PDF) | MIT |
| HarfBuzz / harfbuzzjs (2.18) | harfbuzzjs 1.6.4 | `public/vendor/hb.min.js` (WebAssembly inside; Text to PDF shaping) | HarfBuzz: "Old MIT"; harfbuzzjs: MIT |
| jSquash AVIF (2.18) | 2.1.1 | `public/vendor/avifenc.min.js`, `avifdec.min.js` (WebAssembly inside) | Apache License 2.0; contains libavif (BSD-2-Clause), libaom (BSD-2-Clause + AOMedia patent licence), dav1d (BSD-2-Clause) |
| jSquash WebP (2.18) | 1.5.0 | `public/vendor/webp.min.js` (WebAssembly inside; WebP on Safari) | Apache License 2.0; contains libwebp (BSD-3-Clause) |
| ag-psd (2.18) | 34.2.1 | `public/vendor/psd.min.js` (PNG to PSD) | MIT |
| Noto Sans, Noto Sans Devanagari / Tamil / Bengali / Gujarati / Gurmukhi / Kannada / Malayalam / Oriya / Telugu (2.18) | system build 2020 | `public/vendor/fonts/*.js` (fonts as base64, Text to PDF) | SIL Open Font License 1.1, see `public/vendor/fonts/OFL.txt` |

Data downloaded at runtime (not included in the plugin):

| Data | Licence | Attribution |
|---|---|---|
| DB-IP "IP to City Lite" database (optional, Settings → Visitor location) | Creative Commons Attribution 4.0 | "IP Geolocation by DB-IP" with a link to https://db-ip.com, shown in the dashboard and by the `[fileora_privacy_facts]` shortcode |
| MaxMind GeoLite2 City (optional, uploaded by you) | MaxMind GeoLite2 End User License Agreement | as required by MaxMind |

The tool libraries are served from your own site. Public CDNs (cdnjs, jsDelivr) are used only as a fallback if a local file can't be loaded.
