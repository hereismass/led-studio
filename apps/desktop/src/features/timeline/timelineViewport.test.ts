import { describe, expect, it } from 'vitest';
import {
  calculateVisibleBeatRange,
  calculateVisibleTimelineLabels,
  MAX_VISIBLE_TIMELINE_LABELS,
  snapTimelineBeat,
  timelineSnapStep,
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

  it('calculates an overscanned visible beat range', () => {
    expect(
      calculateVisibleBeatRange(64, {
        rulerWidth: 5252,
        scrollLeft: 1732,
        viewportWidth: 800,
      }),
    ).toEqual({ endBeat: 32, startBeat: 18 });
    expect(
      calculateVisibleBeatRange(4, {
        rulerWidth: 0,
        scrollLeft: 0,
        viewportWidth: 0,
      }),
    ).toEqual({ endBeat: 4, startBeat: 0 });
  });

  it('snaps to musical subdivisions and bar boundaries', () => {
    expect(timelineSnapStep('bar', 3)).toBe(3);
    expect(snapTimelineBeat(1.37, 0.25, 4)).toBe(1.25);
    expect(snapTimelineBeat(3.1, 'bar', 3)).toBe(3);
  });
});
