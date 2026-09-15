/**
 * The command architecture: every meaningful mutation of desk state is a
 * {@link Command} with symmetric `execute`/`undo` behavior, executed through
 * a {@link CommandHistory}.
 *
 * Per the architecture guardrails, UI code (including canvas gestures) never
 * writes persistent object state directly — a gesture may use transient
 * state while active, but its final effect must arrive here as one command.
 */

import type { DeskObject, DeskObjectPayload } from './objects';

/** A reversible mutation of desk state. */
export interface Command {
  /** Human-readable label, e.g. for a future visible edit history. */
  readonly label: string;
  /** Applies the mutation. Must be safe to call again after {@link undo}. */
  execute(): void;
  /** Reverts exactly what {@link execute} did. */
  undo(): void;
}

/**
 * Minimal mutable store contract the object commands operate against.
 *
 * The application implements this with its signal-based stores; tests can
 * implement it with a plain `Map`. Keeping the contract this narrow keeps
 * commands renderer- and framework-independent.
 */
export interface DeskObjectStore {
  /** Returns the object with the given id, if present. */
  get(id: string): DeskObject | undefined;
  /** Inserts a new object. */
  insert(object: DeskObject): void;
  /** Removes the object with the given id. */
  remove(id: string): void;
  /** Shallow-merges the patch into the object with the given id. */
  update(id: string, patch: Partial<Omit<DeskObject, 'id'>>): void;
}

/** Adds a new object to the desk; undo removes it again. */
export class AddObjectCommand implements Command {
  readonly label: string;

  /**
   * @param store - Store the object is inserted into.
   * @param object - The fully constructed object to add.
   */
  constructor(
    private readonly store: DeskObjectStore,
    private readonly object: DeskObject,
  ) {
    this.label = `Add ${object.payload.kind}`;
  }

  execute(): void {
    this.store.insert(this.object);
  }

  undo(): void {
    this.store.remove(this.object.id);
  }
}

/** Removes an object from the desk; undo restores it. */
export class DeleteObjectCommand implements Command {
  readonly label: string;
  /** Snapshot taken at execute time so undo can restore the exact object. */
  private snapshot: DeskObject | undefined;

  /**
   * @param store - Store the object is removed from.
   * @param id - Identifier of the object to delete.
   */
  constructor(
    private readonly store: DeskObjectStore,
    private readonly id: string,
  ) {
    this.label = 'Delete object';
  }

  execute(): void {
    this.snapshot = this.store.get(this.id);
    this.store.remove(this.id);
  }

  undo(): void {
    if (this.snapshot) this.store.insert(this.snapshot);
  }
}

/**
 * Commits the final position of a moved object.
 *
 * Constructed at gesture end with both the origin and the destination, so a
 * high-frequency drag produces exactly one history entry.
 */
export class MoveObjectCommand implements Command {
  readonly label = 'Move object';

  /**
   * @param store - Store holding the object.
   * @param id - Identifier of the moved object.
   * @param from - World position when the gesture started.
   * @param to - World position when the gesture ended.
   */
  constructor(
    private readonly store: DeskObjectStore,
    private readonly id: string,
    private readonly from: { x: number; y: number },
    private readonly to: { x: number; y: number },
  ) {}

  execute(): void {
    this.store.update(this.id, { x: this.to.x, y: this.to.y });
  }

  undo(): void {
    this.store.update(this.id, { x: this.from.x, y: this.from.y });
  }
}

/**
 * Commits the final size of a resized object.
 *
 * Like {@link MoveObjectCommand}, this is constructed at gesture end so a
 * live resize produces exactly one history entry.
 */
export class ResizeObjectCommand implements Command {
  readonly label = 'Resize object';

  /**
   * @param store - Store holding the object.
   * @param id - Identifier of the resized object.
   * @param from - Size when the gesture started.
   * @param to - Size when the gesture ended.
   */
  constructor(
    private readonly store: DeskObjectStore,
    private readonly id: string,
    private readonly from: { width: number; height: number },
    private readonly to: { width: number; height: number },
  ) {}

  execute(): void {
    this.store.update(this.id, { width: this.to.width, height: this.to.height });
  }

  undo(): void {
    this.store.update(this.id, { width: this.from.width, height: this.from.height });
  }
}

/** Replaces an object's payload, e.g. after editing text or restyling. */
export class UpdatePayloadCommand implements Command {
  readonly label: string;

  /**
   * @param store - Store holding the object.
   * @param id - Identifier of the edited object.
   * @param from - Payload before the edit.
   * @param to - Payload after the edit.
   */
  constructor(
    private readonly store: DeskObjectStore,
    private readonly id: string,
    private readonly from: DeskObjectPayload,
    private readonly to: DeskObjectPayload,
  ) {
    this.label = `Edit ${to.kind}`;
  }

  execute(): void {
    this.store.update(this.id, { payload: this.to });
  }

  undo(): void {
    this.store.update(this.id, { payload: this.from });
  }
}
