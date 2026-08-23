import type { ProjectTiming, Scene } from '@led-studio/project-format';

interface SceneTimelineProps {
  scene: Scene;
  timing: ProjectTiming;
}

function displayNumber(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/0+$/, '');
}

export function SceneTimeline({ scene, timing }: SceneTimelineProps) {
  const subdivisions = Math.ceil(scene.loopLengthBeats * 4);
  const width = Math.max(480, scene.loopLengthBeats * 80);
  const bars = scene.loopLengthBeats / timing.timeSignature.numerator;
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
      </div>
      <div className="scene-ruler" style={{ width }}>
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
          <span>Static LED state loops until a scene-change message</span>
        </div>
      </div>
    </div>
  );
}
