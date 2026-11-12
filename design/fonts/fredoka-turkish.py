"""Build a five-letter Fredoka font with the Turkish letters Fredoka's Google Fonts files lack: İ Ş ş Ğ ğ.

Each letter is a composite of Fredoka's own glyphs, like Fredoka's own accented letters:
- İ (U+0130) = I + the dot above (uni0307), centred like Î's circumflex and as far above the I as the dot is above
  the i (kept at over half that gap at the heaviest weight, where bold i's dot nearly touches its stem).
- Ş (U+015E) and ş (U+015F) = S and s + Fredoka's cedilla (uni0327), placed under them as Ç and ç place it.
- Ğ (U+011E) and ğ (U+011F) = G and g + Fredoka's breve (uni0306), placed over them as Ô and ô place the circumflex.

The served `latin` file has the base letters, the cedilla and the accented models, but no dot above or breve; those
two come from Google's full Fredoka source (wdth 100), drawn at the lightest and heaviest weight. Every mark offset is
worked out at both ends of the weight axis (300–700) and varies linearly between them, like Fredoka's own composites.

Usage: python -I fredoka-turkish.py <latin.woff2> <Fredoka[wdth,wght].ttf> <out.woff2>
"""
import copy
import sys

from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables.TupleVariation import TupleVariation
from fontTools.varLib.instancer import instantiateVariableFont

latin_path, full_path, out_path = sys.argv[1:4]
font = TTFont(latin_path)
full = TTFont(full_path)
glyf, gvar, hmtx = font["glyf"], font["gvar"], font["hmtx"]
axis = next(a for a in font["fvar"].axes if a.axisTag == "wght")
LO, HI = axis.minValue, axis.maxValue
assert axis.defaultValue == LO, "the served file's default must be its lightest weight"
assert font["head"].unitsPerEm == full["head"].unitsPerEm
SPAN = {"wght": (0.0, 1.0, 1.0)}

# HVAR maps advance variations by glyph index; without it browsers use gvar's phantom points.
for tag in ("HVAR", "GSUB", "GPOS", "GDEF"):
    if tag in font:
        del font[tag]


def static(f, weight, **extra):
    return instantiateVariableFont(copy.deepcopy(f), {"wght": weight, **extra})


def add_glyph(name, glyph, advance_lsb, variations):
    order = font.getGlyphOrder() + [name]
    font.setGlyphOrder(order)
    glyf.glyphOrder = order
    glyf[name] = glyph
    hmtx[name] = advance_lsb
    gvar.variations[name] = variations


# The dot above and the breve, from the full source at the two ends of the weight axis.
full_lo, full_hi = static(full, LO, wdth=100), static(full, HI, wdth=100)
for mark in ("uni0307", "uni0306"):
    lo, hi = full_lo["glyf"][mark], full_hi["glyf"][mark]
    assert not lo.isComposite() and lo.endPtsOfContours == hi.endPtsOfContours, mark
    lo_pts, hi_pts = lo.getCoordinates(full_lo["glyf"])[0], hi.getCoordinates(full_hi["glyf"])[0]
    adv_lo, adv_hi = full_lo["hmtx"][mark][0], full_hi["hmtx"][mark][0]
    deltas = [(round(b[0] - a[0]), round(b[1] - a[1])) for a, b in zip(lo_pts, hi_pts)]
    deltas += [(0, 0), (adv_hi - adv_lo, 0), (0, 0), (0, 0)]  # phantom points: origin, advance, top, bottom
    add_glyph(mark, copy.deepcopy(lo), full_lo["hmtx"][mark], [TupleVariation(SPAN, deltas)])


def bounds(f, name):
    g = f["glyf"][name]
    g.recalcBounds(f["glyf"])
    return g.xMin, g.yMin, g.xMax, g.yMax


def mid(b):
    return (b[0] + b[2]) / 2


def upper_mid(f, name):
    """The horizontal middle of a letter's part above the baseline (g's bowl, not its tail)."""
    xs = [x for x, y in f["glyf"][name].getCoordinates(f["glyf"])[0] if y >= 0]
    return (min(xs) + max(xs)) / 2


def comp(f, composite, index=1):
    c = f["glyf"][composite].components[index]
    return c.x, c.y


def cedilla(f, base, model, model_base):
    """Under `base` as the cedilla sits under `model_base` in `model` (Ç, ç)."""
    x, y = comp(f, model)
    b, m = bounds(f, base), bounds(f, model_base)
    return round(x + mid(b) - mid(m)), round(y + b[1] - m[1])


def box_mid(f, name):
    return mid(bounds(f, name))


def breve(f, base, model, model_base, middle=box_mid):
    """Over `base` as the circumflex sits over `model_base` in `model` (Ô, ô)."""
    x, y = comp(f, model)
    circ, brv, b, m = bounds(f, "uni0302"), bounds(f, "uni0306"), bounds(f, base), bounds(f, model_base)
    centre = x + mid(circ) + (middle(f, base) - middle(f, model_base))
    return round(centre - mid(brv)), round(y + circ[1] + (b[3] - m[3]) - brv[1])


def dot_gap(f):
    g = f["glyf"]
    coords, ends = g["i"].getCoordinates(g)[0], g["i"].endPtsOfContours
    contours = [coords[(ends[n - 1] + 1 if n else 0) : ends[n] + 1] for n in range(len(ends))]
    i_dot, i_stem = sorted(contours, key=lambda c: -max(y for _, y in c))
    return min(y for _, y in i_dot) - max(y for _, y in i_stem)


LIGHT_GAP = dot_gap(font)


def dot(f, heavy=False):
    """Over I, centred like Î's circumflex, as far above the I as the dot is above the i."""
    x, _ = comp(f, "Icircumflex")
    circ, d, cap = bounds(f, "uni0302"), bounds(f, "uni0307"), bounds(f, "I")
    gap = max(dot_gap(f), 0.55 * LIGHT_GAP) if heavy else dot_gap(f)
    return round(x + mid(circ) - mid(d)), round(cap[3] + gap - d[1])


LETTERS = {
    0x0130: ("Idotaccent", "I", "uni0307", lambda f, h: dot(f, h)),
    0x015E: ("Scedilla", "S", "uni0327", lambda f, h: cedilla(f, "S", "Ccedilla", "C")),
    0x015F: ("scedilla", "s", "uni0327", lambda f, h: cedilla(f, "s", "ccedilla", "c")),
    0x011E: ("Gbreve", "G", "uni0306", lambda f, h: breve(f, "G", "Ocircumflex", "O")),
    0x011F: ("gbreve", "g", "uni0306", lambda f, h: breve(f, "g", "ocircumflex", "o", upper_mid)),
}

heavy_font = static(font, HI)
for code, (name, base, mark, place) in LETTERS.items():
    light, heavy = place(font, False), place(heavy_font, True)
    glyph = copy.deepcopy(glyf["Icircumflex"])  # a two-part composite: base at the origin, then the mark
    glyph.components[0].glyphName, glyph.components[0].x, glyph.components[0].y = base, 0, 0
    glyph.components[1].glyphName, (glyph.components[1].x, glyph.components[1].y) = mark, light
    base_vars = gvar.variations.get(base, [])
    assert len(base_vars) == 1 and base_vars[0].axes == SPAN, (base, base_vars)
    phantom = base_vars[0].coordinates[-4:]  # the base letter's advance changes with weight; so does this one's
    deltas = [(0, 0), (heavy[0] - light[0], heavy[1] - light[1]), *phantom]
    add_glyph(name, glyph, hmtx[base], [TupleVariation(SPAN, deltas)])
    for table in font["cmap"].tables:
        if table.isUnicode():
            table.cmap[code] = name
    print(f"U+{code:04X} {name}: {mark} at {light} ({LO:g}) to {heavy} ({HI:g})")

options = Options()
options.flavor = "woff2"
options.layout_features = []
options.name_IDs = ["*"]
options.notdef_outline = False
subsetter = Subsetter(options)
subsetter.populate(unicodes=list(LETTERS))
subsetter.subset(font)
font.flavor = "woff2"
font.save(out_path)
print("saved", out_path, sorted(font.getGlyphOrder()))
