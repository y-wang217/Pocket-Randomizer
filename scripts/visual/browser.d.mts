/** Types for the shared browser driver, so the vitest files can import it. */
import type { Browser, BrowserContext, Page, LaunchOptions } from 'playwright';

export const PHONE: { width: number; height: number };
export function serve(dir?: string): Promise<{ url: string; close: () => void }>;
export function launch(options?: LaunchOptions): Promise<Browser>;
export function visible(name: string): string;
export function openScreen(page: Page): Promise<string | null>;
export function stepOnce(page: Page): Promise<string | null>;
export function playUntil(
  page: Page,
  predicate: (screen: string, page: Page) => boolean | Promise<boolean>,
  maxSteps?: number,
): Promise<string>;
/** A fresh store with the tutorial skipped, as JSON. See browser.mjs. */
export const TUTORIAL_SKIPPED_SETTINGS: string;
/** Seed a context's storage so the coach marks do not show. `openApp` does this unless asked not to. */
export function skipTutorialIn(context: BrowserContext): Promise<void>;
export function openApp(
  browser: Browser,
  url: string,
  seed: string,
  viewport?: { width: number; height: number },
  contextOptions?: Record<string, unknown>,
): Promise<{ page: Page; context: BrowserContext; problems: string[] }>;
export interface GuardedMeasure {
  screenHeight: number;
  scrollHeight: number;
  decisionCount: number;
  decisionTop: number | null;
  decisionBottom: number | null;
}
export function measureGuardedScreens(
  url: string,
  browser: Browser,
  seed?: string,
): Promise<{ seed: string; viewport: { width: number; height: number }; map: GuardedMeasure; battle: GuardedMeasure; problems?: string[] }>;
