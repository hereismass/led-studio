import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { EditorCommand } from './editorCommands';
import { PaletteInspector } from './PaletteInspector';
import { ProjectTitleEditor } from './ProjectTitleEditor';
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
  type WorkspaceLayoutPreferences,
} from './workspaceLayout';

function sourceDescription(activeProject: ActiveProjectSession): string {
  if (activeProject.source.kind === 'file') {
    return `Local file · ${activeProject.source.file.fileName}`;
  }

  return activeProject.source.kind === 'example'
    ? 'Unsaved project · Based on bundled example'
    : 'Unsaved new project';
}

type BottomPanel = 'scene' | 'show';
type ResizablePanel = 'bottom' | 'left' | 'right';

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
  const colours = project.palette;
  const isBusy = operation !== 'idle';
  const [bottomPanel, setBottomPanel] = useState<BottomPanel>('show');
  const [layout, setLayout] = useState(loadWorkspaceLayout);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [focusTokenId, setFocusTokenId] = useState<string | null>(null);
  const pendingNewTokenIdsRef = useRef<Set<string> | null>(null);
  const stopResizeRef = useRef<(() => void) | null>(null);
  const selectedToken =
    colours.find((token) => token.id === selectedTokenId) ?? null;

  useEffect(() => saveWorkspaceLayout(layout), [layout]);
  useEffect(() => () => stopResizeRef.current?.(), []);
  useEffect(() => {
    const previousIds = pendingNewTokenIdsRef.current;
    if (previousIds) {
      const addedToken = colours.find((token) => !previousIds.has(token.id));
      pendingNewTokenIdsRef.current = null;
      if (addedToken) {
        setSelectedTokenId(addedToken.id);
        setFocusTokenId(addedToken.id);
        return;
      }
    }

    if (
      selectedTokenId !== null &&
      !colours.some((token) => token.id === selectedTokenId)
    ) {
      setSelectedTokenId(null);
      setFocusTokenId(null);
    }
  }, [colours, selectedTokenId]);

  function selectCreatedToken(command: EditorCommand) {
    pendingNewTokenIdsRef.current = new Set(colours.map((token) => token.id));
    onExecuteCommand(command);
  }

  function deleteSelectedToken() {
    if (!selectedToken) return;
    const index = colours.findIndex((token) => token.id === selectedToken.id);
    const nearestToken = colours[index + 1] ?? colours[index - 1] ?? null;
    setSelectedTokenId(nearestToken?.id ?? null);
    setFocusTokenId(null);
    onExecuteCommand({
      id: selectedToken.id,
      type: 'palette-token-deleted',
    });
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
    setSelectedTokenId(token.id);
    setFocusTokenId(null);
    window.setTimeout(() =>
      document.getElementById(`palette-token-${token.id}`)?.focus(),
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
      const currentPosition =
        panel === 'bottom' ? pointerEvent.clientY : pointerEvent.clientX;
      const totalDelta = currentPosition - startPosition;
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

    if (delta === null) {
      return;
    }

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
            <span aria-hidden="true">←</span>
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

        <div className="workspace-transport" aria-label="Playback controls">
          <button
            type="button"
            disabled
            title="Playback arrives in milestone 5"
          >
            <span aria-hidden="true">■</span>
            <span className="visually-hidden">Stop</span>
          </button>
          <button
            type="button"
            disabled
            title="Playback arrives in milestone 5"
          >
            <span aria-hidden="true">▶</span>
            <span className="visually-hidden">Play</span>
          </button>
          <span className="workspace-time">00:00.000</span>
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
              <span aria-hidden="true">↶</span>
            </button>
            <button
              className="workspace-icon-button"
              type="button"
              aria-label="Redo"
              aria-keyshortcuts="Meta+Shift+Z Control+Shift+Z"
              disabled={!canRedo}
              onClick={onRedo}
            >
              <span aria-hidden="true">↷</span>
            </button>
          </div>
          <span className="profile-chip" title={project.hardwareProfile}>
            {project.hardwareProfile}
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
              <span aria-hidden="true">{layout.leftCollapsed ? '›' : '‹'}</span>
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
                  <span>0</span>
                </div>
                <p className="asset-empty-copy">Scene editing arrives later.</p>
              </section>

              <section className="asset-section">
                <div className="asset-section-heading">
                  <h3>Palette</h3>
                  <div>
                    <span>{colours.length}</span>
                    <button
                      className="asset-add-button"
                      type="button"
                      onClick={() =>
                        selectCreatedToken({ type: 'palette-token-added' })
                      }
                    >
                      <span aria-hidden="true">＋</span>
                      Add colour
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
                        aria-selected={selectedTokenId === token.id}
                        id={`palette-token-${token.id}`}
                        key={token.id}
                        tabIndex={
                          selectedTokenId === token.id ||
                          (selectedTokenId === null && index === 0)
                            ? 0
                            : -1
                        }
                        onClick={() => {
                          setSelectedTokenId(token.id);
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

              <section className="asset-section asset-section-muted">
                <div className="asset-section-heading">
                  <h3>LED groups</h3>
                  <span>Later</span>
                </div>
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
              <h2 id="hardware-title">Hardware preview</h2>
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

          <div className="hardware-stage">
            <div className="hardware-stage-glow" aria-hidden="true" />
            <PanelPlaceholder
              title="No scene selected"
              description="The profile-driven hardware editor will appear here in milestone 3."
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
              <span aria-hidden="true">
                {layout.rightCollapsed ? '‹' : '›'}
              </span>
            </button>
            {layout.rightCollapsed ? null : <h2>Inspector</h2>}
          </div>

          {layout.rightCollapsed ? (
            <div className="collapsed-panel-label" aria-hidden="true">
              Inspector
            </div>
          ) : (
            <div className="inspector-content">
              {selectedToken ? (
                <PaletteInspector
                  key={selectedToken.id}
                  focusName={focusTokenId === selectedToken.id}
                  palette={colours}
                  token={selectedToken}
                  onDelete={deleteSelectedToken}
                  onDuplicate={() =>
                    selectCreatedToken({
                      id: selectedToken.id,
                      type: 'palette-token-duplicated',
                    })
                  }
                  onUpdate={(changes) =>
                    onExecuteCommand({
                      id: selectedToken.id,
                      changes,
                      type: 'palette-token-updated',
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
                        <dd>{project.hardwareProfile}</dd>
                      </div>
                      <div>
                        <dt>Format</dt>
                        <dd>Schema v{project.schemaVersion}</dd>
                      </div>
                      <div>
                        <dt>Palette</dt>
                        <dd>
                          {colours.length}{' '}
                          {colours.length === 1 ? 'colour' : 'colours'}
                        </dd>
                      </div>
                    </dl>
                  </section>
                  <PanelPlaceholder
                    title="Nothing selected"
                    description="Select a palette colour to edit it."
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
              <span aria-hidden="true">
                {layout.bottomCollapsed ? '⌃' : '⌄'}
              </span>
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
              <PanelPlaceholder
                title={
                  bottomPanel === 'show'
                    ? 'Your show sequence will live here'
                    : 'Select a scene to edit its animation'
                }
                description={
                  bottomPanel === 'show'
                    ? 'Reusable scenes can be arranged after the scene editor is introduced.'
                    : 'Effect and keyframe layers arrive in later milestones.'
                }
              />
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
