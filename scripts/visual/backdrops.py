"""
Convert painted battle backdrops to the game's native pixel grid. Stage 5.0/2.

    python3 scripts/visual/backdrops.py <source dir> [--colors 48]

The art arrives as 1536x1024 paintings in a pixel-art look
(`docs/spec/assets/stage5.0-battle-backdrop-<region>.webp`), not drawn on a
grid. The stage shows 224x136 art pixels at 2 CSS px each (`NATIVE` in
`src/ui/assets/manifest.ts`), so each painting is:

1. cropped to 224:136 by trimming sky from the top, which lifts the horizon
   from about 43% of the frame to about 37%, where the opponent's platform
   stands, and keeps the foreground the player's platform stands on;
2. downscaled by area averaging, so every art pixel is the mean of the
   painted block it covers;
3. quantised to a small palette with no dither, so flat regions come back
   flat, the way drawn pixel art has them;
4. written as an indexed PNG to `src/ui/assets/backdrops/battle/<region>.png`.

**Map backdrops, Stage 5.0/4** (`--map`): the paintings arrive at 1024x1536,
2:3, and the map shows them at 272x408 art pixels
(`docs/spec/gymrun-stage5.0-map-backdrops.md`), the same ratio, so nothing is
cropped: steps 2 to 4 only, written to `src/ui/assets/backdrops/map/<locale>.png`
from `stage5.0-map-backdrop-<locale>.webp`. A painting that is not 2:3 is
cropped to it from the top, keeping the foot where the entrance is.

**The gym's emblem, Stage 5.0/5** (`gymrun-stage5.0-rulings-stage5.md`, item
3): the gym painting puts a Poke Ball on its floor and on all nine banners,
and the plan's *"Where the reference is wrong"* refuses a Poke Ball logo. So
after conversion the gym goes through `paint_out_gym_emblem`, at native size:
the floor keeps its outer ring as a plain court circle, its red half, bar and
centre ring replaced by the circle's own cream stone; each banner's ball
becomes a diamond, the mark the map entrances' banners already wear. The other
sixteen backdrops carry no Poke Ball (checked at 5.0/5) and are untouched.

**The opening painting** (`--opening`,
`docs/spec/gymrun-patch-opening-world.md`): one 1024x1536 painting,
converted as a map backdrop is but at twice the grid (544x816) and 64
colours, because it covers the whole viewport rather than the map's column,
from `stage5.0-starter-backdrop.webp` to `src/ui/assets/backdrops/opening.png`,
the World behind the frame before the first region.

Tooling, not the game: it needs Pillow (`pip install pillow`), which nothing in
the build or the test suite imports. Re-run it when the art changes.
"""
import argparse
import os
from PIL import Image

NATIVE = (224, 136)
REGIONS = ('gym', 'cave', 'shore', 'summit', 'city', 'forest', 'ruins', 'marsh', 'badlands')
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'ui', 'assets', 'backdrops', 'battle')

MAP_NATIVE = (272, 408)
OPENING_NATIVE = (544, 816)
LOCALES = ('cave', 'shore', 'summit', 'city', 'forest', 'ruins', 'marsh', 'badlands')
MAP_OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'ui', 'assets', 'backdrops', 'map')


def convert(source: str, colors: int, native: tuple = NATIVE) -> Image.Image:
    image = Image.open(source).convert('RGB')
    width, height = image.size
    keep = round(width * native[1] / native[0])
    top = max(0, height - keep)  # trim sky, keep the ground
    image = image.crop((0, top, width, top + min(keep, height)))
    image = image.resize(native, Image.Resampling.BOX)
    return image.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)


# The gym painting's colours at native size, after quantisation.
_RED = {(0xD0, 0x8F, 0x77), (0xB9, 0x84, 0x72)}
_BAR = {(0xBB, 0xA3, 0x8B), (0xA9, 0x93, 0x82), (0xDF, 0xC8, 0xAC)}
_BANNER = (0x24, 0x51, 0x92)
_EMBLEM = {(0x69, 0x7E, 0x9F), (0x89, 0x8F, 0x9C), (0x40, 0x63, 0x96)}
_MARK, _MARK_EDGE = (0x89, 0x8F, 0x9C), (0x69, 0x7E, 0x9F)
# The floor ball: centre and the semi-axes of the ring's inside edge.
_FLOOR = (112, 78, 63, 16)
# Each banner's ball: centre, radius, and the diamond drawn in its place
# (half-diagonal, and whether it is hollow).
_BANNERS = (
    (111.5, 6.1, 8.5, 5, True), (80.8, 7.7, 4.5, 3, True), (143.5, 7.7, 4.5, 3, True),
    (40.9, 36.9, 2, 1, False), (73.3, 36.8, 2, 1, False), (149.7, 36.6, 2, 1, False), (182.1, 37.0, 2, 1, False),
    (18.6, 120.9, 4.5, 3, True), (204.4, 120.6, 4.5, 3, True),
)


def paint_out_gym_emblem(image: Image.Image) -> Image.Image:
    """The gym backdrop with its Poke Balls painted out. Native size in, native out."""
    palette = image
    rgb = image.convert('RGB')
    out = rgb.copy()
    cx, cy, rx, ry = _FLOOR

    def inside(x: int, y: int) -> bool:
        return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1

    def emblem(x: int, y: int) -> bool:
        if not inside(x, y):
            return False
        pixel = rgb.getpixel((x, y))
        return pixel in _RED or (pixel in _BAR and 70 <= y <= 84)

    # The floor: each emblem pixel takes the stone from the circle's lower
    # half in its own column, mirrored, so the texture carries on.
    for y in range(rgb.height):
        for x in range(rgb.width):
            if not emblem(x, y):
                continue
            start = 2 * 80 - y + 2 if y < 80 else y + 6
            source = next((85 + (start - 85 + k) % 8 for k in range(12)
                           if inside(x, 85 + (start - 85 + k) % 8) and not emblem(x, 85 + (start - 85 + k) % 8)), None)
            out.putpixel((x, y), rgb.getpixel((x, source)) if source is not None else (0xEE, 0xD2, 0xAA))

    # The banners: the ball goes to banner blue, a diamond goes on.
    for bx, by, radius, half, hollow in _BANNERS:
        for y in range(int(by - radius - 2), int(by + radius + 3)):
            for x in range(int(bx - radius - 2), int(bx + radius + 3)):
                if (x - bx) ** 2 + (y - by) ** 2 <= (radius + 1.2) ** 2 and rgb.getpixel((x, y)) in _EMBLEM:
                    out.putpixel((x, y), _BANNER)
        ix, iy = round(bx), round(by)
        for y in range(iy - half, iy + half + 1):
            for x in range(ix - half, ix + half + 1):
                distance = abs(x - ix) + abs(y - iy)
                if distance > half or (hollow and distance <= half - 2):
                    continue
                out.putpixel((x, y), _MARK if distance < half or not hollow else _MARK_EDGE)

    # Every colour used is already in the palette, so each maps back to its
    # own index. Not `quantize(palette=...)`, which snaps near-twins together.
    flat = palette.getpalette()
    index = {}
    for i in range(len(flat) // 3):
        index.setdefault(tuple(flat[3 * i:3 * i + 3]), i)
    result = palette.copy()
    result.putdata([index[out.getpixel((x, y))] for y in range(out.height) for x in range(out.width)])
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('source', help='directory holding stage5.0-battle-backdrop-<region>.webp')
    parser.add_argument('--colors', type=int, default=48)
    parser.add_argument('--map', action='store_true', help='convert the map backdrops instead')
    parser.add_argument('--opening', action='store_true', help='convert the opening painting instead')
    args = parser.parse_args()
    if args.opening:
        source = os.path.join(args.source, 'stage5.0-starter-backdrop.webp')
        target = os.path.join(os.path.dirname(MAP_OUT), 'opening.png')
        convert(source, max(args.colors, 64), OPENING_NATIVE).save(target, optimize=True)
        print(f'opening: {os.path.getsize(target)} bytes')
        return
    kind, names, out, native = ('map', LOCALES, MAP_OUT, MAP_NATIVE) if args.map else ('battle', REGIONS, OUT, NATIVE)
    os.makedirs(out, exist_ok=True)
    for region in names:
        source = os.path.join(args.source, f'stage5.0-{kind}-backdrop-{region}.webp')
        if not os.path.exists(source):
            print(f'skip {region}: no source')
            continue
        target = os.path.join(out, f'{region}.png')
        image = convert(source, args.colors, native)
        if kind == 'battle' and region == 'gym':
            image = paint_out_gym_emblem(image)
        image.save(target, optimize=True)
        print(f'{region}: {os.path.getsize(target)} bytes')


if __name__ == '__main__':
    main()
