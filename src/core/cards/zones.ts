/**
 * The board's geometry: zones, reach, patterns and movement. Pure functions of
 * a position and the rule table; nothing here knows about cards.
 */
import { RULES } from '../../cardData/rules';
import type { Col, Lane, Pos, Side, Zone } from './defs';

export function samePos(a: Pos | null | undefined, b: Pos | null | undefined): boolean {
  return !!a && !!b && a.lane === b.lane && a.col === b.col;
}

export function onBoard(lane: number, col: number): boolean {
  return Number.isInteger(lane) && Number.isInteger(col) && lane >= 1 && lane <= RULES.board.lanes && col >= 1 && col <= RULES.board.cols;
}

/** A tile, or `null` off the board. */
export function tile(lane: number, col: number): Pos | null {
  return onBoard(lane, col) ? { lane: lane as Lane, col: col as Col } : null;
}

/** Every tile, lane by lane, column by column. */
export function allTiles(): Pos[] {
  const out: Pos[] = [];
  for (let lane = 1; lane <= RULES.board.lanes; lane++) {
    for (let col = 1; col <= RULES.board.cols; col++) out.push(tile(lane, col)!);
  }
  return out;
}

export function zoneOf(pos: Pos): Zone {
  for (const zone of ['playerBackline', 'danger', 'enemyBackline'] as const) {
    if (RULES.zones[zone].includes(pos.col)) return zone;
  }
  // Unreachable for a tile on the board: the three zones cover every column.
  return 'danger';
}

export function inReach(side: Side, pos: Pos): boolean {
  const reach = RULES.reach[side];
  return pos.col >= reach.min && pos.col <= reach.max;
}

export function inDanger(pos: Pos): boolean {
  return zoneOf(pos) === 'danger';
}

function orthogonal(pos: Pos): Pos[] {
  return [tile(pos.lane - 1, pos.col), tile(pos.lane + 1, pos.col), tile(pos.lane, pos.col - 1), tile(pos.lane, pos.col + 1)].filter(
    (p): p is Pos => p !== null,
  );
}

/** Slash: the tiles of the next column toward the opposing side, this lane and its neighbours. */
export function slashTiles(side: Side, from: Pos): Pos[] {
  const out: Pos[] = [];
  for (let step = 1; step <= RULES.patterns.slashCols; step++) {
    const col = from.col + RULES.forward[side] * step;
    for (const lane of [from.lane - 1, from.lane, from.lane + 1]) {
      const p = tile(lane, col);
      if (p) out.push(p);
    }
  }
  return out;
}

/** The tiles a Blast may be centred on without Target: every lane of the next columns. */
export function blastCentres(side: Side, from: Pos): Pos[] {
  const out: Pos[] = [];
  for (let step = 1; step <= RULES.patterns.blastCols; step++) {
    const col = from.col + RULES.forward[side] * step;
    for (let lane = 1; lane <= RULES.board.lanes; lane++) {
      const p = tile(lane, col);
      if (p) out.push(p);
    }
  }
  return out;
}

/** A Blast's footprint: the centre and its orthogonal neighbours, clipped at the edge. */
export function blastTiles(centre: Pos): Pos[] {
  return [centre, ...orthogonal(centre)];
}

/** Every tile of a lane, ordered from `side`'s own edge outward. */
export function laneFromSide(side: Side, lane: Lane): Pos[] {
  const tiles = allTiles().filter((p) => p.lane === lane);
  return side === 'player' ? tiles : tiles.reverse();
}

/**
 * Where a Move of `n` can end: tiles 1 to `n` orthogonal steps away, each
 * step into an empty tile inside the side's reach. A unit never moves
 * through another (R15).
 */
export function moveDestinations(side: Side, from: Pos, n: number, occupied: readonly Pos[]): Pos[] {
  const blocked = (p: Pos): boolean => occupied.some((o) => samePos(o, p));
  const seen: Pos[] = [from];
  let frontier: Pos[] = [from];
  const out: Pos[] = [];
  for (let step = 0; step < n; step++) {
    const next: Pos[] = [];
    for (const p of frontier) {
      for (const q of orthogonal(p)) {
        if (!inReach(side, q) || blocked(q) || seen.some((s) => samePos(s, q))) continue;
        seen.push(q);
        next.push(q);
        out.push(q);
      }
    }
    frontier = next;
  }
  return out;
}
