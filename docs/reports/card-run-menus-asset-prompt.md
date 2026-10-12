# Card run menus: the asset prompt for ChatGPT

**2026-10-12**, for [`../spec/gymrun-card-run-menus-art.md`](../spec/gymrun-card-run-menus-art.md).
The code already asks for every file below by name
(`src/ui/cardrun/assets.ts`), and draws a CSS fallback until it arrives.
Generating them changes nothing in the code: save each file as
`src/ui/assets/cardrun/<name>.svg` and it shows up on the screens it belongs to.
`test/cards-run-art.test.ts` fails on a file there that is no slot's, so a
misspelt name is caught.

**Already drawn, not asked for:** the three unit portraits, the card pictures
(the battle's meadow pack, listed in [`card-run-art-list.md`](card-run-art-list.md)),
the hearts and shield bubbles, and every panel, button, ribbon and speech
bubble, which are CSS.

## How to run it

Paste the prompt below into ChatGPT once, with the mock image
(`docs/spec/assets/card-run-menus-mock.png`) attached as the style
reference. Ask for the files a few at a time ("now the four backdrops",
"now the sign and the three characters", "now the nine icons") and save each
answer as the file it names. Check each in a browser at its drawn size
before saving: an icon has to read at 18 to 48 pixels.

## The prompt

```text
You are drawing SVG assets for a mobile card game's menu screens. Attached is
the mock the screens are built from: match its art style exactly.

STYLE
- Cheerful hand-drawn cartoon, like the mock: chunky rounded shapes, flat
  colour fills with one soft shade and one highlight per shape, and a thick
  dark navy outline (#1f3550, stroke about 4% of the shorter side, round
  joins and caps) around every object.
- Warm saturated palette: meadow greens (#7fbf7a, #3fa64b), sky blues
  (#a8d4f0, #4c87b7), sandy path (#e8c48a), wood browns (#d9a066, #7a4a22),
  cream (#fffaf0), accents in red (#c0463b), gold (#f2b705) and purple
  (#8664ac).
- The heroes are three cute animal soldiers, as in the mock:
  A, the Commander: an orange fox with a teal scarf who carries a blue flag.
  B, the Gunner: a round dark bird in a green army helmet with a big cannon.
  C, the Sword dasher: a cream-and-orange cat with a purple scarf and a sword.

HARD RULES FOR EVERY FILE
- One standalone SVG 1.1 file: <svg xmlns="http://www.w3.org/2000/svg"
  viewBox="..."> with the exact viewBox given below, and no width or height
  attributes.
- No <text>, no letters or numbers anywhere: the game draws all words.
- No <image>, no embedded bitmaps, no external references, no fonts, no
  <script>, no <foreignObject>, no CSS @import. Gradients are fine; keep
  filters to none, or one soft drop shadow at most.
- Transparent background, except the four backdrops, which fill their whole
  viewBox.
- Keep each file small: a backdrop under 150 KB, anything else under 40 KB.
  Prefer few, clean paths over many tiny ones.
- Reply with the complete SVG code for each file, under its file name.

THE FILES

1. bg-route.svg (viewBox 0 0 780 1688): the route map behind "Choose your
   stop". A top-down storybook forest map: a winding sandy path from the
   bottom left up to the top right, a small river crossing near the top,
   round trees, bushes, rocks and flowers. No buildings, no map pins, no
   signs: the game puts the stops on it. Keep the middle 600 units of height
   calm and light, because cream panels cover most of it; the top 300 and
   bottom 300 can carry the detail.

2. bg-market.svg (viewBox 0 0 780 1688): behind "Pick a card" and the
   market. A wooden market stall seen from the front in the top third:
   striped awning, coloured bunting flags strung across, crates, barrels and
   a few wrapped goods; the meadow below, plain and light. No shopkeeper:
   the game draws one separately.

3. bg-city.svg (viewBox 0 0 780 1688): behind "City". A small village in the
   top third: three or four cottages with red and blue roofs, a stone path,
   bunting between rooftops, a blue sky; grass and cobbles below, calm and
   light.

4. bg-trail.svg (viewBox 0 0 780 1688): behind "Make room", "The boss
   falls" and every other screen. A sunny forest clearing: trees framing the
   top corners, distant blue hills, a grassy floor that stays plain and
   light from a third of the way down.

5. sign-plank.svg (viewBox 0 0 360 140): the wooden sign every screen title
   hangs on. A wide horizontal plank with a darker wood frame and rounded
   corners, hanging from two short posts or ropes at the top. The game
   stretches this sign to fit its text by cutting it nine ways, so:
   - The plank itself starts at y=30 and fills the rest of the height.
   - Both posts must sit entirely inside the top-left box (x 0 to 48,
     y 0 to 44) and the top-right box (x 312 to 360, y 0 to 44).
   - The middle band (x 48 to 312, y 44 to 112) must be plain wood with
     only horizontal grain, no knots or nails, because it is stretched in
     both directions.
   - Nails or decoration go only in the four corners.
   - Above y=30, between the posts, stays transparent.

6. char-scout.svg (viewBox 0 0 240 240): the Commander fox seen from behind,
   standing on a small rock, a backpack on, holding the blue flag up on a
   pole, looking out over the land. Feet on the bottom edge, transparent
   background.

7. char-trader.svg (viewBox 0 0 240 240): the Gunner as a friendly
   shopkeeper, from the waist up behind a short wooden counter, waving one
   wing, green helmet on, smiling, facing the viewer. Counter on the bottom
   edge, transparent background.

8. char-party.svg (viewBox 0 0 480 240): all three heroes seen from behind,
   side by side, walking off together: the cat with its sword on the left,
   the fox with the flag in the middle, the bird with its cannon on the
   right. Feet on the bottom edge, transparent background.

9. stop-city.svg (viewBox 0 0 96 96): a small cottage with a red roof and a
   chimney, three-quarter view, sitting on a tuft of grass.

10. stop-town.svg (viewBox 0 0 96 96): a red map pin with two crossed swords
    in a white disc at its head.

11. stop-wild.svg (viewBox 0 0 96 96): a teal map pin with a big white
    question-mark shape at its head (a drawn shape, not a text character).

12. city-market.svg (viewBox 0 0 96 96): a wooden shopping cart, gold coins
    and a small sack in it.

13. city-defense.svg (viewBox 0 0 96 96): a blue heater shield with a gold
    rim and a white chevron.

14. icon-warning.svg (viewBox 0 0 64 64): a red round badge with a white
    sword, point up, for a danger warning.

15. icon-star.svg (viewBox 0 0 64 64): a plump five-pointed gold star with a
    highlight, marking a talent.

16. icon-supplies.svg (viewBox 0 0 64 64): a small wooden supply crate with a
    gold diamond on its front, the game's currency.

17. icon-deck.svg (viewBox 0 0 64 64): a fanned stack of three playing
    cards, cream faces with blue backs showing.

For every icon (files 9 to 17): centred, with about 6 units of empty margin
on every side, thick outline, and readable when drawn as small as 18 pixels.
```

## The slots, for checking a delivery

| File | viewBox | Drawn at | Where it shows |
|---|---|---|---|
| `bg-route.svg` | 780 × 1688 | covers the screen | the route; the title; a battle's run screen |
| `bg-market.svg` | 780 × 1688 | covers the screen | the card offer; the market |
| `bg-city.svg` | 780 × 1688 | covers the screen | the City |
| `bg-trail.svg` | 780 × 1688 | covers the screen | replace, boss, upgrade, shrine, Wild, the end |
| `sign-plank.svg` | 360 × 140 | each heading's width, at least 84 high; cut nine ways at 44, 48, 28, 48 | every screen's title |
| `char-scout.svg` | 240 × 240 | 112 × 112 | foot of the route, the Wild, the title |
| `char-trader.svg` | 240 × 240 | 112 × 112 | foot of the offer, the market, the City, with its line |
| `char-party.svg` | 480 × 240 | 208 × 104 | foot of replace, boss, the end |
| `stop-city.svg` | 96 × 96 | 48 × 48 | the route's City card |
| `stop-town.svg` | 96 × 96 | 48 × 48 | the route's Town card |
| `stop-wild.svg` | 96 × 96 | 48 × 48 | the route's Wild card |
| `city-market.svg` | 96 × 96 | 44 × 44 | the City's Market row |
| `city-defense.svg` | 96 × 96 | 44 × 44 | the City's Defense quest row |
| `icon-warning.svg` | 64 × 64 | 28 × 28 | the act warning ribbon |
| `icon-star.svg` | 64 × 64 | 18 × 18 | a talent: on the team card and the boss screen |
| `icon-supplies.svg` | 64 × 64 | 20 × 20 | the supplies count in the header |
| `icon-deck.svg` | 64 × 64 | 20 × 20 | the Deck button |

## What the mock shows that the screens do not do

The functionality is the session's to keep, so these parts of the mock are
not built; none needs an asset:

- **Rest (optional)** in the City, *"Heal 1 HP on all units"*: the run has no
  rest. A City is its market or its defense quest.
- **Back** on the City and **Cancel** on *Make room*: a stop, once chosen,
  is resolved, and a card reward has no skip (`CLAUDE.md`, Rewards).
- **MP pips on the team cards:** MP does not carry between fights. The team
  cards show what does: HP as hearts, base shield as bubbles, card slots,
  MP boosts and talents.
- **The map's pins in place of the stop cards:** the three stops stay three
  cards, each with its pin, so every line they carry stays readable. The map
  is the backdrop.
- **Labels the mock invents** (*Defensive*, *Movement* on offered cards): a
  card shows its shape, from the data.
