import {
  createProject,
  parseProject,
  parseProjectJson,
  ProjectFormatError,
  serializeProject,
  type Project,
} from '@led-studio/project-format';
import {
  HardwareCompatibilityError,
  KMS_PROFILE_ID,
  validateProjectHardwareReferences,
} from '@led-studio/hardware-profiles';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppLifecycleGateway } from './appLifecycle';
import { applyEditorCommand, type EditorCommand } from './editorCommands';
import { projectExamples } from './examples';
import type {
  ProjectFileReference,
  ProjectStorageGateway,
  UnsavedChangesGateway,
  UnsavedChangesIntent,
} from './projectFiles';

const DEFAULT_HARDWARE_PROFILE = KMS_PROFILE_ID;

export type ProjectOperation = 'confirming' | 'idle' | 'opening' | 'saving';

export type ProjectSource =
  | { kind: 'example' }
  | { kind: 'file'; file: ProjectFileReference }
  | { kind: 'new' };

export interface ProjectRevision {
  project: Project;
  revision: number;
}

export interface ActiveProjectSession {
  future: ProjectRevision[];
  nextRevision: number;
  past: ProjectRevision[];
  present: ProjectRevision;
  savedRevision: number | null;
  source: ProjectSource;
}

export type SaveFeedback =
  { kind: 'error'; message: string } | { kind: 'success'; message: string };

export interface ProjectSessionState {
  activeProject: ActiveProjectSession | null;
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
  | { command: EditorCommand; type: 'editor-command-executed' }
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
    future: [],
    nextRevision: 1,
    past: [],
    present: { project: parsedProject, revision: 0 },
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
        launcherError: null,
        operation: 'idle',
        saveFeedback: null,
      };
    case 'editor-command-executed': {
      if (!state.activeProject) {
        return state;
      }

      const project = applyEditorCommand(
        state.activeProject.present.project,
        action.command,
      );
      if (project === state.activeProject.present.project) {
        return state;
      }

      return {
        ...state,
        activeProject: {
          ...state.activeProject,
          future: [],
          nextRevision: state.activeProject.nextRevision + 1,
          past: [...state.activeProject.past, state.activeProject.present],
          present: {
            project,
            revision: state.activeProject.nextRevision,
          },
        },
        saveFeedback: null,
      };
    }
    case 'undo-requested': {
      const activeProject = state.activeProject;
      if (!activeProject || activeProject.past.length === 0) return state;

      const present = activeProject.past.at(-1)!;
      return {
        ...state,
        activeProject: {
          ...activeProject,
          future: [activeProject.present, ...activeProject.future],
          past: activeProject.past.slice(0, -1),
          present,
        },
        saveFeedback: null,
      };
    }
    case 'redo-requested': {
      const activeProject = state.activeProject;
      if (!activeProject || activeProject.future.length === 0) return state;

      const [present, ...future] = activeProject.future;
      return {
        ...state,
        activeProject: {
          ...activeProject,
          future,
          past: [...activeProject.past, activeProject.present],
          present,
        },
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
      if (!state.activeProject) {
        return { ...state, operation: 'idle' };
      }

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

function describeProjectError(error: unknown): string {
  if (error instanceof HardwareCompatibilityError) {
    return `This project is not compatible with this build. ${error.message}`;
  }
  if (!(error instanceof ProjectFormatError)) {
    return 'This is not a valid LED Studio project.';
  }

  if (error.kind === 'invalid-json') {
    return 'This file is not valid JSON.';
  }

  const issue = error.issues[0];

  if (!issue) {
    return 'This is not a valid LED Studio project.';
  }

  const path = issue.path.length > 0 ? issue.path.join('.') : 'project';
  return `This is not a valid LED Studio project. ${path}: ${issue.message}`;
}

interface ProjectSessionDependencies {
  appLifecycle: AppLifecycleGateway;
  projectStorage: ProjectStorageGateway;
  unsavedChanges: UnsavedChangesGateway;
}

export function useProjectSession({
  appLifecycle,
  projectStorage,
  unsavedChanges,
}: ProjectSessionDependencies) {
  const [state, setState] = useState(initialProjectSessionState);
  const stateRef = useRef(state);

  const dispatch = useCallback((action: ProjectSessionAction) => {
    const nextState = projectSessionReducer(stateRef.current, action);
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  const beginOperation = useCallback(
    (operation: Exclude<ProjectOperation, 'idle'>): boolean => {
      if (stateRef.current.operation !== 'idle') {
        return false;
      }

      dispatch({ operation, type: 'operation-started' });
      return true;
    },
    [dispatch],
  );

  const persistActiveProject = useCallback(
    async (forceSaveAs: boolean): Promise<boolean> => {
      const snapshot = stateRef.current.activeProject;

      if (!snapshot) {
        dispatch({ type: 'operation-stopped' });
        return false;
      }

      try {
        const contents = serializeProject(snapshot.present.project);
        const currentFile =
          snapshot.source.kind === 'file' ? snapshot.source.file : null;
        let savedFile: ProjectFileReference;

        if (forceSaveAs || currentFile === null) {
          const selectedFile = await projectStorage.saveProjectAs(
            snapshot.present.project.name,
            contents,
          );

          if (selectedFile === null) {
            dispatch({ type: 'operation-stopped' });
            return false;
          }

          savedFile = selectedFile;
        } else {
          await projectStorage.saveProject(currentFile, contents);
          savedFile = currentFile;
        }

        dispatch({
          file: savedFile,
          revision: snapshot.present.revision,
          type: 'save-succeeded',
        });
        return true;
      } catch (error) {
        console.error('Could not save LED Studio project', error);
        dispatch({
          feedback: {
            kind: 'error',
            message: 'LED Studio could not save this project.',
          },
          type: 'save-failed',
        });
        return false;
      }
    },
    [dispatch, projectStorage],
  );

  const save = useCallback(
    async (forceSaveAs = false): Promise<boolean> => {
      if (!stateRef.current.activeProject || !beginOperation('saving')) {
        return false;
      }

      return persistActiveProject(forceSaveAs);
    },
    [beginOperation, persistActiveProject],
  );

  const finishLeave = useCallback(
    async (intent: UnsavedChangesIntent): Promise<boolean> => {
      if (intent === 'quit') {
        try {
          await appLifecycle.exitApp();
        } catch (error) {
          console.error('Could not exit LED Studio', error);
          dispatch({
            feedback: {
              kind: 'error',
              message: 'LED Studio could not quit safely.',
            },
            type: 'save-failed',
          });
          return false;
        }
      } else {
        dispatch({ type: 'clear-active-project' });
      }

      return true;
    },
    [appLifecycle, dispatch],
  );

  const requestLeave = useCallback(
    async (intent: UnsavedChangesIntent): Promise<void> => {
      if (stateRef.current.operation !== 'idle') {
        return;
      }

      const activeProject = stateRef.current.activeProject;

      if (!activeProject) {
        if (intent === 'quit') {
          await finishLeave(intent);
        }
        return;
      }

      if (!isProjectDirty(activeProject)) {
        await finishLeave(intent);
        return;
      }

      if (!beginOperation('confirming')) {
        return;
      }

      let decision;

      try {
        decision = await unsavedChanges.confirmUnsavedChanges(
          activeProject.present.project.name,
          intent,
        );
      } catch (error) {
        console.error('Could not confirm unsaved project changes', error);
        dispatch({
          feedback: {
            kind: 'error',
            message: 'LED Studio could not confirm how to handle this project.',
          },
          type: 'save-failed',
        });
        return;
      }

      if (decision === 'cancel') {
        dispatch({ type: 'operation-stopped' });
        return;
      }

      if (decision === 'discard') {
        await finishLeave(intent);
        return;
      }

      dispatch({ operation: 'saving', type: 'operation-started' });

      if (await persistActiveProject(false)) {
        await finishLeave(intent);
      }
    },
    [
      beginOperation,
      dispatch,
      finishLeave,
      persistActiveProject,
      unsavedChanges,
    ],
  );

  const createNewProject = useCallback(() => {
    if (stateRef.current.operation !== 'idle') {
      return;
    }

    dispatch({
      activeProject: createActiveProjectSession(
        createProject({
          hardwareProfile: DEFAULT_HARDWARE_PROFILE,
          name: 'Untitled Project',
        }),
        { kind: 'new' },
        null,
      ),
      type: 'project-activated',
    });
  }, [dispatch]);

  const loadExample = useCallback(
    (index: number) => {
      if (stateRef.current.operation !== 'idle') {
        return;
      }

      const example = projectExamples[index];

      if (!example) {
        return;
      }

      dispatch({
        activeProject: createActiveProjectSession(
          example.project,
          { kind: 'example' },
          null,
        ),
        type: 'project-activated',
      });
    },
    [dispatch],
  );

  const openExistingProject = useCallback(async () => {
    if (!beginOperation('opening')) {
      return;
    }

    let selectedFile;

    try {
      selectedFile = await projectStorage.openProject();
    } catch (error) {
      console.error('Could not read selected LED Studio project', error);
      dispatch({
        error: 'LED Studio could not read the selected file.',
        type: 'launcher-error',
      });
      return;
    }

    if (selectedFile === null) {
      dispatch({ type: 'operation-stopped' });
      return;
    }

    try {
      dispatch({
        activeProject: createActiveProjectSession(
          parseProjectJson(selectedFile.contents),
          {
            file: {
              fileName: selectedFile.fileName,
              handle: selectedFile.handle,
            },
            kind: 'file',
          },
          0,
        ),
        type: 'project-activated',
      });
    } catch (error) {
      dispatch({ error: describeProjectError(error), type: 'launcher-error' });
    }
  }, [beginOperation, dispatch, projectStorage]);

  const executeCommand = useCallback(
    (command: EditorCommand) => {
      if (stateRef.current.activeProject) {
        dispatch({ command, type: 'editor-command-executed' });
      }
    },
    [dispatch],
  );

  const undo = useCallback(
    () => dispatch({ type: 'undo-requested' }),
    [dispatch],
  );
  const redo = useCallback(
    () => dispatch({ type: 'redo-requested' }),
    [dispatch],
  );

  const requestQuit = useCallback(() => requestLeave('quit'), [requestLeave]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void appLifecycle
      .onExitRequested(() => void requestQuit())
      .then((stopListening) => {
        if (disposed) {
          stopListening();
        } else {
          unlisten = stopListening;
        }
      })
      .catch((error: unknown) => {
        console.error('Could not register the application exit handler', error);
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [appLifecycle, requestQuit]);

  return {
    createNewProject,
    executeCommand,
    loadExample,
    openExistingProject,
    redo,
    requestChooseAnother: () => requestLeave('choose-another'),
    save,
    state,
    undo,
  };
}
