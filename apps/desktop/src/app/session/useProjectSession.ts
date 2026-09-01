import {
  createDefaultProject,
  EditorCommandError,
  type EditorCommand,
  type ExecuteEditorCommandOptions,
} from '@led-studio/editor-core';
import { parseProjectJson, serializeProject } from '@led-studio/project-format';
import {
  KMS_PROFILE_ID,
  getHardwareProfile,
} from '@led-studio/hardware-profiles';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppLifecycleGateway } from '@/platform/ports/appLifecycle';
import { projectExamples } from './examples';
import type {
  ProjectFileReference,
  ProjectStorageGateway,
  UnsavedChangesGateway,
  UnsavedChangesIntent,
} from '@/platform/ports/projectFiles';
import { describeProjectError, describeStorageError } from './sessionErrors';
import {
  createActiveProjectSession,
  initialProjectSessionState,
  isProjectDirty,
  projectSessionReducer,
  type EditorCommandResult,
  type ProjectOperation,
  type ProjectSessionAction,
} from './sessionModel';

const DEFAULT_HARDWARE_PROFILE = KMS_PROFILE_ID;

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

  const releaseProjectFile = useCallback(
    async (file: ProjectFileReference): Promise<void> => {
      try {
        await projectStorage.releaseProject(file);
      } catch (error) {
        console.error('Could not release LED Studio project handle', error);
      }
    },
    [projectStorage],
  );

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
        if (currentFile && currentFile.handle !== savedFile.handle)
          void releaseProjectFile(currentFile);
        return true;
      } catch (error) {
        console.error('Could not save LED Studio project', error);
        dispatch({
          feedback: {
            kind: 'error',
            message: describeStorageError(error, 'save'),
          },
          type: 'save-failed',
        });
        return false;
      }
    },
    [dispatch, projectStorage, releaseProjectFile],
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
        const source = stateRef.current.activeProject?.source;
        dispatch({ type: 'clear-active-project' });
        if (source?.kind === 'file') void releaseProjectFile(source.file);
      }

      return true;
    },
    [appLifecycle, dispatch, releaseProjectFile],
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

    const profile = getHardwareProfile(DEFAULT_HARDWARE_PROFILE);
    if (!profile) {
      dispatch({
        error: 'The default hardware profile is not available in this build.',
        type: 'launcher-error',
      });
      return;
    }

    dispatch({
      activeProject: createActiveProjectSession(
        createDefaultProject({ name: 'Untitled Project', profile }),
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
        error: describeStorageError(error, 'open'),
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
      void releaseProjectFile(selectedFile);
      dispatch({ error: describeProjectError(error), type: 'launcher-error' });
    }
  }, [beginOperation, dispatch, projectStorage, releaseProjectFile]);

  const executeCommand = useCallback(
    (
      command: EditorCommand,
      options?: ExecuteEditorCommandOptions,
    ): EditorCommandResult => {
      if (!stateRef.current.activeProject) {
        return { message: 'No project is open.', ok: false };
      }

      const previousRevision = stateRef.current.activeProject.present.revision;
      try {
        dispatch({ command, options, type: 'editor-command-executed' });
        return {
          changed:
            stateRef.current.activeProject?.present.revision !==
            previousRevision,
          ok: true,
        };
      } catch (error) {
        if (!(error instanceof EditorCommandError)) {
          console.error('Could not apply editor command', error);
        }
        const message =
          error instanceof Error
            ? error.message
            : 'LED Studio could not apply that change.';
        dispatch({ message, type: 'editor-command-failed' });
        return { message, ok: false };
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
