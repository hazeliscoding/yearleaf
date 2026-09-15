/**
 * Current selection and the contextual details the inspector edits.
 */

import { Injectable, computed, signal } from '@angular/core';

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

  /** Title of the selected event (inspector-editable). */
  readonly eventTitle = signal('Dentist');
  /** Time range copy of the selected event. */
  readonly eventTime = signal('14:00 – 14:40');
  /** Stationery custom property of the selected event's color. */
  readonly eventColor = signal('--stationery-teal');

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

  /** Selects a desk object or event. */
  select(kind: SelectionKind, id: string): void {
    this.selection.set({ kind, id });
  }

  /** Clears the selection. */
  clear(): void {
    this.selection.set(null);
  }
}
