/**
 * User-facing desk mutations, each expressed as a domain command executed
 * through the history — the single write path required by the architecture
 * guardrails (no direct store writes from UI or gesture code).
 */

import { Injectable, inject } from '@angular/core';

import { IMAGE_CAPTION_HEIGHT } from '@infinite-desk/canvas';
import {
  AddObjectCommand,
  CompositeCommand,
  DeleteObjectCommand,
  MoveObjectCommand,
  ResizeObjectCommand,
  RotateObjectCommand,
  UpdatePayloadCommand,
  type ChecklistItem,
  type DeskObject,
  type ImagePayload,
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
   * @param box - Longest side in world units; callers scale it by the current
   *   zoom so a dropped picture is a similar size on screen at any tier.
   */
  addImage(
    at: { x: number; y: number },
    attachmentId: string,
    aspect: number,
    box = 320,
  ): string {
    // Fitted, not pinned. Pinning one axis lets the aspect ratio decide
    // physical size, so a phone photo arrives as a poster taller than a month
    // and a panorama as a strip thinner than a sticky. The longest side is
    // capped, then an extreme ratio is grown back until its short side is
    // still legible — up to a hard ceiling, so nothing spans the desk.
    const ratio = aspect > 0 ? aspect : 1;
    let width = ratio >= 1 ? box : box * ratio;
    let height = ratio >= 1 ? box / ratio : box;

    const minShortSide = box * 0.28;
    const shortest = Math.min(width, height);
    if (shortest < minShortSide) {
      const grow = minShortSide / shortest;
      width *= grow;
      height *= grow;
    }
    const longest = Math.max(width, height);
    if (longest > box * 2) {
      const shrink = (box * 2) / longest;
      width *= shrink;
      height *= shrink;
    }
    width = Math.round(width);
    height = Math.round(height);
    return this.addObject({
      x: Math.round(at.x - width / 2),
      y: Math.round(at.y - height / 2),
      width,
      height,
      // Enough tilt to read as set down by hand rather than pasted square.
      rotation: -3.5 + Math.random() * 7,
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

  /** Moves an object to an absolute position (inspector geometry fields). */
  setPosition(id: string, x: number, y: number): void {
    const object = this.desk.get(id);
    if (!object) return;
    this.commitMove(id, { x: object.x, y: object.y }, { x, y });
  }

  /** Turns an object to an absolute angle in degrees (inspector rotation). */
  setRotation(id: string, degrees: number): void {
    const object = this.desk.get(id);
    if (!object || object.rotation === degrees) return;
    this.history.execute(new RotateObjectCommand(this.desk, id, object.rotation, degrees));
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
   * Replaces a checklist sticky's items from edited lines.
   *
   * A tick travels with its words, never with its row number. Done state used
   * to be copied across by position, so retyping the same items in a new
   * order reassigned every tick — a checklist came back claiming the wrong
   * things were finished, and undo recorded the corruption as an edit. Each
   * new line now claims the first not-yet-claimed old item with exactly the
   * same label; duplicates therefore match in order, which keeps an unchanged
   * list unchanged.
   *
   * Two consequences are deliberate. A deleted line takes its tick with it —
   * nothing may inherit a state whose words are gone. And rewording a done
   * item unticks it, because the fallback that would preserve it (match by
   * row when the words changed) is the same rule that hands a tick to a new
   * line typed above a done one. Unticked-after-reword is visible and one
   * click to repair; falsely ticked is silent and lies.
   */
  setChecklistItems(id: string, labels: readonly string[]): void {
    const object = this.desk.get(id);
    if (!object || object.payload.kind !== 'sticky' || !object.payload.items) return;
    const donors: (ChecklistItem | undefined)[] = [...object.payload.items];
    const items = labels.map((label) => {
      const at = donors.findIndex((donor) => donor?.label === label);
      if (at === -1) return { label, done: false };
      const donor = donors[at]!;
      donors[at] = undefined;
      return { label, done: donor.done ?? false };
    });
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

  /** Shows or removes a sticky's push-pin (inspector toggle). */
  setStickyPinned(id: string, pinned: boolean): void {
    const object = this.desk.get(id);
    if (!object || object.payload.kind !== 'sticky' || !!object.payload.pinned === pinned) return;
    this.history.execute(
      new UpdatePayloadCommand(this.desk, id, object.payload, { ...object.payload, pinned }),
    );
  }

  /** Switches a sticky between the handwriting and the plain face. */
  setStickyHand(id: string, hand: boolean): void {
    const object = this.desk.get(id);
    if (!object || object.payload.kind !== 'sticky' || !!object.payload.hand === hand) return;
    this.history.execute(
      new UpdatePayloadCommand(this.desk, id, object.payload, { ...object.payload, hand }),
    );
  }

  /** Changes how an image is presented (inspector frame control). */
  setImageFrame(id: string, frame: ImagePayload['frame']): void {
    const object = this.desk.get(id);
    if (!object || object.payload.kind !== 'image') return;
    this.history.execute(
      new UpdatePayloadCommand(this.desk, id, object.payload, { ...object.payload, frame }),
    );
  }

  /**
   * Recaptions an image (inspector caption field).
   *
   * The frame grows to make room for the caption band rather than the photo
   * shrinking into it — writing a label under a print must not crop the print.
   */
  setImageCaption(id: string, caption: string): void {
    const object = this.desk.get(id);
    if (!object || object.payload.kind !== 'image') return;
    const had = !!object.payload.caption;
    const has = !!caption;
    const recaption = new UpdatePayloadCommand(this.desk, id, object.payload, {
      ...object.payload,
      caption,
    });
    const resize =
      had === has
        ? null
        : new ResizeObjectCommand(this.desk, id, object, {
            width: object.width,
            height: object.height + (has ? IMAGE_CAPTION_HEIGHT : -IMAGE_CAPTION_HEIGHT),
          });
    // The band and the words appeared together, so one undo has to take both.
    // Executing them separately left the mount a caption-height taller than the
    // photo it framed until a second Ctrl+Z.
    this.history.execute(
      resize ? new CompositeCommand([resize, recaption], 'Caption image') : recaption,
    );
  }
}
