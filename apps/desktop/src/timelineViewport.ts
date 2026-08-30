import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

export const TIMELINE_LABEL_GUTTER = 132;
export const TIMELINE_PIXELS_PER_BEAT = 80;
export const MAX_VISIBLE_TIMELINE_LABELS = 128;

export interface TimelineLabel {
  beat: number;
  isBar: boolean;
  isEnd: boolean;
}

interface TimelineViewport {
  rulerWidth: number;
  scrollLeft: number;
  viewportWidth: number;
}

export function calculateVisibleTimelineLabels(
  loopLengthBeats: number,
  numerator: number,
  viewport: TimelineViewport,
): TimelineLabel[] {
  const trackWidth = Math.max(1, viewport.rulerWidth - TIMELINE_LABEL_GUTTER);
  const viewportStart = Math.max(
    0,
    ((viewport.scrollLeft - TIMELINE_LABEL_GUTTER) / trackWidth) *
      loopLengthBeats,
  );
  const viewportEnd = Math.min(
    loopLengthBeats,
    ((viewport.scrollLeft + viewport.viewportWidth - TIMELINE_LABEL_GUTTER) /
      trackWidth) *
      loopLengthBeats,
  );
  const firstBeat = Math.max(0, Math.floor(viewportStart) - 2);
  const lastBeat = Math.min(loopLengthBeats, Math.ceil(viewportEnd) + 2);
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
