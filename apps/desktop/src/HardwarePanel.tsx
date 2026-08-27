import type { HardwareProfile } from '@led-studio/hardware-profiles';
import type {
  PaletteToken,
  ProjectGroup,
  Scene,
} from '@led-studio/project-format';
import type { PreviewPlaybackController } from './previewPlayback';
import { SceneFretboard } from './SceneFretboard';
import type { ResizablePanel } from './useWorkspaceLayout';

interface HardwarePanelProps {
  controller: PreviewPlaybackController;
  groups: ProjectGroup[];
  palette: PaletteToken[];
  profile: HardwareProfile;
  scene: Scene | null;
  selectedLedIds: string[];
  onResetLayout: () => void;
  onSelectGroup: (
    ledIds: string[],
    additive: boolean,
    source: { id: string; kind: 'profile-group' | 'project-group' },
  ) => void;
  onSelectionChange: (ledIds: string[]) => void;
  onTogglePanel: (panel: ResizablePanel) => void;
}

export function HardwarePanel({
  controller,
  groups,
  onResetLayout,
  onSelectGroup,
  onSelectionChange,
  onTogglePanel,
  palette,
  profile,
  scene,
  selectedLedIds,
}: HardwarePanelProps) {
  return (
    <section className="hardware-workspace" aria-labelledby="hardware-title">
      <div className="hardware-workspace-heading">
        <div>
          <p className="workspace-eyebrow">Hardware editor</p>
          <h2 id="hardware-title">{scene?.name ?? profile.name}</h2>
        </div>
        <div className="workspace-view-actions" aria-label="Workspace panels">
          <button type="button" onClick={() => onTogglePanel('left')}>
            Assets
          </button>
          <button type="button" onClick={() => onTogglePanel('right')}>
            Inspector
          </button>
          <button type="button" onClick={() => onTogglePanel('bottom')}>
            Timeline
          </button>
          <button type="button" onClick={onResetLayout}>
            Reset layout
          </button>
        </div>
      </div>
      <div className="hardware-groups" aria-label="LED selection groups">
        {profile.groups.map((group) => (
          <button
            type="button"
            disabled={!scene}
            key={group.id}
            onClick={(event) =>
              onSelectGroup(group.ledIds, event.shiftKey, {
                id: group.id,
                kind: 'profile-group',
              })
            }
          >
            {group.name}
            <span>{group.ledIds.length}</span>
          </button>
        ))}
        {groups.map((group) => (
          <button
            className="hardware-custom-group"
            type="button"
            disabled={!scene}
            key={group.id}
            onClick={(event) =>
              onSelectGroup(group.ledIds, event.shiftKey, {
                id: group.id,
                kind: 'project-group',
              })
            }
          >
            {group.name}
            <span>{group.ledIds.length}</span>
          </button>
        ))}
      </div>
      <div className="hardware-stage">
        <SceneFretboard
          controller={controller}
          groups={groups}
          palette={palette}
          profile={profile}
          scene={scene}
          selectedLedIds={selectedLedIds}
          onSelectionChange={onSelectionChange}
        />
      </div>
    </section>
  );
}
