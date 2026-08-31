import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

export const TIMELINE_LABEL_GUTTER = 132;
export const MAX_VISIBLE_TIMELINE_LABELS = 128;

export interface TimelineLabel {
  beat: number;
  isBar: boolean;
  isEnd: boolean;
}

export interface TimelineViewport {
  rulerWidth: number;
  scrollLeft: number;
  viewportWidth: number;
}

export interface TimelineBeatRange {
  endBeat: number;
  startBeat: number;
}

export function calculateVisibleBeatRange(
  loopLengthBeats: number,
  viewport: TimelineViewport,
  overscanBeats = 2,
): TimelineBeatRange {
  if (
    viewport.viewportWidth <= 0 ||
    viewport.rulerWidth <= TIMELINE_LABEL_GUTTER
  )
    return { endBeat: loopLengthBeats, startBeat: 0 };
  const trackWidth = Math.max(1, viewport.rulerWidth - TIMELINE_LABEL_GUTTER);
  const startBeat =
    ((viewport.scrollLeft - TIMELINE_LABEL_GUTTER) / trackWidth) *
    loopLengthBeats;
  const endBeat =
    ((viewport.scrollLeft + viewport.viewportWidth - TIMELINE_LABEL_GUTTER) /
      trackWidth) *
    loopLengthBeats;
  return {
    endBeat: Math.min(loopLengthBeats, endBeat + overscanBeats),
    startBeat: Math.max(0, startBeat - overscanBeats),
  };
}

export function timelineSnapStep(
  snap: 0.25 | 0.5 | 1 | 'bar',
  numerator: number,
): number {
  return snap === 'bar' ? numerator : snap;
}

export function snapTimelineBeat(
  beat: number,
  snap: 0.25 | 0.5 | 1 | 'bar',
  numerator: number,
): number {
  const step = timelineSnapStep(snap, numerator);
  return Math.round(beat / step) * step;
}

export function calculateVisibleTimelineLabels(
  loopLengthBeats: number,
  numerator: number,
  viewport: TimelineViewport,
): TimelineLabel[] {
  const range = calculateVisibleBeatRange(loopLengthBeats, viewport);
  const firstBeat = Math.max(0, Math.floor(range.startBeat));
  const lastBeat = Math.min(loopLengthBeats, Math.ceil(range.endBeat));
  const labels: TimelineLabel[] = [];

  for (
    let beat = firstBeat;
    beat <= Math.floor(lastBeat) && labels.length < MAX_VISIBLE_TIMELINE_LABELS;
    beat += 1
  ) {
    labels.push({
      beat,
      isBar: beat % numerator === 0,
      isEnd: beat === loopLengthBeats,
    });
  }

  if (
    loopLengthBeats >= firstBeat &&
    loopLengthBeats <= lastBeat &&
    labels.at(-1)?.beat !== loopLengthBeats &&
    labels.length < MAX_VISIBLE_TIMELINE_LABELS
  ) {
    labels.push({ beat: loopLengthBeats, isBar: false, isEnd: true });
  }

  return labels;
}

export function useTimelineViewport(
  scrollRef: RefObject<HTMLDivElement | null>,
  rulerRef: RefObject<HTMLDivElement | null>,
) {
  const frameRef = useRef<number | null>(null);
  const [viewport, setViewport] = useState<TimelineViewport>({
    rulerWidth: 1024,
    scrollLeft: 0,
    viewportWidth: 1024,
  });

  const measure = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const scroll = scrollRef.current;
      const ruler = rulerRef.current;
      if (!scroll || !ruler) return;
      const next = {
        rulerWidth: ruler.getBoundingClientRect().width,
        scrollLeft: scroll.scrollLeft,
        viewportWidth: scroll.clientWidth,
      };
      setViewport((current) =>
        current.rulerWidth === next.rulerWidth &&
        current.scrollLeft === next.scrollLeft &&
        current.viewportWidth === next.viewportWidth
          ? current
          : next,
      );
    });
  }, [rulerRef, scrollRef]);

  useLayoutEffect(() => {
    measure();
    const scroll = scrollRef.current;
    const ruler = rulerRef.current;
    if (!scroll || !ruler) return;
    scroll.addEventListener('scroll', measure, { passive: true });
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => measure());
    observer?.observe(scroll);
    observer?.observe(ruler);
    return () => {
      scroll.removeEventListener('scroll', measure);
      observer?.disconnect();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [measure, rulerRef, scrollRef]);

  return viewport;
}
