/**
 * User-facing desk mutations, each expressed as a domain command executed
 * through the history — the single write path required by the architecture
 * guardrails (no direct store writes from UI or gesture code).
 */

import { Injectable, inject } from '@angular/core';

import {
  AddObjectCommand,
  MoveObjectCommand,
  UpdatePayloadCommand,
  type DeskObject,
  type StationeryColor,
} from '@infinite-desk/domain';

import { DeskStore } from './desk-store';
import { HistoryStore } from './history-store';
import { SelectionStore } from './selection-store';

@Injectable({ providedIn: 'root' })
export class DeskActions {
  private readonly desk = inject(DeskStore);
  private readonly history = inject(HistoryStore);
  private readonly selection = inject(SelectionStore);

  /** Adds a new handwritten sticky note near the sheet and selects it. */
  addSticky(): void {
    const count = this.desk.floats().length;
    const object: DeskObject = {
      id: `new${Date.now()}`,
      x: 520 + (count % 3) * 40,
      y: 660,
      rotation: -1 + Math.random() * 2,
      payload: { kind: 'sticky', text: 'new note', color: 'yellow', hand: true },
    };
    this.history.execute(new AddObjectCommand(this.desk, object));
    this.selection.select('sticky', object.id);
  }

  /** Creates a draft text object at a world position (double-click to write). */
  addDraftText(x: number, y: number): void {
    const object: DeskObject = {
      id: `txt${Date.now()}`,
      x,
      y,
      rotation: 0,
      payload: { kind: 'text', text: 'start typing…', draft: true },
    };
    this.history.execute(new AddObjectCommand(this.desk, object));
    this.selection.select('text', object.id);
  }

  /** Commits the edited text of a draft object and ends its draft state. */
  commitDraftText(id: string, text: string): void {
    const object = this.desk.get(id);
    if (!object || object.payload.kind !== 'text') return;
    this.history.execute(
      new UpdatePayloadCommand(this.desk, id, object.payload, {
        kind: 'text',
        text: text.trim() || 'start typing…',
        draft: false,
      }),
    );
  }

  /** Commits a finished drag as one undoable move. */
  commitMove(id: string, from: { x: number; y: number }, to: { x: number; y: number }): void {
    if (from.x === to.x && from.y === to.y) return;
    this.history.execute(new MoveObjectCommand(this.desk, id, from, to));
  }

  /** Recolors a sticky note (inspector color picker). */
  setStickyColor(id: string, color: StationeryColor): void {
    const object = this.desk.get(id);
    if (!object || object.payload.kind !== 'sticky') return;
    this.history.execute(
      new UpdatePayloadCommand(this.desk, id, object.payload, { ...object.payload, color }),
    );
  }

  /** Recaptions an image (inspector caption field). */
  setImageCaption(id: string, caption: string): void {
    const object = this.desk.get(id);
    if (!object || object.payload.kind !== 'image') return;
    this.history.execute(
      new UpdatePayloadCommand(this.desk, id, object.payload, { ...object.payload, caption }),
    );
  }
}
