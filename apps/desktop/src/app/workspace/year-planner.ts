/**
 * The 2026 year planner: twelve mini-month grids with marked days and a
 * handwritten margin note; clicking a month zooms to the month tier.
 */

import { ChangeDetectionStrategy, Component, output } from '@angular/core';

import { buildMonthGrid } from '@infinite-desk/domain';

/** A mini-grid day cell with its highlight colors. */
interface MiniCell {
  readonly day: number | '';
  readonly bg: string;
  readonly color: string;
}

/** A mini month: name, title color, and its day cells. */
interface MiniMonth {
  readonly name: string;
  readonly titleColor: string;
  readonly cells: readonly MiniCell[];
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Resolves the highlight for one day of the sample year. */
function highlight(month: number, day: number): { bg: string; color: string } {
  if (month === 8 && day === 15) return { bg: 'var(--accent)', color: 'var(--ink-inverse)' };
  if (month === 8 && day >= 17 && day <= 19)
    return { bg: 'var(--stationery-teal-soft)', color: 'var(--stationery-teal-ink)' };
  if (month === 8 && day === 11)
    return { bg: 'var(--stationery-red-soft)', color: 'var(--stationery-red-ink)' };
  if (month === 8 && day === 25)
    return { bg: 'var(--stationery-rose-soft)', color: 'var(--stationery-rose-ink)' };
  if (month === 11 && day >= 24)
    return { bg: 'var(--stationery-yellow-soft)', color: 'var(--stationery-yellow-ink)' };
  return { bg: 'transparent', color: 'var(--ink-secondary)' };
}

@Component({
  selector: 'app-year-planner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-screen-label': 'Year planner',
    style:
      'position:absolute;left:48px;top:24px;width:1080px;display:block;background:var(--surface-paper);border:1px solid var(--border);box-shadow:var(--shadow-1);padding:22px 26px 26px;box-sizing:border-box',
  },
  template: `
    <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:16px">
      <span style="font:600 34px var(--font-calendar)">2026</span>
      <span
        style="font:var(--text-caption);color:var(--ink-muted);text-transform:uppercase;letter-spacing:var(--tracking-metadata)"
        >Year planner</span
      >
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:20px 24px">
      @for (month of months; track month.name) {
        <div
          style="cursor:pointer;padding:8px;border-radius:var(--radius-subtle)"
          (click)="monthPicked.emit(); $event.stopPropagation()"
        >
          <div
            style="font:600 14px var(--font-calendar);margin-bottom:5px"
            [style.color]="month.titleColor"
          >
            {{ month.name }}
          </div>
          <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:1px">
            @for (cell of month.cells; track $index) {
              <span
                style="height:16px;display:flex;align-items:center;justify-content:center;font:10px var(--font-calendar);font-variant-numeric:tabular-nums;border-radius:2px"
                [style.background]="cell.bg"
                [style.color]="cell.color"
                >{{ cell.day }}</span
              >
            }
          </div>
        </div>
      }
    </div>
    <div
      style="position:absolute;right:34px;top:290px;transform:rotate(-2deg);font-family:var(--font-hand);font-size:20px;color:var(--accent)"
    >
      Kyoto! ↴
    </div>
  `,
})
export class YearPlanner {
  /** Emits when a mini month is clicked (zooms to the month tier). */
  readonly monthPicked = output<void>();

  /** All twelve mini months, built from the shared month-grid math. */
  protected readonly months: readonly MiniMonth[] = MONTH_NAMES.map((name, m) => ({
    name,
    titleColor: m === 8 ? 'var(--accent)' : 'var(--ink-primary)',
    cells: buildMonthGrid(2026, m).map((cell) =>
      cell.inMonth
        ? { day: cell.day, ...highlight(m, cell.day) }
        : { day: '' as const, bg: 'transparent', color: 'transparent' },
    ),
  }));
}
