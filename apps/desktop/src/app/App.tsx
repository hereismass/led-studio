import { useEffect, useState } from 'react';
import type { AppLifecycleGateway } from '@/platform/ports/appLifecycle';
import type {
  ProjectStorageGateway,
  UnsavedChangesGateway,
} from '@/platform/ports/projectFiles';
import { nativeAppLifecycleGateway } from '@/platform/tauri/appLifecycle';
import { ProjectLauncher } from '@/app/launcher/ProjectLauncher';
import { ProjectWorkspace } from '@/workspace/ProjectWorkspace';
import type { EditorClipboard } from '@/workspace/model/editorClipboard';
import { WorkspaceErrorBoundary } from './WorkspaceErrorBoundary';
import {
  nativeProjectStorageGateway,
  nativeUnsavedChangesGateway,
} from '@/platform/tauri/projectFiles';
import { useProjectSession } from '@/app/session/projectSession';

interface AppProps {
  appLifecycle?: AppLifecycleGateway;
  projectStorage?: ProjectStorageGateway;
  unsavedChanges?: UnsavedChangesGateway;
}

export function App({
  appLifecycle = nativeAppLifecycleGateway,
  projectStorage = nativeProjectStorageGateway,
  unsavedChanges = nativeUnsavedChangesGateway,
}: AppProps) {
  const session = useProjectSession({
    appLifecycle,
    projectStorage,
    unsavedChanges,
  });
  const { activeProject } = session.state;
  const { redo, save, undo } = session;
  const [editorClipboard, setEditorClipboard] =
    useState<EditorClipboard | null>(null);

  useEffect(() => {
    if (!activeProject) {
      return;
    }

    function handleEditorShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void save(event.shiftKey);
        return;
      }

      const target = event.target;
      const isEditable =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName));
      if (
        !isEditable &&
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === 'z'
      ) {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      }
    }

    window.addEventListener('keydown', handleEditorShortcut);
    return () => window.removeEventListener('keydown', handleEditorShortcut);
  }, [activeProject, redo, save, undo]);

  if (activeProject) {
    return (
      <WorkspaceErrorBoundary
        disabled={session.state.operation !== 'idle'}
        onReturn={() => void session.requestChooseAnother()}
        onSaveAs={() => void session.save(true)}
      >
        <ProjectWorkspace
          activeProject={activeProject}
          canRedo={activeProject.future.length > 0}
          canUndo={activeProject.past.length > 0}
          editorFeedback={session.state.editorFeedback}
          editorClipboard={editorClipboard}
          operation={session.state.operation}
          onChooseAnother={() => void session.requestChooseAnother()}
          onExecuteCommand={session.executeCommand}
          onEditorClipboardChange={setEditorClipboard}
          onRedo={session.redo}
          onSave={() => void session.save()}
          onSaveAs={() => void session.save(true)}
          onUndo={session.undo}
          saveFeedback={session.state.saveFeedback}
        />
      </WorkspaceErrorBoundary>
    );
  }

  return (
    <ProjectLauncher
      launcherError={session.state.launcherError}
      operation={session.state.operation}
      onCreateNew={session.createNewProject}
      onLoadExample={session.loadExample}
      onOpen={() => void session.openExistingProject()}
    />
  );
}
