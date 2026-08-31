import type {
  ExecuteEditorCommandOptions,
  KeyframeMove,
  KeyframeReference,
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
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { ChoiceMenu } from './ChoiceMenu';
import { ContextMenu, type ContextMenuItem } from './ContextMenu';
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
  calculateVisibleBeatRange,
  calculateVisibleTimelineLabels,
  snapTimelineBeat,
  timelineSnapStep,
  TIMELINE_LABEL_GUTTER,
  useTimelineViewport,
} from './timelineViewport';
import type { TimelineSnap, TimelineZoomMode } from './workspaceLayout';

interface SceneTimelineProps {
  canAddEffect: boolean;
  controller: PreviewPlaybackController;
  expandedKeyframeLayerIds: string[];
  palette: readonly PaletteToken[];
  scene: Scene;
  selectedKeyframes: readonly KeyframeReference[];
  selectedLayerId: string | null;
  snap: TimelineSnap;
  timing: ProjectTiming;
  timelinePixelsPerBeat: number;
  timelineZoomMode: TimelineZoomMode;
  onAddKeyframe: (layerId: string, beat: number, value: KeyframeValue) => void;
  onAddLayer: (type: 'pulse' | 'chase' | 'keyframe') => void;
  onMoveLayer: (id: string, toIndex: number) => void;
  onKeyframeAction: (
    action: 'copy' | 'cut' | 'delete' | 'duplicate' | 'paste',
    layerId: string,
    keyframes: KeyframeReference[],
  ) => void;
  onLayerAction: (
    action: 'copy' | 'cut' | 'delete' | 'duplicate' | 'paste',
    layerId: string,
  ) => void;
  onSelectKeyframes: (
    layerId: string,
    keyframes: KeyframeReference[],
    primary: KeyframeReference,
  ) => void;
  onSelectLayer: (id: string) => void;
  onToggleKeyframeLayer: (id: string) => void;
  onTimelinePixelsPerBeatChange: (value: number) => void;
  onTimelineSnapChange: (value: TimelineSnap) => void;
  onTimelineZoomModeChange: (value: TimelineZoomMode) => void;
  onUpdateKeyframes: (
    layerId: string,
    keyframes: KeyframeMove[],
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
  keyframes: Array<KeyframeReference & { startBeat: number }>;
  startClientX: number;
  width: number;
}

function keyframesAroundVisibleRange<T extends { beat: number }>(
  keyframes: readonly T[],
  startBeat: number,
  endBeat: number,
): T[] {
  if (keyframes.length <= 2) return [...keyframes];
  const firstVisible = keyframes.findIndex(({ beat }) => beat >= startBeat);
  if (firstVisible < 0) return [keyframes.at(-1)!];
  const first = Math.max(0, firstVisible - 1);
  const firstAfter = keyframes.findIndex(
    ({ beat }, index) => index >= firstVisible && beat > endBeat,
  );
  const end = firstAfter < 0 ? keyframes.length : firstAfter + 1;
  return keyframes.slice(first, end);
}

function KeyframeTrackRows({
  controller,
  layer,
  loopLengthBeats,
  onAddKeyframe,
  onSelectKeyframes,
  onOpenContextMenu,
  onUpdateKeyframes,
  palette,
  snap,
  timeSignatureNumerator,
  selectedKeyframes,
  visibleBeatRange,
}: {
  controller: PreviewPlaybackController;
  layer: KeyframeLayer;
  loopLengthBeats: number;
  palette: readonly PaletteToken[];
  snap: TimelineSnap;
  timeSignatureNumerator: number;
  selectedKeyframes: readonly KeyframeReference[];
  visibleBeatRange: { endBeat: number; startBeat: number };
  onAddKeyframe: (beat: number, value: KeyframeValue) => void;
  onSelectKeyframes: (
    keyframes: KeyframeReference[],
    primary: KeyframeReference,
  ) => void;
  onOpenContextMenu: (
    event: MouseEvent<HTMLButtonElement>,
    keyframes: KeyframeReference[],
  ) => void;
  onUpdateKeyframes: (
    keyframes: KeyframeMove[],
    options?: ExecuteEditorCommandOptions,
  ) => void;
}) {
  const playheadBeat = Math.min(
    loopLengthBeats,
    snapTimelineBeat(
      usePreviewPlaybackQuarterBeat(controller),
      snap,
      timeSignatureNumerator,
    ),
  );
  const playheadInWindow =
    playheadBeat >= layer.startBeat && playheadBeat <= layer.endBeat;
  const [choosingColour, setChoosingColour] = useState(false);
  const dragRef = useRef<KeyframeDragState | null>(null);
  const interaction =
    useRafGroupedInteraction<KeyframeMove[]>(onUpdateKeyframes);

  function keyframeBeat(reference: KeyframeReference): number | null {
    return (
      layer.tracks[reference.track].keyframes.find(
        ({ id }) => id === reference.id,
      )?.beat ?? null
    );
  }

  function selectionForClick(
    event: Pick<MouseEvent | PointerEvent, 'ctrlKey' | 'metaKey' | 'shiftKey'>,
    track: KeyframeTrackKind,
    id: string,
    beat: number,
  ): KeyframeReference[] {
    const clicked = { id, track };
    if (event.metaKey || event.ctrlKey) {
      const exists = selectedKeyframes.some(
        (reference) => reference.id === id && reference.track === track,
      );
      const next = exists
        ? selectedKeyframes.filter(
            (reference) => reference.id !== id || reference.track !== track,
          )
        : [...selectedKeyframes, clicked];
      return next.length > 0 ? next : [clicked];
    }
    if (event.shiftKey) {
      const anchor = selectedKeyframes.at(-1);
      const anchorBeat = anchor?.track === track ? keyframeBeat(anchor) : null;
      if (anchorBeat !== null)
        return layer.tracks[track].keyframes
          .filter(
            (keyframe) =>
              keyframe.beat >= Math.min(anchorBeat, beat) &&
              keyframe.beat <= Math.max(anchorBeat, beat),
          )
          .map((keyframe) => ({ id: keyframe.id, track }));
    }
    return [clicked];
  }

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
    const selected = selectionForClick(event, track, id, beat);
    onSelectKeyframes(selected, { id, track });
    dragRef.current = {
      keyframes: selected.map((reference) => ({
        ...reference,
        startBeat: keyframeBeat(reference)!,
      })),
      startClientX: event.clientX,
      width: trackElement.getBoundingClientRect().width,
    };
    interaction.begin();
  }

  function moveKeyframeDrag(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const rawDelta =
      ((event.clientX - drag.startClientX) / drag.width) * loopLengthBeats;
    const snappedDelta = snapTimelineBeat(
      rawDelta,
      snap,
      timeSignatureNumerator,
    );
    const minimumBeat = Math.min(
      ...drag.keyframes.map(({ startBeat }) => startBeat),
    );
    const maximumBeat = Math.max(
      ...drag.keyframes.map(({ startBeat }) => startBeat),
    );
    const delta = Math.max(
      -minimumBeat,
      Math.min(loopLengthBeats - maximumBeat, snappedDelta),
    );
    const moves = drag.keyframes.map(({ id, startBeat, track }) => ({
      beat: startBeat + delta,
      id,
      track,
    }));
    const selectedIds = new Set(
      drag.keyframes.map(({ id, track }) => `${track}:${id}`),
    );
    const occupied = moves.some((move) =>
      layer.tracks[move.track].keyframes.some(
        (keyframe) =>
          !selectedIds.has(`${move.track}:${keyframe.id}`) &&
          keyframe.beat === move.beat,
      ),
    );
    if (!occupied) interaction.update(moves);
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
  ) {
    if (
      layer.locked ||
      (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')
    )
      return;
    event.preventDefault();
    const baseStep = event.altKey
      ? 0.25
      : event.shiftKey
        ? snap === 0.25 || snap === 0.5
          ? 1
          : timeSignatureNumerator
        : timelineSnapStep(snap, timeSignatureNumerator);
    const delta = baseStep * (event.key === 'ArrowLeft' ? -1 : 1);
    const activeSelection = selectedKeyframes.some(
      (reference) => reference.id === id && reference.track === track,
    )
      ? selectedKeyframes
      : [{ id, track }];
    const beats = activeSelection.map((reference) => ({
      ...reference,
      beat: keyframeBeat(reference)!,
    }));
    const minimum = Math.min(...beats.map((keyframe) => keyframe.beat));
    const maximum = Math.max(...beats.map((keyframe) => keyframe.beat));
    const boundedDelta = Math.max(
      -minimum,
      Math.min(loopLengthBeats - maximum, delta),
    );
    onUpdateKeyframes(
      beats.map((keyframe) => ({
        ...keyframe,
        beat: keyframe.beat + boundedDelta,
      })),
    );
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
  const visibleBrightnessKeyframes = useMemo(
    () =>
      keyframesAroundVisibleRange(
        activeBrightnessKeyframes,
        visibleBeatRange.startBeat,
        visibleBeatRange.endBeat,
      ),
    [activeBrightnessKeyframes, visibleBeatRange],
  );
  const visibleColourTrack = useMemo(
    () => ({
      ...layer.tracks.colour,
      keyframes: keyframesAroundVisibleRange(
        keyframesInActiveWindow(
          layer.tracks.colour.keyframes,
          layer.startBeat,
          layer.endBeat,
        ),
        visibleBeatRange.startBeat,
        visibleBeatRange.endBeat,
      ),
    }),
    [layer.endBeat, layer.startBeat, layer.tracks.colour, visibleBeatRange],
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
        aria-pressed={selectedKeyframes.some(
          (reference) =>
            reference.id === keyframe.id && reference.track === track,
        )}
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
        onClick={(event) => {
          if (event.detail !== 0) return;
          if (
            !event.metaKey &&
            !event.ctrlKey &&
            !event.shiftKey &&
            selectedKeyframes.length > 1 &&
            selectedKeyframes.some(
              (reference) =>
                reference.id === keyframe.id && reference.track === track,
            )
          )
            return;
          onSelectKeyframes(
            selectionForClick(event, track, keyframe.id, keyframe.beat),
            { id: keyframe.id, track },
          );
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          const selection = selectedKeyframes.some(
            (reference) =>
              reference.id === keyframe.id && reference.track === track,
          )
            ? [...selectedKeyframes]
            : selectionForClick(event, track, keyframe.id, keyframe.beat);
          onSelectKeyframes(selection, { id: keyframe.id, track });
          onOpenContextMenu(event, selection);
        }}
        onKeyDown={(event) => handleKeyframeKey(event, track, keyframe.id)}
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
                onSelectKeyframes(
                  [{ id: brightnessAtPlayheadKey.id, track: 'brightness' }],
                  { id: brightnessAtPlayheadKey.id, track: 'brightness' },
                );
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
            keyframes={visibleBrightnessKeyframes}
            loopLengthBeats={loopLengthBeats}
            startBeat={layer.startBeat}
          />
          {layer.tracks.brightness.keyframes
            .filter(
              ({ beat }) =>
                beat >= visibleBeatRange.startBeat &&
                beat <= visibleBeatRange.endBeat,
            )
            .map((keyframe) => diamond('brightness', keyframe))}
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
                onSelectKeyframes(
                  [{ id: colourAtPlayheadKey.id, track: 'colour' }],
                  { id: colourAtPlayheadKey.id, track: 'colour' },
                );
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
            track={visibleColourTrack}
          />
          {layer.tracks.colour.keyframes
            .filter(
              ({ beat }) =>
                beat >= visibleBeatRange.startBeat &&
                beat <= visibleBeatRange.endBeat,
            )
            .map((keyframe) => diamond('colour', keyframe))}
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
  onKeyframeAction,
  onLayerAction,
  onSelectKeyframes,
  onSelectLayer,
  onToggleKeyframeLayer,
  onTimelinePixelsPerBeatChange,
  onTimelineSnapChange,
  onTimelineZoomModeChange,
  onUpdateKeyframes,
  onUpdateLayer,
  palette,
  scene,
  selectedKeyframes,
  selectedLayerId,
  snap,
  timing,
  timelinePixelsPerBeat,
  timelineZoomMode,
}: SceneTimelineProps) {
  const dragRef = useRef<DragState | null>(null);
  const reorderRef = useRef<ReorderDragState | null>(null);
  const rulerRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [draggingLayerId, setDraggingLayerId] = useState<string | null>(null);
  const [dropSlot, setDropSlot] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<
    | {
        keyframes: KeyframeReference[];
        kind: 'keyframes';
        layerId: string;
        point: { x: number; y: number };
      }
    | {
        kind: 'layer';
        layerId: string;
        point: { x: number; y: number };
      }
    | null
  >(null);
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
  const minimumWidth =
    timelineZoomMode === 'fit'
      ? 480
      : Math.max(
          480,
          TIMELINE_LABEL_GUTTER + scene.loopLengthBeats * timelinePixelsPerBeat,
        );
  const barCount = scene.loopLengthBeats / timing.timeSignature.numerator;
  const contextLayer = contextMenu
    ? scene.layers.find(({ id }) => id === contextMenu.layerId)
    : null;
  const contextItems: ContextMenuItem[] = contextMenu
    ? contextMenu.kind === 'keyframes'
      ? [
          {
            label: 'Copy keyframes',
            onSelect: () =>
              onKeyframeAction(
                'copy',
                contextMenu.layerId,
                contextMenu.keyframes,
              ),
          },
          {
            disabled: contextLayer?.locked,
            label: 'Cut keyframes',
            onSelect: () =>
              onKeyframeAction(
                'cut',
                contextMenu.layerId,
                contextMenu.keyframes,
              ),
          },
          {
            disabled: contextLayer?.locked,
            label: 'Paste at playhead',
            onSelect: () => onKeyframeAction('paste', contextMenu.layerId, []),
          },
          {
            disabled: contextLayer?.locked,
            label: 'Duplicate keyframes',
            onSelect: () =>
              onKeyframeAction(
                'duplicate',
                contextMenu.layerId,
                contextMenu.keyframes,
              ),
          },
          {
            disabled: contextLayer?.locked,
            label: 'Delete keyframes',
            onSelect: () =>
              onKeyframeAction(
                'delete',
                contextMenu.layerId,
                contextMenu.keyframes,
              ),
          },
        ]
      : [
          {
            label: 'Copy layer',
            onSelect: () => onLayerAction('copy', contextMenu.layerId),
          },
          {
            disabled: contextLayer?.locked,
            label: 'Cut layer',
            onSelect: () => onLayerAction('cut', contextMenu.layerId),
          },
          {
            label: 'Paste after layer',
            onSelect: () => onLayerAction('paste', contextMenu.layerId),
          },
          {
            disabled: contextLayer?.locked,
            label: 'Duplicate layer',
            onSelect: () => onLayerAction('duplicate', contextMenu.layerId),
          },
          {
            disabled: contextLayer?.locked,
            label: 'Delete layer',
            onSelect: () => onLayerAction('delete', contextMenu.layerId),
          },
        ]
    : [];
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
  const visibleBeatRange = useMemo(
    () => calculateVisibleBeatRange(scene.loopLengthBeats, viewport),
    [scene.loopLengthBeats, viewport],
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
        Math.min(
          scene.loopLengthBeats - duration,
          snapTimelineBeat(
            startBeat + delta,
            snap,
            timing.timeSignature.numerator,
          ),
        ),
      );
      endBeat = startBeat + duration;
    } else if (drag.mode === 'start') {
      startBeat = Math.max(
        0,
        Math.min(
          endBeat - 0.25,
          snapTimelineBeat(
            startBeat + delta,
            snap,
            timing.timeSignature.numerator,
          ),
        ),
      );
    } else {
      endBeat = Math.max(
        startBeat + 0.25,
        Math.min(
          scene.loopLengthBeats,
          snapTimelineBeat(
            endBeat + delta,
            snap,
            timing.timeSignature.numerator,
          ),
        ),
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
    const delta = snapTimelineBeat(
      ((event.clientX - drag.startClientX) / drag.width) *
        scene.loopLengthBeats,
      snap,
      timing.timeSignature.numerator,
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
    const baseStep = event.altKey
      ? 0.25
      : event.shiftKey
        ? snap === 0.25 || snap === 0.5
          ? 1
          : timing.timeSignature.numerator
        : timelineSnapStep(snap, timing.timeSignature.numerator);
    const delta = baseStep * (event.key === 'ArrowLeft' ? -1 : 1);
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

  function changeZoom(multiplier: number) {
    const scroll = scrollRef.current;
    const ruler = rulerRef.current;
    const effectiveScale =
      timelineZoomMode === 'fit' && scroll
        ? Math.max(
            16,
            (scroll.clientWidth - TIMELINE_LABEL_GUTTER) /
              scene.loopLengthBeats,
          )
        : timelinePixelsPerBeat;
    const next = Math.min(320, Math.max(16, effectiveScale * multiplier));
    const centreBeat =
      scroll && ruler
        ? ((scroll.scrollLeft +
            scroll.clientWidth / 2 -
            TIMELINE_LABEL_GUTTER) /
            Math.max(1, ruler.clientWidth - TIMELINE_LABEL_GUTTER)) *
          scene.loopLengthBeats
        : 0;
    onTimelinePixelsPerBeatChange(next);
    requestAnimationFrame(() => {
      if (!scrollRef.current) return;
      scrollRef.current.scrollLeft = Math.max(
        0,
        TIMELINE_LABEL_GUTTER +
          centreBeat * next -
          scrollRef.current.clientWidth / 2,
      );
    });
  }

  function fitScene() {
    onTimelineZoomModeChange('fit');
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollLeft = 0;
    });
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
              onTimelineSnapChange(
                value === 'bar' ? 'bar' : (Number(value) as 0.25 | 0.5 | 1),
              )
            }
          />
          <div className="timeline-zoom-controls" aria-label="Timeline zoom">
            <button
              aria-label="Zoom timeline out"
              type="button"
              onClick={() => changeZoom(0.8)}
            >
              −
            </button>
            <button
              type="button"
              aria-pressed={timelineZoomMode === 'fit'}
              onClick={fitScene}
            >
              Fit
            </button>
            <button
              aria-label="Zoom timeline in"
              type="button"
              onClick={() => changeZoom(1.25)}
            >
              +
            </button>
          </div>
        </div>
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
                      onContextMenu={(event) => {
                        event.preventDefault();
                        onSelectLayer(layer.id);
                        setContextMenu({
                          kind: 'layer',
                          layerId: layer.id,
                          point: { x: event.clientX, y: event.clientY },
                        });
                      }}
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
                      ]
                        .filter(
                          ({ beat }) =>
                            beat >= visibleBeatRange.startBeat &&
                            beat <= visibleBeatRange.endBeat,
                        )
                        .map((keyframe) => {
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
                    snap={snap}
                    selectedKeyframes={selectedKeyframes.filter((reference) =>
                      layer.tracks[reference.track].keyframes.some(
                        ({ id }) => id === reference.id,
                      ),
                    )}
                    timeSignatureNumerator={timing.timeSignature.numerator}
                    visibleBeatRange={visibleBeatRange}
                    onAddKeyframe={(beat, value) =>
                      onAddKeyframe(layer.id, beat, value)
                    }
                    onSelectKeyframes={(keyframes, primary) =>
                      onSelectKeyframes(layer.id, keyframes, primary)
                    }
                    onOpenContextMenu={(event, keyframes) =>
                      setContextMenu({
                        keyframes,
                        kind: 'keyframes',
                        layerId: layer.id,
                        point: { x: event.clientX, y: event.clientY },
                      })
                    }
                    onUpdateKeyframes={(keyframes, options) =>
                      onUpdateKeyframes(layer.id, keyframes, options)
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
      <ContextMenu
        items={contextItems}
        point={contextMenu?.point ?? null}
        onClose={() => setContextMenu(null)}
      />
    </div>
  );
}
