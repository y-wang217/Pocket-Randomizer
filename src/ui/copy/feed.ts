/**
 * The decision feed's lines. **Stage 5.0/1**, bible R11's carve-out (D55).
 *
 * **Under `ui/`, not `data/`**, for the reason `copy/summary.ts` gives: a word
 * changed here must not move `contentHash`.
 *
 * Each line is a label and what was chosen, in the words the rest of the game
 * already uses for it: the node kind is the glyph family's own label, a
 * reward is `describeReward`'s name, an event choice is the button the player
 * pressed. Inputs only. No line says how a choice went, and none rates one.
 */
import type { Tier } from '../../core/types';
import { GLYPH_LABELS } from '../../data/glyphLabels';
import type { NodeKind } from '../../data/tuning';

const TIER_WORD: Readonly<Record<Tier, string>> = { normal: 'Normal', hard: 'Hard', elite: 'Elite' };

const join = (parts: readonly string[]): string => parts.join(', ');

export const FEED_COPY = {
  /** The Run Info screen's and the sidebar's heading. */
  heading: 'Run progress',
  /** Before the first decision. */
  empty: 'No decisions yet.',
  starter: (species: string): string => `Starter · ${species}`,
  locale: (name: string): string => `Region · ${name}`,
  node: (kind: NodeKind, tier: Tier | null): string =>
    `${GLYPH_LABELS[`node-${kind}`] ?? kind}${tier ? ` · ${TIER_WORD[tier]}` : ''}`,
  move: (name: string): string => `Move · ${name}`,
  switchTo: (name: string): string => `Switch · ${name}`,
  reward: (name: string): string => `Reward · ${name}`,
  /** The berry a "pick a berry" card was answered with. The berry gym reward patch. */
  berry: (name: string): string => `Berry · ${name}`,
  shop: (bought: readonly string[]): string => (bought.length ? `Bought · ${join(bought)}` : 'Shop · left empty-handed'),
  event: (label: string): string => `Event · ${label}`,
  caught: (species: string): string => `Caught · ${species}`,
  declined: (species: string): string => `Let go · ${species}`,
  caughtReleasing: (species: string, released: string): string => `Caught · ${species}, released ${released}`,
  held: (item: string, member: string): string => `${item} to ${member}`,
  unheld: (member: string): string => `${member} holds nothing`,
  taught: (move: string, member: string): string => `${move} taught to ${member}`,
  discarded: (name: string): string => `${name} discarded`,
  items: (parts: readonly string[]): string => (parts.length ? `Items · ${join(parts)}` : 'Items · unchanged'),
  lead: (name: string): string => `Lead · ${name}`,
  released: (name: string): string => `Released · ${name}`,
  /** `to` is the 0-based slot, printed 1-based. */
  reordered: (name: string, to: number): string => `Order · ${name} to slot ${to + 1}`,
  evolved: (from: string, to: string): string => `Evolved · ${from} into ${to}`,
  /** A group heading in the feed: the gym a segment ends at. */
  segment: (index: number, leader: string): string => `Gym ${index + 1} · ${leader}`,
} as const;
