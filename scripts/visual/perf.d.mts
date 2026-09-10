import type { Browser } from 'playwright';

export interface PerfStats {
  mean: number | null;
  p95: number | null;
  max: number | null;
}
export function traceMapScroll(
  url: string,
  browser: Browser,
  options?: { locale?: string | null; throttle?: number; seed?: string },
): Promise<{ locale: string | null; throttle: number; frames: number; frameWorkMs: PerfStats; paintMs: PerfStats; frameIntervalMs: PerfStats; paintEvents: number }>;
