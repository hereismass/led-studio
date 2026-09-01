import type {
  ExecuteEditorCommandOptions,
  KeyframeReference,
  KeyframeTrackKind,
  SceneLayerChanges,
} from '@led-studio/editor-core';
import type {
  HardwareLed,
  HardwareProfile,
} from '@led-studio/hardware-profiles';
import type {
  BrightnessKeyframe,
  ColourKeyframe,
  KeyframeEasing,
  KeyframeLayer,
  PaletteToken,
  Project,
  ProjectGroup,
  Scene,
  SceneLayer,
  Song,
} from '@led-studio/project-format';
import { GroupInspector } from './GroupInspector';
import { LayerInspector } from './LayerInspector';
import { KeyframeInspector } from './KeyframeInspector';
import { LedSelectionInspector } from './LedSelectionInspector';
import { MultiKeyframeInspector } from './MultiKeyframeInspector';
import { PaletteInspector } from './PaletteInspector';
import { SceneInspector } from './SceneInspector';
import { SongInspector } from './SongInspector';
import type { InspectorTarget } from './inspectorTarget';

interface InspectorPanelProps {
  activeScene: Scene | null;
  collapsed: boolean;
  focusTokenId: string | null;
  inspectorTarget: InspectorTarget;
  palette: PaletteToken[];
  profile: HardwareProfile;
  project: Project;
  scenes: Scene[];
  selectedLedIds: string[];
  selectedLeds: HardwareLed[];
  selectedGroup: ProjectGroup | null;
  selectedLayer: SceneLayer | null;
  selectedKeyframe: BrightnessKeyframe | ColourKeyframe | null;
  selectedKeyframeLayer: KeyframeLayer | null;
  selectedKeyframeReferences: readonly KeyframeReference[];
  selectedKeyframeTrack: KeyframeTrackKind | null;
  canDuplicateKeyframe: boolean;
  selectedScene: Scene | null;
  selectedSong: Song | null;
  selectedToken: PaletteToken | null;
  tokenUsageCount: number;
  groupUsageCount: number;
  onBrightnessChange: (
    brightnessPercent: number,
    options?: ExecuteEditorCommandOptions,
  ) => void;
  onDeleteScene: () => void;
  onDeleteSong: () => void;
  onDeleteToken: () => void;
  onDeleteGroup: () => void;
  onDeleteLayer: () => void;
  onDeleteKeyframe: () => void;
  onDeleteKeyframes: () => void;
  onDuplicateScene: () => void;
  onDuplicateSong: () => void;
  onDuplicateToken: () => void;
  onDuplicateGroup: () => void;
  onDuplicateLayer: () => void;
  onDuplicateKeyframe: () => void;
  onDuplicateKeyframes: () => void;
  onCopyKeyframes: () => void;
  onMoveLayer: (toIndex: number) => void;
  onMoveSong: (toIndex: number) => void;
  onPaint: (paletteTokenId: string) => void;
  onToggle: () => void;
  onTurnOff: () => void;
  onSelectionChange: (ledIds: string[]) => void;
  onUpdateGroup: (
    changes: Partial<Pick<ProjectGroup, 'ledIds' | 'name'>>,
  ) => void;
  onUpdateLayer: (
    changes: SceneLayerChanges,
    options?: ExecuteEditorCommandOptions,
  ) => void;
  onUpdateKeyframe: (changes: {
    beat?: number;
    brightnessPercent?: number;
    easing?: KeyframeEasing;
    paletteTokenId?: string;
  }) => void;
  onSetKeyframeEasing: (
    easing: KeyframeEasing,
    keyframes: readonly KeyframeReference[],
  ) => void;
  onBackToLayer: () => void;
  onUpdateScene: (
    changes: Partial<Pick<Scene, 'loopLengthBeats' | 'name'>>,
  ) => void;
  onUpdateSong: (
    changes: Partial<Pick<Song, 'launchQuantization' | 'name' | 'timing'>>,
  ) => void;
  onUpdateToken: (
    changes: Partial<Pick<PaletteToken, 'name' | 'value'>>,
    options?: ExecuteEditorCommandOptions,
  ) => void;
}

export function InspectorPanel({
  activeScene,
  canDuplicateKeyframe,
  collapsed,
  focusTokenId,
  groupUsageCount,
  inspectorTarget,
  onBrightnessChange,
  onDeleteScene,
  onDeleteSong,
  onDeleteGroup,
  onDeleteLayer,
  onDeleteKeyframe,
  onDeleteKeyframes,
  onDeleteToken,
  onDuplicateScene,
  onDuplicateSong,
  onDuplicateGroup,
  onDuplicateLayer,
  onDuplicateKeyframe,
  onDuplicateKeyframes,
  onCopyKeyframes,
  onMoveLayer,
  onMoveSong,
  onDuplicateToken,
  onPaint,
  onSelectionChange,
  onToggle,
  onTurnOff,
  onUpdateScene,
  onUpdateSong,
  onUpdateGroup,
  onUpdateLayer,
  onUpdateKeyframe,
  onSetKeyframeEasing,
  onBackToLayer,
  onUpdateToken,
  palette,
  profile,
  project,
  scenes,
  selectedLedIds,
  selectedLeds,
  selectedGroup,
  selectedLayer,
  selectedKeyframe,
  selectedKeyframeLayer,
  selectedKeyframeReferences,
  selectedKeyframeTrack,
  selectedScene,
  selectedSong,
  selectedToken,
  tokenUsageCount,
}: InspectorPanelProps) {
  return (
    <aside
      className={`workspace-panel inspector-panel ${collapsed ? 'workspace-panel-collapsed' : ''}`}
      aria-label="Inspector"
    >
      <div className="workspace-panel-header">
        <button
          type="button"
          aria-label={
            collapsed ? 'Expand inspector panel' : 'Collapse inspector panel'
          }
          title={
            collapsed ? 'Expand inspector panel' : 'Collapse inspector panel'
          }
          onClick={onToggle}
        >
          {collapsed ? '‹' : '›'}
        </button>
        {collapsed ? null : <h2>Inspector</h2>}
      </div>
      {collapsed ? (
        <div className="collapsed-panel-label" aria-hidden="true">
          Inspector
        </div>
      ) : (
        <div className="inspector-content">
          {inspectorTarget.kind === 'leds' &&
          activeScene &&
          selectedLeds.length > 0 ? (
            <LedSelectionInspector
              leds={selectedLeds}
              palette={palette}
              scene={activeScene}
              onBrightnessChange={onBrightnessChange}
              onPaint={onPaint}
              onTurnOff={onTurnOff}
            />
          ) : selectedToken ? (
            <PaletteInspector
              key={selectedToken.id}
              focusName={focusTokenId === selectedToken.id}
              palette={palette}
              token={selectedToken}
              usageCount={tokenUsageCount}
              onDelete={onDeleteToken}
              onDuplicate={onDuplicateToken}
              onUpdate={onUpdateToken}
            />
          ) : selectedGroup ? (
            <GroupInspector
              group={selectedGroup}
              groupNames={project.groups}
              selectedLedIds={selectedLedIds}
              usageCount={groupUsageCount}
              onDelete={onDeleteGroup}
              onDuplicate={onDuplicateGroup}
              onSelectionChange={onSelectionChange}
              onUpdate={onUpdateGroup}
            />
          ) : inspectorTarget.kind === 'keyframes' &&
            selectedKeyframeLayer &&
            selectedKeyframeReferences.length > 1 ? (
            <MultiKeyframeInspector
              keyframes={selectedKeyframeReferences}
              layer={selectedKeyframeLayer}
              onBack={onBackToLayer}
              onCopy={onCopyKeyframes}
              onDelete={onDeleteKeyframes}
              onDuplicate={onDuplicateKeyframes}
              onSetEasing={onSetKeyframeEasing}
            />
          ) : selectedKeyframe &&
            selectedKeyframeLayer &&
            selectedKeyframeTrack &&
            activeScene ? (
            <KeyframeInspector
              canDuplicate={canDuplicateKeyframe}
              keyframe={selectedKeyframe}
              layer={selectedKeyframeLayer}
              palette={palette}
              scene={activeScene}
              track={selectedKeyframeTrack}
              onBack={onBackToLayer}
              onDelete={onDeleteKeyframe}
              onDuplicate={onDuplicateKeyframe}
              onUpdate={onUpdateKeyframe}
            />
          ) : selectedLayer && activeScene ? (
            <LayerInspector
              groups={project.groups}
              layer={selectedLayer}
              palette={palette}
              profile={profile}
              scene={activeScene}
              selectedLedIds={selectedLedIds}
              onDelete={onDeleteLayer}
              onDuplicate={onDuplicateLayer}
              onMove={onMoveLayer}
              onUpdate={onUpdateLayer}
            />
          ) : selectedSong ? (
            <SongInspector
              song={selectedSong}
              songs={project.songs}
              onDelete={onDeleteSong}
              onDuplicate={onDuplicateSong}
              onMove={onMoveSong}
              onUpdate={onUpdateSong}
            />
          ) : selectedScene ? (
            <SceneInspector
              scene={selectedScene}
              sceneNames={scenes}
              onDelete={onDeleteScene}
              onDuplicate={onDuplicateScene}
              onUpdate={onUpdateScene}
            />
          ) : (
            <>
              <section className="inspector-section">
                <p className="workspace-eyebrow">Project</p>
                <dl>
                  <div>
                    <dt>Profile</dt>
                    <dd>{profile.name}</dd>
                  </div>
                  <div>
                    <dt>LEDs</dt>
                    <dd>{profile.leds.length}</dd>
                  </div>
                  <div>
                    <dt>Format</dt>
                    <dd>Schema v{project.schemaVersion}</dd>
                  </div>
                  <div>
                    <dt>Timing</dt>
                    <dd>
                      {project.timing.previewBpm} BPM ·{' '}
                      {project.timing.timeSignature.numerator}/
                      {project.timing.timeSignature.denominator}
                    </dd>
                  </div>
                  <div>
                    <dt>Scenes</dt>
                    <dd>{scenes.length}</dd>
                  </div>
                </dl>
              </section>
              <div className="panel-placeholder">
                <span aria-hidden="true">◇</span>
                <div>
                  <strong>Nothing selected</strong>
                  <p>
                    Select a scene, palette colour, or fretboard LED to edit it.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
