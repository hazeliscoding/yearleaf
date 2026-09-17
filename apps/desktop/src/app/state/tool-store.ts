/**
 * Active-tool state for the tool rail and canvas cursor behavior.
 */

import { Injectable, computed, signal } from '@angular/core';

import type { IconName } from '@infinite-desk/deskbound';

/** One entry of the tool rail: either a tool or a visual divider. */
export interface ToolSpec {
  /** Tool display name; doubles as its identifier. */
  readonly label: string;
  /** Rail icon. */
  readonly icon: IconName;
  /** Optional single-key shortcut shown on the button corner. */
  readonly shortcut?: string;
  /**
   * Tool whose behaviour has not been built yet. It renders disabled and
   * claims no shortcut — a visibly unfinished tool reads as "not built yet",
   * where one that arms and then does nothing reads as a broken product.
   */
  readonly unavailable?: boolean;
}

/** Tools that place an object at the next canvas click. */
const CREATION_TOOLS = new Set(['Text', 'Sticky note', 'Task']);

/** The tool rail layout: tool groups separated by dividers. */
export const TOOL_GROUPS: readonly (readonly ToolSpec[])[] = [
  [
    { icon: 'mouse-pointer-2', label: 'Select', shortcut: 'V' },
    { icon: 'hand', label: 'Pan', shortcut: 'H' },
    { icon: 'type', label: 'Text', shortcut: 'T' },
    { icon: 'sticky-note', label: 'Sticky note', shortcut: 'N' },
    { icon: 'square-check', label: 'Task', shortcut: 'K' },
    // Last in the group so the tools that work stay contiguous.
    { icon: 'calendar-plus', label: 'Event', unavailable: true },
  ],
  [
    { icon: 'pen-line', label: 'Pen', unavailable: true },
    { icon: 'pencil', label: 'Pencil', unavailable: true },
    { icon: 'highlighter', label: 'Highlighter', unavailable: true },
    { icon: 'eraser', label: 'Eraser', unavailable: true },
    { icon: 'lasso', label: 'Lasso', unavailable: true },
  ],
  [
    { icon: 'image', label: 'Image', unavailable: true },
    { icon: 'move-up-right', label: 'Arrow', unavailable: true },
    { icon: 'stamp', label: 'Stamp', unavailable: true },
  ],
];

@Injectable({ providedIn: 'root' })
export class ToolStore {
  /** Currently active tool label. */
  readonly active = signal('Select');
  /** `true` while space is held for temporary panning. */
  readonly spaceHeld = signal(false);
  /** `true` while a pan gesture is in progress. */
  readonly panning = signal(false);
  /**
   * `true` while a DOM editor overlay owns the keyboard.
   *
   * Global shortcuts consult this rather than the focused element: the editor
   * is focused a frame after it appears, and keys landing in that gap would
   * otherwise arm tools and start pans while the user believes they are typing.
   */
  readonly editing = signal(false);

  /** Cursor the canvas should show for the current tool/gesture state. */
  readonly canvasCursor = computed(() =>
    this.panning()
      ? 'grabbing'
      : this.spaceHeld() || this.active() === 'Pan'
        ? 'grab'
        : // A creation tool disarms after one placement, so the cursor is the
          // only signal that the next click will drop an object.
          CREATION_TOOLS.has(this.active())
          ? 'crosshair'
          : 'default',
  );

  /** Activates a tool by its label. */
  activate(label: string): void {
    this.active.set(label);
  }
}
