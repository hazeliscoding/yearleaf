import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import type { DeskObject, StickyPayload } from '@infinite-desk/domain';
import { InMemoryDeskPersistence } from '@infinite-desk/persistence';

import { DESK_PERSISTENCE } from '../persistence/desk-persistence.token';
import { DeskActions } from './desk-actions';
import { DeskStore } from './desk-store';
import { HistoryStore } from './history-store';

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

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: DESK_PERSISTENCE, useValue: new InMemoryDeskPersistence() }],
    });
    store = TestBed.inject(DeskStore);
    actions = TestBed.inject(DeskActions);
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

  it('replaces labels while keeping done state by position', () => {
    actions.setChecklistItems('list', ['uno', 'dos', 'tres', 'cuatro']);
    expect(items().map((i) => i.label)).toEqual(['uno', 'dos', 'tres', 'cuatro']);
    expect(items().map((i) => !!i.done)).toEqual([false, true, false, false]);

    history.undo();
    expect(items().map((i) => i.label)).toEqual(['one', 'two', 'three']);
  });
});
