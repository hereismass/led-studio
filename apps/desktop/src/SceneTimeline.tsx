import type {
  ExecuteEditorCommandOptions,
  KeyframeTrackKind,
  KeyframeValue,
} from '@led-studio/editor-core';
import {
  evaluateBrightnessTrack,
  keyframesInActiveWindow,
} from '@led-studio/playback';
import type {
  BrightnessKeyframe,
  ColourKeyframeTrack,
  KeyframeLayer,
  PaletteToken,
  ProjectTiming,
  Scene,
  SceneLayer,
} from '@led-studio/project-format';
import {
  Fragment,
  memo,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { ChoiceMenu } from './ChoiceMenu';
import {
  buildBrightnessAutomationPoints,
  buildColourAutomationStops,
} from './keyframeTimelineVisuals';
import { PaletteSwatches } from './PaletteSwatches';
import type { PreviewPlaybackController } from './previewPlayback';
import {
  usePreviewPlaybackQuarterBeat,
  usePreviewPlaybackSnapshot,
} from './usePreviewPlaybackSnapshot';
import { useRafGroupedInteraction } from './useRafGroupedInteraction';
import {
  calculateVisibleTimelineLabels,
  TIMELINE_PIXELS_PER_BEAT,
  useTimelineViewport,
} from './timelineViewport';

interface SceneTimelineProps {
  canAddEffect: boolean;
  controller: PreviewPlaybackController;
  expandedKeyframeLayerIds: string[];
  palette: readonly PaletteToken[];
  scene: Scene;
  selectedKeyframeId: string | null;
  selectedLayerId: string | null;
  timing: ProjectTiming;
  onAddKeyframe: (layerId: string, beat: number, value: KeyframeValue) => void;
  onAddLayer: (type: 'pulse' | 'chase' | 'keyframe') => void;
  onMoveLayer: (id: string, toIndex: number) => void;
  onSelectKeyframe: (
    layerId: string,
    track: KeyframeTrackKind,
    id: string,
  ) => void;
  onSelectLayer: (id: string) => void;
  onToggleKeyframeLayer: (id: string) => void;
  onUpdateKeyframe: (
    layerId: string,
    track: KeyframeTrackKind,
    id: string,
    beat: number,
    options?: ExecuteEditorCommandOptions,
  ) => void;
  onUpdateLayer: (
    id: string,
    changes: Pick<SceneLayer, 'endBeat' | 'startBeat'>,
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
  rowMidpoints: number[];
  startIndex: number;
}
function snap(value: number): number {
  return Math.round(value * 4) / 4;
}

const BrightnessAutomation = memo(function BrightnessAutomation({
  endBeat,
  keyframes,
  loopLengthBeats,
  startBeat,
}: {
  endBeat: number;
  keyframes: readonly BrightnessKeyframe[];
  loopLengthBeats: number;
  startBeat: number;
}) {
  const points = buildBrightnessAutomationPoints(
    keyframes,
    startBeat,
    endBeat,
    loopLengthBeats,
  );
  if (points.length === 0) return null;
  const linePoints = points
    .map(({ xPercent, yPercent }) => `${xPercent},${yPercent}`)
    .join(' ');
  const areaPath = `M ${points[0].xPercent} 100 L ${linePoints.replaceAll(' ', ' L ')} L ${points[points.length - 1].xPercent} 100 Z`;
  return (
    <svg
      aria-hidden="true"
      className="scene-keyframe-automation scene-brightness-automation"
      data-testid="brightness-automation"
      preserveAspectRatio="none"
      viewBox="0 0 100 100"
    >
      <path className="scene-brightness-automation-fill" d={areaPath} />
      <polyline
        className="scene-brightness-automation-line"
        points={linePoints}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
});

const ColourAutomation = memo(function ColourAutomation({
  endBeat,
  loopLengthBeats,
  palette,
  startBeat,
  track,
}: {
  endBeat: number;
  loopLengthBeats: number;
  palette: readonly PaletteToken[];
  startBeat: number;
  track: ColourKeyframeTrack;
}) {
  const gradientId = `colour-automation-${useId().replace(/:/g, '')}`;
  const colours = new Map(palette.map(({ id, value }) => [id, value]));
  const stops = buildColourAutomationStops(track, colours, startBeat, endBeat);
  if (stops.length === 0) return null;
  return (
    <svg
      aria-hidden="true"
      className="scene-keyframe-automation scene-colour-automation"
      data-testid="colour-automation"
      preserveAspectRatio="none"
      viewBox="0 0 100 100"
    >
      <defs>
        <linearGradient colorInterpolation="sRGB" id={gradientId} x1="0" x2="1">
          {stops.map(({ colour, offsetPercent }, index) => (
            <stop
              key={`${offsetPercent}-${colour}-${index}`}
              offset={`${offsetPercent}%`}
              stopColor={colour}
            />
          ))}
        </linearGradient>
      </defs>
      <rect
        className="scene-colour-automation-strip"
        fill={`url(#${gradientId})`}
        height="100"
        width={`${((endBeat - startBeat) / loopLengthBeats) * 100}`}
        x={`${(startBeat / loopLengthBeats) * 100}`}
        y="0"
      />
    </svg>
  );
});

interface KeyframeDragState {
  id: string;
  startBeat: number;
  startClientX: number;
  track: KeyframeTrackKind;
  width: number;
}

function KeyframeTrackRows({
  controller,
  layer,
  loopLengthBeats,
  onAddKeyframe,
  onSelectKeyframe,
  onUpdateKeyframe,
  palette,
  selectedKeyframeId,
}: {
  controller: PreviewPlaybackController;
  layer: KeyframeLayer;
  loopLengthBeats: number;
  palette: readonly PaletteToken[];
  selectedKeyframeId: string | null;
  onAddKeyframe: (beat: number, value: KeyframeValue) => void;
  onSelectKeyframe: (track: KeyframeTrackKind, id: string) => void;
  onUpdateKeyframe: (
    track: KeyframeTrackKind,
    id: string,
    beat: number,
    options?: ExecuteEditorCommandOptions,
  ) => void;
}) {
  const playheadBeat = Math.min(
    loopLengthBeats,
    usePreviewPlaybackQuarterBeat(controller),
  );
  const playheadInWindow =
    playheadBeat >= layer.startBeat && playheadBeat <= layer.endBeat;
  const [choosingColour, setChoosingColour] = useState(false);
  const dragRef = useRef<KeyframeDragState | null>(null);
  const interaction = useRafGroupedInteraction<{
    beat: number;
    id: string;
    track: KeyframeTrackKind;
  }>((value, options) =>
    onUpdateKeyframe(value.track, value.id, value.beat, options),
  );

  function beginKeyframeDrag(
    event: PointerEvent<HTMLButtonElement>,
    track: KeyframeTrackKind,
    id: string,
    beat: number,
  ) {
    if (layer.locked) return;
    event.preventDefault();
    event.stopPropagation();
    const trackElement = event.currentTarget.closest('.scene-keyframe-track');
    if (!(trackElement instanceof HTMLElement)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      id,
      startBeat: beat,
      startClientX: event.clientX,
      track,
      width: trackElement.getBoundingClientRect().width,
    };
    onSelectKeyframe(track, id);
    interaction.begin();
  }

  function moveKeyframeDrag(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const beat = Math.max(
      0,
      Math.min(
        loopLengthBeats,
        snap(
          drag.startBeat +
            ((event.clientX - drag.startClientX) / drag.width) *
              loopLengthBeats,
        ),
      ),
    );
    const occupied = layer.tracks[drag.track].keyframes.some(
      (keyframe) => keyframe.id !== drag.id && keyframe.beat === beat,
    );
    if (!occupied) interaction.update({ beat, id: drag.id, track: drag.track });
  }

  function endKeyframeDrag() {
    if (!dragRef.current) return;
    dragRef.current = null;
    interaction.end();
  }

  function handleKeyframeKey(
    event: KeyboardEvent<HTMLButtonElement>,
    track: KeyframeTrackKind,
    id: string,
    beat: number,
  ) {
    if (
      layer.locked ||
      (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')
    )
      return;
    event.preventDefault();
    const delta =
      (event.shiftKey ? 1 : 0.25) * (event.key === 'ArrowLeft' ? -1 : 1);
    const nextBeat = Math.max(0, Math.min(loopLengthBeats, beat + delta));
    if (
      !layer.tracks[track].keyframes.some(
        (keyframe) => keyframe.id !== id && keyframe.beat === nextBeat,
      )
    )
      onUpdateKeyframe(track, id, nextBeat);
  }

  const activeBrightnessKeyframes = useMemo(
    () =>
      keyframesInActiveWindow(
        layer.tracks.brightness.keyframes,
        layer.startBeat,
        layer.endBeat,
      ),
    [layer.endBeat, layer.startBeat, layer.tracks.brightness.keyframes],
  );
  const brightnessAtPlayhead =
    evaluateBrightnessTrack(activeBrightnessKeyframes, playheadBeat) ?? 100;
  const brightnessAtPlayheadKey = layer.tracks.brightness.keyframes.find(
    ({ beat }) => beat === playheadBeat,
  );
  const colourAtPlayheadKey = layer.tracks.colour.keyframes.find(
    ({ beat }) => beat === playheadBeat,
  );

  function diamond(
    track: KeyframeTrackKind,
    keyframe: {
      beat: number;
      id: string;
      paletteTokenId?: string;
    },
  ) {
    const cropped =
      keyframe.beat < layer.startBeat || keyframe.beat > layer.endBeat;
    const isLoopEnd = keyframe.beat === loopLengthBeats;
    return (
      <button
        aria-label={`${track} keyframe at ${displayNumber(keyframe.beat)} beats${isLoopEnd ? ', loop end' : ''}`}
        aria-pressed={selectedKeyframeId === keyframe.id}
        className={`scene-keyframe-diamond scene-keyframe-${track} ${cropped ? 'scene-keyframe-cropped' : ''}`}
        key={keyframe.id}
        style={{
          left: `${(keyframe.beat / loopLengthBeats) * 100}%`,
          ...(keyframe.paletteTokenId
            ? {
                backgroundColor: palette.find(
                  ({ id }) => id === keyframe.paletteTokenId,
                )?.value,
              }
            : {}),
        }}
        title={
          cropped
            ? 'Stored outside the active window'
            : isLoopEnd
              ? 'Loop endpoint used for interpolation before playback wraps'
              : keyframe.beat === layer.endBeat
                ? 'Layer endpoint used for interpolation'
                : undefined
        }
        type="button"
        onClick={() => onSelectKeyframe(track, keyframe.id)}
        onKeyDown={(event) =>
          handleKeyframeKey(event, track, keyframe.id, keyframe.beat)
        }
        onPointerCancel={endKeyframeDrag}
        onPointerDown={(event) =>
          beginKeyframeDrag(event, track, keyframe.id, keyframe.beat)
        }
        onPointerMove={moveKeyframeDrag}
        onPointerUp={endKeyframeDrag}
      />
    );
  }

  return (
    <>
      <div className="scene-track-row scene-keyframe-property-row">
        <span className="scene-track-label scene-keyframe-track-label">
          Brightness
          <button
            aria-label="Add brightness keyframe at playhead"
            type="button"
            disabled={layer.locked || !playheadInWindow}
            title={
              playheadInWindow
                ? 'Add brightness keyframe at playhead'
                : 'Move the playhead inside the active window'
            }
            onClick={() => {
              if (brightnessAtPlayheadKey)
                onSelectKeyframe('brightness', brightnessAtPlayheadKey.id);
              else
                onAddKeyframe(playheadBeat, {
                  brightnessPercent: Math.round(brightnessAtPlayhead),
                  track: 'brightness',
                });
            }}
          >
            ＋
          </button>
        </span>
        <div className="scene-keyframe-track">
          <span
            className="scene-keyframe-active-window"
            aria-hidden="true"
            style={{
              left: `${(layer.startBeat / loopLengthBeats) * 100}%`,
              width: `${((layer.endBeat - layer.startBeat) / loopLengthBeats) * 100}%`,
            }}
          />
          <BrightnessAutomation
            endBeat={layer.endBeat}
            keyframes={layer.tracks.brightness.keyframes}
            loopLengthBeats={loopLengthBeats}
            startBeat={layer.startBeat}
          />
          {layer.tracks.brightness.keyframes.map((keyframe) =>
            diamond('brightness', keyframe),
          )}
        </div>
      </div>
      <div className="scene-track-row scene-keyframe-property-row">
        <span className="scene-track-label scene-keyframe-track-label">
          Colour
          <button
            aria-label="Add colour keyframe at playhead"
            type="button"
            disabled={layer.locked || !playheadInWindow || palette.length === 0}
            title={
              palette.length === 0
                ? 'Add a palette colour first'
                : playheadInWindow
                  ? 'Add colour keyframe at playhead'
                  : 'Move the playhead inside the active window'
            }
            onClick={() => {
              if (colourAtPlayheadKey)
                onSelectKeyframe('colour', colourAtPlayheadKey.id);
              else setChoosingColour((current) => !current);
            }}
          >
            ＋
          </button>
        </span>
        <div className="scene-keyframe-track">
          <span
            className="scene-keyframe-active-window"
            aria-hidden="true"
            style={{
              left: `${(layer.startBeat / loopLengthBeats) * 100}%`,
              width: `${((layer.endBeat - layer.startBeat) / loopLengthBeats) * 100}%`,
            }}
          />
          <ColourAutomation
            endBeat={layer.endBeat}
            loopLengthBeats={loopLengthBeats}
            palette={palette}
            startBeat={layer.startBeat}
            track={layer.tracks.colour}
          />
          {layer.tracks.colour.keyframes.map((keyframe) =>
            diamond('colour', keyframe),
          )}
          {choosingColour ? (
            <div className="scene-keyframe-colour-picker">
              <span>Colour at {displayNumber(playheadBeat)} beats</span>
              <PaletteSwatches
                palette={palette}
                selectedTokenId={null}
                onSelect={(paletteTokenId) => {
                  onAddKeyframe(playheadBeat, {
                    paletteTokenId,
                    track: 'colour',
                  });
                  setChoosingColour(false);
                }}
              />
              <button type="button" onClick={() => setChoosingColour(false)}>
                Cancel
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

export function SceneTimeline({
  canAddEffect,
  controller,
  expandedKeyframeLayerIds,
  onAddKeyframe,
  onAddLayer,
  onMoveLayer,
  onSelectKeyframe,
  onSelectLayer,
  onToggleKeyframeLayer,
  onUpdateKeyframe,
  onUpdateLayer,
  palette,
  scene,
  selectedKeyframeId,
  selectedLayerId,
  timing,
}: SceneTimelineProps) {
  const dragRef = useRef<DragState | null>(null);
  const reorderRef = useRef<ReorderDragState | null>(null);
  const rulerRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
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
  const minimumWidth = Math.max(
    480,
    scene.loopLengthBeats * TIMELINE_PIXELS_PER_BEAT,
  );
  const barCount = scene.loopLengthBeats / timing.timeSignature.numerator;
  const viewport = useTimelineViewport(scrollRef, rulerRef);
  const visibleLabels = useMemo(
    () =>
      calculateVisibleTimelineLabels(
        scene.loopLengthBeats,
        timing.timeSignature.numerator,
        viewport,
      ),
    [scene.loopLengthBeats, timing.timeSignature.numerator, viewport],
  );

  function dropIndicatorTop(slot: number): number {
    const rowsBeforeSlot = scene.layers
      .slice(0, slot)
      .reduce(
        (count, layer) =>
          count +
          1 +
          (layer.kind === 'keyframe' &&
          expandedKeyframeLayerIds.includes(layer.id)
            ? 2
            : 0),
        0,
      );
    return 28 + (1 + rowsBeforeSlot) * 43;
  }

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
    layer: SceneLayer,
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
    layer: SceneLayer,
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
    layer: SceneLayer,
    startIndex: number,
  ) {
    if (layer.locked) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    onSelectLayer(layer.id);
    const ruler = event.currentTarget.closest('.scene-ruler');
    const rowMidpoints =
      ruler instanceof HTMLElement
        ? Array.from(
            ruler.querySelectorAll<HTMLElement>('.scene-effect-row'),
            (row) => {
              const bounds = row.getBoundingClientRect();
              return bounds.top + bounds.height / 2;
            },
          )
        : [];
    reorderRef.current = {
      dropSlot: startIndex,
      id: layer.id,
      rowMidpoints,
      startIndex,
    };
    setDraggingLayerId(layer.id);
    setDropSlot(startIndex);
  }

  function moveReorder(event: PointerEvent<HTMLButtonElement>) {
    const drag = reorderRef.current;
    if (!drag) return;
    const firstAfterPointer = drag.rowMidpoints.findIndex(
      (midpoint) => event.clientY < midpoint,
    );
    const nextSlot =
      firstAfterPointer < 0 ? drag.rowMidpoints.length : firstAfterPointer;
    if (nextSlot === drag.dropSlot) return;
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
    layer: SceneLayer,
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
          ariaLabel="Add layer"
          options={[
            {
              disabled: !canAddEffect,
              label: 'Pulse',
              value: 'pulse',
            },
            {
              disabled: !canAddEffect,
              label: 'Chase',
              value: 'chase',
            },
            { label: 'Keyframes', value: 'keyframe' },
          ]}
          placeholder="＋ Add layer…"
          value={null}
          onChange={(type) => {
            if (type === 'pulse' || type === 'chase' || type === 'keyframe')
              onAddLayer(type);
          }}
        />
        <ScenePlaybackPosition
          controller={controller}
          loopLengthBeats={scene.loopLengthBeats}
        />
      </div>
      <div className="scene-ruler-scroll" ref={scrollRef}>
        <div
          className="scene-ruler"
          ref={rulerRef}
          style={
            {
              '--timeline-bar-width': `${(timing.timeSignature.numerator / scene.loopLengthBeats) * 100}%`,
              '--timeline-beat-width': `${100 / scene.loopLengthBeats}%`,
              '--timeline-quarter-width': `${100 / subdivisions}%`,
              minWidth: minimumWidth,
              width: '100%',
            } as CSSProperties
          }
        >
          <div className="scene-tick-grid" aria-hidden="true">
            {visibleLabels.map(({ beat, isBar, isEnd }) => (
              <div
                className={`scene-ruler-tick scene-ruler-beat ${isBar ? 'scene-ruler-bar' : ''}`}
                key={beat}
                style={{ left: `${(beat / scene.loopLengthBeats) * 100}%` }}
              >
                <span>
                  {isEnd ? (
                    'End'
                  ) : (
                    <>
                      {Math.floor(beat / timing.timeSignature.numerator) + 1}.
                      {(beat % timing.timeSignature.numerator) + 1}
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
          <div className="scene-track-row scene-static-row">
            <span className="scene-track-label">Static LED frame</span>
            <div className="scene-loop-track">
              <span>Base</span>
            </div>
          </div>
          {scene.layers.map((layer, index) => {
            const expanded = expandedKeyframeLayerIds.includes(layer.id);
            return (
              <Fragment key={layer.id}>
                <div
                  className={`scene-track-row scene-effect-row ${draggingLayerId === layer.id ? 'scene-effect-row-dragging' : ''}`}
                >
                  <div className="scene-track-label scene-effect-track-label">
                    {layer.kind === 'keyframe' ? (
                      <button
                        className="keyframe-disclosure-button"
                        type="button"
                        aria-expanded={expanded}
                        aria-label={`${expanded ? 'Collapse' : 'Expand'} ${layer.name} tracks`}
                        onClick={() => onToggleKeyframeLayer(layer.id)}
                      >
                        {expanded ? '⌄' : '›'}
                      </button>
                    ) : null}
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
                      onKeyDown={(event) =>
                        handleReorderKey(event, layer, index)
                      }
                      onPointerDown={(event) =>
                        beginReorder(event, layer, index)
                      }
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
                      {layer.locked ? (
                        <span aria-hidden="true">🔒 </span>
                      ) : null}
                      {layer.name}
                    </button>
                  </div>
                  {layer.kind === 'keyframe' ? (
                    <span className="keyframe-overview" aria-hidden="true">
                      {[
                        ...layer.tracks.brightness.keyframes.map(
                          (keyframe) => ({
                            ...keyframe,
                            track: 'brightness' as const,
                          }),
                        ),
                        ...layer.tracks.colour.keyframes.map((keyframe) => ({
                          ...keyframe,
                          track: 'colour' as const,
                        })),
                      ].map((keyframe) => {
                        const cropped =
                          keyframe.beat < layer.startBeat ||
                          keyframe.beat > layer.endBeat;
                        return (
                          <span
                            className={`keyframe-overview-${keyframe.track} ${cropped ? 'keyframe-overview-cropped' : ''}`}
                            key={keyframe.id}
                            style={{
                              left: `${(keyframe.beat / scene.loopLengthBeats) * 100}%`,
                              ...('paletteTokenId' in keyframe
                                ? {
                                    backgroundColor: palette.find(
                                      ({ id }) =>
                                        id === keyframe.paletteTokenId,
                                    )?.value,
                                  }
                                : {}),
                            }}
                          />
                        );
                      })}
                    </span>
                  ) : null}
                  <div
                    className={`effect-layer-bar effect-layer-${layer.kind === 'effect' ? layer.effect.type : 'keyframe'} ${selectedLayerId === layer.id ? 'effect-layer-selected' : ''} ${!layer.enabled ? 'effect-layer-disabled' : ''}`}
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
                      onKeyDown={(event) =>
                        handleLayerKey(event, layer, 'start')
                      }
                      onPointerDown={(event) =>
                        beginDrag(event, layer, 'start')
                      }
                      onPointerMove={moveDrag}
                      onPointerUp={endDrag}
                      onPointerCancel={endDrag}
                    />
                    <button
                      className="effect-layer-body"
                      type="button"
                      aria-label={`${layer.name}, ${displayNumber(layer.startBeat)} to ${displayNumber(layer.endBeat)} beats`}
                      onClick={() => onSelectLayer(layer.id)}
                      onKeyDown={(event) =>
                        handleLayerKey(event, layer, 'move')
                      }
                      onPointerDown={(event) => beginDrag(event, layer, 'move')}
                      onPointerMove={moveDrag}
                      onPointerUp={endDrag}
                      onPointerCancel={endDrag}
                    >
                      {layer.kind === 'effect'
                        ? layer.effect.type
                        : 'keyframes'}
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
                {layer.kind === 'keyframe' && expanded ? (
                  <KeyframeTrackRows
                    controller={controller}
                    layer={layer}
                    loopLengthBeats={scene.loopLengthBeats}
                    palette={palette}
                    selectedKeyframeId={selectedKeyframeId}
                    onAddKeyframe={(beat, value) =>
                      onAddKeyframe(layer.id, beat, value)
                    }
                    onSelectKeyframe={(track, id) =>
                      onSelectKeyframe(layer.id, track, id)
                    }
                    onUpdateKeyframe={(track, id, beat, options) =>
                      onUpdateKeyframe(layer.id, track, id, beat, options)
                    }
                  />
                ) : null}
              </Fragment>
            );
          })}
          {draggingLayerId !== null && dropSlot !== null ? (
            <div
              className="scene-layer-drop-indicator"
              aria-hidden="true"
              style={{ top: `${dropIndicatorTop(dropSlot)}px` }}
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
