/**
 * Sticky-note content layout shared by the PixiJS renderer (object-view)
 * and interaction code: one source of truth for padding and checklist row
 * geometry so hit-testing a checkbox matches where it was painted.
 */

import type { DeskObject } from '@infinite-desk/domain';

import type { Point } from './viewport';

/** Content padding of a regular sticky, in world units. */
export const STICKY_PAD = 20;
/** Content padding of a compact sticky. */
export const STICKY_PAD_COMPACT = 14;
/** Vertical stride of one checklist row. */
export const CHECKLIST_ROW_H = 30;
/** Side length of the checkbox square. */
export const CHECKLIST_BOX = 15;
/** Vertical offset of the checkbox within its row. */
export const CHECKLIST_BOX_OFFSET_Y = 4;
/** Extra world units around the checkbox that still count as a hit. */
const CHECKBOX_HIT_SLOP = 6;

/** Content padding for a sticky payload. */
export function stickyPad(compact: boolean | undefined): number {
  return compact ? STICKY_PAD_COMPACT : STICKY_PAD;
}

/**
 * Returns the index of the checklist item whose checkbox contains the world
 * point, or `null` when the object is not a checklist sticky or the point
 * misses every checkbox. Only the checkbox column toggles — clicks on the
 * label stay available for selecting and dragging the note.
 *
 * The note's decorative tilt (±2°) is ignored, matching the axis-aligned
 * spatial-index hit test that routed the click here.
 */
export function checklistItemAt(object: DeskObject, world: Point): number | null {
  if (object.payload.kind !== 'sticky' || !object.payload.items?.length) return null;
  const pad = stickyPad(object.payload.compact);
  const localX = world.x - object.x;
  const localY = world.y - object.y;
  if (localX < pad - CHECKBOX_HIT_SLOP || localX > pad + CHECKLIST_BOX + CHECKBOX_HIT_SLOP) {
    return null;
  }
  for (let i = 0; i < object.payload.items.length; i++) {
    const top = pad + i * CHECKLIST_ROW_H + CHECKLIST_BOX_OFFSET_Y;
    if (localY >= top - CHECKBOX_HIT_SLOP && localY <= top + CHECKLIST_BOX + CHECKBOX_HIT_SLOP) {
      return i;
    }
  }
  return null;
}
