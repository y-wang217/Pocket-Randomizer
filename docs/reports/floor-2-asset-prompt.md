# Floor 2: the asset prompt for ChatGPT

**2026-10-13**, for [`floor-2-design.md`](floor-2-design.md). The code will ask
for every file below by name. Until a file arrives the screen draws a
placeholder of the right size. Save each as `src/ui/assets/cardbattle/<group>/<name>.svg`,
with the group given beside the file.

## Update, 2026-10-13: the nine illustrated files come as PNG

ChatGPT's SVG conversions lost facial detail under the 40 KB cap, so the nine
illustrated files (the background, the three tiles, the three enemies and the
two card arts) come as **PNG**. Only the three icons stay SVG, because the game
tints them. No code change is needed for this: the battle already prefers a
raster `{group}/{id}.webp` over the `.svg` of the same name, which is how the
meadow pack ships. Each PNG is converted to WebP at the pack's own pixel size
before it is committed:

| files | pixels | as the meadow pack |
|---|---|---|
| `background-fort` | 780 × 1688, opaque | `background-meadow.webp`, 58 KB |
| the three `tile-fort-*` | 168 × 168, opaque | `tile-danger-zone.webp` |
| the three `marker-enemy-*` | 144 × 144, transparent | `marker-enemy-drone.webp` |
| `art-cleanse`, `art-antidote` | 180 × 150, transparent | `art-shoot.webp` |

Each PNG is one subject on a transparent background (the background and the
tiles excepted), square-on, with nothing else in the frame: three enemies in
one image are cut into three files.

## How to run it

Paste the prompt below into ChatGPT once, with a screenshot of a floor 1
battle attached as the style reference (the meadow board with the fox, bird
and cat). Ask for the files a few at a time and save each answer under the
name it gives. Check each in a browser at its drawn size first: a marker must
read at 48 pixels and an icon at 18.

## The prompt

```text
You are drawing SVG assets for a mobile tactics card game. Attached is a
screenshot of its first floor, a sunny meadow: match its art style exactly,
but the files below are for FLOOR 2, a ruined stone fort at dusk.

STYLE
- Cheerful hand-drawn cartoon, as in the screenshot: chunky rounded shapes,
  flat colour fills with one soft shade and one highlight per shape, and a
  thick dark navy outline (#1f3550, round joins and caps) around every object.
- Floor 2 palette: dusk purples (#5b4a7a, #8664ac), warm stone greys
  (#9a8f86, #6e6560), torch orange (#e8893a) and gold (#f2b705), moss green
  (#5e8f4f), with the same cream (#fffaf0) highlights.
- The enemies are mischievous cartoon soldiers and beasts, menacing but cute,
  never gory. Each faces DOWN the screen, toward the player.

HARD RULES FOR EVERY FILE
- One standalone SVG 1.1 file: <svg xmlns="http://www.w3.org/2000/svg"
  viewBox="..."> with the exact viewBox given below, and no width or height.
- No <text>, no letters or numbers anywhere: the game draws all words.
- No <image>, no embedded bitmaps, no external references, no fonts, no
  <script>, no <foreignObject>. Gradients are fine; at most one soft shadow.
- Transparent background, except the background and the three tiles, which
  fill their whole viewBox.
- Keep the background under 150 KB and anything else under 40 KB.
- Reply with the complete SVG code for each file, under its file name.

THE FILES

1. background-fort.svg (group ui), viewBox 0 0 780 1688.
   The battle's backdrop behind the board: a ruined fort courtyard at dusk,
   broken walls at the top, torches, moss on the stones, a purple sky. Keep the
   middle calm and low-contrast: the board's tiles sit over it.

2. tile-fort-player-backline.svg (group tiles), viewBox 0 0 64 64.
   The player's two home rows: worn flagstones, warm and light, clearly safe.

3. tile-fort-danger-zone.svg (group tiles), viewBox 0 0 64 64.
   The middle three rows: cracked stone with a faint orange glow in the cracks.

4. tile-fort-enemy-backline.svg (group tiles), viewBox 0 0 64 64.
   The enemy's two rows at the top: dark rubble with a purple tint.

5. marker-enemy-snarer.svg (group markers), viewBox 0 0 64 64.
   A wiry goblin trapper holding a weighted net and coils of vine rope. Fast:
   lean, mid-stride.

6. marker-enemy-breaker.svg (group markers), viewBox 0 0 64 64.
   A stocky armoured ram-headed brute with a cracked-shield emblem and a heavy
   maul. It breaks armour.

7. marker-enemy-reaver.svg (group markers), viewBox 0 0 64 64.
   A sleek wolf-raider with twin curved blades, leaning forward. Fast.

8. icon-root.svg (group icons), viewBox 0 0 24 24.
   Status icon, one colour (it is tinted by the game, so use a single fill,
   #1f3550, no outline): two vines wrapping around a boot.

9. icon-frail.svg (group icons), viewBox 0 0 24 24.
   Status icon, one colour as above: a shield with a crack through it.

10. icon-cleanse.svg (group icons), viewBox 0 0 24 24.
    Effect icon, one colour as above: a droplet with two small sparkles.

11. art-cleanse.svg (group art), viewBox 0 0 180 150.
    Card illustration: the fox Commander (orange fox, teal scarf) pouring
    sparkling water from a flask over a vine-wrapped boot, the vines falling away.

12. art-antidote.svg (group art), viewBox 0 0 180 150.
    Card illustration: a round glass flask of glowing green liquid with a cork
    and a leaf label, on a little wooden crate.
```
