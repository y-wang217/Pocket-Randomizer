import type { Page } from 'playwright';

export function stampCollisions(page: Page): Promise<{
  screen: string | undefined;
  results: { stamp: string | undefined; box: number[]; hits: string[] }[];
}>;
