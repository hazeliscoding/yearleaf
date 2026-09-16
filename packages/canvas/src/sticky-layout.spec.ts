import { describe, expect, it } from 'vitest';

import type { DeskObject } from '@infinite-desk/domain';

import {
  CHECKLIST_ROW_H,
  STICKY_PAD,
  STICKY_PAD_COMPACT,
  checklistItemAt,
} from './sticky-layout';

/** A checklist sticky at (1000, 2000) with three items. */
function checklistSticky(): DeskObject {
  return {
    id: 'list',
    x: 1000,
    y: 2000,
    width: 260,
    height: 200,
    rotation: -1.5,
    payload: {
      kind: 'sticky',
      text: '',
      color: 'mint',
      items: [{ label: 'one' }, { label: 'two', done: true }, { label: 'three' }],
    },
  };
}

describe('checklistItemAt', () => {
  it('hits each checkbox at its painted position', () => {
    const object = checklistSticky();
    for (let i = 0; i < 3; i++) {
      const world = {
        x: object.x + STICKY_PAD + 7,
        y: object.y + STICKY_PAD + i * CHECKLIST_ROW_H + 11,
      };
      expect(checklistItemAt(object, world)).toBe(i);
    }
  });

  it('misses clicks on the label so they stay draggable', () => {
    const object = checklistSticky();
    const world = { x: object.x + STICKY_PAD + 60, y: object.y + STICKY_PAD + 11 };
    expect(checklistItemAt(object, world)).toBeNull();
  });

  it('misses clicks below the last row', () => {
    const object = checklistSticky();
    const world = {
      x: object.x + STICKY_PAD + 7,
      y: object.y + STICKY_PAD + 3 * CHECKLIST_ROW_H + 24,
    };
    expect(checklistItemAt(object, world)).toBeNull();
  });

  it('uses the compact padding for compact stickies', () => {
    const object = checklistSticky();
    const compact: DeskObject = {
      ...object,
      payload: { ...(object.payload as Extract<DeskObject['payload'], { kind: 'sticky' }>), compact: true },
    };
    const world = {
      x: compact.x + STICKY_PAD_COMPACT + 7,
      y: compact.y + STICKY_PAD_COMPACT + CHECKLIST_ROW_H + 11,
    };
    expect(checklistItemAt(compact, world)).toBe(1);
  });

  it('returns null for text stickies and other object kinds', () => {
    const object = checklistSticky();
    const world = { x: object.x + STICKY_PAD + 7, y: object.y + STICKY_PAD + 11 };
    const textSticky: DeskObject = {
      ...object,
      payload: { kind: 'sticky', text: 'plain', color: 'yellow' },
    };
    const note: DeskObject = { ...object, payload: { kind: 'text', text: 'hello' } };
    expect(checklistItemAt(textSticky, world)).toBeNull();
    expect(checklistItemAt(note, world)).toBeNull();
  });
});
