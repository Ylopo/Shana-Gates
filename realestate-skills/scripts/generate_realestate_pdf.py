#!/usr/bin/env python3
"""
AI Real Estate Property Report — Shana Gates Edition
Craft & Bauer | Real Broker branding
Dark luxury design: #131313 / Cream #F2EDE4 / Silver #ABABAB
Fonts: Marcellus (serif headings) + Montserrat (sans body)

Usage:
  python3 generate_realestate_pdf.py data.json
  python3 generate_realestate_pdf.py data.json output.pdf
  python3 generate_realestate_pdf.py --demo
"""

import sys
import json
import os
import zipfile
from datetime import datetime

try:
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.units import inch
    from reportlab.lib.colors import HexColor, white, black, Color
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
                                     TableStyle, PageBreak, KeepTogether)
    from reportlab.graphics.shapes import Drawing, Rect, Circle, String, Line
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
except ImportError:
    print("Error: reportlab is required.  pip install reportlab")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..'))
FONTS_DIR    = os.path.join(SCRIPT_DIR, 'fonts')
IMAGES_DIR   = os.path.join(PROJECT_ROOT, 'images')

LOGO_PATH    = os.path.join(IMAGES_DIR, 'C&B-logo+R.png')
SHANA_PATH   = os.path.join(IMAGES_DIR, 'shana pro.JPG')


# ---------------------------------------------------------------------------
# Font setup — extract from zip if fonts dir is empty
# ---------------------------------------------------------------------------
def ensure_fonts():
    os.makedirs(FONTS_DIR, exist_ok=True)
    needed = {
        'Marcellus-Regular.ttf':   os.path.join(FONTS_DIR, 'Marcellus-Regular.ttf'),
        'Montserrat-Regular.ttf':  os.path.join(FONTS_DIR, 'Montserrat-Regular.ttf'),
        'Montserrat-SemiBold.ttf': os.path.join(FONTS_DIR, 'Montserrat-SemiBold.ttf'),
        'Montserrat-Light.ttf':    os.path.join(FONTS_DIR, 'Montserrat-Light.ttf'),
    }
    missing = [dest for dest in needed.values() if not os.path.exists(dest)]
    if missing:
        zip_path = os.path.join(PROJECT_ROOT, 'Marcellus,Montserrat.zip')
        if os.path.exists(zip_path):
            with zipfile.ZipFile(zip_path) as z:
                for zi in z.infolist():
                    base = os.path.basename(zi.filename)
                    if base in needed:
                        zi.filename = base
                        z.extract(zi, FONTS_DIR)


def register_fonts():
    ensure_fonts()
    font_files = {
        'Marcellus':          'Marcellus-Regular.ttf',
        'Montserrat':         'Montserrat-Regular.ttf',
        'Montserrat-Bold':    'Montserrat-SemiBold.ttf',
        'Montserrat-Light':   'Montserrat-Light.ttf',
    }
    registered = []
    for name, fname in font_files.items():
        path = os.path.join(FONTS_DIR, fname)
        if os.path.exists(path):
            pdfmetrics.registerFont(TTFont(name, path))
            registered.append(name)
    return registered


REGISTERED_FONTS = register_fonts()
SERIF  = 'Marcellus'   if 'Marcellus'       in REGISTERED_FONTS else 'Times-Roman'
SANS   = 'Montserrat'  if 'Montserrat'       in REGISTERED_FONTS else 'Helvetica'
SANSBOLD = 'Montserrat-Bold' if 'Montserrat-Bold' in REGISTERED_FONTS else 'Helvetica-Bold'
SANSLIGHT = 'Montserrat-Light' if 'Montserrat-Light' in REGISTERED_FONTS else 'Helvetica'


# ---------------------------------------------------------------------------
# Brand color palette
# ---------------------------------------------------------------------------
DARK        = HexColor('#131313')   # primary bg
DARK2       = HexColor('#1a1a1a')   # slightly lighter
DARK3       = HexColor('#222222')   # table alt row (dark)
CREAM       = HexColor('#F2EDE4')   # primary light text
CREAM2      = HexColor('#E8E1D5')   # secondary cream
BRONZE      = HexColor('#ABABAB')   # accent (silver-gray)
BRONZE_LT   = HexColor('#C8C8C8')   # lighter accent (light silver)
TEXT_DARK   = HexColor('#1a1814')   # body text on light pages
TEXT_MID    = HexColor('#4a4540')   # secondary body text
TEXT_MUTED  = HexColor('#8a8282')   # captions, disclaimers
PAGE_BG     = HexColor('#FAFAF8')   # interior page background
ROW_ALT     = HexColor('#F4F4F2')   # table alternating row (neutral)
BORDER      = HexColor('#DCDCDC')   # neutral border
HDR_BG      = HexColor('#131313')   # table header bg (same as dark)
GREEN_POS   = HexColor('#2d7a4e')   # positive / strong score
AMBER_MID   = HexColor('#C07A2A')   # medium score (amber — separate from accent)
RED_NEG     = HexColor('#b03a2e')   # negative / weak score


def score_color(score):
    if score >= 70: return GREEN_POS
    if score >= 40: return AMBER_MID
    return RED_NEG

def score_grade(score):
    if score >= 85: return 'A+'
    if score >= 70: return 'A'
    if score >= 55: return 'B'
    if score >= 40: return 'C'
    if score >= 25: return 'D'
    return 'F'

def score_signal(score):
    if score >= 85: return 'STRONG BUY'
    if score >= 70: return 'BUY'
    if score >= 55: return 'HOLD / WATCH'
    if score >= 40: return 'CAUTION'
    if score >= 25: return 'PASS'
    return 'AVOID'

def signal_color(score):
    if score >= 70: return GREEN_POS
    if score >= 55: return HexColor('#4a9eff')
    if score >= 40: return BRONZE
    return RED_NEG


DISCLAIMER = (
    "DISCLAIMER: This report is generated by AI for educational and research purposes only. "
    "It is not financial or investment advice. Values, rental estimates, and projections are "
    "AI-generated approximations from publicly available data. Always verify with licensed "
    "real estate professionals before any purchase or investment decision."
)

W, H = letter   # 612 x 792


# ---------------------------------------------------------------------------
# Canvas helpers — draw on cover page
# ---------------------------------------------------------------------------
def draw_gauge_on_canvas(canvas, cx, cy, score, radius=58):
    """Draw the circular Property Score gauge directly on a canvas."""
    color = score_color(score)
    ring_w = 14

    # Outer background ring
    canvas.setFillColor(DARK2)
    canvas.setStrokeColor(BRONZE)
    canvas.setLineWidth(0.5)
    canvas.circle(cx, cy, radius, fill=1, stroke=1)

    # Colored ring (score band)
    canvas.setFillColor(color)
    canvas.setStrokeColor(color)
    canvas.circle(cx, cy, radius - 2, fill=1, stroke=0)

    # Inner dark circle (creates ring look)
    canvas.setFillColor(DARK)
    canvas.circle(cx, cy, radius - ring_w, fill=1, stroke=0)

    # Score number
    canvas.setFillColor(CREAM)
    canvas.setFont(SERIF, 30)
    canvas.drawCentredString(cx, cy + 6, str(int(score)))

    # "/100"
    canvas.setFillColor(BRONZE)
    canvas.setFont(SANS, 8)
    canvas.drawCentredString(cx, cy - 13, '/ 100')


def draw_cover_page(canvas, doc):
    """Draw the full luxury cover page — called as onFirstPage callback."""
    canvas.saveState()
    data = doc._brand_data

    address   = data.get('address', '')
    price     = data.get('price', '')
    score     = data.get('overall_score', 0)
    grade     = score_grade(score)
    signal    = data.get('recommendation', {}).get('signal', score_signal(score))
    prop_img  = data.get('property_image', '')
    prop_type = data.get('property_details', {}).get('property_type', '')
    date_str  = data.get('date', datetime.now().strftime('%B %d, %Y'))

    # ---- Full dark background ----
    canvas.setFillColor(DARK)
    canvas.rect(0, 0, W, H, fill=1, stroke=0)

    # ---- C&B logo at top ----
    logo_y = H - 44
    if os.path.exists(LOGO_PATH):
        logo_w, logo_h = 140, 36
        canvas.drawImage(LOGO_PATH, (W - logo_w) / 2, logo_y,
                         width=logo_w, height=logo_h,
                         preserveAspectRatio=True, anchor='c', mask='auto')
    else:
        canvas.setFillColor(BRONZE)
        canvas.setFont(SANSBOLD, 11)
        canvas.drawCentredString(W / 2, H - 25, 'CRAFT & BAUER | REAL BROKER')

    # ---- Thin bronze line under logo ----
    canvas.setFillColor(BRONZE)
    canvas.rect(40, H - 50, W - 80, 1, fill=1, stroke=0)

    # ---- Property photo (full bleed) ----
    # Natural height at full width: W × (650/1251) ≈ 318pt for this image
    photo_h = 210
    photo_y = H - 50 - photo_h
    if prop_img and os.path.exists(prop_img):
        _draw_image_cover(canvas, prop_img, 0, photo_y, W, photo_h)
    else:
        # Gradient placeholder
        canvas.setFillColor(DARK2)
        canvas.rect(0, photo_y, W, photo_h, fill=1, stroke=0)
        canvas.setFillColor(BRONZE)
        canvas.setFont(SERIF, 14)
        canvas.drawCentredString(W / 2, photo_y + photo_h / 2, address)

    # Bronze overlay strip at bottom of photo
    canvas.setFillColor(DARK)
    from reportlab.lib.colors import Color as RLColor
    # Semi-transparent gradient fade — use a thin dark band
    canvas.rect(0, photo_y, W, 18, fill=1, stroke=0)

    # ---- Report label above address ----
    label_y = photo_y - 22
    canvas.setFillColor(BRONZE)
    canvas.setFont(SANSBOLD, 7.5)
    canvas.drawCentredString(W / 2, label_y, 'PROPERTY ANALYSIS REPORT')

    # ---- Address ----
    addr_y = label_y - 32
    canvas.setFillColor(CREAM)
    canvas.setFont(SERIF, 22)
    # Wrap long addresses
    if len(address) > 42:
        parts = address.split(',')
        line1 = parts[0].strip() if parts else address
        line2 = ', '.join(p.strip() for p in parts[1:]) if len(parts) > 1 else ''
        canvas.drawCentredString(W / 2, addr_y + 14, line1)
        canvas.setFont(SERIF, 14)
        canvas.setFillColor(CREAM2)
        canvas.drawCentredString(W / 2, addr_y - 4, line2)
    else:
        canvas.drawCentredString(W / 2, addr_y, address)

    # ---- Price ----
    price_y = addr_y - 26
    canvas.setFillColor(BRONZE)
    canvas.setFont(SANSBOLD, 16)
    canvas.drawCentredString(W / 2, price_y, price)

    # ---- Property type ----
    if prop_type:
        canvas.setFillColor(TEXT_MUTED)
        canvas.setFont(SANSLIGHT, 8)
        canvas.drawCentredString(W / 2, price_y - 16, prop_type)

    # ---- Bronze divider ----
    div_y = price_y - 28
    canvas.setFillColor(BRONZE)
    canvas.rect(W / 2 - 60, div_y, 120, 0.75, fill=1, stroke=0)

    # ---- Score gauge ----
    gauge_cx = W / 2
    gauge_cy = div_y - 72
    draw_gauge_on_canvas(canvas, gauge_cx, gauge_cy, score, radius=58)

    # ---- Grade + Signal ----
    grade_y = gauge_cy - 76
    sc = score_color(score)
    canvas.setFillColor(sc)
    canvas.setFont(SANSBOLD, 10)
    canvas.drawCentredString(W / 2, grade_y,
                             f'Grade: {grade}   |   Score: {int(score)}/100')

    sig_color = signal_color(score)
    canvas.setFillColor(sig_color)
    canvas.setFont(SANSBOLD, 13)
    canvas.drawCentredString(W / 2, grade_y - 18, signal)

    # ---- Bottom panel: "Prepared by Shana" ----
    panel_h = 110
    panel_y = 38
    canvas.setFillColor(DARK2)
    canvas.rect(0, panel_y, W, panel_h, fill=1, stroke=0)

    # Bronze top border on panel
    canvas.setFillColor(BRONZE)
    canvas.rect(0, panel_y + panel_h - 1, W, 1, fill=1, stroke=0)

    # Shana's photo (left side of panel)
    photo_size = 82
    photo_x = 50
    photo_offset_y = panel_y + (panel_h - photo_size) / 2
    if os.path.exists(SHANA_PATH):
        try:
            canvas.drawImage(SHANA_PATH,
                             photo_x, photo_offset_y,
                             width=photo_size, height=photo_size,
                             preserveAspectRatio=True, anchor='c')
        except Exception:
            pass

    # Contact text (right of photo)
    tx = photo_x + photo_size + 22
    canvas.setFillColor(BRONZE)
    canvas.setFont(SANSBOLD, 7)
    canvas.drawString(tx, panel_y + panel_h - 24, 'PREPARED BY')

    canvas.setFillColor(CREAM)
    canvas.setFont(SERIF, 17)
    canvas.drawString(tx, panel_y + panel_h - 44, 'Shana Gates')

    canvas.setFillColor(CREAM2)
    canvas.setFont(SANS, 8.5)
    canvas.drawString(tx, panel_y + panel_h - 58, 'Craft & Bauer  |  Real Broker')

    canvas.setFillColor(BRONZE_LT)
    canvas.setFont(SANS, 8)
    canvas.drawString(tx, panel_y + panel_h - 72, 'shana@craftbauer.com')

    canvas.setFillColor(TEXT_MUTED)
    canvas.setFont(SANSLIGHT, 7.5)
    canvas.drawString(tx, panel_y + panel_h - 84, f'Coachella Valley, CA  |  {date_str}')

    # ---- Disclaimer ----
    canvas.setFillColor(TEXT_MUTED)
    canvas.setFont(SANSLIGHT, 6)
    canvas.drawCentredString(W / 2, 22, DISCLAIMER[:120] + '...')

    canvas.restoreState()


def _draw_image_cover(canvas, path, x, y, w, h):
    """Draw an image scaled to fill a bounding box (cover crop)."""
    try:
        canvas.drawImage(path, x, y, width=w, height=h,
                         preserveAspectRatio=False)
    except Exception:
        canvas.setFillColor(DARK3)
        canvas.rect(x, y, w, h, fill=1, stroke=0)


def draw_interior_page(canvas, doc):
    """Draw header + footer for interior pages — called as onLaterPages callback."""
    canvas.saveState()

    # ---- Page background ----
    canvas.setFillColor(PAGE_BG)
    canvas.rect(0, 0, W, H, fill=1, stroke=0)

    # ---- Header band ----
    hdr_h = 38
    canvas.setFillColor(DARK)
    canvas.rect(0, H - hdr_h, W, hdr_h, fill=1, stroke=0)

    # Bronze accent line below header
    canvas.setFillColor(BRONZE)
    canvas.rect(0, H - hdr_h - 1.5, W, 1.5, fill=1, stroke=0)

    # Header text left
    canvas.setFillColor(CREAM)
    canvas.setFont(SANS, 7.5)
    canvas.drawString(50, H - 23, 'PROPERTY ANALYSIS REPORT')

    # C&B logo in header (right)
    if os.path.exists(LOGO_PATH):
        try:
            canvas.drawImage(LOGO_PATH,
                             W - 118, H - hdr_h + 4,
                             width=88, height=28,
                             preserveAspectRatio=True, anchor='e', mask='auto')
        except Exception:
            canvas.setFillColor(BRONZE)
            canvas.setFont(SANSBOLD, 7)
            canvas.drawRightString(W - 50, H - 23, 'CRAFT & BAUER')

    # ---- Footer ----
    canvas.setFillColor(BRONZE)
    canvas.rect(50, 36, W - 100, 0.75, fill=1, stroke=0)

    canvas.setFillColor(TEXT_MID)
    canvas.setFont(SANS, 7)
    canvas.drawString(50, 23,
                      'Shana Gates  |  Craft & Bauer Real Broker  |  shana@craftbauer.com')
    canvas.drawRightString(W - 50, 23, f'Page {doc.page}')

    canvas.restoreState()


# ---------------------------------------------------------------------------
# Paragraph styles for interior pages
# ---------------------------------------------------------------------------
def get_styles():
    base = getSampleStyleSheet()
    return {
        'h1': ParagraphStyle('H1', fontName=SERIF, fontSize=22,
                             textColor=DARK, spaceBefore=8, spaceAfter=8, leading=28),
        'h2': ParagraphStyle('H2', fontName=SANSBOLD, fontSize=11,
                             textColor=BRONZE, spaceBefore=12, spaceAfter=5, leading=15),
        'body': ParagraphStyle('Body', fontName=SANS, fontSize=9,
                               textColor=TEXT_DARK, spaceAfter=5, leading=13),
        'small': ParagraphStyle('Small', fontName=SANSLIGHT, fontSize=8,
                                textColor=TEXT_MID, spaceAfter=3, leading=11),
        'caption': ParagraphStyle('Caption', fontName=SANSLIGHT, fontSize=7,
                                  textColor=TEXT_MUTED, spaceAfter=4, leading=10),
        'disclaimer': ParagraphStyle('Disc', fontName=SANSLIGHT, fontSize=7,
                                     textColor=TEXT_MUTED, spaceAfter=4, leading=10,
                                     spaceBefore=12),
        'signal': ParagraphStyle('Signal', fontName=SANSBOLD, fontSize=16,
                                 alignment=TA_CENTER, spaceAfter=8, leading=22),
        'score_badge': ParagraphStyle('ScoreBadge', fontName=SANSBOLD, fontSize=11,
                                      alignment=TA_CENTER, spaceAfter=8, leading=16),
        'rec': ParagraphStyle('Rec', fontName=SANS, fontSize=9,
                              textColor=TEXT_DARK, spaceAfter=5, leading=14,
                              leftIndent=0),
    }


def tbl_style(extra=None):
    cmds = [
        ('BACKGROUND',  (0, 0), (-1, 0),  HDR_BG),
        ('TEXTCOLOR',   (0, 0), (-1, 0),  CREAM),
        ('FONTNAME',    (0, 0), (-1, 0),  SANSBOLD),
        ('FONTSIZE',    (0, 0), (-1, -1), 8.5),
        ('GRID',        (0, 0), (-1, -1), 0.4, BORDER),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, ROW_ALT]),
        ('TEXTCOLOR',   (0, 1), (-1, -1), TEXT_DARK),
        ('VALIGN',      (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING',  (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 7),
    ]
    if extra:
        cmds.extend(extra)
    return TableStyle(cmds)


def bar_chart(categories, scores, width=480, height=None, bar_h=18, gap=10):
    """Horizontal bar chart drawing."""
    if height is None:
        height = len(categories) * (bar_h + gap) + 10
    d = Drawing(width, height)
    label_w = 165
    bar_x = label_w + 8
    bar_max = width - label_w - 70

    for i, (cat, sc) in enumerate(zip(categories, scores)):
        y = height - 15 - i * (bar_h + gap)
        # Label
        d.add(String(2, y + 4, cat, fontSize=8.5, fillColor=TEXT_DARK,
                     fontName=SANS, textAnchor='start'))
        # Background bar
        d.add(Rect(bar_x, y, bar_max, bar_h, fillColor=CREAM2,
                   strokeColor=None, rx=3))
        # Score bar
        bw = max(sc / 100 * bar_max, 3)
        d.add(Rect(bar_x, y, bw, bar_h, fillColor=score_color(sc),
                   strokeColor=None, rx=3))
        # Score label
        d.add(String(bar_x + bar_max + 6, y + 4,
                     f'{int(sc)}/100', fontSize=8.5,
                     fillColor=TEXT_DARK, fontName=SANSBOLD, textAnchor='start'))
    return d


# ---------------------------------------------------------------------------
# Page builders
# ---------------------------------------------------------------------------
def page_scores_and_comps(data, S):
    els = []
    overall = data.get('overall_score', 0)
    grade   = score_grade(overall)
    signal  = data.get('recommendation', {}).get('signal', score_signal(overall))

    # Score header
    els.append(Paragraph('Score Dashboard', S['h1']))

    # Score badge line
    sc = score_color(overall)
    sig_c = signal_color(overall)
    els.append(Paragraph(
        f'<font color="{sc.hexval()}"><b>{int(overall)}/100</b></font>'
        f'  &nbsp;·&nbsp;  Grade: <font color="{sc.hexval()}"><b>{grade}</b></font>'
        f'  &nbsp;·&nbsp;  <font color="{sig_c.hexval()}"><b>{signal}</b></font>',
        S['score_badge']
    ))
    els.append(Spacer(1, 6))

    # Category bar chart
    cats = data.get('categories', {})
    names  = list(cats.keys())
    scores = [cats[c].get('score', 50) if isinstance(cats[c], dict)
              else cats[c] for c in names]
    els.append(bar_chart(names, scores, width=480, bar_h=20, gap=10))
    els.append(Spacer(1, 10))

    # Score breakdown table
    tbl_data = [['Category', 'Score', 'Weight', 'Status']]
    for name, sc_val in zip(names, scores):
        weight = cats[name].get('weight', '—') if isinstance(cats[name], dict) else '—'
        status = 'Strong' if sc_val >= 70 else ('Mixed' if sc_val >= 40 else 'Weak')
        tbl_data.append([name, f'{int(sc_val)}/100', weight, status])

    extra = [('ALIGN', (1, 0), (-1, -1), 'CENTER')]
    for i, sv in enumerate(scores, 1):
        c = score_color(sv)
        extra += [('TEXTCOLOR', (3, i), (3, i), c),
                  ('FONTNAME',  (3, i), (3, i), SANSBOLD)]
    t = Table(tbl_data, colWidths=[175, 70, 60, 95])
    t.setStyle(tbl_style(extra))
    els.append(t)
    els.append(Spacer(1, 18))

    # Comp analysis
    els.append(Paragraph('Comparable Sales Analysis', S['h1']))

    comps = data.get('comps', [])
    if comps:
        tbl_data = [['Address', 'Sale Price', 'Sq Ft', '$/Sq Ft', 'Sold', 'Distance']]
        for c in comps:
            tbl_data.append([c.get('address', ''), c.get('price', ''),
                             c.get('sqft', ''), c.get('price_sqft', ''),
                             c.get('sold_date', ''), c.get('distance', '')])
        t = Table(tbl_data, colWidths=[132, 80, 55, 60, 66, 67])
        t.setStyle(tbl_style([('ALIGN', (1, 0), (-1, -1), 'CENTER')]))
        els.append(t)

    comp_s = data.get('comp_summary', {})
    if comp_s:
        els.append(Spacer(1, 6))
        els.append(Paragraph(
            f"<b>Comp Average:</b>  {comp_s.get('avg_price', '—')}  &nbsp;·&nbsp;  "
            f"<b>Avg $/Sq Ft:</b>  {comp_s.get('avg_price_sqft', '—')}",
            ParagraphStyle('CS', parent=S['body'], alignment=TA_CENTER)
        ))

    return els


def page_cashflow(data, S):
    els = []
    els.append(Paragraph('Cash Flow Projection', S['h1']))

    cf = data.get('cashflow', {})
    items = cf.get('items', [])
    if items:
        tbl_data = [['Item', 'Monthly', 'Annual']]
        for item in items:
            tbl_data.append([item.get('item', ''), item.get('monthly', ''),
                             item.get('annual', '')])
        last = len(items)
        extra = [
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
            ('FONTNAME', (0, last), (-1, last), SANSBOLD),
            ('BACKGROUND', (0, last), (-1, last), ROW_ALT),
            ('TOPPADDING', (0, last), (-1, last), 8),
            ('BOTTOMPADDING', (0, last), (-1, last), 8),
        ]
        # Color the net cash flow value
        net_val = items[-1].get('monthly', '')
        net_color = RED_NEG if net_val.startswith('-') else GREEN_POS
        extra.append(('TEXTCOLOR', (1, last), (2, last), net_color))
        t = Table(tbl_data, colWidths=[240, 110, 110])
        t.setStyle(tbl_style(extra))
        els.append(t)

    els.append(Spacer(1, 16))
    els.append(Paragraph('Investment Metrics', S['h1']))

    inv = data.get('investment_metrics', {})
    metric_rows = [
        ['Metric', 'Value', 'Assessment'],
        ['Cap Rate',             inv.get('cap_rate', '—'),    inv.get('cap_rate_status', '—')],
        ['Cash-on-Cash Return',  inv.get('cash_on_cash', '—'), inv.get('coc_status', '—')],
        ['Gross Rent Multiplier',inv.get('grm', '—'),         inv.get('grm_status', '—')],
        ['Debt Service Coverage',inv.get('dscr', '—'),        inv.get('dscr_status', '—')],
        ['1% Rule Check',        inv.get('one_pct', '—'),     inv.get('one_pct_status', '—')],
    ]
    t = Table(metric_rows, colWidths=[150, 80, 230])
    t.setStyle(tbl_style([('ALIGN', (1, 0), (1, -1), 'CENTER'),
                           ('VALIGN', (0, 0), (-1, -1), 'TOP')]))
    els.append(t)
    els.append(Spacer(1, 16))
    els.append(Paragraph('Mortgage Summary', S['h1']))

    mort = data.get('mortgage', {})
    mort_rows = [
        ['Parameter', 'Value'],
        ['Purchase Price',   mort.get('purchase_price', '—')],
        ['Down Payment',     mort.get('down_payment', '—')],
        ['Loan Amount',      mort.get('loan_amount', '—')],
        ['Interest Rate',    mort.get('rate', '—')],
        ['Loan Term',        mort.get('term', '—')],
        ['Monthly P&I',      mort.get('monthly_pi', '—')],
        ['Total Monthly',    mort.get('monthly_piti', '—')],
    ]
    extra = [('ALIGN', (1, 0), (1, -1), 'CENTER'),
             ('FONTNAME', (1, 6), (1, 7), SANSBOLD)]
    t = Table(mort_rows, colWidths=[160, 200])
    t.setStyle(tbl_style(extra))
    els.append(t)

    return els


def page_neighborhood(data, S):
    els = []
    els.append(Paragraph('Neighborhood Analysis', S['h1']))

    hood = data.get('neighborhood', {})
    hood_scores = hood.get('scores', {})
    if hood_scores:
        names  = list(hood_scores.keys())
        scores = list(hood_scores.values())
        els.append(bar_chart(names, scores, width=480, bar_h=18, gap=8))
        els.append(Spacer(1, 12))

    details = hood.get('details', [])
    if details:
        els.append(Paragraph('Neighborhood Details', S['h2']))
        tbl_data = [['Factor', 'Detail', 'Notes']]
        for d in details:
            tbl_data.append([
                d.get('factor', ''),
                d.get('detail', ''),
                Paragraph(d.get('notes', ''), S['small'])
            ])
        t = Table(tbl_data, colWidths=[120, 140, 200])
        t.setStyle(tbl_style([('VALIGN', (0, 0), (-1, -1), 'TOP')]))
        els.append(t)
        els.append(Spacer(1, 14))

    demo = hood.get('demographics', {})
    if demo:
        els.append(Paragraph('Demographics & Employers', S['h2']))
        demo_rows = [['Factor', 'Detail']]
        for k, v in demo.items():
            demo_rows.append([k.replace('_', ' ').title(), v])
        t = Table(demo_rows, colWidths=[160, 300])
        t.setStyle(tbl_style([('ALIGN', (1, 0), (1, -1), 'LEFT')]))
        els.append(t)

    return els


def page_investment(data, S):
    els = []
    els.append(Paragraph('Investment Analysis', S['h1']))

    strats = data.get('strategies', [])
    if strats:
        els.append(Paragraph('Strategy Comparison', S['h2']))
        tbl_data = [['Strategy', 'Projected Return', 'Timeframe', 'Key Risk']]
        for s in strats:
            tbl_data.append([
                s.get('strategy', ''),
                s.get('projected_return', ''),
                s.get('timeframe', ''),
                Paragraph(s.get('risk', ''), S['small'])
            ])
        t = Table(tbl_data, colWidths=[115, 110, 90, 145])
        t.setStyle(tbl_style([('VALIGN', (0, 0), (-1, -1), 'TOP'),
                               ('ALIGN', (1, 0), (2, -1), 'CENTER')]))
        els.append(t)
        els.append(Spacer(1, 14))

    proj = data.get('appreciation_projections', [])
    if proj:
        els.append(Paragraph('Appreciation Projections', S['h2']))
        tbl_data = [['Timeline', 'Conservative', 'Moderate', 'Aggressive']]
        for p in proj:
            tbl_data.append([p.get('year', ''), p.get('conservative', ''),
                             p.get('moderate', ''), p.get('aggressive', '')])
        extra = [('ALIGN', (1, 0), (-1, -1), 'CENTER'),
                 ('TEXTCOLOR', (3, 1), (3, -1), GREEN_POS),
                 ('FONTNAME', (3, 1), (3, -1), SANSBOLD)]
        t = Table(tbl_data, colWidths=[80, 130, 130, 120])
        t.setStyle(tbl_style(extra))
        els.append(t)
        els.append(Spacer(1, 14))

    scenes = data.get('scenarios', [])
    if scenes:
        els.append(Paragraph('Scenario Analysis', S['h2']))
        tbl_data = [['Scenario', 'Probability', 'Return', 'Trigger']]
        for sc in scenes:
            tbl_data.append([
                sc.get('scenario', ''), sc.get('probability', ''),
                sc.get('return', ''),
                Paragraph(sc.get('trigger', ''), S['small'])
            ])
        sc_extra = [('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ('ALIGN', (1, 0), (2, -1), 'CENTER')]
        if len(scenes) >= 3:
            sc_extra += [
                ('TEXTCOLOR', (2, 1), (2, 1), GREEN_POS),
                ('TEXTCOLOR', (2, 2), (2, 2), BRONZE),
                ('TEXTCOLOR', (2, 3), (2, 3), RED_NEG),
                ('FONTNAME', (2, 1), (2, 3), SANSBOLD),
            ]
        t = Table(tbl_data, colWidths=[90, 75, 115, 180])
        t.setStyle(tbl_style(sc_extra))
        els.append(t)

    return els


def page_recommendation(data, S):
    els = []
    els.append(Paragraph('Recommendation & Risk Factors', S['h1']))

    rec     = data.get('recommendation', {})
    overall = data.get('overall_score', 0)
    sig     = rec.get('signal', score_signal(overall))
    sig_c   = signal_color(overall)
    offer   = rec.get('suggested_offer', '—')
    summary = rec.get('summary', '—')
    actions = rec.get('action_items', [])

    # Signal + offer line
    sc_hex = score_color(overall).hexval()
    els.append(Paragraph(
        f'Signal: <font color="{sig_c.hexval()}"><b>{sig}</b></font>'
        f'&nbsp;&nbsp;·&nbsp;&nbsp;'
        f'Suggested Offer: <font color="{BRONZE.hexval()}"><b>{offer}</b></font>',
        ParagraphStyle('SigLine', parent=S['body'], fontSize=12,
                       fontName=SANSBOLD, alignment=TA_CENTER, spaceAfter=10)
    ))

    # Property score recap
    grade = score_grade(overall)
    els.append(Paragraph(
        f'Property Score: <font color="{sc_hex}"><b>{int(overall)}/100 — Grade {grade}</b></font>',
        ParagraphStyle('ScoreRecap', parent=S['body'], alignment=TA_CENTER,
                       spaceAfter=10, fontSize=10)
    ))

    # Summary paragraph
    els.append(Paragraph(summary, S['rec']))
    els.append(Spacer(1, 12))

    # Action items
    if actions:
        els.append(Paragraph('Action Items Before Purchase', S['h2']))
        for i, item in enumerate(actions, 1):
            els.append(Paragraph(f'{i}.  {item}', S['body']))
        els.append(Spacer(1, 12))

    # Risk table
    risks = data.get('risk_factors', [])
    if risks:
        els.append(Paragraph('Risk Assessment', S['h2']))
        tbl_data = [['Risk', 'Probability', 'Impact', 'Notes']]
        for r in risks:
            prob = r.get('probability', '—')
            imp  = r.get('impact', '—')
            tbl_data.append([
                r.get('factor', ''),
                prob, imp,
                Paragraph(r.get('notes', ''), S['small'])
            ])
        extra = [('VALIGN', (0, 0), (-1, -1), 'TOP'),
                 ('ALIGN', (1, 0), (2, -1), 'CENTER')]
        # Color high/medium/low probability
        for i, r in enumerate(risks, 1):
            p = r.get('probability', '')
            c = RED_NEG if 'High' in p or 'Certain' in p else (BRONZE if 'Medium' in p else GREEN_POS)
            extra.append(('TEXTCOLOR', (1, i), (1, i), c))
            extra.append(('FONTNAME', (1, i), (1, i), SANSBOLD))
        t = Table(tbl_data, colWidths=[115, 75, 65, 205])
        t.setStyle(tbl_style(extra))
        els.append(t)

    els.append(Spacer(1, 16))
    els.append(Paragraph(DISCLAIMER, S['disclaimer']))

    return els


# ---------------------------------------------------------------------------
# Main report generator
# ---------------------------------------------------------------------------
def generate_report(data, output_path):
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        leftMargin=50,
        rightMargin=50,
        topMargin=70,
        bottomMargin=70,
    )

    # Attach data so canvas callbacks can access it
    doc._brand_data = data

    S = get_styles()

    # Interior content — cover is drawn entirely by the canvas callback
    elements = [PageBreak()]   # page 1 = cover (canvas only); content starts p.2

    elements += page_scores_and_comps(data, S)
    elements.append(PageBreak())

    elements += page_cashflow(data, S)
    elements.append(PageBreak())

    elements += page_neighborhood(data, S)
    elements.append(PageBreak())

    elements += page_investment(data, S)
    elements.append(PageBreak())

    elements += page_recommendation(data, S)

    doc.build(elements,
              onFirstPage=draw_cover_page,
              onLaterPages=draw_interior_page)

    return output_path


# ---------------------------------------------------------------------------
# Demo data
# ---------------------------------------------------------------------------
def get_demo_data():
    return {
        'address':       '4821 Ridgeview Drive, Austin, TX 78735',
        'price':         '$425,000',
        'date':          datetime.now().strftime('%B %d, %Y'),
        'overall_score': 72,
        'property_details': {
            'beds': '3', 'baths': '2', 'sqft': '1,850',
            'year_built': '1998', 'lot_size': '0.18 acres',
            'property_type': 'Single Family Residence',
        },
        'categories': {
            'Value & Comps':       {'score': 74, 'weight': '25%'},
            'Income Potential':    {'score': 62, 'weight': '20%'},
            'Neighborhood Quality':{'score': 78, 'weight': '20%'},
            'Investment Upside':   {'score': 72, 'weight': '20%'},
            'Market Conditions':   {'score': 68, 'weight': '15%'},
        },
        'comps': [
            {'address': '135 Oak Ave', 'price': '$412,000', 'sqft': '1,780',
             'price_sqft': '$231', 'sold_date': 'Mar 2026', 'distance': '0.3 mi'},
            {'address': '204 Elm St', 'price': '$438,500', 'sqft': '1,920',
             'price_sqft': '$228', 'sold_date': 'Feb 2026', 'distance': '0.5 mi'},
        ],
        'comp_summary': {'avg_price': '$425,250', 'avg_price_sqft': '$229/sq ft'},
        'cashflow': {'items': [
            {'item': 'Gross Rental Income', 'monthly': '$2,200', 'annual': '$26,400'},
            {'item': 'Vacancy Loss (8%)',   'monthly': '-$176',  'annual': '-$2,112'},
            {'item': 'Effective Gross Income','monthly': '$2,024', 'annual': '$24,288'},
            {'item': 'Mortgage (P&I)',       'monthly': '-$1,285','annual': '-$15,420'},
            {'item': 'Property Taxes',       'monthly': '-$354',  'annual': '-$4,250'},
            {'item': 'Insurance',            'monthly': '-$125',  'annual': '-$1,500'},
            {'item': 'Maintenance (5%)',     'monthly': '-$110',  'annual': '-$1,320'},
            {'item': 'Property Mgmt (10%)',  'monthly': '-$202',  'annual': '-$2,429'},
            {'item': 'Net Cash Flow',        'monthly': '-$52',   'annual': '-$631'},
        ]},
        'investment_metrics': {
            'cap_rate': '5.2%', 'cap_rate_status': 'Fair — above 5% threshold',
            'cash_on_cash': '3.8%', 'coc_status': 'Below average — aim for 8%+',
            'grm': '16.1x', 'grm_status': 'Average for metro area',
            'dscr': '1.05', 'dscr_status': 'Tight — lenders prefer 1.25+',
            'one_pct': '0.52%', 'one_pct_status': 'Below 1% — appreciation market',
        },
        'mortgage': {
            'purchase_price': '$425,000', 'down_payment': '$85,000 (20%)',
            'loan_amount': '$340,000', 'rate': '6.75%', 'term': '30-year fixed',
            'monthly_pi': '$2,205', 'monthly_piti': '$2,684',
        },
        'neighborhood': {
            'scores': {'Schools': 78, 'Safety': 72, 'Walkability': 65,
                       'Demographics': 70, 'Growth': 88},
            'details': [
                {'factor': 'Schools', 'detail': 'Austin ISD — 7/10',
                 'notes': 'Strong elementary, mixed middle school options'},
                {'factor': 'Crime', 'detail': '22% below city avg',
                 'notes': 'Property crime trending down 3 years'},
            ],
            'demographics': {'Population Growth': '+8.2% (5-yr)',
                             'Major Employers': 'Tech, University, Healthcare'},
        },
        'strategies': [
            {'strategy': 'Buy & Hold', 'projected_return': '7-9% annually',
             'timeframe': '5-10 years', 'risk': 'Vacancy, maintenance, market downturn'},
            {'strategy': 'Fix & Flip', 'projected_return': '$35K-55K profit',
             'timeframe': '4-6 months', 'risk': 'Market timing, rehab costs'},
        ],
        'appreciation_projections': [
            {'year': 'Year 1', 'conservative': '$429,250', 'moderate': '$438,750', 'aggressive': '$451,250'},
            {'year': 'Year 5', 'conservative': '$458,240', 'moderate': '$500,645', 'aggressive': '$565,820'},
            {'year': 'Year 10','conservative': '$510,650', 'moderate': '$601,810', 'aggressive': '$762,430'},
        ],
        'scenarios': [
            {'scenario': 'Bull Case', 'probability': '25%', 'return': '+25-40% (5yr)',
             'trigger': 'Tech boom, rate cuts, low inventory'},
            {'scenario': 'Base Case', 'probability': '50%', 'return': '+10-20% (5yr)',
             'trigger': 'Steady appreciation, stable rental market'},
            {'scenario': 'Bear Case', 'probability': '25%', 'return': '-5 to -15% (5yr)',
             'trigger': 'Layoffs, oversupply, rate hikes'},
        ],
        'recommendation': {
            'signal': 'BUY',
            'summary': 'This property presents a solid buy-and-hold opportunity in a high-growth neighborhood with strong appreciation trajectory and positive cash flow fundamentals.',
            'suggested_offer': '$405,000 – $415,000',
            'action_items': [
                'Get a professional inspection — check roof, HVAC, and foundation',
                'Verify rental estimates with 3 local property managers',
                'Confirm flood zone status and get insurance quotes',
            ],
        },
        'risk_factors': [
            {'factor': 'Market Risk', 'probability': 'Medium', 'impact': 'High',
             'notes': 'Cyclical market risk — monitor inventory levels'},
            {'factor': 'Vacancy Risk', 'probability': 'Low-Medium', 'impact': 'Medium',
             'notes': 'Strong rental demand but thin cash flow margin'},
        ],
    }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
def main():
    if len(sys.argv) < 2 or sys.argv[1] == '--demo':
        data = get_demo_data()
        out  = 'PROPERTY-REPORT-sample.pdf'
        generate_report(data, out)
        print(f'Sample report generated: {out}')
        return

    input_file  = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else 'PROPERTY-REPORT.pdf'

    with open(input_file) as f:
        data = json.load(f)

    generate_report(data, output_file)
    print(f'Report generated: {output_file}')


if __name__ == '__main__':
    main()
