import type { KeyframeReference } from '@led-studio/editor-core';
import type { KeyframeLayer } from '@led-studio/project-format';

interface MultiKeyframeInspectorProps {
  keyframes: readonly KeyframeReference[];
  layer: KeyframeLayer;
  onBack: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export function MultiKeyframeInspector({
  keyframes,
  layer,
  onBack,
  onCopy,
  onDelete,
  onDuplicate,
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
