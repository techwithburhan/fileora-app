#!/bin/bash
# Builds the app's offline tool engine from the website's source code.
#
#   scripts/build-engine.sh [path to the website repo]     (default: ../site/fileora)
#
# The website's engine files (plugin/fileora-core/public/js/src/*.js), its tool modules and
# libraries are copied unchanged. engine/app-bridge.js goes inside the same function scope, so
# the app can drive every tool without the website's page. Output: assets-shared/engine/
#   Android: android/app/build.gradle adds assets-shared as an assets folder (file:///android_asset/engine/)
#   iOS:     the Xcode project copies assets-shared/engine into the app bundle (engine/)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SITE="${1:-$ROOT/../site/fileora}"
CORE="$SITE/plugin/fileora-core"
THEME="$SITE/theme/fileora-theme"
OUT="$ROOT/assets-shared/engine"
[ -d "$CORE/public/js/src" ] || { echo "Website source not found at $SITE" >&2; exit 1; }

rm -rf "$OUT"; mkdir -p "$OUT/modules" "$OUT/vendor"
{
  echo "/*! Fileora tool engine for the app. Built $(date -u +%Y-%m-%d) by scripts/build-engine.sh from the website's public/js/src and engine/app-bridge.js. */"
  echo "(function () {"
  echo "'use strict';"
  for f in "$CORE"/public/js/src/*.js; do echo; echo "/* ---- $(basename "$f") ---- */"; cat "$f"; done
  echo; echo "/* ---- app-bridge.js ---- */"; cat "$ROOT/engine/app-bridge.js"
  echo "})();"
} > "$OUT/engine.js"
node --check "$OUT/engine.js"

for m in pdf image optimizer converter security editor ai; do cp "$CORE/modules/$m/$m.js" "$OUT/modules/$m.js"; done
cp "$CORE"/public/vendor/*.js "$OUT/vendor/"
mkdir -p "$OUT/vendor/fonts" && cp "$CORE"/public/vendor/fonts/*.js "$CORE"/public/vendor/fonts/OFL.txt "$OUT/vendor/fonts/"   # Text to PDF (Noto, OFL)
cp "$ROOT/engine/index.html" "$OUT/index.html"

# Fonts as data: URLs (a page opened from a file can't load font files from other files)
FONTS="$ROOT/engine/fonts"
{
  for w in 400 600 700; do
    echo "@font-face{font-family:Geist;font-style:normal;font-weight:$w;font-display:block;src:url(data:font/woff2;base64,$(base64 -w0 "$THEME/assets/fonts/geist-sans-latin-$w-normal.woff2")) format('woff2')}"
  done
  echo "@font-face{font-family:Caveat;font-style:normal;font-weight:600;font-display:block;src:url(data:font/woff2;base64,$(base64 -w0 "$FONTS/caveat-latin-600-normal.woff2")) format('woff2')}"
} > "$OUT/fonts.css"

# Licences of what ships inside the app
cp "$CORE/THIRD-PARTY-LICENSES.md" "$OUT/THIRD-PARTY-LICENSES.md"
cat "$FONTS/OFL-Caveat.txt" "$THEME/assets/fonts/OFL-Geist.txt" > "$OUT/FONT-LICENSES.txt"

TOOLS=$(grep -o "R({ id: '[a-z0-9]*'" "$OUT"/modules/*.js | wc -l)
echo "engine: $(du -sh "$OUT" | cut -f1) in $OUT ($TOOLS tool registrations)"
