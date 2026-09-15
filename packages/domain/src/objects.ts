/**
 * The desk object model: freely positioned spatial objects that share the
 * workspace with the calendar sheets.
 *
 * This mirrors the `calendar_object` record from the architecture decision
 * document — shared identity/geometry fields plus a typed payload — scoped
 * to the object kinds the first milestone renders.
 */

/** Stationery palette color names defined by the Deskbound design system. */
export type StationeryColor =
  | 'yellow'
  | 'coral'
  | 'rose'
  | 'red'
  | 'orange'
  | 'olive'
  | 'green'
  | 'mint'
  | 'teal'
  | 'blue'
  | 'indigo'
  | 'violet'
  | 'lavender';

/** A single checklist entry inside a sticky note. */
export interface ChecklistItem {
  /** Visible checklist text. */
  readonly label: string;
  /** `true` once the item has been ticked off. */
  readonly done?: boolean;
}

/** Payload for a paper sticky note. */
export interface StickyPayload {
  readonly kind: 'sticky';
  /** Free text; ignored when {@link items} is present. */
  text: string;
  /** Stationery fill color. */
  color: StationeryColor;
  /** Render the text in the handwriting typeface. */
  hand?: boolean;
  /** Show the red push-pin marker. */
  pinned?: boolean;
  /** Compact (small) note variant. */
  compact?: boolean;
  /** Checklist entries; replaces free text when set. */
  items?: ChecklistItem[];
}

/** Payload for an imported image placed on the desk. */
export interface ImagePayload {
  readonly kind: 'image';
  /** Presentation frame around the image. */
  frame: 'borderless' | 'framed' | 'taped';
  /** Caption shown under the image. */
  caption: string;
}

/** Payload for a file attachment chip. */
export interface FilePayload {
  readonly kind: 'file';
  /** Attachment type used to pick icon and tint. */
  fileKind: 'pdf' | 'doc' | 'sheet' | 'link' | 'file';
  /** Original filename shown on the chip. */
  name: string;
  /** Secondary metadata line, e.g. a formatted size. */
  meta: string;
}

/** Payload for a freeform text object written directly on the canvas. */
export interface TextPayload {
  readonly kind: 'text';
  /** The text content. */
  text: string;
  /** `true` while the object is a freshly created, still-editing draft. */
  draft?: boolean;
}

/** Union of all typed object payloads. */
export type DeskObjectPayload = StickyPayload | ImagePayload | FilePayload | TextPayload;

/** Discriminator values of {@link DeskObjectPayload}. */
export type DeskObjectKind = DeskObjectPayload['kind'];

/**
 * A freely positioned object on the desk.
 *
 * Geometry lives in world coordinates (see `@infinite-desk/canvas` for the
 * world/date mapping); the payload carries kind-specific content.
 */
export interface DeskObject {
  /** Stable unique identifier; never reused. */
  readonly id: string;
  /** World-space X of the object's top-left corner. */
  x: number;
  /** World-space Y of the object's top-left corner. */
  y: number;
  /** Rotation in degrees, applied around the object's own origin. */
  rotation: number;
  /** Kind-specific content. */
  payload: DeskObjectPayload;
}

/** A timed or all-day event shown inside a calendar cell. */
export interface EventItem {
  /** Event title. */
  readonly title: string;
  /** Start time (`HH:mm`); omitted for all-day events. */
  readonly time?: string;
  /** Stationery color of the event chip. */
  readonly color: StationeryColor;
  /** Visual/status variant of the chip. */
  readonly variant?: 'timed' | 'allday' | 'tentative' | 'completed';
  /** Show the recurrence glyph. */
  readonly recurring?: boolean;
  /** Show the reminder glyph. */
  readonly reminder?: boolean;
}

/** A checklist task pinned to a day. */
export interface TaskItem {
  /** Task text. */
  readonly label: string;
  /** Completion state. */
  readonly done?: boolean;
  /** Free-text due hint, e.g. `"by 5pm"`. */
  readonly due?: string;
  /** Priority dot color mapping. */
  readonly priority?: 'high' | 'med' | 'low';
}

/** One day's segment of a multi-day range bar. */
export interface RangeSegment {
  /** Range category; controls color and icon. */
  readonly kind: 'vacation' | 'project' | 'travel' | 'deadline';
  /** Label shown on this segment (usually only on the first day). */
  readonly label: string;
  /** Position of the segment within its range. */
  readonly edge: 'start' | 'middle' | 'end';
}
