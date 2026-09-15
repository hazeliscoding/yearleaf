/**
 * Uniform-grid spatial index for viewport culling and hit testing.
 *
 * Rect-keyed entries are hashed into fixed-size buckets; queries touch only
 * the buckets a rect overlaps, so cost tracks local density rather than
 * total object count. Framework- and renderer-free.
 */

import type { WorldRect } from './month-layout';

/** Bucket edge length in world units; tuned to typical object sizes. */
const DEFAULT_CELL_SIZE = 512;

export class SpatialIndex {
  private readonly buckets = new Map<string, Set<string>>();
  private readonly rects = new Map<string, WorldRect>();
  /** Monotonic insertion order used to derive top-most-last hit ordering. */
  private readonly order = new Map<string, number>();
  private counter = 0;

  /**
   * @param cellSize - Bucket edge length in world units.
   */
  constructor(private readonly cellSize = DEFAULT_CELL_SIZE) {}

  /** Number of indexed entries. */
  get size(): number {
    return this.rects.size;
  }

  /** The stored rect for an id, if indexed. */
  rectOf(id: string): WorldRect | undefined {
    return this.rects.get(id);
  }

  /** Inserts (or replaces) an entry, marking it most recently added. */
  insert(id: string, rect: WorldRect): void {
    this.remove(id);
    this.rects.set(id, rect);
    this.order.set(id, this.counter++);
    for (const key of this.bucketKeys(rect)) {
      let bucket = this.buckets.get(key);
      if (!bucket) {
        bucket = new Set();
        this.buckets.set(key, bucket);
      }
      bucket.add(id);
    }
  }

  /** Moves/resizes an entry without changing its stacking order. */
  update(id: string, rect: WorldRect): void {
    const stacking = this.order.get(id);
    this.remove(id);
    this.rects.set(id, rect);
    this.order.set(id, stacking ?? this.counter++);
    for (const key of this.bucketKeys(rect)) {
      let bucket = this.buckets.get(key);
      if (!bucket) {
        bucket = new Set();
        this.buckets.set(key, bucket);
      }
      bucket.add(id);
    }
  }

  /** Removes an entry; no-op when absent. */
  remove(id: string): void {
    const rect = this.rects.get(id);
    if (!rect) return;
    for (const key of this.bucketKeys(rect)) {
      const bucket = this.buckets.get(key);
      bucket?.delete(id);
      if (bucket && bucket.size === 0) this.buckets.delete(key);
    }
    this.rects.delete(id);
    this.order.delete(id);
  }

  /** Removes every entry. */
  clear(): void {
    this.buckets.clear();
    this.rects.clear();
    this.order.clear();
  }

  /** Ids whose rects intersect the query rect, bottom-most first. */
  query(rect: WorldRect): string[] {
    const candidates = new Set<string>();
    for (const key of this.bucketKeys(rect)) {
      const bucket = this.buckets.get(key);
      if (bucket) for (const id of bucket) candidates.add(id);
    }
    const hits: string[] = [];
    for (const id of candidates) {
      const r = this.rects.get(id);
      if (r && intersects(r, rect)) hits.push(id);
    }
    return hits.sort((a, b) => (this.order.get(a) ?? 0) - (this.order.get(b) ?? 0));
  }

  /** Ids whose rects contain the point, bottom-most first (top-most last). */
  hitTest(point: { x: number; y: number }): string[] {
    return this.query({ x: point.x, y: point.y, width: 0, height: 0 }).filter((id) => {
      const r = this.rects.get(id);
      return (
        !!r &&
        point.x >= r.x &&
        point.x <= r.x + r.width &&
        point.y >= r.y &&
        point.y <= r.y + r.height
      );
    });
  }

  /** Keys of every bucket a rect overlaps. */
  private *bucketKeys(rect: WorldRect): Iterable<string> {
    const x0 = Math.floor(rect.x / this.cellSize);
    const y0 = Math.floor(rect.y / this.cellSize);
    const x1 = Math.floor((rect.x + rect.width) / this.cellSize);
    const y1 = Math.floor((rect.y + rect.height) / this.cellSize);
    for (let gx = x0; gx <= x1; gx++) {
      for (let gy = y0; gy <= y1; gy++) yield `${gx},${gy}`;
    }
  }
}

/** Axis-aligned rect intersection (touching edges count as intersecting). */
function intersects(a: WorldRect, b: WorldRect): boolean {
  return (
    a.x <= b.x + b.width &&
    b.x <= a.x + a.width &&
    a.y <= b.y + b.height &&
    b.y <= a.y + a.height
  );
}
