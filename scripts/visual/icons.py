"""
Draw the class C icons on their native grids. Stage 5.0/5.

    python3 scripts/visual/icons.py            # write every PNG
    python3 scripts/visual/icons.py --sheet F  # also write a contact sheet to F

The author's rulings before 5.0/5 (`docs/spec/gymrun-stage5.0-rulings-stage5.md`,
item 1) put the icons on the session: a painting area-averaged down to an 8px
mark is mush, so these are drawn a pixel at a time, here, as text. Each grid is
the source; the PNG under `src/ui/assets/` is its output. To replace one with
the author's own drawing, drop the file over it and stop regenerating that
entry: the manifest names the file, not this script.

Two kinds of drawing:

- **Masks** (`#` ink, `.` clear): the node, capability and currency glyphs
  (8x8, D61), the nav icons (12x12) and the wordmark (96x16). They are drawn in
  `currentColor` through a CSS mask, so they are monochrome and theme-safe as
  every glyph in the sheet is, and colour stays secondary (bible section 2).
  The glyph marks start from the existing SVG marks' silhouettes so M1.1's
  separations carry over; `scripts/visual/glyph-sheet.ts` measures them again.
- **Colour** (one letter a palette entry, `.` clear): the ten relics at 16x16,
  objects like the item sprites beside them, outlined dark so they read on the
  light panel and the dark one.

Tooling, not the game: Pillow, as `backdrops.py`. Nothing in the build imports it.
"""
import argparse
import os

from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'ui', 'assets')

# ---------------------------------------------------------------------------
# Glyph marks, 8x8. Ids are the glyph sheet's (`ui/theme/glyphs.ts`).
# ---------------------------------------------------------------------------

GLYPHS = {
    # A bush: a round crown of leaves on a short stem.
    'node-wild': [
        '..####..',
        '.######.',
        '########',
        '########',
        '.######.',
        '..####..',
        '...##...',
        '..####..',
    ],
    # A head: a face over shoulders.
    'node-trainer': [
        '..####..',
        '.######.',
        '.######.',
        '..####..',
        '........',
        '.######.',
        '########',
        '########',
    ],
    # A tent: a peak with its door cut out.
    'node-rest': [
        '...##...',
        '...##...',
        '..####..',
        '..####..',
        '.######.',
        '.##..##.',
        '##....##',
        '##....##',
    ],
    # A badge: an eight-point star.
    'node-gym': [
        '...##...',
        '#..##..#',
        '.######.',
        '###..###',
        '###..###',
        '.######.',
        '#..##..#',
        '...##...',
    ],
    # A bag: a sack tied at the neck.
    'node-shop': [
        '..#..#..',
        '...##...',
        '..####..',
        '.######.',
        '########',
        '########',
        '########',
        '.######.',
    ],
    # A question mark.
    'node-event': [
        '.#####..',
        '##...##.',
        '.....##.',
        '....##..',
        '...##...',
        '...##...',
        '........',
        '...##...',
    ],
    # Cut: a blade on the diagonal.
    'capability-cut': [
        '......##',
        '.....###',
        '....###.',
        '...###..',
        '..###...',
        '.###....',
        '###.....',
        '##......',
    ],
    # Surf: two swells.
    'capability-surf': [
        '........',
        '..##....',
        '.#..#..#',
        '#....##.',
        '........',
        '..##....',
        '.#..#..#',
        '#....##.',
    ],
    # Strength: a boulder, square.
    'capability-strength': [
        '........',
        '.######.',
        '.######.',
        '.######.',
        '.######.',
        '.######.',
        '.######.',
        '........',
    ],
    # Rock Smash: a hammer head on a handle.
    'capability-rockSmash': [
        '########',
        '########',
        '########',
        '...##...',
        '...##...',
        '...##...',
        '...##...',
        '...##...',
    ],
    # Fly: a peak of wings.
    'capability-fly': [
        '...##...',
        '..####..',
        '.######.',
        '###..###',
        '##....##',
        '#......#',
        '........',
        '........',
    ],
    # Waterfall: three falls.
    'capability-waterfall': [
        '##.##.##',
        '##.##.##',
        '##.##.##',
        '##.##.##',
        '##.##.##',
        '##.##.##',
        '##.##.##',
        '##.##.##',
    ],
    # Dive: an arrow down.
    'capability-dive': [
        '..####..',
        '..####..',
        '..####..',
        '..####..',
        '########',
        '.######.',
        '..####..',
        '...##...',
    ],
    # Flash: a burst.
    'capability-flash': [
        '#..##..#',
        '.#.##.#.',
        '..####..',
        '########',
        '########',
        '..####..',
        '.#.##.#.',
        '#..##..#',
    ],
    # A stack of coins, seen edge on.
    'currency-coin': [
        '.######.',
        '########',
        '.######.',
        '........',
        '########',
        '.######.',
        '........',
        '########',
    ],
}

# ---------------------------------------------------------------------------
# Nav icons, 12x12. Controls, not glyphs (D54): beside their words, aria-hidden.
# ---------------------------------------------------------------------------

NAV = {
    # A pin over the ground line.
    'map': [
        '....####....',
        '...######...',
        '..###..###..',
        '..##....##..',
        '..###..###..',
        '...######...',
        '...######...',
        '....####....',
        '.....##.....',
        '............',
        '.##########.',
        '............',
    ],
    # Two heads, one before the other.
    'team': [
        '............',
        '.......###..',
        '..###.#####.',
        '.#####.###..',
        '.#####......',
        '..###..####.',
        '......######',
        '.#####.#####',
        '#######.....',
        '#######.....',
        '#######.....',
        '............',
    ],
    # A backpack with its flap.
    'bag': [
        '....####....',
        '...#....#...',
        '.##########.',
        '.##########.',
        '.#........#.',
        '.##########.',
        '.####..####.',
        '.####..####.',
        '.##########.',
        '.##########.',
        '..########..',
        '............',
    ],
    # A list: the decision feed's rows.
    'info': [
        '............',
        '.##.#######.',
        '.##.#######.',
        '............',
        '.##.#######.',
        '.##.#######.',
        '............',
        '.##.#######.',
        '.##.#######.',
        '............',
        '.##.#######.',
        '.##.#######.',
    ],
    # A gear.
    'settings': [
        '.....##.....',
        '..#.####.#..',
        '.##########.',
        '..###..###..',
        '.###....###.',
        '####....####',
        '####....####',
        '.###....###.',
        '..###..###..',
        '.##########.',
        '..#.####.#..',
        '.....##.....',
    ],
}

# ---------------------------------------------------------------------------
# The wordmark, 96x16: GYMRUN in a 5x7 face doubled, original, no ball.
# ---------------------------------------------------------------------------

LETTERS = {
    'G': ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
    'Y': ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
    'M': ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
    'R': ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
    'U': ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    'N': ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
}


def wordmark() -> list:
    width, height, scale, gap = 96, 16, 2, 4
    word = 'GYMRUN'
    used = len(word) * 5 * scale + (len(word) - 1) * gap
    left, top = (width - used) // 2, (height - 7 * scale) // 2
    rows = [['.'] * width for _ in range(height)]
    for n, letter in enumerate(word):
        x0 = left + n * (5 * scale + gap)
        for y, row in enumerate(LETTERS[letter]):
            for x, cell in enumerate(row):
                if cell == '#':
                    for dy in range(scale):
                        for dx in range(scale):
                            rows[top + y * scale + dy][x0 + x * scale + dx] = '#'
    return [''.join(row) for row in rows]


# ---------------------------------------------------------------------------
# Relics, 16x16, colour. Ids are `data/relics.ts`'s.
# ---------------------------------------------------------------------------

PALETTE = {
    'k': (0x1C, 0x1A, 0x24),  # outline
    'w': (0xF4, 0xF2, 0xEA),  # highlight
    's': (0xB4, 0xBC, 0xC8),  # steel
    'S': (0x6E, 0x76, 0x86),  # steel, shade
    'r': (0xB8, 0x5C, 0x2C),  # rust
    'b': (0x9A, 0x64, 0x32),  # wood
    'B': (0x62, 0x3E, 0x1E),  # wood, shade
    'e': (0xF2, 0xDC, 0xAE),  # shell
    'o': (0xE8, 0x8A, 0x4C),  # shell, band
    'c': (0x4C, 0x94, 0xDC),  # water
    'C': (0x2A, 0x5A, 0xA4),  # water, shade
    't': (0x48, 0xC4, 0xB4),  # wind
    'y': (0xEC, 0xC4, 0x44),  # gold
    'Y': (0xA8, 0x7A, 0x1C),  # gold, shade
    'p': (0x7A, 0x4C, 0xB4),  # deep glass
    'P': (0x40, 0x26, 0x6E),  # deep glass, shade
    'f': (0xF6, 0x9A, 0x2E),  # flame
    'F': (0xFF, 0xE4, 0x7A),  # flame, core
}

RELICS = {
    # Cut, latent: a rusted blade on its grip.
    'rusted-machete': [
        '................',
        '............kk..',
        '...........kssk.',
        '..........ksrsk.',
        '.........kssSk..',
        '........ksrsk...',
        '.......kssSk....',
        '......ksrsk.....',
        '.....kssSk......',
        '....kssSk.......',
        '...kkkkk........',
        '..kBbk..........',
        '.kBbk...........',
        '.kBk............',
        '..k.............',
        '................',
    ],
    # Cut, known: an axe head on a haft.
    'woodsmans-hatchet': [
        '................',
        '..kkkkk.........',
        '.ksssssk........',
        'kswsssssk.......',
        'ksssssskbk......',
        'kSsssskbbk......',
        '.kSSskbbk.......',
        '..kkkkbbk.......',
        '.......kbbk.....',
        '........kbbk....',
        '.........kbbk...',
        '..........kbBk..',
        '...........kBBk.',
        '............kk..',
        '................',
        '................',
    ],
    # Surf, latent: a scallop shell.
    'tidecaller-shell': [
        '................',
        '................',
        '......kkkk......',
        '....kkeoeokk....',
        '...keoeoeoeok...',
        '..keoeoeoeoeok..',
        '..keoeoeoeoeok..',
        '.keoeoeoeoeoeok.',
        '.keoeoeoeoeoeok.',
        '..keoeoeoeoeok..',
        '...kkeoeoeokk...',
        '.....keeeek.....',
        '....keeeeeek....',
        '....kkkkkkkk....',
        '................',
        '................',
    ],
    # Surf, known: an oar, blade down.
    'ferrymans-oar': [
        '.kk.............',
        'kbbk............',
        '.kbbk...........',
        '..kbbk..........',
        '...kbbk.........',
        '....kbbk........',
        '.....kbbk.......',
        '......kbbkk.....',
        '.......kbbbbk...',
        '.......kbbbbBk..',
        '........kbbbbBk.',
        '.........kbbbBk.',
        '..........kbBBk.',
        '...........kkk..',
        '................',
        '................',
    ],
    # Strength: an armoured fist on a gold cuff.
    'ironbound-gauntlet': [
        '................',
        '....kkkkkkkk....',
        '...kskskskskk...',
        '...kskskskssk...',
        '...kSkSkSkSSk...',
        '..kkkkkkkkkssk..',
        '..kwssssssssSk..',
        '..ksssssssssSk..',
        '..kSSSSSSSSSSk..',
        '...kkkkkkkkkk...',
        '...kyyyyyyyyk...',
        '...kYYYYYYYYk...',
        '...kssssssssk...',
        '...kSSSSSSSSk...',
        '...kkkkkkkkkk...',
        '................',
    ],
    # Rock Smash: a hammer.
    'prospectors-hammer': [
        '................',
        '..kkkkkkkkkkk...',
        '.kwssssssssssk..',
        '.ksssssssssSSk..',
        '.kSSSSSSSSSSSk..',
        '..kkkkkbbkkkk...',
        '......kbbk......',
        '......kbbk......',
        '......kbbk......',
        '......kbbk......',
        '......kbBk......',
        '......kbBk......',
        '......kbBk......',
        '......kBBk......',
        '.......kk.......',
        '................',
    ],
    # Fly: a feather on the wind.
    'windrider-feather': [
        '..........kkk...',
        '.........kwwtk..',
        '........kwwttk..',
        '.......kwwttk...',
        '......kwwttk....',
        '.....kwwttk.....',
        '....kwwttk......',
        '...kwwttk.......',
        '...kwttk........',
        '..kwttk.........',
        '..ktkk..........',
        '.kk.............',
        'k...............',
        '................',
        '................',
        '................',
    ],
    # Waterfall: a teardrop gem on a cord.
    'cascade-talisman': [
        '....k......k....',
        '.....k....k.....',
        '......kkkk......',
        '......kyyk......',
        '.......kk.......',
        '......kcck......',
        '.....kcwcck.....',
        '....kcwcccck....',
        '...kccwccccck...',
        '...kcccccccCk...',
        '...kccccccCCk...',
        '...kCcccccCCk...',
        '....kCCCCCCk....',
        '.....kkkkkk.....',
        '................',
        '................',
    ],
    # Dive: a lens of deep glass.
    'abyssal-lens': [
        '................',
        '....kkkkkk......',
        '...kssssssk.....',
        '..kspppppwsk....',
        '..ksppppwwsk....',
        '..kspppppPsk....',
        '..ksppppPPsk....',
        '..ksPpPPPPsk....',
        '...kssssssk.....',
        '....kkkkkksk....',
        '..........ksk...',
        '...........kbk..',
        '............kbk.',
        '.............kk.',
        '................',
        '................',
    ],
    # Flash: a lantern, lit.
    'everburning-lantern': [
        '......kkkk......',
        '.....k....k.....',
        '.....kkkkkk.....',
        '....kyyyyyyk....',
        '....kkkkkkkk....',
        '....kwkffkSk....',
        '....kwfFFfSk....',
        '....kwfFFfSk....',
        '....kwkffkSk....',
        '....kwkkfkSk....',
        '....kkkkkkkk....',
        '....kyyyyyyk....',
        '....kYYYYYYk....',
        '.....kkkkkk.....',
        '................',
        '................',
    ],
}


def check(name: str, grid: list, width: int, height: int, alphabet: str) -> None:
    if len(grid) != height:
        raise SystemExit(f'{name}: {len(grid)} rows, want {height}')
    for y, row in enumerate(grid):
        if len(row) != width:
            raise SystemExit(f'{name}: row {y} is {len(row)} wide, want {width}')
        stray = set(row) - set(alphabet)
        if stray:
            raise SystemExit(f'{name}: row {y} has {sorted(stray)}')


def mask(grid: list) -> Image.Image:
    image = Image.new('RGBA', (len(grid[0]), len(grid)), (0, 0, 0, 0))
    for y, row in enumerate(grid):
        for x, cell in enumerate(row):
            if cell == '#':
                image.putpixel((x, y), (0, 0, 0, 255))
    return image


def colour(grid: list) -> Image.Image:
    image = Image.new('RGBA', (len(grid[0]), len(grid)), (0, 0, 0, 0))
    for y, row in enumerate(grid):
        for x, cell in enumerate(row):
            if cell != '.':
                image.putpixel((x, y), PALETTE[cell] + (255,))
    return image


def drawings() -> dict:
    """Every file, by its path under `src/ui/assets/`."""
    out = {}
    for glyph, grid in GLYPHS.items():
        check(glyph, grid, 8, 8, '#.')
        out[f'glyphs/{glyph}.png'] = mask(grid)
    for tab, grid in NAV.items():
        check(tab, grid, 12, 12, '#.')
        out[f'icons/nav-{tab}.png'] = mask(grid)
    mark = wordmark()
    check('wordmark', mark, 96, 16, '#.')
    out['icons/wordmark.png'] = mask(mark)
    for relic, grid in RELICS.items():
        check(relic, grid, 16, 16, '.' + ''.join(PALETTE))
        out[f'icons/relic-{relic}.png'] = colour(grid)
    return out


def sheet(images: dict, cell: int = 108) -> Image.Image:
    """Every drawing at the largest whole multiple that fits, on a light and a dark panel."""
    light, dark = (0xF0, 0xEC, 0xE0), (0x24, 0x22, 0x2C)
    columns = 8
    items = list(images.values())
    rows = (len(items) + columns - 1) // columns
    out = Image.new('RGB', (columns * cell * 2, rows * cell), (255, 255, 255))
    for n, image in enumerate(items):
        scale = max(1, (cell - 8) // max(image.width, image.height))
        big = image.resize((image.width * scale, image.height * scale), Image.Resampling.NEAREST)
        is_mask = all(pixel[:3] == (0, 0, 0) for pixel in big.getdata() if pixel[3])
        for side, (panel, ink) in enumerate(((light, dark), (dark, light))):
            x0, y0 = (n % columns) * cell * 2 + side * cell, (n // columns) * cell
            out.paste(panel, (x0, y0, x0 + cell - 2, y0 + cell - 2))
            tile = Image.new('RGB', big.size, ink) if is_mask else big.convert('RGB')
            out.paste(tile, (x0 + (cell - big.width) // 2, y0 + (cell - big.height) // 2), big.getchannel('A'))
    return out


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--sheet', help='also write a contact sheet here')
    args = parser.parse_args()
    images = drawings()
    for path, image in images.items():
        target = os.path.join(ROOT, path)
        os.makedirs(os.path.dirname(target), exist_ok=True)
        image.save(target, optimize=True)
    total = sum(os.path.getsize(os.path.join(ROOT, path)) for path in images)
    print(f'{len(images)} files, {total} bytes')
    if args.sheet:
        sheet(images).save(args.sheet, optimize=True)


if __name__ == '__main__':
    main()
