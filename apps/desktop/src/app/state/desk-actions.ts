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

  /**
   * Adds a handwritten sticky note and selects it.
   *
   * @param at - World point the note is centred on. A note is placed like
   *   paper under a thumb; anchoring a corner here would push the note off
   *   the day the user aimed at.
   * @param fanOut - Offsets each successive note so notes created without a
   *   pointer (the palette) do not stack exactly.
   */
  addSticky(at: { x: number; y: number }, fanOut = false): string {
    const width = 260;
    const height = 180;
    const step = fanOut ? this.desk.floats().length % 3 : 0;
    return this.addObject({
      x: Math.round(at.x - width / 2) + step * 30,
      y: Math.round(at.y - height / 2) + step * 24,
      width,
      height,
      rotation: -1 + Math.random() * 2,
      // Starts empty: placeholder words are real content, so they survive a
      // double-click (which selects one word) and weld themselves onto what
      // the user types — "Maple Lodge" becomes "Maple Lodgenote".
      payload: { kind: 'sticky', text: '', color: 'yellow', hand: true },
    });
  }

  /**
   * Adds a checklist sticky — the only path to the tickable notes the desk
   * could previously only be seeded with.
   *
   * @param at - World point the note is centred on.
   */
  addChecklistSticky(at: { x: number; y: number }): string {
    const width = 260;
    // Two rows' worth: room to grow without opening as mostly empty paper.
    const height = 110;
    return this.addObject({
      x: Math.round(at.x - width / 2),
      y: Math.round(at.y - height / 2),
      width,
      height,
      rotation: -1 + Math.random() * 2,
      payload: {
        kind: 'sticky',
        text: '',
        color: 'mint',
        // Empty for the same reason as addSticky's text.
        items: [{ label: '' }],
      },
    });
  }

  /**
   * Adds a text object holding already-composed content.
   *
   * @param at - World position of the text's top-left corner.
   * @param text - Non-empty content; callers discard empty compositions
   *   rather than creating an invisible object.
   */
  addText(at: { x: number; y: number }, text: string): string {
    return this.addObject({
      x: at.x,
      y: at.y,
      width: 420,
      height: 90,
      rotation: 0,
      payload: { kind: 'text', text },
    });
  }

  /** Monotonic suffix so objects created in the same millisecond differ. */
  private seq = 0;

  /**
   * Places an imported picture on the desk, centred on where it was dropped.
   *
   * @param at - World point the picture is centred on.
   * @param attachmentId - The imported file it draws.
   * @param aspect - Width divided by height, so a portrait photo is not
   *   squeezed into a landscape frame before its bitmap has even loaded.
   */
  addImage(at: { x: number; y: number }, attachmentId: string, aspect: number): string {
    const width = 320;
    const height = Math.round(width / (aspect > 0 ? aspect : 1));
    return this.addObject({
      x: Math.round(at.x - width / 2),
      y: Math.round(at.y - height / 2),
      width,
      height,
      rotation: -1 + Math.random() * 2,
      payload: { kind: 'image', frame: 'taped', caption: '', attachmentId },
    });
  }

  /** Executes an add command for a fully specified object and selects it. */
  private addObject(object: Omit<DeskObject, 'id'>): string {
    const kind = object.payload.kind;
    const id = `${kind}${Date.now()}-${this.seq++}`;
    this.history.execute(new AddObjectCommand(this.desk, { ...object, id }));
    this.selection.select(kind, id);
    return id;
  }

  /** Commits an edited text object; clearing it removes the object. */
  commitTextEdit(id: string, text: string): void {
    const object = this.desk.get(id);
    if (!object || object.payload.kind !== 'text') return;
    const trimmed = text.trim();
    if (!trimmed) {
      this.deleteObject(id);
      return;
    }
    this.history.execute(
      new UpdatePayloadCommand(this.desk, id, object.payload, { kind: 'text', text: trimmed }),
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
