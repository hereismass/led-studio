import type { PaletteToken, SceneLayer } from '@led-studio/project-format';
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react';
import { displayNumber } from './timelineFormat';

export type TimelineLayerDragMode = 'move' | 'start' | 'end';

interface TimelineLayerRowProps {
  dragging: boolean;
  expanded: boolean;
  layer: SceneLayer;
  loopLengthBeats: number;
  palette: readonly PaletteToken[];
  selected: boolean;
  visibleBeatRange: { endBeat: number; startBeat: number };
  onBeginDrag: (
    event: PointerEvent<HTMLButtonElement>,
    mode: TimelineLayerDragMode,
  ) => void;
  onBeginReorder: (event: PointerEvent<HTMLButtonElement>) => void;
  onEndDrag: () => void;
  onEndReorder: (commit: boolean) => void;
  onLayerKey: (
    event: KeyboardEvent<HTMLButtonElement>,
    mode: TimelineLayerDragMode,
  ) => void;
  onMoveDrag: (event: PointerEvent<HTMLButtonElement>) => void;
  onMoveReorder: (event: PointerEvent<HTMLButtonElement>) => void;
  onOpenContextMenu: (event: MouseEvent<HTMLButtonElement>) => void;
  onReorderKey: (event: KeyboardEvent<HTMLButtonElement>) => void;
  onSelect: () => void;
  onToggle: () => void;
}

export function TimelineLayerRow({
  dragging,
  expanded,
  layer,
  loopLengthBeats,
  onBeginDrag,
  onBeginReorder,
  onEndDrag,
  onEndReorder,
  onLayerKey,
  onMoveDrag,
  onMoveReorder,
  onOpenContextMenu,
  onReorderKey,
  onSelect,
  onToggle,
  palette,
  selected,
  visibleBeatRange,
}: TimelineLayerRowProps) {
  return (
    <div
      className={`scene-track-row scene-effect-row ${dragging ? 'scene-effect-row-dragging' : ''}`}
    >
      <div className="scene-track-label scene-effect-track-label">
        {layer.kind === 'keyframe' ? (
          <button
            className="keyframe-disclosure-button"
            type="button"
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${layer.name} tracks`}
            onClick={onToggle}
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
          onKeyDown={onReorderKey}
          onPointerDown={onBeginReorder}
          onPointerMove={onMoveReorder}
          onPointerUp={() => onEndReorder(true)}
          onPointerCancel={() => onEndReorder(false)}
        >
          ⠿
        </button>
        <button
          className="scene-track-select"
          type="button"
          aria-label={layer.name}
          aria-pressed={selected}
          onClick={onSelect}
          onContextMenu={onOpenContextMenu}
        >
          {layer.locked ? <span aria-hidden="true">🔒 </span> : null}
          {layer.name}
        </button>
      </div>
      {layer.kind === 'keyframe' ? (
        <span className="keyframe-overview" aria-hidden="true">
          {[
            ...layer.tracks.brightness.keyframes.map((keyframe) => ({
              ...keyframe,
              track: 'brightness' as const,
            })),
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
                    left: `${(keyframe.beat / loopLengthBeats) * 100}%`,
                    ...('paletteTokenId' in keyframe
                      ? {
                          backgroundColor: palette.find(
                            ({ id }) => id === keyframe.paletteTokenId,
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
        className={`effect-layer-bar effect-layer-${layer.kind === 'effect' ? layer.effect.type : 'keyframe'} ${selected ? 'effect-layer-selected' : ''} ${!layer.enabled ? 'effect-layer-disabled' : ''}`}
        style={{
          left: `${(layer.startBeat / loopLengthBeats) * 100}%`,
          width: `${((layer.endBeat - layer.startBeat) / loopLengthBeats) * 100}%`,
        }}
      >
        <button
          className="effect-layer-handle effect-layer-start-handle"
          type="button"
          aria-label={`Resize start of ${layer.name}`}
          disabled={layer.locked}
          onKeyDown={(event) => onLayerKey(event, 'start')}
          onPointerDown={(event) => onBeginDrag(event, 'start')}
          onPointerMove={onMoveDrag}
          onPointerUp={onEndDrag}
          onPointerCancel={onEndDrag}
        />
        <button
          className="effect-layer-body"
          type="button"
          aria-label={`${layer.name}, ${layer.kind === 'effect' ? `${layer.effect.type} effect, ` : 'keyframes, '}${displayNumber(layer.startBeat)} to ${displayNumber(layer.endBeat)} beats`}
          onClick={onSelect}
          onKeyDown={(event) => onLayerKey(event, 'move')}
          onPointerDown={(event) => onBeginDrag(event, 'move')}
          onPointerMove={onMoveDrag}
          onPointerUp={onEndDrag}
          onPointerCancel={onEndDrag}
        >
          {layer.kind === 'effect' ? layer.effect.type : 'keyframes'}
        </button>
        <button
          className="effect-layer-handle effect-layer-end-handle"
          type="button"
          aria-label={`Resize end of ${layer.name}`}
          disabled={layer.locked}
          onKeyDown={(event) => onLayerKey(event, 'end')}
          onPointerDown={(event) => onBeginDrag(event, 'end')}
          onPointerMove={onMoveDrag}
          onPointerUp={onEndDrag}
          onPointerCancel={onEndDrag}
        />
      </div>
    </div>
  );
}
