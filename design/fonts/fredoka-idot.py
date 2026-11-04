"""Build a one-letter Fredoka font with a Turkish capital İ (U+0130), which Fredoka lacks.

İ = I + the combining dot above (uni0307), built like Fredoka's own Icircumflex (I + uni0302), with the dot
centred like the circumflex and as far above the I as the dot is above the i, at the lightest and heaviest weight.
Usage: python -I idot.py <latin.woff2> <marks.woff2> <out.woff2>
"""
import copy
import sys

from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

latin_path, marks_path, out_path = sys.argv[1:4]
font = TTFont(latin_path)
marks = TTFont(marks_path)
glyf, gvar, hmtx = font["glyf"], font["gvar"], font["hmtx"]

# HVAR maps advance variations by glyph index; without it browsers use gvar's phantom points.
for tag in ("HVAR", "GSUB", "GPOS", "GDEF"):
    if tag in font:
        del font[tag]

# Bring the dot over from the other subset, with its variations.
order = font.getGlyphOrder() + ["uni0307", "Idotaccent"]
font.setGlyphOrder(order)
glyf.glyphOrder = order
glyf["uni0307"] = copy.deepcopy(marks["glyf"]["uni0307"])
hmtx["uni0307"] = marks["hmtx"]["uni0307"]
gvar.variations["uni0307"] = copy.deepcopy(marks["gvar"].variations.get("uni0307", []))


def placement(f, min_gap=0):
    """The dot's offset on İ in font `f`: centred like Î's circumflex, as far above the I as it is above the i
    (at least `min_gap`)."""
    g = f["glyf"]

    def bounds(name):
        glyph = g[name]
        glyph.recalcBounds(g)
        return glyph.xMin, glyph.yMin, glyph.xMax, glyph.yMax

    comp = g["Icircumflex"].components
    circ, dot, cap = bounds("uni0302"), bounds("uni0307"), bounds("I")
    coords, ends = g["i"].getCoordinates(g)[0], g["i"].endPtsOfContours
    contours = [coords[(ends[n - 1] + 1 if n else 0) : ends[n] + 1] for n in range(len(ends))]
    i_dot, i_stem = sorted(contours, key=lambda c: -max(y for _, y in c))
    gap = max(min(y for _, y in i_dot) - max(y for _, y in i_stem), min_gap)
    dx = comp[1].x + round((circ[0] + circ[2]) / 2 - (dot[0] + dot[2]) / 2)
    dy = round(cap[3] + gap - dot[1])
    return dx, dy, gap


# Î's circumflex has one set of deltas, peaking at the heaviest weight; the dot gets its own there.
axis = next(a for a in font["fvar"].axes if a.axisTag == "wght")
*light, light_gap = placement(font)
idot = copy.deepcopy(glyf["Icircumflex"])
idot.components[1].glyphName = "uni0307"
idot.components[1].x, idot.components[1].y = light
glyf["Idotaccent"] = idot
hmtx["Idotaccent"] = hmtx["Icircumflex"]
deltas = copy.deepcopy(gvar.variations.get("Icircumflex", []))
assert len(deltas) == 1 and deltas[0].axes == {"wght": (0.0, 1.0, 1.0)} and axis.defaultValue == axis.minValue, deltas
gvar.variations["Idotaccent"] = deltas
# Bold i's dot nearly touches its stem; on a capital that looks cramped, so keep over half the light gap.
*heavy, _ = placement(instantiateVariableFont(copy.deepcopy(font), {"wght": axis.maxValue}), min_gap=0.55 * light_gap)
deltas[0].coordinates[1] = (heavy[0] - light[0], heavy[1] - light[1])
print("dot offset", light, "at", axis.defaultValue, heavy, "at", axis.maxValue)

for table in font["cmap"].tables:
    if table.isUnicode():
        table.cmap[0x130] = "Idotaccent"

options = Options()
options.flavor = "woff2"
options.layout_features = []
options.name_IDs = ["*"]
options.notdef_outline = False
subsetter = Subsetter(options)
subsetter.populate(unicodes=[0x130])
subsetter.subset(font)
font.flavor = "woff2"
font.save(out_path)
print("saved", out_path, sorted(font.getGlyphOrder()))
