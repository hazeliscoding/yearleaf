import { describe, expect, it } from 'vitest';

import { SpatialIndex } from './spatial-index';

describe('SpatialIndex', () => {
  it('finds rects intersecting a query window', () => {
    const index = new SpatialIndex(100);
    index.insert('a', { x: 0, y: 0, width: 50, height: 50 });
    index.insert('b', { x: 500, y: 500, width: 50, height: 50 });
    index.insert('c', { x: 40, y: 40, width: 100, height: 100 });

    expect(index.query({ x: 0, y: 0, width: 60, height: 60 })).toEqual(['a', 'c']);
    expect(index.query({ x: 490, y: 490, width: 20, height: 20 })).toEqual(['b']);
    expect(index.query({ x: 2000, y: 2000, width: 10, height: 10 })).toEqual([]);
  });

  it('spans multiple buckets for large rects', () => {
    const index = new SpatialIndex(100);
    index.insert('wide', { x: -250, y: 0, width: 900, height: 10 });
    expect(index.query({ x: 600, y: 0, width: 10, height: 10 })).toEqual(['wide']);
    expect(index.query({ x: -240, y: 0, width: 5, height: 5 })).toEqual(['wide']);
  });

  it('hit-tests points with top-most entries last', () => {
    const index = new SpatialIndex(100);
    index.insert('bottom', { x: 0, y: 0, width: 100, height: 100 });
    index.insert('top', { x: 25, y: 25, width: 100, height: 100 });
    expect(index.hitTest({ x: 50, y: 50 })).toEqual(['bottom', 'top']);
    expect(index.hitTest({ x: 10, y: 10 })).toEqual(['bottom']);
    expect(index.hitTest({ x: 300, y: 300 })).toEqual([]);
  });

  it('update moves an entry without changing its stacking order', () => {
    const index = new SpatialIndex(100);
    index.insert('bottom', { x: 0, y: 0, width: 100, height: 100 });
    index.insert('top', { x: 0, y: 0, width: 100, height: 100 });
    index.update('bottom', { x: 10, y: 10, width: 100, height: 100 });
    expect(index.hitTest({ x: 50, y: 50 })).toEqual(['bottom', 'top']);
    expect(index.hitTest({ x: 5, y: 5 })).toEqual(['top']);
  });

  it('remove and clear drop entries and empty buckets', () => {
    const index = new SpatialIndex(100);
    index.insert('a', { x: 0, y: 0, width: 10, height: 10 });
    index.remove('a');
    expect(index.size).toBe(0);
    expect(index.hitTest({ x: 5, y: 5 })).toEqual([]);

    index.insert('b', { x: 0, y: 0, width: 10, height: 10 });
    index.clear();
    expect(index.size).toBe(0);
  });

  it('handles negative coordinates', () => {
    const index = new SpatialIndex(100);
    index.insert('neg', { x: -500, y: -500, width: 50, height: 50 });
    expect(index.hitTest({ x: -480, y: -480 })).toEqual(['neg']);
  });
});
