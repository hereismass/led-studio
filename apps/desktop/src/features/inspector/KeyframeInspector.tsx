import type { KeyframeTrackKind } from '@led-studio/editor-core';
import type {
  BrightnessKeyframe,
  ColourKeyframe,
  KeyframeEasing,
  KeyframeLayer,
  PaletteToken,
  Scene,
} from '@led-studio/project-format';
import { useEffect, useState, type KeyboardEvent } from 'react';
import { PaletteSwatches } from '@/shared/editor-ui/PaletteSwatches';
import { KeyframeEasingControl } from './KeyframeEasingControl';

interface KeyframeInspectorProps {
  canDuplicate: boolean;
  keyframe: BrightnessKeyframe | ColourKeyframe;
  layer: KeyframeLayer;
  palette: readonly PaletteToken[];
  scene: Scene;
  track: KeyframeTrackKind;
  onBack: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onUpdate: (changes: {
    beat?: number;
    brightnessPercent?: number;
    easing?: KeyframeEasing;
    paletteTokenId?: string;
  }) => void;
}

function ExactNumber({
  disabled,
  label,
  max,
  min,
  step,
  value,
  onCommit,
}: {
  disabled: boolean;
  label: string;
  max: number;
  min: number;
  step: number;
  value: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  function commit() {
    const next = Number(draft);
    if (
      !Number.isFinite(next) ||
      next < min ||
      next > max ||
      !Number.isInteger(next / step)
    ) {
      setDraft(String(value));
      return;
    }
    onCommit(next);
  }
  function handleKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') event.currentTarget.blur();
    if (event.key === 'Escape') setDraft(String(value));
  }
  return (
    <label className="inspector-field">
      <span>{label}</span>
      <input
        aria-label={label}
        disabled={disabled}
        max={max}
        min={min}
        step={step}
        type="number"
        value={draft}
        onBlur={commit}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKey}
      />
    </label>
  );
}

export function KeyframeInspector({
  canDuplicate,
  keyframe,
  layer,
  onBack,
  onDelete,
  onDuplicate,
  onUpdate,
  palette,
  scene,
  track,
}: KeyframeInspectorProps) {
  const cropped =
    keyframe.beat < layer.startBeat || keyframe.beat > layer.endBeat;
  const colourKeyframe =
    track === 'colour' && 'paletteTokenId' in keyframe ? keyframe : null;
  const brightnessKeyframe =
    track === 'brightness' && 'brightnessPercent' in keyframe ? keyframe : null;
  const trackKeyframes = layer.tracks[track].keyframes;
  const keyframeIndex = trackKeyframes.findIndex(
    ({ id }) => id === keyframe.id,
  );
  const hasFollowingKeyframe =
    keyframeIndex >= 0 && keyframeIndex < trackKeyframes.length - 1;
  const stepColour =
    track === 'colour' && layer.tracks.colour.interpolation === 'step';
  return (
    <section className="inspector-section keyframe-inspector">
      <button className="inspector-back-button" type="button" onClick={onBack}>
        ← {layer.name}
      </button>
      <div>
        <p className="workspace-eyebrow">{track} keyframe</p>
        <h3>{keyframe.beat} beats</h3>
        {cropped ? (
          <p className="inspector-help keyframe-cropped-message">
            This key is outside the layer’s active window and does not affect
            playback.
          </p>
        ) : null}
      </div>
      <ExactNumber
        disabled={layer.locked}
        label="Beat position"
        max={scene.loopLengthBeats}
        min={0}
        step={0.25}
        value={keyframe.beat}
        onCommit={(beat) => onUpdate({ beat })}
      />
      {brightnessKeyframe ? (
        <ExactNumber
          disabled={layer.locked}
          label="Brightness"
          max={100}
          min={0}
          step={1}
          value={brightnessKeyframe.brightnessPercent}
          onCommit={(brightnessPercent) => onUpdate({ brightnessPercent })}
        />
      ) : colourKeyframe ? (
        <div className="inspector-field">
          <span>Palette colour</span>
          <PaletteSwatches
            disabled={layer.locked}
            palette={palette}
            selectedTokenId={colourKeyframe.paletteTokenId}
            onSelect={(paletteTokenId) => onUpdate({ paletteTokenId })}
          />
        </div>
      ) : null}
      <div className="inspector-field keyframe-easing-field">
        <span>Transition to next key</span>
        <KeyframeEasingControl
          disabled={layer.locked || !hasFollowingKeyframe || stepColour}
          value={keyframe.easing}
          onChange={(easing) => onUpdate({ easing })}
        />
        {!hasFollowingKeyframe ? (
          <p className="inspector-help">
            Add a later keyframe to shape this transition.
          </p>
        ) : stepColour ? (
          <p className="inspector-help">
            Step colour interpolation ignores easing. Switch the layer to Smooth
            RGB to use it.
          </p>
        ) : null}
      </div>
      <div className="inspector-actions">
        <button
          type="button"
          disabled={layer.locked || !canDuplicate}
          title={canDuplicate ? undefined : 'No free quarter-beat position'}
          onClick={onDuplicate}
        >
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
