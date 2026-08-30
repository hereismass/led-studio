import { describe, expect, it } from 'vitest';
import {
  calculateVisibleTimelineLabels,
  MAX_VISIBLE_TIMELINE_LABELS,
} from './timelineViewport';

describe('timeline viewport labels', () => {
  it('renders labels around the visible region with overscan', () => {
    expect(
      calculateVisibleTimelineLabels(64, 4, {
        rulerWidth: 5120,
        scrollLeft: 1600,
        viewportWidth: 800,
      }).map(({ beat }) => beat),
    ).toEqual([
      16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32,
    ]);
  });

  it('includes fractional loop endpoints when they are visible', () => {
    const labels = calculateVisibleTimelineLabels(4.25, 4, {
      rulerWidth: 480,
      scrollLeft: 0,
      viewportWidth: 480,
    });
    expect(labels.at(-1)).toEqual({ beat: 4.25, isBar: false, isEnd: true });
  });

  it('never creates an unbounded number of label elements', () => {
    const labels = calculateVisibleTimelineLabels(4096, 4, {
      rulerWidth: 1024,
      scrollLeft: 0,
      viewportWidth: Number.MAX_SAFE_INTEGER,
    });
    expect(labels).toHaveLength(MAX_VISIBLE_TIMELINE_LABELS);
  });
});
