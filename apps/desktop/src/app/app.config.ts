/**
 * Application bootstrap configuration.
 *
 * The shell is a single-screen spatial application; no router is needed in
 * this milestone.
 */

import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';

export const appConfig: ApplicationConfig = {
  providers: [provideBrowserGlobalErrorListeners()],
};
