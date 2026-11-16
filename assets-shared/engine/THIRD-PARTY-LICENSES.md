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

Data downloaded at runtime (not included in the plugin):

| Data | Licence | Attribution |
|---|---|---|
| DB-IP "IP to City Lite" database (optional, Settings → Visitor location) | Creative Commons Attribution 4.0 | "IP Geolocation by DB-IP" with a link to https://db-ip.com, shown in the dashboard and by the `[fileora_privacy_facts]` shortcode |
| MaxMind GeoLite2 City (optional, uploaded by you) | MaxMind GeoLite2 End User License Agreement | as required by MaxMind |

The tool libraries are served from your own site. Public CDNs (cdnjs, jsDelivr) are used only as a fallback if a local file can't be loaded.
