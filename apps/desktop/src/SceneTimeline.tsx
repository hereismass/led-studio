import type { ProjectTiming, Scene } from '@led-studio/project-format';
import type { KeyboardEvent } from 'react';
import type { PreviewPlaybackController } from './previewPlayback';
import { usePreviewPlaybackSnapshot } from './usePreviewPlaybackSnapshot';

interface SceneTimelineProps {
  controller: PreviewPlaybackController;
  scene: Scene;
  timing: ProjectTiming;
}

function displayNumber(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/0+$/, '');
}

export function SceneTimeline({
  controller,
  scene,
  timing,
}: SceneTimelineProps) {
  const playback = usePreviewPlaybackSnapshot(controller);
  const position = Math.min(playback.positionBeats, scene.loopLengthBeats);
  const subdivisions = Math.ceil(scene.loopLengthBeats * 4);
  const minimumWidth = Math.max(480, scene.loopLengthBeats * 80);
  const bars = scene.loopLengthBeats / timing.timeSignature.numerator;
  const playheadPercent = (position / scene.loopLengthBeats) * 100;

  function handleScrubberKey(event: KeyboardEvent<HTMLInputElement>) {
    let nextPosition: number | null = null;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown')
      nextPosition = position - 0.25;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp')
      nextPosition = position + 0.25;
    if (event.key === 'Home') nextPosition = 0;
    if (event.key === 'End') nextPosition = scene.loopLengthBeats;
    if (nextPosition === null) return;
    event.preventDefault();
    controller.seek(nextPosition);
  }

  return (
    <div className="scene-timeline">
      <div className="scene-timeline-summary">
        <strong>{scene.name}</strong>
        <span>
          Loop · {displayNumber(scene.loopLengthBeats)} beats ·{' '}
          {displayNumber(bars)} {bars === 1 ? 'bar' : 'bars'} ·{' '}
          {timing.previewBpm} BPM · {timing.timeSignature.numerator}/
          {timing.timeSignature.denominator}
        </span>
        <span className="scene-playback-position">
          Position {displayNumber(position)} /{' '}
          {displayNumber(scene.loopLengthBeats)} beats · {playback.status}
        </span>
      </div>
      <div
        className="scene-ruler"
        style={{ minWidth: minimumWidth, width: '100%' }}
      >
        {Array.from({ length: subdivisions + 1 }, (_, index) => {
          const beat = index / 4;
          const isBeat = index % 4 === 0;
          const isBar = isBeat && beat % timing.timeSignature.numerator === 0;
          return (
            <div
              className={`scene-ruler-tick ${isBar ? 'scene-ruler-bar' : isBeat ? 'scene-ruler-beat' : ''}`}
              key={index}
              style={{ left: `${(beat / scene.loopLengthBeats) * 100}%` }}
            >
              {isBeat && beat < scene.loopLengthBeats ? (
                <span>
                  {Math.floor(beat / timing.timeSignature.numerator) + 1}.
                  {(beat % timing.timeSignature.numerator) + 1}
                </span>
              ) : null}
            </div>
          );
        })}
        <div className="scene-loop-track">
          <span>Static LED frame · loops continuously</span>
        </div>
        <input
          className="scene-scrubber"
          type="range"
          aria-label="Scene preview position"
          aria-valuetext={`${displayNumber(position)} of ${displayNumber(scene.loopLengthBeats)} beats`}
          min="0"
          max={scene.loopLengthBeats}
          step="any"
          value={position}
          onChange={(event) => controller.seek(Number(event.target.value))}
          onKeyDown={handleScrubberKey}
        />
        <div
          className="scene-playhead"
          aria-hidden="true"
          style={{ left: `${playheadPercent}%` }}
        >
          <span />
        </div>
      </div>
    </div>
  );
}
