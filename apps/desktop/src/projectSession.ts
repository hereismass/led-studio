import {
  createProject,
  parseProject,
  parseProjectJson,
  ProjectFormatError,
  serializeProject,
  type Project,
} from '@led-studio/project-format';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppLifecycleGateway } from './appLifecycle';
import { projectExamples } from './examples';
import type {
  ProjectFileReference,
  ProjectStorageGateway,
  UnsavedChangesGateway,
  UnsavedChangesIntent,
} from './projectFiles';

const DEFAULT_HARDWARE_PROFILE = 'kms-4-string-31-inlay-v1';

export type ProjectOperation = 'confirming' | 'idle' | 'opening' | 'saving';

export type ProjectSource =
  | { kind: 'example' }
  | { kind: 'file'; file: ProjectFileReference }
  | { kind: 'new' };

export interface ActiveProjectSession {
  currentRevision: number;
  project: Project;
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
  | { project: Project; type: 'project-replaced' }
  | { feedback: SaveFeedback; type: 'save-failed' }
  | {
      file: ProjectFileReference;
      revision: number;
      type: 'save-succeeded';
    };

export const initialProjectSessionState: ProjectSessionState = {
  activeProject: null,
  launcherError: null,
  operation: 'idle',
  saveFeedback: null,
};

export function isProjectDirty(project: ActiveProjectSession): boolean {
  return (
    project.savedRevision === null ||
    project.currentRevision !== project.savedRevision
  );
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
    case 'project-replaced':
      if (!state.activeProject) {
        return state;
      }

      return {
        ...state,
        activeProject: {
          ...state.activeProject,
          currentRevision: state.activeProject.currentRevision + 1,
          project: parseProject(action.project),
        },
        saveFeedback: null,
      };
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
        const contents = serializeProject(snapshot.project);
        const currentFile =
          snapshot.source.kind === 'file' ? snapshot.source.file : null;
        let savedFile: ProjectFileReference;

        if (forceSaveAs || currentFile === null) {
          const selectedFile = await projectStorage.saveProjectAs(
            snapshot.project.name,
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
          revision: snapshot.currentRevision,
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
          activeProject.project.name,
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
      activeProject: {
        currentRevision: 0,
        project: createProject({
          hardwareProfile: DEFAULT_HARDWARE_PROFILE,
          name: 'Untitled Project',
        }),
        savedRevision: null,
        source: { kind: 'new' },
      },
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
        activeProject: {
          currentRevision: 0,
          project: parseProject(example.project),
          savedRevision: null,
          source: { kind: 'example' },
        },
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
        activeProject: {
          currentRevision: 0,
          project: parseProjectJson(selectedFile.contents),
          savedRevision: 0,
          source: {
            file: {
              fileName: selectedFile.fileName,
              handle: selectedFile.handle,
            },
            kind: 'file',
          },
        },
        type: 'project-activated',
      });
    } catch (error) {
      dispatch({ error: describeProjectError(error), type: 'launcher-error' });
    }
  }, [beginOperation, dispatch, projectStorage]);

  const replaceProject = useCallback(
    (project: Project) => {
      if (stateRef.current.activeProject) {
        dispatch({ project, type: 'project-replaced' });
      }
    },
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
    loadExample,
    openExistingProject,
    replaceProject,
    requestChooseAnother: () => requestLeave('choose-another'),
    save,
    state,
  };
}
