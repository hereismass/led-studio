import type { EditorCommand } from '@led-studio/editor-core';
import type { HardwareProfile } from '@led-studio/hardware-profiles';
import type { Project } from '@led-studio/project-format';
import { PlaybackControls } from '@/features/playback/PlaybackControls';
import type { PreviewPlaybackController } from '@/features/playback/previewPlayback';
import { ProjectTitleEditor } from '@/features/project-settings/ProjectTitleEditor';
import { TimingControls } from '@/features/project-settings/TimingControls';
import {
  isProjectDirty,
  type ActiveProjectSession,
  type ProjectOperation,
} from '@/app/session/projectSession';

interface WorkspaceToolbarProps {
  activeProject: ActiveProjectSession;
  canRedo: boolean;
  canUndo: boolean;
  hasActiveScene: boolean;
  operation: ProjectOperation;
  previewController: PreviewPlaybackController;
  profile: HardwareProfile;
  project: Project;
  onChooseAnother: () => void;
  onExecuteCommand: (command: EditorCommand) => unknown;
  onRedo: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onUndo: () => void;
}

function sourceDescription(activeProject: ActiveProjectSession): string {
  if (activeProject.source.kind === 'file')
    return `Local file · ${activeProject.source.file.fileName}`;
  return activeProject.source.kind === 'example'
    ? 'Unsaved project · Based on bundled example'
    : 'Unsaved new project';
}

export function WorkspaceToolbar({
  activeProject,
  canRedo,
  canUndo,
  hasActiveScene,
  onChooseAnother,
  onExecuteCommand,
  onRedo,
  onSave,
  onSaveAs,
  onUndo,
  operation,
  previewController,
  profile,
  project,
}: WorkspaceToolbarProps) {
  const isBusy = operation !== 'idle';
  return (
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
                {activeProject.source.kind === 'file' ? 'Modified' : 'Unsaved'}
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
        <PlaybackControls
          controller={previewController}
          disabled={!hasActiveScene}
        />
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
  );
}
