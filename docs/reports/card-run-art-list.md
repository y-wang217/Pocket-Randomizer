# Card run: the art list

**2026-10-12**, card run shapes step 7b, item 13
([`../spec/gymrun-card-run-shapes-prompt.md`](../spec/gymrun-card-run-shapes-prompt.md)).
A shopping list, not drawing: every card the card run added to the
Puppeteer's sixteen, every veteran and the Warlord, with the art each one
shows today. Generated from the card data and the asset manifest
(`src/ui/cardbattle/assets.ts`) on `cards-0.11.0`, `cardrun-0.9.0`, so a row
says what the screen draws, not what was meant.

**The count:** 34 cards. 16 borrow another card's
picture, and 18 have none: the frame's art window is empty. All
8 enemies below wear another enemy's marker. Talents carry no
art and none is asked for.

## How to read it

- **Picture** is the illustration in the card frame's art window, from the
  meadow pack's sixteen (`art-*`). *X's* means the card shows X's picture.
  *None* means nothing is drawn there yet. Each card names the picture it
  borrows in its `art` field (`src/cardData/runCards.ts`). New art lands as
  `art-<card id>` in `src/ui/assets/cardbattle/art/` and in the manifest's
  `art` ids, and the card's `art` field is then dropped.
- **Face icon** is the keyword icon on the card's face, from the icon set.
  It is drawn for every card and is not missing; it is listed so a new
  picture can be drawn to sit beside it.
- **Marker** is the token on the board. A veteran wears its plain enemy's
  marker until its own arrives (`ENEMY_MARKER`, `src/ui/cardbattle/sandbox.ts`).
  The plain Hound, Turret, Bulwark, Sniper and Pikeman markers are themselves
  placeholders drawn in the pack's style, so their veterans borrow a
  placeholder.

## Cards

| Card | Owner | Where it comes from | Picture | Face icon |
|---|---|---|---|---|
| Baton | A Commander | starting deck | Attack's | strike |
| Brace | A Commander | starting deck | Prep's | shield |
| Brace | B Gunner | starting deck | Prep's | shield |
| Brace | C Sword dasher | starting deck | Prep's | shield |
| Fortify | A Commander | Puppeteer | none: the window is empty | shield |
| Orders | A Commander | Puppeteer | none: the window is empty | move |
| Snipe | B Gunner | Escort Artillery | none: the window is empty | pierce |
| Volley | B Gunner | Escort Artillery | none: the window is empty | blast |
| Cleave | C Sword dasher | Control and Sweep | none: the window is empty | slash |
| Guard Up | C Sword dasher | Bodyguard and Battery | none: the window is empty | shield |
| Sprint | Neutral | Escort Artillery | none: the window is empty | move |
| Jab | Neutral | Control and Sweep | none: the window is empty | strike |
| Whirlwind | C Sword dasher | Control and Sweep | Slash's | slash |
| Rally | A Commander | Puppeteer | Command's | move |
| Mark Target | A Commander | Bodyguard and Battery | Moon Strike's | strike |
| Suppress | B Gunner | Escort Artillery | Fire!'s | blast |
| Second Wind | Neutral | Bodyguard and Battery | Resupply's | mp |
| Shove | C Sword dasher | Control and Sweep | Dash's | slash |
| Patch Up | A Commander | Puppeteer | Call Medic's | repair |
| Guard Duty | C Sword dasher | Bodyguard and Battery | Prep's | shield |
| Concuss | B Gunner | Control and Sweep | Shoot's | strike |
| Overcharge | A Commander | Bodyguard and Battery | Moon Strike's | strike |
| Barrage | B Gunner | Escort Artillery | Artillery's | blast |
| Interpose | C Sword dasher | Escort Artillery | Dash's | move |
| Ration | Neutral | market, 2 | none: the window is empty | mp |
| Stim Pack | Neutral | market, 3 | none: the window is empty | mp |
| Sandbags | Neutral | market, 2 | none: the window is empty | shield |
| Tower Shield | Neutral | market, 3 | none: the window is empty | shield |
| Grenade | Neutral | market, 3 | none: the window is empty | blast |
| Flare | Neutral | market, 2 | none: the window is empty | draw |
| Flashbang | Neutral | market, 3 | none: the window is empty | blast |
| Grapple | Neutral | market, 3 | none: the window is empty | harpoon |
| Smoke | Neutral | market, 3 | none: the window is empty | stealth |
| Riot Net | Neutral | market, 4 | none: the window is empty | blast |

An upgrade (*Baton+*) shows its card's picture and needs none of its own.

## Veterans and the Warlord

| Enemy | Veteran of | Marker it wears |
|---|---|---|
| Drone Mk II | Drone | marker-enemy-drone |
| Lancer Captain | Lancer | marker-enemy-lancer |
| Dire Hound | Hound | marker-enemy-hound |
| Heavy Turret | Turret | marker-enemy-turret |
| Juggernaut | Bulwark | marker-enemy-bulwark |
| Deadeye | Sniper | marker-enemy-sniper |
| Halberdier | Pikeman | marker-enemy-pikeman |
| Warlord | boss | marker-enemy-base |

## Also standing in

Not new in the card run, but on the same list for the same reason:

- **Icons drawn as placeholders** (`assets.ts`, *"Not in the pack"*): the
  shovel, the harpoon, the scream, Fast, the pinned mark (a Stun and a
  Harpoon's pin share it), Retain, Undo and Menu.
- **Enemy markers drawn as placeholders**: the Hound, the Turret, the
  Bulwark, the Sniper, the Pikeman, and the Colossus with its pinned pose.
