import type { ExecuteEditorCommandOptions } from '@led-studio/editor-core';
import type {
  EffectLayer,
  ProjectTiming,
  Scene,
} from '@led-studio/project-format';
import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import type { PreviewPlaybackController } from './previewPlayback';
import { usePreviewPlaybackSnapshot } from './usePreviewPlaybackSnapshot';
import { useRafGroupedInteraction } from './useRafGroupedInteraction';

interface SceneTimelineProps {
  canAddEffect: boolean;
  controller: PreviewPlaybackController;
  scene: Scene;
  selectedLayerId: string | null;
  timing: ProjectTiming;
  onAddLayer: (type: 'pulse' | 'chase') => void;
  onSelectLayer: (id: string) => void;
  onUpdateLayer: (
    id: string,
    changes: Pick<EffectLayer, 'endBeat' | 'startBeat'>,
    options?: ExecuteEditorCommandOptions,
  ) => void;
}

function displayNumber(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/0+$/, '');
}

function ScenePlaybackPosition({
  controller,
  loopLengthBeats,
}: {
  controller: PreviewPlaybackController;
  loopLengthBeats: number;
}) {
  const playback = usePreviewPlaybackSnapshot(controller);
  const position = Math.min(playback.positionBeats, loopLengthBeats);
  return (
    <span className="scene-playback-position">
      Position {displayNumber(position)} / {displayNumber(loopLengthBeats)}{' '}
      beats · {playback.status}
    </span>
  );
}

function SceneTimelineScrubber({
  controller,
  loopLengthBeats,
}: {
  controller: PreviewPlaybackController;
  loopLengthBeats: number;
}) {
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

type DragMode = 'move' | 'start' | 'end';
interface DragState {
  endBeat: number;
  id: string;
  mode: DragMode;
  startBeat: number;
  startClientX: number;
  width: number;
}
function snap(value: number): number {
  return Math.round(value * 4) / 4;
}

export function SceneTimeline({
  canAddEffect,
  controller,
  onAddLayer,
  onSelectLayer,
  onUpdateLayer,
  scene,
  selectedLayerId,
  timing,
}: SceneTimelineProps) {
  const dragRef = useRef<DragState | null>(null);
  const interaction = useRafGroupedInteraction<{
    endBeat: number;
    id: string;
    startBeat: number;
  }>((value, options) =>
    onUpdateLayer(
      value.id,
      { endBeat: value.endBeat, startBeat: value.startBeat },
      options,
    ),
  );
  const subdivisions = Math.ceil(scene.loopLengthBeats * 4);
  const minimumWidth = Math.max(480, scene.loopLengthBeats * 80);
  const barCount = scene.loopLengthBeats / timing.timeSignature.numerator;

  function valuesForDrag(drag: DragState, delta: number) {
    let { startBeat, endBeat } = drag;
    if (drag.mode === 'move') {
      const duration = endBeat - startBeat;
      startBeat = Math.max(
        0,
        Math.min(scene.loopLengthBeats - duration, snap(startBeat + delta)),
      );
      endBeat = startBeat + duration;
    } else if (drag.mode === 'start') {
      startBeat = Math.max(
        0,
        Math.min(endBeat - 0.25, snap(startBeat + delta)),
      );
    } else {
      endBeat = Math.max(
        startBeat + 0.25,
        Math.min(scene.loopLengthBeats, snap(endBeat + delta)),
      );
    }
    return { endBeat, id: drag.id, startBeat };
  }

  function beginDrag(
    event: PointerEvent<HTMLElement>,
    layer: EffectLayer,
    mode: DragMode,
  ) {
    if (layer.locked) return;
    event.preventDefault();
    event.stopPropagation();
    onSelectLayer(layer.id);
    const track = event.currentTarget.closest('.scene-track-row');
    if (!(track instanceof HTMLElement)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      endBeat: layer.endBeat,
      id: layer.id,
      mode,
      startBeat: layer.startBeat,
      startClientX: event.clientX,
      width: track.getBoundingClientRect().width,
    };
    interaction.begin();
  }

  function moveDrag(event: PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const delta = snap(
      ((event.clientX - drag.startClientX) / drag.width) *
        scene.loopLengthBeats,
    );
    interaction.update(valuesForDrag(drag, delta));
  }

  function endDrag() {
    if (!dragRef.current) return;
    interaction.end();
    dragRef.current = null;
  }

  function handleLayerKey(
    event: KeyboardEvent<HTMLElement>,
    layer: EffectLayer,
    mode: DragMode,
  ) {
    if (
      layer.locked ||
      (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    const delta =
      (event.shiftKey ? 1 : 0.25) * (event.key === 'ArrowLeft' ? -1 : 1);
    onUpdateLayer(
      layer.id,
      valuesForDrag(
        {
          endBeat: layer.endBeat,
          id: layer.id,
          mode,
          startBeat: layer.startBeat,
          startClientX: 0,
          width: 1,
        },
        delta,
      ),
    );
  }

  return (
    <div className="scene-timeline">
      <div className="scene-timeline-summary">
        <div>
          <strong>{scene.name}</strong>
          <span>
            Loop · {displayNumber(scene.loopLengthBeats)} beats ·{' '}
            {displayNumber(barCount)} {barCount === 1 ? 'bar' : 'bars'} ·{' '}
            {timing.previewBpm} BPM · {timing.timeSignature.numerator}/
            {timing.timeSignature.denominator}
          </span>
        </div>
        <select
          className="add-effect-control"
          aria-label="Add effect"
          disabled={!canAddEffect}
          title={canAddEffect ? undefined : 'Add a palette colour first'}
          value=""
          onChange={(event) => {
            const type = event.target.value;
            if (type === 'pulse' || type === 'chase') onAddLayer(type);
          }}
        >
          <option value="">＋ Add effect…</option>
          <option value="pulse">Pulse</option>
          <option value="chase">Chase</option>
        </select>
        <ScenePlaybackPosition
          controller={controller}
          loopLengthBeats={scene.loopLengthBeats}
        />
      </div>
      <div className="scene-ruler-scroll">
        <div
          className="scene-ruler"
          style={{ minWidth: minimumWidth, width: '100%' }}
        >
          <div className="scene-tick-grid" aria-hidden="true">
            {Array.from({ length: subdivisions + 1 }, (_, index) => {
              const beat = index / 4;
              const isBeat = index % 4 === 0;
              const isBar =
                isBeat && beat % timing.timeSignature.numerator === 0;
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
          </div>
          <div className="scene-track-row scene-static-row">
            <span className="scene-track-label">Static LED frame</span>
            <div className="scene-loop-track">
              <span>Base</span>
            </div>
          </div>
          {scene.layers.map((layer) => (
            <div className="scene-track-row" key={layer.id}>
              <button
                className="scene-track-label"
                type="button"
                aria-pressed={selectedLayerId === layer.id}
                onClick={() => onSelectLayer(layer.id)}
              >
                {layer.locked ? '🔒 ' : ''}
                {layer.name}
              </button>
              <div
                className={`effect-layer-bar effect-layer-${layer.effect.type} ${selectedLayerId === layer.id ? 'effect-layer-selected' : ''} ${!layer.enabled ? 'effect-layer-disabled' : ''}`}
                style={{
                  left: `${(layer.startBeat / scene.loopLengthBeats) * 100}%`,
                  width: `${((layer.endBeat - layer.startBeat) / scene.loopLengthBeats) * 100}%`,
                }}
              >
                <button
                  className="effect-layer-handle effect-layer-start-handle"
                  type="button"
                  aria-label={`Resize start of ${layer.name}`}
                  disabled={layer.locked}
                  onKeyDown={(event) => handleLayerKey(event, layer, 'start')}
                  onPointerDown={(event) => beginDrag(event, layer, 'start')}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                />
                <button
                  className="effect-layer-body"
                  type="button"
                  aria-label={`${layer.name}, ${displayNumber(layer.startBeat)} to ${displayNumber(layer.endBeat)} beats`}
                  onClick={() => onSelectLayer(layer.id)}
                  onKeyDown={(event) => handleLayerKey(event, layer, 'move')}
                  onPointerDown={(event) => beginDrag(event, layer, 'move')}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                >
                  {layer.effect.type}
                </button>
                <button
                  className="effect-layer-handle effect-layer-end-handle"
                  type="button"
                  aria-label={`Resize end of ${layer.name}`}
                  disabled={layer.locked}
                  onKeyDown={(event) => handleLayerKey(event, layer, 'end')}
                  onPointerDown={(event) => beginDrag(event, layer, 'end')}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                />
              </div>
            </div>
          ))}
          <div className="scene-scrubber-layer">
            <SceneTimelineScrubber
              controller={controller}
              loopLengthBeats={scene.loopLengthBeats}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
