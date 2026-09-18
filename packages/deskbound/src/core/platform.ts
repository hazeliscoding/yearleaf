/**
 * Platform seam for keyboard hints: callers write the logical {@link MOD}
 * and the components print the cap the host keyboard actually has — `⌘` on
 * macOS, `Ctrl` on the Windows and Linux builds.
 *
 * Resolution is synchronous on purpose. These caps render inside OnPush
 * templates, so Tauri's `os` plugin — which answers a promise later — would
 * paint `⌘` first and correct itself a frame after the user has read it.
 * The webview knows its own platform without asking the shell.
 */

import { InjectionToken } from '@angular/core';

/** Logical primary modifier; resolved per platform when a hint is rendered. */
export const MOD = 'Mod';

/** The cap macOS prints for {@link MOD}. */
const MAC_MOD = '⌘';

/** Platform strings that mean "this keyboard has a Command key". */
const APPLE = /mac|iphone|ipad|ipod/i;

/**
 * Keycap {@link MOD} wears on `platform`, as reported by `navigator`.
 * Anything that is not an Apple platform gets `Ctrl`, including the empty
 * string a webview may hand back.
 */
export function modifierCap(platform: string): string {
  return APPLE.test(platform) ? MAC_MOD : 'Ctrl';
}

/** Replaces the logical modifier in a keycap sequence with `mod`. */
export function resolveCaps(keys: readonly string[], mod: string): readonly string[] {
  return keys.map((key) => (key === MOD ? mod : key));
}

/**
 * Resolves a one-line hint written as `+`-separated logical caps, e.g.
 * `"Mod+Z"`. macOS sets its glyphs tight against the key (`⌘Z`); a
 * spelled-out modifier keeps the separator, because `CtrlZ` reads as one
 * unfamiliar key rather than two familiar ones.
 */
export function resolveHint(hint: string, mod: string): string {
  return resolveCaps(hint.split('+'), mod).join(mod === MAC_MOD ? '' : '+');
}

/** The platform this webview is running on; `''` when it will not say. */
function hostPlatform(): string {
  const agent = navigator as Navigator & { userAgentData?: { platform?: string } };
  return agent.userAgentData?.platform ?? navigator.platform ?? '';
}

/**
 * Injection seam for the resolved modifier cap, per the architecture record:
 * platform facts are reached through an interface, never read inline. Tests
 * override it to render either keyboard without touching globals.
 */
export const DB_MODIFIER_CAP = new InjectionToken<string>('DB_MODIFIER_CAP', {
  providedIn: 'root',
  factory: () => modifierCap(hostPlatform()),
});
