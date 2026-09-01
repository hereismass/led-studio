import type {
  ExecuteEditorCommandOptions,
  KeyframeMove,
  KeyframeReference,
  KeyframeValue,
  SceneLayerTemplateId,
} from '@led-studio/editor-core';
import type {
  PaletteToken,
  ProjectTiming,
  Scene,
  SceneLayer,
  Song,
  SongCue,
} from '@led-studio/project-format';
import type { PreviewPlaybackController } from '@/features/playback/previewPlayback';
import { SceneTimeline } from './SceneTimeline';
import { SongCueTimeline } from './SongCueTimeline';
import type { TimelineSnap, TimelineZoomMode } from './timelinePreferences';

interface TimelinePanelProps {
  activeTab: 'scene' | 'song';
  activeCueId: string | null;
  collapsed: boolean;
  canAddEffect: boolean;
  controller: PreviewPlaybackController;
  expandedKeyframeLayerIds: string[];
  palette: readonly PaletteToken[];
  scene: Scene | null;
  scenes: readonly Scene[];
  song: Song | null;
  timing: ProjectTiming;
  selectedKeyframes: readonly KeyframeReference[];
  selectedLayerId: string | null;
  snap: TimelineSnap;
  timelinePixelsPerBeat: number;
  timelineZoomMode: TimelineZoomMode;
  onAddCue: (sceneId: string) => void;
  onAddKeyframe: (layerId: string, beat: number, value: KeyframeValue) => void;
  onAddLayer: (type: SceneLayerTemplateId) => void;
  onDeleteCue: (id: string) => void;
  onDuplicateCue: (id: string) => void;
  onMoveCue: (id: string, toIndex: number) => void;
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
  onSelectCue: (id: string) => void;
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
  onUpdateCue: (
    id: string,
    changes: Partial<Pick<SongCue, 'advance' | 'name' | 'sceneId'>>,
  ) => void;
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
  onTabChange: (tab: 'scene' | 'song') => void;
}

export function TimelinePanel(props: TimelinePanelProps) {
  const {
    activeCueId,
    activeTab,
    canAddEffect,
    collapsed,
    controller,
    expandedKeyframeLayerIds,
    palette,
    scene,
    scenes,
    selectedKeyframes,
    selectedLayerId,
    snap,
    song,
    timelinePixelsPerBeat,
    timelineZoomMode,
    timing,
  } = props;

  return (
    <section
      className={`timeline-panel ${collapsed ? 'timeline-panel-collapsed' : ''}`}
      aria-label="Timeline"
    >
      <div
        className="timeline-tabs"
        role="tablist"
        aria-label="Editor timeline"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'scene'}
          onClick={() => props.onTabChange('scene')}
        >
          Scene timeline
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'song'}
          disabled={!song}
          onClick={() => props.onTabChange('song')}
        >
          Song cues
        </button>
        <button
          className="timeline-collapse-button"
          type="button"
          aria-label={collapsed ? 'Expand timeline' : 'Collapse timeline'}
          title={collapsed ? 'Expand timeline' : 'Collapse timeline'}
          onClick={props.onToggle}
        >
          {collapsed ? '⌃' : '⌄'}
        </button>
      </div>
      {collapsed ? null : (
        <div
          className="timeline-content"
          role="tabpanel"
          aria-label={activeTab === 'scene' ? 'Scene timeline' : 'Song cues'}
        >
          {activeTab === 'song' && song ? (
            <SongCueTimeline
              activeCueId={activeCueId}
              scenes={scenes}
              song={song}
              onAddCue={props.onAddCue}
              onDeleteCue={props.onDeleteCue}
              onDuplicateCue={props.onDuplicateCue}
              onMoveCue={props.onMoveCue}
              onSelectCue={props.onSelectCue}
              onUpdateCue={props.onUpdateCue}
            />
          ) : scene ? (
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
              onAddKeyframe={props.onAddKeyframe}
              onAddLayer={props.onAddLayer}
              onMoveLayer={props.onMoveLayer}
              onKeyframeAction={props.onKeyframeAction}
              onLayerAction={props.onLayerAction}
              onSelectKeyframes={props.onSelectKeyframes}
              onSelectLayer={props.onSelectLayer}
              onToggleKeyframeLayer={props.onToggleKeyframeLayer}
              onTimelinePixelsPerBeatChange={
                props.onTimelinePixelsPerBeatChange
              }
              onTimelineSnapChange={props.onTimelineSnapChange}
              onTimelineZoomModeChange={props.onTimelineZoomModeChange}
              onUpdateKeyframes={props.onUpdateKeyframes}
              onUpdateLayer={props.onUpdateLayer}
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
