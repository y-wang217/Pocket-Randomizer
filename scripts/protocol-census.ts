/**
 * What the engine actually says, counted. **The battle animation run, Branch 2.**
 *
 *   npx vite-node scripts/protocol-census.ts [--seeds 50] [--prefix CENSUS]
 *
 * `core/battle/flags.ts` reads ten truths off the protocol. The sim emits far
 * more — stat stages, weather, ability triggers, volatiles, `|cant|`, type
 * changes, recoil, drain, multi-hit, protect, fail — and none of it reaches the
 * player. Branch 2 widens that vocabulary, and this is the evidence it is
 * allowed to widen it *from*.
 *
 * `CLAUDE.md`: "Blacklist and override table entries start near empty, are
 * populated only from simulator evidence. 'It feels strong' is not a reason."
 * The same discipline applies to a vocabulary. **A word for an event no fight
 * produces is dead copy** — it costs a tooltip, a test, a translation and a
 * reader's attention, and it is never seen. So this counts first, and the
 * vocabulary is cut to what fires.
 *
 * ## What it does not do
 *
 * It asserts nothing and it gates nothing. It prints a table. The judgement
 * about which classes earn a word is made by reading it, in the branch report,
 * where it can be argued with.
 *
 * ## Four things that would quietly bias the count
 *
 * 1. **Read `protocolFor` at the end; never `subscribe`.** The opening protocol
 *    is drained before any subscriber can attach (`driver.ts`), so a subscriber
 *    silently misses the first lines of every battle — including every
 *    `|switch|` that opens one.
 * 2. **Do not pass `opponent`.** Pinning one policy in every fight is what the
 *    balance sim does on purpose; here it would measure a bot the player never
 *    meets. Left out, `playRun` uses `tieredOpponentFor`, which is what the
 *    real game does and therefore what a real player sees.
 * 3. **Sub-key the generic tags.** `-start`, `-end`, `-activate`, `-fail` and
 *    `-immune` all carry the effect in `parts[3]`, and `-boost`/`-unboost`
 *    carry the stat there. One `-start` count says nothing about whether it was
 *    confusion, a substitute or a type change, and those want different words.
 * 4. **`p1` alone.** The format sets `reportExactHP`, so both channels carry
 *    identical HP and non-HP lines are duplicated across them. Counting both
 *    would double everything.
 *
 * One caveat the report must carry: battles that hit `TURN_LIMIT` are cut off,
 * so weather and other residual end-of-turn lines are **under**-counted. A
 * class that looks marginal on this evidence is marginal or better, never
 * worse.
 */
import { stripNondeterministic, type BattleSession } from '../src/core/battle/driver';
import { playRun, scriptedRunPolicy } from '../src/core/run';
import { greedyAiPolicy } from '../src/core/battle/ai';

const args = process.argv.slice(2);
const seeds = Number(args[args.indexOf('--seeds') + 1] || 50);
const prefix = args.includes('--prefix') ? (args[args.indexOf('--prefix') + 1] ?? 'CENSUS') : 'CENSUS';

/**
 * Tags whose bare name is not enough to choose a word for.
 *
 * Everything else is counted by tag alone: `|-crit|` is `|-crit|`.
 */
const SUB_KEYED = new Set(['-start', '-end', '-activate', '-fail', '-immune', '-boost', '-unboost', '-sethp', '-singleturn']);

/** Lines that already have a flag, or carry no event at all. Counted, then reported apart. */
const ALREADY_READ = new Set(['-supereffective', '-resisted', '-immune', '-crit', '-miss', '-status', '-enditem']);
const STRUCTURAL = new Set(['t:', 'turn', 'upkeep', 'move', 'switch', 'drag', 'faint', 'win', 'tie', 'player', 'teamsize', 'gametype', 'gen', 'tier', 'rule', 'start', 'split', 'request', 'done', '', 'j', 'l', 'c', 'raw', 'debug', 'choice', 'inactive', 'teampreview', 'clearpoke', 'poke', 'seed', 'message', '-damage', '-heal', '-hitcount']);

interface Row {
  key: string;
  lines: number;
  battles: number;
}

async function census(): Promise<void> {
  const lineCounts = new Map<string, number>();
  const battleCounts = new Map<string, number>();
  /** Every key each battle carried, so a class can be counted as a union. */
  const perBattleKeys = new Map<number, Set<string>>();
  let battles = 0;
  let runs = 0;
  const field = createFieldCensus();

  for (let index = 0; index < seeds; index += 1) {
    const sessions: BattleSession[] = [];
    try {
      await playRun(`${prefix}-${index}`, scriptedRunPolicy(greedyAiPolicy), undefined, {
        // No `opponent`: let the run pick its tiered bot, as the game does.
        onBattle: (session) => sessions.push(session),
      });
    } catch (error) {
      // A run that ends on a thrown rule is still evidence for the battles it
      // played, so the sessions collected so far are counted rather than
      // dropped. Reported at the end so a high count is not mistaken for noise.
      process.stderr.write(`run ${prefix}-${index} ended early: ${String(error)}\n`);
    }
    runs += 1;

    for (const session of sessions) {
      battles += 1;
      const seenHere = new Set<string>();
      field.openBattle();
      for (const line of stripNondeterministic([...session.protocolFor('p1')])) {
        const parts = line.split('|');
        const tag = parts[1] ?? '';
        field.read(line, parts, tag);
        if (STRUCTURAL.has(tag)) continue;
        const key = SUB_KEYED.has(tag) && parts[3] ? `${tag}|${parts[3]}` : tag;
        lineCounts.set(key, (lineCounts.get(key) ?? 0) + 1);
        seenHere.add(key);
      }
      for (const key of seenHere) battleCounts.set(key, (battleCounts.get(key) ?? 0) + 1);
      perBattleKeys.set(battles, seenHere);
    }
    // Or `seeds` runs hold every Battle object alive at once.
    sessions.length = 0;
  }

  const rows: Row[] = [...lineCounts.entries()]
    .map(([key, lines]) => ({ key, lines, battles: battleCounts.get(key) ?? 0 }))
    .sort((a, b) => b.battles - a.battles || b.lines - a.lines);

  const pct = (n: number): string => `${((n / Math.max(1, battles)) * 100).toFixed(1)}%`;
  const width = Math.max(28, ...rows.map((row) => row.key.length + 2));

  process.stdout.write(`\n${runs} runs, ${battles} battles, prefix ${prefix}\n\n`);
  process.stdout.write(`${'line'.padEnd(width)}${'lines'.padStart(8)}${'battles'.padStart(9)}${'% of battles'.padStart(14)}\n`);
  process.stdout.write(`${'-'.repeat(width + 31)}\n`);
  for (const row of rows) {
    const mark = ALREADY_READ.has(row.key.split('|')[0] ?? '') ? ' *' : '';
    process.stdout.write(`${(row.key + mark).padEnd(width)}${String(row.lines).padStart(8)}${String(row.battles).padStart(9)}${pct(row.battles).padStart(14)}\n`);
  }
  /*
   * And the same counted by **class**, which is the number the decision
   * actually turns on. Branch 3B animates one beat per class, and a battle
   * carrying four different stat drops is one battle that wants a "state
   * change" beat — so summing the per-line rows would badly overstate, and
   * reading the largest of them would badly understate. The union per battle is
   * the honest figure.
   */
  const CLASSES: ReadonlyArray<{ name: string; match: (key: string) => boolean }> = [
    { name: 'state change (stat stages)', match: (k) => k.startsWith('-boost') || k.startsWith('-unboost') || k.startsWith('-setboost') || k.startsWith('-clearboost') },
    { name: 'trait fired (ability/item)', match: (k) => k.startsWith('-ability') || k === '-item' || k.startsWith('-activate|ability') },
    { name: 'prevented (cant/fail/block)', match: (k) => k === 'cant' || k.startsWith('-fail') || k.startsWith('-block') },
    { name: 'volatile (start/end/activate)', match: (k) => k.startsWith('-start') || k.startsWith('-end') || (k.startsWith('-activate') && !k.startsWith('-activate|ability')) || k.startsWith('-singleturn') || k.startsWith('-singlemove') },
    { name: 'field (weather/terrain/side)', match: (k) => k.startsWith('-weather') || k.startsWith('-field') || k.startsWith('-side') },
    { name: 'identity (typechange/forme)', match: (k) => k.includes('typechange') || k.startsWith('-formechange') || k.startsWith('-transform') },
    { name: 'damage shape (recoil/drain)', match: (k) => k.startsWith('-recoil') || k.startsWith('-drain') },
  ];

  process.stdout.write(`\n\nBy class, counted as the union per battle\n`);
  process.stdout.write(`${'class'.padEnd(34)}${'battles'.padStart(9)}${'% of battles'.padStart(14)}\n`);
  process.stdout.write(`${'-'.repeat(57)}\n`);
  for (const klass of CLASSES) {
    const count = [...perBattleKeys.values()].filter((keys) => [...keys].some((key) => klass.match(key))).length;
    process.stdout.write(`${klass.name.padEnd(34)}${String(count).padStart(9)}${pct(count).padStart(14)}\n`);
  }

  field.report(battles, pct);

  process.stdout.write(`\n* already has a flag in core/battle/flags.ts\n`);
  process.stdout.write(`Battles cut off at TURN_LIMIT under-count residual lines; a marginal class is marginal or better.\n`);
}

/*
 * The Stage 4.11 half: the field and the triggers, sub-keyed. **Tier 0 of
 * [`docs/spec/gymrun-stage4.11-weather-terrain-and-trigger-visuals.md`].**
 *
 * The table above counts `-weather` as one row and `-activate` by effect. The
 * stage's plan needs four things the first census did not ask:
 *
 * 1. **Which weather, and set by what.** `|-weather|RainDance|[from] ability:
 *    Drizzle|[of] p2a: X` is keyed here as `RainDance <- ability:Drizzle`. A
 *    line with no `[from]` is a move. The plan's claim that every weather in
 *    this game comes from an ability is a claim, until this counts it.
 * 2. **Before or after `|turn|1`.** The battle screen shows the opening batch
 *    with `animate=false`, so a field effect or an ability that lands before
 *    the first turn line is one the player is never shown. This counts how
 *    many do.
 * 3. **The end.** `-weather|none`, `-fieldend`, and the `[upkeep]` repeats,
 *    which the flag reader skips on purpose. A state channel carries the end
 *    for free; this says how often there is one to carry.
 * 4. **Abilities and items by name**, and `-activate` by effect, so the
 *    trigger tier is built to what fires rather than to what seems likely.
 *
 * Counted per battle as a union, like the class table, because one sandstorm
 * writes twenty lines and is one fact.
 */
function createFieldCensus(): {
  openBattle(): void;
  read(line: string, parts: string[], tag: string): void;
  report(battles: number, pct: (n: number) => string): void;
} {
  const tables = new Map<string, Map<string, number>>();
  let seen = new Set<string>();
  let beforeTurnOne = true;

  const note = (table: string, key: string): void => {
    const id = `${table}\u0000${key}`;
    if (seen.has(id)) return;
    seen.add(id);
    const rows = tables.get(table) ?? new Map<string, number>();
    rows.set(key, (rows.get(key) ?? 0) + 1);
    tables.set(table, rows);
  };

  const FROM = /\|\[from\] ([^|]+)/;
  const source = (line: string): string => {
    const from = FROM.exec(line)?.[1];
    return from ? from.replace(/^ability: /, 'ability:').replace(/^move: /, 'move:') : 'move';
  };
  const when = (): string => (beforeTurnOne ? 'before turn 1' : 'turn 1 or later');

  return {
    openBattle() {
      seen = new Set<string>();
      beforeTurnOne = true;
    },
    read(line, parts, tag) {
      if (tag === 'turn') beforeTurnOne = false;
      const name = parts[2] ?? '';
      switch (tag) {
        case '-weather': {
          if (/\|\[upkeep\]/.test(line)) {
            note('weather upkeep lines', name);
            break;
          }
          if (name === 'none') {
            note('field ends', 'weather none');
            break;
          }
          note('weather starts, by kind', name);
          note('weather starts, by source', `${name} <- ${source(line)}`);
          note('weather starts, by timing', when());
          note('field starts, by timing', when());
          note('weather starts, as a union', /^(DesolateLand|PrimordialSea|DeltaStream)$/.test(name) ? 'primal' : 'standard');
          break;
        }
        case '-fieldstart': {
          const effect = name.replace(/^move: /, '');
          note('terrain and room starts, by kind', effect);
          note('terrain and room starts, by source', `${effect} <- ${source(line)}`);
          if (/terrain/i.test(effect)) note('field starts, by timing', when());
          break;
        }
        case '-fieldend':
          note('field ends', `fieldend ${name.replace(/^move: /, '')}`);
          break;
        case '-sidestart':
          note('side conditions', (parts[3] ?? '').replace(/^move: /, ''));
          break;
        case '-ability': {
          const ability = parts[3] ?? '';
          note('ability lines, by ability', ability);
          note('ability lines, by timing', when());
          break;
        }
        case '-item':
          note('item lines (held, revealed)', parts[3] ?? '');
          break;
        case '-enditem':
          note('enditem lines, by item', parts[3] ?? '');
          break;
        case '-activate': {
          const effect = parts[3] ?? '';
          note('activate lines, by effect', effect);
          // The unions the trigger tier is cut on: an ability announcing
          // itself through `-activate` writes no `-ability` line at all.
          if (effect.startsWith('ability:')) note('activate lines, as a union', 'ability:*');
          else if (effect.startsWith('move:')) note('activate lines, as a union', 'move:*');
          else note('activate lines, as a union', 'other');
          break;
        }
        default:
          break;
      }
    },
    report(battles, pct) {
      process.stdout.write(`\n\nStage 4.11: the field and the triggers, per battle as a union\n`);
      for (const [table, rows] of tables) {
        const sorted = [...rows.entries()].sort((a, b) => b[1] - a[1]);
        const width = Math.max(30, ...sorted.map(([key]) => key.length + 2));
        process.stdout.write(`\n${table}\n${'-'.repeat(width + 23)}\n`);
        for (const [key, count] of sorted) {
          process.stdout.write(`${key.padEnd(width)}${String(count).padStart(9)}${pct(count).padStart(14)}\n`);
        }
      }
      process.stdout.write(`\n(${battles} battles)\n`);
    },
  };
}

await census();
