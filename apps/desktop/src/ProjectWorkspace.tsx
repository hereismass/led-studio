import { getHardwareProfile } from '@led-studio/hardware-profiles';
import type { Scene } from '@led-studio/project-format';
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { paletteTokenUsageCount, type EditorCommand } from './editorCommands';
import { FretboardEditor } from './FretboardEditor';
import { LedSelectionInspector } from './LedSelectionInspector';
import { PaletteInspector } from './PaletteInspector';
import { ProjectTitleEditor } from './ProjectTitleEditor';
import { SceneInspector } from './SceneInspector';
import { SceneTimeline } from './SceneTimeline';
import { TimingControls } from './TimingControls';
import {
  isProjectDirty,
  type ActiveProjectSession,
  type ProjectOperation,
  type SaveFeedback,
} from './projectSession';
import {
  defaultWorkspaceLayout,
  loadWorkspaceLayout,
  resizeWorkspacePanel,
  saveWorkspaceLayout,
} from './workspaceLayout';

type BottomPanel = 'scene' | 'show';
type ResizablePanel = 'bottom' | 'left' | 'right';
type InspectorTarget =
  | { kind: 'leds' }
  | { id: string; kind: 'palette' }
  | { kind: 'project' }
  | { id: string; kind: 'scene' };

interface ProjectWorkspaceProps {
  activeProject: ActiveProjectSession;
  canRedo: boolean;
  canUndo: boolean;
  onChooseAnother: () => void;
  onExecuteCommand: (command: EditorCommand) => void;
  onRedo: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onUndo: () => void;
  operation: ProjectOperation;
  saveFeedback: SaveFeedback | null;
}

interface PanelPlaceholderProps {
  description: string;
  title: string;
}

function PanelPlaceholder({ description, title }: PanelPlaceholderProps) {
  return (
    <div className="panel-placeholder">
      <span aria-hidden="true">◇</span>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
    </div>
  );
}

function sourceDescription(activeProject: ActiveProjectSession): string {
  if (activeProject.source.kind === 'file')
    return `Local file · ${activeProject.source.file.fileName}`;
  return activeProject.source.kind === 'example'
    ? 'Unsaved project · Based on bundled example'
    : 'Unsaved new project';
}

export function ProjectWorkspace({
  activeProject,
  canRedo,
  canUndo,
  onChooseAnother,
  onExecuteCommand,
  onRedo,
  onSave,
  onSaveAs,
  onUndo,
  operation,
  saveFeedback,
}: ProjectWorkspaceProps) {
  const { project } = activeProject.present;
  const profile = getHardwareProfile(project.hardwareProfile)!;
  const colours = project.palette;
  const scenes = project.scenes;
  const isBusy = operation !== 'idle';
  const initialSceneId = scenes[0]?.id ?? null;
  const [activeSceneId, setActiveSceneId] = useState<string | null>(
    initialSceneId,
  );
  const [bottomPanel, setBottomPanel] = useState<BottomPanel>(
    initialSceneId ? 'scene' : 'show',
  );
  const [focusTokenId, setFocusTokenId] = useState<string | null>(null);
  const [inspectorTarget, setInspectorTarget] = useState<InspectorTarget>(
    initialSceneId
      ? { id: initialSceneId, kind: 'scene' }
      : { kind: 'project' },
  );
  const [layout, setLayout] = useState(loadWorkspaceLayout);
  const [selectedLedIds, setSelectedLedIds] = useState<string[]>([]);
  const pendingEntityIdsRef = useRef<{
    ids: Set<string>;
    kind: 'palette' | 'scene';
  } | null>(null);
  const stopResizeRef = useRef<(() => void) | null>(null);

  const activeScene =
    scenes.find((scene) => scene.id === activeSceneId) ?? null;
  const selectedToken =
    inspectorTarget.kind === 'palette'
      ? (colours.find((token) => token.id === inspectorTarget.id) ?? null)
      : null;
  const selectedScene =
    inspectorTarget.kind === 'scene'
      ? (scenes.find((scene) => scene.id === inspectorTarget.id) ?? null)
      : null;
  const selectedLeds = profile.leds.filter((led) =>
    selectedLedIds.includes(led.id),
  );

  useEffect(() => saveWorkspaceLayout(layout), [layout]);
  useEffect(() => () => stopResizeRef.current?.(), []);
  useEffect(() => {
    const pending = pendingEntityIdsRef.current;
    if (pending) {
      const collection = pending.kind === 'palette' ? colours : scenes;
      const added = collection.find((entity) => !pending.ids.has(entity.id));
      pendingEntityIdsRef.current = null;
      if (added) {
        if (pending.kind === 'palette') {
          setInspectorTarget({ id: added.id, kind: 'palette' });
          setFocusTokenId(added.id);
        } else {
          setActiveSceneId(added.id);
          setInspectorTarget({ id: added.id, kind: 'scene' });
          setSelectedLedIds([]);
          setBottomPanel('scene');
        }
        return;
      }
    }

    if (activeSceneId && !scenes.some((scene) => scene.id === activeSceneId)) {
      const nearest = scenes[0] ?? null;
      setActiveSceneId(nearest?.id ?? null);
      setSelectedLedIds([]);
      setInspectorTarget(
        nearest ? { id: nearest.id, kind: 'scene' } : { kind: 'project' },
      );
    }
    if (
      inspectorTarget.kind === 'palette' &&
      !colours.some((token) => token.id === inspectorTarget.id)
    ) {
      setInspectorTarget({ kind: 'project' });
    }
  }, [activeSceneId, colours, inspectorTarget, scenes]);

  function executeAndSelectCreated(
    command: EditorCommand,
    kind: 'palette' | 'scene',
  ) {
    const collection = kind === 'palette' ? colours : scenes;
    pendingEntityIdsRef.current = {
      ids: new Set(collection.map(({ id }) => id)),
      kind,
    };
    onExecuteCommand(command);
  }

  function activateScene(scene: Scene) {
    setActiveSceneId(scene.id);
    setInspectorTarget({ id: scene.id, kind: 'scene' });
    setSelectedLedIds([]);
    setBottomPanel('scene');
  }

  function deleteScene(scene: Scene) {
    const index = scenes.findIndex(({ id }) => id === scene.id);
    const nearest = scenes[index + 1] ?? scenes[index - 1] ?? null;
    if (activeSceneId === scene.id) setActiveSceneId(nearest?.id ?? null);
    setInspectorTarget(
      nearest ? { id: nearest.id, kind: 'scene' } : { kind: 'project' },
    );
    setSelectedLedIds([]);
    onExecuteCommand({ id: scene.id, type: 'scene-deleted' });
  }

  function deleteSelectedToken() {
    if (!selectedToken || paletteTokenUsageCount(project, selectedToken.id) > 0)
      return;
    const index = colours.findIndex(({ id }) => id === selectedToken.id);
    const nearest = colours[index + 1] ?? colours[index - 1] ?? null;
    setInspectorTarget(
      nearest ? { id: nearest.id, kind: 'palette' } : { kind: 'project' },
    );
    setFocusTokenId(null);
    onExecuteCommand({ id: selectedToken.id, type: 'palette-token-deleted' });
  }

  function navigatePalette(
    index: number,
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ) {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowDown')
      nextIndex = Math.min(index + 1, colours.length - 1);
    if (event.key === 'ArrowUp') nextIndex = Math.max(index - 1, 0);
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = colours.length - 1;
    if (nextIndex === null || nextIndex === index) return;
    event.preventDefault();
    const token = colours[nextIndex];
    setInspectorTarget({ id: token.id, kind: 'palette' });
    setFocusTokenId(null);
    window.setTimeout(() =>
      document.getElementById(`palette-token-${token.id}`)?.focus(),
    );
  }

  function selectLeds(ledIds: string[]) {
    setSelectedLedIds(ledIds);
    if (ledIds.length > 0) setInspectorTarget({ kind: 'leds' });
    else if (activeScene)
      setInspectorTarget({ id: activeScene.id, kind: 'scene' });
  }

  function selectGroup(ledIds: string[], additive: boolean) {
    selectLeds(
      additive ? [...new Set([...selectedLedIds, ...ledIds])] : ledIds,
    );
  }

  function togglePanel(panel: ResizablePanel) {
    setLayout((current) => ({
      ...current,
      [`${panel}Collapsed`]: !current[`${panel}Collapsed`],
    }));
  }

  function beginResize(
    panel: ResizablePanel,
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    event.preventDefault();
    stopResizeRef.current?.();
    const startPosition = panel === 'bottom' ? event.clientY : event.clientX;
    let previousDelta = 0;
    function handlePointerMove(pointerEvent: PointerEvent) {
      const position =
        panel === 'bottom' ? pointerEvent.clientY : pointerEvent.clientX;
      const totalDelta = position - startPosition;
      const nextDelta = totalDelta - previousDelta;
      previousDelta = totalDelta;
      setLayout((current) => resizeWorkspacePanel(current, panel, nextDelta));
    }
    function stopResizing() {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopResizing);
      stopResizeRef.current = null;
    }
    stopResizeRef.current = stopResizing;
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopResizing, { once: true });
  }

  function resizeWithKeyboard(
    panel: ResizablePanel,
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) {
    const step = event.shiftKey ? 24 : 8;
    let delta: number | null = null;
    if (panel === 'bottom') {
      if (event.key === 'ArrowUp') delta = -step;
      if (event.key === 'ArrowDown') delta = step;
    } else {
      if (event.key === 'ArrowLeft') delta = -step;
      if (event.key === 'ArrowRight') delta = step;
    }
    if (delta === null) return;
    event.preventDefault();
    setLayout((current) => resizeWorkspacePanel(current, panel, delta));
  }

  const workspaceStyle = {
    '--bottom-panel-height': `${layout.bottomCollapsed ? 38 : layout.bottomHeight}px`,
    '--left-panel-width': `${layout.leftCollapsed ? 44 : layout.leftWidth}px`,
    '--right-panel-width': `${layout.rightCollapsed ? 44 : layout.rightWidth}px`,
  } as React.CSSProperties;

  return (
    <main className="workspace-shell" style={workspaceStyle}>
      <header className="workspace-toolbar">
        <div className="workspace-project-identity">
          <button
            className="workspace-icon-button"
            type="button"
            aria-label="Choose another project"
            title="Choose another project"
            disabled={isBusy}
            onClick={onChooseAnother}
          >
            ←
          </button>
          <div className="workspace-title">
            <div>
              <ProjectTitleEditor
                name={project.name}
                onCommit={(name) =>
                  onExecuteCommand({ name, type: 'project-renamed' })
                }
              />
              {isProjectDirty(activeProject) ? (
                <span className="workspace-dirty-status">
                  {activeProject.source.kind === 'file'
                    ? 'Modified'
                    : 'Unsaved'}
                </span>
              ) : (
                <span className="workspace-saved-status">Saved</span>
              )}
            </div>
            <p>{sourceDescription(activeProject)}</p>
          </div>
        </div>

        <div
          className="workspace-transport"
          aria-label="Preview timing and playback controls"
        >
          <button
            type="button"
            disabled
            title="Playback arrives in a later milestone"
          >
            <span aria-hidden="true">■</span>
            <span className="visually-hidden">Stop</span>
          </button>
          <button
            type="button"
            disabled
            title="Playback arrives in a later milestone"
          >
            <span aria-hidden="true">▶</span>
            <span className="visually-hidden">Play</span>
          </button>
          <TimingControls
            timing={project.timing}
            onCommit={(changes) =>
              onExecuteCommand({
                changes,
                type: 'project-timing-updated',
              })
            }
          />
        </div>

        <div className="workspace-actions">
          <div className="workspace-history-actions" aria-label="Edit history">
            <button
              className="workspace-icon-button"
              type="button"
              aria-label="Undo"
              aria-keyshortcuts="Meta+Z Control+Z"
              disabled={!canUndo}
              onClick={onUndo}
            >
              ↶
            </button>
            <button
              className="workspace-icon-button"
              type="button"
              aria-label="Redo"
              aria-keyshortcuts="Meta+Shift+Z Control+Shift+Z"
              disabled={!canRedo}
              onClick={onRedo}
            >
              ↷
            </button>
          </div>
          <span className="profile-chip" title={project.hardwareProfile}>
            {profile.name}
          </span>
          <button
            className="workspace-action-button"
            aria-keyshortcuts="Meta+S Control+S"
            type="button"
            disabled={isBusy}
            onClick={onSave}
          >
            {operation === 'saving' ? 'Saving…' : 'Save'}
          </button>
          <button
            className="workspace-action-button workspace-action-secondary"
            aria-keyshortcuts="Meta+Shift+S Control+Shift+S"
            type="button"
            disabled={isBusy}
            onClick={onSaveAs}
          >
            Save As
          </button>
        </div>
      </header>

      {saveFeedback ? (
        <div
          className={`workspace-feedback workspace-feedback-${saveFeedback.kind}`}
          role={saveFeedback.kind === 'error' ? 'alert' : 'status'}
        >
          {saveFeedback.message}
        </div>
      ) : null}

      <div className="workspace-editor">
        <aside
          className={`workspace-panel assets-panel ${layout.leftCollapsed ? 'workspace-panel-collapsed' : ''}`}
          aria-label="Project assets"
        >
          <div className="workspace-panel-header">
            {layout.leftCollapsed ? null : <h2>Assets</h2>}
            <button
              type="button"
              aria-label={
                layout.leftCollapsed
                  ? 'Expand assets panel'
                  : 'Collapse assets panel'
              }
              title={
                layout.leftCollapsed
                  ? 'Expand assets panel'
                  : 'Collapse assets panel'
              }
              onClick={() => togglePanel('left')}
            >
              {layout.leftCollapsed ? '›' : '‹'}
            </button>
          </div>
          {layout.leftCollapsed ? (
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
                      onClick={() =>
                        executeAndSelectCreated(
                          { type: 'scene-added' },
                          'scene',
                        )
                      }
                    >
                      ＋ Add scene
                    </button>
                  </div>
                </div>
                {scenes.length === 0 ? (
                  <p className="asset-empty-copy">
                    No scenes yet. Add one to begin editing inlays.
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
                        onClick={() => activateScene(scene)}
                      >
                        <span className="asset-scene-icon" aria-hidden="true">
                          ◆
                        </span>
                        <span>
                          <strong>{scene.name}</strong>
                          <small>
                            {scene.loopLengthBeats} beats ·{' '}
                            {Object.keys(scene.ledStates).length} lit
                          </small>
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
                    <span>{colours.length}</span>
                    <button
                      aria-label="Add colour"
                      className="asset-add-button"
                      type="button"
                      onClick={() =>
                        executeAndSelectCreated(
                          { type: 'palette-token-added' },
                          'palette',
                        )
                      }
                    >
                      ＋ Add colour
                    </button>
                  </div>
                </div>
                {colours.length === 0 ? (
                  <p className="asset-empty-copy">No palette colours yet</p>
                ) : (
                  <div
                    className="asset-palette-list"
                    role="listbox"
                    aria-label="Palette colours"
                  >
                    {colours.map((token, index) => (
                      <button
                        className="asset-colour"
                        type="button"
                        role="option"
                        aria-label={`${token.name} ${token.value}`}
                        aria-selected={
                          inspectorTarget.kind === 'palette' &&
                          inspectorTarget.id === token.id
                        }
                        id={`palette-token-${token.id}`}
                        key={token.id}
                        tabIndex={
                          (inspectorTarget.kind === 'palette' &&
                            inspectorTarget.id === token.id) ||
                          (inspectorTarget.kind !== 'palette' && index === 0)
                            ? 0
                            : -1
                        }
                        onClick={() => {
                          setInspectorTarget({ id: token.id, kind: 'palette' });
                          setFocusTokenId(null);
                        }}
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

        <div
          className="workspace-resizer workspace-resizer-vertical"
          role="separator"
          aria-label="Resize assets panel"
          aria-orientation="vertical"
          aria-valuemax={380}
          aria-valuemin={188}
          aria-valuenow={layout.leftWidth}
          tabIndex={layout.leftCollapsed ? -1 : 0}
          onKeyDown={(event) => resizeWithKeyboard('left', event)}
          onPointerDown={(event) => beginResize('left', event)}
        />

        <section
          className="hardware-workspace"
          aria-labelledby="hardware-title"
        >
          <div className="hardware-workspace-heading">
            <div>
              <p className="workspace-eyebrow">Hardware editor</p>
              <h2 id="hardware-title">{activeScene?.name ?? profile.name}</h2>
            </div>
            <div
              className="workspace-view-actions"
              aria-label="Workspace panels"
            >
              <button type="button" onClick={() => togglePanel('left')}>
                Assets
              </button>
              <button type="button" onClick={() => togglePanel('right')}>
                Inspector
              </button>
              <button type="button" onClick={() => togglePanel('bottom')}>
                Timeline
              </button>
              <button
                type="button"
                onClick={() => setLayout({ ...defaultWorkspaceLayout })}
              >
                Reset layout
              </button>
            </div>
          </div>
          <div className="hardware-groups" aria-label="Inlay selection groups">
            {profile.groups.map((group) => (
              <button
                type="button"
                disabled={!activeScene}
                key={group.id}
                onClick={(event) => selectGroup(group.ledIds, event.shiftKey)}
              >
                {group.name}
                <span>{group.ledIds.length}</span>
              </button>
            ))}
          </div>
          <div className="hardware-stage">
            <FretboardEditor
              palette={colours}
              profile={profile}
              scene={activeScene}
              selectedLedIds={selectedLedIds}
              onSelectionChange={selectLeds}
            />
          </div>
        </section>

        <div
          className="workspace-resizer workspace-resizer-vertical"
          role="separator"
          aria-label="Resize inspector panel"
          aria-orientation="vertical"
          aria-valuemax={420}
          aria-valuemin={220}
          aria-valuenow={layout.rightWidth}
          tabIndex={layout.rightCollapsed ? -1 : 0}
          onKeyDown={(event) => resizeWithKeyboard('right', event)}
          onPointerDown={(event) => beginResize('right', event)}
        />

        <aside
          className={`workspace-panel inspector-panel ${layout.rightCollapsed ? 'workspace-panel-collapsed' : ''}`}
          aria-label="Inspector"
        >
          <div className="workspace-panel-header">
            <button
              type="button"
              aria-label={
                layout.rightCollapsed
                  ? 'Expand inspector panel'
                  : 'Collapse inspector panel'
              }
              title={
                layout.rightCollapsed
                  ? 'Expand inspector panel'
                  : 'Collapse inspector panel'
              }
              onClick={() => togglePanel('right')}
            >
              {layout.rightCollapsed ? '‹' : '›'}
            </button>
            {layout.rightCollapsed ? null : <h2>Inspector</h2>}
          </div>
          {layout.rightCollapsed ? (
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
                  palette={colours}
                  scene={activeScene}
                  onPaint={(paletteTokenId) =>
                    onExecuteCommand({
                      ledIds: selectedLedIds,
                      paletteTokenId,
                      sceneId: activeScene.id,
                      type: 'scene-leds-painted',
                    })
                  }
                  onBrightnessChange={(brightnessPercent) =>
                    onExecuteCommand({
                      brightnessPercent,
                      ledIds: selectedLedIds,
                      sceneId: activeScene.id,
                      type: 'scene-led-brightness-set',
                    })
                  }
                  onTurnOff={() =>
                    onExecuteCommand({
                      ledIds: selectedLedIds,
                      sceneId: activeScene.id,
                      type: 'scene-leds-turned-off',
                    })
                  }
                />
              ) : selectedToken ? (
                <PaletteInspector
                  key={selectedToken.id}
                  focusName={focusTokenId === selectedToken.id}
                  palette={colours}
                  token={selectedToken}
                  usageCount={paletteTokenUsageCount(project, selectedToken.id)}
                  onDelete={deleteSelectedToken}
                  onDuplicate={() =>
                    executeAndSelectCreated(
                      {
                        id: selectedToken.id,
                        type: 'palette-token-duplicated',
                      },
                      'palette',
                    )
                  }
                  onUpdate={(changes) =>
                    onExecuteCommand({
                      changes,
                      id: selectedToken.id,
                      type: 'palette-token-updated',
                    })
                  }
                />
              ) : selectedScene ? (
                <SceneInspector
                  scene={selectedScene}
                  sceneNames={scenes}
                  onDelete={() => deleteScene(selectedScene)}
                  onDuplicate={() =>
                    executeAndSelectCreated(
                      { id: selectedScene.id, type: 'scene-duplicated' },
                      'scene',
                    )
                  }
                  onUpdate={(changes) =>
                    onExecuteCommand({
                      changes,
                      id: selectedScene.id,
                      type: 'scene-updated',
                    })
                  }
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
                        <dt>Inlays</dt>
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
                  <PanelPlaceholder
                    title="Nothing selected"
                    description="Select a scene, palette colour, or fretboard inlay to edit it."
                  />
                </>
              )}
            </div>
          )}
        </aside>

        <div
          className="workspace-resizer workspace-resizer-horizontal"
          role="separator"
          aria-label="Resize timeline panel"
          aria-orientation="horizontal"
          aria-valuemax={420}
          aria-valuemin={150}
          aria-valuenow={layout.bottomHeight}
          tabIndex={layout.bottomCollapsed ? -1 : 0}
          onKeyDown={(event) => resizeWithKeyboard('bottom', event)}
          onPointerDown={(event) => beginResize('bottom', event)}
        />
        <section
          className={`timeline-panel ${layout.bottomCollapsed ? 'timeline-panel-collapsed' : ''}`}
          aria-label="Timeline"
        >
          <div
            className="timeline-tabs"
            role="tablist"
            aria-label="Timeline mode"
          >
            <button
              type="button"
              role="tab"
              aria-selected={bottomPanel === 'show'}
              onClick={() => setBottomPanel('show')}
            >
              Show sequence
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={bottomPanel === 'scene'}
              onClick={() => setBottomPanel('scene')}
            >
              Scene timeline
            </button>
            <button
              className="timeline-collapse-button"
              type="button"
              aria-label={
                layout.bottomCollapsed ? 'Expand timeline' : 'Collapse timeline'
              }
              title={
                layout.bottomCollapsed ? 'Expand timeline' : 'Collapse timeline'
              }
              onClick={() => togglePanel('bottom')}
            >
              {layout.bottomCollapsed ? '⌃' : '⌄'}
            </button>
          </div>
          {layout.bottomCollapsed ? null : (
            <div
              className="timeline-content"
              role="tabpanel"
              aria-label={
                bottomPanel === 'show' ? 'Show sequence' : 'Scene timeline'
              }
            >
              {bottomPanel === 'show' ? (
                <PanelPlaceholder
                  title="MIDI scene order will live here"
                  description="Automatic timed progression is deliberately deferred while MIDI triggering is designed."
                />
              ) : activeScene ? (
                <SceneTimeline scene={activeScene} timing={project.timing} />
              ) : (
                <PanelPlaceholder
                  title="Select a scene to view its loop"
                  description="Scenes loop until a future MIDI scene-change message."
                />
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
