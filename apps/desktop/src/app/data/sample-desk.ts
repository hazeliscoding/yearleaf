/**
 * The lived-in September 2026 sample desk from the design reference.
 *
 * This seeds the first milestone (there is no SQLite adapter yet); it is
 * deliberately dense so canvas work is exercised against realistic content,
 * per the testing strategy's "lived-in desks" requirement.
 */

import type {
  DeskObject,
  EventItem,
  RangeSegment,
  TaskItem,
} from '@infinite-desk/domain';
import type { DbLayer, DbPaletteGroup } from '@infinite-desk/deskbound';

/** Everything the month sheet renders inside one day cell. */
export interface DayContent {
  readonly events?: readonly EventItem[];
  readonly tasks?: readonly TaskItem[];
  readonly range?: RangeSegment;
  /** Handwritten scribble shown in the handwriting typeface. */
  readonly hand?: string;
  /** Caption of a small taped photo in the cell. */
  readonly img?: string;
}

/** Day-of-month → cell content for September 2026. */
export const MONTH_CONTENT: Readonly<Record<number, DayContent>> = {
  1: { tasks: [{ label: 'Pay electric bill', due: '1st' }] },
  2: { events: [{ time: '10:00', title: 'Studio day', color: 'violet' }] },
  3: { hand: 'call Mom' },
  4: {
    tasks: [{ label: 'Send invoice', due: '4th', priority: 'high' }],
    hand: 'start zine spreads',
  },
  5: { img: 'trail run' },
  8: {
    events: [
      { time: '09:30', title: 'Client review', color: 'blue', recurring: true },
      { time: '18:00', title: 'Ceramics class', color: 'olive' },
    ],
  },
  10: { events: [{ time: '20:00', title: 'Nils Frahm', color: 'rose' }] },
  11: { events: [{ title: 'Zine deadline', color: 'red', variant: 'allday' }] },
  12: { img: 'ref shot' },
  14: { events: [{ time: '09:30', title: 'Client review', color: 'blue', recurring: true }] },
  15: {
    events: [
      { time: '14:00', title: 'Dentist', color: 'teal', variant: 'tentative', reminder: true },
    ],
    tasks: [{ label: 'Order paper stock' }],
  },
  17: { range: { kind: 'travel', label: 'Kyoto →', edge: 'start' } },
  18: {
    range: { kind: 'travel', label: '', edge: 'middle' },
    events: [{ title: 'Anniversary', color: 'coral', variant: 'allday' }],
  },
  19: { range: { kind: 'travel', label: '', edge: 'end' } },
  20: { events: [{ time: '19:00', title: 'Game night', color: 'indigo' }] },
  21: { range: { kind: 'deadline', label: 'Print run', edge: 'start' } },
  22: {
    range: { kind: 'deadline', label: '', edge: 'end' },
    events: [{ time: '09:30', title: 'Client review', color: 'blue', recurring: true }],
  },
  23: { hand: 'don’t schedule anything here' },
  25: { events: [{ time: '19:30', title: 'Print fair opening', color: 'rose' }] },
  26: { events: [{ title: 'Hike — Mt. Tam', color: 'green', variant: 'allday' }] },
  28: { events: [{ time: '09:00', title: 'Deploy website', color: 'teal' }] },
  29: { events: [{ time: '08:00', title: 'Morning pages', color: 'olive', variant: 'completed' }] },
  30: { tasks: [{ label: 'Finish book', due: '30th' }] },
};

/** Freely positioned objects on the desk beside the month sheet. */
export const INITIAL_FLOATS: readonly DeskObject[] = [
  {
    id: 's1',
    x: 1120,
    y: 56,
    rotation: 0,
    payload: {
      kind: 'sticky',
      text: 'call the framer about the print — thu?',
      color: 'yellow',
      hand: true,
      pinned: true,
    },
  },
  {
    id: 's2',
    x: 1150,
    y: 250,
    rotation: -1.5,
    payload: {
      kind: 'sticky',
      text: '',
      color: 'mint',
      items: [
        { label: 'Water plants', done: true },
        { label: 'Book flights' },
        { label: 'Renew passport' },
      ],
    },
  },
  {
    id: 's3',
    x: 1118,
    y: 432,
    rotation: 1,
    payload: {
      kind: 'sticky',
      text: 'order flowers before the 18th',
      color: 'coral',
      hand: true,
      compact: true,
    },
  },
  {
    id: 'img1',
    x: 1130,
    y: 560,
    rotation: 0,
    payload: { kind: 'image', frame: 'taped', caption: 'moodboard' },
  },
  {
    id: 'f1',
    x: 1140,
    y: 760,
    rotation: 0,
    payload: { kind: 'file', fileKind: 'pdf', name: 'Fair-floorplan.pdf', meta: '1.2 MB' },
  },
  {
    id: 't1',
    x: 120,
    y: 840,
    rotation: 0,
    payload: { kind: 'text', text: 'don’t forget: fair setup starts the 24th' },
  },
];

/** Layer rows for the floating layer panel. */
export const INITIAL_LAYERS: readonly DbLayer[] = [
  { name: 'Work', color: 'indigo' },
  { name: 'Personal', color: 'coral' },
  { name: 'Notes', color: 'yellow' },
  { name: 'Handwriting', color: 'olive', locked: true },
  { name: 'Photos', color: 'teal', visible: false },
];

/** One row of the universal search index. */
export interface SearchEntry {
  /** Result label. */
  readonly label: string;
  /** Secondary metadata (date, size, source). */
  readonly meta: string;
  /** Color-dot CSS value. */
  readonly dot: string;
  /** Day of September 2026 the result jumps to. */
  readonly day: number;
  /** Extra keywords matched besides the label. */
  readonly kw: string;
}

/** Static search index over the sample desk (events, notes, OCR, files). */
export const SEARCH_INDEX: readonly SearchEntry[] = [
  { label: 'Dentist — Dr. Okada', meta: 'Tue Sep 15 · 14:00', dot: 'var(--stationery-teal)', day: 15, kw: 'dentist okada appointment' },
  { label: 'Zine deadline', meta: 'Fri Sep 11 · all day', dot: 'var(--stationery-red)', day: 11, kw: 'zine deadline print' },
  { label: 'Kyoto trip', meta: 'Sep 17–19', dot: 'var(--stationery-teal)', day: 17, kw: 'kyoto trip travel japan' },
  { label: 'Print fair opening', meta: 'Fri Sep 25 · 19:30', dot: 'var(--stationery-rose)', day: 25, kw: 'print fair opening' },
  { label: '“call the framer about the print — thu?”', meta: 'Sticky note · OCR', dot: 'var(--stationery-yellow)', day: 24, kw: 'framer print sticky call' },
  { label: '“don’t schedule anything here”', meta: 'Handwriting · Sep 23', dot: 'var(--stationery-olive)', day: 23, kw: 'schedule handwriting note dont' },
  { label: 'Fair-floorplan.pdf', meta: 'Attachment · 1.2 MB', dot: 'var(--stationery-indigo)', day: 25, kw: 'fair floorplan pdf file' },
  { label: 'Anniversary', meta: 'Fri Sep 18', dot: 'var(--stationery-coral)', day: 18, kw: 'anniversary flowers' },
  { label: 'Concert — Nils Frahm', meta: 'Thu Sep 10 · 20:00', dot: 'var(--stationery-rose)', day: 10, kw: 'concert music nils frahm' },
  { label: 'Deploy website', meta: 'Mon Sep 28 · 09:00', dot: 'var(--stationery-teal)', day: 28, kw: 'deploy website launch' },
];

/** Command palette content. */
export const PALETTE_GROUPS: readonly DbPaletteGroup[] = [
  {
    label: 'Go to',
    items: [
      { icon: 'calendar', label: 'Next Friday', meta: 'Sep 18, 2026', selected: true },
      { icon: 'calendar', label: 'Today', meta: 'Sep 15, 2026', shortcut: ['⇧', 'T'] },
      { icon: 'calendar', label: 'October 2026' },
    ],
  },
  {
    label: 'Commands',
    items: [
      { icon: 'sticky-note', label: 'New sticky note', shortcut: ['N'] },
      { icon: 'calendar-plus', label: 'New event', shortcut: ['E'] },
      { icon: 'zoom-in', label: 'Fit month', shortcut: ['⇧', '1'] },
      { icon: 'layers-2', label: 'Toggle layer: Photos' },
    ],
  },
  {
    label: 'Recent',
    items: [{ icon: 'history', label: 'Jump to Kyoto trip', meta: 'Sep 17–19' }],
  },
];

/** A positioned, expanded event block on the week sheet. */
export interface WeekBlock {
  /** Week column (0 = Monday). */
  readonly col: number;
  /** Start hour as a decimal, e.g. `9.5` for 09:30. */
  readonly hour: number;
  readonly event: EventItem & { readonly meta: string };
}

/** Expanded event blocks for the week of Sep 14–20. */
export const WEEK_BLOCKS: readonly WeekBlock[] = [
  { col: 0, hour: 9.5, event: { time: '09:30', title: 'Client review', color: 'blue', recurring: true, meta: '45 min · video' } },
  { col: 1, hour: 14, event: { time: '14:00', title: 'Dentist', color: 'teal', variant: 'tentative', reminder: true, meta: 'Dr. Okada' } },
  { col: 2, hour: 18, event: { time: '18:00', title: 'Ceramics class', color: 'olive', meta: 'Studio B' } },
  { col: 4, hour: 19, event: { time: '19:00', title: 'Anniversary dinner', color: 'coral', meta: 'table for two' } },
  { col: 5, hour: 9, event: { time: '09:00', title: 'Hike — Mt. Tam', color: 'green', meta: 'trailhead 8:40' } },
];

/** Tasks listed on the day page. */
export const DAY_TASKS: readonly TaskItem[] = [
  { label: 'Order paper stock', priority: 'high' },
  { label: 'Send files to printer', due: 'by 5pm' },
  { label: 'Reply to fair organizers', done: true },
];
