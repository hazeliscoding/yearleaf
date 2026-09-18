import { describe, expect, it } from 'vitest';

import { MOD, isSingleCap, modifierCap, resolveCaps, resolveHint } from './platform';

describe('modifierCap', () => {
  it('prints the command glyph on macOS', () => {
    // `userAgentData.platform` says "macOS"; the older `navigator.platform`
    // says "MacIntel", and both have to land on the same cap.
    expect(modifierCap('macOS')).toBe('⌘');
    expect(modifierCap('MacIntel')).toBe('⌘');
    expect(modifierCap('iPhone')).toBe('⌘');
  });

  it('prints Ctrl everywhere else', () => {
    // The exact failure: a desktop build whose demo machine is Windows 11 told
    // every user to press ⌘, a key their keyboard does not have.
    expect(modifierCap('Windows')).toBe('Ctrl');
    expect(modifierCap('Win32')).toBe('Ctrl');
    expect(modifierCap('Linux x86_64')).toBe('Ctrl');
  });

  it('falls back to Ctrl when the platform is unknown', () => {
    expect(modifierCap('')).toBe('Ctrl');
  });
});

describe('resolveCaps', () => {
  it('swaps the logical modifier and passes every other cap through', () => {
    expect(resolveCaps([MOD, 'K'], '⌘')).toEqual(['⌘', 'K']);
    expect(resolveCaps([MOD, 'K'], 'Ctrl')).toEqual(['Ctrl', 'K']);
    expect(resolveCaps(['⇧', 'T'], 'Ctrl')).toEqual(['⇧', 'T']);
  });
});

describe('resolveHint', () => {
  it('writes a glyph modifier tight against its key and a word with a plus', () => {
    // macOS prints ⌘Z; Windows prints Ctrl+Z, and dropping the separator there
    // would read as a key called "CtrlZ".
    expect(resolveHint('Mod+Z', '⌘')).toBe('⌘Z');
    expect(resolveHint('Mod+Z', 'Ctrl')).toBe('Ctrl+Z');
  });

  it('decides each separator from the cap on its left, not from the platform', () => {
    // The trap: one decision taken once for the whole join reads the platform
    // instead of the caps, so every separator disappears on macOS and a hint
    // that merely passes *through* the modifier loses its plus as well.
    // `Shift` is not a logical token yet and passes through verbatim; what has
    // to survive is the separator around it.
    expect(resolveHint('Mod+Shift+Z', '⌘')).toBe('⌘Shift+Z');
    expect(resolveHint('Mod+Shift+Z', 'Ctrl')).toBe('Ctrl+Shift+Z');
    expect(resolveHint('Shift+Z', '⌘')).toBe('Shift+Z');
    expect(resolveHint('Shift+Z', 'Ctrl')).toBe('Shift+Z');
  });

  it('leaves a single-key hint alone', () => {
    expect(resolveHint('V', 'Ctrl')).toBe('V');
    expect(resolveHint('V', '⌘')).toBe('V');
  });
});

describe('isSingleCap', () => {
  it('separates a bare key from a chord', () => {
    expect(isSingleCap('V')).toBe(true);
    expect(isSingleCap('Mod+Z')).toBe(false);
    expect(isSingleCap('Mod+Shift+Z')).toBe(false);
  });
});
