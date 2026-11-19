"""Collects the English UI strings of the app (keys of the translation files).

Sources: string literals and JSX text in src/ and App.tsx, tr('…') calls, the tool definitions of
the offline engine (names, options, choices, help, buttons), the tool list, festival texts and the
messages the engine shows. Writes tools/i18n/strings.json (sorted, with where each was found).
"""
import json, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
out = {}

def add(s, where, check=False):
    if not isinstance(s, str):
        return
    if check and not ui_like(s, src=False):
        return
    s = s.strip()
    if len(s) < 2 or not re.search(r'[A-Za-z]{2}', s):
        return
    out.setdefault(s, set()).add(where)

SKIP_FILE = ('/i18n/', '/festival/art.ts', '/assets/')
NONUI = re.compile(r'^([a-z0-9_.:/#@\-]+|[A-Z0-9_]+|#[0-9a-fA-F]{3,8}|https?://.*|file://.*|data:.*|.*\.(png|jpg|svg|json|js|html|pdf|ttf)|[a-z]+/[a-z0-9.+\-]+|\d+(px|%)?)$')
CODEY = re.compile(r'(=>|\bfunction\b|\breturn\b|\$\{|;\s*$|^\s*[\[{(]|\bconst\b|\.tsx?$|^[a-z]+[A-Z][A-Za-z]*$)')

BAD = re.compile(r'(<[a-z!/]|^Downloads/Fileora$|setRewardOpen|;|=>|&&|\|\||\s=\s|\bcase\b|Promise|Record<|^rgba?\(|\)\s*:\s*|\? \(|^\.|\bnull\b|\bundefined\b|\btypeof\b|\bconst\b|\bbreak\b)')

def ui_like(s, src=True):
    t = s.strip()
    if len(t) < 2 or BAD.search(t):
        return False
    # search keywords of the tool list: all lowercase words
    if src and t == t.lower() and re.fullmatch(r"[a-z0-9 '&/+.-]+", t):
        return False
    if NONUI.match(t) or CODEY.search(t):
        return False
    # one lowercase word (ids, keys, enum values) is not UI text; "OK", "PDF", "Open" are
    if ' ' not in t and t[0].islower() and src:
        return False
    if not src and re.fullmatch(r'[a-z0-9]+', t):
        return False  # tool ids
    return True

lit = re.compile(r"""(?<![\w$])(['"])((?:\\.|(?!\1).)*?)\1""")
jsx = re.compile(r'>\s*([^<>{}]*[A-Za-z][^<>{}]*?)\s*<')
trcall = re.compile(r"""\btr\(\s*(['"])((?:\\.|(?!\1).)*?)\1""")
imp = re.compile(r"^\s*(import|export \{[^}]*\} from|export \* from)\b.*$", re.M)
for dp, _, fs in os.walk(os.path.join(ROOT, 'src')):
    for f in fs:
        if not f.endswith(('.ts', '.tsx')):
            continue
        p = os.path.join(dp, f)
        if any(x in p for x in SKIP_FILE):
            continue
        rel = os.path.relpath(p, ROOT)
        src = imp.sub('', open(p, encoding='utf-8').read())
        # comments out
        src = re.sub(r'/\*.*?\*/', '', src, flags=re.S)
        src = re.sub(r'(^|\s)//[^\n]*', r'\1', src)
        # every literal in the first argument of tr(…), also tr(n === 1 ? '1 page' : '{n} pages', …)
        for m in re.finditer(r'\btr(?:Msg)?\(', src):
            i, depth, j = m.end(), 1, m.end()
            while j < len(src) and depth:
                ch = src[j]
                if ch in '\'"`':
                    k = j + 1
                    while k < len(src) and src[k] != ch:
                        k += 2 if src[k] == '\\' else 1
                    j = k + 1
                    continue
                if ch in '([{':
                    depth += 1
                elif ch in ')]}':
                    depth -= 1
                elif ch == ',' and depth == 1:
                    break
                j += 1
            for lm in lit.finditer(src[i:j]):
                t = lm.group(2).replace("\\'", "'")
                if '\\u' not in t:
                    add(t, rel)
        for m in trcall.finditer(src):
            add(m.group(2).encode().decode('unicode_escape').encode('latin1').decode('utf-8') if '\\u' in m.group(2) else m.group(2).replace("\\'", "'"), rel)
        for m in jsx.finditer(src):
            t = re.sub(r'\s+', ' ', m.group(1))
            if ui_like(t):
                add(t, rel)
        for m in lit.finditer(src):
            t = m.group(2).replace("\\'", "'").replace('\\n', '\n')
            if ui_like(t):
                add(t, rel)
for p in [os.path.join(ROOT, 'App.tsx')]:
    src = imp.sub('', open(p, encoding='utf-8').read())
    for m in lit.finditer(src):
        if ui_like(m.group(2)):
            add(m.group(2), 'App.tsx')

# engine tool definitions (dumped from the running engine)
defs = json.load(open(sys.argv[1])) if len(sys.argv) > 1 else {}
for k, v in defs.items():
    for fld in ('name', 'desc', 'tip', 'cta', 'verb', 'noun', 'nouns', 'dropText', 'codeText', 'textTitle'):
        add(v.get(fld), 'engine:' + k, True)
    for o in v.get('opts') or []:
        for fld in ('label', 'help', 'text', 'placeholder', 'suffix'):
            x = o.get(fld)
            if isinstance(x, str) and not x.startswith('FN:'):
                add(x, 'engine:' + k, True)
        for c in o.get('choices') or []:
            if isinstance(c, list) and len(c) == 2:
                add(c[1], 'engine:' + k, True)
    for sl in v.get('slots') or []:
        if isinstance(sl, dict):
            add(sl.get('label'), 'engine:' + k)
    # "Choose …" headline of the file step (ProcessScreen)
    if v.get('noun'):
        n = v['noun']
        add(('an ' if re.match(r'^[aeiou]', n, re.I) else 'a ') + n, 'engine:' + k)
    if v.get('nouns'):
        add(v['nouns'], 'engine:' + k)
        if v.get('slots'):
            add(f"{len(v['slots'])} {v['nouns']}", 'engine:' + k)
# messages the offline engine shows (errors, notes, progress)
for dp, _, fs in os.walk(os.path.join(ROOT, 'assets-shared/engine')):
    if 'vendor' in dp:
        continue
    for f in fs:
        if not f.endswith('.js'):
            continue
        src = open(os.path.join(dp, f), encoding='utf-8').read()
        for m in re.finditer(r"(?:UserError|note|warn|status|fail|setStatus|progress|toast|msg)\s*[:(]\s*'((?:[^'\\]|\\.){6,})'", src):
            t = m.group(1).replace("\\'", "'")
            if re.search(r'[A-Z][a-z]', t) and ' ' in t and '${' not in t:
                add(t, 'engine-msg:' + f)

# sentences the engine builds from pieces (translated by trMsg in src/i18n/i18n.ts)
for t in ['Add at least {n} {things} to start.', 'Add {thing} to start.', 'Add {n} more {things}.', 'That is larger than {n} MB.']:
    add(t, 'engine-pattern')
for n in ['PDF', 'image', 'PDF or image', 'HEIC photo', 'SVG file', 'Word file', 'PowerPoint file', 'spreadsheet', 'web address', 'HTML file']:
    add(n, 'engine-noun')
    add(('an ' if re.match(r'^[aeiou]', n, re.I) else 'a ') + n, 'engine-noun')
for n in ['PDF files', 'images', 'PDF or images', 'HEIC photos', 'SVG files', 'Word files', 'PowerPoint files', 'spreadsheets', 'web addresses', 'HTML files']:
    add(n, 'engine-noun')

# festival themes: the built-in greetings (plugin 2.20 presets) and texts of the festival banner
for t in ['Happy New Year!', 'Wishing you a bright and productive new year.', 'Happy Valentine’s Day!', 'Share the love with the people who matter.',
          'Happy Mother’s Day!', 'Thank you, Maa, for everything.', 'Happy Father’s Day!', 'Thank you, Papa, for everything.', 'Merry Christmas!',
          'Wishing you joy, peace and a season of happiness.', 'Ramadan Mubarak', 'Wishing you a blessed and peaceful Ramadan.', 'Eid Mubarak!',
          'Wishing you and your family joy and blessings.', 'Happy Holi!', 'Wishing you a colourful and joyful Holi.', 'Eid al-Adha Mubarak!',
          'May this Eid bring peace and happiness to your home.', 'Happy Diwali!', 'May the festival of lights brighten your life.']:
    add(t, 'festival')

json.dump({k: sorted(v) for k, v in sorted(out.items())}, open(os.path.join(ROOT, 'tools/i18n/strings.json'), 'w'), ensure_ascii=False, indent=0)
print(len(out), 'strings')
