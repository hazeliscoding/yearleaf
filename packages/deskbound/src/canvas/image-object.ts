/**
 * `<db-image-object>` — image placed on the desk, optionally framed on
 * raised paper or taped down, with a caption line.
 */

import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { DbIcon } from '../core/icon';

@Component({
  selector: 'db-image-object',
  imports: [DbIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'db-imgobj',
    '[class.db-imgobj--framed]': "frame() === 'framed'",
    '[class.db-imgobj--taped]': "frame() === 'taped'",
  },
  template: `
    @if (src(); as url) {
      <img [src]="url" [alt]="caption() || ''" [style.width.px]="width()" [style.height.px]="height()" />
    } @else {
      <div class="db-img" [style.width.px]="width()" [style.height.px]="height()">
        <db-icon name="image" [size]="18" />
      </div>
    }
    @if (caption(); as text) {
      <div class="db-img-cap">{{ text }}</div>
    }
  `,
})
export class DbImageObject {
  /** Image URL; a tinted placeholder renders while absent. */
  readonly src = input<string | null>(null);
  /** Presentation frame. */
  readonly frame = input<'borderless' | 'framed' | 'taped'>('borderless');
  /** Caption under the image. */
  readonly caption = input<string | null>(null);
  /** Rendered width in pixels. */
  readonly width = input(150);
  /** Rendered height in pixels. */
  readonly height = input(100);
}
