/**
 * `<db-icon>` — renders a Lucide glyph from the Deskbound icon registry.
 */

import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  input,
} from '@angular/core';

import { iconNodeFor, renderIconNode, type IconName } from '../icons/icon-registry';

/**
 * Inline icon.
 *
 * The SVG is created imperatively from registry data so the component
 * needs no innerHTML sanitization and no icon font.
 */
@Component({
  selector: 'db-icon',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    style: 'display:inline-flex;align-items:center;justify-content:center;flex:none',
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
  },
})
export class DbIcon {
  /** Kebab-case icon name, e.g. `"sticky-note"`. */
  readonly name = input.required<IconName>();
  /** Rendered size in pixels. */
  readonly size = input(16);

  constructor() {
    const host = inject(ElementRef).nativeElement as HTMLElement;
    effect(() => {
      host.replaceChildren();
      const node = iconNodeFor(this.name());
      if (node) host.appendChild(renderIconNode(node, this.size()));
    });
  }
}
