/**
 * Reads the Deskbound CSS custom properties into a numeric palette the
 * renderer can use, so PixiJS colors stay single-sourced from
 * `packages/deskbound/styles/tokens/*.css` in both themes.
 */

import type { StationeryColor } from '@infinite-desk/domain';

/** A color plus its alpha (for tokens authored as `rgba(...)`). */
export interface AlphaColor {
  /** 24-bit RGB. */
  readonly color: number;
  readonly alpha: number;
}

/** One stationery palette entry: fill, accessible ink, and soft tint. */
export interface StationeryTriple {
  readonly fill: number;
  readonly ink: number;
  readonly soft: number;
}

/** Numeric snapshot of the Deskbound tokens the scene renders with. */
export interface ThemeTokens {
  readonly surfaceCanvas: number;
  readonly surfacePaper: number;
  readonly surfaceRaised: number;
  readonly divider: number;
  readonly border: number;
  readonly inkPrimary: number;
  readonly inkSecondary: number;
  readonly inkMuted: number;
  readonly inkDisabled: number;
  readonly inkInverse: number;
  readonly accent: number;
  readonly accentSoft: number;
  readonly selection: number;
  readonly danger: number;
  readonly warning: number;
  readonly info: number;
  readonly gridLine: AlphaColor;
  readonly ruleLine: AlphaColor;
  /**
   * Base color for shadows the scene mixes its own alpha into. Dark themes
   * re-base this on black: the light paper ink is *lighter* than the dark
   * canvas, so a shadow drawn with it brightens the desk instead.
   */
  readonly shadowInk: number;
  readonly stationery: Readonly<Record<StationeryColor, StationeryTriple>>;
  /** Primary family names extracted from the font tokens. */
  readonly fontUI: string;
  readonly fontCalendar: string;
  readonly fontHand: string;
}

/** All stationery color names, matching the token files. */
const STATIONERY: readonly StationeryColor[] = [
  'yellow', 'coral', 'rose', 'red', 'orange', 'olive', 'green',
  'mint', 'teal', 'blue', 'indigo', 'violet', 'lavender',
];

/**
 * Parses a CSS color token value (`#rgb`, `#rrggbb`, `rgb()`, `rgba()`)
 * into RGB + alpha. Unknown syntax falls back to opaque black.
 */
export function parseCssColor(value: string): AlphaColor {
  const v = value.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    return { color: parseInt(h, 16), alpha: 1 };
  }
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(v);
  if (rgb) {
    return {
      color: (Number(rgb[1]) << 16) | (Number(rgb[2]) << 8) | Number(rgb[3]),
      alpha: rgb[4] === undefined ? 1 : Number(rgb[4]),
    };
  }
  return { color: 0x000000, alpha: 1 };
}

/** Linear blend of two 24-bit RGB colors: `t = 0` → a, `t = 1` → b. */
export function mixColors(a: number, b: number, t: number): number {
  const ch = (shift: number) => {
    const av = (a >> shift) & 0xff;
    const bv = (b >> shift) & 0xff;
    return Math.round(av + (bv - av) * t) << shift;
  };
  return ch(16) | ch(8) | ch(0);
}

/** First font family name from a font token value, unquoted. */
function primaryFamily(value: string, fallback: string): string {
  const first = value.split(',')[0]?.replace(/['"]/g, '').trim();
  return first || fallback;
}

/**
 * Snapshots the current theme from computed styles. Call again after the
 * `data-theme` attribute changes to pick up dark mode.
 */
export function readThemeTokens(element: Element = document.documentElement): ThemeTokens {
  const styles = getComputedStyle(element);
  const color = (name: string) => parseCssColor(styles.getPropertyValue(name)).color;
  const alphaColor = (name: string) => parseCssColor(styles.getPropertyValue(name));

  const stationery = {} as Record<StationeryColor, StationeryTriple>;
  for (const name of STATIONERY) {
    stationery[name] = {
      fill: color(`--stationery-${name}`),
      ink: color(`--stationery-${name}-ink`),
      soft: color(`--stationery-${name}-soft`),
    };
  }

  return {
    surfaceCanvas: color('--surface-canvas'),
    surfacePaper: color('--surface-paper'),
    surfaceRaised: color('--surface-raised'),
    divider: color('--divider'),
    border: color('--border'),
    inkPrimary: color('--ink-primary'),
    inkSecondary: color('--ink-secondary'),
    inkMuted: color('--ink-muted'),
    inkDisabled: color('--ink-disabled'),
    inkInverse: color('--ink-inverse'),
    accent: color('--accent'),
    accentSoft: color('--accent-soft'),
    selection: color('--selection'),
    danger: color('--danger'),
    warning: color('--warning'),
    info: color('--info'),
    gridLine: alphaColor('--grid-line'),
    ruleLine: alphaColor('--rule-line'),
    shadowInk: color('--shadow-ink'),
    stationery,
    fontUI: primaryFamily(styles.getPropertyValue('--font-ui'), 'sans-serif'),
    fontCalendar: primaryFamily(styles.getPropertyValue('--font-calendar'), 'serif'),
    fontHand: primaryFamily(styles.getPropertyValue('--font-hand'), 'cursive'),
  };
}
