import type { ProjectTiming } from '@led-studio/project-format';
import type { PreviewPlaybackController } from '@/features/playback/previewPlayback';
import { ChoiceMenu } from '@/shared/ui/ChoiceMenu';
import { ScenePlaybackPosition } from './TimelinePlayback';
import { displayNumber } from './timelineFormat';
import type { TimelineSnap, TimelineZoomMode } from './timelinePreferences';

interface TimelineHeaderProps {
  barCount: number;
  canAddEffect: boolean;
  controller: PreviewPlaybackController;
  loopLengthBeats: number;
  sceneName: string;
  snap: TimelineSnap;
  timing: ProjectTiming;
  zoomMode: TimelineZoomMode;
  onAddLayer: (type: 'pulse' | 'chase' | 'keyframe') => void;
  onFitScene: () => void;
  onSnapChange: (value: TimelineSnap) => void;
  onZoom: (multiplier: number) => void;
}

export function TimelineHeader({
  barCount,
  canAddEffect,
  controller,
  loopLengthBeats,
  onAddLayer,
  onFitScene,
  onSnapChange,
  onZoom,
  sceneName,
  snap,
  timing,
  zoomMode,
}: TimelineHeaderProps) {
  return (
    <div className="scene-timeline-summary">
      <div>
        <strong>{sceneName}</strong>
        <span>
          Loop · {displayNumber(loopLengthBeats)} beats ·{' '}
          {displayNumber(barCount)} {barCount === 1 ? 'bar' : 'bars'} ·{' '}
          {timing.previewBpm} BPM · {timing.timeSignature.numerator}/
          {timing.timeSignature.denominator}
        </span>
      </div>
      <ChoiceMenu
        className="add-effect-control"
        ariaLabel="Add layer"
        options={[
          { disabled: !canAddEffect, label: 'Pulse', value: 'pulse' },
          { disabled: !canAddEffect, label: 'Chase', value: 'chase' },
          { label: 'Keyframes', value: 'keyframe' },
        ]}
        placeholder="＋ Add layer…"
        value={null}
        onChange={(type) => {
          if (type === 'pulse' || type === 'chase' || type === 'keyframe')
            onAddLayer(type);
        }}
      />
      <div className="timeline-authoring-controls">
        <ChoiceMenu
          ariaLabel="Timeline snap"
          options={[
            { label: '¼ beat', value: '0.25' },
            { label: '½ beat', value: '0.5' },
            { label: '1 beat', value: '1' },
            { label: '1 bar', value: 'bar' },
          ]}
          value={String(snap)}
          onChange={(value) =>
            onSnapChange(
              value === 'bar' ? 'bar' : (Number(value) as 0.25 | 0.5 | 1),
            )
          }
        />
        <div className="timeline-zoom-controls" aria-label="Timeline zoom">
          <button
            aria-label="Zoom timeline out"
            type="button"
            onClick={() => onZoom(0.8)}
          >
            −
          </button>
          <button
            type="button"
            aria-pressed={zoomMode === 'fit'}
            onClick={onFitScene}
          >
            Fit
          </button>
          <button
            aria-label="Zoom timeline in"
            type="button"
            onClick={() => onZoom(1.25)}
          >
            +
          </button>
        </div>
      </div>
      <ScenePlaybackPosition
        controller={controller}
        loopLengthBeats={loopLengthBeats}
      />
    </div>
  );
}
