import type { ExecuteEditorCommandOptions } from '@led-studio/editor-core';
import type {
  HardwareLed,
  HardwareProfile,
} from '@led-studio/hardware-profiles';
import type {
  EffectLayer,
  PaletteToken,
  Project,
  ProjectGroup,
  Scene,
} from '@led-studio/project-format';
import { GroupInspector } from './GroupInspector';
import { LayerInspector } from './LayerInspector';
import { LedSelectionInspector } from './LedSelectionInspector';
import { PaletteInspector } from './PaletteInspector';
import { SceneInspector } from './SceneInspector';
import type { InspectorTarget } from './useWorkspaceSelection';

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
  selectedLayer: EffectLayer | null;
  selectedScene: Scene | null;
  selectedToken: PaletteToken | null;
  tokenUsageCount: number;
  groupUsageCount: number;
  onBrightnessChange: (
    brightnessPercent: number,
    options?: ExecuteEditorCommandOptions,
  ) => void;
  onDeleteScene: () => void;
  onDeleteToken: () => void;
  onDeleteGroup: () => void;
  onDeleteLayer: () => void;
  onDuplicateScene: () => void;
  onDuplicateToken: () => void;
  onDuplicateGroup: () => void;
  onDuplicateLayer: () => void;
  onMoveLayer: (toIndex: number) => void;
  onPaint: (paletteTokenId: string) => void;
  onToggle: () => void;
  onTurnOff: () => void;
  onSelectionChange: (ledIds: string[]) => void;
  onUpdateGroup: (
    changes: Partial<Pick<ProjectGroup, 'ledIds' | 'name'>>,
  ) => void;
  onUpdateLayer: (
    changes: Partial<Omit<EffectLayer, 'id'>>,
    options?: ExecuteEditorCommandOptions,
  ) => void;
  onUpdateScene: (
    changes: Partial<Pick<Scene, 'loopLengthBeats' | 'name'>>,
  ) => void;
  onUpdateToken: (
    changes: Partial<Pick<PaletteToken, 'name' | 'value'>>,
    options?: ExecuteEditorCommandOptions,
  ) => void;
}

export function InspectorPanel({
  activeScene,
  collapsed,
  focusTokenId,
  groupUsageCount,
  inspectorTarget,
  onBrightnessChange,
  onDeleteScene,
  onDeleteGroup,
  onDeleteLayer,
  onDeleteToken,
  onDuplicateScene,
  onDuplicateGroup,
  onDuplicateLayer,
  onMoveLayer,
  onDuplicateToken,
  onPaint,
  onSelectionChange,
  onToggle,
  onTurnOff,
  onUpdateScene,
  onUpdateGroup,
  onUpdateLayer,
  onUpdateToken,
  palette,
  profile,
  project,
  scenes,
  selectedLedIds,
  selectedLeds,
  selectedGroup,
  selectedLayer,
  selectedScene,
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
