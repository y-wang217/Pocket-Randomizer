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


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('source', help='directory holding stage5.0-battle-backdrop-<region>.webp')
    parser.add_argument('--colors', type=int, default=48)
    parser.add_argument('--map', action='store_true', help='convert the map backdrops instead')
    args = parser.parse_args()
    kind, names, out, native = ('map', LOCALES, MAP_OUT, MAP_NATIVE) if args.map else ('battle', REGIONS, OUT, NATIVE)
    os.makedirs(out, exist_ok=True)
    for region in names:
        source = os.path.join(args.source, f'stage5.0-{kind}-backdrop-{region}.webp')
        if not os.path.exists(source):
            print(f'skip {region}: no source')
            continue
        target = os.path.join(out, f'{region}.png')
        convert(source, args.colors, native).save(target, optimize=True)
        print(f'{region}: {os.path.getsize(target)} bytes')


if __name__ == '__main__':
    main()
