/**
 * Signal-friendly wrapper around the domain {@link CommandHistory} so the
 * toolbar's undo/redo buttons stay reactive.
 */

import { Injectable, signal } from '@angular/core';

import { CommandHistory, type Command } from '@infinite-desk/domain';

@Injectable({ providedIn: 'root' })
export class HistoryStore {
  private readonly history = new CommandHistory();

  /** `true` when an undo is available. */
  readonly canUndo = signal(false);
  /** `true` when a redo is available. */
  readonly canRedo = signal(false);

  /** Executes a command through the history. */
  execute(command: Command): void {
    this.history.execute(command);
    this.sync();
  }

  /** Undoes the most recent command. */
  undo(): void {
    this.history.undo();
    this.sync();
  }

  /** Redoes the most recently undone command. */
  redo(): void {
    this.history.redo();
    this.sync();
  }

  /** Mirrors the history's availability flags into signals. */
  private sync(): void {
    this.canUndo.set(this.history.canUndo);
    this.canRedo.set(this.history.canRedo);
  }
}
