/**
 * Universal undo/redo stack over {@link Command} instances.
 */

import type { Command } from './commands';

/**
 * Executes commands and records them for undo/redo.
 *
 * Executing a new command clears the redo stack, matching the behavior of
 * every mainstream editing application. The history is bounded so an
 * arbitrarily long session cannot grow memory without limit.
 */
export class CommandHistory {
  private readonly undoStack: Command[] = [];
  private readonly redoStack: Command[] = [];

  /**
   * @param limit - Maximum number of undoable commands retained. Older
   *   entries are discarded first. Defaults to 200.
   */
  constructor(private readonly limit = 200) {}

  /** Number of commands currently undoable. */
  get undoDepth(): number {
    return this.undoStack.length;
  }

  /** `true` when {@link undo} would have an effect. */
  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /** `true` when {@link redo} would have an effect. */
  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Label of the command {@link undo} would revert, if any. */
  get undoLabel(): string | undefined {
    return this.undoStack[this.undoStack.length - 1]?.label;
  }

  /**
   * Executes the command and pushes it onto the undo stack.
   * Any redoable commands are discarded.
   */
  execute(command: Command): void {
    command.execute();
    this.undoStack.push(command);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack.length = 0;
  }

  /** Reverts the most recent command. No-op when nothing is undoable. */
  undo(): void {
    const command = this.undoStack.pop();
    if (!command) return;
    command.undo();
    this.redoStack.push(command);
  }

  /** Re-applies the most recently undone command. No-op when nothing is redoable. */
  redo(): void {
    const command = this.redoStack.pop();
    if (!command) return;
    command.execute();
    this.undoStack.push(command);
  }
}
