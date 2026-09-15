/**
 * `<db-file-attachment>` — file chip with a tinted type icon and metadata.
 */

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { DbIcon } from '../core/icon';
import type { IconName } from '../icons/icon-registry';

/** Icon and tint per attachment kind. */
const KINDS: Record<string, { icon: IconName; c: string }> = {
  pdf: { icon: 'file-text', c: '--stationery-red' },
  doc: { icon: 'file-text', c: '--stationery-blue' },
  sheet: { icon: 'table-2', c: '--stationery-green' },
  link: { icon: 'link-2', c: '--stationery-teal' },
  file: { icon: 'file', c: '--stationery-olive' },
};

@Component({
  selector: 'db-file-attachment',
  imports: [DbIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'db-file' },
  template: `
    <span
      class="db-file-icon"
      [style.background]="'var(' + kindSpec().c + '-soft)'"
      [style.color]="'var(' + kindSpec().c + '-ink)'"
    >
      <db-icon [name]="kindSpec().icon" [size]="14" />
    </span>
    <span>
      <div>{{ name() }}</div>
      @if (meta(); as info) {
        <div class="db-file-meta">{{ info }}</div>
      }
    </span>
  `,
})
export class DbFileAttachment {
  /** Filename shown on the chip. */
  readonly name = input.required<string>();
  /** Attachment kind driving icon and tint. */
  readonly kind = input<'pdf' | 'doc' | 'sheet' | 'link' | 'file'>('file');
  /** Metadata line, e.g. a formatted size. */
  readonly meta = input<string | null>(null);

  /** Resolved icon/tint for the current kind. */
  protected readonly kindSpec = computed(() => KINDS[this.kind()] ?? KINDS['file']);
}
