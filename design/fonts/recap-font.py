"""Build the year-in-review image's font: Luckiest Guy as a TTF cut down to Latin and Turkish.

`next/og` (Satori) reads only TTF, OTF and WOFF, not the WOFF2 files `next/font` serves, and the image is
drawn on the server, so it needs its own copy. Luckiest Guy has every Turkish letter (İ ı Ş ş Ğ ğ Ç ç Ö ö
Ü ü); Fredoka has no İ Ş ş Ğ ğ, so the image is lettered in Luckiest Guy throughout.
Usage: python -I recap-font.py <LuckiestGuy-Regular.ttf> <out.ttf>
(the TTF is https://github.com/google/fonts/raw/main/apache/luckiestguy/LuckiestGuy-Regular.ttf)
"""
import sys

from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont

src, out = sys.argv[1:3]
font = TTFont(src)
options = Options()
options.layout_features = ["kern", "liga"]
options.name_IDs = ["*"]
options.notdef_outline = True
subsetter = Subsetter(options)
unicodes = [
    *range(0x20, 0x7F),  # Basic Latin
    *range(0xA0, 0x100),  # Latin-1
    *range(0x100, 0x180),  # Latin Extended-A (Turkish İ ı Ş ş Ğ ğ among them)
    *range(0x2010, 0x2028),  # dashes, quotes, ellipsis
    *range(0x2030, 0x203B),
    0x20AC,
    0x2122,
]
subsetter.populate(unicodes=unicodes)
subsetter.subset(font)
for u in (0x130, 0x131, 0x15E, 0x15F, 0x11E, 0x11F):
    assert u in font.getBestCmap(), hex(u)
font.save(out)
