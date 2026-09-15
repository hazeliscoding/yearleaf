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
}

/** The tool rail layout: tool groups separated by dividers. */
export const TOOL_GROUPS: readonly (readonly ToolSpec[])[] = [
  [
    { icon: 'mouse-pointer-2', label: 'Select', shortcut: 'V' },
    { icon: 'hand', label: 'Pan', shortcut: 'H' },
    { icon: 'type', label: 'Text', shortcut: 'T' },
    { icon: 'sticky-note', label: 'Sticky note', shortcut: 'N' },
    { icon: 'calendar-plus', label: 'Event', shortcut: 'E' },
    { icon: 'square-check', label: 'Task', shortcut: 'K' },
  ],
  [
    { icon: 'pen-line', label: 'Pen', shortcut: 'P' },
    { icon: 'pencil', label: 'Pencil' },
    { icon: 'highlighter', label: 'Highlighter' },
    { icon: 'eraser', label: 'Eraser' },
    { icon: 'lasso', label: 'Lasso' },
  ],
  [
    { icon: 'image', label: 'Image' },
    { icon: 'move-up-right', label: 'Arrow' },
    { icon: 'stamp', label: 'Stamp' },
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

  /** Cursor the canvas should show for the current tool/gesture state. */
  readonly canvasCursor = computed(() =>
    this.panning() ? 'grabbing' : this.spaceHeld() || this.active() === 'Pan' ? 'grab' : 'default',
  );

  /** Activates a tool by its label. */
  activate(label: string): void {
    this.active.set(label);
  }
}
