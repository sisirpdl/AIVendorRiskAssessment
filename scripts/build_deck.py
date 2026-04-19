"""Build baseline VerifAI pitch deck as .pptx.

Theme: slate-950 background, yellow-300 accent, white text.
Leaves placeholder text boxes where the user will drop logo + images.
"""

import io
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.util import Emu, Inches, Pt

# --- Theme ---------------------------------------------------------------

BG = RGBColor(0x0B, 0x11, 0x1F)         # slate-950-ish
SURFACE = RGBColor(0x15, 0x1C, 0x2C)    # slate-900
ELEVATED = RGBColor(0x1E, 0x27, 0x3A)   # slate-800
TEXT = RGBColor(0xE7, 0xEC, 0xF5)       # off-white
MUTED = RGBColor(0x93, 0xA0, 0xB8)      # slate-400
ACCENT = RGBColor(0xFA, 0xDC, 0x3C)     # yellow-300
GOOD = RGBColor(0x34, 0xD3, 0x99)       # emerald-400
WARN = RGBColor(0xF5, 0xB3, 0x4C)       # amber-400
DANGER = RGBColor(0xF4, 0x3F, 0x5E)     # rose-500

SLIDE_W = Inches(13.333)
SLIDE_H = Inches(7.5)

prs = Presentation()
prs.slide_width = SLIDE_W
prs.slide_height = SLIDE_H

BLANK = prs.slide_layouts[6]

# --- helpers -------------------------------------------------------------


def add_bg(slide, color=BG):
    rect = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, SLIDE_W, SLIDE_H)
    rect.line.fill.background()
    rect.fill.solid()
    rect.fill.fore_color.rgb = color
    rect.shadow.inherit = False
    return rect


def add_rect(slide, x, y, w, h, color, line=False):
    shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, y, w, h)
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    if not line:
        shape.line.fill.background()
    else:
        shape.line.color.rgb = ACCENT
        shape.line.width = Pt(1)
    shape.shadow.inherit = False
    return shape


def add_text(
    slide,
    x,
    y,
    w,
    h,
    text,
    *,
    size=18,
    bold=False,
    color=TEXT,
    align=PP_ALIGN.LEFT,
    anchor=MSO_ANCHOR.TOP,
    font="Calibri",
):
    tb = slide.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = Emu(0)
    tf.margin_right = Emu(0)
    tf.margin_top = Emu(0)
    tf.margin_bottom = Emu(0)
    tf.vertical_anchor = anchor

    lines = text.split("\n") if isinstance(text, str) else text
    for i, line in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        run = p.add_run()
        run.text = line
        run.font.name = font
        run.font.size = Pt(size)
        run.font.bold = bold
        run.font.color.rgb = color
    return tb


def add_accent_bar(slide, x, y, w=Inches(0.08), h=Inches(0.5)):
    bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, y, w, h)
    bar.fill.solid()
    bar.fill.fore_color.rgb = ACCENT
    bar.line.fill.background()
    bar.shadow.inherit = False
    return bar


def add_footer(slide, page_num, total):
    add_text(
        slide,
        Inches(0.5),
        Inches(7.1),
        Inches(6),
        Inches(0.3),
        "VerifAI — AI-native Vendor Risk for MSPs",
        size=10,
        color=MUTED,
    )
    add_text(
        slide,
        Inches(11.3),
        Inches(7.1),
        Inches(1.6),
        Inches(0.3),
        f"{page_num} / {total}",
        size=10,
        color=MUTED,
        align=PP_ALIGN.RIGHT,
    )


def add_header(slide, kicker, title):
    add_accent_bar(slide, Inches(0.5), Inches(0.55), h=Inches(0.32))
    add_text(
        slide,
        Inches(0.75),
        Inches(0.5),
        Inches(10),
        Inches(0.35),
        kicker.upper(),
        size=11,
        bold=True,
        color=ACCENT,
    )
    add_text(
        slide,
        Inches(0.5),
        Inches(0.9),
        Inches(12),
        Inches(0.7),
        title,
        size=32,
        bold=True,
        color=TEXT,
    )


def add_image_from_buf(slide, buf, x, y, w, h):
    buf.seek(0)
    slide.shapes.add_picture(buf, x, y, w, h)


def make_market_chart() -> io.BytesIO:
    """Horizontal funnel-style bar chart: TAM → SAM → beachhead."""
    bg = "#0B111F"
    surface = "#151C2C"
    yellow = "#FADC3C"
    amber = "#F5B34C"
    good = "#34D399"
    text_col = "#E7ECF5"
    muted = "#93A0B8"

    labels = [
        "Global Managed\nServices (TAM)",
        "TPRM Software\nMarket (SAM)",
        "MSP-native\nVendor Risk (SOM)",
    ]
    values = [595, 8.57, 0.8]   # $B — SOM estimated beachhead
    colors = [muted, amber, yellow]
    bar_labels = ["$595B", "$8.6B", "~$800M"]
    notes = ["13% YoY growth · Canalys 2025", "→ $37B by 2035 · MarketsandMarkets", "Our beachhead · MSP-native wedge"]

    fig, ax = plt.subplots(figsize=(6.4, 3.6))
    fig.patch.set_facecolor(bg)
    ax.set_facecolor(bg)

    max_v = values[0]
    bar_h = 0.52
    y_pos = [2, 1, 0]

    for i, (val, label, col, blabel, note) in enumerate(
        zip(values, labels, colors, bar_labels, notes)
    ):
        w_frac = val / max_v
        ax.barh(y_pos[i], w_frac, height=bar_h, color=col, zorder=3, left=0)
        # big value label inside bar
        ax.text(
            w_frac / 2, y_pos[i], blabel,
            ha="center", va="center",
            fontsize=14, fontweight="bold", color=bg,
            zorder=4,
        )
        # category label to the right
        ax.text(
            w_frac + 0.01, y_pos[i] + 0.18,
            label.replace("\n", " "),
            ha="left", va="center",
            fontsize=9, color=text_col, zorder=4,
        )
        ax.text(
            w_frac + 0.01, y_pos[i] - 0.18,
            note,
            ha="left", va="center",
            fontsize=7.5, color=muted, style="italic", zorder=4,
        )

    ax.set_xlim(0, 1.55)
    ax.set_ylim(-0.55, 2.75)
    ax.axis("off")

    # subtle grid lines
    for xv in [0.25, 0.5, 0.75, 1.0]:
        ax.axvline(xv, color=surface, linewidth=0.6, zorder=1)

    fig.tight_layout(pad=0.3)
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=160, bbox_inches="tight", facecolor=bg)
    plt.close(fig)
    return buf


def add_placeholder_box(slide, x, y, w, h, label="[ image ]"):
    box = add_rect(slide, x, y, w, h, SURFACE)
    box.line.color.rgb = MUTED
    box.line.width = Pt(0.75)
    box.line.dash_style = 7  # dashed
    add_text(
        slide,
        x,
        y,
        w,
        h,
        label,
        size=11,
        color=MUTED,
        align=PP_ALIGN.CENTER,
        anchor=MSO_ANCHOR.MIDDLE,
    )
    return box


# --- slide builders ------------------------------------------------------

SLIDES = []


def slide(fn):
    SLIDES.append(fn)
    return fn


@slide
def s_title(s):
    add_bg(s)
    # soft grid accent in corner
    for i in range(6):
        add_rect(
            s,
            Inches(11.5 + i * 0.25),
            Inches(0.4),
            Inches(0.04),
            Inches(0.6),
            ELEVATED,
        )
    add_placeholder_box(s, Inches(0.5), Inches(0.5), Inches(1.4), Inches(1.4), "[ logo ]")

    add_accent_bar(s, Inches(0.5), Inches(3.0), h=Inches(0.6))
    add_text(
        s,
        Inches(0.75),
        Inches(2.95),
        Inches(12),
        Inches(0.5),
        "VERIFAI",
        size=14,
        bold=True,
        color=ACCENT,
    )
    add_text(
        s,
        Inches(0.5),
        Inches(3.55),
        Inches(12),
        Inches(1.3),
        "Vendor risk, verified —\nin the receipts, not the vibes.",
        size=46,
        bold=True,
        color=TEXT,
    )
    add_text(
        s,
        Inches(0.5),
        Inches(5.2),
        Inches(12),
        Inches(0.6),
        "An AI-native Vendor Risk Assessment platform built for the MSPs who actually sign the questionnaires.",
        size=18,
        color=MUTED,
    )
    add_text(
        s,
        Inches(0.5),
        Inches(6.6),
        Inches(12),
        Inches(0.4),
        "Ignite Hackathon   ·   Team VerifAI",
        size=12,
        color=MUTED,
    )


@slide
def s_story(s):
    add_bg(s)
    add_header(s, "A true story (roughly)", "The professor and the CSOC friend")

    # left: narrative
    add_text(
        s,
        Inches(0.5),
        Inches(1.8),
        Inches(7.2),
        Inches(5),
        [
            "I'm a professor.",
            "I want a quantum computer for my research.",
            "",
            "The vendor sends back a 260-question security questionnaire.",
            "",
            "So my friend — who works at our university's CSOC — spends his Saturday filling it out.",
            "By hand. In a spreadsheet. Copy-pasting from three PDFs he only half-trusts.",
            "",
            "He is smart. He is tired. And he is not scalable.",
        ],
        size=20,
        color=TEXT,
    )

    # right: placeholder meme / photo
    add_placeholder_box(
        s, Inches(8.2), Inches(1.8), Inches(4.6), Inches(4.8), "[ meme / photo: tired CSOC friend ]"
    )

    add_text(
        s,
        Inches(0.5),
        Inches(6.7),
        Inches(12),
        Inches(0.4),
        'Every "new tool" request in every org starts with a version of this Saturday.',
        size=14,
        bold=True,
        color=ACCENT,
    )
    add_footer(s, 2, 16)


@slide
def s_problem(s):
    add_bg(s)
    add_header(s, "Zoom out", "This Saturday is happening everywhere")

    # top row: visceral problem stats
    cards = [
        ("627", "questions in SIG Core 2025. CAIQ v4: 261. SIG Detail: 1,936.", DANGER, "Shared Assessments 2025"),
        ("40 hrs", "to fill one questionnaire manually — sometimes weeks of back-and-forth.", WARN, "Steerlab 2024"),
        ("× 122", "clients per MSP on average. That's 4,880 hrs a year on paperwork.", WARN, "Datto State of the MSP 2024"),
        ("$4.91M", "average cost when the wrong vendor slips through the cracks.", DANGER, "IBM Cost of Data Breach 2024"),
    ]
    x0 = Inches(0.5)
    y0 = Inches(1.9)
    cw = Inches(3.0)
    ch = Inches(2.55)
    gap = Inches(0.15)
    for i, (big, sub, accent_c, src) in enumerate(cards):
        x = x0 + (cw + gap) * i
        add_rect(s, x, y0, cw, ch, SURFACE)
        add_accent_bar(s, x, y0, w=Inches(0.06), h=ch)
        add_text(s, x + Inches(0.25), y0 + Inches(0.25), cw, Inches(0.9), big, size=32, bold=True, color=accent_c)
        add_text(s, x + Inches(0.25), y0 + Inches(1.1), cw - Inches(0.35), Inches(1.15), sub, size=13, color=TEXT)
        add_text(s, x + Inches(0.25), y0 + Inches(2.3), cw - Inches(0.35), Inches(0.25), src, size=9, color=MUTED)

    # before / after row
    y2 = Inches(4.7)
    bw = Inches(6.0)
    add_rect(s, Inches(0.5), y2, bw, Inches(1.6), SURFACE)
    add_accent_bar(s, Inches(0.5), y2, w=Inches(0.06), h=Inches(1.6))
    add_text(s, Inches(0.75), y2 + Inches(0.2), bw - Inches(0.4), Inches(0.45), "WITHOUT AUTOMATION", size=11, bold=True, color=DANGER)
    add_text(s, Inches(0.75), y2 + Inches(0.65), bw - Inches(0.4), Inches(0.85), "3 hours per questionnaire · multi-week back-and-forth · CSOC friend's Saturday gone", size=14, color=TEXT)

    add_rect(s, Inches(6.8), y2, bw, Inches(1.6), SURFACE)
    add_accent_bar(s, Inches(6.8), y2, w=Inches(0.06), h=Inches(1.6))
    add_text(s, Inches(7.05), y2 + Inches(0.2), bw - Inches(0.4), Inches(0.45), "WITH AUTOMATION", size=11, bold=True, color=GOOD)
    add_text(s, Inches(7.05), y2 + Inches(0.65), bw - Inches(0.4), Inches(0.85), "30 minutes · cited evidence · no hallucinations · 80% faster (Steerlab 2024 case study)", size=14, color=TEXT)

    add_footer(s, 3, 16)


@slide
def s_stakes(s):
    add_bg(s)
    add_header(s, "Why this is not just paperwork", "The downstream cost of a bad answer")

    add_placeholder_box(s, Inches(0.5), Inches(1.9), Inches(5.5), Inches(4.8), "[ chart: breach cost trend ]")

    stats = [
        ("$4.88M", "average breach cost in 2024 (+10% YoY)"),
        ("15%", "of all breaches originate in a third party"),
        ("$4.91M", "average cost of a supply-chain breach"),
        ("267 days", "to detect and contain a third-party breach"),
    ]
    y = Inches(1.9)
    for big, sub in stats:
        add_rect(s, Inches(6.3), y, Inches(6.5), Inches(1.0), SURFACE)
        add_accent_bar(s, Inches(6.3), y, w=Inches(0.06), h=Inches(1.0))
        add_text(s, Inches(6.55), y + Inches(0.12), Inches(2.3), Inches(0.75), big, size=24, bold=True, color=ACCENT, anchor=MSO_ANCHOR.MIDDLE)
        add_text(s, Inches(8.9), y + Inches(0.12), Inches(3.8), Inches(0.85), sub, size=13, color=TEXT, anchor=MSO_ANCHOR.MIDDLE)
        y += Inches(1.15)

    add_text(
        s,
        Inches(0.5),
        Inches(6.85),
        Inches(12.3),
        Inches(0.35),
        "Source: IBM Cost of a Data Breach Report 2024",
        size=10,
        color=MUTED,
    )
    add_footer(s, 4, 16)


@slide
def s_market(s):
    add_bg(s)
    add_header(s, "Market", "A $600B service market sitting on top of an $8B tool market")

    # left: chart
    chart_buf = make_market_chart()
    add_image_from_buf(s, chart_buf, Inches(0.4), Inches(1.85), Inches(7.0), Inches(3.95))

    # right: supporting stats
    stats = [
        ("64%", "of SMBs use at least one MSP", "CompTIA"),
        ("~122", "clients per MSP on average", "Datto 2024"),
        ("13%", "YoY managed services growth", "Canalys 2025"),
        ("14.2%", "TPRM software CAGR to 2035", "MarketsandMarkets"),
    ]
    y = Inches(1.85)
    for big, sub, src in stats:
        add_rect(s, Inches(7.7), y, Inches(5.1), Inches(0.87), SURFACE)
        add_accent_bar(s, Inches(7.7), y, w=Inches(0.06), h=Inches(0.87))
        add_text(s, Inches(7.95), y, Inches(1.5), Inches(0.87), big, size=22, bold=True, color=ACCENT, anchor=MSO_ANCHOR.MIDDLE)
        add_text(s, Inches(9.5), y, Inches(2.7), Inches(0.65), sub, size=12, color=TEXT, anchor=MSO_ANCHOR.MIDDLE)
        add_text(s, Inches(9.5), y + Inches(0.6), Inches(3.2), Inches(0.27), src, size=9, color=MUTED)
        y += Inches(0.97)

    add_text(
        s,
        Inches(0.4),
        Inches(6.05),
        Inches(12.4),
        Inches(0.5),
        "The tooling layer is a fraction of the services it sits inside.  We want both.",
        size=13,
        bold=True,
        color=ACCENT,
    )
    add_footer(s, 5, 16)


@slide
def s_wedge(s):
    add_bg(s)
    add_header(s, "The wedge", "Why MSPs are the beachhead — not mid-market SaaS")

    # Left column: why MSPs
    add_text(s, Inches(0.5), Inches(1.9), Inches(6.1), Inches(0.5), "Why the MSP channel", size=18, bold=True, color=ACCENT)
    add_text(
        s,
        Inches(0.5),
        Inches(2.4),
        Inches(6.1),
        Inches(4.5),
        [
            "• One MSP = ~122 SMB clients in one account.",
            "• SMBs can't afford Vanta at $28K/yr each — but they all need answers.",
            "• MSPs are already paid to hold the compliance pen.",
            "• Multi-tenant by definition — no auth rewrite, no per-seat sales.",
            "• MSPs talk to each other. One design-partner logo unlocks ten more.",
        ],
        size=16,
        color=TEXT,
    )

    # Right column: what's wrong with today
    add_text(s, Inches(7.1), Inches(1.9), Inches(5.7), Inches(0.5), "Why today's tools miss it", size=18, bold=True, color=ACCENT)
    add_text(
        s,
        Inches(7.1),
        Inches(2.4),
        Inches(5.7),
        Inches(4.5),
        [
            "• Vanta / Drata / Secureframe all added MSP channels since 2023 —",
            "  but their product is still architected for ONE tenant pursuing SOC 2.",
            "• MSPs get a reselling wrapper, not a native console.",
            "• MSP-native tools (Compliance Scorecard, Apptega, ControlMap)",
            "  do framework mapping — not vendor questionnaires, not visual evidence.",
            "• Nobody is MSP-first AND AI-native AND evidence-anchored.",
        ],
        size=14,
        color=TEXT,
    )
    add_footer(s, 6, 16)


@slide
def s_product(s):
    add_bg(s)
    add_header(s, "Product", "What VerifAI actually does")

    # three pillars
    pillars = [
        (
            "Visual evidence",
            "Every AI answer highlights the exact rectangle in the source PDF it came from. Auditors click and see proof.",
            "BBox overlay",
        ),
        (
            "Refuses to hallucinate",
            "If the evidence isn't in the document, VerifAI says INFORMATION_NOT_FOUND. Not a guess. Not a vibe.",
            "IDK enforcement",
        ),
        (
            "Cross-client delta",
            "When a vendor reships its SOC 2, we diff v1 vs v2 across every client that trusts that vendor.",
            "Delta engine",
        ),
    ]
    x0 = Inches(0.5)
    y0 = Inches(1.9)
    cw = Inches(4.1)
    ch = Inches(4.4)
    gap = Inches(0.15)
    for i, (h, body, tag) in enumerate(pillars):
        x = x0 + (cw + gap) * i
        add_rect(s, x, y0, cw, ch, SURFACE)
        add_accent_bar(s, x, y0, w=Inches(0.08), h=ch)
        add_text(s, x + Inches(0.3), y0 + Inches(0.3), cw - Inches(0.5), Inches(0.4), tag.upper(), size=11, bold=True, color=ACCENT)
        add_text(s, x + Inches(0.3), y0 + Inches(0.75), cw - Inches(0.5), Inches(0.8), h, size=22, bold=True, color=TEXT)
        add_text(s, x + Inches(0.3), y0 + Inches(1.8), cw - Inches(0.5), Inches(2.4), body, size=14, color=TEXT)

    add_text(
        s,
        Inches(0.5),
        Inches(6.6),
        Inches(12.3),
        Inches(0.5),
        "Two sides of the platform: MSP Seller uploads Trust Packages.  Auditor / Buyer sees a verified posture.",
        size=14,
        color=MUTED,
    )
    add_footer(s, 7, 16)


@slide
def s_demo(s):
    add_bg(s)
    add_header(s, "The demo moment", "Click an answer → see the proof")

    # screenshot / mockup placeholder
    add_placeholder_box(s, Inches(0.5), Inches(1.9), Inches(12.3), Inches(4.5), "[ product screenshot: split-screen with neon yellow bbox ]")

    add_text(
        s,
        Inches(0.5),
        Inches(6.55),
        Inches(12.3),
        Inches(0.8),
        [
            "Answer card → PDF jumps to the right page → yellow box lands on the exact sentence.",
            "Every answer is either cited, or marked INFORMATION_NOT_FOUND. There is no third state.",
        ],
        size=14,
        color=TEXT,
    )
    add_footer(s, 8, 16)


@slide
def s_comp(s):
    add_bg(s)
    add_header(s, "Where we sit", "A gap nobody has claimed")

    # 2×2 matrix
    MX = Inches(1.2)     # matrix left
    MY = Inches(1.75)    # matrix top
    MW = Inches(9.0)     # matrix width
    MH = Inches(5.2)     # matrix height
    HW = MW / 2
    HH = MH / 2

    # quadrant fills
    quad_colors = [SURFACE, SURFACE, SURFACE, ELEVATED]  # TL, TR, BL, BR
    for qi, (dx, dy) in enumerate([(0, 0), (HW, 0), (0, HH), (HW, HH)]):
        add_rect(s, MX + dx, MY + dy, HW, HH, quad_colors[qi])

    # axis lines
    center_x = MX + HW
    center_y = MY + HH
    # horizontal axis
    h_line = add_rect(s, MX, center_y - Inches(0.01), MW, Inches(0.02), MUTED)
    # vertical axis
    v_line = add_rect(s, center_x - Inches(0.01), MY, Inches(0.02), MH, MUTED)

    # axis labels
    add_text(s, MX, MY + MH + Inches(0.1), HW, Inches(0.4), "← Enterprise-first / per-tenant", size=11, color=MUTED)
    add_text(s, MX + HW, MY + MH + Inches(0.1), HW, Inches(0.4), "MSP-native / multi-client →", size=11, color=MUTED, align=PP_ALIGN.RIGHT)
    add_text(s, MX - Inches(0.9), MY, Inches(0.85), HH, "Evidence-\ncited ↑", size=11, color=MUTED, align=PP_ALIGN.RIGHT, anchor=MSO_ANCHOR.MIDDLE)
    add_text(s, MX - Inches(0.9), MY + HH, Inches(0.85), HH, "Trust-\nthe-AI ↓", size=11, color=MUTED, align=PP_ALIGN.RIGHT, anchor=MSO_ANCHOR.MIDDLE)

    # quadrant name labels (faint)
    add_text(s, MX + Inches(0.2), MY + Inches(0.15), HW - Inches(0.4), Inches(0.4), "CITED + ENTERPRISE", size=9, bold=True, color=ELEVATED)
    add_text(s, MX + HW + Inches(0.2), MY + Inches(0.15), HW - Inches(0.4), Inches(0.4), "CITED + MSP-NATIVE", size=9, bold=True, color=ELEVATED)
    add_text(s, MX + Inches(0.2), MY + HH + Inches(0.15), HW - Inches(0.4), Inches(0.4), "AUTO-FILL + ENTERPRISE", size=9, bold=True, color=ELEVATED)
    add_text(s, MX + HW + Inches(0.2), MY + HH + Inches(0.15), HW - Inches(0.4), Inches(0.4), "AUTO-FILL + MSP-NATIVE", size=9, bold=True, color=ELEVATED)

    # player dots
    def dot(x, y, label, color, size_pt=11, bold=False):
        r = Inches(0.12)
        circle = s.shapes.add_shape(MSO_SHAPE.OVAL, x - r, y - r, r * 2, r * 2)
        circle.fill.solid()
        circle.fill.fore_color.rgb = color
        circle.line.fill.background()
        add_text(s, x + Inches(0.18), y - Inches(0.15), Inches(2.0), Inches(0.35), label, size=size_pt, bold=bold, color=color)

    # Enterprise-first + cited (TL) — nobody really here well
    dot(MX + HW * 0.25, MY + HH * 0.45, "Vanta / Drata\n(text citations only)", MUTED, size_pt=10)
    # Enterprise-first + auto-fill (BL)
    dot(MX + HW * 0.6, MY + HH + HH * 0.55, "Questionnaire\nauto-fill tools", MUTED, size_pt=10)
    # MSP-native + auto-fill / framework (BR)
    dot(MX + HW + HW * 0.25, MY + HH + HH * 0.45, "Compliance Scorecard\nApptega · Cynomi", MUTED, size_pt=10)
    # VerifAI: MSP-native + cited (TR) — the gap
    dot(MX + HW + HW * 0.55, MY + HH * 0.35, "VerifAI", ACCENT, size_pt=13, bold=True)

    # "empty space" callout
    add_rect(s, MX + HW + Inches(0.15), MY + Inches(0.55), HW - Inches(0.35), HH - Inches(0.8), ELEVATED)
    box = s.shapes[-1]
    box.line.color.rgb = ACCENT
    box.line.width = Pt(1.2)
    add_text(s, MX + HW + Inches(0.3), MY + Inches(1.1), HW - Inches(0.65), Inches(0.6), "← the unclaimed space", size=11, bold=True, color=ACCENT)

    # right-side callout panel
    add_rect(s, Inches(10.5), MY, Inches(2.6), MH, SURFACE)
    add_accent_bar(s, Inches(10.5), MY, w=Inches(0.06), h=MH)
    add_text(s, Inches(10.75), MY + Inches(0.25), Inches(2.2), Inches(0.45), "WHY IT MATTERS", size=10, bold=True, color=ACCENT)
    add_text(
        s,
        Inches(10.75),
        MY + Inches(0.75),
        Inches(2.2),
        Inches(4.0),
        [
            "Every tool you've heard of lives in the bottom-left or bottom-right.",
            "",
            "Visual, coordinate-level evidence citation + MSP-native multi-client architecture = nobody is here yet.",
            "",
            "That's VerifAI's white space.",
        ],
        size=12,
        color=TEXT,
    )
    add_footer(s, 9, 16)


@slide
def s_moat(s):
    add_bg(s)
    add_header(s, "Why we win", "Two axes nobody else covers")

    left = [
        "1.  Bounding-box evidence",
        "     Tie every AI answer to a pixel region on the source PDF.",
        "     Auditors defend it. CSOs trust it. Nobody else ships this.",
        "",
        "2.  Cross-client delta engine",
        '     "This vendor\'s SOC 2 changed in 3 controls.',
        '      It affects 14 of your 122 clients."',
        "     Today this question has no tool that can answer it.",
    ]
    add_text(s, Inches(0.5), Inches(1.9), Inches(8.0), Inches(5), left, size=18, color=TEXT)

    # right: defensibility
    add_rect(s, Inches(8.8), Inches(1.9), Inches(4.0), Inches(4.8), SURFACE)
    add_accent_bar(s, Inches(8.8), Inches(1.9), w=Inches(0.06), h=Inches(4.8))
    add_text(s, Inches(9.0), Inches(2.05), Inches(3.7), Inches(0.5), "DEFENSIBILITY", size=11, bold=True, color=ACCENT)
    add_text(
        s,
        Inches(9.0),
        Inches(2.55),
        Inches(3.7),
        Inches(4),
        [
            "Retrofitting pixel-level citation is a rebuild, not a feature.",
            "",
            "Retrofitting cross-client delta breaks per-tenant architectures.",
            "",
            "By the time incumbents rebuild, we have MSP partnerships and an evidence corpus that compounds.",
        ],
        size=13,
        color=TEXT,
    )
    add_footer(s, 10, 16)


@slide
def s_gtm(s):
    add_bg(s)
    add_header(s, "How we hop into this space", "Go-to-market in three moves")

    steps = [
        (
            "01  Land",
            "3–5 design-partner MSPs",
            "Free for 90 days in exchange for 2 real SOC 2 ingestions each. Instrument the funnel. Ship weekly.",
        ),
        (
            "02  Expand",
            "Per-client pricing, not per-seat",
            "Match the MSP's own billing shape: a flat monthly per client they manage. Target ~$99–$199/client/mo.",
        ),
        (
            "03  Compound",
            "Each new client = shared evidence",
            "Every ingested vendor PDF upgrades the evidence corpus for every MSP. The 100th client is easier than the 10th.",
        ),
    ]
    x0 = Inches(0.5)
    y0 = Inches(1.9)
    cw = Inches(4.1)
    ch = Inches(4.6)
    gap = Inches(0.15)
    for i, (n, h, body) in enumerate(steps):
        x = x0 + (cw + gap) * i
        add_rect(s, x, y0, cw, ch, SURFACE)
        add_text(s, x + Inches(0.3), y0 + Inches(0.3), cw - Inches(0.5), Inches(0.6), n, size=14, bold=True, color=ACCENT)
        add_text(s, x + Inches(0.3), y0 + Inches(0.85), cw - Inches(0.5), Inches(1.0), h, size=22, bold=True, color=TEXT)
        add_text(s, x + Inches(0.3), y0 + Inches(2.1), cw - Inches(0.5), Inches(2.3), body, size=14, color=TEXT)

    add_text(
        s,
        Inches(0.5),
        Inches(6.65),
        Inches(12.3),
        Inches(0.5),
        "Design partners first. Marketplace listings (ConnectWise, Datto) next. Channel distribution last.",
        size=13,
        color=MUTED,
    )
    add_footer(s, 11, 16)


@slide
def s_scale(s):
    add_bg(s)
    add_header(s, "Scaling path", "Why the unit economics actually work")

    bullets = [
        ("1 MSP", "122 clients", "One onboard → 122 tenants of evidence flowing into the corpus."),
        ("Pre-computed answers", "SQLite cache", "50 CAIQ questions × every doc, computed once. Demo-time latency ≈ 0."),
        ("LLM cost per doc", "~$0.15", "Claude + OpenAI embeddings. Dominated by fixed ingest, not query volume."),
        ("Corpus effect", "Gets better", "Every new MSP ingests vendor PDFs that already exist in 5 other MSPs' books."),
    ]
    y = Inches(1.9)
    for big, mid, sub in bullets:
        add_rect(s, Inches(0.5), y, Inches(12.3), Inches(1.0), SURFACE)
        add_accent_bar(s, Inches(0.5), y, w=Inches(0.06), h=Inches(1.0))
        add_text(s, Inches(0.8), y, Inches(2.5), Inches(1.0), big, size=20, bold=True, color=ACCENT, anchor=MSO_ANCHOR.MIDDLE)
        add_text(s, Inches(3.4), y, Inches(2.6), Inches(1.0), mid, size=16, bold=True, color=TEXT, anchor=MSO_ANCHOR.MIDDLE)
        add_text(s, Inches(6.1), y, Inches(6.5), Inches(1.0), sub, size=13, color=TEXT, anchor=MSO_ANCHOR.MIDDLE)
        y += Inches(1.1)

    add_text(
        s,
        Inches(0.5),
        Inches(6.5),
        Inches(12.3),
        Inches(0.6),
        "Target: 50 MSPs × 100 clients × $149/mo = ~$9M ARR in 18 months on a single-region stack.",
        size=14,
        bold=True,
        color=ACCENT,
    )
    add_footer(s, 12, 16)


@slide
def s_roadmap(s):
    add_bg(s)
    add_header(s, "Roadmap", "MVP → post-hackathon → moat")

    phases = [
        (
            "Now · MVP",
            [
                "PDF ingest + bbox overlay",
                "CAIQ v4 subset (50 Qs)",
                "IDK enforcement",
                "Delta engine v1",
                "Fake multi-tenant switcher",
            ],
            ACCENT,
        ),
        (
            "Next · 90 days",
            [
                "Real auth + RBAC (NextAuth)",
                "XLSX + DOCX ingestion",
                "ConnectWise / Datto connectors",
                "Auditor share links",
                "Slack / Teams alerts on drift",
            ],
            TEXT,
        ),
        (
            "Later · the moat",
            [
                "Fine-tuned risk classifier",
                "Federated evidence across MSPs",
                "Industry benchmarks ('you vs peers')",
                "Automated remediation tickets",
                "Regulator-facing export",
            ],
            TEXT,
        ),
    ]
    x0 = Inches(0.5)
    y0 = Inches(1.9)
    cw = Inches(4.1)
    ch = Inches(4.8)
    gap = Inches(0.15)
    for i, (h, items, color) in enumerate(phases):
        x = x0 + (cw + gap) * i
        add_rect(s, x, y0, cw, ch, SURFACE)
        add_accent_bar(s, x, y0, w=Inches(0.08), h=ch)
        add_text(s, x + Inches(0.3), y0 + Inches(0.3), cw - Inches(0.5), Inches(0.6), h, size=18, bold=True, color=color)
        add_text(
            s,
            x + Inches(0.3),
            y0 + Inches(1.1),
            cw - Inches(0.5),
            Inches(3.5),
            ["• " + it for it in items],
            size=14,
            color=TEXT,
        )
    add_footer(s, 13, 16)


@slide
def s_team(s):
    add_bg(s)
    add_header(s, "Team", "Who's building this")

    slots = ["[ name · role ]", "[ name · role ]", "[ name · role ]"]
    x0 = Inches(0.5)
    y0 = Inches(2.0)
    cw = Inches(4.1)
    ch = Inches(4.5)
    gap = Inches(0.15)
    for i, label in enumerate(slots):
        x = x0 + (cw + gap) * i
        add_rect(s, x, y0, cw, ch, SURFACE)
        add_placeholder_box(s, x + Inches(0.5), y0 + Inches(0.5), cw - Inches(1.0), Inches(2.2), "[ photo ]")
        add_text(s, x, y0 + Inches(3.0), cw, Inches(0.5), label, size=18, bold=True, color=TEXT, align=PP_ALIGN.CENTER)
        add_text(s, x + Inches(0.3), y0 + Inches(3.55), cw - Inches(0.6), Inches(0.9), "[ one-line why you ]", size=13, color=MUTED, align=PP_ALIGN.CENTER)
    add_footer(s, 14, 16)


@slide
def s_ask(s):
    add_bg(s)
    add_header(s, "The ask", "What we want from this room")

    items = [
        ("Judges", "Feedback on the MSP-first thesis — where would you push back?"),
        ("Design partners", "Intros to MSPs serving 50+ SMB clients. We'll be free for 90 days."),
        ("Advisors", "Anyone who has sold into the ConnectWise / Datto channel."),
    ]
    y = Inches(1.9)
    for h, body in items:
        add_rect(s, Inches(0.5), y, Inches(12.3), Inches(1.3), SURFACE)
        add_accent_bar(s, Inches(0.5), y, w=Inches(0.08), h=Inches(1.3))
        add_text(s, Inches(0.85), y + Inches(0.2), Inches(3.5), Inches(0.5), h, size=20, bold=True, color=ACCENT)
        add_text(s, Inches(4.5), y, Inches(8.0), Inches(1.3), body, size=16, color=TEXT, anchor=MSO_ANCHOR.MIDDLE)
        y += Inches(1.45)

    add_text(
        s,
        Inches(0.5),
        Inches(6.6),
        Inches(12.3),
        Inches(0.5),
        "[ email · site · github ]",
        size=14,
        color=MUTED,
        align=PP_ALIGN.CENTER,
    )
    add_footer(s, 15, 16)


@slide
def s_close(s):
    add_bg(s)
    add_accent_bar(s, Inches(0.5), Inches(2.8), h=Inches(0.6))
    add_text(
        s,
        Inches(0.75),
        Inches(2.75),
        Inches(12),
        Inches(0.5),
        "VERIFAI",
        size=14,
        bold=True,
        color=ACCENT,
    )
    add_text(
        s,
        Inches(0.5),
        Inches(3.35),
        Inches(12),
        Inches(1.4),
        "My friend gets his Saturday back.\nMy quantum computer ships on time.",
        size=42,
        bold=True,
        color=TEXT,
    )
    add_text(
        s,
        Inches(0.5),
        Inches(5.3),
        Inches(12),
        Inches(0.6),
        "That's what we're building. Thank you.",
        size=20,
        color=MUTED,
    )
    add_footer(s, 16, 16)


# --- build ---------------------------------------------------------------


def main():
    for fn in SLIDES:
        slide = prs.slides.add_slide(BLANK)
        fn(slide)

    out = Path(__file__).resolve().parent.parent / "VerifAI_Pitch.pptx"
    prs.save(out)
    print(f"wrote {out} ({len(SLIDES)} slides)")


if __name__ == "__main__":
    main()
