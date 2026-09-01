import {
  createEditorHistory,
  executeEditorCommand,
  redoEditorHistory,
  undoEditorHistory,
  type EditorCommand,
  type EditorHistory,
  type ExecuteEditorCommandOptions,
} from '@led-studio/editor-core';
import { validateProjectHardwareReferences } from '@led-studio/hardware-profiles';
import { parseProject, type Project } from '@led-studio/project-format';
import type { ProjectFileReference } from '@/platform/ports/projectFiles';

export type ProjectOperation = 'confirming' | 'idle' | 'opening' | 'saving';

export type ProjectSource =
  | { kind: 'example' }
  | { kind: 'file'; file: ProjectFileReference }
  | { kind: 'new' };

export interface ActiveProjectSession extends EditorHistory {
  savedRevision: number | null;
  source: ProjectSource;
}

export type EditorCommandResult =
  { changed: boolean; ok: true } | { message: string; ok: false };

export type SaveFeedback =
  { kind: 'error'; message: string } | { kind: 'success'; message: string };

export interface ProjectSessionState {
  activeProject: ActiveProjectSession | null;
  editorFeedback: string | null;
  launcherError: string | null;
  operation: ProjectOperation;
  saveFeedback: SaveFeedback | null;
}

export type ProjectSessionAction =
  | { type: 'clear-active-project' }
  | { error: string; type: 'launcher-error' }
  | { operation: Exclude<ProjectOperation, 'idle'>; type: 'operation-started' }
  | { type: 'operation-stopped' }
  | { activeProject: ActiveProjectSession; type: 'project-activated' }
  | {
      command: EditorCommand;
      options?: ExecuteEditorCommandOptions;
      type: 'editor-command-executed';
    }
  | { message: string; type: 'editor-command-failed' }
  | { type: 'redo-requested' }
  | { feedback: SaveFeedback; type: 'save-failed' }
  | {
      file: ProjectFileReference;
      revision: number;
      type: 'save-succeeded';
    }
  | { type: 'undo-requested' };

export const initialProjectSessionState: ProjectSessionState = {
  activeProject: null,
  editorFeedback: null,
  launcherError: null,
  operation: 'idle',
  saveFeedback: null,
};

export function isProjectDirty(project: ActiveProjectSession): boolean {
  return (
    project.savedRevision === null ||
    project.present.revision !== project.savedRevision
  );
}

export function createActiveProjectSession(
  project: Project,
  source: ProjectSource,
  savedRevision: number | null,
): ActiveProjectSession {
  const parsedProject = parseProject(project);
  validateProjectHardwareReferences(parsedProject);
  return {
    ...createEditorHistory(parsedProject),
    savedRevision,
    source,
  };
}

export function projectSessionReducer(
  state: ProjectSessionState,
  action: ProjectSessionAction,
): ProjectSessionState {
  switch (action.type) {
    case 'clear-active-project':
      return initialProjectSessionState;
    case 'launcher-error':
      return {
        ...state,
        launcherError: action.error,
        operation: 'idle',
      };
    case 'operation-started':
      return {
        ...state,
        launcherError: null,
        operation: action.operation,
        saveFeedback: null,
      };
    case 'operation-stopped':
      return { ...state, operation: 'idle' };
    case 'project-activated':
      return {
        activeProject: action.activeProject,
        editorFeedback: null,
        launcherError: null,
        operation: 'idle',
        saveFeedback: null,
      };
    case 'editor-command-executed': {
      if (!state.activeProject) return state;
      const transition = executeEditorCommand(
        state.activeProject,
        action.command,
        action.options,
      );
      if (!transition.changed) return state;
      return {
        ...state,
        activeProject: {
          ...state.activeProject,
          ...transition.history,
        },
        editorFeedback: null,
        saveFeedback: null,
      };
    }
    case 'editor-command-failed':
      return { ...state, editorFeedback: action.message };
    case 'undo-requested': {
      const activeProject = state.activeProject;
      if (!activeProject) return state;
      const history = undoEditorHistory(activeProject);
      if (history === activeProject) return state;
      return {
        ...state,
        activeProject: { ...activeProject, ...history },
        editorFeedback: null,
        saveFeedback: null,
      };
    }
    case 'redo-requested': {
      const activeProject = state.activeProject;
      if (!activeProject) return state;
      const history = redoEditorHistory(activeProject);
      if (history === activeProject) return state;
      return {
        ...state,
        activeProject: { ...activeProject, ...history },
        editorFeedback: null,
        saveFeedback: null,
      };
    }
    case 'save-failed':
      return {
        ...state,
        operation: 'idle',
        saveFeedback: action.feedback,
      };
    case 'save-succeeded':
      if (!state.activeProject) return { ...state, operation: 'idle' };
      return {
        ...state,
        activeProject: {
          ...state.activeProject,
          savedRevision: action.revision,
          source: { file: action.file, kind: 'file' },
        },
        operation: 'idle',
        saveFeedback: {
          kind: 'success',
          message: `Saved ${action.file.fileName}.`,
        },
      };
  }
}
