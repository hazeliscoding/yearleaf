import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import type { DeskObject } from '@infinite-desk/domain';
import { InMemoryDeskPersistence } from '@infinite-desk/persistence';

import { INITIAL_FLOATS } from '../data/sample-desk';
import { DESK_PERSISTENCE } from '../persistence/desk-persistence.token';
import { DeskStore } from './desk-store';

/** Lets the store's async hydration (and queued writes) settle. */
const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

function sticky(id: string): DeskObject {
  return {
    id,
    x: 10,
    y: 20,
    width: 260,
    height: 180,
    rotation: 0,
    payload: { kind: 'sticky', text: 'note', color: 'yellow' },
  };
}

describe('DeskStore persistence', () => {
  let persistence: InMemoryDeskPersistence;

  beforeEach(() => {
    persistence = new InMemoryDeskPersistence();
    TestBed.configureTestingModule({
      providers: [{ provide: DESK_PERSISTENCE, useValue: persistence }],
    });
  });

  it('hydrates the stored desk over the sample floats', async () => {
    persistence.seed('default', [sticky('stored')]);
    const store = TestBed.inject(DeskStore);
    await settled();
    expect(store.floats().map((f) => f.id)).toEqual(['stored']);
  });

  it('seeds the sample desk into storage on first run', async () => {
    const store = TestBed.inject(DeskStore);
    await settled();
    expect(store.floats()).toEqual([...INITIAL_FLOATS]);
    const snapshot = await persistence.loadDesk('default');
    expect(snapshot?.objects.length).toBe(INITIAL_FLOATS.length);
  });

  it('writes inserts, updates, and removals through to storage', async () => {
    persistence.seed('default', []);
    const store = TestBed.inject(DeskStore);
    await settled();

    store.insert(sticky('a'));
    await settled();
    expect((await persistence.loadDesk('default'))?.objects.map((o) => o.id)).toEqual(['a']);

    store.update('a', { x: 99 });
    await settled();
    expect((await persistence.loadDesk('default'))?.objects[0]?.x).toBe(99);

    store.remove('a');
    await settled();
    expect((await persistence.loadDesk('default'))?.objects).toEqual([]);
  });
});

