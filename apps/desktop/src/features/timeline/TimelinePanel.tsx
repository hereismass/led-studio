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
import type { PreviewPlaybackController } from '@/features/playback/previewPlayback';
import { SceneTimeline } from './SceneTimeline';
import type { TimelineSnap, TimelineZoomMode } from './timelinePreferences';

interface TimelinePanelProps {
  collapsed: boolean;
  canAddEffect: boolean;
  controller: PreviewPlaybackController;
  expandedKeyframeLayerIds: string[];
  palette: readonly PaletteToken[];
  scene: Scene | null;
  timing: ProjectTiming;
  selectedKeyframes: readonly KeyframeReference[];
  selectedLayerId: string | null;
  snap: TimelineSnap;
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
  onToggle: () => void;
}

export function TimelinePanel({
  canAddEffect,
  collapsed,
  controller,
  expandedKeyframeLayerIds,
  palette,
  onToggle,
  scene,
  selectedKeyframes,
  selectedLayerId,
  timing,
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
  snap,
  timelinePixelsPerBeat,
  timelineZoomMode,
}: TimelinePanelProps) {
  return (
    <section
      className={`timeline-panel ${collapsed ? 'timeline-panel-collapsed' : ''}`}
      aria-label="Timeline"
    >
      <div className="timeline-tabs">
        <strong>Scene timeline</strong>
        <button
          className="timeline-collapse-button"
          type="button"
          aria-label={collapsed ? 'Expand timeline' : 'Collapse timeline'}
          title={collapsed ? 'Expand timeline' : 'Collapse timeline'}
          onClick={onToggle}
        >
          {collapsed ? '⌃' : '⌄'}
        </button>
      </div>
      {collapsed ? null : (
        <div
          className="timeline-content"
          role="tabpanel"
          aria-label="Scene timeline"
        >
          {scene ? (
            <SceneTimeline
              canAddEffect={canAddEffect}
              controller={controller}
              expandedKeyframeLayerIds={expandedKeyframeLayerIds}
              palette={palette}
              scene={scene}
              selectedKeyframes={selectedKeyframes}
              selectedLayerId={selectedLayerId}
              snap={snap}
              timing={timing}
              timelinePixelsPerBeat={timelinePixelsPerBeat}
              timelineZoomMode={timelineZoomMode}
              onAddKeyframe={onAddKeyframe}
              onAddLayer={onAddLayer}
              onMoveLayer={onMoveLayer}
              onKeyframeAction={onKeyframeAction}
              onLayerAction={onLayerAction}
              onSelectKeyframes={onSelectKeyframes}
              onSelectLayer={onSelectLayer}
              onToggleKeyframeLayer={onToggleKeyframeLayer}
              onTimelinePixelsPerBeatChange={onTimelinePixelsPerBeatChange}
              onTimelineSnapChange={onTimelineSnapChange}
              onTimelineZoomModeChange={onTimelineZoomModeChange}
              onUpdateKeyframes={onUpdateKeyframes}
              onUpdateLayer={onUpdateLayer}
            />
          ) : (
            <div className="panel-placeholder">
              <span aria-hidden="true">◇</span>
              <div>
                <strong>Select a scene to view its loop</strong>
                <p>Create or select a scene to use preview playback.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
