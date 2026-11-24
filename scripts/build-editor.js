// Turns src/scanner/editor.html into src/scanner/editorHtml.ts (run after editing the HTML: npm run editor)
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '../src/scanner/editor.html'), 'utf8');
const out = `/* Generated from editor.html by scripts/build-editor.js: edit the HTML, then run \`npm run editor\`. */\nexport const EDITOR_HTML: string = ${JSON.stringify(html)};\n`;
fs.writeFileSync(path.join(__dirname, '../src/scanner/editorHtml.ts'), out);
console.log('editorHtml.ts', out.length, 'bytes');
