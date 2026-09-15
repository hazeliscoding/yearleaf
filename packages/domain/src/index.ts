/**
 * `@infinite-desk/domain` — entities, calendar math, and the command/undo
 * architecture. Framework-free by design: nothing in this package may import
 * Angular, PixiJS, or persistence concerns.
 */

export * from './calendar';
export * from './objects';
export * from './commands';
export * from './history';
