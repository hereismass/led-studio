import type {
  ExecuteEditorCommandOptions,
  KeyframeMove,
  KeyframeReference,
  KeyframeValue,
} from '@led-studio/editor-core';
import type {
  PaletteToken,
  ProjectTiming,
  Scene,
  SceneLayer,
} from '@led-studio/project-format';
import {
  Fragment,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import type { PreviewPlaybackController } from '@/features/playback/previewPlayback';
import { useRafGroupedInteraction } from '@/shared/hooks/useRafGroupedInteraction';
import { ContextMenu, type ContextMenuItem } from '@/shared/ui/ContextMenu';
import { KeyframeTrackRows } from './KeyframeTrackRows';
import { TimelineHeader } from './TimelineHeader';
import {
  TimelineLayerRow,
  type TimelineLayerDragMode,
} from './TimelineLayerRow';
import { SceneTimelineScrubber } from './TimelinePlayback';
import {
  calculateVisibleBeatRange,
  calculateVisibleTimelineLabels,
  snapTimelineBeat,
  timelineSnapStep,
  TIMELINE_LABEL_GUTTER,
  useTimelineViewport,
} from './timelineViewport';
import type { TimelineSnap, TimelineZoomMode } from './timelinePreferences';

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

interface DragState {
  endBeat: number;
  id: string;
  mode: TimelineLayerDragMode;
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
    mode: TimelineLayerDragMode,
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
    mode: TimelineLayerDragMode,
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
      <TimelineHeader
        barCount={barCount}
        canAddEffect={canAddEffect}
        controller={controller}
        loopLengthBeats={scene.loopLengthBeats}
        sceneName={scene.name}
        snap={snap}
        timing={timing}
        zoomMode={timelineZoomMode}
        onAddLayer={onAddLayer}
        onFitScene={fitScene}
        onSnapChange={onTimelineSnapChange}
        onZoom={changeZoom}
      />
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
                <TimelineLayerRow
                  dragging={draggingLayerId === layer.id}
                  expanded={expanded}
                  layer={layer}
                  loopLengthBeats={scene.loopLengthBeats}
                  palette={palette}
                  selected={selectedLayerId === layer.id}
                  visibleBeatRange={visibleBeatRange}
                  onBeginDrag={(event, mode) => beginDrag(event, layer, mode)}
                  onBeginReorder={(event) => beginReorder(event, layer, index)}
                  onEndDrag={endDrag}
                  onEndReorder={endReorder}
                  onLayerKey={(event, mode) =>
                    handleLayerKey(event, layer, mode)
                  }
                  onMoveDrag={moveDrag}
                  onMoveReorder={moveReorder}
                  onOpenContextMenu={(event) => {
                    event.preventDefault();
                    onSelectLayer(layer.id);
                    setContextMenu({
                      kind: 'layer',
                      layerId: layer.id,
                      point: { x: event.clientX, y: event.clientY },
                    });
                  }}
                  onReorderKey={(event) =>
                    handleReorderKey(event, layer, index)
                  }
                  onSelect={() => onSelectLayer(layer.id)}
                  onToggle={() => onToggleKeyframeLayer(layer.id)}
                />
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
