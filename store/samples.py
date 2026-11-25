"""Sample files for the Play Store screenshots (our own content: no real people, brands or records)."""
import math, random, sys, os
from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white
from PIL import Image, ImageDraw, ImageFilter
import docx

out = Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
NAVY, GREEN, BLUE, SOFT = HexColor('#04336B'), HexColor('#17AF64'), HexColor('#006DFC'), HexColor('#EAF0F7')
W, H = A4
LOREM = ("Every section of this plan lists the goal, the owner and the date. Tasks are grouped by phase so "
         "the team can see what is done, what is next and what is waiting. Budgets are shown per phase and "
         "reviewed at the end of each month.").split()

def para(c, x, y, width, words, size=10.5, lead=15, color=NAVY):
    c.setFont('Helvetica', size); c.setFillColor(color)
    line = ''
    for w in words:
        t = (line + ' ' + w).strip()
        if c.stringWidth(t, 'Helvetica', size) > width:
            c.drawString(x, y, line); y -= lead; line = w
        else:
            line = t
    if line: c.drawString(x, y, line); y -= lead
    return y

def doc(name, title, sub, accent, pages, chart=True):
    c = canvas.Canvas(str(out / name), pagesize=A4)
    c.setTitle(title)
    for p in range(pages):
        if p == 0:
            c.setFillColor(accent); c.rect(0, H - 230, W, 230, stroke=0, fill=1)
            c.setFillColor(white); c.setFont('Helvetica-Bold', 34); c.drawString(50, H - 120, title)
            c.setFont('Helvetica', 15); c.drawString(50, H - 150, sub)
            y = H - 280
        else:
            c.setFillColor(accent); c.rect(0, H - 40, W, 40, stroke=0, fill=1)
            y = H - 90
        c.setFillColor(NAVY); c.setFont('Helvetica-Bold', 17)
        c.drawString(50, y, ['Overview', 'Timeline', 'Budget', 'Next steps'][p % 4]); y -= 26
        for k in range(3):
            random.seed(p * 10 + k); words = LOREM[:]; random.shuffle(words)
            y = para(c, 50, y, W - 100, words) - 10
        if chart and p == 0:
            vals = [42, 65, 54, 80, 72, 95]
            x0, base = 60, y - 200
            c.setFillColor(SOFT); c.roundRect(40, base - 30, W - 80, 230, 10, stroke=0, fill=1)
            for i, v in enumerate(vals):
                c.setFillColor(GREEN if i % 2 else BLUE)
                c.roundRect(x0 + i * 80, base, 46, v * 1.7, 6, stroke=0, fill=1)
                c.setFillColor(NAVY); c.setFont('Helvetica', 9); c.drawString(x0 + i * 80 + 8, base - 16, f'Q{i % 4 + 1}')
            y = base - 50
        else:
            for k in range(4):
                c.setFillColor(SOFT); c.roundRect(50, y - 46, W - 100, 38, 8, stroke=0, fill=1)
                c.setFillColor(accent); c.circle(72, y - 27, 7, stroke=0, fill=1)
                c.setFillColor(NAVY); c.setFont('Helvetica', 11); c.drawString(90, y - 31, f'Step {k + 1}: review, agree and share the update')
                y -= 50
        c.setFillColor(HexColor('#4A6185')); c.setFont('Helvetica', 9); c.drawString(50, 30, f'{title} - page {p + 1} of {pages}')
        c.showPage()
    c.save()

doc('Project-Plan.pdf', 'Project Plan', 'Goals, timeline and budget', NAVY, 4)
doc('Meeting-Notes.pdf', 'Meeting Notes', 'Decisions and action items', BLUE, 2, chart=False)
doc('Study-Guide.pdf', 'Study Guide', 'Chapters, summaries and practice', GREEN, 3)

def landscape(name, sky, sun, hills, seed):
    random.seed(seed)
    w, h = 3000, 4000
    im = Image.new('RGB', (w, h))
    d = ImageDraw.Draw(im)
    for y in range(h):
        t = y / h
        col = tuple(int(sky[0][i] * (1 - t) + sky[1][i] * t) for i in range(3))
        d.line([(0, y), (w, y)], fill=col)
    d.ellipse([w * .55, h * .18, w * .55 + 520, h * .18 + 520], fill=sun)
    for k, colr in enumerate(hills):
        base = h * (.45 + k * .12)
        pts = [(0, h)]
        for x in range(0, w + 60, 60):
            pts.append((x, base - 260 * math.sin(x / (380 + 90 * k) + seed + k) - 140 * math.sin(x / 170 + k * 2)))
        pts.append((w, h)); d.polygon(pts, fill=colr)
    noise = Image.effect_noise((w, h), 26).convert('L')
    im = Image.blend(im, Image.merge('RGB', (noise, noise, noise)), 0.07)
    im = im.filter(ImageFilter.SMOOTH)
    im.save(out / name, quality=96, subsampling=0)

landscape('Mountains.jpg', ((120, 180, 255), (255, 214, 170)), (255, 244, 214), [(80, 120, 170), (46, 88, 140), (23, 60, 105), (10, 36, 70)], 1)
landscape('Sunset.jpg', ((255, 140, 90), (255, 220, 150)), (255, 250, 220), [(190, 90, 110), (140, 60, 100), (90, 40, 85), (40, 20, 60)], 2)
landscape('Lake.jpg', ((150, 220, 230), (230, 250, 240)), (255, 255, 235), [(80, 170, 140), (40, 140, 110), (20, 100, 90), (10, 70, 70)], 3)

d = docx.Document()
d.add_heading('Proposal', 0)
d.add_paragraph('A short proposal with the goal, the plan and the budget, ready to share as a PDF.')
for s in ('Goal', 'Plan', 'Budget', 'Timeline'):
    d.add_heading(s, 1)
    d.add_paragraph(' '.join(LOREM))
d.save(out / 'Proposal.docx')
for f in sorted(out.iterdir()): print(f.name, f.stat().st_size)
