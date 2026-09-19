import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { IMAGE_CAPTION_HEIGHT } from '@infinite-desk/canvas';
import type { DeskObject, ImagePayload, StickyPayload } from '@infinite-desk/domain';
import { InMemoryDeskPersistence } from '@infinite-desk/persistence';

import { DESK_PERSISTENCE } from '../persistence/desk-persistence.token';
import { DeskActions } from './desk-actions';
import { DeskStore } from './desk-store';
import { HistoryStore } from './history-store';

function photo(): DeskObject {
  return {
    id: 'photo',
    x: 40,
    y: 60,
    width: 320,
    height: 214,
    rotation: -2.5,
    payload: { kind: 'image', frame: 'taped', caption: '', attachmentId: 'a' },
  };
}

function checklistSticky(): DeskObject {
  return {
    id: 'list',
    x: 0,
    y: 0,
    width: 260,
    height: 140,
    rotation: 0,
    payload: {
      kind: 'sticky',
      text: '',
      color: 'mint',
      items: [{ label: 'one' }, { label: 'two', done: true }, { label: 'three' }],
    },
  };
}

describe('DeskActions object creation', () => {
  let store: DeskStore;
  let actions: DeskActions;
  let history: HistoryStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: DESK_PERSISTENCE, useValue: new InMemoryDeskPersistence() }],
    });
    store = TestBed.inject(DeskStore);
    actions = TestBed.inject(DeskActions);
    history = TestBed.inject(HistoryStore);
  });

  it('centres a sticky on the requested point', () => {
    const id = actions.addSticky({ x: 400, y: 900 });
    const note = store.get(id)!;
    expect(note.x + note.width / 2).toBe(400);
    expect(note.y + note.height / 2).toBe(900);
  });

  it('fans out only when asked, so pointerless notes do not stack', () => {
    const xs = [0, 1, 2].map(() => store.get(actions.addSticky({ x: 400, y: 900 }, true))!.x);
    expect(new Set(xs).size).toBe(3);
  });

  it('bounds a dropped picture on both axes, whatever its shape', () => {
    const tall = store.get(actions.addImage({ x: 0, y: 0 }, 'a', 500 / 1500))!;
    const wide = store.get(actions.addImage({ x: 0, y: 0 }, 'b', 2400 / 400))!;

    // Pinning the width alone would make a phone photo 320x960 — taller than a
    // month on the desk — and a panorama a 320x53 sliver. Both stay within a
    // hand-sized range instead.
    for (const picture of [tall, wide]) {
      expect(Math.max(picture.width, picture.height)).toBeLessThanOrEqual(640);
      expect(Math.min(picture.width, picture.height)).toBeGreaterThanOrEqual(88);
    }
    expect(tall.height).toBeGreaterThan(tall.width);
    expect(wide.width).toBeGreaterThan(wide.height);
  });

  it('grows the frame for a caption rather than cropping the photo', () => {
    const id = actions.addImage({ x: 0, y: 0 }, 'a', 1.5);
    const before = store.get(id)!;

    actions.setImageCaption(id, 'beach, august');
    const captioned = store.get(id)!;
    // The photo area is height minus the caption band, so the frame has to
    // grow by exactly that band or the picture loses its top and bottom.
    expect(captioned.height).toBe(before.height + IMAGE_CAPTION_HEIGHT);

    actions.setImageCaption(id, '');
    expect(store.get(id)!.height).toBe(before.height);
  });

  it('takes the caption and the band it needed back in one undo', () => {
    const id = actions.addImage({ x: 0, y: 0 }, 'a', 1.5);
    const before = store.get(id)!;

    actions.setImageCaption(id, 'beach, august');
    history.undo();

    const restored = store.get(id)!;
    // Typing the caption was one act, so one Ctrl+Z has to undo all of it.
    // Two entries left the mount a band taller than the photo it framed.
    expect(restored.height).toBe(before.height);
    expect((restored.payload as ImagePayload).caption).toBe('');
  });

  it('creates a checklist sticky with one unticked item', () => {
    const id = actions.addChecklistSticky({ x: 0, y: 0 });
    const payload = store.get(id)!.payload as StickyPayload;
    expect(payload.items).toHaveLength(1);
    expect(payload.items![0].done ?? false).toBe(false);
  });

  it('clearing a text object deletes it rather than leaving an empty scrap', () => {
    const id = actions.addText({ x: 10, y: 10 }, 'fair setup');
    expect(store.get(id)).toBeDefined();

    actions.commitTextEdit(id, '   ');
    expect(store.get(id)).toBeUndefined();
  });
});

describe('DeskActions checklist editing', () => {
  let store: DeskStore;
  let actions: DeskActions;
  let history: HistoryStore;

  const items = () => (store.get('list')?.payload as StickyPayload).items!;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: DESK_PERSISTENCE, useValue: new InMemoryDeskPersistence() }],
    });
    store = TestBed.inject(DeskStore);
    actions = TestBed.inject(DeskActions);
    history = TestBed.inject(HistoryStore);
    store.insert(checklistSticky());
  });

  it('toggles one item and undoes as one history entry', () => {
    actions.toggleChecklistItem('list', 1);
    expect(items().map((i) => !!i.done)).toEqual([false, false, false]);

    history.undo();
    expect(items().map((i) => !!i.done)).toEqual([false, true, false]);
  });

  it('ignores toggles on missing items and non-checklist objects', () => {
    actions.toggleChecklistItem('list', 7);
    actions.toggleChecklistItem('absent', 0);
    expect(items().map((i) => !!i.done)).toEqual([false, true, false]);
  });

  it('keeps a tick on its item when the lines are reordered', () => {
    // Marcus's corruption, 2026-09-18: ticks lived on row numbers, so
    // retyping the same items in a new order reassigned them — "my checklist
    // now claims I've defended my prospectus". A tick belongs to its words.
    actions.setChecklistItems('list', ['three', 'one', 'two']);
    expect(items().map((i) => i.label)).toEqual(['three', 'one', 'two']);
    expect(items().map((i) => !!i.done)).toEqual([false, false, true]);
  });

  it('keeps ticks with their items when a line is inserted above them', () => {
    // The same corruption by another gesture: an insertion shifted every
    // row below it, so the tick stayed at its index and changed owners.
    actions.setChecklistItems('list', ['zero', 'one', 'two', 'three']);
    expect(items().map((i) => !!i.done)).toEqual([false, false, true, false]);
  });

  it('appending keeps every existing state, as it always did', () => {
    actions.setChecklistItems('list', ['one', 'two', 'three', 'four']);
    expect(items().map((i) => !!i.done)).toEqual([false, true, false, false]);
  });

  it('a deleted line takes its tick with it', () => {
    actions.setChecklistItems('list', ['one', 'three']);
    expect(items().map((i) => i.label)).toEqual(['one', 'three']);
    // "two" was done and is gone; nothing else may inherit that.
    expect(items().map((i) => !!i.done)).toEqual([false, false]);
  });

  it('rewording a done item unticks it, which is the chosen trade-off', () => {
    // A tick travels only with its exact words. The alternative — falling
    // back to the row when the words changed — can hand a tick to a new line
    // typed above a done one, which is the false positive this whole rule
    // exists to prevent. Unticked-after-reword is visible and one click to
    // repair; falsely ticked is silent and lies.
    actions.setChecklistItems('list', ['one', 'two, with notes', 'three']);
    expect(items().map((i) => !!i.done)).toEqual([false, false, false]);
  });

  it('duplicate lines match in order, so an unchanged list is unchanged', () => {
    actions.setChecklistItems('list', ['same', 'same']);
    actions.toggleChecklistItem('list', 0);
    expect(items().map((i) => !!i.done)).toEqual([true, false]);

    actions.setChecklistItems('list', ['same', 'same']);
    expect(items().map((i) => !!i.done)).toEqual([true, false]);
  });

  it('a full replacement is one undoable step back to the old list', () => {
    actions.setChecklistItems('list', ['three', 'one', 'two']);
    history.undo();
    expect(items().map((i) => i.label)).toEqual(['one', 'two', 'three']);
    expect(items().map((i) => !!i.done)).toEqual([false, true, false]);
  });
});

describe('DeskActions inspector edits', () => {
  let store: DeskStore;
  let actions: DeskActions;
  let history: HistoryStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: DESK_PERSISTENCE, useValue: new InMemoryDeskPersistence() }],
    });
    store = TestBed.inject(DeskStore);
    actions = TestBed.inject(DeskActions);
    history = TestBed.inject(HistoryStore);
    store.insert(photo());
  });

  it('moves an object to typed coordinates as one undoable step', () => {
    actions.setPosition('photo', 400, 900);
    expect(store.get('photo')).toMatchObject({ x: 400, y: 900 });

    history.undo();
    expect(store.get('photo')).toMatchObject({ x: 40, y: 60 });
    // One step, not two: the note was seeded rather than added, so anything
    // else on the stack would be a second entry this gesture pushed.
    expect(history.canUndo()).toBe(false);
  });

  it('records nothing when the typed coordinates are the ones it already has', () => {
    actions.setPosition('photo', 40, 60);
    expect(history.canUndo()).toBe(false);
  });

  it('turns an object to a typed angle and gives back the old tilt', () => {
    actions.setRotation('photo', 12);
    expect(store.get('photo')!.rotation).toBe(12);

    history.undo();
    expect(store.get('photo')!.rotation).toBe(-2.5);
    expect(history.canUndo()).toBe(false);
  });

  it('records nothing when the typed angle is the one it already has', () => {
    actions.setRotation('photo', -2.5);
    expect(history.canUndo()).toBe(false);
  });

  it('reframes a picture and puts the tape back on one undo', () => {
    actions.setImageFrame('photo', 'borderless');
    expect((store.get('photo')!.payload as ImagePayload).frame).toBe('borderless');

    history.undo();
    expect((store.get('photo')!.payload as ImagePayload).frame).toBe('taped');
  });

  it('leaves objects that are not pictures alone', () => {
    store.insert(checklistSticky());
    actions.setImageFrame('list', 'framed');
    expect(history.canUndo()).toBe(false);
  });
});
