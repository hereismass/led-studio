import type {
  PaletteToken,
  ProjectGroup,
  Scene,
} from '@led-studio/project-format';
import type { KeyboardEvent } from 'react';

interface AssetsPanelProps {
  activeSceneId: string | null;
  collapsed: boolean;
  groups: readonly ProjectGroup[];
  hasLedSelection: boolean;
  palette: readonly PaletteToken[];
  scenes: readonly Scene[];
  selectedPaletteId: string | null;
  selectedGroupId: string | null;
  onAddColour: () => void;
  onAddScene: () => void;
  onAddGroup: () => void;
  onSelectPalette: (id: string) => void;
  onSelectScene: (scene: Scene) => void;
  onSelectGroup: (group: ProjectGroup) => void;
  onToggle: () => void;
}

export function AssetsPanel({
  activeSceneId,
  collapsed,
  groups,
  hasLedSelection,
  onAddColour,
  onAddGroup,
  onAddScene,
  onSelectPalette,
  onSelectGroup,
  onSelectScene,
  onToggle,
  palette,
  scenes,
  selectedGroupId,
  selectedPaletteId,
}: AssetsPanelProps) {
  function navigatePalette(
    index: number,
    event: KeyboardEvent<HTMLButtonElement>,
  ) {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowDown')
      nextIndex = Math.min(index + 1, palette.length - 1);
    if (event.key === 'ArrowUp') nextIndex = Math.max(index - 1, 0);
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = palette.length - 1;
    if (nextIndex === null || nextIndex === index) return;
    event.preventDefault();
    const token = palette[nextIndex];
    onSelectPalette(token.id);
    window.setTimeout(() =>
      document.getElementById(`palette-token-${token.id}`)?.focus(),
    );
  }

  return (
    <aside
      className={`workspace-panel assets-panel ${collapsed ? 'workspace-panel-collapsed' : ''}`}
      aria-label="Project assets"
    >
      <div className="workspace-panel-header">
        {collapsed ? null : <h2>Assets</h2>}
        <button
          type="button"
          aria-label={
            collapsed ? 'Expand assets panel' : 'Collapse assets panel'
          }
          title={collapsed ? 'Expand assets panel' : 'Collapse assets panel'}
          onClick={onToggle}
        >
          {collapsed ? '›' : '‹'}
        </button>
      </div>
      {collapsed ? (
        <div className="collapsed-panel-label" aria-hidden="true">
          Assets
        </div>
      ) : (
        <div className="assets-content">
          <section className="asset-section">
            <div className="asset-section-heading">
              <h3>Scenes</h3>
              <div>
                <span>{scenes.length}</span>
                <button
                  aria-label="Add scene"
                  className="asset-add-button"
                  type="button"
                  onClick={onAddScene}
                >
                  ＋ Add scene
                </button>
              </div>
            </div>
            {scenes.length === 0 ? (
              <p className="asset-empty-copy">
                No scenes yet. Add one to begin editing LEDs.
              </p>
            ) : (
              <div
                className="asset-scene-list"
                role="listbox"
                aria-label="Scenes"
              >
                {scenes.map((scene) => (
                  <button
                    className="asset-scene"
                    type="button"
                    role="option"
                    aria-selected={activeSceneId === scene.id}
                    key={scene.id}
                    onClick={() => onSelectScene(scene)}
                  >
                    <span className="asset-scene-icon" aria-hidden="true">
                      ◆
                    </span>
                    <span>
                      <strong>{scene.name}</strong>
                      <small>
                        {scene.loopLengthBeats} beats ·{' '}
                        {
                          Object.values(scene.ledStates).filter(
                            ({ brightnessPercent }) => brightnessPercent > 0,
                          ).length
                        }{' '}
                        lit
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
          <section className="asset-section">
            <div className="asset-section-heading">
              <h3>Groups</h3>
              <div>
                <span>{groups.length}</span>
                <button
                  aria-label="Add group from selection"
                  className="asset-add-button"
                  disabled={!hasLedSelection}
                  type="button"
                  onClick={onAddGroup}
                >
                  ＋ Add group
                </button>
              </div>
            </div>
            {groups.length === 0 ? (
              <p className="asset-empty-copy">
                Select LEDs, then save them as a reusable group.
              </p>
            ) : (
              <div
                className="asset-group-list"
                role="listbox"
                aria-label="LED groups"
              >
                {groups.map((group) => (
                  <button
                    className="asset-group"
                    type="button"
                    role="option"
                    aria-selected={selectedGroupId === group.id}
                    key={group.id}
                    onClick={() => onSelectGroup(group)}
                  >
                    <span aria-hidden="true">◉</span>
                    <span>
                      <strong>{group.name}</strong>
                      <small>{group.ledIds.length} LEDs</small>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
          <section className="asset-section">
            <div className="asset-section-heading">
              <h3>Palette</h3>
              <div>
                <span>{palette.length}</span>
                <button
                  aria-label="Add colour"
                  className="asset-add-button"
                  type="button"
                  onClick={onAddColour}
                >
                  ＋ Add colour
                </button>
              </div>
            </div>
            {palette.length === 0 ? (
              <p className="asset-empty-copy">No palette colours yet</p>
            ) : (
              <div
                className="asset-palette-list"
                role="listbox"
                aria-label="Palette colours"
              >
                {palette.map((token, index) => (
                  <button
                    className="asset-colour"
                    type="button"
                    role="option"
                    aria-label={`${token.name} ${token.value}`}
                    aria-selected={selectedPaletteId === token.id}
                    id={`palette-token-${token.id}`}
                    key={token.id}
                    tabIndex={
                      selectedPaletteId === token.id ||
                      (selectedPaletteId === null && index === 0)
                        ? 0
                        : -1
                    }
                    onClick={() => onSelectPalette(token.id)}
                    onKeyDown={(event) => navigatePalette(index, event)}
                  >
                    <span
                      className="asset-colour-swatch"
                      style={{ backgroundColor: token.value }}
                      aria-hidden="true"
                    />
                    <span>
                      <strong>{token.name}</strong>
                      <small>{token.value}</small>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </aside>
  );
}
