import type { KeyboardEvent } from 'react';
import type { PreviewPlaybackController } from '@/features/playback/previewPlayback';
import { usePreviewPlaybackSnapshot } from '@/features/playback/usePreviewPlaybackSnapshot';
import { displayNumber } from './timelineFormat';

interface TimelinePlaybackProps {
  controller: PreviewPlaybackController;
  loopLengthBeats: number;
}

export function ScenePlaybackPosition({
  controller,
  loopLengthBeats,
}: TimelinePlaybackProps) {
  const playback = usePreviewPlaybackSnapshot(controller);
  const position = Math.min(playback.positionBeats, loopLengthBeats);
  return (
    <span className="scene-playback-position">
      Position {displayNumber(position)} / {displayNumber(loopLengthBeats)}{' '}
      beats · {playback.status}
    </span>
  );
}

export function SceneTimelineScrubber({
  controller,
  loopLengthBeats,
}: TimelinePlaybackProps) {
  const playback = usePreviewPlaybackSnapshot(controller);
  const position = Math.min(playback.positionBeats, loopLengthBeats);

  function handleKey(event: KeyboardEvent<HTMLInputElement>) {
    let next: number | null = null;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown')
      next = position - 0.25;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp')
      next = position + 0.25;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = loopLengthBeats;
    if (next === null) return;
    event.preventDefault();
    controller.seek(next);
  }

  return (
    <>
      <input
        className="scene-scrubber"
        type="range"
        aria-label="Scene preview position"
        aria-valuetext={`${displayNumber(position)} of ${displayNumber(loopLengthBeats)} beats`}
        min="0"
        max={loopLengthBeats}
        step="any"
        value={position}
        onChange={(event) => controller.seek(Number(event.target.value))}
        onKeyDown={handleKey}
      />
      <div
        className="scene-playhead"
        aria-hidden="true"
        style={{ left: `${(position / loopLengthBeats) * 100}%` }}
      >
        <span />
      </div>
    </>
  );
}
