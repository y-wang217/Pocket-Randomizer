import type { Browser } from 'playwright';

export interface ContrastReading {
  selector: string;
  text: number[];
  background: number[];
  backgroundShare: number;
  ratio: number;
}
export const STYLES: Record<string, [string, string][]>;
export function ratio(a: number[], b: number[]): number;
export function measureContrast(
  url: string,
  browser: Browser,
  options?: { seed?: string; locale?: string | null },
): Promise<Record<string, Record<string, ContrastReading>>>;
