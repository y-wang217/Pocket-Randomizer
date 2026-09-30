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

Tooling, not the game: it needs Pillow (`pip install pillow`), which nothing in
the build or the test suite imports. Re-run it when the art changes.
"""
import argparse
import os
from PIL import Image

NATIVE = (224, 136)
REGIONS = ('gym', 'cave', 'shore', 'summit', 'city', 'forest', 'ruins', 'marsh', 'badlands')
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'ui', 'assets', 'backdrops', 'battle')


def convert(source: str, colors: int) -> Image.Image:
    image = Image.open(source).convert('RGB')
    width, height = image.size
    keep = round(width * NATIVE[1] / NATIVE[0])
    top = max(0, height - keep)  # trim sky, keep the ground
    image = image.crop((0, top, width, top + min(keep, height)))
    image = image.resize(NATIVE, Image.Resampling.BOX)
    return image.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('source', help='directory holding stage5.0-battle-backdrop-<region>.webp')
    parser.add_argument('--colors', type=int, default=48)
    args = parser.parse_args()
    os.makedirs(OUT, exist_ok=True)
    for region in REGIONS:
        source = os.path.join(args.source, f'stage5.0-battle-backdrop-{region}.webp')
        if not os.path.exists(source):
            print(f'skip {region}: no source')
            continue
        target = os.path.join(OUT, f'{region}.png')
        convert(source, args.colors).save(target, optimize=True)
        print(f'{region}: {os.path.getsize(target)} bytes')


if __name__ == '__main__':
    main()
