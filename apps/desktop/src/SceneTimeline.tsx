import type { ExecuteEditorCommandOptions } from '@led-studio/editor-core';
import type {
  EffectLayer,
  ProjectTiming,
  Scene,
} from '@led-studio/project-format';
import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { ChoiceMenu } from './ChoiceMenu';
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
  onMoveLayer: (id: string, toIndex: number) => void;
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

interface ReorderDragState {
  dropSlot: number;
  id: string;
  startIndex: number;
}
function snap(value: number): number {
  return Math.round(value * 4) / 4;
}

export function SceneTimeline({
  canAddEffect,
  controller,
  onAddLayer,
  onMoveLayer,
  onSelectLayer,
  onUpdateLayer,
  scene,
  selectedLayerId,
  timing,
}: SceneTimelineProps) {
  const dragRef = useRef<DragState | null>(null);
  const reorderRef = useRef<ReorderDragState | null>(null);
  const [draggingLayerId, setDraggingLayerId] = useState<string | null>(null);
  const [dropSlot, setDropSlot] = useState<number | null>(null);
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

  function beginReorder(
    event: PointerEvent<HTMLButtonElement>,
    layer: EffectLayer,
    startIndex: number,
  ) {
    if (layer.locked) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    onSelectLayer(layer.id);
    reorderRef.current = {
      dropSlot: startIndex,
      id: layer.id,
      startIndex,
    };
    setDraggingLayerId(layer.id);
    setDropSlot(startIndex);
  }

  function moveReorder(event: PointerEvent<HTMLButtonElement>) {
    const drag = reorderRef.current;
    if (!drag) return;
    const ruler = event.currentTarget.closest('.scene-ruler');
    if (!(ruler instanceof HTMLElement)) return;
    const rows = Array.from(
      ruler.querySelectorAll<HTMLElement>('.scene-effect-row'),
    );
    const firstAfterPointer = rows.findIndex((row) => {
      const bounds = row.getBoundingClientRect();
      return event.clientY < bounds.top + bounds.height / 2;
    });
    const nextSlot = firstAfterPointer < 0 ? rows.length : firstAfterPointer;
    drag.dropSlot = nextSlot;
    setDropSlot(nextSlot);
  }

  function endReorder(commit: boolean) {
    const drag = reorderRef.current;
    if (!drag) return;
    if (commit) {
      const adjustedIndex =
        drag.dropSlot > drag.startIndex ? drag.dropSlot - 1 : drag.dropSlot;
      const toIndex = Math.max(
        0,
        Math.min(scene.layers.length - 1, adjustedIndex),
      );
      if (toIndex !== drag.startIndex) onMoveLayer(drag.id, toIndex);
    }
    reorderRef.current = null;
    setDraggingLayerId(null);
    setDropSlot(null);
  }

  function handleReorderKey(
    event: KeyboardEvent<HTMLButtonElement>,
    layer: EffectLayer,
    index: number,
  ) {
    if (event.key === 'Escape' && reorderRef.current) {
      event.preventDefault();
      endReorder(false);
      return;
    }
    if (layer.locked) return;
    const offset =
      event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
    if (offset === 0) return;
    event.preventDefault();
    onMoveLayer(layer.id, index + offset);
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
        <ChoiceMenu
          className="add-effect-control"
          ariaLabel="Add effect"
          disabled={!canAddEffect}
          title={canAddEffect ? undefined : 'Add a palette colour first'}
          options={[
            { label: 'Pulse', value: 'pulse' },
            { label: 'Chase', value: 'chase' },
          ]}
          placeholder="＋ Add effect…"
          value={null}
          onChange={(type) => {
            if (type === 'pulse' || type === 'chase') onAddLayer(type);
          }}
        />
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
          {scene.layers.map((layer, index) => (
            <div
              className={`scene-track-row scene-effect-row ${draggingLayerId === layer.id ? 'scene-effect-row-dragging' : ''}`}
              key={layer.id}
            >
              <div className="scene-track-label scene-effect-track-label">
                <button
                  className="effect-reorder-handle"
                  type="button"
                  aria-label={`Reorder ${layer.name}`}
                  disabled={layer.locked}
                  title={
                    layer.locked
                      ? 'Unlock this layer to reorder it'
                      : 'Drag vertically or use the arrow keys to reorder'
                  }
                  onKeyDown={(event) => handleReorderKey(event, layer, index)}
                  onPointerDown={(event) => beginReorder(event, layer, index)}
                  onPointerMove={moveReorder}
                  onPointerUp={() => endReorder(true)}
                  onPointerCancel={() => endReorder(false)}
                >
                  ⠿
                </button>
                <button
                  className="scene-track-select"
                  type="button"
                  aria-label={layer.name}
                  aria-pressed={selectedLayerId === layer.id}
                  onClick={() => onSelectLayer(layer.id)}
                >
                  {layer.locked ? <span aria-hidden="true">🔒 </span> : null}
                  {layer.name}
                </button>
              </div>
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
          {draggingLayerId !== null && dropSlot !== null ? (
            <div
              className="scene-layer-drop-indicator"
              aria-hidden="true"
              style={{ top: `${28 + (dropSlot + 1) * 43}px` }}
            />
          ) : null}
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
