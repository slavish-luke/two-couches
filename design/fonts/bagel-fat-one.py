"""Build Sticker Scrapbook's lettering font: Bagel Fat One's Google Fonts `latin` file plus the Turkish letters it
lacks, İ Ş ş Ğ ğ (U+0130, U+015E, U+015F, U+011E, U+011F). Bagel has Ç ç Ö ö Ü ü and ı, but not these. One file,
so the page carries one @font-face instead of next/font/google's hundred-odd Korean slices.

İ = I + one dot of the capital diaeresis (uni0308.case), centred over the I at the height Ö carries it.
Ş ş = S s + Bagel's own cedilla, centred under the letter (for ş raised to where ç's cedilla ends).
Ğ ğ = G g + a breve drawn here (Bagel has none): a fat round-capped smile as wide as the font's own
diaeresis and about as thick as one of its dots, at the diaeresis' height (capital and lower case).

Usage: python -I bagel-fat-one.py <latin.woff2> <out.woff2>
(<latin.woff2> is the Bagel Fat One file next/font/google downloads into .next/dev/static/media that has
Ccedilla and uni0308.case.)
"""
import math
import sys

from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont

latin_path, out_path = sys.argv[1:3]
font = TTFont(latin_path)
glyf, hmtx = font["glyf"], font["hmtx"]
source_unicodes = set(font.getBestCmap())


def bounds(name):
    g = glyf[name]
    g.recalcBounds(glyf)
    return g.xMin, g.yMin, g.xMax, g.yMax


def contours(name):
    """The glyph's outline as a list of contours, each a list of recorded pen operations."""
    pen = DecomposingRecordingPen(font.getGlyphSet())
    font.getGlyphSet()[name].draw(pen)
    out, cur = [], []
    for op, args in pen.value:
        cur.append((op, args))
        if op in ("closePath", "endPath"):
            out.append(cur)
            cur = []
    return out


def contour_bounds(c):
    pts = [p for _, args in c for p in args]
    xs, ys = [x for x, _ in pts], [y for _, y in pts]
    return min(xs), min(ys), max(xs), max(ys)


def replay(c, pen):
    for op, args in c:
        getattr(pen, op)(*args)


def build(name, base, parts, unicode):
    """A glyph: the base glyph's outline plus extra contours (each with a dx, dy shift)."""
    pen = TTGlyphPen(font.getGlyphSet())
    for c in contours(base):
        replay(c, pen)
    for c, dx, dy in parts:
        replay(c, TransformPen(pen, (1, 0, 0, 1, dx, dy)))
    glyph = pen.glyph()
    order = font.getGlyphOrder()
    if name not in order:
        order = order + [name]
        font.setGlyphOrder(order)
        glyf.glyphOrder = order
    glyf[name] = glyph
    hmtx[name] = hmtx[base]
    for table in font["cmap"].tables:
        if table.isUnicode():
            table.cmap[unicode] = name


def centre_x(box):
    return (box[0] + box[2]) / 2


def breve(cx, bottom, width, thickness):
    """A fat smile with round ends: an elliptical arc (lower half) `width` wide, its lowest point at `bottom`."""
    t = thickness / 2
    rx = width / 2 - t
    ry = rx * 0.55
    cy = bottom + ry + t
    steps = 24
    pts = []
    for k in range(steps + 1):  # outer edge, left to right along the bottom
        a = math.pi + math.pi * k / steps
        pts.append((cx + (rx + t) * math.cos(a), cy + (ry + t) * math.sin(a)))
    for k in range(1, steps):  # round cap on the right, bottom to top
        a = -math.pi / 2 + math.pi * k / steps
        pts.append((cx + rx + t * math.cos(a), cy + t * math.sin(a)))
    for k in range(steps + 1):  # inner edge, right to left
        a = 2 * math.pi - math.pi * k / steps
        pts.append((cx + (rx - t) * math.cos(a), cy + (ry - t) * math.sin(a)))
    for k in range(1, steps):  # round cap on the left, top to bottom
        a = math.pi / 2 + math.pi * k / steps
        pts.append((cx - rx + t * math.cos(a), cy + t * math.sin(a)))
    pts.reverse()  # clockwise, like TrueType outer contours
    rounded = [(round(x), round(y)) for x, y in pts]
    return [("moveTo", (rounded[0],))] + [("lineTo", (p,)) for p in rounded[1:]] + [("closePath", ())]


# İ: one dot of the capital diaeresis, centred over the I.
dots = sorted(contours("uni0308.case"), key=lambda c: contour_bounds(c)[0])
dot = dots[0]
dot_box = contour_bounds(dot)
build("Idotaccent", "I", [(dot, centre_x(bounds("I")) - centre_x(dot_box), 0)], 0x130)

# Ş ş: the font's cedilla, centred under the S (its top meets the baseline, where the S ends); ç's cedilla ends
# 10 units higher than Ç's, so ş's does too.
cedilla = contours("cedilla")[0]
ced_box = contour_bounds(cedilla)
build("Scedilla", "S", [(cedilla, centre_x(bounds("S")) - centre_x(ced_box), 0)], 0x15E)
lc_lift = bounds("ccedilla")[1] - bounds("Ccedilla")[1]
build("scedilla", "s", [(cedilla, centre_x(bounds("s")) - centre_x(ced_box), lc_lift)], 0x15F)

# Ğ ğ: a breve as wide as the diaeresis and as thick as one of its dots, sitting where the diaeresis sits.
for name, base, mark, unicode in (("Gbreve", "G", "uni0308.case", 0x11E), ("gbreve", "g", "uni0308", 0x11F)):
    box = bounds(mark)
    one = contour_bounds(sorted(contours(mark), key=lambda c: contour_bounds(c)[0])[0])
    thickness = 0.72 * (one[3] - one[1])
    width = 0.92 * (box[2] - box[0])
    build(name, base, [(breve(centre_x(bounds(base)), box[1], width, thickness), 0, 0)], unicode)

options = Options()
options.flavor = "woff2"
options.layout_features = ["*"]
options.name_IDs = ["*"]
options.notdef_outline = False
subsetter = Subsetter(options)
subsetter.populate(unicodes=source_unicodes | {0x130, 0x15E, 0x15F, 0x11E, 0x11F})
subsetter.subset(font)
font.flavor = "woff2"
font.save(out_path)
print("saved", out_path, len(font.getGlyphOrder()), "glyphs")
