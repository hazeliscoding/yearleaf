/**
 * Current selection and the contextual details the inspector edits.
 */

import { Injectable, computed, signal } from '@angular/core';

import type { Occurrence } from '@infinite-desk/domain';

/** What kind of thing is selected; drives which inspector renders. */
export type SelectionKind = 'sticky' | 'image' | 'file' | 'text' | 'event';

/** A reference to the selected object. */
export interface Selection {
  readonly kind: SelectionKind;
  /** Desk object id, or a synthesized id for in-cell events. */
  readonly id: string;
}

@Injectable({ providedIn: 'root' })
export class SelectionStore {
  /** Active selection, or `null` when nothing is selected. */
  readonly selection = signal<Selection | null>(null);

  /**
   * The selected event chip resolved to an occurrence.
   *
   * A chip's id names a date and a slot, not a row — a computed occurrence has
   * no row at all — so acting on the selection needs the occurrence itself.
   */
  readonly occurrence = signal<Occurrence | null>(null);

  /** Inspector heading for the current selection kind. */
  readonly inspectorTitle = computed(() => {
    switch (this.selection()?.kind) {
      case 'sticky':
        return 'Sticky note';
      case 'event':
        return 'Event';
      case 'image':
        return 'Image';
      case 'file':
        return 'Attachment';
      case 'text':
        return 'Text';
      default:
        return '';
    }
  });

  /**
   * Selects a desk object or event.
   *
   * The occurrence is always dropped, including when one event replaces
   * another. Keeping it for event kinds assumed every path that selects an
   * event also sets it, and the creation path does not: `EventActions.create`
   * selects the new row and leaves the occurrence naming the row before it.
   * The inspector edits exclusively through the occurrence, so a selection
   * naming one event while the occurrence named another was not an inspector
   * showing stale text — it was every field in it writing to a row the user
   * was not looking at, with undo recording the damage as a deliberate edit.
   *
   * Clearing unconditionally makes the worst case an inspector bound to
   * nothing, which is what a freshly created event already showed. Whether
   * creation should select at all, and whether it should supply an
   * occurrence, are open — this holds under either answer.
   */
  select(kind: SelectionKind, id: string): void {
    this.selection.set({ kind, id });
    this.occurrence.set(null);
  }

  /** Clears the selection. */
  clear(): void {
    this.selection.set(null);
    this.occurrence.set(null);
  }
}
