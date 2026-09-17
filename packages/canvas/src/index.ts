/**
 * `@infinite-desk/canvas` — the spatial workspace: deterministic
 * date/world layout, viewport math, spatial index, and the PixiJS scene.
 *
 * Only plain data crosses this package's boundary — PixiJS display objects
 * never leak to the application (see docs/design-canvas-renderer.md).
 */

export * from './month-layout';
export * from './viewport';
export * from './spatial-index';
export * from './sticky-layout';
export * from './scene/scene-types';
export { IMAGE_CAPTION_HEIGHT } from './scene/object-view';
export * from './scene/scene-controller';
