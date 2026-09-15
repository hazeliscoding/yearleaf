import { describe, expect, it } from 'vitest';

import {
  AddObjectCommand,
  DeleteObjectCommand,
  MoveObjectCommand,
  ResizeObjectCommand,
  UpdatePayloadCommand,
  type DeskObjectStore,
} from './commands';
import { CommandHistory } from './history';
import type { DeskObject } from './objects';

/** Plain-Map store implementation used to exercise commands without the app. */
function makeStore(): DeskObjectStore & { objects: Map<string, DeskObject> } {
  const objects = new Map<string, DeskObject>();
  return {
    objects,
    get: (id) => objects.get(id),
    insert: (object) => void objects.set(object.id, object),
    remove: (id) => void objects.delete(id),
    update: (id, patch) => {
      const existing = objects.get(id);
      if (existing) objects.set(id, { ...existing, ...patch });
    },
  };
}

function sticky(id: string, x = 0, y = 0): DeskObject {
  return {
    id,
    x,
    y,
    width: 240,
    height: 170,
    rotation: 0,
    payload: { kind: 'sticky', text: 'hi', color: 'yellow' },
  };
}

describe('CommandHistory', () => {
  it('executes, undoes, and redoes an add command', () => {
    const store = makeStore();
    const history = new CommandHistory();

    history.execute(new AddObjectCommand(store, sticky('a')));
    expect(store.objects.has('a')).toBe(true);
    expect(history.canUndo).toBe(true);

    history.undo();
    expect(store.objects.has('a')).toBe(false);
    expect(history.canRedo).toBe(true);

    history.redo();
    expect(store.objects.has('a')).toBe(true);
  });

  it('collapses a drag into a single move command with exact undo', () => {
    const store = makeStore();
    const history = new CommandHistory();
    store.insert(sticky('a', 10, 20));

    history.execute(new MoveObjectCommand(store, 'a', { x: 10, y: 20 }, { x: 300, y: 400 }));
    expect(store.get('a')).toMatchObject({ x: 300, y: 400 });

    history.undo();
    expect(store.get('a')).toMatchObject({ x: 10, y: 20 });
  });

  it('collapses a resize into a single command with exact undo', () => {
    const store = makeStore();
    const history = new CommandHistory();
    store.insert(sticky('a'));

    history.execute(
      new ResizeObjectCommand(store, 'a', { width: 240, height: 170 }, { width: 320, height: 260 }),
    );
    expect(store.get('a')).toMatchObject({ width: 320, height: 260 });

    history.undo();
    expect(store.get('a')).toMatchObject({ width: 240, height: 170 });
  });

  it('restores a deleted object on undo', () => {
    const store = makeStore();
    const history = new CommandHistory();
    store.insert(sticky('a', 5, 6));

    history.execute(new DeleteObjectCommand(store, 'a'));
    expect(store.objects.has('a')).toBe(false);

    history.undo();
    expect(store.get('a')).toMatchObject({ x: 5, y: 6 });
  });

  it('swaps payloads on payload update and undo', () => {
    const store = makeStore();
    const history = new CommandHistory();
    const before = sticky('a');
    store.insert(before);
    const after = { ...before.payload, text: 'edited' };

    history.execute(new UpdatePayloadCommand(store, 'a', before.payload, after));
    expect(store.get('a')?.payload).toMatchObject({ text: 'edited' });

    history.undo();
    expect(store.get('a')?.payload).toMatchObject({ text: 'hi' });
  });

  it('clears the redo stack when a new command executes', () => {
    const store = makeStore();
    const history = new CommandHistory();

    history.execute(new AddObjectCommand(store, sticky('a')));
    history.undo();
    history.execute(new AddObjectCommand(store, sticky('b')));
    expect(history.canRedo).toBe(false);
  });

  it('discards the oldest entries beyond the history limit', () => {
    const store = makeStore();
    const history = new CommandHistory(2);

    history.execute(new AddObjectCommand(store, sticky('a')));
    history.execute(new AddObjectCommand(store, sticky('b')));
    history.execute(new AddObjectCommand(store, sticky('c')));

    expect(history.undoDepth).toBe(2);
    history.undo();
    history.undo();
    expect(history.canUndo).toBe(false);
    // 'a' remains because its command fell off the bounded stack.
    expect(store.objects.has('a')).toBe(true);
  });
});
