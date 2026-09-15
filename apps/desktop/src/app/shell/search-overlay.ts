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

import { SEARCH_INDEX } from '../data/sample-desk';

@Component({
  selector: 'app-search-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-screen-label': 'Search overlay',
    style:
      'position:absolute;inset:0;background:rgba(43,40,34,.18);display:flex;justify-content:center;padding-top:64px;z-index:700',
    '(click)': 'closed.emit()',
  },
  template: `
    <div
      style="align-self:flex-start;width:520px;background:var(--surface-raised);border:1px solid var(--border);border-radius:var(--radius-soft);box-shadow:var(--shadow-4);overflow:hidden"
      (click)="$event.stopPropagation()"
    >
      <input
        #queryInput
        aria-label="Search"
        placeholder="Search everything on this desk…"
        style="width:100%;box-sizing:border-box;border:none;outline:none;background:transparent;padding:14px 16px;font:15px var(--font-ui);color:var(--ink-primary);border-bottom:1px solid var(--border)"
        [value]="query()"
        (input)="query.set($any($event.target).value)"
        (keydown.enter)="jumpFirst()"
      />
      <div style="max-height:340px;overflow:auto;padding:6px">
        @for (result of results(); track result.label) {
          <div
            style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:var(--radius-subtle);cursor:pointer"
            (click)="jumped.emit(result.day)"
          >
            <span style="width:8px;height:8px;border-radius:50%;flex:none" [style.background]="result.dot"></span>
            <span style="flex:1;font:14px var(--font-ui);color:var(--ink-primary)">{{ result.label }}</span>
            <span style="font:var(--text-caption);color:var(--ink-muted);font-variant-numeric:tabular-nums">{{
              result.meta
            }}</span>
          </div>
        } @empty {
          <div style="padding:18px 10px;font:13px var(--font-ui);color:var(--ink-muted)">
            Nothing on the desk matches that — yet.
          </div>
        }
      </div>
      <div style="padding:8px 16px;border-top:1px solid var(--border);font:var(--text-caption);color:var(--ink-muted)">
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
