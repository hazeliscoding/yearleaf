/**
 * Universal search overlay: filters the desk's search index (events,
 * notes, handwriting OCR, files, dates) and jumps to the picked result.
 */

import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  output,
  signal,
  viewChild,
} from '@angular/core';

import { DbIcon } from '@infinite-desk/deskbound';

import { SEARCH_INDEX } from '../data/sample-desk';

@Component({
  selector: 'app-search-overlay',
  imports: [DbIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-screen-label': 'Search overlay',
    style:
      'position:absolute;inset:0;background:var(--scrim,rgba(43,40,34,.18));display:flex;justify-content:center;padding-top:64px;z-index:var(--z-palette,700)',
    '(click)': 'closed.emit()',
  },
  template: `
    <!-- Shares the command palette's chrome classes: the two overlays are
         siblings in the same state and must not drift in width, dividers or
         row behaviour. -->
    <div class="db-palette" style="align-self:flex-start" (click)="$event.stopPropagation()">
      <div class="db-palette-input">
        <db-icon name="search" [size]="15" />
        <input
          #queryInput
          aria-label="Search"
          placeholder="Search everything on this desk…"
          [value]="query()"
          (input)="query.set($any($event.target).value)"
          (keydown.enter)="jumpFirst()"
        />
      </div>
      <div style="max-height:320px;overflow-y:auto;padding-bottom:6px">
        @for (result of results(); track result.label; let first = $first) {
          <!-- The first row is marked selected because Enter jumps to it. -->
          <div class="db-palette-item" [attr.data-sel]="first" (click)="jumped.emit(result.day)">
            <span style="width:8px;height:8px;border-radius:50%;flex:none" [style.background]="result.dot"></span>
            <span>{{ result.label }}</span>
            <span class="db-grow"></span>
            <span class="db-pal-meta" style="font-variant-numeric:tabular-nums">{{ result.meta }}</span>
          </div>
        } @empty {
          <div style="padding:18px 14px;font:var(--text-body-small);color:var(--ink-muted)">
            Nothing on the desk matches that — yet.
          </div>
        }
      </div>
      <div style="padding:8px 14px;border-top:1px solid var(--divider);font:var(--text-caption);color:var(--ink-muted)">
        Searches events, notes, handwriting (OCR), files and dates · Enter jumps to result
      </div>
    </div>
  `,
})
export class SearchOverlay {
  /** Emits when the overlay should close (scrim click / Escape upstream). */
  readonly closed = output<void>();
  /** Emits the September day to jump to. */
  readonly jumped = output<number>();

  /** Live query text. */
  protected readonly query = signal('');

  /** Index rows matching the query (top 7, like the design reference). */
  protected readonly results = computed(() => {
    const q = this.query().trim().toLowerCase();
    return SEARCH_INDEX.filter(
      (r) => !q || `${r.label} ${r.kw}`.toLowerCase().includes(q),
    ).slice(0, 7);
  });

  private readonly queryInput = viewChild.required<ElementRef<HTMLInputElement>>('queryInput');

  constructor() {
    afterNextRender(() => this.queryInput().nativeElement.focus());
  }

  /** Enter jumps to the top result. */
  protected jumpFirst(): void {
    const first = this.results()[0];
    if (first) this.jumped.emit(first.day);
  }
}
