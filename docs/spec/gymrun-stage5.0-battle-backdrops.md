# Stage 5.0/2: the first battle backdrops, and the native size

Filed **before any change to `src/`**, per [`README.md`](README.md) rule 7.

2026-09-30, on `claude/wizardly-wright-cum8e0`, inside 5.0/2.

Two messages. The first asked whether the battle screen was ready for the
battle backdrop art, so the author could judge the asset pipeline inside this
stage rather than at 5.0/5. The answer was yes, with the slot's geometry and a
recommendation to move the native size from the 5.0/0 spike's 216x170 to
224x136: the stage settled at 272px, not the spike's 340, so 170 rows are cut
by 36 on every screen, and 216 columns leave 3 uncovered each side on the
widest frame. The second message takes it and delivers the art.

The five images arrived as five attachments without file names. The chat
transport drops names; each is identified here by what it depicts, which is
the naming the message states. The originals are kept as they arrived:

| File | Depicts | Region |
|---|---|---|
| [`assets/stage5.0-battle-backdrop-gym.webp`](assets/stage5.0-battle-backdrop-gym.webp) | a stadium with banners and a ringed floor | gym |
| [`assets/stage5.0-battle-backdrop-ruins.webp`](assets/stage5.0-battle-backdrop-ruins.webp) | overgrown ruins over a waterfall | ruins |
| [`assets/stage5.0-battle-backdrop-shore.webp`](assets/stage5.0-battle-backdrop-shore.webp) | a beach with sea stacks | shore |
| [`assets/stage5.0-battle-backdrop-cave.webp`](assets/stage5.0-battle-backdrop-cave.webp) | a crystal cave with an underground lake | cave |
| [`assets/stage5.0-battle-backdrop-marsh.webp`](assets/stage5.0-battle-backdrop-marsh.webp) | a misty wetland with cattails | marsh |

A third message followed with the other four, as four attachments and no text:

| File | Depicts | Region |
|---|---|---|
| [`assets/stage5.0-battle-backdrop-badlands.webp`](assets/stage5.0-battle-backdrop-badlands.webp) | red mesas, an arch and lava falls | badlands |
| [`assets/stage5.0-battle-backdrop-city.webp`](assets/stage5.0-battle-backdrop-city.webp) | a paved plaza before a domed city and a bridge | city |
| [`assets/stage5.0-battle-backdrop-summit.webp`](assets/stage5.0-battle-backdrop-summit.webp) | a snowfield under peaks above the clouds | summit |
| [`assets/stage5.0-battle-backdrop-forest.webp`](assets/stage5.0-battle-backdrop-forest.webp) | a clearing before a cliff waterfall | forest |

All nine are 1536x1024 RGB: a painted pixel-art look, not art at a native
grid. They reach the game through a conversion step (`scripts/visual/backdrops.py`).

---

## The prompts, verbatim

> are you ready for the battle background assets? if so, i'd rather include them in this so i can see if our asset generation needs tweaking

> try 224x136. here are the battle bgs, named for the region they represent

> *(four further attachments, no text)*
