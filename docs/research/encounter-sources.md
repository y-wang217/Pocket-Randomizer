# Encounter sources: what the library can be built from

Stage 6.0, checkpoint 1. The prompt
([`../spec/gymrun-stage6.0-encounter-library.md`](../spec/gymrun-stage6.0-encounter-library.md))
asks for research before code, so this is the report and the stop. Every
number here was measured by `scripts/import-encounters/` run in `--report`
mode on 2026-10-05; the same command reproduces them.

## 1. The ask, restated

Defenders should be coherent teams drawn from a cited library of real
encounters: the trainer, the game, the place, the party at its canonical
levels and moves, and a Showdown trainer sprite of the right era. The library
should hold 500 or more encounters and be encoded so a seed maps to one.

The finding is that **5,374 encounters** are available from Gen 1 to 4 alone,
with exact levels for every one of them, moves and items for every boss, and a
verified sprite for 99.9% of them. The 500 bar is cleared ten times over before
any hand curation.

## 2. Sprites: the Showdown CDN

Every trainer sprite lives at `https://play.pokemonshowdown.com/sprites/trainers/<id>.png`.
The directory index lists **1,502** sprites. The list is scraped once into
[`../../scripts/import-encounters/sprites.json`](../../scripts/import-encounters/sprites.json)
with its date, and a sprite id is written into a record only if it is in that
list, so a generated table never names a 404.

**Naming.** A bare id is the newest official art (`brock`, `cynthia`,
`youngster`). An era suffix is the art from that game: `-gen1rb`, `-gen1`,
`-gen2`, `-gen3`, `-gen3rs`, `-gen3frlg`, `-rse`, `-gen4`, `-gen4dp`,
`-gen5bw`, `-gen5bw2`, `-gen6xy`, `-gen6`, `-gen7`, `-lgpe`. A role suffix
exists for a few: `blue-gen1rbchampion`, `blue-gen3champion`,
`mustard-champion`. Masters and anime art carry `-masters`, `-anime` and are
never chosen. 589 of the 1,502 carry an era suffix. The importer picks the
most specific era for the game, then the bare id.

**Coverage, named trainers.** Every gym leader, Elite Four member, champion,
rival and villain boss of the nine imported games resolves to a sprite of the
right era. The full name-to-sprite list per game is printed by the report;
some rows of it:

| game | examples |
|---|---|
| Red and Blue | `brock-gen1rb`, `misty-gen1rb`, `ltsurge-gen1rb`, `giovanni-gen1rb`, `lorelei-gen1rb`, `lance-gen1rb`, `blue-gen1rbchampion` |
| Yellow | the same people at `-gen1` |
| Gold, Silver, Crystal | `falkner-gen2` through `clair-gen2`, `will-gen2`, `karen-gen2`, `koga-gen2`, `lance-gen2`, `silver-gen2`, `red-gen2`, `blue-gen2`, `rocketexecutive-gen2` |
| Ruby, Sapphire, Emerald | `roxanne-gen3` through `juan-gen3`, `tateandliza-gen3`, `sidney-gen3` through `drake-gen3`, `steven-gen3`, `wallace-gen3`, `archie-gen3`, `maxie-gen3`, `brendan-gen3`, `may-gen3`, `wally-rse`, the seven frontier brains at `-gen3` |
| FireRed and LeafGreen | the Kanto eight at `-gen3`, `blue-gen3champion`, `giovanni-gen3`, `lorelei-gen3`, `agatha-gen3` |
| Platinum | `roark` through `volkner`, `crasherwake`, `aaron`, `bertha`, `flint`, `lucian`, `cynthia-gen4`, `cyrus`, `mars`, `jupiter`, `saturn`, `barry`, `palmer`, `argenta`, `thorton`, `dahlia`, `darach` |
| HeartGold and SoulSilver | the Johto and Kanto sixteen bare, `lance`, `red`, `blue`, `archer`, `ariana`, `proton`, `petrel`, `giovanni`, `eusine` |

Gen 5 to 9 bosses were checked too, ahead of the curation pass: all 98 names
tried (Cilan through Carmine, every gym leader, Elite Four, champion, rival and
villain of BW, B2W2, XY, ORAS, SM, USUM, SwSh, SV and the DLCs) have a bare
sprite, and the Gen 5 ones mostly have a `-gen5bw` or `-gen5bw2` era variant.

**Coverage, route trainers.** Class sprites resolve for every class except two:
Platinum's `PI` (4 trainers) and one Emerald Cooltrainer row with no class
text. Gendered classes pick the `f` variant where the source flags the
trainer as a woman (Gen 3's `F_TRAINER_FEMALE`, Gen 4's `_FEMALE` or `_F`
class constants). Showdown's own avatar table (`BattleAvatarNumbers` in the
client's `battle-dex-data.ts`, 294 rows) was the reference for class ids.

**Two misses in the Gen 1 to 4 named list** would have mattered and do not:
`lorelei` and `agatha` have no bare id but do have `-gen1`, `-gen1rb` and
`-gen3`; `tateandliza` has `-gen3` and `-gen6`; `phoebe` and `drake` have
`-gen3`; `archie` and `maxie` have `-gen3`. The era-first rule finds them all.

## 3. Team data: the pret decompilations

All nine Gen 1 to 4 games are reachable from this container as raw files or a
sparse checkout, and all nine parse. Each is pinned to a revision in
[`../../scripts/import-encounters/sources.json`](../../scripts/import-encounters/sources.json)
so a re-run reads the same bytes and a citation names the revision.

| game | repository | files | shape |
|---|---|---|---|
| Red and Blue | `pret/pokered` | `data/trainers/parties.asm`, `data/trainers/names.asm` | one `db` row per trainer, grouped by class, with a place comment above each run of rows |
| Yellow | `pret/pokeyellow` | same | same |
| Gold and Silver | `pret/pokegold` | `data/trainers/parties.asm`, `data/trainers/class_names.asm` | `"NAME@", TRAINERTYPE_*` then `level, species[, item][, 4 moves]` rows |
| Crystal | `pret/pokecrystal` | same | same |
| Ruby and Sapphire | `pret/pokeruby` | `src/data/trainers_en.h`, `src/data/trainer_parties.h`, class-name text table | `gTrainers[]` initialisers (class, pic, name, items, doubles flag, party pointer) and party structs with `.level`, `.species`, optional `.heldItem` and `.moves` |
| Emerald | `pret/pokeemerald` | `src/data/trainers.h`, `src/data/trainer_parties.h`, class-name text table | same, `.lvl` |
| FireRed and LeafGreen | `pret/pokefirered` | same | same |
| Platinum | `pret/pokeplatinum` | `res/trainers/data/<class>_<name>[_<place>][_rematch].json`, 928 files | one JSON per trainer with name, class constant, items, party of `species`, `form`, `level`, `item`, explicit `moves` |
| HeartGold and SoulSilver | `pret/pokeheartgold` | `files/poketool/trainer/trainers.json` | one JSON of 738 trainers in the same shape, names prefixed `{TRNAME}` |

What the report counted, after dropping the rows that are not opponents (the
player's own data, the Gen 4 partners Cheryl, Mira, Riley, Buck and Marley,
Platinum's 180 `dummy` slots, Gen 1's `Unused` rows):

| game | encounters | gym | elite | champion | rival | boss | route | with set moves | with items | levels |
|---|---|---|---|---|---|---|---|---|---|---|
| Red and Blue | 352 | 8 | 4 | 3 | 21 | 2 | 314 | 0 | 0 | 5-65 |
| Yellow | 343 | 8 | 4 | 3 | 13 | 2 | 313 | 0 | 0 | 5-65 |
| Gold and Silver | 495 | 16 | 4 | 2 | 21 | 6 | 446 | 89 | 17 | 2-81 |
| Crystal | 541 | 16 | 4 | 2 | 21 | 6 | 492 | 124 | 23 | 2-81 |
| Ruby and Sapphire | 693 | 8 | 4 | 1 | 30 | 18 | 632 | 0 | 23 | 3-58 |
| Emerald | 852 | 40 | 4 | 1 | 39 | 17 | 751 | 151 | 67 | 3-78 |
| FireRed and LeafGreen | 639 | 8 | 8 | 6 | 21 | 2 | 594 | 118 | 45 | 5-75 |
| Platinum | 725 | 17 | 9 | 2 | 33 | 17 | 647 | 230 | 49 | 3-85 |
| HeartGold and SoulSilver | 734 | 33 | 8 | 4 | 24 | 15 | 650 | 244 | 55 | 2-88 |
| **total** | **5,374** | **154** | **49** | **24** | **223** | **85** | **4,839** | **956** | **279** | |

Reading the roles:

- **gym** is a gym leader fight, including every rematch (Emerald's five
  rounds per leader, Platinum's and HGSS's rematch rosters), and Giovanni's
  Viridian fight. Blue's Viridian gym in HGSS is a gym with no type.
- **elite** is an Elite Four fight. Koga is Kanto's gym leader in Gen 1 and
  FRLG and Johto's Elite Four in Gen 2 and HGSS; the class decides.
- **champion** is the league's last fight, including Red and Blue's third
  rival battle (the Champion fight), Red on Mt. Silver, and FRLG's six
  starter-specific Blue rosters.
- **rival** is Blue, Silver, Brendan, May, Wally and Barry, with their
  placeholder names (`TERRY`, `Cedric`, `?`) normalised.
- **boss** is a villain (Giovanni's hideouts, Archie, Maxie, the admins,
  Cyrus, the commanders, the HGSS executives) or a Battle Frontier brain
  (Anabel through Brandon, Palmer through Darach).
- **route** is everyone else: a named Youngster on Route 3.

Gen 1 has no set moves and no items (the games had neither). Gen 2 onwards
sets moves for bosses and some route trainers. Everything else is a party at a
level, and the engine fills the rest.

## 4. What the engine will accept

The library keeps the citation exact and projects a *playable* copy through
the same filters the pools were generated with (`scripts/gen-pools.ts`): a
species must be in `SPECIES_POOL` and off `BLACKLISTED_SPECIES`; a set move
must be in `DAMAGING_MOVES` or `STATUS_MOVES`.

| game | members in species pool | aces in species pool | set moves in move pool | sprite resolved |
|---|---|---|---|---|
| Red and Blue | 903/903 (100%) | 352/352 (100%) | n/a | 352/352 (100%) |
| Yellow | 871/871 (100%) | 343/343 (100%) | n/a | 343/343 (100%) |
| Gold and Silver | 1149/1149 (100%) | 495/495 (100%) | 754/1065 (71%) | 495/495 (100%) |
| Crystal | 1254/1254 (100%) | 541/541 (100%) | 965/1385 (70%) | 541/541 (100%) |
| Ruby and Sapphire | 1485/1486 (100%) | 693/693 (100%) | n/a | 693/693 (100%) |
| Emerald | 1823/1823 (100%) | 852/852 (100%) | 1099/1676 (66%) | 851/852 (100%) |
| FireRed and LeafGreen | 1650/1650 (100%) | 639/639 (100%) | 1178/1619 (73%) | 639/639 (100%) |
| Platinum | 1632/1634 (100%) | 724/725 (100%) | 1863/2406 (77%) | 721/725 (99%) |
| HeartGold and SoulSilver | 1772/1773 (100%) | 734/734 (100%) | 1979/2755 (72%) | 734/734 (100%) |

**Species.** Three ids fall outside the pool across 12,339 party members:
`shedinja` (blacklisted, 2 rows), `wormadamsandy` and `wormadamtrash` (formes
are out of the pool, 1 row each). No legendary appears on any of these 5,374
rosters, which is a property of the games rather than of the filter. The fit
rule drops the member; one Platinum row loses its ace that way and is marked
unplayable.

**Moves.** About 28% of set moves are outside the pool: 180 distinct ids,
led by `supersonic` (131), `smokescreen` (118), `feintattack` (114),
`doubleteam` (109), `sunnyday` (96), `leer`, `sonicboom`, `growl`,
`sandattack`, `meanlook`, `hyperbeam`, `raindance`, `solarbeam`, `explosion`.
Two reasons: the status pool is curated to moves with a measurable impact
(`growl` and `leer` are not in it on purpose), and `isNonstandard: 'Past'`
moves (`pursuit`, `return`, `hiddenpower`, `signalbeam`) are excluded from the
move pool though their species are admitted. The fit rule keeps the moves the
pool admits and rolls the remaining slots, which is the same thing the games
do for a trainer with fewer than four set moves.

**Items.** Four Gen 2 held items have no modern counterpart and are dropped:
`NUGGET` (35 rows), `STARDUST` (4), `SMOKE_BALL` (2), `RARE_CANDY` (2). Every
other item resolves. Whether a canonical item is *offered* is still the item
pool's call (`data/items.ts`), the same as today.

## 5. Gym coverage against GYMRUN's eight types

The eight gyms are Rock, Water, Electric, Grass, Fire, Psychic, Ghost, Dragon
(`data/gyms.ts`). Leaders of each type in the imported set, counting one per
game (rematches multiply these):

| type | leaders (game) |
|---|---|
| Rock | Brock (RBY, Y, GS, C, FRLG, HGSS), Roxanne (RS, E), Roark (Pt) |
| Water | Misty (RBY, Y, GS, C, FRLG, HGSS), Wallace (RS), Juan (E), Crasher Wake (Pt) |
| Electric | Lt. Surge (RBY, Y, GS, C, FRLG, HGSS), Wattson (RS, E), Volkner (Pt) |
| Grass | Erika (RBY, Y, GS, C, FRLG, HGSS), Gardenia (Pt) |
| Fire | Blaine (RBY, Y, GS, C, FRLG, HGSS), Flannery (RS, E) |
| Psychic | Sabrina (RBY, Y, GS, C, FRLG, HGSS), Tate & Liza (RS, E) |
| Ghost | Morty (GS, C, HGSS), Fantina (Pt) |
| Dragon | Clair (GS, C, HGSS) |

Rock through Psychic are deep. **Ghost and Dragon are thin** from Gen 1 to 4
alone: four Morty or Fantina rosters and three Clair rosters, plus rematches.
Two things widen them:

1. The gym-candidate rule in the plan admits an Elite Four or champion roster
   when *every* member carries the gym's type. That brings in Phoebe (Dusclops,
   Banette, Sableye, Banette, Dusclops: all Ghost) and Drake (Shelgon, Altaria,
   Flygon, Salamence, Kingdra: all Dragon) from RS, Emerald and FRLG, and
   Clair's HGSS rematch. Agatha and Lance do not qualify (Golbat, Arbok,
   Gyarados, Aerodactyl, Charizard) and stay what they are.
2. The Gen 5 to 9 curation pass is prioritised on Ghost and Dragon: Shauntal,
   Allister, Ryme, Drayden, Iris, Drasna, Raihan, Hassel, and Agatha's and
   Phoebe's later rosters. Every one of those names has a sprite (section 2).

The count of playable gym candidates per type **per segment** is measured at
checkpoint 4, once the fit rule exists to measure it with. A type with fewer
than three candidates at any segment gets curated rows before the stage
closes.

## 6. Levels against GYMRUN's curve

GYMRUN's player curve is 15, 20, 26, 32, 38, 44, 50, 58 by segment, and a gym
draws at `playerLevel + levelOffset.gym` with `max` at 0 (`data/scaling.ts`).
The games' first gyms sit at ace level 12 to 15 (Brock 14, Falkner 13,
Roxanne 15, Roark 14) and their eighth at 40 to 50 (Giovanni 50, Clair 40,
Juan 46, Volkner 50); the Elite Four run 42 to 62 and champions 50 to 78; the
rematch rosters reach 85. So the canonical ladder already overlaps every
segment's window, and the fit rule (shift the party by one constant so the ace
lands in the window, keep the spread) is a small correction rather than a
rewrite. A Gen 1 Brock at segment 0 is Geodude 12, Onix 14 against a level 15
party, which is the fight the games shipped.

Route trainers span level 2 to 88 and are the bulk of the library (4,839),
so every trainer node at every segment has hundreds of candidates whose
canonical levels already fit.

## 7. The encoding, in one paragraph

One `EncounterRecord` per fight
([`../../src/data/encounters/types.ts`](../../src/data/encounters/types.ts)):
id, game, generation, trainer (name, class, verified sprite id), role, place,
gym type where it is a gym, the party in canonical order with the ace last,
and a citation: the row carries the label it was read from, and the game's
file carries the repository, paths and pinned revision once as its
`EncounterSource`. One generated table per game
([`../../src/data/encounters/`](../../src/data/encounters/), checkpoint 2),
so a curation fix moves one file and `contentHash` moves honestly;
[`index.ts`](../../src/data/encounters/index.ts) is the sum in id order.
The nine tables are 1.7 MB of source; what that costs the bundle is measured
when `core/` first imports them, with a compact party encoding as the
fallback. A query layer filters on structural inputs only (segment, node
kind, gym type), never on anything the player did, and a node spends exactly
one draw under its own new key (`encounterKey(nodeId)`) to pick from the
candidate list. The design is in the stage plan and will be recorded in
`generation.md` when it is built.

## 8. Decisions this report puts to the author

None of these block checkpoint 2; each is a default the importer has taken
that a one-line edit reverses.

1. **Rematch rosters are separate encounters** (`emerald/roxanne-5`). They are
   the only canonical rosters at levels 40 to 85 for most leaders, and they
   are what makes a Gen 3 Roxanne a segment 5 Rock gym.
2. **Gen 2 Koga is Elite Four, not a Poison gym leader.** His Gen 1 and FRLG
   rosters are gym fights. The class in each game decides.
3. **Battle Frontier brains are `boss`**, so Anabel, Brandon, Palmer and the
   rest can turn up as trainer nodes with their names and sprites. They are
   not gym candidates.
4. **Out-of-pool set moves are rolled, not widened.** The alternative is to
   admit `growl`, `leer` and the Past moves into the pools, which is a
   `gen-pools.ts` change with its own balance consequences and is not this
   stage's call.
5. **Place is the region where the source says no more.** Gen 1 has place
   comments on every row (`Route 3`, `Mt. Moon B2F`, `Viridian Gym`);
   Platinum's filenames carry the place for rivals and bosses; every named
   boss has a table entry (`Pewter City Gym`, `Indigo Plateau`, `Battle
   Pyramid`). A Gen 2 or 3 route trainer reads `Johto` or `Hoenn`. Deriving
   their routes from the map scripts is possible and is not in this stage.

## 9. What was not found

- HGSS's trainer table is not where the Platinum one is; it is one JSON at
  `files/poketool/trainer/trainers.json`. Found by sparse-cloning the
  repository, since the GitHub contents API is not reachable from here.
- No decompilation exists for Gen 5 onward, and **Bulbapedia cannot be read
  from here**: its raw wikitext endpoint and its rendered pages both answer
  with a Cloudflare browser challenge (HTTP 403) to curl and to the fetch
  tool alike, so nothing on it can be parsed or pinned. Checkpoint 3 reads
  pokemondb.net instead, whose robots policy permits it (crawl delay 2 s,
  honoured): one roster page per game, with every gym leader, kahuna, trial
  captain, Elite Four member, champion, rival and villain the page lists,
  rematches included, as species and levels. No set moves and no items,
  which is the shape Gen 1 has. Each table cites the page, and each row the
  section id and head it was read from; the pin is the fetch date plus the
  counts the data test holds, since a page has no revision.

  | game | page | encounters |
  |---|---|---|
  | Black and White | `black-white/gymleaders-elitefour` | 23 |
  | Black 2 and White 2 | `black-white-2/gymleaders-elitefour` | 20 |
  | X and Y | `x-y/gymleaders-elitefour` | 13 |
  | Omega Ruby and Alpha Sapphire | `omega-ruby-alpha-sapphire/gymleaders-elitefour` | 18 |
  | Sun and Moon | `sun-moon/kahunas-elitefour` | 23 |
  | Ultra Sun and Ultra Moon | `ultra-sun-ultra-moon/kahunas-elitefour` | 31 |
  | Let's Go, Pikachu! and Let's Go, Eevee! | `lets-go-pikachu-eevee/gymleaders-elitefour` | 31 |
  | Sword and Shield | `sword-shield/gymleaders` | 20 |
  | Brilliant Diamond and Shining Pearl | `brilliant-diamond-shining-pearl/gymleaders-elitefour` | 38 |
  | Scarlet and Violet | `scarlet-violet/gymleaders-elitefour` | 36 |

  253 encounters, bringing the library to **5,627**. Kahunas and trial
  captains are read as gym leaders of their stated type, since a grand trial
  is Alola's gym. The Sword and Shield page has no Champion Cup, so Leon,
  Hop and Marnie are not in it; **closed at checkpoint 5** from Serebii's
  Champion Cup page (`swordshield/championcup.shtml`, fetched 2026-10-05,
  which this container can read): Marnie, Hop's three starter variants,
  Bede, the finals rematches of Nessa, Bea, Allister and Raihan, and Leon's
  three rosters, twelve records with levels and no set moves, appended to
  the Sword and Shield table, which now cites both pages. A regional form
  on that page is in the image file name (`078-g.png` is Galarian Rapidash)
  rather than the alt text; Bea and Allister share one heading and are told
  apart by the type most of the table's members carry. The library is
  **5,639**.

  **The Gen 5 to 9 rivals, checkpoint 8.** pokemondb's leader pages carry no
  rival fight. Serebii keeps one page per rival character for most games,
  and every one of them is the same shape across four template eras: one
  `table.trainer` per fight and per starter variant, the trainer's class and
  name in a cell, each member linked by name, `Level N` cells, an `Attacks:`
  cell per member with `attackdex` links, and a `Hold Item:` cell per
  member. `scripts/import-encounters/parse-serebii-rivals.ts` reads them,
  pinned in `sources.json` beside the Champion Cup:

  | game | pages | records |
  |---|---|---|
  | Black and White | `blackwhite/cheren.shtml`, `blackwhite/bianca.shtml` | 42 |
  | Black 2 and White 2 | `black2white2/rival.shtml` (Hugh) | 30 |
  | Omega Ruby and Alpha Sapphire | `omegarubyalphasapphire/rival.shtml` (Brendan and May, one record each per fight), `omegarubyalphasapphire/wally.shtml` | 34 |
  | Sun and Moon | `sunmoon/hau.shtml`, `sunmoon/gladion.shtml` | 37 |
  | Ultra Sun and Ultra Moon | `ultrasunultramoon/hau.shtml`, `ultrasunultramoon/gladion.shtml` | 37 |
  | Let's Go, Pikachu! and Let's Go, Eevee! | `letsgopikachueevee/rival.shtml` (Trace; `Rival` as the game prints the class, `Champion` for the title fights) | 18 |
  | Sword and Shield | `swordshield/hop.shtml`, `swordshield/marnie.shtml`, `swordshield/bede.shtml` (the two later gym fights as `Leader`, Dark and Fairy) | 60 |
  | Brilliant Diamond and Shining Pearl | `brilliantdiamondshiningpearl/barry.shtml` | 24 |

  282 encounters with set moves throughout and items where the game gave
  them, bringing the library to **5,921**. Every rival resolves to a sprite.
  Six more species fall outside the pool (Type: Null, Silvally, Zacian,
  Zamazenta, Galarian Ponyta and Yamask), pinned with the rest. **X and Y and
  Scarlet and Violet have no such page** under any slug tried (`rival`,
  `rivals`, the characters' own names, `rivalbattles`, `characters`), so
  Calem, Serena, Shauna, Tierno, Trevor, Nemona, Arven and Penny stay a
  gap. Serebii lists Blastoise on Gladion's Ultra title-defence team; the
  row cites what the page says. Twenty species on these rosters fall outside the pool: the regional
  formes the pool excludes (Alolan Ninetales, Galarian Weezing, Lycanroc
  Midnight and the like) and Zekrom and Reshiram on N's team; the fit rule
  drops them, and the data test pins the set. Every named trainer resolves
  to a sprite except Game Freak's Morimoto, who has none on the CDN.

  What this changes in section 5: Ghost gains Allister (SwSh), Ryme (SV),
  Fantina's BDSP rosters, and Acerola, Phoebe and Shauntal rematches on the
  Elite Four rule; Dragon gains Drayden and Iris (BW, B2W2), Raihan (SwSh),
  and Drasna, Drake and Hassel on the Elite Four rule.
