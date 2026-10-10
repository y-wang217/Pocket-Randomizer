/**
 * Text on every coloured surface of the card battle sandbox passes 4.5:1
 * (`docs/spec/gymrun-patch-card-battle-grace-friendly-fire.md` A5). Read off
 * the stylesheet's own tokens, so a token edited later is held to it too.
 * Each pair is a text colour and the surface it is drawn on somewhere in
 * `sandbox.css`; a translucent colour is composited over its surface first.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../src/ui/cardbattle/sandbox.css', import.meta.url), 'utf8');

type Rgba = [number, number, number, number];

function token(name: string): Rgba {
  const match = new RegExp(`--cb-${name}:\\s*([^;]+);`).exec(css);
  if (!match) throw new Error(`no token --cb-${name}`);
  const value = match[1]!.trim();
  const ref = /^var\(--cb-([a-z-]+)\)$/.exec(value);
  if (ref) return token(ref[1]!);
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1]!.slice(i, i + 2), 16)).concat(1) as Rgba;
  const rgba = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(value);
  if (rgba) return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3]), Number(rgba[4])];
  throw new Error(`cannot read --cb-${name}: ${value}`);
}

function luminance([r, g, b]: Rgba): number {
  const lin = (c: number): number => (c / 255 <= 0.03928 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(text: string, surface: string): number {
  const back = token(surface);
  const fore = token(text);
  const a = fore[3];
  const over: Rgba = [0, 1, 2].map((i) => fore[i]! * a + back[i]! * (1 - a)).concat(1) as Rgba;
  const [hi, lo] = [luminance(over), luminance(back)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** [text, surface, where]. */
const PAIRS: [string, string, string][] = [
  ['ink', 'surface', 'every panel, card and button'],
  ['ink', 'bg', 'the top bar'],
  ['dim', 'surface', 'stat labels, the seed'],
  ['dim', 'bg', 'the pile counts'],
  ['teal-text', 'bg', 'the note line, End Turn'],
  ['teal-text', 'surface', "the Commander's name and card letter"],
  ['blue-text', 'surface', "a card's cost, the Gunner's name and card letter"],
  ['purple-text', 'surface', "the Sword dasher's name and card letter"],
  ['grey-text', 'surface', 'a Neutral'],
  ['red-text', 'surface', 'an unplayable reason'],
  ['surface', 'teal-text', "the Commander's attack chips"],
  ['surface', 'blue-text', "the Gunner's attack chips"],
  ['surface', 'purple-text', "the Sword dasher's attack chips"],
  ['surface', 'grey-text', 'a Neutral attack chip'],
  ['surface', 'red-text', 'telegraph chips, the Fast badge, an HP float'],
  ['surface', 'red-deep', 'a Slash telegraph chip'],
  ['surface', 'ink', 'enemy panels, HP chips, the banner'],
  ['surface', 'warn', 'the friendly fire damage chip'],
  ['warn', 'surface', "a Blast centre's ally letters"],
  ['ink', 'amber', 'the play order chips, a pressed button'],
];

describe('the sandbox palette', () => {
  it.each(PAIRS)('%s on %s passes 4.5:1 (%s)', (text, surface) => {
    expect(contrast(text, surface)).toBeGreaterThanOrEqual(4.5);
  });
});
