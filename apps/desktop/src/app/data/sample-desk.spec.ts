/**
 * The desk's indexes may only name things the desk actually holds.
 *
 * Day cells were made honest when the sample month's tasks, ranges, handwriting
 * and taped photos stopped being merged over them. Search and the command
 * palette are indexes *into* that desk, written from the same design reference,
 * and they went on naming the retired content: the overlay lists every row
 * before a character is typed, and picking one flies the desk to the day it
 * names, so a row for a range bar nobody draws is a search hit that lands on an
 * empty cell — the same fiction, reached through the one tool a person opens
 * when they are already certain something is there.
 *
 * A constants test on purpose. The index is a sample (the roadmap still owes
 * "universal search over real structured text and metadata"), and until it is
 * computed from the stores the only thing keeping it truthful is a check that
 * it agrees with the seed sitting beside it in the same file.
 */

import { describe, expect, it } from 'vitest';

import { INITIAL_FLOATS, MONTH_CONTENT, PALETTE_GROUPS, SEARCH_INDEX } from './sample-desk';

/**
 * Every piece of text a first-run desk really holds: the event titles seeded as
 * rows, plus what is written on the objects parked beside the calendar.
 *
 * `MONTH_CONTENT`'s other fields are deliberately excluded. They are seed
 * material for object types that do not exist yet and are drawn nowhere, which
 * is the whole point of the check.
 */
function deskContents(): string[] {
  const text: string[] = [];
  for (const content of Object.values(MONTH_CONTENT)) {
    for (const event of content.events ?? []) text.push(event.title);
  }
  for (const float of INITIAL_FLOATS) {
    const payload = float.payload;
    if (payload.kind === 'sticky' || payload.kind === 'text') text.push(payload.text);
    if (payload.kind === 'sticky') for (const item of payload.items ?? []) text.push(item.label);
    if (payload.kind === 'image') text.push(payload.caption);
    if (payload.kind === 'file') text.push(payload.name);
  }
  // The checklist sticky's unused free-text slot is an empty string, which is a
  // substring of every label and would vouch for anything.
  return text.filter((entry) => entry.trim().length > 0);
}

/** `true` when some real desk content is named inside `label`. */
function namesSomethingReal(label: string): boolean {
  const haystack = label.toLowerCase();
  return deskContents().some((entry) => haystack.includes(entry.toLowerCase()));
}

describe('the desk indexes', () => {
  it('offer no search result the desk cannot show', () => {
    const orphans = SEARCH_INDEX.filter((row) => !namesSomethingReal(row.label));
    expect(orphans.map((row) => row.label)).toEqual([]);
  });

  it('send every palette jump somewhere with something on it', () => {
    const jumps = PALETTE_GROUPS.flatMap((group) => group.items).filter((item) =>
      item.label.startsWith('Jump to '),
    );
    // A check that passes vacuously once the rows are renamed checks nothing.
    expect(jumps.length).toBeGreaterThan(0);
    const orphans = jumps.filter((item) => !namesSomethingReal(item.label));
    expect(orphans.map((item) => item.label)).toEqual([]);
  });
});
