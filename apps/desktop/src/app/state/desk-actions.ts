/**
 * User-facing desk mutations, each expressed as a domain command executed
 * through the history — the single write path required by the architecture
 * guardrails (no direct store writes from UI or gesture code).
 */

import { Injectable, inject } from '@angular/core';

import {
  AddObjectCommand,
  DeleteObjectCommand,
  MoveObjectCommand,
  ResizeObjectCommand,
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

  /** Adds a new handwritten sticky note near a world position; selects it. */
  addSticky(near: { x: number; y: number }): string {
    const count = this.desk.floats().length;
    const object: DeskObject = {
      id: `new${Date.now()}`,
      x: near.x + (count % 3) * 30,
      y: near.y + (count % 3) * 24,
      width: 260,
      height: 180,
      rotation: -1 + Math.random() * 2,
      payload: { kind: 'sticky', text: 'new note', color: 'yellow', hand: true },
    };
    this.history.execute(new AddObjectCommand(this.desk, object));
    this.selection.select('sticky', object.id);
    return object.id;
  }

  /** Creates a draft text object at a world position (double-click to write). */
  addDraftText(x: number, y: number): string {
    const object: DeskObject = {
      id: `txt${Date.now()}`,
      x,
      y,
      width: 420,
      height: 90,
      rotation: 0,
      payload: { kind: 'text', text: 'start typing…', draft: true },
    };
    this.history.execute(new AddObjectCommand(this.desk, object));
    this.selection.select('text', object.id);
    return object.id;
  }

  /** Commits an edited text object's content and ends its draft state. */
  commitTextEdit(id: string, text: string): void {
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

  /** Commits an edited sticky note's text. */
  setStickyText(id: string, text: string): void {
    const object = this.desk.get(id);
    if (!object || object.payload.kind !== 'sticky') return;
    this.history.execute(
      new UpdatePayloadCommand(this.desk, id, object.payload, {
        ...object.payload,
        text: text.trim(),
      }),
    );
  }

  /** Commits a finished drag as one undoable move. */
  commitMove(id: string, from: { x: number; y: number }, to: { x: number; y: number }): void {
    if (from.x === to.x && from.y === to.y) return;
    this.history.execute(new MoveObjectCommand(this.desk, id, from, to));
  }

  /** Commits a finished resize gesture as one undoable command. */
  commitResize(
    id: string,
    from: { width: number; height: number },
    to: { width: number; height: number },
  ): void {
    if (from.width === to.width && from.height === to.height) return;
    this.history.execute(new ResizeObjectCommand(this.desk, id, from, to));
  }

  /** Deletes an object (undoable) and clears the selection if it was selected. */
  deleteObject(id: string): void {
    if (!this.desk.get(id)) return;
    this.history.execute(new DeleteObjectCommand(this.desk, id));
    if (this.selection.selection()?.id === id) this.selection.clear();
  }

  /** Nudges an object by a delta as one undoable move (arrow keys). */
  nudge(id: string, dx: number, dy: number): void {
    const object = this.desk.get(id);
    if (!object) return;
    this.commitMove(id, { x: object.x, y: object.y }, { x: object.x + dx, y: object.y + dy });
  }

  /** Toggles one checklist item's done state (undoable). */
  toggleChecklistItem(id: string, index: number): void {
    const object = this.desk.get(id);
    if (!object || object.payload.kind !== 'sticky' || !object.payload.items?.[index]) return;
    const items = object.payload.items.map((item, i) =>
      i === index ? { ...item, done: !item.done } : item,
    );
    this.history.execute(
      new UpdatePayloadCommand(this.desk, id, object.payload, { ...object.payload, items }),
    );
  }

  /**
   * Replaces a checklist sticky's items from edited lines; done state is
   * preserved by position, added lines start unchecked.
   */
  setChecklistItems(id: string, labels: readonly string[]): void {
    const object = this.desk.get(id);
    if (!object || object.payload.kind !== 'sticky' || !object.payload.items) return;
    const previous = object.payload.items;
    const items = labels.map((label, i) => ({ label, done: previous[i]?.done ?? false }));
    this.history.execute(
      new UpdatePayloadCommand(this.desk, id, object.payload, { ...object.payload, items }),
    );
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
