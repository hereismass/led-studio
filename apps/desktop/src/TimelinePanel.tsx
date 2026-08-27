import type { ExecuteEditorCommandOptions } from '@led-studio/editor-core';
import type {
  EffectLayer,
  ProjectTiming,
  Scene,
} from '@led-studio/project-format';
import type { PreviewPlaybackController } from './previewPlayback';
import { SceneTimeline } from './SceneTimeline';

interface TimelinePanelProps {
  collapsed: boolean;
  canAddEffect: boolean;
  controller: PreviewPlaybackController;
  scene: Scene | null;
  timing: ProjectTiming;
  selectedLayerId: string | null;
  onAddLayer: (type: 'pulse' | 'chase') => void;
  onSelectLayer: (id: string) => void;
  onUpdateLayer: (
    id: string,
    changes: Pick<EffectLayer, 'endBeat' | 'startBeat'>,
    options?: ExecuteEditorCommandOptions,
  ) => void;
  onToggle: () => void;
}

export function TimelinePanel({
  canAddEffect,
  collapsed,
  controller,
  onToggle,
  scene,
  selectedLayerId,
  timing,
  onAddLayer,
  onSelectLayer,
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
              scene={scene}
              selectedLayerId={selectedLayerId}
              timing={timing}
              onAddLayer={onAddLayer}
              onSelectLayer={onSelectLayer}
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
