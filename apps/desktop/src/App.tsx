import { useEffect } from 'react';
import {
  nativeAppLifecycleGateway,
  type AppLifecycleGateway,
} from './appLifecycle';
import { ProjectLauncher } from './ProjectLauncher';
import { ProjectPreview } from './ProjectPreview';
import {
  nativeProjectStorageGateway,
  nativeUnsavedChangesGateway,
  type ProjectStorageGateway,
  type UnsavedChangesGateway,
} from './projectFiles';
import { useProjectSession } from './projectSession';

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

  useEffect(() => {
    if (!activeProject) {
      return;
    }

    function handleSaveShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void session.save(event.shiftKey);
      }
    }

    window.addEventListener('keydown', handleSaveShortcut);
    return () => window.removeEventListener('keydown', handleSaveShortcut);
  }, [activeProject, session.save]);

  if (activeProject) {
    return (
      <ProjectPreview
        activeProject={activeProject}
        operation={session.state.operation}
        onChooseAnother={() => void session.requestChooseAnother()}
        onSave={() => void session.save()}
        onSaveAs={() => void session.save(true)}
        saveFeedback={session.state.saveFeedback}
      />
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
