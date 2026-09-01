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
import type { KeyframeLayer, PaletteToken } from '@led-studio/project-format';
import {
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import type { PreviewPlaybackController } from '@/features/playback/previewPlayback';
import { usePreviewPlaybackQuarterBeat } from '@/features/playback/usePreviewPlaybackSnapshot';
import { PaletteSwatches } from '@/shared/editor-ui/PaletteSwatches';
import { useRafGroupedInteraction } from '@/shared/hooks/useRafGroupedInteraction';
import { snapTimelineBeat, timelineSnapStep } from './timelineViewport';
import type { TimelineSnap } from './timelinePreferences';
import { BrightnessAutomation, ColourAutomation } from './TimelineAutomation';
import { displayNumber } from './timelineFormat';

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

export function KeyframeTrackRows({
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
