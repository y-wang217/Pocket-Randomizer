"""
The node silhouettes from the author's drawings. The map calm-down patch, bible
Rev 30, D109.

    python3 scripts/visual/silhouettes.py SRC.webp OUT.png 32

The author delivered five node drawings as 1254px renders of pixel art on
white (`docs/spec/assets/map-calm-down-node-*.webp`), whose cells are not a
strict grid. This samples the centre of each cell of an N by N grid laid over
the drawing's square bounding box, snaps it to the drawing's own palette, and
clears the white ground, so the file under `src/ui/assets/silhouettes/` is
true pixel art at its native size. It also writes an 8x preview beside it.

Tooling, not the game: Pillow and numpy, as `backdrops.py`.
"""
from PIL import Image
import numpy as np
src, out, N = sys.argv[1], sys.argv[2], int(sys.argv[3])
im = Image.open(src).convert('RGBA')
a = np.asarray(im).astype(float)
rgb = a[..., :3]; al = a[..., 3] / 255
# white or transparent counts as background
bg = (al < 0.5) | (rgb.min(-1) > 235)
# crop to a square around the content, with a 1-cell margin
ys, xs = np.where(~bg)
cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
side = max(xs.max() - xs.min(), ys.max() - ys.min()) * (N / (N - 2))
x0, y0 = int(cx - side / 2), int(cy - side / 2)
cell = side / N
# palette: the most common opaque colours, quantised
fg = rgb[~bg].reshape(-1, 3)
q = (fg // 12).astype(int)
keys, counts = np.unique(q[:, 0] * 10000 + q[:, 1] * 100 + q[:, 2], return_counts=True)
order = np.argsort(-counts)
pal = []
for k in keys[order]:
    c = np.array([k // 10000, (k // 100) % 100, k % 100]) * 12 + 6
    if all(np.abs(c - p).sum() > 60 for p in pal):
        pal.append(c)
    if len(pal) >= 7:
        break
pal = np.clip(np.array(pal), 0, 255)
outa = np.zeros((N, N, 4), np.uint8)
for j in range(N):
    for i in range(N):
        ya, yb = int(y0 + j * cell + cell * 0.25), int(y0 + (j + 1) * cell - cell * 0.25)
        xa, xb = int(x0 + i * cell + cell * 0.25), int(x0 + (i + 1) * cell - cell * 0.25)
        ya, xa = max(ya, 0), max(xa, 0)
        block_bg = bg[ya:yb, xa:xb]
        if block_bg.size == 0 or block_bg.mean() > 0.5:
            continue
        px = rgb[ya:yb, xa:xb][~block_bg]
        med = np.median(px, axis=0)
        c = pal[np.argmin(np.abs(pal - med).sum(-1))]
        outa[j, i, :3] = c; outa[j, i, 3] = 255
Image.fromarray(outa, 'RGBA').save(out)
Image.fromarray(outa, 'RGBA').resize((N * 8, N * 8), Image.NEAREST).save(out.replace('.png', '-x8.png'))
