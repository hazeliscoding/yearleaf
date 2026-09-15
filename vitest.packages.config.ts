import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for the framework-free workspace packages
 * (`@infinite-desk/domain`, `@infinite-desk/canvas`, `@infinite-desk/persistence`).
 *
 * The Angular application (`apps/desktop`) runs its own Vitest through
 * `ng test`; this config only covers pure TypeScript package sources.
 */
export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.spec.ts'],
    environment: 'node',
  },
});
