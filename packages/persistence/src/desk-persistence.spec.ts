import { describe, expect, it } from 'vitest';

import type { DeskObject } from '@infinite-desk/domain';

import { InMemoryDeskPersistence } from './desk-persistence';

function sticky(id: string): DeskObject {
  return {
    id,
    x: 0,
    y: 0,
    width: 240,
    height: 170,
    rotation: 0,
    payload: { kind: 'sticky', text: 'note', color: 'mint' },
  };
}

describe('InMemoryDeskPersistence', () => {
  it('returns null for an unknown desk', async () => {
    const store = new InMemoryDeskPersistence();
    expect(await store.loadDesk('nope')).toBeNull();
  });

  it('round-trips seeded objects', async () => {
    const store = new InMemoryDeskPersistence();
    store.seed('desk', [sticky('a'), sticky('b')]);
    const snapshot = await store.loadDesk('desk');
    expect(snapshot?.objects.map((o) => o.id)).toEqual(['a', 'b']);
  });

  it('saves into a desk that did not exist yet', async () => {
    const store = new InMemoryDeskPersistence();
    await store.saveObject('desk', sticky('a'));
    expect((await store.loadDesk('desk'))?.objects).toHaveLength(1);
  });

  it('replaces an object saved under the same id and deletes by id', async () => {
    const store = new InMemoryDeskPersistence();
    await store.saveObject('desk', sticky('a'));
    await store.saveObject('desk', { ...sticky('a'), x: 99 });
    let snapshot = await store.loadDesk('desk');
    expect(snapshot?.objects).toHaveLength(1);
    expect(snapshot?.objects[0].x).toBe(99);

    await store.deleteObject('desk', 'a');
    snapshot = await store.loadDesk('desk');
    expect(snapshot?.objects).toHaveLength(0);
  });
});
