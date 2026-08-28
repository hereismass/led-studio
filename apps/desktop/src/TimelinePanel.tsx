import type {
  ExecuteEditorCommandOptions,
  KeyframeTrackKind,
  KeyframeValue,
} from '@led-studio/editor-core';
import type {
  PaletteToken,
  ProjectTiming,
  Scene,
  SceneLayer,
} from '@led-studio/project-format';
import type { PreviewPlaybackController } from './previewPlayback';
import { SceneTimeline } from './SceneTimeline';

interface TimelinePanelProps {
  collapsed: boolean;
  canAddEffect: boolean;
  controller: PreviewPlaybackController;
  expandedKeyframeLayerIds: string[];
  palette: readonly PaletteToken[];
  scene: Scene | null;
  timing: ProjectTiming;
  selectedKeyframeId: string | null;
  selectedLayerId: string | null;
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
  selectedKeyframeId,
  selectedLayerId,
  timing,
  onAddKeyframe,
  onAddLayer,
  onMoveLayer,
  onSelectKeyframe,
  onSelectLayer,
  onToggleKeyframeLayer,
  onUpdateKeyframe,
  onUpdateLayer,
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
              selectedKeyframeId={selectedKeyframeId}
              selectedLayerId={selectedLayerId}
              timing={timing}
              onAddKeyframe={onAddKeyframe}
              onAddLayer={onAddLayer}
              onMoveLayer={onMoveLayer}
              onSelectKeyframe={onSelectKeyframe}
              onSelectLayer={onSelectLayer}
              onToggleKeyframeLayer={onToggleKeyframeLayer}
              onUpdateKeyframe={onUpdateKeyframe}
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
