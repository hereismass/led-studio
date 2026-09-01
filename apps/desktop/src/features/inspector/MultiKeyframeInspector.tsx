import type { KeyframeReference } from '@led-studio/editor-core';
import type { KeyframeEasing, KeyframeLayer } from '@led-studio/project-format';
import { KeyframeEasingControl } from './KeyframeEasingControl';

interface MultiKeyframeInspectorProps {
  keyframes: readonly KeyframeReference[];
  layer: KeyframeLayer;
  onBack: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onSetEasing: (
    easing: KeyframeEasing,
    keyframes: readonly KeyframeReference[],
  ) => void;
}

export function MultiKeyframeInspector({
  keyframes,
  layer,
  onBack,
  onCopy,
  onDelete,
  onDuplicate,
  onSetEasing,
}: MultiKeyframeInspectorProps) {
  const beats = keyframes.flatMap(({ id, track }) => {
    const keyframe = layer.tracks[track].keyframes.find(
      (candidate) => candidate.id === id,
    );
    return keyframe ? [keyframe.beat] : [];
  });
  const brightnessCount = keyframes.filter(
    ({ track }) => track === 'brightness',
  ).length;
  const colourCount = keyframes.length - brightnessCount;
  const firstBeat = Math.min(...beats);
  const lastBeat = Math.max(...beats);
  const eligibleKeyframes = keyframes.filter(({ id, track }) => {
    if (track === 'colour' && layer.tracks.colour.interpolation === 'step')
      return false;
    const trackKeyframes = layer.tracks[track].keyframes;
    const index = trackKeyframes.findIndex((keyframe) => keyframe.id === id);
    return index >= 0 && index < trackKeyframes.length - 1;
  });
  const selectedEasings = new Set(
    eligibleKeyframes.flatMap(({ id, track }) => {
      const keyframe = layer.tracks[track].keyframes.find(
        (candidate) => candidate.id === id,
      );
      return keyframe ? [keyframe.easing] : [];
    }),
  );
  const easing = selectedEasings.size === 1 ? [...selectedEasings][0] : null;

  return (
    <section className="inspector-section keyframe-inspector">
      <button className="inspector-back-button" type="button" onClick={onBack}>
        ← {layer.name}
      </button>
      <div>
        <p className="workspace-eyebrow">Keyframe selection</p>
        <h3>{keyframes.length} keyframes</h3>
        <p className="inspector-help">
          {brightnessCount > 0 ? `${brightnessCount} brightness` : null}
          {brightnessCount > 0 && colourCount > 0 ? ' · ' : null}
          {colourCount > 0 ? `${colourCount} colour` : null}
          {' · '}
          {firstBeat === lastBeat
            ? `${firstBeat} beats`
            : `${firstBeat}–${lastBeat} beats`}
        </p>
      </div>
      <p className="inspector-help">
        Drag any selected key to move the whole selection. Timing remains
        relative and edits are committed as one undoable change.
      </p>
      <div className="inspector-field keyframe-easing-field">
        <span>Transition easing</span>
        <KeyframeEasingControl
          disabled={layer.locked || eligibleKeyframes.length === 0}
          value={easing}
          onChange={(nextEasing) => onSetEasing(nextEasing, eligibleKeyframes)}
        />
        <p className="inspector-help">
          {eligibleKeyframes.length} of {keyframes.length} selected keys have an
          editable outgoing transition. Terminal keys and stepped colour keys
          are skipped.
        </p>
      </div>
      <div className="inspector-actions">
        <button type="button" onClick={onCopy}>
          Copy
        </button>
        <button type="button" disabled={layer.locked} onClick={onDuplicate}>
          Duplicate
        </button>
        <button
          className="inspector-delete"
          type="button"
          disabled={layer.locked}
          onClick={onDelete}
        >
          Delete
        </button>
      </div>
    </section>
  );
}
